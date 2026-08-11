// js/login.js
import { supabase } from "../public/shared/js/supabaseClient.js";
import { svgIcon } from "../public/shared/js/ui-icons.js";

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const signInBtn = document.getElementById("signInBtn");
const signUpBtn = document.getElementById("signUpBtn");
const resetBtn = document.getElementById("resetBtn");
const togglePwdBtn = document.getElementById("togglePwd");
const rememberMe = document.getElementById("rememberMe");
const capsHint = document.getElementById("capsHint");
const errorMsg = document.getElementById("errorMsg");

function setLoading(
  isLoading,
  { button, loadingLabel, originalLabel, extraDisable = [] } = {},
) {
  const controls = [
    emailInput,
    passwordInput,
    signInBtn,
    signUpBtn,
    resetBtn,
    ...extraDisable,
  ].filter(Boolean);
  controls.forEach((el) => (el.disabled = isLoading));
  if (button) {
    if (isLoading) {
      button.dataset.originalLabel = originalLabel ?? button.textContent;
      if (loadingLabel) button.textContent = loadingLabel;
    } else {
      button.textContent =
        originalLabel ?? button.dataset.originalLabel ?? button.textContent;
    }
  }
}

/**
 * Option A — "Status Morph": the login card stays in place.
 * The form fades out and is replaced by a step-by-step status list
 * + a bottom progress bar, all within the same white card.
 * Steps auto-advance on timers; no external HTML element needed.
 */
async function showLoadingTransition() {
  const card = document.querySelector(".login-container");
  if (!card) return;

  // Resolve the app version dynamically so it always matches package.json
  let appVersion = "";
  try {
    if (window?.electronAPI?.getAppVersion) {
      appVersion = await window.electronAPI.getAppVersion();
    }
  } catch {
    /* non-Electron context — leave blank */
  }
  const versionLabel = appVersion ? `v${appVersion}` : "";

  const steps = [
    { label: "Authenticated", delay: 0 },
    { label: "Loading profile & roles", delay: 480 },
    { label: "Syncing module permissions", delay: 960 },
    { label: "Preparing workspace", delay: 1440 },
  ];

  const brandMarkSrc =
    "public/shared/assets/branding/derived/app-mark-512.png";

  const stepItems = steps
    .map(
      (s, i) => `
    <li class="lsp-step" id="lsp-step-${i}" data-state="pending" aria-label="${s.label}">
      <span class="lsp-icon" aria-hidden="true"></span>
      <span class="lsp-label">${s.label}</span>
    </li>`,
    )
    .join("");

  card.classList.add("lsp-active");
  card.insertAdjacentHTML(
    "beforeend",
    `<div class="lsp-wrap" role="status" aria-live="polite" aria-label="Signing in">
      <div class="lsp-brand">
        <div class="lsp-brand-icon"><img src="${brandMarkSrc}" alt="" width="32" height="32" /></div>
        <div>
          <div class="lsp-brand-text">SASV Workspace</div>
          <div class="lsp-brand-sub">${versionLabel}</div>
        </div>
      </div>
      <ul class="lsp-steps">${stepItems}</ul>
      <div class="lsp-bar-track" aria-hidden="true">
        <div class="lsp-bar-fill"></div>
      </div>
    </div>`,
  );

  // Drive step state transitions via staggered timers
  steps.forEach(({ delay }, i) => {
    setTimeout(() => {
      // Mark previous step done
      if (i > 0) {
        const prev = document.getElementById(`lsp-step-${i - 1}`);
        if (prev) prev.dataset.state = "done";
      }
      // Activate current step
      const el = document.getElementById(`lsp-step-${i}`);
      if (el) el.dataset.state = "active";
      // If last step, mark it done after a brief pause
      if (i === steps.length - 1) {
        setTimeout(() => {
          if (el) el.dataset.state = "done";
        }, 380);
      }
    }, delay);
  });
}

function setEyeIcon(showing) {
  if (!togglePwdBtn) return;
  togglePwdBtn.innerHTML = svgIcon(showing ? "eye-off" : "eye", {
    size: 20,
    strokeWidth: 1.8,
  });
}

async function checkSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) window.location.href = "index.html";
}

