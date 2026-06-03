import fs from "node:fs";
import path from "node:path";
import initSqlJs from "sql.js";

const DB_MODE = String(process.env.DB_MODE ?? "").trim().toLowerCase(); // "sqlite" | "postgres"
const DB_PATH = path.resolve(process.cwd(), "data", "app.sqlite");

function isPostgresMode() {
  // Default to sqlite to preserve current behavior for local dev.
  if (DB_MODE) return DB_MODE === "postgres" || DB_MODE === "pg" || DB_MODE === "supabase";
  return Boolean(process.env.DATABASE_URL);
}

function toPgParams(sql) {
  // Convert SQLite-style positional placeholders `?` into pg `$1..$n`.
  // Assumes `?` does not appear inside string literals (true for our queries).
  let i = 0;
  const text = String(sql).replace(/\?/g, () => `$${++i}`);
  return { text };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readFileIfExists(filePath) {
  try {
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

export async function createDb() {
  if (isPostgresMode()) return createPgDb();
  ensureDir(path.dirname(DB_PATH));
  const SQL = await initSqlJs();
  const existing = readFileIfExists(DB_PATH);
  const db = existing ? new SQL.Database(existing) : new SQL.Database();

  db.run(`
    PRAGMA journal_mode = MEMORY;
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      nick TEXT,
      paid INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tournament_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS predictions (
      email TEXT NOT NULL,
      match_id TEXT NOT NULL,
      local INTEGER,
      visitante INTEGER,
      winner TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (email, match_id)
    );
    CREATE TABLE IF NOT EXISTS goleadores_picks (
      email TEXT PRIMARY KEY,
      picks_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS goleadores_result (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      picks_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS zamora_picks (
      email TEXT PRIMARY KEY,
      pick_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS zamora_result (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      pick_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mvp_picks (
      email TEXT PRIMARY KEY,
      pick_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mvp_result (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      pick_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Migration: existing DBs may not have the nick column.
  try {
    db.run("ALTER TABLE users ADD COLUMN nick TEXT");
  } catch {
    // ignore if already exists
  }

  // Migration: existing DBs may not have the paid column.
  try {
    db.run("ALTER TABLE users ADD COLUMN paid INTEGER NOT NULL DEFAULT 0");
  } catch {
    // ignore if already exists
  }

  // Migration: existing DBs may not have the winner column.
  try {
    db.run("ALTER TABLE predictions ADD COLUMN winner TEXT");
  } catch {
    // ignore if already exists
  }

  // Seed goleadores_picks table for existing DBs (if missing).
  // (CREATE TABLE IF NOT EXISTS already handles new DBs.)

  persistDb(db);
  return {
    db,
    persist: () => persistDb(db),
    dbPath: DB_PATH,
    mode: "sqlite",
  };
}

async function createPgDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required when DB_MODE=postgres (or when using Postgres mode).");
  }

  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString,
    // Supabase often requires TLS; allow env override.
    ssl:
      String(process.env.PGSSLMODE ?? "").toLowerCase() === "disable"
        ? false
        : { rejectUnauthorized: false },
    max: Number(process.env.PGPOOL_MAX ?? 5),
  });
  pool.__dbKind = "pg";

  // Create schema (idempotent) for compatibility with the existing sqlite tables.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      auth_user_id UUID UNIQUE,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      nick TEXT,
      paid BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tournament_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      json JSONB NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS predictions (
      email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
      match_id TEXT NOT NULL,
      local INTEGER,
      visitante INTEGER,
      winner TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (email, match_id)
    );
    CREATE TABLE IF NOT EXISTS goleadores_picks (
      email TEXT PRIMARY KEY REFERENCES users(email) ON DELETE CASCADE,
      picks_json JSONB NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS goleadores_result (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      picks_json JSONB NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS zamora_picks (
      email TEXT PRIMARY KEY REFERENCES users(email) ON DELETE CASCADE,
      pick_json JSONB NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS zamora_result (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      pick_json JSONB NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mvp_picks (
      email TEXT PRIMARY KEY REFERENCES users(email) ON DELETE CASCADE,
      pick_json JSONB NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mvp_result (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      pick_json JSONB NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Migration: existing DBs may not have the paid column.
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT FALSE");
  await pool.query("ALTER TABLE predictions ADD COLUMN IF NOT EXISTS winner TEXT");

  return {
    db: pool,
    persist: async () => {},
    dbPath: "DATABASE_URL",
    mode: "postgres",
  };
}

export async function dbGet(db, sql, params = []) {
  if (db?.__dbKind === "pg") {
    const { text } = toPgParams(sql);
    const res = await db.query(text, params);
    return res.rows[0] ?? null;
  }
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    if (!stmt.step()) return null;
    return stmt.getAsObject();
  } finally {
    stmt.free();
  }
}

export async function dbAll(db, sql, params = []) {
  if (db?.__dbKind === "pg") {
    const { text } = toPgParams(sql);
    const res = await db.query(text, params);
    return res.rows ?? [];
  }
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const out = [];
    while (stmt.step()) out.push(stmt.getAsObject());
    return out;
  } finally {
    stmt.free();
  }
}

export async function dbRun(db, sql, params = []) {
  if (db?.__dbKind === "pg") {
    const { text } = toPgParams(sql);
    await db.query(text, params);
    return;
  }
  const stmt = db.prepare(sql);
  try {
    stmt.run(params);
  } finally {
    stmt.free();
  }
}

let persistTimer = null;
export function persistDb(db) {
  if (db?.__dbKind === "pg") return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const data = db.export();
    ensureDir(path.dirname(DB_PATH));
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    persistTimer = null;
  }, 50);
}

export function persistDbNow(db) {
  if (db?.__dbKind === "pg") return;
  const data = db.export();
  ensureDir(path.dirname(DB_PATH));
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
}
