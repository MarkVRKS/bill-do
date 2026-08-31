const { generateId, selectAll, selectOne, run } = require('../db.js');
const { z } = require('zod');

const counterpartySchema = z.object({
  name: z.string().min(1).max(500),
  address: z.string().max(2000).optional().default(''),
  ogrn: z.string().max(15).optional().default(''),
  inn: z.string().max(12).optional().default(''),
  kpp: z.string().max(9).optional().default(''),
  basis: z.string().max(1000).optional().default(''),
  bases: z.array(z.string().max(1000)).optional().default([]),
  signer: z.string().max(500).optional().default(''),
});

function mapCp(row) {
  let bases = [];
  try { bases = JSON.parse(row.bases || '[]'); } catch { bases = []; }
  // Fallback: if bases is empty but basis has value, use it
  if ((!bases || bases.length === 0) && row.basis) bases = [row.basis];
  return {
    id: row.id, name: row.name, address: row.address, ogrn: row.ogrn,
    inn: row.inn, kpp: row.kpp, basis: row.basis, bases: bases, signer: row.signer,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

module.exports = async function counterpartyRoutes(app) {
  app.get('/api/counterparties', async (request, reply) => {
    const list = selectAll('SELECT * FROM counterparties ORDER BY name');
    return reply.send({ counterparties: list.map(mapCp) });
  });

  app.get('/api/counterparties/:id', async (request, reply) => {
    const { id } = request.params;
    const cp = selectOne('SELECT * FROM counterparties WHERE id = ?', [id]);
    if (!cp) return reply.status(404).send({ error: 'Контрагент не найден' });
    return reply.send({ counterparty: mapCp(cp) });
  });

  app.post('/api/counterparties', async (request, reply) => {
    const body = counterpartySchema.parse(request.body);
    const id = generateId();
    const basesJson = JSON.stringify(body.bases || []);
    run('INSERT INTO counterparties (id, name, address, ogrn, inn, kpp, basis, bases, signer) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, body.name, body.address, body.ogrn, body.inn, body.kpp, body.basis, basesJson, body.signer]);
    const cp = selectOne('SELECT * FROM counterparties WHERE id = ?', [id]);
    return reply.status(201).send({ counterparty: mapCp(cp) });
  });

  app.put('/api/counterparties/:id', async (request, reply) => {
    const { id } = request.params;
    const body = counterpartySchema.partial().parse(request.body);
    const existing = selectOne('SELECT id FROM counterparties WHERE id = ?', [id]);
    if (!existing) return reply.status(404).send({ error: 'Контрагент не найден' });
    const fields = [];
    const values = [];
    if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
    if (body.address !== undefined) { fields.push('address = ?'); values.push(body.address); }
    if (body.ogrn !== undefined) { fields.push('ogrn = ?'); values.push(body.ogrn); }
    if (body.inn !== undefined) { fields.push('inn = ?'); values.push(body.inn); }
    if (body.kpp !== undefined) { fields.push('kpp = ?'); values.push(body.kpp); }
    if (body.basis !== undefined) { fields.push('basis = ?'); values.push(body.basis); }
    if (body.bases !== undefined) { fields.push('bases = ?'); values.push(JSON.stringify(body.bases)); }
    if (body.signer !== undefined) { fields.push('signer = ?'); values.push(body.signer); }
    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id);
      run(`UPDATE counterparties SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    const cp = selectOne('SELECT * FROM counterparties WHERE id = ?', [id]);
    return reply.send({ counterparty: mapCp(cp) });
  });

  app.delete('/api/counterparties/:id', async (request, reply) => {
    const { id } = request.params;
    const existing = selectOne('SELECT id FROM counterparties WHERE id = ?', [id]);
    if (!existing) return reply.status(404).send({ error: 'Контрагент не найден' });
    run('DELETE FROM counterparties WHERE id = ?', [id]);
    return reply.send({ message: 'Контрагент удалён' });
  });
};
