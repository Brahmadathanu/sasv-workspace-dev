// public/utilities-hub/js/hub-auth.js
// =============================================================================
// SASV Utilities Hub — Auth, Access Control, and Curated Utilities Grid
// Requires: ../../shared/js/supabaseClient.js (exporting `supabase`)
// Uses the canonical registry view `v_app_module_registry` as the sole
// navigation source for the PWA hub.
// =============================================================================

import { supabase } from "../../shared/js/supabaseClient.js";
import {
  buildPermissionMap,
  getModuleAccessLevel,
  loadClientModuleRegistry,
  loadNavigationSections,
  normalizeModuleKey,
} from "../../shared/js/module-registry.js";

let activeRenderPromise = null;
let queuedRenderReason = null;
let lastRenderedSessionKey = null;

function getSessionRenderKey(session) {
  return session?.user?.id || "anon";
}

async function getUserPermissions(userId) {
  if (!userId) return null;
  try {
    const { data, error } = await supabase.rpc("get_user_permissions", {
      p_user_id: userId,
    });
    if (error) {
      console.debug("getUserPermissions RPC error", error);
      return null;
    }
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.debug("getUserPermissions failed", e);
    return null;
  }
}

const elRoot = document.getElementById("hub-root");
const elEmpty = document.getElementById("hub-empty");
const elGreeting = document.getElementById("hub-greeting");
const elUserName = document.getElementById("hub-user-name");

const elLoginForm = document.getElementById("hub-login-form");
const elEmail = document.getElementById("auth-email");
const elPassword = document.getElementById("auth-password");
const elSignInBtn = document.getElementById("auth-signin");
const elAuthMsg = document.getElementById("auth-msg");

const elLoggedIn = document.getElementById("hub-logged-in");
const btnLogout = document.getElementById("hub-logout");

function setBusy(on) {
  elRoot?.setAttribute("aria-busy", on ? "true" : "false");
}

function safeText(value) {
  return String(value ?? "");
}

function guessNameFromEmail(email) {
  if (!email) return "";
  const namePart = email.split("@")[0] || "";
  return namePart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ""))
    .join(" ")
    .trim();
}

function showMsg(text, isError = false) {
  if (!elAuthMsg) return;
  elAuthMsg.textContent = text || "";
  elAuthMsg.style.color = isError ? "#b91c1c" : "#6b7280";
}

function clearMsgSoon(ms = 3000) {
  if (!elAuthMsg) return;
  setTimeout(() => {
    elAuthMsg.textContent = "";
  }, ms);
}

function formatSectionLabel(sectionKey) {
  const normalized = normalizeModuleKey(sectionKey);
  if (!normalized) return "Other";
  return normalized
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");
}

function sortByCuration(a, b) {
  const sectionDelta = (a.sectionSort ?? 999) - (b.sectionSort ?? 999);
  if (sectionDelta !== 0) return sectionDelta;

  const orderDelta = (a.order ?? 999) - (b.order ?? 999);
  if (orderDelta !== 0) return orderDelta;

  return (a.label || "").localeCompare(b.label || "");
}

function renderMessageCard(title, message) {
  return `
    <article class="hub-card" role="status" aria-live="polite">
      <h3>${safeText(title)}</h3>
      <p>${safeText(message)}</p>
    </article>`;
}

function renderUtilitiesSectioned(utilities, accessMap) {
  const visible = utilities.filter(
    (utility) => (accessMap[utility.id] || "none") !== "none",
  );

  const bySection = new Map();
  visible
    .map((utility) => ({
      ...utility,
      sectionLabel:
        utility.sectionLabel || formatSectionLabel(utility.sectionKey),
      sectionSort: utility.sectionSort ?? 999,
      order: utility.order ?? 999,
      accessLevel: accessMap[utility.id] || "none",
    }))
    .forEach((utility) => {
      if (!bySection.has(utility.sectionLabel)) {
        bySection.set(utility.sectionLabel, {
          label: utility.sectionLabel,
          description: utility.sectionDescription || "",
          sort: utility.sectionSort ?? 999,
          items: [],
        });
      }
      const bucket = bySection.get(utility.sectionLabel);
      if (!bucket.description && utility.sectionDescription) {
        bucket.description = utility.sectionDescription;
      }
      bucket.sort = Math.min(bucket.sort, utility.sectionSort ?? 999);
      bucket.items.push(utility);
    });

  const sections = Array.from(bySection.values()).sort(
    (left, right) => left.sort - right.sort,
  );

  let html = "";
  sections.forEach((section) => {
    const list = section.items.sort(sortByCuration);
    if (!list.length) return;

    html += `
      <div class="hub-section">
        <h3 class="hub-section-title">${safeText(section.label)}</h3>
        ${section.description ? `<p>${safeText(section.description)}</p>` : ""}
        <div class="hub-grid">`;

    list.forEach((utility) => {
      const isViewOnly = utility.accessLevel === "view";
      const href = isViewOnly ? "#" : utility.href;
      const title = isViewOnly
        ? "View-only access. Contact admin for full access."
        : "";
      html += `
        <article class="hub-card${isViewOnly ? " muted" : ""}" tabindex="-1">
          <h3><a href="${safeText(href)}" data-href="${safeText(utility.href)}" data-module-key="${safeText(utility.moduleKey)}"${isViewOnly ? ' aria-disabled="true"' : ""}${title ? ` title="${safeText(title)}"` : ""}>${safeText(utility.label)}</a></h3>
          <p>${safeText(utility.description || "")}</p>
        </article>`;
    });

    html += "</div></div>";
  });

  return (
    html ||
    renderMessageCard(
      "No tools available",
      "You do not currently have access to any tools. Contact admin.",
    )
  );
}

