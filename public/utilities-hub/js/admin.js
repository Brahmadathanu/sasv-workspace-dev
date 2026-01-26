/**
 * Canonical Admin v2 - Unified Access Control & Monitoring
 * Provides comprehensive user permission management with audit trail
 */

/* global supabase, Platform */

let supabaseClient = null;
let adminUser = null;
let monitorRows = [];
let auditRows = [];
let targetAccessRows = [];
let targetAccessTargets = [];

// Debug configuration
const DEBUG = true; // set false to silence logs in production
const DEBUG_DETAIL = false; // set true to dump raw objects

// Init state for summary reporting
const initState = {
  startedAt: performance.now(),
  supabaseSource: "",
  userEmail: "",
  hasSession: false,
  isAdmin: false,
  targetsCount: 0,
  monitorLoaded: false,
  auditLoaded: false,
  errors: [],
};

// Logger helpers
function logInfo(msg, obj) {
  if (!DEBUG) return;
  console.info(`[Admin] ${msg}`);
  if (DEBUG_DETAIL && obj) console.info(obj);
}
function logWarn(msg, obj) {
  if (!DEBUG) return;
  console.warn(`[Admin] ${msg}`);
  if (DEBUG_DETAIL && obj) console.warn(obj);
}
function logError(msg, obj) {
  console.error(`[Admin] ${msg}`);
  if (obj) console.error(obj);
}

// Fetch email suggestions via RPC
async function fetchEmailSuggestions(q, limit = 20) {
  try {
    const { data, error } = await supabaseClient.rpc("admin_user_suggest", {
      p_query: q,
      limit_count: limit,
    });
    if (error) {
      logWarn(
        "admin_user_suggest RPC failed",
        error && error.message ? error.message : error,
      );
      return null;
    }
    return data || null;
  } catch (e) {
    logWarn("admin_user_suggest exception", e && e.message ? e.message : e);
    return null;
  }
}

// Simple debounce helper
function debounce(fn, wait) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// Initialize admin interface
document.addEventListener("DOMContentLoaded", async () => {
  await initializeAdmin();
});

async function initializeAdmin() {
  try {
    // Load Supabase client
    await loadSupabaseClient();

    // Verify admin access
    const hasAccess = await verifyAdminAccess();
    if (!hasAccess) {
      showAccessDenied();
      return;
    }

    // Load admin data
    await loadAdminInterface();

    // Setup event listeners
    setupEventListeners();

    // consolidated init summary
    initState.endedAt = performance.now();
    logInfo(
      `Canonical Admin ready — ${initState.userEmail || "(unknown)"} — admin=${initState.isAdmin}`,
    );
    logInfo(`Supabase client: ${initState.supabaseSource}`);
    logInfo(`Session: ${initState.hasSession ? "OK" : "NONE"}`);
    logInfo(`Permissions targets: ${initState.targetsCount}`);
    logInfo(`Monitor loaded: ${initState.monitorLoaded ? "OK" : "FAILED"}`);
    logInfo(`Audit loaded: ${initState.auditLoaded ? "OK" : "FAILED"}`);
    if (initState.errors && initState.errors.length > 0) {
      logWarn("Errors during init", initState.errors);
    }
    logInfo("Canonical Admin v2 initialized successfully");
  } catch (error) {
    logError("Failed to initialize admin:", error);
    showError("Failed to initialize admin interface");
  }
}

