// public/utilities-hub/js/hub-auth.js
// =============================================================================
// SASV Utilities Hub — Auth + Access Control + Grid Rendering (Magic-link only)
// Requires: ../../shared/js/supabaseClient.js (exporting `supabase`)
// DOM: #hub-root, #hub-empty, #hub-greeting, #hub-user-name, #hub-login, #hub-logout
// DB tables:
//   hub_utilities(id, key, label, description)
//   hub_user_access(user_id, utility_id, level enum: 'none'|'view'|'use')
//   hub_access_requests(id, user_id, utility_id, note, status)
// =============================================================================

import { supabase } from "../../shared/js/supabaseClient.js";

/* ───────────────────────────── Helpers ───────────────────────────── */

function isHubAdmin(session) {
  const roles =
    session?.user?.app_metadata?.roles ||
    session?.user?.user_metadata?.roles ||
    [];
  return Array.isArray(roles) && roles.map(String).includes("admin");
}

/** Wait for Supabase to fire the INITIAL_SESSION event once */
function waitForInitialSession() {
  return new Promise((resolve) => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") resolve(session || null);
    });
  });
}

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
function isIOSPWA() {
  const ua = navigator.userAgent || navigator.vendor || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true; // old iOS
  return isIOS && standalone;
}
function renderMessageCard(title, message) {
  return `
    <article class="hub-card" role="status" aria-live="polite">
      <h3>${safeText(title)}</h3>
      <p>${safeText(message)}</p>
    </article>`;
}

/**
 * NEW: apply tokens received from callback.html (or SW) before re-rendering.
 * This is the critical bit that actually logs the PWA in.
 */
async function applySignedInTokens(payload) {
  try {
    const t = payload?.tokens;
    if (t?.access_token && t?.refresh_token) {
      await supabase.auth.setSession({
        access_token: t.access_token,
        refresh_token: t.refresh_token,
      });
      // Helpful on iOS: poke storage so other contexts may notice a sign-in
      try {
        localStorage.setItem("sasv_signed_in_at", String(Date.now()));
      } catch (e) {
        // iOS private mode or storage blocked — safe to ignore
        console.debug("[hub] localStorage ping failed:", e);
      }
    }
  } catch (e) {
    console.warn("[hub] setSession from message failed:", e);
  }
}

/* ───────────────────────────── DOM refs ───────────────────────────── */

const elRoot = document.getElementById("hub-root");
const elEmpty = document.getElementById("hub-empty");
const elGreeting = document.getElementById("hub-greeting");
const elUserName = document.getElementById("hub-user-name");
const btnLogin = document.getElementById("hub-login");
const btnLogout = document.getElementById("hub-logout");

/* ─────────────────────── Utility URL mapping ─────────────────────── */

const UTIL_URLS = {
  fill_planner: "../shared/fill-planner.html",
  stock_checker: "../shared/stock-checker.html",
  hub_admin: "./admin.html",
};

/* ───────────────────────────── Data loads ───────────────────────────── */

async function loadUtilities() {
  const { data, error } = await supabase
    .from("hub_utilities")
    .select("id, key, label, description")
    .order("label", { ascending: true });

  if (!error && Array.isArray(data) && data.length) {
    return data.map((r) => ({
      id: String(r.id),
      key: r.key,
      label: r.label,
      description: r.description || "",
      href: UTIL_URLS[r.key] || "#",
    }));
  }

  if (error && (error.code === "401" || error.code === "403")) {
    throw error; // auth timing, let caller retry
  }

  // Benign fallback (only if table missing/empty)
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

  if (error && (error.code === "401" || error.code === "403")) throw error;

  return map;
}

/* ───────────────────────────── Greeting ───────────────────────────── */

async function showGreeting(session) {
  if (!elGreeting || !elUserName) return;

  if (!session?.user) {
    elGreeting.style.display = "none";
    elUserName.textContent = "";
    return;
  }

  let displayName = "";
  try {
    const { data, error } = await supabase
      .from("sasv_users")
      .select("display_name")
      .eq("user_id", session.user.id)
      .limit(1)
      .maybeSingle();

    if (!error && data?.display_name) displayName = data.display_name;
  } catch (e) {
    console.debug("[hub] greeting lookup skipped:", e);
  }

  if (!displayName) {
    displayName =
      session.user.user_metadata?.full_name ||
      guessNameFromEmail(session.user.email) ||
      "there";
  }

  elUserName.textContent = displayName;
  elGreeting.style.display = "";
}

/* ───────────────────────────── Auth UI ───────────────────────────── */

function updateAuthButtons(session) {
  if (btnLogin) btnLogin.style.display = session?.user ? "none" : "";
  if (btnLogout) btnLogout.style.display = session?.user ? "" : "none";
}

