// public/utilities-hub/js/hub-auth.js
// =============================================================================
// SASV Utilities Hub — Auth, Access Control, and Curated Utilities Grid
// Requires: ../../shared/js/supabaseClient.js (exporting `supabase`)
// Prefers the canonical registry view `v_app_module_registry`, but keeps the
// legacy `hub_utilities` fallback so the hub remains usable during migration.
// =============================================================================

import { supabase } from "../../shared/js/supabaseClient.js";
import {
  buildPermissionMap,
  getModuleAccessLevel,
  loadClientModuleRegistry,
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

const LEGACY_UTIL_URLS = Object.freeze({
  fill_planner: "../shared/fill-planner.html",
  "fill-planner": "../shared/fill-planner.html",
  plant_occupancy: "../shared/plant-occupancy.html",
  "plant-occupancy": "../shared/plant-occupancy.html",
  stock_checker: "../shared/stock-checker.html",
  "stock-checker": "../shared/stock-checker.html",
  wip_stock: "../shared/wip-stock.html",
  "wip-stock": "../shared/wip-stock.html",
  fg_bulk_stock: "../shared/fg-bulk-stock.html",
  "fg-bulk-stock": "../shared/fg-bulk-stock.html",
  bottled_stock: "../shared/bottled-stock.html",
  "bottled-stock": "../shared/bottled-stock.html",
  bmr_card_not_initiated: "../shared/bmr-card-not-initiated.html",
  "bmr-card-not-initiated": "../shared/bmr-card-not-initiated.html",
  sales_viewer: "../shared/sales-viewer.html",
  "sales-viewer": "../shared/sales-viewer.html",
  "sales-data-viewer": "../shared/sales-viewer.html",
  stock_purchase_explorer: "../shared/stock-purchase-explorer.html",
  "stock-purchase-explorer": "../shared/stock-purchase-explorer.html",
  fg_transfer_reconciliation: "../shared/fg-transfer-reconciliation.html",
  "fg-transfer-reconciliation": "../shared/fg-transfer-reconciliation.html",
  "production-execution-queue": "../shared/production-execution-queue.html",
  production_execution_queue: "../shared/production-execution-queue.html",
  view_log: "../shared/view-logs.html",
  view_logs: "../shared/view-logs.html",
  "view-logs": "../shared/view-logs.html",
  etl_monitor: "../shared/operations-monitor.html",
  etl_control: "../shared/operations-control.html",
  "operations-monitor": "../shared/operations-monitor.html",
  "operations-control": "../shared/operations-control.html",
  hub_admin: "./admin.html",
  "admin-console": "./admin.html",
});

const SECTION_ORDER = Object.freeze({
  "Work Log": 10,
  "Planning Workspace": 20,
  "MRP & Procurement": 30,
  "Inventory & Sales Analytics": 40,
  "Product & Reference Master": 50,
  "Plant & Assets": 60,
  "BMR & Production Records": 70,
  SOPs: 80,
  "System & Integrations": 90,
  Administration: 100,
});

const MODULE_META = Object.freeze({
  "fill-planner": { section: "System & Integrations", order: 30 },
  "plant-occupancy": { section: "MRP & Procurement", order: 95 },
  "stock-checker": { section: "System & Integrations", order: 40 },
  "wip-stock": { section: "Inventory & Sales Analytics", order: 120 },
  "fg-bulk-stock": { section: "Inventory & Sales Analytics", order: 130 },
  "bottled-stock": { section: "Inventory & Sales Analytics", order: 140 },
  "sales-data-viewer": {
    section: "Inventory & Sales Analytics",
    order: 110,
  },
  "bmr-card-not-initiated": {
    section: "Inventory & Sales Analytics",
    order: 150,
  },
  "stock-purchase-explorer": {
    section: "Inventory & Sales Analytics",
    order: 80,
  },
  "fg-transfer-reconciliation": {
    section: "Inventory & Sales Analytics",
    order: 90,
  },
  "production-execution-queue": {
    section: "MRP & Procurement",
    order: 50,
  },
  "view-logs": { section: "Work Log", order: 40 },
  "operations-monitor": { section: "System & Integrations", order: 10 },
  "operations-control": { section: "System & Integrations", order: 20 },
  "admin-console": { section: "Administration", order: 10 },
});

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

function getFallbackSection(moduleKey) {
  return MODULE_META[moduleKey]?.section || "Other";
}

function getFallbackOrder(moduleKey) {
  return MODULE_META[moduleKey]?.order ?? 999;
}

function getSectionSort(sectionLabel) {
  return SECTION_ORDER[sectionLabel] ?? 999;
}

function sortByCuration(a, b) {
  const sectionDelta = (a.sectionSort ?? 999) - (b.sectionSort ?? 999);
  if (sectionDelta !== 0) return sectionDelta;

  const orderDelta = (a.order ?? 999) - (b.order ?? 999);
  if (orderDelta !== 0) return orderDelta;

  return (a.label || "").localeCompare(b.label || "");
}

async function isHubAdmin(userId) {
  if (!userId) return false;
  try {
    const perms = await getUserPermissions(userId);
    if (!perms) return false;
    return perms.some(
      (perm) => perm && perm.target === "module:admin-console" && perm.can_view,
    );
  } catch (e) {
    console.warn("Admin check failed:", e);
    return false;
  }
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

  const bySection = {};
  visible
    .map((utility) => ({
      ...utility,
      sectionLabel:
        utility.sectionLabel || getFallbackSection(utility.moduleKey),
      sectionSort:
        utility.sectionSort ??
        getSectionSort(
          utility.sectionLabel || getFallbackSection(utility.moduleKey),
        ),
      order: utility.order ?? getFallbackOrder(utility.moduleKey),
      accessLevel: accessMap[utility.id] || "none",
    }))
    .forEach((utility) => {
      (bySection[utility.sectionLabel] ||= []).push(utility);
    });

  const sections = Object.keys(bySection).sort(
    (left, right) => getSectionSort(left) - getSectionSort(right),
  );

  let html = "";
  sections.forEach((sectionLabel) => {
    const list = bySection[sectionLabel].sort(sortByCuration);
    if (!list.length) return;

    html += `
      <div class="hub-section">
        <h3 class="hub-section-title">${safeText(sectionLabel)}</h3>
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
  try {
    const registryRows = await loadClientModuleRegistry("pwa");
    if (registryRows.length) {
      const mapped = registryRows.map((row) => {
        const sectionLabel =
          row.sectionLabel || getFallbackSection(row.moduleKey);
        return {
          id: row.moduleKey,
          key: row.moduleKey,
          moduleKey: row.moduleKey,
          label: row.label,
          description: row.description || "",
          href: row.routePath || "#",
          sectionLabel,
          sectionSort: getSectionSort(sectionLabel),
          order: row.sortOrder ?? getFallbackOrder(row.moduleKey),
          minNavMode: row.minNavMode || "view",
        };
      });
      return mapped;
    }
  } catch (error) {
    console.debug("loadUtilities registry fallback", error);
  }

  const { data, error } = await supabase
    .from("hub_utilities")
    .select("id, key, label, description");

  if (!error && Array.isArray(data)) {
    const mapped = data.map((row) => {
      const moduleKey = normalizeModuleKey(row.key);
      const sectionLabel = getFallbackSection(moduleKey);
      return {
        id: String(row.id),
        key: row.key,
        moduleKey,
        label: row.label,
        description: row.description || "",
        href: LEGACY_UTIL_URLS[row.key] || "#",
        sectionLabel,
        sectionSort: getSectionSort(sectionLabel),
        order: getFallbackOrder(moduleKey),
        minNavMode: "view",
      };
    });
    return mapped;
  }

  const fallbackUtilities = [
    {
      id: "fill-planner",
      key: "fill_planner",
      moduleKey: "fill-planner",
      label: "Fill Planner",
      description:
        "Plan fills from bulk with emergency SKU deductions + MOS context.",
      href: LEGACY_UTIL_URLS.fill_planner,
      sectionLabel: "Planning & Operations",
      sectionSort: getSectionSort("Planning & Operations"),
      order: 10,
      minNavMode: "view",
    },
    {
      id: "stock-checker",
      key: "stock_checker",
      moduleKey: "stock-checker",
      label: "Stock Checker",
      description:
        "Quick search with filters and CSV export for stock/forecast/MOS.",
      href: LEGACY_UTIL_URLS.stock_checker,
      sectionLabel: "Inventory & Sales Analytics",
      sectionSort: getSectionSort("Inventory & Sales Analytics"),
      order: 10,
      minNavMode: "view",
    },
  ];

  return fallbackUtilities;
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
  } catch {
    if (elRoot) {
      elRoot.innerHTML = renderMessageCard("Loading…", "Preparing your tools.");
    }
    setBusy(false);
    return;
  }

  const admin = await isHubAdmin(session?.user?.id);
  const visibleUtilities = admin
    ? utilities
    : utilities.filter((utility) => utility.moduleKey !== "admin-console");

  const visibleIds = new Set(visibleUtilities.map((utility) => utility.id));
  const prunedAccessMap = {};
  Object.entries(accessMap).forEach(([id, level]) => {
    if (visibleIds.has(id)) prunedAccessMap[id] = level;
  });

  if (elRoot) {
    elRoot.innerHTML = renderUtilitiesSectioned(
      visibleUtilities,
      prunedAccessMap,
    );
    elRoot.classList.remove("hub-grid");
    elRoot.classList.add("hub-root-sectioned");
  }

  const hasVisible = visibleUtilities.some(
    (utility) => (prunedAccessMap[utility.id] || "none") !== "none",
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
