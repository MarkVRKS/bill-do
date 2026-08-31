const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
let dbPath = null;

async function initDb(filePath, wasmPath) {
  dbPath = filePath;
  const sqlOpts = {};
  if (wasmPath && fs.existsSync(wasmPath)) {
    sqlOpts.locateFile = () => wasmPath;
  }
  const SQL = await initSqlJs(sqlOpts);
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');
  createTables(db);
  migrateTables(db);
  return db;
}

function createTables(database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      inn TEXT DEFAULT '',
      kpp TEXT DEFAULT '',
      ogrn TEXT DEFAULT '',
      address TEXT DEFAULT '',
      director TEXT DEFAULT '',
      accountant TEXT DEFAULT '',
      bank_name TEXT DEFAULT '',
      bank_bik TEXT DEFAULT '',
      bank_corr TEXT DEFAULT '',
      bank_account TEXT DEFAULT '',
      logo_url TEXT DEFAULT '',
      next_invoice_number INTEGER DEFAULT 1,
      legal_form TEXT DEFAULT 'ООО',
      ogrnip TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      download_path TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS counterparties (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT DEFAULT '',
      ogrn TEXT DEFAULT '',
      inn TEXT DEFAULT '',
      kpp TEXT DEFAULT '',
      basis TEXT DEFAULT '',
      bases TEXT DEFAULT '[]',
      signer TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      number TEXT NOT NULL,
      date TEXT NOT NULL,
      counterparty_id TEXT,
      basis TEXT DEFAULT '',
      bases TEXT DEFAULT '[]',
      signer TEXT DEFAULT '',
      service_month INTEGER DEFAULT 1,
      service_year INTEGER DEFAULT 2024,
      vat_type TEXT DEFAULT 'none',
      status TEXT DEFAULT 'sent',
      total TEXT DEFAULT '0',
      vat_amount TEXT DEFAULT '0',
      total_with_vat TEXT DEFAULT '0',
      due_date TEXT,
      paid_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS invoice_positions (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      name TEXT NOT NULL,
      quantity TEXT NOT NULL,
      unit TEXT DEFAULT 'шт.',
      price TEXT NOT NULL,
      amount TEXT NOT NULL
    );
  `);

  const result = database.exec('SELECT COUNT(*) as cnt FROM organizations');
  const count = result.length > 0 ? result[0].values[0][0] : 0;
  if (count === 0) {
    const uuid = generateId();
    database.run('INSERT INTO organizations (id, name, next_invoice_number) VALUES (?, ?, ?)', [uuid, 'Моя организация', 1]);
  }
  saveDb();
}

function migrateTables(database) {
  const migrations = [
    "ALTER TABLE organizations ADD COLUMN legal_form TEXT DEFAULT 'ООО'",
    "ALTER TABLE organizations ADD COLUMN ogrnip TEXT DEFAULT ''",
    "ALTER TABLE organizations ADD COLUMN is_active INTEGER DEFAULT 1",
    "ALTER TABLE organizations ADD COLUMN download_path TEXT DEFAULT ''",
    "ALTER TABLE counterparties ADD COLUMN bases TEXT DEFAULT '[]'",
    "ALTER TABLE invoices ADD COLUMN bases TEXT DEFAULT '[]'",
  ];
  for (const sql of migrations) {
    try { database.run(sql); } catch (_) { /* column already exists */ }
  }
  // Migrate existing basis text to bases array
  try {
    const cpRows = database.exec("SELECT id, basis FROM counterparties WHERE (bases IS NULL OR bases = '[]') AND basis IS NOT NULL AND basis != ''");
    if (cpRows.length > 0) {
      for (const row of cpRows[0].values) {
        const bases = JSON.stringify([row[1]]);
        database.run('UPDATE counterparties SET bases = ? WHERE id = ?', [bases, row[0]]);
      }
    }
    const invRows = database.exec("SELECT id, basis FROM invoices WHERE (bases IS NULL OR bases = '[]') AND basis IS NOT NULL AND basis != ''");
    if (invRows.length > 0) {
      for (const row of invRows[0].values) {
        const bases = JSON.stringify([row[1]]);
        database.run('UPDATE invoices SET bases = ? WHERE id = ?', [bases, row[0]]);
      }
    }
  } catch (_) {}
  saveDb();
}

function getDb() {
  return db;
}

function saveDb() {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function selectAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function selectOne(sql, params = []) {
  const rows = selectAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

module.exports = { initDb, getDb, closeDb, generateId, selectAll, selectOne, run, saveDb };
