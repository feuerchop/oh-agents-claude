/**
 * Schoolter SaaS — main app bootstrapper.
 * Registers routes, manages nav state, handles modal.
 */
(function () {
  "use strict";

  // ── Routes ───────────────────────────────────────────────
  Router.add("/", () => {
    if (API.isLoggedIn()) Router.navigate("/dashboard", true);
    else Router.navigate("/schools", true);
  });

  Router.add("/login", AuthPages.loginPage, { guest: true });
  Router.add("/register", AuthPages.registerPage, { guest: true });
  Router.add("/forgot-password", AuthPages.forgotPasswordPage, { guest: true });
  Router.add("/reset-password", AuthPages.resetPasswordPage, { guest: true });

  Router.add("/dashboard", DashboardPage.render, { auth: true });
  Router.add("/schools", SchoolsPage.render);
  Router.add("/billing", BillingPage.render, { auth: true });
  Router.add("/profile", ProfilePage.render, { auth: true });
  Router.add("/admin", AdminPage.render, { auth: true, admin: true });

  // ── Nav state ────────────────────────────────────────────
  function updateNav() {
    const nav = document.getElementById("topNav");
    const adminLink = document.getElementById("adminLink");

    nav.classList.remove("hidden");
    if (API.isLoggedIn()) {
      const user = API.getUser();
      document.getElementById("navUserName").textContent = user?.name || user?.email || "Account";
      document.getElementById("navUserMenu").classList.remove("hidden");
      if (API.isAdmin()) adminLink.classList.remove("hidden");
      else adminLink.classList.add("hidden");
    } else {
      document.getElementById("navUserMenu").classList.add("hidden");
    }
  }

  // ── User dropdown ────────────────────────────────────────
  document.getElementById("userMenuBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("userDropdown").classList.toggle("hidden");
  });

  document.addEventListener("click", () => {
    document.getElementById("userDropdown").classList.add("hidden");
  });

  document.getElementById("logoutBtn").addEventListener("click", async (e) => {
    e.preventDefault();
    await API.logout();
    Router.navigate("/login");
  });

  // ── Modal ────────────────────────────────────────────────
  document.querySelector(".modal-overlay").addEventListener("click", closeModal);
  document.querySelector(".modal-close").addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  function closeModal() {
    const m = document.getElementById("schoolModal");
    m.classList.remove("open");
    m.setAttribute("aria-hidden", "true");
  }

  // ── Boot ─────────────────────────────────────────────────
  // Refresh user data if logged in
  if (API.isLoggedIn()) {
    API.fetchMe().catch(() => {
      API.clearToken();
      Router.navigate("/login", true);
    });
  }

  // Observe route changes to update nav
  const origResolve = Router.resolve;
  Router.resolve = function () {
    origResolve.call(Router);
    updateNav();
  };

  updateNav();
  Router.resolve();
})();
