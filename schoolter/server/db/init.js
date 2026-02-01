/**
 * Database initialization — creates tables and seeds admin user.
 * Run: npm run db:init
 */
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const { v4: uuid } = require("uuid");
const path = require("path");

const DB_PATH = path.join(__dirname, "schoolter.db");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Schema ─────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name          TEXT NOT NULL DEFAULT '',
    role          TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
    plan          TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free','pro','enterprise')),
    stripe_customer_id    TEXT,
    stripe_subscription_id TEXT,
    subscription_status   TEXT DEFAULT 'none' CHECK(subscription_status IN ('none','active','past_due','canceled','trialing')),
    subscription_period_end TEXT,
    avatar_url    TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used       INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
    action     TEXT NOT NULL,
    detail     TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_invoice_id   TEXT,
    amount_cents        INTEGER NOT NULL,
    currency            TEXT NOT NULL DEFAULT 'gbp',
    status              TEXT NOT NULL DEFAULT 'pending',
    description         TEXT,
    period_start        TEXT,
    period_end          TEXT,
    pdf_url             TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
  CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
`);

// ── Seed admin ─────────────────────────────────────────────
const adminEmail = "admin@schoolter.app";
const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);

if (!existing) {
  const hash = bcrypt.hashSync("admin123!", 12);
  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, plan, subscription_status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuid(), adminEmail, hash, "Admin", "admin", "enterprise", "active");
  console.log("Seeded admin user: admin@schoolter.app / admin123!");
}

console.log("Database initialized at", DB_PATH);
db.close();
