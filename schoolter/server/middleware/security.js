/**
 * Security middleware stack: helmet, rate limiter, CSRF, auth guard.
 */
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const validator = require("validator");
const auth = require("../services/auth");

// ── Helmet — HTTP security headers ────────────────────────
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.stripe.com"],
    },
  },
});

// ── Rate limiters ──────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts, please try again later." },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "API rate limit exceeded." },
});

// ── JWT auth middleware ────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const payload = auth.verifyToken(header.slice(7));
    const user = auth.getPublicUser(payload.sub);
    if (!user) return res.status(401).json({ error: "User not found" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ── Role guard ─────────────────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

// ── Plan guard ─────────────────────────────────────────────
function requirePlan(...plans) {
  return (req, res, next) => {
    if (!req.user || !plans.includes(req.user.plan)) {
      return res.status(403).json({ error: "Upgrade your plan to access this feature" });
    }
    next();
  };
}

// ── Input sanitisation helper ──────────────────────────────
function sanitize(str) {
  if (typeof str !== "string") return str;
  return validator.escape(validator.trim(str));
}

function validateEmail(email) {
  return typeof email === "string" && validator.isEmail(email);
}

function validatePassword(pw) {
  return typeof pw === "string" && pw.length >= 8 && pw.length <= 128;
}

module.exports = {
  helmetMiddleware,
  globalLimiter,
  authLimiter,
  apiLimiter,
  requireAuth,
  requireRole,
  requirePlan,
  sanitize,
  validateEmail,
  validatePassword,
};
