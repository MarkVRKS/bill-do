const { generateId, selectAll, selectOne, run } = require('../db.js');
const { z } = require('zod');

const positionSchema = z.object({
  name: z.string().min(1).max(1000),
  quantity: z.coerce.number().positive(),
  unit: z.string().max(50).optional().default('шт.'),
  price: z.coerce.number().min(0),
});

const invoiceSchema = z.object({
  number: z.string().min(1).max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  counterpartyId: z.string().optional().nullable(),
  basis: z.string().max(1000).optional().default(''),
  bases: z.array(z.string().max(1000)).optional().default([]),
  signer: z.string().max(500).optional().default(''),
  serviceMonth: z.coerce.number().min(1).max(12),
  serviceYear: z.coerce.number().min(2020).max(2099),
  vatType: z.enum(['none', '0', '10', '20', '22']).default('none'),
  status: z.enum(['draft', 'sent', 'paid', 'overdue']).optional().default('sent'),
  dueDate: z.string().optional().nullable(),
  positions: z.array(positionSchema).min(1),
});

function mapInvoice(row) {
  let bases = [];
  try { bases = JSON.parse(row.bases || '[]'); } catch { bases = []; }
  if ((!bases || bases.length === 0) && row.basis) bases = [row.basis];
  return {
    id: row.id, number: row.number, date: row.date,
    counterpartyId: row.counterparty_id, counterpartyName: row.counterparty_name,
    basis: row.basis, bases: bases, signer: row.signer,
    serviceMonth: row.service_month, serviceYear: row.service_year,
    vatType: row.vat_type, status: row.status,
    total: row.total, vatAmount: row.vat_amount, totalWithVat: row.total_with_vat,
    dueDate: row.due_date, paidAt: row.paid_at,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapPosition(row) {
  return {
    id: row.id, invoiceId: row.invoice_id, sortOrder: row.sort_order,
    name: row.name, quantity: row.quantity, unit: row.unit,
    price: row.price, amount: row.amount,
  };
}

function calcTotals(positions, vatType) {
  let total = 0;
  const posData = positions.map((pos, i) => {
    const amount = Math.round(pos.quantity * pos.price * 100) / 100;
    total += amount;
    return { sortOrder: i + 1, name: pos.name, quantity: String(pos.quantity), unit: pos.unit || 'шт.', price: String(pos.price), amount: String(amount) };
  });
  total = Math.round(total * 100) / 100;
  let vatAmount = 0;
  let totalWithVat = total;
  if (vatType === '20') { vatAmount = Math.round(total * 0.2 * 100) / 100; totalWithVat = Math.round((total + vatAmount) * 100) / 100; }
  else if (vatType === '22') { vatAmount = Math.round(total * 0.22 * 100) / 100; totalWithVat = Math.round((total + vatAmount) * 100) / 100; }
  else if (vatType === '10') { vatAmount = Math.round(total * 0.1 * 100) / 100; totalWithVat = Math.round((total + vatAmount) * 100) / 100; }
  return { posData, total, vatAmount, totalWithVat };
}

module.exports = async function invoiceRoutes(app) {
  app.get('/api/invoices', async (request, reply) => {
    const q = request.query || {};
    let sql = `SELECT i.*, c.name as counterparty_name FROM invoices i LEFT JOIN counterparties c ON i.counterparty_id = c.id WHERE 1=1`;
    const params = [];
    if (q.status) { sql += ' AND i.status = ?'; params.push(q.status); }
    if (q.dateFrom) { sql += ' AND i.date >= ?'; params.push(q.dateFrom); }
    if (q.dateTo) { sql += ' AND i.date <= ?'; params.push(q.dateTo); }
    if (q.search) { sql += ' AND (i.number LIKE ? OR i.basis LIKE ? OR c.name LIKE ?)'; params.push(`%${q.search}%`, `%${q.search}%`, `%${q.search}%`); }
    sql += ' ORDER BY i.created_at DESC';
    const list = selectAll(sql, params);
    return reply.send({ invoices: list.map(mapInvoice) });
  });

  app.get('/api/invoices/stats', async (request, reply) => {
    const q = request.query || {};
    let where = 'WHERE 1=1';
    const params = [];
    if (q.dateFrom) { where += ' AND date >= ?'; params.push(q.dateFrom); }
    if (q.dateTo) { where += ' AND date <= ?'; params.push(q.dateTo); }
    const stats = selectOne(`SELECT COUNT(*) as count, COALESCE(SUM(CAST(total AS REAL)), 0) as total, COALESCE(SUM(CAST(total_with_vat AS REAL)), 0) as total_with_vat FROM invoices ${where}`, params);
    const monthly = selectAll(`SELECT CAST(strftime('%m', date) AS INTEGER) as month, CAST(strftime('%Y', date) AS INTEGER) as year, COALESCE(SUM(CAST(total AS REAL)), 0) as sum FROM invoices ${where} GROUP BY strftime('%Y-%m', date)`, params);
    return reply.send({
      stats: {
        count: stats?.count || 0,
        total: String(stats?.total || 0),
        totalWithVat: String(stats?.total_with_vat || 0),
        average: stats?.count ? String(stats.total / stats.count) : '0',
      },
      monthly,
    });
  });

  app.get('/api/invoices/:id', async (request, reply) => {
    const { id } = request.params;
    const inv = selectOne(`SELECT i.*, c.name as counterparty_name FROM invoices i LEFT JOIN counterparties c ON i.counterparty_id = c.id WHERE i.id = ?`, [id]);
    if (!inv) return reply.status(404).send({ error: 'Счёт не найден' });
    const positions = selectAll('SELECT * FROM invoice_positions WHERE invoice_id = ? ORDER BY sort_order', [id]);
    return reply.send({ invoice: { ...mapInvoice(inv), positions: positions.map(mapPosition) } });
  });

  app.post('/api/invoices', async (request, reply) => {
    const body = invoiceSchema.parse(request.body);
    const org = selectOne('SELECT next_invoice_number FROM organizations LIMIT 1');
    const invoiceNumber = body.number || String(org?.next_invoice_number || 1);
    const { posData, total, vatAmount, totalWithVat } = calcTotals(body.positions, body.vatType);
    const id = generateId();
    const basesJson = JSON.stringify(body.bases || []);
    run('INSERT INTO invoices (id, number, date, counterparty_id, basis, bases, signer, service_month, service_year, vat_type, status, total, vat_amount, total_with_vat, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, invoiceNumber, body.date, body.counterpartyId || null, body.basis, basesJson, body.signer, body.serviceMonth, body.serviceYear, body.vatType, body.status || 'sent', String(total), String(vatAmount), String(totalWithVat), body.dueDate || null]);
    if (posData.length > 0) {
      for (const pos of posData) {
        run('INSERT INTO invoice_positions (id, invoice_id, sort_order, name, quantity, unit, price, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [generateId(), id, pos.sortOrder, pos.name, pos.quantity, pos.unit, pos.price, pos.amount]);
      }
    }
    if (org) {
      run('UPDATE organizations SET next_invoice_number = ? WHERE id = (SELECT id FROM organizations LIMIT 1)', [(org.next_invoice_number || 0) + 1]);
    }
    return reply.status(201).send({ invoice: { id, number: invoiceNumber } });
  });

  app.put('/api/invoices/:id', async (request, reply) => {
    const { id } = request.params;
    const body = invoiceSchema.parse(request.body);
    const existing = selectOne('SELECT id FROM invoices WHERE id = ?', [id]);
    if (!existing) return reply.status(404).send({ error: 'Счёт не найден' });
    const { posData, total, vatAmount, totalWithVat } = calcTotals(body.positions, body.vatType);
    const basesJson = JSON.stringify(body.bases || []);
    run('UPDATE invoices SET number=?, date=?, counterparty_id=?, basis=?, bases=?, signer=?, service_month=?, service_year=?, vat_type=?, status=?, total=?, vat_amount=?, total_with_vat=?, due_date=?, updated_at=datetime(\'now\') WHERE id=?',
      [body.number, body.date, body.counterpartyId || null, body.basis, basesJson, body.signer, body.serviceMonth, body.serviceYear, body.vatType, body.status || 'sent', String(total), String(vatAmount), String(totalWithVat), body.dueDate || null, id]);
    run('DELETE FROM invoice_positions WHERE invoice_id = ?', [id]);
    if (posData.length > 0) {
      for (const pos of posData) {
        run('INSERT INTO invoice_positions (id, invoice_id, sort_order, name, quantity, unit, price, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [generateId(), id, pos.sortOrder, pos.name, pos.quantity, pos.unit, pos.price, pos.amount]);
      }
    }
    return reply.send({ message: 'Счёт обновлён' });
  });

  app.patch('/api/invoices/:id/status', async (request, reply) => {
    const { id } = request.params;
    const { status } = request.body;
    const validStatuses = ['draft', 'sent', 'paid', 'overdue'];
    if (!validStatuses.includes(status)) return reply.status(400).send({ error: 'Недопустимый статус' });
    const existing = selectOne('SELECT id FROM invoices WHERE id = ?', [id]);
    if (!existing) return reply.status(404).send({ error: 'Счёт не найден' });
    if (status === 'paid') {
      run('UPDATE invoices SET status = ?, paid_at = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ?', [status, id]);
    } else {
      run('UPDATE invoices SET status = ?, updated_at = datetime(\'now\') WHERE id = ?', [status, id]);
    }
    return reply.send({ message: 'Статус обновлён' });
  });

  app.delete('/api/invoices/:id', async (request, reply) => {
    const { id } = request.params;
    const existing = selectOne('SELECT id FROM invoices WHERE id = ?', [id]);
    if (!existing) return reply.status(404).send({ error: 'Счёт не найден' });
    run('DELETE FROM invoice_positions WHERE invoice_id = ?', [id]);
    run('DELETE FROM invoices WHERE id = ?', [id]);
    return reply.send({ message: 'Счёт удалён' });
  });
};