/** Login (OTP for iOS PWA; magic link elsewhere) */
async function loginFlow() {
  const email = prompt("Enter your work email to sign in:");
  if (!email) return;

  // --- iOS PWA: stay in-app using a 6-digit code (no Safari hop)
  if (isIOSPWA()) {
    try {
      const { error: sendErr } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (sendErr) throw sendErr;

      alert("We've emailed you a 6-digit code. Please DO NOT tap the link.");
      const code = prompt("Enter the 6-digit code:");
      if (!code) return;

      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: "email",
      });
      if (verifyErr) throw verifyErr;

      await render(); // you're signed in
      return;
    } catch (err) {
      console.error(err);
      alert("Sign-in failed. Please try again.");
      return;
    }
  }

  // --- Desktop/Android: keep using magic link + your callback bridge
  try {
    const redirectTo = new URL(
      "/utilities-hub/auth/callback.html",
      window.location.origin
    ).href;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    if (error) throw error;
    alert("Check your email for a sign-in link.");
  } catch (err) {
    console.error(err);
    alert("Sign-in failed. Please try again.");
  }
}

/** Logout */
async function logoutFlow() {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn("[hub] signOut error (ignored):", e);
  }
  await render();
}

/* ───────────────────────────── Rendering ───────────────────────────── */

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
      // Show locked + Request access button for 'view' and 'none'
      return `
        <article class="hub-card" tabindex="-1">
          <h3><span aria-label="Locked">${safeText(u.label)} 🔒</span></h3>
          <p>${safeText(u.description)}</p>
          <button class="button" data-request="${u.id}" data-key="${
        u.key
      }">Request access</button>
        </article>`;
    })
    .join("");
}

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
      } catch {
        alert("Could not send request. Please try again.");
        btn.disabled = false;
      }
    });
  });
}

async function render() {
  setBusy(true);
  if (elEmpty) elEmpty.style.display = "none";

  const {
    data: { session },
  } = await supabase.auth.getSession();
  updateAuthButtons(session);
  await showGreeting(session);

  let utilities, accessMap;
  try {
    utilities = await loadUtilities();
    accessMap = await loadAccessMap(session?.user?.id, utilities);
  } catch {
    if (elRoot)
      elRoot.innerHTML = renderMessageCard("Loading…", "Preparing your tools.");
    setBusy(false);
    return;
  }

  // Hide Hub Admin unless admin OR has explicit "use"
  const adminFlag = isHubAdmin(session);
  const filtered = utilities.filter((u) => {
    if (u.key === "hub_admin") {
      const level = accessMap[u.id] || "none";
      return adminFlag || level === "use";
    }
    return true;
  });

  if (elRoot) elRoot.innerHTML = renderUtilities(filtered, accessMap);

  // Empty state only when nothing visible
  const hasVisible =
    filtered.length > 0 &&
    filtered.some((u) => {
      const lvl = accessMap[u.id] || "none";
      return lvl === "use" || lvl === "view";
    });
  if (elEmpty) elEmpty.style.display = hasVisible ? "none" : "";

  wireRequestButtons(session);
  setBusy(false);
}

/* ───────────────────────────── Boot ───────────────────────────── */

async function boot() {
  setBusy(true);
  await waitForInitialSession(); // wait for auth to settle
  await render();
  // Revalidate once more soon (covers token timing)
  setTimeout(() => {
    render().catch(console.error);
  }, 600);
}

/* ───────────────────────────── Event hooks ───────────────────────────── */

btnLogin?.addEventListener("click", loginFlow);
btnLogout?.addEventListener("click", logoutFlow);

// Re-render on any auth change (token refresh, sign-out, etc.)
supabase.auth.onAuthStateChange(() => {
  render().catch(console.error);
});

/**
 * LISTENERS (cleaned up — no duplicates):
 * 1) BroadcastChannel ("sasv-auth"): receive tokens from callback.html
 * 2) Service Worker message: same payload when SW wakes the app
 * 3) localStorage: iOS fallback signal (no tokens; just re-render)
 */

// 1) BroadcastChannel from callback.html (browser tab)
try {
  const bc = new BroadcastChannel("sasv-auth");
  bc.onmessage = async (e) => {
    if (e?.data?.type === "signed-in") {
      await applySignedInTokens(e.data);
      render().catch(console.error);
    }
  };
} catch {
  // BroadcastChannel not supported — harmless.
}

// 2) Service Worker message path
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", async (ev) => {
    if (ev.data?.type === "signed-in") {
      await applySignedInTokens(ev.data);
      render().catch(console.error);
    }
  });
}

// 3) localStorage fallback (iOS sometimes)
window.addEventListener("storage", (e) => {
  if (e.key === "sasv_signed_in_at" && e.newValue) {
    // No tokens available via storage; just try re-render (session may already be set)
    render().catch(console.error);
  }
});

// Go!
boot().catch(console.error);
