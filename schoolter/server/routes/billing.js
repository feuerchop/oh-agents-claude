const express = require("express");
const router = express.Router();
const stripe = require("../services/stripe");
const { requireAuth, requireRole } = require("../middleware/security");

// GET /api/billing/plans
router.get("/plans", (req, res) => {
  res.json({ plans: stripe.listPlans() });
});

// POST /api/billing/checkout — create Stripe checkout session
router.post("/checkout", requireAuth, async (req, res) => {
  try {
    const { plan, interval } = req.body; // plan: 'pro'|'enterprise', interval: 'monthly'|'yearly'
    if (!["pro", "enterprise"].includes(plan)) return res.status(400).json({ error: "Invalid plan" });
    if (!["monthly", "yearly"].includes(interval)) return res.status(400).json({ error: "Invalid interval" });

    const session = await stripe.createCheckoutSession(req.user.id, plan, interval);
    res.json(session);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/billing/portal — create Stripe customer portal session
router.post("/portal", requireAuth, async (req, res) => {
  try {
    const session = await stripe.createPortalSession(req.user.id);
    res.json(session);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/billing/invoices
router.get("/invoices", requireAuth, (req, res) => {
  const invoices = stripe.getInvoices(req.user.id);
  res.json({ invoices });
});

// POST /api/billing/webhook — Stripe webhook (raw body required)
router.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const stripeInstance = stripe.getStripe();
  if (!stripeInstance) return res.status(503).json({ error: "Stripe not configured" });

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) return res.status(500).json({ error: "Webhook secret not configured" });

  try {
    const event = stripeInstance.webhooks.constructEvent(req.body, sig, webhookSecret);
    stripe.handleWebhookEvent(event);
    res.json({ received: true });
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    res.status(400).json({ error: "Webhook signature verification failed" });
  }
});

module.exports = router;