async function loadSupabaseClient() {
  // First, try to use the global supabase client from Electron app
  if (typeof window.supabase !== "undefined") {
    supabaseClient = window.supabase;
    initState.supabaseSource = "electron:window.supabase";
    logInfo("Using global supabase client from Electron app");
    return;
  }

  // Try to import the shared client used by the PWA if available
  try {
    const m = await import(
      new URL("../../shared/js/supabaseClient.js", import.meta.url)
    );
    if (m && m.supabase) {
      supabaseClient = m.supabase;
      // expose for other modules and for consistency
      window.supabase = supabaseClient;
      initState.supabaseSource =
        "shared:import ../../shared/js/supabaseClient.js";
      logInfo(
        "Loaded shared supabase client via dynamic import (import.meta.url)",
      );
      return;
    }
  } catch (e) {
    // not available in this context; continue to other fallbacks
    logWarn("Shared supabase client import failed:", e && e.message);
  }
  // PWA fallback - create our own client as last resort
  initState.supabaseSource = "fallback:cdn createClient";
  logInfo("Creating new supabase client (fallback)");
  if (typeof supabase === "undefined") {
    await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
  }

  // NOTE: fallback URL/key only used when shared config not available.
  const supabaseUrl = "https://qhmoqtxpeasamtlxaoak.supabase.co";
  const supabaseKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFobW9xdHhwZWFzYW10bHhhb2FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMzc0MDMsImV4cCI6MjA3NDYxMzQwM30.jCGzy4y_-35wEBfvbRABy56mAjO6dr6Tti-aODiwDs4";

  supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
}

async function verifyAdminAccess() {
  try {
    logInfo("Verifying admin access with client");

    const { data: session } = await supabaseClient.auth.getSession();
    if (session && session.session && session.session.user) {
      initState.hasSession = true;
    } else {
      initState.hasSession = false;
    }

    if (!session?.session?.user) {
      logWarn("No authenticated session found");
      return false;
    }

    adminUser = session.session.user;
    initState.userEmail = adminUser.email || "";
    logInfo(`Admin user: ${initState.userEmail}`);

    // Get user permissions via canonical RPC
    const { data: permissions, error } = await supabaseClient.rpc(
      "get_user_permissions",
      { p_user_id: adminUser.id },
    );

    if (error) {
      logError("Error fetching permissions:", error);
      initState.errors.push(
        String(error && error.message ? error.message : error),
      );
      return false;
    }

    if (Array.isArray(permissions)) {
      initState.targetsCount = permissions.length;
      if (DEBUG_DETAIL) logInfo("Permissions RPC result:", permissions);
    }

    // Check for Admin Console module access
    // NOTE: permission target key is `module:admin-console`
    const hasAdminAccess = permissions.some(
      (perm) =>
        perm.target === "module:admin-console" && perm.can_view === true,
    );

    initState.isAdmin = !!hasAdminAccess;
    logInfo(`Has admin access: ${hasAdminAccess}`);

    if (hasAdminAccess) return true;
    logWarn("User does not have Admin Console module access");
    return false;
  } catch (error) {
    logError("Error verifying admin access:", error);
    return false;
  }
}

function showAccessDenied() {
  const guard = document.getElementById("admin-guard");
  const tabs = document.querySelector("nav.tabs");
  const panels = document.querySelectorAll(".panel");

  guard.style.display = "block";
  tabs.style.display = "none";
  panels.forEach((panel) => (panel.style.display = "none"));
}

async function loadAdminInterface() {
  // Load available utilities/roles for dropdown
  await loadUtilityOptions();

  // Load initial data for each tab
  await loadMonitorData();
  await loadAuditData();
}

