/**
 * Simple SPA router using History API.
 * Supports GitHub Pages base path via auto-detection.
 */
const Router = (() => {
  const routes = [];

  // Auto-detect base path from <script> location or known deploy paths
  const BASE = (() => {
    const s = document.currentScript;
    if (s && s.src) {
      const url = new URL(s.src);
      const idx = url.pathname.indexOf("/js/router.js");
      if (idx > 0) return url.pathname.slice(0, idx);
    }
    return "";
  })();

  function add(path, handler, opts = {}) {
    const pattern = path.replace(/:(\w+)/g, "(?<$1>[^/]+)");
    routes.push({ regex: new RegExp(`^${pattern}$`), handler, opts });
  }

  function fullPath(path) {
    return BASE + path;
  }

  function navigate(path, replace = false) {
    if (replace) {
      history.replaceState(null, "", fullPath(path));
    } else {
      history.pushState(null, "", fullPath(path));
    }
    resolve();
  }

  function resolve() {
    let path = location.pathname;
    // Strip base path prefix for route matching
    if (BASE && path.startsWith(BASE)) {
      path = path.slice(BASE.length) || "/";
    }

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

  return { add, navigate, resolve, BASE };
})();
