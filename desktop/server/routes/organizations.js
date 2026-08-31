const { generateId, selectAll, selectOne, run } = require('../db.js');
const { z } = require('zod');

const organizationSchema = z.object({
  name: z.string().min(1).max(500),
  inn: z.string().max(12).optional().default(''),
  kpp: z.string().max(9).optional().default(''),
  ogrn: z.string().max(15).optional().default(''),
  ogrnip: z.string().max(15).optional().default(''),
  address: z.string().max(2000).optional().default(''),
  director: z.string().max(500).optional().default(''),
  accountant: z.string().max(500).optional().default(''),
  bankName: z.string().max(500).optional().default(''),
  bankBik: z.string().max(9).optional().default(''),
  bankCorr: z.string().max(20).optional().default(''),
  bankAccount: z.string().max(20).optional().default(''),
  legalForm: z.string().max(50).optional().default('ООО'),
  downloadPath: z.string().max(2000).optional().default(''),
});

function mapOrg(row) {
  return {
    id: row.id, name: row.name || '', inn: row.inn || '', kpp: row.kpp || '', ogrn: row.ogrn || '',
    ogrnip: row.ogrnip || '', legalForm: row.legal_form || 'ООО',
    address: row.address || '', director: row.director || '', accountant: row.accountant || '',
    bankName: row.bank_name || '', bankBik: row.bank_bik || '', bankCorr: row.bank_corr || '',
    bankAccount: row.bank_account || '', logoUrl: row.logo_url || '',
    nextInvoiceNumber: row.next_invoice_number,
    isActive: row.is_active, downloadPath: row.download_path || '',
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

module.exports = async function organizationRoutes(app) {
  app.get('/api/organizations/active', async (request, reply) => {
    let org = selectOne('SELECT * FROM organizations WHERE is_active = 1 LIMIT 1');
    if (!org) org = selectOne('SELECT * FROM organizations LIMIT 1');
    if (!org) return reply.status(404).send({ error: 'Организация не найдена' });
    return reply.send({ organization: mapOrg(org) });
  });

  app.get('/api/organizations', async (request, reply) => {
    const orgs = selectAll('SELECT * FROM organizations');
    return reply.send({ organizations: orgs.map(mapOrg) });
  });

  app.post('/api/organizations', async (request, reply) => {
    const body = organizationSchema.parse(request.body);
    const id = generateId();
    run('INSERT INTO organizations (id, name, inn, kpp, ogrn, ogrnip, address, director, accountant, bank_name, bank_bik, bank_corr, bank_account, legal_form, download_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, body.name, body.inn, body.kpp, body.ogrn, body.ogrnip, body.address, body.director, body.accountant, body.bankName, body.bankBik, body.bankCorr, body.bankAccount, body.legalForm, body.downloadPath]);
    const org = selectOne('SELECT * FROM organizations WHERE id = ?', [id]);
    return reply.status(201).send({ organization: mapOrg(org) });
  });

  app.put('/api/organizations/:id', async (request, reply) => {
    const { id } = request.params;
    const body = organizationSchema.partial().parse(request.body);
    const existing = selectOne('SELECT id FROM organizations WHERE id = ?', [id]);
    if (!existing) return reply.status(404).send({ error: 'Организация не найдена' });
    const fields = [];
    const values = [];
    if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
    if (body.inn !== undefined) { fields.push('inn = ?'); values.push(body.inn); }
    if (body.kpp !== undefined) { fields.push('kpp = ?'); values.push(body.kpp); }
    if (body.ogrn !== undefined) { fields.push('ogrn = ?'); values.push(body.ogrn); }
    if (body.address !== undefined) { fields.push('address = ?'); values.push(body.address); }
    if (body.director !== undefined) { fields.push('director = ?'); values.push(body.director); }
    if (body.accountant !== undefined) { fields.push('accountant = ?'); values.push(body.accountant); }
    if (body.bankName !== undefined) { fields.push('bank_name = ?'); values.push(body.bankName); }
    if (body.bankBik !== undefined) { fields.push('bank_bik = ?'); values.push(body.bankBik); }
    if (body.bankCorr !== undefined) { fields.push('bank_corr = ?'); values.push(body.bankCorr); }
    if (body.bankAccount !== undefined) { fields.push('bank_account = ?'); values.push(body.bankAccount); }
    if (body.legalForm !== undefined) { fields.push('legal_form = ?'); values.push(body.legalForm); }
    if (body.ogrnip !== undefined) { fields.push('ogrnip = ?'); values.push(body.ogrnip); }
    if (body.downloadPath !== undefined) { fields.push('download_path = ?'); values.push(body.downloadPath); }
    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id);
      run(`UPDATE organizations SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    const org = selectOne('SELECT * FROM organizations WHERE id = ?', [id]);
    return reply.send({ organization: mapOrg(org) });
  });

  app.delete('/api/organizations/:id', async (request, reply) => {
    const { id } = request.params;
    const existing = selectOne('SELECT id FROM organizations WHERE id = ?', [id]);
    if (!existing) return reply.status(404).send({ error: 'Организация не найдена' });
    const count = selectOne('SELECT COUNT(*) as cnt FROM organizations');
    if (count && count.cnt <= 1) return reply.status(400).send({ error: 'Нельзя удалить последнюю организацию' });
    run('DELETE FROM organizations WHERE id = ?', [id]);
    // Switch to next org if deleted one was active
    const active = selectOne('SELECT id FROM organizations WHERE is_active = 1');
    if (!active) {
      const next = selectOne('SELECT id FROM organizations LIMIT 1');
      if (next) run('UPDATE organizations SET is_active = 1 WHERE id = ?', [next.id]);
    }
    return reply.send({ success: true });
  });

  app.post('/api/organizations/switch', async (request, reply) => {
    const { organizationId } = request.body || {};
    if (!organizationId) return reply.status(400).send({ error: 'organizationId is required' });
    const existing = selectOne('SELECT id FROM organizations WHERE id = ?', [organizationId]);
    if (!existing) return reply.status(404).send({ error: 'Организация не найдена' });
    run('UPDATE organizations SET is_active = 0');
    run('UPDATE organizations SET is_active = 1 WHERE id = ?', [organizationId]);
    return reply.send({ success: true });
  });
};