async function loadUtilityOptions() {
  try {
    // Load assignable items from permission_targets registry
    const { data: rows, error } = await supabaseClient
      .from("permission_targets")
      .select("key,kind,label,sort_order,is_assignable")
      .eq("is_assignable", true)
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("key", { ascending: true });

    if (error) throw error;

    const grantUtilitySelect = document.getElementById("grant-utility");
    grantUtilitySelect.innerHTML =
      '<option value="">Select Module/Role...</option>';

    // Exclude the Admin Console target itself from the grant dropdown.
    if ((rows || []).some((r) => r.key === "module:admin-console")) {
      logWarn("Permission target 'module:admin-console' present");
    }
    const modules = rows.filter(
      (r) => r.kind === "module" && r.key !== "module:admin-console",
    );
    const roles = rows.filter((r) => r.kind === "role");

    if (modules.length > 0) {
      const group = document.createElement("optgroup");
      group.label = "Modules";
      modules.forEach((m) => {
        const option = document.createElement("option");
        option.value = m.key;
        option.textContent = m.label || m.key;
        group.appendChild(option);
      });
      grantUtilitySelect.appendChild(group);
    }

    if (roles.length > 0) {
      const group = document.createElement("optgroup");
      group.label = "Roles";
      roles.forEach((r) => {
        const option = document.createElement("option");
        option.value = r.key;
        option.textContent = r.label || r.key;
        group.appendChild(option);
      });
      grantUtilitySelect.appendChild(group);
    }
    // Cache permission_targets for reverse lookup and populate target lookup select
    try {
      targetAccessTargets = rows || [];
      const targetSelect = document.getElementById("target-lookup-select");
      if (targetSelect) {
        // reset
        targetSelect.innerHTML =
          '<option value="">Select Module/Role…</option>';
        // Exclude the Admin Console target from the target lookup
        const mods = targetAccessTargets.filter(
          (r) => r.kind === "module" && r.key !== "module:admin-console",
        );
        const rls = targetAccessTargets.filter((r) => r.kind === "role");
        if (mods.length > 0) {
          const g = document.createElement("optgroup");
          g.label = "Modules (Screens)";
          mods.forEach((m) => {
            const o = document.createElement("option");
            o.value = m.key;
            o.textContent = m.label || m.key;
            g.appendChild(o);
          });
          targetSelect.appendChild(g);
        }
        if (rls.length > 0) {
          const g = document.createElement("optgroup");
          g.label = "Roles (Capability Grants)";
          rls.forEach((r) => {
            const o = document.createElement("option");
            o.value = r.key;
            o.textContent = r.label || r.key;
            g.appendChild(o);
          });
          targetSelect.appendChild(g);
        }
      }
    } catch (e) {
      logWarn("Failed to populate target lookup select", e && e.message);
    }
  } catch (error) {
    logError("Error loading utilities:", error);
  }
}

async function loadMonitorData() {
  const statsEl = document.getElementById("monitor-stats");
  const resultsEl = document.getElementById("monitor-results");
  try {
    // Use lightweight RPC that returns recent permissions with email + label
    const { data, error } = await supabaseClient.rpc(
      "admin_recent_permissions",
      { limit_count: 100 },
    );
    if (error) throw error;
    monitorRows = data || [];
    const uniqueUsers = monitorRows
      ? new Set(monitorRows.map((r) => r.user_id)).size
      : 0;
    if (statsEl)
      statsEl.textContent = `${monitorRows.length || 0} recent permissions across ${uniqueUsers} users`;
    renderMonitorTable(monitorRows);
    initState.monitorLoaded = true;
    logInfo(`Loaded monitor rows: ${monitorRows.length || 0}`);
  } catch (error) {
    logError("Error loading monitor data:", error);
    if (statsEl) statsEl.textContent = "Error loading stats";
    if (resultsEl)
      resultsEl.innerHTML =
        '<div class="loading">Error loading monitor data</div>';
  }
}

function renderMonitorTable(rows) {
  const resultsEl = document.getElementById("monitor-results");
  if (!rows || rows.length === 0)
    return (resultsEl.innerHTML = "<p>No recent permissions.</p>");
  let html = `
    <table>
      <thead>
        <tr>
          <th>User ID</th>
          <th>Email</th>
          <th>Target</th>
          <th>Label</th>
          <th>Access</th>
          <th>Updated</th>
        </tr>
      </thead>
      <tbody>
  `;
  rows.forEach((r) => {
    const access =
      r.can_edit || r.level === "use"
        ? "Full"
        : r.can_view || r.level === "view"
          ? "View"
          : "None";
    const cls =
      access === "Full" ? "active" : access === "View" ? "pending" : "denied";
    html += `
      <tr>
        <td title="${r.user_id || ""}">${r.user_id ? r.user_id.substring(0, 8) + "..." : "-"}</td>
        <td>${r.email || "-"}</td>
        <td>${r.target || r.utility_key || "-"}</td>
        <td>${r.label || r.utility_label || "-"}</td>
        <td><span class="status ${cls}">${access}</span></td>
        <td>${formatDate(r.updated_at || r.granted_at)}</td>
      </tr>
    `;
  });
  html += `</tbody></table>`;
  resultsEl.innerHTML = html;
}

