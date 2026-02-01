const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuid } = require("uuid");
const crypto = require("crypto");
const db = require("../db/connection");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// ── Helpers ────────────────────────────────────────────────
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// ── Register ───────────────────────────────────────────────
function register({ email, password, name }) {
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    throw Object.assign(new Error("Email already registered"), { status: 409 });
  }
  const id = uuid();
  const passwordHash = bcrypt.hashSync(password, 12);
  db.prepare(`
    INSERT INTO users (id, email, password_hash, name)
    VALUES (?, ?, ?, ?)
  `).run(id, email, passwordHash, name || "");

  const token = signToken(id);
  return { token, user: getPublicUser(id) };
}

// ── Login ──────────────────────────────────────────────────
function login({ email, password }) {
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw Object.assign(new Error("Invalid email or password"), { status: 401 });
  }
  const token = signToken(user.id);
  return { token, user: sanitizeUser(user) };
}

// ── Password reset request ─────────────────────────────────
function requestPasswordReset(email) {
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (!user) return; // silent — don't reveal whether email exists

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hr

  db.prepare(`
    INSERT INTO password_resets (id, user_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(uuid(), user.id, tokenHash, expiresAt);

  // In production, send email with rawToken. For dev, log it.
  console.log(`[DEV] Password reset token for ${email}: ${rawToken}`);
  return rawToken;
}

// ── Password reset confirm ─────────────────────────────────
function resetPassword({ token, newPassword }) {
  const tokenHash = hashToken(token);
  const row = db.prepare(`
    SELECT * FROM password_resets
    WHERE token_hash = ? AND used = 0 AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `).get(tokenHash);

  if (!row) {
    throw Object.assign(new Error("Invalid or expired reset token"), { status: 400 });
  }

  const passwordHash = bcrypt.hashSync(newPassword, 12);
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
    .run(passwordHash, row.user_id);
  db.prepare("UPDATE password_resets SET used = 1 WHERE id = ?").run(row.id);
}

// ── Session management ─────────────────────────────────────
function createSession(userId, ip, userAgent) {
  const id = uuid();
  const rawToken = crypto.randomBytes(48).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString(); // 30d
  db.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, ip_address, user_agent, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, tokenHash, ip, userAgent, expiresAt);
  return rawToken;
}

function validateSession(rawToken) {
  const tokenHash = hashToken(rawToken);
  return db.prepare(`
    SELECT s.*, u.email, u.role, u.plan FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > datetime('now')
  `).get(tokenHash);
}

function revokeSession(rawToken) {
  const tokenHash = hashToken(rawToken);
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

function revokeAllSessions(userId) {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

// ── Helpers ────────────────────────────────────────────────
function getPublicUser(id) {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  return user ? sanitizeUser(user) : null;
}

function sanitizeUser(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    plan: u.plan,
    subscriptionStatus: u.subscription_status,
    subscriptionPeriodEnd: u.subscription_period_end,
    avatarUrl: u.avatar_url,
    createdAt: u.created_at,
  };
}

// ── Audit ──────────────────────────────────────────────────
function logAudit(userId, action, detail, ip) {
  db.prepare(`
    INSERT INTO audit_log (user_id, action, detail, ip_address)
    VALUES (?, ?, ?, ?)
  `).run(userId, action, detail || null, ip || null);
}

module.exports = {
  signToken,
  verifyToken,
  register,
  login,
  requestPasswordReset,
  resetPassword,
  createSession,
  validateSession,
  revokeSession,
  revokeAllSessions,
  getPublicUser,
  sanitizeUser,
  logAudit,
};
