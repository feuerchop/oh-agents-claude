const express = require("express");
const router = express.Router();
const authService = require("../services/auth");
const { authLimiter, requireAuth, sanitize, validateEmail, validatePassword } = require("../middleware/security");

// POST /api/auth/register
router.post("/register", authLimiter, (req, res) => {
  try {
    const email = sanitize(req.body.email);
    const name = sanitize(req.body.name || "");
    const password = req.body.password;

    if (!validateEmail(email)) return res.status(400).json({ error: "Invalid email address" });
    if (!validatePassword(password)) return res.status(400).json({ error: "Password must be 8-128 characters" });

    const result = authService.register({ email, password, name });
    authService.logAudit(result.user.id, "register", null, req.ip);
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post("/login", authLimiter, (req, res) => {
  try {
    const email = sanitize(req.body.email);
    const password = req.body.password;

    if (!validateEmail(email)) return res.status(400).json({ error: "Invalid email address" });
    if (!password) return res.status(400).json({ error: "Password is required" });

    const result = authService.login({ email, password });
    authService.logAudit(result.user.id, "login", null, req.ip);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post("/logout", requireAuth, (req, res) => {
  authService.logAudit(req.user.id, "logout", null, req.ip);
  res.json({ ok: true });
});

// GET /api/auth/me
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/forgot-password
router.post("/forgot-password", authLimiter, (req, res) => {
  const email = sanitize(req.body.email);
  if (!validateEmail(email)) return res.status(400).json({ error: "Invalid email" });
  const token = authService.requestPasswordReset(email);
  // In production, never return the token — send it by email.
  res.json({ message: "If that email exists, a reset link has been sent.", ...(process.env.NODE_ENV !== "production" ? { devToken: token } : {}) });
});

// POST /api/auth/reset-password
router.post("/reset-password", authLimiter, (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!validatePassword(newPassword)) return res.status(400).json({ error: "Password must be 8-128 characters" });
    authService.resetPassword({ token, newPassword });
    res.json({ message: "Password has been reset" });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/auth/change-password
router.post("/change-password", requireAuth, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!validatePassword(newPassword)) return res.status(400).json({ error: "New password must be 8-128 characters" });

    // Verify current password by attempting login
    const db = require("../db/connection");
    const bcrypt = require("bcryptjs");
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const hash = bcrypt.hashSync(newPassword, 12);
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, req.user.id);
    authService.logAudit(req.user.id, "change_password", null, req.ip);
    res.json({ message: "Password changed" });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