async function loadAuditData() {
  try {
    const { data, error } = await supabaseClient.rpc("get_admin_audit_logs", {
      limit_count: 100,
    });
    if (error) throw error;
    auditRows = data || [];
    renderAuditTable(auditRows);
    initState.auditLoaded = true;
    logInfo(`Loaded audit rows: ${auditRows.length || 0}`);
  } catch (error) {
    logError("Error loading audit data:", error);
    document.getElementById("audit-log-container").innerHTML =
      '<div class="loading">Error loading audit logs</div>';
  }
}

function renderAuditTable(rows) {
  const container = document.getElementById("audit-log-container");
  if (!rows || rows.length === 0)
    return (container.innerHTML =
      '<div class="loading">No audit logs found.</div>');
  let html = `
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th>Action</th>
          <th>Admin Email</th>
          <th>Target Email</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
  `;
  rows.forEach((r) => {
    html += `
      <tr>
        <td>${formatDateTime(r.created_at)}</td>
        <td>${r.action_type}</td>
        <td>${r.admin_email || (r.admin_user_id ? r.admin_user_id.substring(0, 8) + "..." : "-")}</td>
        <td>${r.target_email || (r.target_user_id ? r.target_user_id.substring(0, 8) + "..." : "-")}</td>
        <td><small>${r.details || ""}</small></td>
      </tr>
    `;
  });
  html += `</tbody></table>`;
  container.innerHTML = html;
}

// -------------------------
// Target-based access lookup
// -------------------------

async function handleTargetLookup() {
  const select = document.getElementById("target-lookup-select");
  const statsEl = document.getElementById("target-lookup-stats");
  const btn = document.getElementById("targetLookupBtn");
  if (!select) return;
  const targetKey = select.value;
  if (!targetKey) {
    showError("Select a module/role");
    return;
  }
  const original = btn ? btn.textContent : "Load Users";
  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Loading…";
    }

    const { data, error } = await supabaseClient.rpc("admin_users_for_target", {
      p_target_key: targetKey,
      limit_count: 500,
    });
    if (error) {
      logWarn("admin_users_for_target RPC failed", error);
      showError("Failed to load users for target");
      return;
    }
    targetAccessRows = data || [];
    if (statsEl) {
      statsEl.textContent = `${targetAccessRows.length} users`;
      statsEl.classList.toggle("hidden", !targetAccessRows.length);
    }
    renderTargetAccessTable(targetAccessRows, targetKey);
  } catch (e) {
    logError("Error loading target access", e);
    showError("Failed to load users for target");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = original;
    }
  }
}

function renderTargetAccessTable(rows, targetKey) {
  const container = document.getElementById("target-access-results");
  if (!container) return;
  if (!rows || rows.length === 0)
    return (container.innerHTML =
      "<p>No users have access to this target.</p>");

  let html = `
    <table>
      <thead>
        <tr>
          <th>Email</th>
          <th>User ID</th>
          <th>Level</th>
          <th>Updated</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  rows.forEach((r) => {
    const level = r.level || (r.can_edit ? "use" : "view");
    const updated = formatDate(r.updated_at || r.granted_at);
    const shortId = r.user_id ? r.user_id.substring(0, 8) + "..." : "-";
    const emailSafe = r.email || "";
    const userId = r.user_id || "";
    html += `
      <tr>
        <td>${escapeHtml(emailSafe)}</td>
        <td title="${userId}">${shortId}</td>
        <td>
          <select class="level-select" data-user-id="${userId}" data-email="${escapeAttr(
            emailSafe,
          )}" data-target="${escapeAttr(targetKey)}">
            <option value="view" ${level === "view" ? "selected" : ""}>View</option>
            <option value="use" ${level === "use" ? "selected" : ""}>Full Use</option>
          </select>
        </td>
        <td>${updated}</td>
        <td>
          <button class="button primary apply-level-btn" data-email="${escapeAttr(
            emailSafe,
          )}" data-target="${escapeAttr(targetKey)}">Apply</button>
          <button class="button danger revoke-target-btn" data-user-id="${userId}" data-target="${escapeAttr(
            targetKey,
          )}">Revoke</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

