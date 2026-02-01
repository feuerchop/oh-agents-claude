/**
 * Simple SPA router using History API.
 */
const Router = (() => {
  const routes = [];

  function add(path, handler, opts = {}) {
    const pattern = path.replace(/:(\w+)/g, "(?<$1>[^/]+)");
    routes.push({ regex: new RegExp(`^${pattern}$`), handler, opts });
  }

  function navigate(path, replace = false) {
    if (replace) {
      history.replaceState(null, "", path);
    } else {
      history.pushState(null, "", path);
    }
    resolve();
  }

  function resolve() {
    const path = location.pathname;

    for (const route of routes) {
      const match = path.match(route.regex);
      if (match) {
        // Auth guard
        if (route.opts.auth && !API.isLoggedIn()) {
          return navigate("/login", true);
        }
        if (route.opts.guest && API.isLoggedIn()) {
          return navigate("/dashboard", true);
        }
        if (route.opts.admin && !API.isAdmin()) {
          return navigate("/dashboard", true);
        }
        route.handler(match.groups || {});
        return;
      }
    }

    // 404 fallback
    document.getElementById("pageContent").innerHTML = `
      <div class="page-center">
        <h1>404</h1>
        <p>Page not found.</p>
        <a href="/" data-link class="btn btn-primary">Go Home</a>
      </div>
    `;
  }

  // Intercept link clicks
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-link]");
    if (a) {
      e.preventDefault();
      navigate(a.getAttribute("href"));
    }
  });

  window.addEventListener("popstate", resolve);

  return { add, navigate, resolve };
})();
