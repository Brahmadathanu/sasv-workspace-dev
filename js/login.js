// js/login.js
import { supabase } from "../public/shared/js/supabaseClient.js";

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

function setEyeIcon(showing) {
  if (!togglePwdBtn) return;
  const eyeOpen =
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  const eyeOff =
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-6 0-10-8-10-8a21.77 21.77 0 0 1 5.06-6.94"/><path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6 0 10 8 10 8a21.87 21.87 0 0 1-3.13 4.7"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  togglePwdBtn.innerHTML = showing ? eyeOff : eyeOpen;
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
          // fallback to legacy table if RPC unavailable
          try {
            const { data: perms2 } = await supabase
              .from("user_permissions")
              .select("module_id,can_view,can_edit,can_delete")
              .eq("user_id", user.id);
            (perms2 || []).forEach((p) => {
              if (p.can_view) permissions.push(`${p.module_id}:view`);
              if (p.can_edit) permissions.push(`${p.module_id}:edit`);
              if (p.can_delete) permissions.push(`${p.module_id}:delete`);
            });
          } catch (permErr) {
            console.warn("Could not load permissions:", permErr);
          }
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
