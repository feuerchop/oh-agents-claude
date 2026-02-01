/**
 * Stripe payment service — subscriptions, checkout, portal, webhooks.
 */
const db = require("../db/connection");
const { v4: uuid } = require("uuid");

// Stripe is initialised lazily so the app still boots when keys are absent.
let _stripe = null;
function getStripe() {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || key.startsWith("sk_test_...")) return null;
    _stripe = require("stripe")(key);
  }
  return _stripe;
}

// ── Plans ──────────────────────────────────────────────────
const PLANS = {
  free:       { name: "Free",       monthlyPrice: 0,    searchLimit: 20,  compareLimit: 2,  analytics: false },
  pro:        { name: "Pro",        monthlyPrice: 9.99,  searchLimit: -1,  compareLimit: -1, analytics: true  },
  enterprise: { name: "Enterprise", monthlyPrice: 29.99, searchLimit: -1,  compareLimit: -1, analytics: true  },
};

function getPlanDetails(plan) {
  return PLANS[plan] || PLANS.free;
}

function listPlans() {
  return Object.entries(PLANS).map(([key, v]) => ({ id: key, ...v }));
}

// ── Create Stripe customer ─────────────────────────────────
async function ensureStripeCustomer(userId) {
  const stripe = getStripe();
  if (!stripe) throw Object.assign(new Error("Stripe not configured"), { status: 503 });

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) throw Object.assign(new Error("User not found"), { status: 404 });

  if (user.stripe_customer_id) return user.stripe_customer_id;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id },
  });

  db.prepare("UPDATE users SET stripe_customer_id = ?, updated_at = datetime('now') WHERE id = ?")
    .run(customer.id, userId);

  return customer.id;
}

// ── Create checkout session ────────────────────────────────
async function createCheckoutSession(userId, planKey, interval) {
  const stripe = getStripe();
  if (!stripe) throw Object.assign(new Error("Stripe not configured"), { status: 503 });

  const priceEnv = `STRIPE_PRICE_${planKey.toUpperCase()}_${interval.toUpperCase()}`;
  const priceId = process.env[priceEnv];
  if (!priceId) throw Object.assign(new Error(`Price not configured: ${priceEnv}`), { status: 400 });

  const customerId = await ensureStripeCustomer(userId);
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/billing`,
    metadata: { userId, plan: planKey },
  });

  return { url: session.url, sessionId: session.id };
}

// ── Customer portal ────────────────────────────────────────
async function createPortalSession(userId) {
  const stripe = getStripe();
  if (!stripe) throw Object.assign(new Error("Stripe not configured"), { status: 503 });

  const customerId = await ensureStripeCustomer(userId);
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/billing`,
  });

  return { url: session.url };
}

// ── Webhook handler ────────────────────────────────────────
function handleWebhookEvent(event) {
  switch (event.type) {
    case "checkout.session.completed":
      onCheckoutComplete(event.data.object);
      break;
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      onSubscriptionChange(event.data.object);
      break;
    case "invoice.paid":
      onInvoicePaid(event.data.object);
      break;
    case "invoice.payment_failed":
      onInvoiceFailed(event.data.object);
      break;
    default:
      break;
  }
}

function onCheckoutComplete(session) {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan;
  if (!userId || !plan) return;

  db.prepare(`
    UPDATE users SET plan = ?, stripe_subscription_id = ?, subscription_status = 'active', updated_at = datetime('now')
    WHERE id = ?
  `).run(plan, session.subscription, userId);
}

function onSubscriptionChange(sub) {
  const user = db.prepare("SELECT * FROM users WHERE stripe_subscription_id = ?").get(sub.id);
  if (!user) return;

  const status = sub.status === "active" ? "active"
    : sub.status === "past_due" ? "past_due"
    : sub.status === "trialing" ? "trialing"
    : "canceled";

  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;

  const plan = sub.status === "canceled" ? "free" : user.plan;

  db.prepare(`
    UPDATE users SET plan = ?, subscription_status = ?, subscription_period_end = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(plan, status, periodEnd, user.id);
}

function onInvoicePaid(inv) {
  const customerId = inv.customer;
  const user = db.prepare("SELECT id FROM users WHERE stripe_customer_id = ?").get(customerId);
  if (!user) return;

  db.prepare(`
    INSERT INTO invoices (id, user_id, stripe_invoice_id, amount_cents, currency, status, description, period_start, period_end, pdf_url)
    VALUES (?, ?, ?, ?, ?, 'paid', ?, ?, ?, ?)
  `).run(
    uuid(), user.id, inv.id,
    inv.amount_paid || 0, inv.currency || "gbp",
    inv.description || "Subscription",
    inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
    inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
    inv.hosted_invoice_url || null
  );
}

function onInvoiceFailed(inv) {
  const customerId = inv.customer;
  const user = db.prepare("SELECT id FROM users WHERE stripe_customer_id = ?").get(customerId);
  if (!user) return;

  db.prepare("UPDATE users SET subscription_status = 'past_due', updated_at = datetime('now') WHERE id = ?")
    .run(user.id);
}

// ── Invoice history ────────────────────────────────────────
function getInvoices(userId) {
  return db.prepare("SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").all(userId);
}

module.exports = {
  PLANS,
  getPlanDetails,
  listPlans,
  createCheckoutSession,
  createPortalSession,
  handleWebhookEvent,
  getInvoices,
  getStripe,
};
