const express = require("express");
const router = express.Router();
const db = require("../db/connection");
const { requireAuth, requireRole, sanitize, validateEmail } = require("../middleware/security");
const { sanitizeUser, logAudit } = require("../services/auth");

// GET /api/users — admin list all users
router.get("/", requireAuth, requireRole("admin"), (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${sanitize(req.query.search)}%` : null;

  let rows, total;
  if (search) {
    rows = db.prepare("SELECT * FROM users WHERE email LIKE ? OR name LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?")
      .all(search, search, limit, offset);
    total = db.prepare("SELECT COUNT(*) as c FROM users WHERE email LIKE ? OR name LIKE ?").get(search, search).c;
  } else {
    rows = db.prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?").all(limit, offset);
    total = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  }

  res.json({
    users: rows.map(sanitizeUser),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// GET /api/users/:id — admin get single user
router.get("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: sanitizeUser(user) });
});

// PATCH /api/users/:id — admin update user
router.patch("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const updates = {};
  if (req.body.name !== undefined) updates.name = sanitize(req.body.name);
  if (req.body.role && ["user", "admin"].includes(req.body.role)) updates.role = req.body.role;
  if (req.body.plan && ["free", "pro", "enterprise"].includes(req.body.plan)) updates.plan = req.body.plan;
  if (req.body.email && validateEmail(req.body.email)) updates.email = req.body.email;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  const sets = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
  const values = Object.values(updates);
  db.prepare(`UPDATE users SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...values, req.params.id);

  logAudit(req.user.id, "admin_update_user", JSON.stringify({ targetUser: req.params.id, updates }), req.ip);

  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  res.json({ user: sanitizeUser(updated) });
});

// DELETE /api/users/:id — admin delete user
router.delete("/:id", requireAuth, requireRole("admin"), (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: "Cannot delete your own account" });
  }
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
  logAudit(req.user.id, "admin_delete_user", JSON.stringify({ targetUser: req.params.id }), req.ip);
  res.json({ ok: true });
});

// PATCH /api/users/me/profile — user updates own profile
router.patch("/me/profile", requireAuth, (req, res) => {
  const updates = {};
  if (req.body.name !== undefined) updates.name = sanitize(req.body.name);
  if (req.body.avatarUrl !== undefined) updates.avatar_url = sanitize(req.body.avatarUrl);

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  const sets = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
  const values = Object.values(updates);
  db.prepare(`UPDATE users SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...values, req.user.id);

  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  res.json({ user: sanitizeUser(updated) });
});

// GET /api/users/me/audit — user's own audit log
router.get("/me/audit", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM audit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").all(req.user.id);
  res.json({ entries: rows });
});

// GET /api/admin/audit — admin full audit log
router.get("/admin/audit", requireAuth, requireRole("admin"), (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit) || 50);
  const rows = db.prepare("SELECT a.*, u.email FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT ?").all(limit);
  res.json({ entries: rows });
});

// GET /api/admin/stats — admin dashboard stats
router.get("/admin/stats", requireAuth, requireRole("admin"), (req, res) => {
  const totalUsers = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  const proUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE plan = 'pro'").get().c;
  const enterpriseUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE plan = 'enterprise'").get().c;
  const recentSignups = db.prepare("SELECT COUNT(*) as c FROM users WHERE created_at > datetime('now', '-7 days')").get().c;
  const activeSubscriptions = db.prepare("SELECT COUNT(*) as c FROM users WHERE subscription_status = 'active'").get().c;

  res.json({
    totalUsers,
    proUsers,
    enterpriseUsers,
    freeUsers: totalUsers - proUsers - enterpriseUsers,
    recentSignups,
    activeSubscriptions,
  });
});

module.exports = router;
