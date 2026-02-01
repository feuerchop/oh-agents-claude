/**
 * Billing page — plan selection, checkout, invoices.
 */
const BillingPage = (() => {
  function render() {
    const user = API.getUser();
    const plan = user?.plan || "free";
    const el = document.getElementById("pageContent");

    el.innerHTML = `
      <div class="page-container">
        <div class="page-header">
          <h1>Billing &amp; Subscription</h1>
          <p class="text-muted">Manage your plan, payment method, and invoices</p>
        </div>

        <!-- Current plan -->
        <div class="card" style="margin-bottom:24px">
          <h3>Current Plan</h3>
          <div class="current-plan-row">
            <div>
              <span class="plan-badge plan-badge-${plan}">${capitalize(plan)}</span>
              ${user?.subscriptionStatus === "active" ? `<span class="sub-status active">Active</span>` : ""}
              ${user?.subscriptionStatus === "past_due" ? `<span class="sub-status past-due">Past Due</span>` : ""}
              ${user?.subscriptionStatus === "canceled" ? `<span class="sub-status canceled">Canceled</span>` : ""}
              ${user?.subscriptionPeriodEnd ? `<p class="text-muted text-sm" style="margin-top:6px">Renews ${new Date(user.subscriptionPeriodEnd).toLocaleDateString()}</p>` : ""}
            </div>
            ${plan !== "free" ? `<button id="manageSubBtn" class="btn btn-outline">Manage Subscription</button>` : ""}
          </div>
        </div>

        <!-- Plans -->
        <div class="plans-grid">
          ${planCard("free", "Free", "$0", "forever", [
            "Browse all London schools",
            "Search &amp; filter",
            "School detail view",
            "20 searches per day",
          ], plan)}

          ${planCard("pro", "Pro", "$9.99", "/month", [
            "Everything in Free",
            "Unlimited searches",
            "Advanced analytics",
            "School comparisons",
            "Email support",
          ], plan)}

          ${planCard("enterprise", "Enterprise", "$29.99", "/month", [
            "Everything in Pro",
            "Data export (CSV/JSON)",
            "API access",
            "Priority support",
            "Custom integrations",
          ], plan)}
        </div>

        <!-- Invoices -->
        <div class="card" style="margin-top:32px">
          <h3>Invoice History</h3>
          <div id="invoiceList"><p class="text-muted">Loading...</p></div>
        </div>
      </div>
    `;

    // Manage subscription button
    const manageBtn = document.getElementById("manageSubBtn");
    if (manageBtn) {
      manageBtn.addEventListener("click", async () => {
        try {
          const data = await API.post("/billing/portal");
          if (data.url) window.location.href = data.url;
          else alert("Stripe portal not available. Configure Stripe keys to enable.");
        } catch (err) {
          alert(err.message);
        }
      });
    }

    // Checkout buttons
    el.querySelectorAll("[data-checkout]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const targetPlan = btn.dataset.checkout;
        try {
          const data = await API.post("/billing/checkout", { plan: targetPlan, interval: "monthly" });
          if (data.url) window.location.href = data.url;
          else alert("Stripe not configured. Set STRIPE_SECRET_KEY in .env to enable payments.");
        } catch (err) {
          alert(err.message);
        }
      });
    });

    loadInvoices();
  }

  function planCard(key, name, price, period, features, currentPlan) {
    const isCurrent = key === currentPlan;
    const isUpgrade = key !== "free" && (currentPlan === "free" || (key === "enterprise" && currentPlan === "pro"));
    return `
      <div class="plan-card ${isCurrent ? "plan-current" : ""}">
        <div class="plan-card-header">
          <h3>${name}</h3>
          <div class="plan-price">${price}<span class="plan-period">${period}</span></div>
        </div>
        <ul class="plan-features-list">
          ${features.map(f => `<li>${f}</li>`).join("")}
        </ul>
        <div class="plan-card-footer">
          ${isCurrent ? `<span class="btn btn-outline btn-full" style="opacity:.6;cursor:default">Current Plan</span>`
            : isUpgrade ? `<button class="btn btn-primary btn-full" data-checkout="${key}">Upgrade to ${name}</button>`
            : `<span class="btn btn-outline btn-full" style="opacity:.5;cursor:default">${key === "free" ? "Included" : "—"}</span>`}
        </div>
      </div>
    `;
  }

  async function loadInvoices() {
    const el = document.getElementById("invoiceList");
    try {
      const data = await API.get("/billing/invoices");
      if (!data.invoices || data.invoices.length === 0) {
        el.innerHTML = '<p class="text-muted">No invoices yet.</p>';
        return;
      }
      el.innerHTML = `
        <table class="invoice-table">
          <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th><th></th></tr></thead>
          <tbody>${data.invoices.map(inv => `
            <tr>
              <td>${new Date(inv.created_at).toLocaleDateString()}</td>
              <td>${inv.description || "Subscription"}</td>
              <td>${(inv.amount_cents / 100).toFixed(2)} ${(inv.currency || "GBP").toUpperCase()}</td>
              <td><span class="sub-status ${inv.status}">${capitalize(inv.status)}</span></td>
              <td>${inv.pdf_url ? `<a href="${inv.pdf_url}" target="_blank" class="btn-link">PDF</a>` : ""}</td>
            </tr>`).join("")}</tbody>
        </table>`;
    } catch {
      el.innerHTML = '<p class="text-muted">No invoices yet.</p>';
    }
  }

  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

  return { render };
})();
