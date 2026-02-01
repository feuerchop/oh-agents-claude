/**
 * Schoolter SaaS — Express server entry point.
 */
require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { helmetMiddleware, globalLimiter, apiLimiter } = require("./middleware/security");

// Ensure DB exists
const dbPath = path.join(__dirname, "db", "schoolter.db");
const fs = require("fs");
if (!fs.existsSync(dbPath)) {
  console.log("Initializing database...");
  require("child_process").execSync("node " + path.join(__dirname, "db", "init.js"), { stdio: "inherit" });
}

const app = express();
const PORT = process.env.PORT || 3000;

// ── Global middleware ──────────────────────────────────────
app.use(helmetMiddleware);
app.use(globalLimiter);
app.use(cors({ origin: process.env.APP_URL || true, credentials: true }));
app.use(cookieParser());

// Parse JSON for all routes EXCEPT Stripe webhook (needs raw body)
app.use((req, res, next) => {
  if (req.originalUrl === "/api/billing/webhook") return next();
  express.json({ limit: "1mb" })(req, res, next);
});

// ── API routes ─────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", apiLimiter, require("./routes/users"));
app.use("/api/billing", require("./routes/billing"));

// ── Static files ───────────────────────────────────────────
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

// SPA fallback — serve index.html for all non-API routes
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.sendFile(path.join(publicDir, "index.html"));
});

// ── Error handler ──────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err.stack || err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Schoolter running on http://localhost:${PORT}`);
});