async function loadUtilities() {
  const [registryRows, sectionRows] = await Promise.all([
    loadClientModuleRegistry("pwa"),
    loadNavigationSections(),
  ]);
  const sectionMetaByKey = new Map();
  const sectionMetaByLabel = new Map();

  sectionRows.forEach((row) => {
    sectionMetaByKey.set(row.key, row);
    if (row.label) {
      sectionMetaByLabel.set(row.label, row);
    }
  });

  return registryRows.map((row) => {
    const sectionLabel = row.sectionLabel || formatSectionLabel(row.sectionKey);
    const sectionMeta =
      sectionMetaByKey.get(row.sectionKey) ||
      sectionMetaByLabel.get(sectionLabel) ||
      null;

    return {
      id: row.moduleKey,
      key: row.moduleKey,
      moduleKey: row.moduleKey,
      label: row.label,
      description: row.description || "",
      href: row.routePath || "#",
      sectionKey: row.sectionKey,
      sectionLabel,
      sectionDescription: sectionMeta?.description || "",
      sectionSort: sectionMeta?.sortOrder ?? 999,
      order: row.sortOrder ?? 999,
      minNavMode: row.minNavMode || "view",
    };
  });
}

async function loadAccessMap(userId, utilities) {
  const map = {};
  utilities.forEach((utility) => {
    map[utility.id] = "none";
  });
  if (!userId) return map;

  try {
    const perms = await getUserPermissions(userId);
    if (!perms) return map;

    const permissionMap = buildPermissionMap(perms);
    utilities.forEach((utility) => {
      map[utility.id] = getModuleAccessLevel(
        { moduleKey: utility.moduleKey, minNavMode: utility.minNavMode },
        permissionMap,
      );
    });
  } catch (e) {
    console.debug("loadAccessMap RPC failed", e);
  }

  return map;
}

async function showGreeting(session) {
  if (!elGreeting || !elUserName) return;

  if (!session?.user) {
    elGreeting.style.display = "none";
    elUserName.textContent = "";
    return;
  }

  const displayName =
    session.user.user_metadata?.full_name ||
    guessNameFromEmail(session.user.email) ||
    "there";

  elUserName.textContent = displayName;
  elGreeting.style.display = "";
}

function updateAuthUI(session) {
  const signedIn = !!session?.user;
  if (elLoginForm) elLoginForm.style.display = signedIn ? "none" : "flex";
  if (elLoggedIn) elLoggedIn.style.display = signedIn ? "flex" : "none";
  if (!signedIn && elPassword) elPassword.value = "";
}

async function signInWithPassword(event) {
  event?.preventDefault?.();
  const email = elEmail?.value?.trim();
  const password = elPassword?.value ?? "";

  if (!email || !password) {
    showMsg("Enter email and password.", true);
    clearMsgSoon();
    return;
  }

  if (elSignInBtn) elSignInBtn.disabled = true;
  showMsg("Signing in…");
  try {
    const { data: signInResult, error } =
      await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const msg = /invalid/.test(error.message || "")
        ? "Invalid email or password."
        : error.message || "Sign-in failed.";
      showMsg(msg, true);
      clearMsgSoon(4000);
      return;
    }

    console.log("Signed in:", signInResult);
    showMsg("Signed in.");
    clearMsgSoon();
  } catch (e) {
    console.error(e);
    showMsg("Sign-in failed. Try again.", true);
    clearMsgSoon(4000);
  } finally {
    if (elSignInBtn) elSignInBtn.disabled = false;
  }
}

