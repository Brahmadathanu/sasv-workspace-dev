// public/utilities-hub/js/hub-auth.js
// =============================================================================
// SASV Utilities Hub — Email/Password Auth + Access Control + Grid Rendering
// Requires: ../../shared/js/supabaseClient.js (exporting `supabase`)
//
// DOM used:
//   #hub-root, #hub-empty, #hub-greeting, #hub-user-name
//   #hub-login-form, #auth-email, #auth-password, #auth-signin, #auth-msg
//   #hub-logged-in, #hub-logout
//
// DB tables:
//   hub_utilities(id, key, label, description)
//   hub_user_access(user_id, utility_id, level enum: 'none'|'view'|'use')
//   hub_access_requests(id, user_id, utility_id, note, status)
// Admin view/table (any one of these you created earlier):
//   hub_admins(user_id uuid)  -- view that lists admin user_ids
// =============================================================================

import { supabase } from "../../shared/js/supabaseClient.js";

/** DOM refs */
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

// Admin = user has USE access on the 'hub_admin' utility
async function isHubAdmin(userId) {
  if (!userId) return false;
  try {
    const { data, error } = await supabase
      .from("hub_user_access")
      .select("level, hub_utilities!inner(key)")
      .eq("user_id", userId)
      .eq("hub_utilities.key", "hub_admin")
      .maybeSingle(); // returns null if no row

    if (error) {
      console.warn("Admin check error:", error);
      return false;
    }
    return (data?.level || "").toLowerCase() === "use";
  } catch (e) {
    console.warn("Admin check failed:", e);
    return false;
  }
}

/** Helpers ------------------------------------------------------------------*/
function setBusy(on) {
  elRoot?.setAttribute("aria-busy", on ? "true" : "false");
}
function safeText(s) {
  return String(s ?? "");
}
function guessNameFromEmail(email) {
  if (!email) return "";
  const namePart = email.split("@")[0] || "";
  return namePart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
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

/** Utility key -> page (relative) ------------------------------------------*/
const UTIL_URLS = {
  fill_planner: "../shared/fill-planner.html",
  stock_checker: "../shared/stock-checker.html",
  view_logs: "../shared/view-logs.html",
  hub_admin: "./admin.html",
  etl_monitor: "../shared/etl-monitor.html",
  etl_control: "../shared/etl-control.html",
};

/** Render cards -------------------------------------------------------------*/
function renderMessageCard(title, message) {
  return `
    <article class="hub-card" role="status" aria-live="polite">
      <h3>${safeText(title)}</h3>
      <p>${safeText(message)}</p>
    </article>`;
}

function renderUtilities(utilities, accessMap) {
  if (!utilities?.length) {
    return renderMessageCard(
      "No tools yet",
      "Please contact admin to add utilities."
    );
  }

  return utilities
    .map((u) => {
      const access = accessMap[u.id] || "none";
      if (access === "use") {
        return `
        <article class="hub-card" tabindex="-1">
          <h3><a href="${u.href}">${safeText(u.label)}</a></h3>
          <p>${safeText(u.description)}</p>
        </article>`;
      }
      // 'view' or 'none' → show locked + Request button
      return `
      <article class="hub-card" tabindex="-1">
        <h3><span aria-label="Locked">${safeText(u.label)} 🔒</span></h3>
        <p>${safeText(u.description)}</p>
        <button class="button" data-request="${u.id}" data-key="${u.key}">
          Request access
        </button>
      </article>`;
    })
    .join("");
}

/** Wire "Request access" buttons -------------------------------------------*/
function wireRequestButtons(session) {
  if (!elRoot) return;
  elRoot.querySelectorAll("[data-request]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const utilityId = btn.getAttribute("data-request");
      const key = btn.getAttribute("data-key") || "";
      if (!utilityId || !session?.user) return;

      btn.disabled = true;
      try {
        const note = key
          ? `Requested via Utilities Hub for: ${key.replace("_", "-")}`
          : "Requested via Utilities Hub";
        const { error } = await supabase.from("hub_access_requests").insert({
          user_id: session.user.id,
          utility_id: utilityId,
          note,
          status: "pending",
        });
        if (error) throw error;
        btn.textContent = "Requested ✓";
      } catch (e) {
        console.error(e);
        alert("Could not send request. Please try again.");
        btn.disabled = false;
      }
    });
  });
}

