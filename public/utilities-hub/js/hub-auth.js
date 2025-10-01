// public/utilities-hub/js/hub-auth.js
// =============================================================================
// SASV Utilities Hub — Auth, Access Control, and Curated Utilities Grid
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
// Admin check:
//   User is "admin" if they have USE on the 'hub_admin' utility.
// =============================================================================

import { supabase } from "../../shared/js/supabaseClient.js";

/* ──────────────────────────────────────────────────────────────
   DOM references
─────────────────────────────────────────────────────────────── */
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

/* ──────────────────────────────────────────────────────────────
   Helpers
─────────────────────────────────────────────────────────────── */
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

/* ──────────────────────────────────────────────────────────────
   Admin check (USE access on hub_admin)
─────────────────────────────────────────────────────────────── */
async function isHubAdmin(userId) {
  if (!userId) return false;
  try {
    const { data, error } = await supabase
      .from("hub_user_access")
      .select("level, hub_utilities!inner(key)")
      .eq("user_id", userId)
      .eq("hub_utilities.key", "hub_admin")
      .maybeSingle();

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

/* ──────────────────────────────────────────────────────────────
   Utility key -> page URL mapping (relative to /public/utilities-hub/js/)
   NOTE: We support both 'view_log' and 'view_logs' keys.
─────────────────────────────────────────────────────────────── */
const UTIL_URLS = Object.freeze({
  // Planning & Operations / MRP
  fill_planner: "../shared/fill-planner.html",
  plant_occupancy: "../shared/plant-occupancy.html",

  // Inventory & Sales Analytics
  stock_checker: "../shared/stock-checker.html",
  wip_stock: "../shared/wip-stock.html",
  fg_bulk_stock: "../shared/fg-bulk-stock.html",
  bottled_stock: "../shared/bottled-stock.html",
  bmr_card_not_initiated: "../shared/bmr-card-not-initiated.html",

  // Work Logs
  view_log: "../shared/view-logs.html", // DB key you showed
  view_logs: "../shared/view-logs.html", // safety: alternate spelling

  // System
  etl_monitor: "../shared/operations-monitor.html",
  etl_control: "../shared/operations-control.html",

  // Admin
  hub_admin: "./admin.html",
});

/* ──────────────────────────────────────────────────────────────
   Curation: sections and ordering
─────────────────────────────────────────────────────────────── */
const SECTION_ORDER = Object.freeze({
  "Planning & Operations": 10,
  "Inventory & Sales Analytics": 20,
  "Work Logs": 30,
  System: 90,
  Admin: 100,
});

const UTIL_META = Object.freeze({
  // Planning & Operations / MRP
  fill_planner: { section: "Planning & Operations", order: 10 },
  plant_occupancy: { section: "Planning & Operations", order: 20 },

  // Inventory & Sales Analytics
  stock_checker: { section: "Inventory & Sales Analytics", order: 10 },
  wip_stock: { section: "Inventory & Sales Analytics", order: 20 },
  fg_bulk_stock: { section: "Inventory & Sales Analytics", order: 30 },
  bottled_stock: { section: "Inventory & Sales Analytics", order: 40 },
  bmr_card_not_initiated: { section: "Inventory & Sales Analytics", order: 50 },

  // Work Logs
  view_log: { section: "Work Logs", order: 10 },
  view_logs: { section: "Work Logs", order: 10 }, // safety alias

  // System
  etl_monitor: { section: "System", order: 10 },
  etl_control: { section: "System", order: 20 },

  // Admin
  hub_admin: { section: "Admin", order: 10 },
});

function sortByCuration(a, b) {
  const ma = UTIL_META[a.key] || {};
  const mb = UTIL_META[b.key] || {};

  const sa = SECTION_ORDER[ma.section] ?? 999;
  const sb = SECTION_ORDER[mb.section] ?? 999;
  if (sa !== sb) return sa - sb;

  const oa = ma.order ?? 999;
  const ob = mb.order ?? 999;
  if (oa !== ob) return oa - ob;

  return (a.label || "").localeCompare(b.label || "");
}

/* ──────────────────────────────────────────────────────────────
   Minimal cards & messages
─────────────────────────────────────────────────────────────── */
function renderMessageCard(title, message) {
  return `
    <article class="hub-card" role="status" aria-live="polite">
      <h3>${safeText(title)}</h3>
      <p>${safeText(message)}</p>
    </article>`;
}

/* ──────────────────────────────────────────────────────────────
   Sectioned renderer (curated order + Request buttons)
─────────────────────────────────────────────────────────────── */
function renderUtilitiesSectioned(utilities, accessMap) {
  // keep only utilities that are visible (use or view)
  const visible = utilities.filter(
    (u) => (accessMap[u.id] || "none") !== "none"
  );

  // attach meta for grouping/sorting
  const withMeta = visible.map((u) => {
    const m = UTIL_META[u.key] || {};
    return {
      ...u,
      __section: m.section || "Other",
      __order: m.order ?? 999,
      __access: accessMap[u.id] || "none",
    };
  });

  // group by section
  const bySection = {};
  withMeta.forEach((u) => {
    (bySection[u.__section] ||= []).push(u);
  });

  // order sections
  const sections = Object.keys(bySection).sort(
    (A, B) => (SECTION_ORDER[A] ?? 999) - (SECTION_ORDER[B] ?? 999)
  );

  let html = "";
  sections.forEach((sec) => {
    const list = bySection[sec].sort(sortByCuration);
    if (!list.length) return;

    html += `
      <div class="hub-section">
        <h3 class="hub-section-title">${sec}</h3>
        <div class="hub-grid">
    `;

    list.forEach((u) => {
      const access = u.__access; // 'use' | 'view'
      const href = access === "use" ? u.href : "#";
      const locked = access === "use" ? "" : " 🔒";

      html += `
        <article class="hub-card" tabindex="-1">
          <h3>${
            access === "use"
              ? `<a href="${href}">${safeText(u.label)}</a>`
              : `<span aria-label="Locked">${safeText(u.label)}${locked}</span>`
          }</h3>
          <p>${safeText(u.description || "")}</p>
          ${
            access === "use"
              ? ""
              : `<button class="button" data-request="${u.id}" data-key="${u.key}">
                   Request access
                 </button>`
          }
        </article>
      `;
    });

    html += `</div></div>`;
  });

  return (
    html ||
    renderMessageCard("No tools yet", "Please contact admin to add utilities.")
  );
}

/* ──────────────────────────────────────────────────────────────
   Request Access buttons
─────────────────────────────────────────────────────────────── */
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

/* ──────────────────────────────────────────────────────────────
   Data fetchers
─────────────────────────────────────────────────────────────── */
async function loadUtilities() {
  const { data, error } = await supabase
    .from("hub_utilities")
    .select("id, key, label, description");

  if (!error && Array.isArray(data)) {
    return data.map((r) => ({
      id: String(r.id),
      key: r.key,
      label: r.label,
      description: r.description || "",
      href: UTIL_URLS[r.key] || "#",
    }));
  }

  // Benign fallback (keeps hub usable if table missing/empty)
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

  // fallback: show as 'view' so users can request access
  utilities.forEach((u) => (map[u.id] = "view"));
  return map;
}

/* ──────────────────────────────────────────────────────────────
   Greeting
─────────────────────────────────────────────────────────────── */
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

/* ──────────────────────────────────────────────────────────────
   Auth UI + flows
─────────────────────────────────────────────────────────────── */
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

  elSignInBtn && (elSignInBtn.disabled = true);
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

    console.log("Signed in:", signInResult); // optional
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
  // UI refresh will occur via auth state listener
}

/* ──────────────────────────────────────────────────────────────
   Main render
─────────────────────────────────────────────────────────────── */
async function render() {
  setBusy(true);
  if (elEmpty) elEmpty.style.display = "none";

  const {
    data: { session },
  } = await supabase.auth.getSession();

  updateAuthUI(session);
  await showGreeting(session);

  // Data (utilities + access map)
  let utilities, accessMap;
  try {
    utilities = await loadUtilities(); // [{ id, key, label, description, href }]
    accessMap = await loadAccessMap(session?.user?.id, utilities); // { [id]: 'use'|'view'|'none' }
  } catch {
    if (elRoot)
      elRoot.innerHTML = renderMessageCard("Loading…", "Preparing your tools.");
    setBusy(false);
    return;
  }

  // Admin check: hide Hub Admin unless user is admin
  const admin = await isHubAdmin(session?.user?.id);
  const visibleUtilities = admin
    ? utilities
    : utilities.filter((u) => u.key !== "hub_admin");

  // Keep access entries only for visible list
  const visibleIds = new Set(visibleUtilities.map((u) => u.id));
  const prunedAccessMap = {};
  for (const [id, level] of Object.entries(accessMap)) {
    if (visibleIds.has(id)) prunedAccessMap[id] = level;
  }

  // Render curated, sectioned UI
  if (elRoot) {
    elRoot.innerHTML = renderUtilitiesSectioned(
      visibleUtilities,
      prunedAccessMap
    );
    elRoot.classList.remove("hub-grid"); // root shouldn't be a grid anymore
    elRoot.classList.add("hub-root-sectioned"); // mark as sectioned layout
  }

  // Empty state toggle
  const hasVisible = visibleUtilities.some(
    (u) => (prunedAccessMap[u.id] || "none") !== "none"
  );
  if (elEmpty) elEmpty.style.display = hasVisible ? "none" : "";

  // Wire any Request buttons we just rendered
  const {
    data: { session: freshSession },
  } = await supabase.auth.getSession();
  wireRequestButtons(freshSession);

  setBusy(false);
}

/* ──────────────────────────────────────────────────────────────
   Boot + listeners
─────────────────────────────────────────────────────────────── */
function wireEvents() {
  elLoginForm?.addEventListener("submit", signInWithPassword);
  btnLogout?.addEventListener("click", logoutFlow);

  document
    .getElementById("auth-signup")
    ?.addEventListener("click", signUpWithPassword);
  document
    .getElementById("auth-forgot")
    ?.addEventListener("click", sendPasswordReset);

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
