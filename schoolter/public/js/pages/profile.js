/**
 * Profile & Settings page — edit name, change password, view audit log.
 */
const ProfilePage = (() => {
  function render() {
    const user = API.getUser();
    const el = document.getElementById("pageContent");
    el.innerHTML = `
      <div class="page-container">
        <div class="page-header">
          <h1>Profile &amp; Settings</h1>
          <p class="text-muted">Manage your account</p>
        </div>

        <div class="settings-grid">
          <!-- Profile -->
          <div class="card">
            <h3>Profile</h3>
            <form id="profileForm" class="settings-form">
              <div class="form-group">
                <label for="profileName">Full name</label>
                <input type="text" id="profileName" value="${esc(user?.name || "")}">
              </div>
              <div class="form-group">
                <label for="profileEmail">Email</label>
                <input type="email" id="profileEmail" value="${esc(user?.email || "")}" disabled>
                <small class="text-muted">Contact support to change email</small>
              </div>
              <div id="profileMsg" class="form-success hidden"></div>
              <div id="profileErr" class="form-error hidden"></div>
              <button type="submit" class="btn btn-primary">Save Changes</button>
            </form>
          </div>

          <!-- Change password -->
          <div class="card">
            <h3>Change Password</h3>
            <form id="passwordForm" class="settings-form">
              <div class="form-group">
                <label for="currentPw">Current password</label>
                <input type="password" id="currentPw" required autocomplete="current-password">
              </div>
              <div class="form-group">
                <label for="newPw">New password</label>
                <input type="password" id="newPw" required minlength="8" autocomplete="new-password" placeholder="Min 8 characters">
              </div>
              <div class="form-group">
                <label for="confirmPw">Confirm new password</label>
                <input type="password" id="confirmPw" required minlength="8" autocomplete="new-password">
              </div>
              <div id="pwMsg" class="form-success hidden"></div>
              <div id="pwErr" class="form-error hidden"></div>
              <button type="submit" class="btn btn-primary">Change Password</button>
            </form>
          </div>

          <!-- Account info -->
          <div class="card">
            <h3>Account Info</h3>
            <div class="info-rows">
              <div class="info-row"><span class="info-label">User ID</span><span class="info-value">${esc(user?.id || "")}</span></div>
              <div class="info-row"><span class="info-label">Role</span><span class="info-value">${capitalize(user?.role || "user")}</span></div>
              <div class="info-row"><span class="info-label">Plan</span><span class="info-value plan-badge plan-badge-${user?.plan || "free"}">${capitalize(user?.plan || "free")}</span></div>
              <div class="info-row"><span class="info-label">Member since</span><span class="info-value">${user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</span></div>
            </div>
          </div>

          <!-- Recent activity -->
          <div class="card">
            <h3>Recent Activity</h3>
            <div id="auditLog"><p class="text-muted">Loading...</p></div>
          </div>
        </div>
      </div>
    `;

    // Profile form
    el.querySelector("#profileForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      hide("profileMsg"); hide("profileErr");
      try {
        const data = await API.patch("/users/me/profile", { name: document.getElementById("profileName").value });
        API.setUser(data.user);
        show("profileMsg", "Profile updated.");
        document.getElementById("navUserName").textContent = data.user.name;
      } catch (err) { show("profileErr", err.message); }
    });

    // Password form
    el.querySelector("#passwordForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      hide("pwMsg"); hide("pwErr");
      const newPw = document.getElementById("newPw").value;
      if (newPw !== document.getElementById("confirmPw").value) {
        return show("pwErr", "Passwords do not match");
      }
      try {
        await API.post("/auth/change-password", {
          currentPassword: document.getElementById("currentPw").value,
          newPassword: newPw,
        });
        show("pwMsg", "Password changed.");
        el.querySelector("#passwordForm").reset();
      } catch (err) { show("pwErr", err.message); }
    });

    loadAudit();
  }

  async function loadAudit() {
    const el = document.getElementById("auditLog");
    try {
      const data = await API.get("/users/me/audit");
      if (!data.entries || data.entries.length === 0) {
        el.innerHTML = '<p class="text-muted">No activity yet.</p>';
        return;
      }
      el.innerHTML = `<table class="audit-table"><thead><tr><th>Action</th><th>IP</th><th>Date</th></tr></thead><tbody>${
        data.entries.slice(0, 20).map(e => `<tr><td>${esc(e.action)}</td><td>${esc(e.ip_address || "—")}</td><td>${new Date(e.created_at).toLocaleString()}</td></tr>`).join("")
      }</tbody></table>`;
    } catch {
      el.innerHTML = '<p class="text-muted">Could not load activity.</p>';
    }
  }

  function show(id, msg) { const e = document.getElementById(id); e.textContent = msg; e.classList.remove("hidden"); }
  function hide(id) { document.getElementById(id)?.classList.add("hidden"); }
  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }
  function esc(s) { const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }

  return { render };
})();