async function signUpWithPassword(event) {
  event?.preventDefault?.();
  const email = elEmail?.value?.trim();
  const password = elPassword?.value ?? "";

  if (!email || !password) {
    showMsg("Enter email and a new password.", true);
    clearMsgSoon();
    return;
  }

  if (elSignInBtn) elSignInBtn.disabled = true;
  showMsg("Creating account…");

  try {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: new URL(
          "/utilities-hub/auth/callback.html",
          location.origin,
        ).href,
      },
    });

    if (error) {
      if ((error.message || "").toLowerCase().includes("exists")) {
        showMsg(
          "Account already exists. Use Sign in or Forgot password.",
          true,
        );
      } else {
        showMsg(error.message || "Sign-up failed.", true);
      }
      clearMsgSoon(5000);
      return;
    }

    showMsg("Account created. Check your email if confirmation is required.");
    clearMsgSoon(6000);
  } catch (e) {
    console.error(e);
    showMsg("Sign-up failed. Try again.", true);
    clearMsgSoon(5000);
  } finally {
    if (elSignInBtn) elSignInBtn.disabled = false;
  }
}

async function sendPasswordReset(event) {
  event?.preventDefault?.();
  const email = elEmail?.value?.trim();
  if (!email) {
    showMsg("Enter your email first.", true);
    clearMsgSoon();
    return;
  }

  showMsg("Sending reset email…");
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: new URL("/utilities-hub/auth/callback.html", location.origin)
        .href,
    });
    if (error) throw error;
    showMsg("Check your email for the reset link.");
    clearMsgSoon(6000);
  } catch (e) {
    console.error(e);
    showMsg("Could not send reset email.", true);
    clearMsgSoon(5000);
  }
}

async function logoutFlow() {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn("Sign-out failed:", e);
  }
}

async function performRender() {
  setBusy(true);
  if (elEmpty) elEmpty.style.display = "none";

  const {
    data: { session },
  } = await supabase.auth.getSession();
  lastRenderedSessionKey = getSessionRenderKey(session);

  updateAuthUI(session);
  await showGreeting(session);

  let utilities;
  let accessMap;
  try {
    utilities = await loadUtilities();
    accessMap = await loadAccessMap(session?.user?.id, utilities);
  } catch (error) {
    console.error("Failed to load PWA module registry", error);
    if (elRoot) {
      elRoot.innerHTML = renderMessageCard(
        "Module registry unavailable",
        "Tools could not be loaded right now. Contact admin if this keeps happening.",
      );
    }
    if (elEmpty) elEmpty.style.display = "none";
    setBusy(false);
    return;
  }

  if (elRoot) {
    elRoot.innerHTML = renderUtilitiesSectioned(utilities, accessMap);
    elRoot.classList.remove("hub-grid");
    elRoot.classList.add("hub-root-sectioned");
  }

  const hasVisible = utilities.some(
    (utility) => (accessMap[utility.id] || "none") !== "none",
  );
  if (elEmpty) elEmpty.style.display = hasVisible ? "none" : "";

  setBusy(false);
}

async function render(reason = "manual") {
  if (activeRenderPromise) {
    queuedRenderReason = reason;
    return activeRenderPromise;
  }

  activeRenderPromise = (async () => {
    let nextReason = reason;

    while (nextReason) {
      queuedRenderReason = null;
      await performRender();
      nextReason = queuedRenderReason;
    }
  })();

  try {
    await activeRenderPromise;
  } finally {
    activeRenderPromise = null;
  }
}

function handleSignedInSignal(reason) {
  render(reason).catch(console.error);
}

function wireEvents() {
  elLoginForm?.addEventListener("submit", signInWithPassword);
  btnLogout?.addEventListener("click", logoutFlow);

  elRoot?.addEventListener("click", (event) => {
    const link =
      event.target.closest && event.target.closest("a[aria-disabled='true']");
    if (!link) return;
    event.preventDefault();
    event.stopPropagation();
    alert(
      "This module is view-only for your account. Contact admin for full access.",
    );
  });

  document
    .getElementById("auth-signup")
    ?.addEventListener("click", signUpWithPassword);
  document
    .getElementById("auth-forgot")
    ?.addEventListener("click", sendPasswordReset);

  try {
    const authChannel = new BroadcastChannel("sasv-auth");
    authChannel.addEventListener("message", (event) => {
      if (event?.data?.type === "signed-in") {
        handleSignedInSignal("broadcast:signed-in");
      }
    });
  } catch {
    // BroadcastChannel is not available on all mobile browsers.
  }

  navigator.serviceWorker?.addEventListener("message", (event) => {
    if (event?.data?.type === "signed-in") {
      handleSignedInSignal("sw:signed-in");
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      handleSignedInSignal("visibilitychange");
    }
  });

  window.addEventListener("pageshow", () => {
    handleSignedInSignal("pageshow");
  });

  supabase.auth.onAuthStateChange((event, session) => {
    const sessionKey = getSessionRenderKey(session);

    if (event === "INITIAL_SESSION") {
      return;
    }

    if (event === "SIGNED_IN" && activeRenderPromise) {
      return;
    }

    if (sessionKey === lastRenderedSessionKey) {
      return;
    }

    render(`auth:${event}`).catch(console.error);
  });
}

(async function boot() {
  try {
    wireEvents();
    await render("boot");
  } catch (e) {
    console.error(e);
    showMsg("Something went wrong. Reload the page.", true);
  }
})();