/** Data: list utilities & access -------------------------------------------*/
async function loadUtilities() {
  const { data, error } = await supabase
    .from("hub_utilities")
    .select("id, key, label, description")
    .order("label", { ascending: true });

  if (!error && Array.isArray(data)) {
    return data.map((r) => ({
      id: String(r.id),
      key: r.key,
      label: r.label,
      description: r.description || "",
      href: UTIL_URLS[r.key] || "#",
    }));
  }

  // Benign fallback (table missing/empty): keep Hub usable
  return [
    {
      id: "fill-planner",
      key: "fill_planner",
      label: "Fill Planner",
      description:
        "Plan fills from bulk with emergency SKU deductions + MOS context.",
      href: UTIL_URLS.fill_planner,
    },
    {
      id: "stock-checker",
      key: "stock_checker",
      label: "Stock Checker",
      description:
        "Quick search with filters and CSV export for stock/forecast/MOS.",
      href: UTIL_URLS.stock_checker,
    },
  ];
}

async function loadAccessMap(userId, utilities) {
  const map = {};
  utilities.forEach((u) => (map[u.id] = "none"));
  if (!userId) return map;

  const { data, error } = await supabase
    .from("hub_user_access")
    .select("utility_id, level")
    .eq("user_id", userId);

  if (!error && Array.isArray(data)) {
    for (const row of data) {
      const id = String(row.utility_id);
      if (!(id in map)) continue;
      const level = String(row.level || "").toLowerCase();
      if (level === "use" || level === "view") map[id] = level;
    }
    return map;
  }

  // fallback: show as 'view' so they can request access
  utilities.forEach((u) => (map[u.id] = "view"));
  return map;
}

/** Greeting + Name ----------------------------------------------------------*/
async function showGreeting(session) {
  if (!elGreeting || !elUserName) return;

  if (!session?.user) {
    elGreeting.style.display = "none";
    elUserName.textContent = "";
    return;
  }

  // Prefer full_name metadata; otherwise derive from email
  const displayName =
    session.user.user_metadata?.full_name ||
    guessNameFromEmail(session.user.email) ||
    "there";

  elUserName.textContent = displayName;
  elGreeting.style.display = "";
}

/** Auth UI show/hide --------------------------------------------------------*/
function updateAuthUI(session) {
  const signedIn = !!session?.user;
  if (elLoginForm) elLoginForm.style.display = signedIn ? "none" : "flex";
  if (elLoggedIn) elLoggedIn.style.display = signedIn ? "flex" : "none";

  if (!signedIn) {
    // clear password field on sign-out
    if (elPassword) elPassword.value = "";
  }
}

/** Email/Password sign-in ---------------------------------------------------*/
async function signInWithPassword(event) {
  event?.preventDefault?.();
  const email = elEmail?.value?.trim();
  const password = elPassword?.value ?? "";

  if (!email || !password) {
    showMsg("Enter email and password.", true);
    clearMsgSoon();
    return;
  }

  elSignInBtn && (elSignInBtn.disabled = true);
  showMsg("Signing in…");
  try {
    const { data: signInResult, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });
    if (error) {
      const msg = /invalid/.test(error.message || "")
        ? "Invalid email or password."
        : error.message || "Sign-in failed.";
      showMsg(msg, true);
      clearMsgSoon(4000);
      return;
    }

    console.log("Signed in:", signInResult); // optional

    // success → UI will refresh via auth state listener
    showMsg("Signed in.");
    clearMsgSoon();
  } catch (e) {
    console.error(e);
    showMsg("Sign-in failed. Try again.", true);
    clearMsgSoon(4000);
  } finally {
    elSignInBtn && (elSignInBtn.disabled = false);
  }
}

