/**
 * Auth pages: Login, Register, Forgot Password, Reset Password.
 */
const AuthPages = (() => {
  function loginPage() {
    const el = document.getElementById("pageContent");
    el.innerHTML = `
      <div class="auth-page">
        <div class="auth-card">
          <h1 class="auth-title">Sign in to Schoolter</h1>
          <p class="auth-subtitle">London Schools Explorer</p>
          <form id="loginForm" class="auth-form">
            <div class="form-group">
              <label for="loginEmail">Email</label>
              <input type="email" id="loginEmail" required autocomplete="email" placeholder="you@example.com">
            </div>
            <div class="form-group">
              <label for="loginPassword">Password</label>
              <input type="password" id="loginPassword" required autocomplete="current-password" minlength="8" placeholder="Min 8 characters">
            </div>
            <div id="loginError" class="form-error hidden"></div>
            <button type="submit" class="btn btn-primary btn-full">Sign In</button>
          </form>
          <div class="auth-links">
            <a href="/forgot-password" data-link>Forgot password?</a>
            <span>Don't have an account? <a href="/register" data-link>Sign up</a></span>
          </div>
        </div>
      </div>
    `;
    el.querySelector("#loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = el.querySelector("#loginError");
      errEl.classList.add("hidden");
      try {
        await API.login(
          el.querySelector("#loginEmail").value,
          el.querySelector("#loginPassword").value
        );
        Router.navigate("/dashboard");
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove("hidden");
      }
    });
  }

  function registerPage() {
    const el = document.getElementById("pageContent");
    el.innerHTML = `
      <div class="auth-page">
        <div class="auth-card">
          <h1 class="auth-title">Create your account</h1>
          <p class="auth-subtitle">Start exploring London schools for free</p>
          <form id="registerForm" class="auth-form">
            <div class="form-group">
              <label for="regName">Full name</label>
              <input type="text" id="regName" required placeholder="Jane Smith">
            </div>
            <div class="form-group">
              <label for="regEmail">Email</label>
              <input type="email" id="regEmail" required autocomplete="email" placeholder="you@example.com">
            </div>
            <div class="form-group">
              <label for="regPassword">Password</label>
              <input type="password" id="regPassword" required autocomplete="new-password" minlength="8" placeholder="Min 8 characters">
            </div>
            <div id="regError" class="form-error hidden"></div>
            <button type="submit" class="btn btn-primary btn-full">Create Account</button>
          </form>
          <div class="auth-links">
            <span>Already have an account? <a href="/login" data-link>Sign in</a></span>
          </div>
        </div>
      </div>
    `;
    el.querySelector("#registerForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = el.querySelector("#regError");
      errEl.classList.add("hidden");
      try {
        await API.register(
          el.querySelector("#regEmail").value,
          el.querySelector("#regPassword").value,
          el.querySelector("#regName").value
        );
        Router.navigate("/dashboard");
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove("hidden");
      }
    });
  }

  function forgotPasswordPage() {
    const el = document.getElementById("pageContent");
    el.innerHTML = `
      <div class="auth-page">
        <div class="auth-card">
          <h1 class="auth-title">Reset your password</h1>
          <p class="auth-subtitle">We'll send you a reset link</p>
          <form id="forgotForm" class="auth-form">
            <div class="form-group">
              <label for="forgotEmail">Email</label>
              <input type="email" id="forgotEmail" required placeholder="you@example.com">
            </div>
            <div id="forgotMsg" class="form-success hidden"></div>
            <div id="forgotError" class="form-error hidden"></div>
            <button type="submit" class="btn btn-primary btn-full">Send Reset Link</button>
          </form>
          <div class="auth-links">
            <a href="/login" data-link>&larr; Back to sign in</a>
          </div>
        </div>
      </div>
    `;
    el.querySelector("#forgotForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const data = await API.post("/auth/forgot-password", { email: el.querySelector("#forgotEmail").value });
        const msgEl = el.querySelector("#forgotMsg");
        msgEl.textContent = data.message || "Check your email for a reset link.";
        msgEl.classList.remove("hidden");
        if (data.devToken) {
          msgEl.innerHTML += `<br><small>Dev token: <code>${data.devToken}</code></small>`;
        }
      } catch (err) {
        const errEl = el.querySelector("#forgotError");
        errEl.textContent = err.message;
        errEl.classList.remove("hidden");
      }
    });
  }

  function resetPasswordPage() {
    const params = new URLSearchParams(location.search);
    const token = params.get("token") || "";
    const el = document.getElementById("pageContent");
    el.innerHTML = `
      <div class="auth-page">
        <div class="auth-card">
          <h1 class="auth-title">Set new password</h1>
          <form id="resetForm" class="auth-form">
            <div class="form-group">
              <label for="resetToken">Reset token</label>
              <input type="text" id="resetToken" required value="${token}" placeholder="Paste your reset token">
            </div>
            <div class="form-group">
              <label for="resetPassword">New password</label>
              <input type="password" id="resetPassword" required minlength="8" placeholder="Min 8 characters">
            </div>
            <div id="resetMsg" class="form-success hidden"></div>
            <div id="resetError" class="form-error hidden"></div>
            <button type="submit" class="btn btn-primary btn-full">Reset Password</button>
          </form>
          <div class="auth-links">
            <a href="/login" data-link>&larr; Back to sign in</a>
          </div>
        </div>
      </div>
    `;
    el.querySelector("#resetForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await API.post("/auth/reset-password", {
          token: el.querySelector("#resetToken").value,
          newPassword: el.querySelector("#resetPassword").value,
        });
        const msgEl = el.querySelector("#resetMsg");
        msgEl.textContent = "Password reset! You can now sign in.";
        msgEl.classList.remove("hidden");
      } catch (err) {
        const errEl = el.querySelector("#resetError");
        errEl.textContent = err.message;
        errEl.classList.remove("hidden");
      }
    });
  }

  return { loginPage, registerPage, forgotPasswordPage, resetPasswordPage };
})();