function applyTargetAccessFilter() {
  const qEl = document.getElementById("target-user-search");
  const statsEl = document.getElementById("target-lookup-stats");
  if (!qEl) return;
  const q = (qEl.value || "").toLowerCase().trim();
  if (!q) {
    renderTargetAccessTable(
      targetAccessRows,
      document.getElementById("target-lookup-select")?.value,
    );
    if (statsEl) {
      statsEl.textContent = `${targetAccessRows.length} users`;
      statsEl.classList.toggle("hidden", !targetAccessRows.length);
    }
    return;
  }
  const filtered = (targetAccessRows || []).filter(
    (r) =>
      (r.email || "").toLowerCase().includes(q) ||
      (r.user_id || "").toLowerCase().includes(q),
  );
  renderTargetAccessTable(
    filtered,
    document.getElementById("target-lookup-select")?.value,
  );
  if (statsEl) {
    statsEl.textContent = `${filtered.length} / ${targetAccessRows.length} users`;
    statsEl.classList.toggle("hidden", !targetAccessRows.length);
  }
}

// small helpers to avoid XSS in inserted HTML
function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(
    /[&<>"]+/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
      })[c],
  );
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function setupEventListeners() {
  // Tab switching
  document.querySelectorAll("nav.tabs button").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  // Grant access functionality
  document
    .getElementById("grantBtn")
    .addEventListener("click", handleGrantAccess);

  // Lookup functionality
  document
    .getElementById("lookupBtn")
    .addEventListener("click", handleLookupUser);

  // Refresh buttons
  document
    .getElementById("refreshMonitor")
    .addEventListener("click", loadMonitorData);
  document
    .getElementById("refreshAudit")
    .addEventListener("click", loadAuditData);

  // Platform-aware HOME button
  document.getElementById("homeBtn")?.addEventListener("click", () => {
    try {
      if (typeof window.Platform !== "undefined" && window.Platform.goHome) {
        Platform.goHome();
      } else if (typeof window.electronAPI !== "undefined") {
        // Electron fallback
        window.location.href = "../../index.html";
      } else {
        // PWA fallback - go to utilities hub
        window.location.href = "/utilities-hub/";
      }
    } catch (e) {
      logWarn("Home redirect failed", e);
      window.location.href = "../../index.html";
    }
  });

  // Enter key support on inputs
  document.getElementById("grant-email").addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleGrantAccess();
  });

  document.getElementById("lookup-email").addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleLookupUser();
  });

  // Typeahead for user emails (shared datalist)
  const userInputIds = ["grant-email", "lookup-email"];
  const suggest = debounce(async (q) => {
    try {
      // allow empty query on focus to preload suggestions
      // If q is empty, fetch recent users (RPC supports empty query)
      const limit = q ? (q.length === 1 ? 10 : 20) : 20;
      const data = await fetchEmailSuggestions(q, limit);
      if (!data || !Array.isArray(data) || data.length === 0) return;
      const dl = document.getElementById("userEmails");
      if (!dl) return;
      // Only replace list when we have results (don't wipe on empty)
      dl.innerHTML = "";
      (data || []).forEach((row) => {
        const opt = document.createElement("option");
        opt.value = row.email || row.user_email || "";
        dl.appendChild(opt);
      });
    } catch (err) {
      logWarn("User suggest failed:", err && err.message);
    }
  }, 250);

  userInputIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", (e) => suggest(e.target.value.trim()));
    // preload suggestions when the field receives focus so the datalist feels
    // like an ERP-style dropdown
    el.addEventListener("focus", () => suggest(""));
    // add minimal UX hint under the first email input if not present
    if (
      !el.nextElementSibling ||
      !el.nextElementSibling.classList ||
      !el.nextElementSibling.classList.contains("admin-email-hint")
    ) {
      const hint = document.createElement("div");
      hint.className = "admin-email-hint";
      hint.style.cssText = "margin-top:6px;font-size:12px;color:#6b7280";
      hint.textContent =
        "Start typing to search users; click field to see recent users.";
      el.parentNode.insertBefore(hint, el.nextSibling);
    }
  });

  // Monitor search filtering
  const monitorSearch = document.getElementById("monitor-search");
  if (monitorSearch) {
    monitorSearch.addEventListener(
      "input",
      debounce((e) => {
        const q = (e.target.value || "").toLowerCase().trim();
        if (!q) return renderMonitorTable(monitorRows);
        const filtered = monitorRows.filter(
          (r) =>
            (r.email || "").toLowerCase().includes(q) ||
            (r.user_id || "").toLowerCase().includes(q) ||
            (r.target || r.utility_key || "").toLowerCase().includes(q),
        );
        renderMonitorTable(filtered);
      }, 150),
    );
  }

  // Audit search + action filter
  const auditSearch = document.getElementById("audit-search");
  const auditFilter = document.getElementById("audit-filter");
  function applyAuditFilters() {
    const q = ((auditSearch && auditSearch.value) || "").toLowerCase().trim();
    const action = (auditFilter && auditFilter.value) || "";
    let filtered = auditRows || [];
    if (action)
      filtered = filtered.filter(
        (r) => (r.action_type || "").toLowerCase() === action,
      );
    if (q)
      filtered = filtered.filter(
        (r) =>
          (r.admin_email || "").toLowerCase().includes(q) ||
          (r.target_email || "").toLowerCase().includes(q) ||
          (r.details || "").toLowerCase().includes(q) ||
          (r.admin_user_id || "").toLowerCase().includes(q),
      );
    renderAuditTable(filtered);
  }
  if (auditSearch)
    auditSearch.addEventListener("input", debounce(applyAuditFilters, 150));
  if (auditFilter) auditFilter.addEventListener("change", applyAuditFilters);

  // Target lookup controls
  const targetLookupBtn = document.getElementById("targetLookupBtn");
  const targetSearch = document.getElementById("target-user-search");
  const targetSelect = document.getElementById("target-lookup-select");
  if (targetLookupBtn)
    targetLookupBtn.addEventListener("click", handleTargetLookup);
  if (targetSearch)
    targetSearch.addEventListener(
      "input",
      debounce(applyTargetAccessFilter, 150),
    );
  if (targetSelect) {
    targetSelect.addEventListener("change", (e) => {
      const sel = e.target;
      const label =
        sel.selectedOptions && sel.selectedOptions[0]
          ? sel.selectedOptions[0].textContent
          : "";
      const hint = document.getElementById("target-user-search");
      if (hint)
        hint.placeholder = label
          ? `Filter users for ${label}…`
          : "Filter by email or user id…";
    });
  }

  // Delegated click handler for apply/revoke buttons in target-access table
  const targetResults = document.getElementById("target-access-results");
  if (targetResults) {
    targetResults.addEventListener("click", async (ev) => {
      const applyBtn =
        ev.target.closest && ev.target.closest("button.apply-level-btn");
      const revokeBtn =
        ev.target.closest && ev.target.closest("button.revoke-target-btn");
      if (applyBtn) {
        const tr = applyBtn.closest("tr");
        const sel =
          tr && tr.querySelector && tr.querySelector("select.level-select");
        if (!sel) return;
        const level = sel.value;
        const email = applyBtn.dataset.email;
        const target = applyBtn.dataset.target;
        const orig = applyBtn.textContent;
        try {
          applyBtn.disabled = true;
          const { error } = await supabaseClient.rpc(
            "set_user_access_by_email_key",
            {
              p_email: email,
              p_utility_key: target,
              p_level: level,
            },
          );
          if (error) throw error;
          showSuccess(`Updated ${email} → ${level} for ${target}`);
          const currentFilter =
            document.getElementById("target-user-search")?.value || "";
          await handleTargetLookup();
          document.getElementById("target-user-search").value = currentFilter;
          applyTargetAccessFilter();
        } catch (e) {
          logError("Apply level failed", e);
          showError(e.message || "Failed to update access");
        } finally {
          applyBtn.disabled = false;
          applyBtn.textContent = orig;
        }
      }
      if (revokeBtn) {
        if (!confirm("Revoke access for this user?")) return;
        const userId = revokeBtn.dataset.userId;
        const target = revokeBtn.dataset.target;
        try {
          revokeBtn.disabled = true;
          const { error } = await supabaseClient.rpc("revoke_user_access", {
            p_user_id: userId,
            p_utility_key: target,
          });
          if (error) throw error;
          showSuccess(`Revoked ${target} for ${userId}`);
          const currentFilter =
            document.getElementById("target-user-search")?.value || "";
          await handleTargetLookup();
          document.getElementById("target-user-search").value = currentFilter;
          applyTargetAccessFilter();
        } catch (e) {
          logError("Revoke target failed", e);
          showError(e.message || "Failed to revoke access");
        } finally {
          revokeBtn.disabled = false;
        }
      }
    });
  }
}

