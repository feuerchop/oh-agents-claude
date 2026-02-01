/**
 * Dashboard — landing page after login with quick stats and shortcuts.
 */
const DashboardPage = (() => {
  function render() {
    const user = API.getUser();
    const plan = user ? user.plan : "free";
    const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
    const totalSchools = typeof LONDON_SCHOOLS !== "undefined" ? LONDON_SCHOOLS.length : 0;
    const boroughs = typeof LONDON_SCHOOLS !== "undefined" ? new Set(LONDON_SCHOOLS.map(s => s.borough)).size : 0;

    const el = document.getElementById("pageContent");
    el.innerHTML = `
      <div class="page-container">
        <div class="page-header">
          <h1>Welcome back, ${esc(user?.name || "User")}</h1>
          <p class="text-muted">Your Schoolter dashboard</p>
        </div>

        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-card-value">${totalSchools}</div>
            <div class="stat-card-label">Schools in database</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-value">${boroughs}</div>
            <div class="stat-card-label">London boroughs</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-value">${planLabel}</div>
            <div class="stat-card-label">Current plan</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-value">${user?.subscriptionStatus === "active" ? "Active" : "—"}</div>
            <div class="stat-card-label">Subscription</div>
          </div>
        </div>

        <div class="dashboard-grid">
          <div class="card">
            <h3>Quick Actions</h3>
            <div class="quick-actions">
              <a href="/schools" data-link class="btn btn-primary">Browse Schools</a>
              <a href="/billing" data-link class="btn btn-outline">Manage Subscription</a>
              <a href="/profile" data-link class="btn btn-outline">Edit Profile</a>
            </div>
          </div>

          <div class="card">
            <h3>Plan Features</h3>
            <div class="plan-features">
              <div class="feature-row">
                <span>Search &amp; browse schools</span>
                <span class="check">&#10003;</span>
              </div>
              <div class="feature-row">
                <span>School detail view</span>
                <span class="check">&#10003;</span>
              </div>
              <div class="feature-row">
                <span>Unlimited comparisons</span>
                <span class="${plan === "free" ? "cross" : "check"}">${plan === "free" ? "&#10007;" : "&#10003;"}</span>
              </div>
              <div class="feature-row">
                <span>Advanced analytics</span>
                <span class="${plan === "free" ? "cross" : "check"}">${plan === "free" ? "&#10007;" : "&#10003;"}</span>
              </div>
              <div class="feature-row">
                <span>Data export</span>
                <span class="${plan === "enterprise" ? "check" : "cross"}">${plan === "enterprise" ? "&#10003;" : "&#10007;"}</span>
              </div>
              <div class="feature-row">
                <span>Priority support</span>
                <span class="${plan === "enterprise" ? "check" : "cross"}">${plan === "enterprise" ? "&#10003;" : "&#10007;"}</span>
              </div>
            </div>
            ${plan === "free" ? '<a href="/billing" data-link class="btn btn-primary btn-full" style="margin-top:16px">Upgrade Plan</a>' : ""}
          </div>
        </div>
      </div>
    `;
  }

  function esc(str) {
    const d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
  }

  return { render };
})();