/** Create account (email + password) */
async function signUpWithPassword(event) {
  event?.preventDefault?.();
  const email = elEmail?.value?.trim();
  const password = elPassword?.value ?? "";

  if (!email || !password) {
    showMsg("Enter email and a new password.", true);
    clearMsgSoon();
    return;
  }

  elSignInBtn && (elSignInBtn.disabled = true);
  showMsg("Creating account…");

  try {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: new URL(
          "/utilities-hub/auth/callback.html",
          location.origin
        ).href,
      },
    });

    if (error) {
      // Common case: user already exists
      if ((error.message || "").toLowerCase().includes("exists")) {
        showMsg(
          "Account already exists. Use Sign in or Forgot password.",
          true
        );
      } else {
        showMsg(error.message || "Sign-up failed.", true);
      }
      clearMsgSoon(5000);
      return;
    }

    // If email confirmation is ON, they must confirm via email.
    showMsg("Account created. Check your email if confirmation is required.");
    clearMsgSoon(6000);
  } catch (e) {
    console.error(e);
    showMsg("Sign-up failed. Try again.", true);
    clearMsgSoon(5000);
  } finally {
    elSignInBtn && (elSignInBtn.disabled = false);
  }
}

/** Forgot password: send reset email so the user sets a new password */
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

/** Logout -------------------------------------------------------------------*/
async function logoutFlow() {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn("Sign-out failed:", e);
  }
  // UI and grid will refresh via onAuthStateChange listener
}

/** Main render --------------------------------------------------------------*/
async function render() {
  setBusy(true);
  if (elEmpty) elEmpty.style.display = "none";

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // was: updateAuthButtons(session);
  updateAuthUI(session);
  await showGreeting(session);

  let utilities, accessMap;
  try {
    utilities = await loadUtilities(); // has .key
    accessMap = await loadAccessMap(session?.user?.id, utilities); // ids map
  } catch {
    // auth not ready yet → soft loading, boot() will re-render shortly
    elRoot.innerHTML = renderMessageCard("Loading…", "Preparing your tools.");
    setBusy(false);
    return;
  }

  // Admin check
  const admin = await isHubAdmin(session?.user?.id);

  // Hide Hub Admin for non-admins
  const visibleUtilities = admin
    ? utilities
    : utilities.filter((u) => u.key !== "hub_admin");

  // Keep access only for visible utilities
  const visibleIds = new Set(visibleUtilities.map((u) => u.id));
  const prunedAccessMap = {};
  for (const [id, level] of Object.entries(accessMap)) {
    if (visibleIds.has(id)) prunedAccessMap[id] = level;
  }

  // NEW: hide 'none' completely
  const filteredUtilities = visibleUtilities.filter(
    (u) => (prunedAccessMap[u.id] || "none") !== "none"
  );

  // Render only 'use' and 'view'
  if (elRoot)
    elRoot.innerHTML = renderUtilities(filteredUtilities, prunedAccessMap);

  // Empty state if nothing visible
  const hasVisible = filteredUtilities.length > 0;
  if (elEmpty) elEmpty.style.display = hasVisible ? "none" : "";

  wireRequestButtons(session);
  setBusy(false);
}

/** Boot + listeners ---------------------------------------------------------*/
function wireEvents() {
  // login form submit
  elLoginForm?.addEventListener("submit", signInWithPassword);
  // logout click
  btnLogout?.addEventListener("click", logoutFlow);

  // extra auth buttons
  document
    .getElementById("auth-signup")
    ?.addEventListener("click", signUpWithPassword);
  document
    .getElementById("auth-forgot")
    ?.addEventListener("click", sendPasswordReset);

  // re-render on any auth state changes (sign-in/out, token refresh)
  supabase.auth.onAuthStateChange(() => {
    render().catch(console.error);
  });
}

(async function boot() {
  try {
    wireEvents();
    await render();
  } catch (e) {
    console.error(e);
    showMsg("Something went wrong. Reload the page.", true);
  }
})();