function switchTab(tabId) {
  // Update tab buttons
  document.querySelectorAll("nav.tabs button").forEach((btn) => {
    btn.classList.remove("active");
    btn.setAttribute("aria-selected", "false");
  });
  document.querySelector(`[data-tab="${tabId}"]`).classList.add("active");
  document
    .querySelector(`[data-tab="${tabId}"]`)
    .setAttribute("aria-selected", "true");

  // Update panels
  document
    .querySelectorAll(".panel")
    .forEach((panel) => panel.classList.remove("active"));
  document.getElementById(`panel-${tabId}`).classList.add("active");

  // ERP-friendly: refresh data when monitor/audit tabs are activated
  try {
    if (tabId === "monitor") loadMonitorData();
    if (tabId === "audit") loadAuditData();
  } catch (err) {
    logWarn("Tab refresh failed", err && err.message);
  }
}

async function handleGrantAccess() {
  const email = document.getElementById("grant-email").value.trim();
  const utility = document.getElementById("grant-utility").value;
  const level = document.getElementById("grant-level").value;

  if (!email || !utility || !level) {
    showError("Please fill all required fields");
    return;
  }

  // Validate email format
  if (!isValidEmail(email)) {
    showError("Please enter a valid email address");
    return;
  }

  const grantBtn = document.getElementById("grantBtn");
  const originalLabel = grantBtn.textContent;
  try {
    grantBtn.disabled = true;
    grantBtn.textContent = "Granting…";

    // targetKey is the full canonical key (module:... or role:...)
    const targetKey = utility;
    const selectedLabel = document.getElementById("grant-utility")
      .selectedOptions[0]
      ? document.getElementById("grant-utility").selectedOptions[0].textContent
      : targetKey;

    const { error } = await supabaseClient.rpc("set_user_access_by_email_key", {
      p_email: email,
      p_utility_key: targetKey,
      p_level: level,
    });

    if (error) throw error;

    // Clear form
    document.getElementById("grant-email").value = "";
    document.getElementById("grant-utility").selectedIndex = 0;
    document.getElementById("grant-level").selectedIndex = 0;
    document.getElementById("grant-reason").value = "";

    showSuccess(`Granted ${level} to ${email} for ${selectedLabel}`);

    // Refresh monitor if on that tab
    if (document.getElementById("panel-monitor").classList.contains("active")) {
      await loadMonitorData();
    }
  } catch (error) {
    logError("Error granting access", error);
    showError(error.message || "Failed to grant access");
  } finally {
    grantBtn.disabled = false;
    grantBtn.textContent = originalLabel;
  }
}

