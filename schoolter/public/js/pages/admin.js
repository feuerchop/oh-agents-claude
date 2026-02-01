/**
 * Admin panel — user management, stats, audit log.
 */
const AdminPage = (() => {
  let currentPage = 1;
  let searchQuery = "";

  function render() {
    const el = document.getElementById("pageContent");
    el.innerHTML = `
      <div class="page-container">
        <div class="page-header">
          <h1>Admin Panel</h1>
          <p class="text-muted">Manage users, view stats, and monitor activity</p>
        </div>

        <!-- Admin stats -->
        <div id="adminStats" class="stats-row" style="margin-bottom:24px">
          <div class="stat-card"><div class="stat-card-value">—</div><div class="stat-card-label">Total Users</div></div>
        </div>

        <!-- Tabs -->
        <nav class="tabs admin-tabs" role="tablist">
          <button class="tab active" data-atab="users" role="tab">Users</button>
          <button class="tab" data-atab="audit" role="tab">Audit Log</button>
        </nav>

        <div id="adminPanel-users" class="tab-panel active">
          <div class="admin-toolbar">
            <input type="text" id="adminUserSearch" placeholder="Search users by email or name..." class="admin-search-input">
          </div>
          <div id="userTable"><p class="text-muted">Loading...</p></div>
          <div id="userPagination" class="pagination" style="margin-top:16px"></div>
        </div>

        <div id="adminPanel-audit" class="tab-panel">
          <div id="adminAuditLog"><p class="text-muted">Loading...</p></div>
        </div>
      </div>
    `;

    // Tab switching
    el.querySelectorAll(".admin-tabs .tab").forEach(tab => {
      tab.addEventListener("click", () => {
        el.querySelectorAll(".admin-tabs .tab").forEach(t => t.classList.remove("active"));
        el.querySelectorAll("#adminPanel-users, #adminPanel-audit").forEach(p => p.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById(`adminPanel-${tab.dataset.atab}`).classList.add("active");
        if (tab.dataset.atab === "audit") loadAuditLog();
      });
    });

    // Search
    let searchTimer;
    document.getElementById("adminUserSearch").addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { searchQuery = e.target.value; currentPage = 1; loadUsers(); }, 300);
    });

    loadStats();
    loadUsers();
  }

  async function loadStats() {
    try {
      const data = await API.get("/users/admin/stats");
      document.getElementById("adminStats").innerHTML = `
        <div class="stat-card"><div class="stat-card-value">${data.totalUsers}</div><div class="stat-card-label">Total Users</div></div>
        <div class="stat-card"><div class="stat-card-value">${data.freeUsers}</div><div class="stat-card-label">Free</div></div>
        <div class="stat-card"><div class="stat-card-value">${data.proUsers}</div><div class="stat-card-label">Pro</div></div>
        <div class="stat-card"><div class="stat-card-value">${data.enterpriseUsers}</div><div class="stat-card-label">Enterprise</div></div>
        <div class="stat-card"><div class="stat-card-value">${data.recentSignups}</div><div class="stat-card-label">Signups (7d)</div></div>
        <div class="stat-card"><div class="stat-card-value">${data.activeSubscriptions}</div><div class="stat-card-label">Active Subs</div></div>
      `;
    } catch {}
  }

  async function loadUsers() {
    const el = document.getElementById("userTable");
    try {
      const params = new URLSearchParams({ page: currentPage, limit: 15 });
      if (searchQuery) params.set("search", searchQuery);
      const data = await API.get(`/users?${params}`);
      if (!data.users.length) { el.innerHTML = '<p class="text-muted">No users found.</p>'; return; }

      el.innerHTML = `
        <table class="admin-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Plan</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>${data.users.map(u => `
            <tr data-uid="${u.id}">
              <td>${esc(u.name)}</td>
              <td>${esc(u.email)}</td>
              <td>
                <select class="role-select inline-select" data-field="role" data-uid="${u.id}">
                  <option value="user" ${u.role==="user"?"selected":""}>User</option>
                  <option value="admin" ${u.role==="admin"?"selected":""}>Admin</option>
                </select>
              </td>
              <td>
                <select class="plan-select inline-select" data-field="plan" data-uid="${u.id}">
                  <option value="free" ${u.plan==="free"?"selected":""}>Free</option>
                  <option value="pro" ${u.plan==="pro"?"selected":""}>Pro</option>
                  <option value="enterprise" ${u.plan==="enterprise"?"selected":""}>Enterprise</option>
                </select>
              </td>
              <td>${new Date(u.createdAt).toLocaleDateString()}</td>
              <td><button class="btn btn-sm btn-danger delete-user-btn" data-uid="${u.id}">Delete</button></td>
            </tr>`).join("")}</tbody>
        </table>`;

      // Inline edits
      el.querySelectorAll(".inline-select").forEach(sel => {
        sel.addEventListener("change", async () => {
          try {
            await API.patch(`/users/${sel.dataset.uid}`, { [sel.dataset.field]: sel.value });
          } catch (err) { alert(err.message); loadUsers(); }
        });
      });

      // Delete buttons
      el.querySelectorAll(".delete-user-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          if (!confirm("Delete this user permanently?")) return;
          try { await API.del(`/users/${btn.dataset.uid}`); loadUsers(); loadStats(); }
          catch (err) { alert(err.message); }
        });
      });

      // Pagination
      const pg = data.pagination;
      const pgEl = document.getElementById("userPagination");
      if (pg.totalPages <= 1) { pgEl.innerHTML = ""; return; }
      pgEl.innerHTML = `
        <button ${pg.page <= 1 ? "disabled" : ""} data-p="${pg.page-1}">&laquo;</button>
        <span class="text-muted" style="padding:8px">Page ${pg.page} of ${pg.totalPages}</span>
        <button ${pg.page >= pg.totalPages ? "disabled" : ""} data-p="${pg.page+1}">&raquo;</button>
      `;
      pgEl.querySelectorAll("button[data-p]").forEach(b => b.addEventListener("click", () => { currentPage = Number(b.dataset.p); loadUsers(); }));
    } catch (err) {
      el.innerHTML = `<p class="form-error">${esc(err.message)}</p>`;
    }
  }

  async function loadAuditLog() {
    const el = document.getElementById("adminAuditLog");
    try {
      const data = await API.get("/users/admin/audit?limit=100");
      if (!data.entries.length) { el.innerHTML = '<p class="text-muted">No audit entries.</p>'; return; }
      el.innerHTML = `
        <table class="audit-table">
          <thead><tr><th>User</th><th>Action</th><th>Detail</th><th>IP</th><th>Date</th></tr></thead>
          <tbody>${data.entries.map(e => `
            <tr>
              <td>${esc(e.email || "—")}</td>
              <td>${esc(e.action)}</td>
              <td class="audit-detail">${esc(e.detail || "")}</td>
              <td>${esc(e.ip_address || "—")}</td>
              <td>${new Date(e.created_at).toLocaleString()}</td>
            </tr>`).join("")}</tbody>
        </table>`;
    } catch { el.innerHTML = '<p class="text-muted">Could not load audit log.</p>'; }
  }

  function esc(s) { const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }

  return { render };
})();
