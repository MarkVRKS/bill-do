const { selectOne, selectAll } = require('../db.js');
const { generateExcel } = require('../lib/excel.js');
const { generateAct } = require('../lib/act.js');

const MONTHS_NOMINATIVE = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

function buildFilename(type, invoiceNumber, legalForm, cpName, month, year, ext) {
  const prefix = type === 'invoice' ? 'Счет_на_оплату' : 'Акт_оказанных_услуг';
  const safeLf = (legalForm || '').replace(/[^а-яА-Яa-zA-Z]/g, '');
  const safeCp = (cpName || 'без_покупателя').replace(/[^а-яА-Яa-zA-Z0-9]/g, '_');
  const monthName = MONTHS_NOMINATIVE[month] || '';
  return `${prefix}_№${invoiceNumber}_${safeLf}_${safeCp}_${monthName}_${year}${ext}`;
}

function getInvoiceFullData(invoiceId) {
  const inv = selectOne('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (!inv) return null;
  const org = selectOne('SELECT * FROM organizations LIMIT 1');
  let cp = null;
  if (inv.counterparty_id) {
    cp = selectOne('SELECT * FROM counterparties WHERE id = ?', [inv.counterparty_id]);
  }
  const positions = selectAll('SELECT * FROM invoice_positions WHERE invoice_id = ? ORDER BY sort_order', [invoiceId]);
  return { inv, org, cp, positions };
}

function mapOrgData(org) {
  return { name: org.name, inn: org.inn || '', kpp: org.kpp || '', address: org.address || '', director: org.director || '', accountant: org.accountant || '', bankName: org.bank_name || '', bankBik: org.bank_bik || '', bankCorr: org.bank_corr || '', bankAccount: org.bank_account || '', legalForm: org.legal_form || 'ООО' };
}

function mapCpData(cp) {
  return cp ? { name: cp.name, address: cp.address || '', ogrn: cp.ogrn || '', inn: cp.inn || '', kpp: cp.kpp || '' } : null;
}

function mapInvData(inv, positions) {
  let bases = [];
  try { bases = JSON.parse(inv.bases || '[]'); } catch { bases = []; }
  if ((!bases || bases.length === 0) && inv.basis) bases = [inv.basis];
  return { number: inv.number, date: inv.date, basis: inv.basis || '', bases: bases, signer: inv.signer || '', serviceMonth: inv.service_month || 1, serviceYear: inv.service_year || 2024, vatType: inv.vat_type, total: inv.total, vatAmount: inv.vat_amount || '0', totalWithVat: inv.total_with_vat, positions: positions.map(p => ({ sortOrder: p.sort_order, name: p.name, quantity: p.quantity, unit: p.unit, price: p.price, amount: p.amount })) };
}

module.exports = async function documentRoutes(app) {
  // ===== EXCEL =====
  app.get('/api/invoices/:id/excel', async (request, reply) => {
    try {
      const { id } = request.params;
      const data = getInvoiceFullData(id);
      if (!data) return reply.status(404).send({ error: 'Счёт не найден' });
      const { inv, org, cp, positions } = data;
      const buffer = await generateExcel(mapOrgData(org), mapCpData(cp), mapInvData(inv, positions));
      const filename = buildFilename('invoice', inv.number, org.legal_form || 'ООО', cp?.name || '', inv.service_month || 1, inv.service_year || 2024, '.xlsx');
      return reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`).send(buffer);
    } catch (err) {
      console.error('Excel error:', err);
      return reply.status(500).send({ error: 'Ошибка Excel: ' + (err.message || String(err)) });
    }
  });

  // ===== PDF — returns HTML, client generates PDF via Electron IPC =====
  app.get('/api/invoices/:id/pdf', async (request, reply) => {
    const { id } = request.params;
    try {
      const data = getInvoiceFullData(id);
      if (!data) return reply.status(404).send({ error: 'Счёт не найден' });
      const { inv, org, cp, positions } = data;
      const { invoiceHTML } = require('../lib/pdf.js');
      const html = invoiceHTML(mapOrgData(org), mapCpData(cp), mapInvData(inv, positions));
      return reply.header('Content-Type', 'text/html; charset=utf-8').send(html);
    } catch (err) {
      console.error('[PDF] ERROR:', err.message);
      return reply.status(500).send({ error: 'Ошибка: ' + (err.message || String(err)) });
    }
  });

  // ===== ACT EXCEL =====
  app.get('/api/invoices/:id/act', async (request, reply) => {
    try {
      const { id } = request.params;
      const data = getInvoiceFullData(id);
      if (!data) return reply.status(404).send({ error: 'Счёт не найден' });
      const { inv, org, cp, positions } = data;
      const buffer = await generateAct(mapOrgData(org), mapCpData(cp), mapInvData(inv, positions));
      const filename = buildFilename('act', inv.number, org.legal_form || 'ООО', cp?.name || '', inv.service_month || 1, inv.service_year || 2024, '.xlsx');
      return reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`).send(buffer);
    } catch (err) {
      console.error('Act Excel error:', err);
      return reply.status(500).send({ error: 'Ошибка акта: ' + (err.message || String(err)) });
    }
  });

  // ===== ACT PDF — returns HTML =====
  app.get('/api/invoices/:id/act-pdf', async (request, reply) => {
    const { id } = request.params;
    try {
      const data = getInvoiceFullData(id);
      if (!data) return reply.status(404).send({ error: 'Счёт не найден' });
      const { inv, org, cp, positions } = data;
      const { actHTML } = require('../lib/pdf.js');
      const html = actHTML(mapOrgData(org), mapCpData(cp), mapInvData(inv, positions));
      return reply.header('Content-Type', 'text/html; charset=utf-8').send(html);
    } catch (err) {
      console.error('[ACT-PDF] ERROR:', err.message);
      return reply.status(500).send({ error: 'Ошибка: ' + (err.message || String(err)) });
    }
  });

  // ===== HTML for printing (fallback) =====
  app.get('/api/invoices/:id/print', async (request, reply) => {
    try {
      const { id } = request.params;
      const data = getInvoiceFullData(id);
      if (!data) return reply.status(404).send({ error: 'Счёт не найден' });
      const { inv, org, cp, positions } = data;
      const { invoiceHTML } = require('../lib/pdf.js');
      const html = invoiceHTML(mapOrgData(org), mapCpData(cp), mapInvData(inv, positions));
      return reply.header('Content-Type', 'text/html; charset=utf-8').send(html);
    } catch (err) {
      return reply.status(500).send('<h1>Ошибка</h1><p>' + err.message + '</p>');
    }
  });

  app.get('/api/invoices/:id/act-print', async (request, reply) => {
    try {
      const { id } = request.params;
      const data = getInvoiceFullData(id);
      if (!data) return reply.status(404).send({ error: 'Счёт не найден' });
      const { inv, org, cp, positions } = data;
      const { actHTML } = require('../lib/pdf.js');
      const html = actHTML(mapOrgData(org), mapCpData(cp), mapInvData(inv, positions));
      return reply.header('Content-Type', 'text/html; charset=utf-8').send(html);
    } catch (err) {
      return reply.status(500).send('<h1>Ошибка</h1><p>' + err.message + '</p>');
    }
  });
};
