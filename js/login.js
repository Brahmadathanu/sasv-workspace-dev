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
  { button, loadingLabel, originalLabel, extraDisable = [] } = {}
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
        showing ? "Show password" : "Hide password"
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
