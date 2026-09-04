// Local SQLite database for offline mobile use
import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';

let db: Database | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function selectAll(sql: string, params: any[] = []): any[] {
  if (!db) return [];
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function selectOne(sql: string, params: any[] = []): any {
  const rows = selectAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function run(sql: string, params: any[] = []) {
  if (!db) return;
  db.run(sql, params);
  scheduleSave();
}

let saveCallback: (() => void) | null = null;

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (db) {
      try {
        const data = db.export();
        const binary = String.fromCharCode(...new Uint8Array(data));
        localStorage.setItem('billdo_db', btoa(binary));
        if (saveCallback) saveCallback();
      } catch (e) {
        console.error('DB save error:', e);
      }
    }
  }, 1000);
}

export async function initLocalDb(onSave?: () => void): Promise<void> {
  saveCallback = onSave || null;

  try {
    const SQL = await initSqlJs({
      locateFile: (file: string) => {
        // Try to load from the same origin (works in Capacitor WebView)
        if (file.endsWith('.wasm')) {
          return './sql-wasm.wasm';
        }
        return file;
      }
    });

    const saved = localStorage.getItem('billdo_db');
    if (saved) {
      try {
        const binary = atob(saved);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        db = new SQL.Database(bytes);
      } catch (e) {
        console.error('DB load error, creating new:', e);
        db = new SQL.Database();
      }
    } else {
      db = new SQL.Database();
    }

    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');
    createTables();
    migrateTables();
    console.log('Local DB initialized successfully');
  } catch (e) {
    console.error('Failed to initialize local DB:', e);
    throw e;
  }
}

function createTables() {
  if (!db) return;
  db.run(`CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, inn TEXT DEFAULT '', kpp TEXT DEFAULT '',
    ogrn TEXT DEFAULT '', address TEXT DEFAULT '', director TEXT DEFAULT '', accountant TEXT DEFAULT '',
    bank_name TEXT DEFAULT '', bank_bik TEXT DEFAULT '', bank_corr TEXT DEFAULT '', bank_account TEXT DEFAULT '',
    logo_url TEXT DEFAULT '', next_invoice_number INTEGER DEFAULT 1, legal_form TEXT DEFAULT 'ООО',
    ogrnip TEXT DEFAULT '', is_active INTEGER DEFAULT 1, download_path TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS counterparties (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT DEFAULT '', ogrn TEXT DEFAULT '',
    inn TEXT DEFAULT '', kpp TEXT DEFAULT '', basis TEXT DEFAULT '', bases TEXT DEFAULT '[]',
    signer TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY, number TEXT NOT NULL, date TEXT NOT NULL, counterparty_id TEXT,
    basis TEXT DEFAULT '', bases TEXT DEFAULT '[]', signer TEXT DEFAULT '',
    service_month INTEGER DEFAULT 1, service_year INTEGER DEFAULT 2024, vat_type TEXT DEFAULT 'none',
    status TEXT DEFAULT 'sent', total TEXT DEFAULT '0', vat_amount TEXT DEFAULT '0',
    total_with_vat TEXT DEFAULT '0', due_date TEXT, paid_at TEXT,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS invoice_positions (
    id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL, sort_order INTEGER NOT NULL,
    name TEXT NOT NULL, quantity TEXT NOT NULL, unit TEXT DEFAULT 'шт.',
    price TEXT NOT NULL, amount TEXT NOT NULL
  )`);

  const count = selectOne('SELECT COUNT(*) as cnt FROM organizations');
  if (!count || count.cnt === 0) {
    run('INSERT INTO organizations (id, name, next_invoice_number) VALUES (?, ?, ?)', [generateId(), 'Моя организация', 1]);
  }
  scheduleSave();
}

function migrateTables() {
  if (!db) return;
  const migrations = [
    "ALTER TABLE organizations ADD COLUMN legal_form TEXT DEFAULT 'ООО'",
    "ALTER TABLE organizations ADD COLUMN ogrnip TEXT DEFAULT ''",
    "ALTER TABLE organizations ADD COLUMN is_active INTEGER DEFAULT 1",
    "ALTER TABLE organizations ADD COLUMN download_path TEXT DEFAULT ''",
    "ALTER TABLE counterparties ADD COLUMN bases TEXT DEFAULT '[]'",
    "ALTER TABLE invoices ADD COLUMN bases TEXT DEFAULT '[]'",
  ];
  for (const sql of migrations) { try { db.run(sql); } catch {} }
  scheduleSave();
}

