/**
 * API client — handles auth tokens and request helpers.
 */
const API = (() => {
  const TOKEN_KEY = "schoolter_token";
  const USER_KEY = "schoolter_user";

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }

  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
  }
  function setUser(u) { localStorage.setItem(USER_KEY, JSON.stringify(u)); }

  function isLoggedIn() { return !!getToken(); }
  function isAdmin() { const u = getUser(); return u && u.role === "admin"; }

  async function request(method, path, body, opts = {}) {
    const headers = {};
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    if (body && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }

    const res = await fetch(`/api${path}`, { method, headers, body, ...opts });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401) {
        clearToken();
        if (window.Router) Router.navigate("/login");
      }
      throw Object.assign(new Error(data.error || "Request failed"), { status: res.status });
    }
    return data;
  }

  const get = (p, o) => request("GET", p, null, o);
  const post = (p, b, o) => request("POST", p, b, o);
  const patch = (p, b, o) => request("PATCH", p, b, o);
  const del = (p, o) => request("DELETE", p, null, o);

  async function login(email, password) {
    const data = await post("/auth/login", { email, password });
    setToken(data.token);
    setUser(data.user);
    return data;
  }

  async function register(email, password, name) {
    const data = await post("/auth/register", { email, password, name });
    setToken(data.token);
    setUser(data.user);
    return data;
  }

  async function logout() {
    try { await post("/auth/logout"); } catch {}
    clearToken();
  }

  async function fetchMe() {
    const data = await get("/auth/me");
    setUser(data.user);
    return data.user;
  }

  return { getToken, getUser, setUser, isLoggedIn, isAdmin, login, register, logout, fetchMe, clearToken, get, post, patch, del };
})();