async function handleLookupUser() {
  const email = document.getElementById("lookup-email").value.trim();
  const resultsEl = document.getElementById("user-access-results");

  if (!email) {
    showError("Please enter an email address");
    return;
  }

  if (!isValidEmail(email)) {
    showError("Please enter a valid email address");
    return;
  }

  try {
    resultsEl.innerHTML =
      '<div class="loading">Looking up user permissions...</div>';

    // Use RPC to list access by email (avoids direct auth.users REST access)
    const { data: accessRows, error: listError } = await supabaseClient.rpc(
      "list_hub_access_by_email",
      { p_email: email },
    );

    if (listError) {
      logWarn("Error listing access by email", listError);
      resultsEl.innerHTML = '<p class="alert error">Error looking up user</p>';
      return;
    }

    if (!accessRows || accessRows.length === 0) {
      resultsEl.innerHTML = "<p>No permissions found for this user.</p>";
      return;
    }

    // Store email on container for later reference
    resultsEl.dataset.email = email;

    // Build table rows with dataset attributes and revoke buttons (no inline onclick)
    const rowsHtml = [];
    rowsHtml.push(`<h4>Access for ${email}</h4>`);
    rowsHtml.push(
      "<table><thead><tr><th>Permission</th><th>Access Level</th><th>Updated</th><th>Action</th></tr></thead><tbody>",
    );

    accessRows.forEach((r) => {
      const target = r.utility_key || r.utility_id || r.target || "";
      const level =
        r.level || (r.can_edit ? "use" : r.can_view ? "view" : "none");
      const updated = r.updated_at || r.granted_at || "";
      rowsHtml.push(`
        <tr>
          <td><strong>${target}</strong></td>
          <td><span class="status ${level === "use" ? "active" : level === "view" ? "pending" : "denied"}">${level === "use" ? "Full Use" : level === "view" ? "View Only" : "None"}</span></td>
          <td>${formatDate(updated)}</td>
          <td><button class="button danger revoke-btn" data-user-id="${r.user_id}" data-target="${target}">Revoke</button></td>
        </tr>
      `);
    });

    rowsHtml.push("</tbody></table>");
    resultsEl.innerHTML = rowsHtml.join("\n");
  } catch (error) {
    logError("Error looking up user", error);
    resultsEl.innerHTML = '<p class="alert error">Error looking up user</p>';
  }
}