// ===== API Implementation =====

function mapOrg(row: any) {
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

function mapCp(row: any) {
  let bases: string[] = [];
  try { bases = JSON.parse(row.bases || '[]'); } catch { bases = []; }
  if (bases.length === 0 && row.basis) bases = [row.basis];
  return {
    id: row.id, name: row.name || '', address: row.address || '', ogrn: row.ogrn || '',
    inn: row.inn || '', kpp: row.kpp || '', basis: row.basis || '', bases,
    signer: row.signer || '', createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapInv(row: any) {
  let bases: string[] = [];
  try { bases = JSON.parse(row.bases || '[]'); } catch { bases = []; }
  if (bases.length === 0 && row.basis) bases = [row.basis];
  return {
    id: row.id, number: row.number, date: row.date, counterpartyId: row.counterparty_id,
    bases, signer: row.signer || '', serviceMonth: row.service_month, serviceYear: row.service_year,
    vatType: row.vat_type, status: row.status, total: row.total, vatAmount: row.vat_amount,
    totalWithVat: row.total_with_vat, dueDate: row.due_date, paidAt: row.paid_at,
    createdAt: row.created_at, updatedAt: row.updated_at,
    counterpartyName: row.cp_name || '', positions: [] as any[],
  };
}

// ===== Organizations =====
export async function orgGetActive() {
  let org = selectOne('SELECT * FROM organizations WHERE is_active = 1 LIMIT 1');
  if (!org) org = selectOne('SELECT * FROM organizations LIMIT 1');
  if (!org) return { organization: null };
  return { organization: mapOrg(org) };
}

export async function orgGetAll() {
  return { organizations: selectAll('SELECT * FROM organizations').map(mapOrg) };
}

export async function orgCreate(data: any) {
  const id = generateId();
  run('INSERT INTO organizations (id, name, inn, kpp, ogrn, ogrnip, address, director, accountant, bank_name, bank_bik, bank_corr, bank_account, legal_form, download_path) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, data.name||'', data.inn||'', data.kpp||'', data.ogrn||'', data.ogrnip||'', data.address||'', data.director||'', data.accountant||'', data.bankName||'', data.bankBik||'', data.bankCorr||'', data.bankAccount||'', data.legalForm||'ООО', data.downloadPath||'']);
  return { organization: mapOrg(selectOne('SELECT * FROM organizations WHERE id=?', [id])) };
}

export async function orgUpdate(id: string, data: any) {
  const fields: string[] = [], values: any[] = [];
  const map: Record<string, string> = { name:'name', inn:'inn', kpp:'kpp', ogrn:'ogrn', ogrnip:'ogrnip', address:'address', director:'director', accountant:'accountant', bankName:'bank_name', bankBik:'bank_bik', bankCorr:'bank_corr', bankAccount:'bank_account', legalForm:'legal_form', downloadPath:'download_path' };
  for (const [k, col] of Object.entries(map)) { if (data[k] !== undefined) { fields.push(`${col}=?`); values.push(data[k]); } }
  if (fields.length > 0) { fields.push("updated_at=datetime('now')"); values.push(id); run(`UPDATE organizations SET ${fields.join(',')} WHERE id=?`, values); }
  return { organization: mapOrg(selectOne('SELECT * FROM organizations WHERE id=?', [id])) };
}

export async function orgDelete(id: string) {
  const cnt = selectOne('SELECT COUNT(*) as cnt FROM organizations');
  if (cnt && cnt.cnt <= 1) return { error: 'Нельзя удалить последнюю организацию' };
  run('DELETE FROM organizations WHERE id=?', [id]);
  const active = selectOne('SELECT id FROM organizations WHERE is_active=1');
  if (!active) { const next = selectOne('SELECT id FROM organizations LIMIT 1'); if (next) run('UPDATE organizations SET is_active=1 WHERE id=?', [next.id]); }
  return { success: true };
}

export async function orgSwitch(organizationId: string) {
  run('UPDATE organizations SET is_active=0');
  run('UPDATE organizations SET is_active=1 WHERE id=?', [organizationId]);
  return { success: true };
}

// ===== Counterparties =====
export async function cpGetAll() {
  return { counterparties: selectAll('SELECT * FROM counterparties').map(mapCp) };
}

export async function cpCreate(data: any) {
  const id = generateId();
  const bases = JSON.stringify(data.bases || []);
  run('INSERT INTO counterparties (id, name, address, inn, kpp, ogrn, bases) VALUES (?,?,?,?,?,?,?)',
    [id, data.name||'', data.address||'', data.inn||'', data.kpp||'', data.ogrn||'', bases]);
  return { counterparty: mapCp(selectOne('SELECT * FROM counterparties WHERE id=?', [id])) };
}

export async function cpUpdate(id: string, data: any) {
  const fields: string[] = [], values: any[] = [];
  const map: Record<string, string> = { name:'name', address:'address', inn:'inn', kpp:'kpp', ogrn:'ogrn' };
  for (const [k, col] of Object.entries(map)) { if (data[k] !== undefined) { fields.push(`${col}=?`); values.push(data[k]); } }
  if (data.bases !== undefined) { fields.push('bases=?'); values.push(JSON.stringify(data.bases)); }
  if (fields.length > 0) { fields.push("updated_at=datetime('now')"); values.push(id); run(`UPDATE counterparties SET ${fields.join(',')} WHERE id=?`, values); }
  return { counterparty: mapCp(selectOne('SELECT * FROM counterparties WHERE id=?', [id])) };
}

export async function cpDelete(id: string) {
  run('DELETE FROM counterparties WHERE id=?', [id]);
  return { success: true };
}

// ===== Invoices =====
export async function invGetAll(params?: Record<string, string>) {
  let sql = 'SELECT i.*, c.name as cp_name FROM invoices i LEFT JOIN counterparties c ON i.counterparty_id = c.id';
  const wheres: string[] = [], values: any[] = [];
  if (params?.dateFrom) { wheres.push('i.date >= ?'); values.push(params.dateFrom); }
  if (params?.dateTo) { wheres.push('i.date <= ?'); values.push(params.dateTo); }
  if (params?.status) { wheres.push('i.status = ?'); values.push(params.status); }
  if (params?.search) { wheres.push('(i.number LIKE ? OR c.name LIKE ?)'); values.push(`%${params.search}%`, `%${params.search}%`); }
  if (wheres.length) sql += ' WHERE ' + wheres.join(' AND ');
  sql += ' ORDER BY i.created_at DESC';
  const invoices = selectAll(sql, values).map(inv => {
    const m = mapInv(inv);
    m.counterpartyName = inv.cp_name || '';
    return m;
  });
  return { invoices };
}

export async function invGetStats() {
  const monthly = selectAll(`
    SELECT strftime('%m', date) as month, strftime('%Y', date) as year, SUM(CAST(total AS REAL)) as sum
    FROM invoices WHERE status IN ('paid','sent') GROUP BY year, month ORDER BY year, month
  `);
  return { stats: {}, monthly };
}

export async function invGetOne(id: string) {
  const inv = selectOne('SELECT * FROM invoices WHERE id=?', [id]);
  if (!inv) return { invoice: null };
  const positions = selectAll('SELECT * FROM invoice_positions WHERE invoice_id=? ORDER BY sort_order', [id]);
  const m = mapInv(inv);
  const cp = inv.counterparty_id ? selectOne('SELECT name FROM counterparties WHERE id=?', [inv.counterparty_id]) : null;
  m.counterpartyName = cp?.name || '';
  m.positions = positions.map((p: any) => ({ id: p.id, name: p.name, quantity: Number(p.quantity), unit: p.unit, price: Number(p.price), amount: Number(p.amount), sortOrder: p.sort_order }));
  return { invoice: m };
}

export async function invCreate(data: any) {
  const id = generateId();
  const bases = JSON.stringify(data.bases || []);
  const total = (data.positions || []).reduce((s: number, p: any) => s + (p.quantity || 0) * (p.price || 0), 0);
  let vatAmount = 0, totalWithVat = total;
  if (data.vatType === '20') { vatAmount = Math.round(total * 0.2 * 100) / 100; totalWithVat = Math.round((total + vatAmount) * 100) / 100; }
  else if (data.vatType === '22') { vatAmount = Math.round(total * 0.22 * 100) / 100; totalWithVat = Math.round((total + vatAmount) * 100) / 100; }
  else if (data.vatType === '10') { vatAmount = Math.round(total * 0.1 * 100) / 100; totalWithVat = Math.round((total + vatAmount) * 100) / 100; }

  run('INSERT INTO invoices (id, number, date, counterparty_id, bases, service_month, service_year, vat_type, status, total, vat_amount, total_with_vat) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, data.number, data.date, data.counterpartyId||null, bases, data.serviceMonth||1, data.serviceYear||2024, data.vatType||'none', data.status||'sent', String(total), String(vatAmount), String(totalWithVat)]);

  (data.positions || []).forEach((p: any, i: number) => {
    const pid = generateId();
    const amt = (p.quantity || 0) * (p.price || 0);
    run('INSERT INTO invoice_positions (id, invoice_id, sort_order, name, quantity, unit, price, amount) VALUES (?,?,?,?,?,?,?,?)',
      [pid, id, i + 1, p.name, String(p.quantity), p.unit || 'шт.', String(p.price), String(amt)]);
  });

  const org = selectOne('SELECT id, next_invoice_number FROM organizations WHERE is_active=1 LIMIT 1');
  if (org) run('UPDATE organizations SET next_invoice_number = next_invoice_number + 1 WHERE id=?', [org.id]);

  return { invoice: (await invGetOne(id)).invoice };
}

export async function invUpdate(id: string, data: any) {
  const bases = JSON.stringify(data.bases || []);
  const total = (data.positions || []).reduce((s: number, p: any) => s + (p.quantity || 0) * (p.price || 0), 0);
  let vatAmount = 0, totalWithVat = total;
  if (data.vatType === '20') { vatAmount = Math.round(total * 0.2 * 100) / 100; totalWithVat = Math.round((total + vatAmount) * 100) / 100; }
  else if (data.vatType === '22') { vatAmount = Math.round(total * 0.22 * 100) / 100; totalWithVat = Math.round((total + vatAmount) * 100) / 100; }
  else if (data.vatType === '10') { vatAmount = Math.round(total * 0.1 * 100) / 100; totalWithVat = Math.round((total + vatAmount) * 100) / 100; }

  run('UPDATE invoices SET number=?, date=?, counterparty_id=?, bases=?, service_month=?, service_year=?, vat_type=?, status=?, total=?, vat_amount=?, total_with_vat=?, updated_at=datetime(\'now\') WHERE id=?',
    [data.number, data.date, data.counterpartyId||null, bases, data.serviceMonth||1, data.serviceYear||2024, data.vatType||'none', data.status||'sent', String(total), String(vatAmount), String(totalWithVat), id]);

  run('DELETE FROM invoice_positions WHERE invoice_id=?', [id]);
  (data.positions || []).forEach((p: any, i: number) => {
    const pid = generateId();
    const amt = (p.quantity || 0) * (p.price || 0);
    run('INSERT INTO invoice_positions (id, invoice_id, sort_order, name, quantity, unit, price, amount) VALUES (?,?,?,?,?,?,?,?)',
      [pid, id, i + 1, p.name, String(p.quantity), p.unit || 'шт.', String(p.price), String(amt)]);
  });

  return { invoice: (await invGetOne(id)).invoice };
}

export async function invUpdateStatus(id: string, status: string) {
  run("UPDATE invoices SET status=?, updated_at=datetime('now') WHERE id=?", [status, id]);
  return { success: true };
}

export async function invDelete(id: string) {
  run('DELETE FROM invoice_positions WHERE invoice_id=?', [id]);
  run('DELETE FROM invoices WHERE id=?', [id]);
  return { success: true };
}

// ===== Billing (stub) =====
export async function billingGetPlans() { return { plans: [] }; }
export async function billingGetSubscription() { return { subscription: null, usage: { invoicesThisMonth: 0, limit: null } }; }
export async function billingSubscribe(_planId?: string) { return { subscription: null }; }
export async function billingCancel() { return { success: true }; }

// ===== Auth (stub - no auth in offline mode) =====
export async function authRegister(_email?: string, _password?: string) { return { user: { id: '1', email: 'user@billdo.app', onboardingDone: true } }; }
export async function authLogin(_email?: string, _password?: string) { return { user: { id: '1', email: 'user@billdo.app', onboardingDone: true } }; }
export async function authLogout() { return { success: true }; }
export async function authMe() { return { user: { id: '1', email: 'user@billdo.app', emailVerified: true, onboardingDone: true } }; }
export async function authOnboardingDone() { return { success: true }; }