async function signIn() {
  errorMsg.textContent = "";
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  setLoading(true, { button: signInBtn, loadingLabel: "Signing in…" });
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      errorMsg.textContent = error.message;
      return;
    }

    // Show the pharma-grade skeleton workspace immediately after auth.
    await showLoadingTransition();
    const _transitionStart = Date.now();

    // After successful sign-in, obtain the full user object and enrich
    // it with profile/roles and permissions so the main process can use
    // a compact session representation for permission checks.
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // fetch profile (may contain 'role' and full_name)
      let profile = null;
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, full_name, role")
          .eq("id", user.id)
          .maybeSingle();
        profile = prof || null;
      } catch (pfErr) {
        console.warn("Could not load profile:", pfErr);
      }

      // fetch canonical user permissions via RPC (module-level + roles)
      let permissions = [];
      const derivedRoles = profile?.role ? [profile.role] : [];
      try {
        const { data: perms, error: permsErr } = await supabase.rpc(
          "get_user_permissions",
          { p_user_id: user.id },
        );
        if (!permsErr && Array.isArray(perms)) {
          for (const p of perms) {
            if (!p || !p.target) continue;
            const t = String(p.target || "");
            if (t.startsWith("module:")) {
              if (p.can_view) permissions.push(`${t.slice(7)}:view`);
              if (p.can_edit) permissions.push(`${t.slice(7)}:edit`);
            }
            // role: entries may imply access to modules named after the role.
            if (t.startsWith("role:")) {
              const roleKey = t.slice(5);
              if (p.can_view) permissions.push(`${roleKey}:view`);
              if (p.can_edit) {
                permissions.push(`${roleKey}:edit`);
                // preserve previous marker for edit-capable roles
                permissions.push(`${roleKey}:role`);
                // grant runtime role to session so main process checks (e.g., 'admin') work
                derivedRoles.push(roleKey);
              }
            }
          }
        } else {
          // Canonical RPC unavailable — leave permissions empty (fail closed).
          console.warn(
            "Could not load permissions (RPC):",
            permsErr || "unexpected non-array result",
          );
        }
      } catch (permErr) {
        console.warn("Could not load permissions (RPC):", permErr);
      }

      const sessionUser = {
        id: user.id,
        email: user.email,
        name: profile?.full_name || user.email,
        roles: Array.from(new Set(derivedRoles)),
        permissions,
      };

      // inform main process of the session
      try {
        if (window?.auth?.setSession) await window.auth.setSession(sessionUser);
      } catch (ipcErr) {
        console.warn("Failed to set main session:", ipcErr);
      }
    } catch (uErr) {
      console.warn("Post-login user enrichment failed:", uErr);
    }
    if (rememberMe && rememberMe.checked) {
      localStorage.setItem("login_email", email);
    } else {
      localStorage.removeItem("login_email");
    }
    // Guarantee all status steps have finished animating before redirect.
    // Last step fires at 1440 ms + 380 ms done-pause = ~1820 ms total.
    const _elapsed = Date.now() - _transitionStart;
    const _remaining = Math.max(0, 1900 - _elapsed);
    if (_remaining > 0) await new Promise((r) => setTimeout(r, _remaining));

    window.location.href = "index.html";
  } finally {
    setLoading(false, { button: signInBtn });
  }
}

async function signUp() {
  errorMsg.textContent = "";
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  setLoading(true, { button: signUpBtn, loadingLabel: "Creating account…" });
  try {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      errorMsg.textContent = error.message;
      return;
    }
    await signIn();
  } finally {
    setLoading(false, { button: signUpBtn });
  }
}

async function resetPassword() {
  errorMsg.textContent = "";
  const email = emailInput.value.trim();
  if (!email) {
    errorMsg.textContent = "Please enter your email address.";
    return;
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "http://localhost:3000/reset-password.html",
  });
  if (error) errorMsg.textContent = error.message;
  else errorMsg.textContent = "Password reset link sent to your email.";
}

async function init() {
  await supabase.auth.signOut();
  await checkSession();

  try {
    const saved = localStorage.getItem("login_email");
    if (saved) {
      emailInput.value = saved;
      if (rememberMe) rememberMe.checked = true;
    }
  } catch {
    // ignore localStorage access issues
  }

  signInBtn?.addEventListener("click", signIn);
  signUpBtn?.addEventListener("click", signUp);
  resetBtn?.addEventListener("click", resetPassword);

  if (togglePwdBtn && passwordInput) {
    const toggleVisibility = () => {
      const showing = passwordInput.type === "text";
      passwordInput.type = showing ? "password" : "text";
      togglePwdBtn.setAttribute("aria-pressed", String(!showing));
      togglePwdBtn.setAttribute(
        "aria-label",
        showing ? "Show password" : "Hide password",
      );
      setEyeIcon(!showing);
      // keep focus in the password input for better UX
      passwordInput.focus();
    };
    togglePwdBtn.addEventListener("click", (e) => {
      e.preventDefault();
      toggleVisibility();
    });
    // In case another overlay eats click, capture on mousedown as well
    togglePwdBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      toggleVisibility();
    });
    setEyeIcon(false);
  }

  emailInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      signIn();
    }
  });

  const updateCaps = (e) => {
    if (typeof e.getModifierState === "function") {
      const on = e.getModifierState("CapsLock");
      if (capsHint) capsHint.style.display = on ? "block" : "none";
    }
  };

  passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      signIn();
      return;
    }
    updateCaps(e);
  });
  passwordInput.addEventListener("keyup", updateCaps);
  passwordInput.addEventListener("focus", (e) => updateCaps(e));
  passwordInput.addEventListener("blur", () => {
    if (capsHint) capsHint.style.display = "none";
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    init();
  });
} else {
  init();
}