// legacy UI generator removed — using RPC-backed lookup rendering instead

// Revoke handler via event delegation on the results container
document.addEventListener("click", async (ev) => {
  const btn = ev.target.closest && ev.target.closest("button.revoke-btn");
  if (!btn) return;
  const userId = btn.dataset.userId;
  const target = btn.dataset.target;
  const container = document.getElementById("user-access-results");
  const email = container ? container.dataset.email : "";

  if (!confirm(`Revoke ${target} access for ${email || userId}?`)) return;

  try {
    btn.disabled = true;
    const { error } = await supabaseClient.rpc("revoke_user_access", {
      p_user_id: userId,
      p_utility_key: target,
    });
    btn.disabled = false;
    if (error) throw error;

    // Refresh lookup
    await handleLookupUser();
    showSuccess(`Revoked ${target} access for ${email || userId}`);
  } catch (err) {
    logError("Revoke failed", err);
    showError(err.message || "Failed to revoke access");
    btn.disabled = false;
  }
});

// server RPCs already handle audit logging; client-side log helper removed

// Utility functions
// formatUtilityName removed — labels now come from `permission_targets` registry

function formatDate(dateString) {
  if (!dateString) return "-";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString();
}

function formatDateTime(dateString) {
  if (!dateString) return "-";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showSuccess(message) {
  const area = document.getElementById("toast-area");
  if (!area) return;
  // remove existing info toasts in area only
  area.querySelectorAll(".alert.info").forEach((n) => n.remove());
  const alert = document.createElement("div");
  alert.className = "alert info";
  alert.textContent = message;
  area.appendChild(alert);
  setTimeout(() => alert.remove(), 5000);
}

function showError(message) {
  const area = document.getElementById("toast-area");
  if (!area) return;
  // remove existing error toasts in area only
  area.querySelectorAll(".alert.error").forEach((n) => n.remove());
  const alert = document.createElement("div");
  alert.className = "alert error";
  alert.textContent = message;
  area.appendChild(alert);
  setTimeout(() => alert.remove(), 8000);
}

async function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
