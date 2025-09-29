// public/shared/js/etl-monitor.js
import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

/* ---------------------------- small helpers ---------------------------- */
const $ = (id) => document.getElementById(id);
const dash = (v = "—") => (v == null || v === "" ? "—" : v);
const escapeHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const asDateTime = (iso) => {
  try {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    console.error("asDateTime failed:", e);
    return "—";
  }
};
const asPercent = (v) => {
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  const alreadyPct = n > 1.0;
  return `${(alreadyPct ? n : n * 100).toFixed(1)}%`;
};

/** Ensure a status pill exists and set it */
function setStatus(text, kind = "ok") {
  let el = $("etl-status");
  if (!el) {
    const bar = document.querySelector(".toolbar");
    if (bar) {
      el = document.createElement("span");
      el.id = "etl-status";
      el.className = "dim";
      el.style.marginLeft = "auto";
      el.style.padding = "4px 8px";
      el.style.borderRadius = "8px";
      el.style.border = "1px solid #e5e7eb";
      bar.appendChild(el);
    }
  }
  if (!el) return;
  el.textContent = text || "";
  el.dataset.kind = kind; // ok | warn | error
}

function showLoadingOnce(tbody, colSpan) {
  if (!tbody || window.__etlHadFirstPaint) return;
  tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center;color:#666">Loading…</td></tr>`;
}

/* ---------------------------- global poll guards ----------------------- */
let isPolling = false;
window.__etlHadFirstPaint = false; // first successful render
let lastGoodAt = null;

/* ---------------------------- Heartbeat card --------------------------- */
async function updateHeartbeat() {
  const elHost = $("hb-host");
  const elVer = $("hb-ver");
  const elTime = $("hb-time");
  const elErr = $("hb-err");

  const { data, error } = await supabase
    .from("v_health_last_heartbeat")
    .select("hostname, agent_ver, last_seen_at, last_error")
    .limit(1);

  if (error) throw error;

  const row = (data && data[0]) || {};
  if (elHost) elHost.textContent = dash(row.hostname);
  if (elVer) elVer.textContent = dash(row.agent_ver);
  if (elTime) elTime.textContent = asDateTime(row.last_seen_at);
  if (elErr) elErr.textContent = row.last_error ? String(row.last_error) : "—";
}

/* ------------------------ Stock snapshot summary ----------------------- */
async function updateSnapshotToday() {
  const elDate = $("snap-date");
  const elRows = $("snap-rows");
  const elGdn = $("snap-godowns");

  const { data, error } = await supabase
    .from("v_health_snapshot_today")
    .select("as_of_date, rows_today, godowns_with_rows")
    .limit(1);

  if (error) throw error;

  const r = (data && data[0]) || {};
  if (elDate) elDate.textContent = dash(r.as_of_date);
  if (elRows)
    elRows.textContent =
      typeof r.rows_today === "number"
        ? r.rows_today.toLocaleString("en-IN")
        : "—";
  if (elGdn)
    elGdn.textContent =
      typeof r.godowns_with_rows === "number" ? r.godowns_with_rows : "—";
}

/* ------------------------- Mapping / resolvability ---------------------- */
async function updateMappingToday() {
  const elPct = $("map-pct");
  const elTot = $("map-total");
  const elSku = $("map-miss-sku");
  const elGdn = $("map-miss-gdn");

  const { data, error } = await supabase
    .from("v_health_mapping_today")
    .select("pct_resolvable, total_rows, missing_sku_rows, missing_godown_rows")
    .limit(1);

  if (error) throw error;

  const r = (data && data[0]) || {};
  if (elPct) elPct.textContent = asPercent(r.pct_resolvable);
  if (elTot)
    elTot.textContent =
      typeof r.total_rows === "number"
        ? r.total_rows.toLocaleString("en-IN")
        : "—";
  if (elSku)
    elSku.textContent =
      typeof r.missing_sku_rows === "number"
        ? r.missing_sku_rows.toLocaleString("en-IN")
        : "—";
  if (elGdn)
    elGdn.textContent =
      typeof r.missing_godown_rows === "number"
        ? r.missing_godown_rows.toLocaleString("en-IN")
        : "—";
}

/* --------------------------- Job activity table ------------------------- */
async function updateActivity() {
  const tbody = $("act-body");
  if (!tbody) return;
  showLoadingOnce(tbody, 5);

  const { data, error } = await supabase
    .from("v_job_activity")
    .select("job_type, status, jobs, first_created, last_finished")
    .order("job_type", { ascending: true })
    .limit(50);

  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) {
    if (!window.__etlHadFirstPaint) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#666">No activity.</td></tr>`;
    }
    return;
  }

  tbody.innerHTML = rows
    .map((r) => {
      const created = r.first_created ? asDateTime(r.first_created) : "—";
      const finished = r.last_finished ? asDateTime(r.last_finished) : "—";
      const jobs =
        typeof r.jobs === "number" ? r.jobs.toLocaleString("en-IN") : "—";
      return `
        <tr>
          <td>${escapeHtml(r.job_type || "")}</td>
          <td>${escapeHtml(r.status || "")}</td>
          <td style="text-align:right">${jobs}</td>
          <td>${created}</td>
          <td>${finished}</td>
        </tr>`;
    })
    .join("");
}

async function updateActivityByReport() {
  const tbody = document.getElementById("act2-body");
  if (!tbody) return;

  if (!window.__etlHadFirstPaint) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#666">Loading…</td></tr>`;
  }

  try {
    const { data, error } = await supabase
      .from("v_job_activity_detailed")
      .select(
        "job_type, report_key, status, jobs, first_created, last_finished"
      )
      .order("job_type", { ascending: true })
      .order("report_key", { ascending: true });

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) {
      if (!window.__etlHadFirstPaint) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#666">No activity.</td></tr>`;
      }
      return;
    }

    tbody.innerHTML = rows
      .map((r) => {
        const created = r.first_created ? asDateTime(r.first_created) : "—";
        const finished = r.last_finished ? asDateTime(r.last_finished) : "—";
        const jobs =
          typeof r.jobs === "number" ? r.jobs.toLocaleString("en-IN") : "—";
        return `
        <tr>
          <td>${escapeHtml(r.job_type || "")}</td>
          <td>${escapeHtml(r.report_key || "")}</td>
          <td>${escapeHtml(r.status || "")}</td>
          <td style="text-align:right">${jobs}</td>
          <td>${created}</td>
          <td>${finished}</td>
        </tr>
      `;
      })
      .join("");
  } catch (e) {
    console.error("updateActivityByReport failed:", e);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#b91c1c">Failed to load activity.</td></tr>`;
  }
}

/* --------------------------- Forecast panels ---------------------------- */
async function updateForecastOverview() {
  const ids = {
    pairs: "fore-pairs",
    base: "fore-base",
    llt: "fore-llt",
    seasonal: "fore-season",
    neg: "fore-neg",
    oos: "fore-oos",
  };
  try {
    const { data, error } = await supabase
      .from("v_forecast_overview")
      .select(
        "pairs, rows_base_12m, rows_llt_12m, rows_seasonal_12m, negatives, out_of_season_rows"
      )
      .limit(1);

    if (error) throw error;

    const r = (data && data[0]) || {};
    $(ids.pairs).textContent = Number(r.pairs ?? 0).toLocaleString("en-IN");
    $(ids.base).textContent = Number(r.rows_base_12m ?? 0).toLocaleString(
      "en-IN"
    );
    $(ids.llt).textContent = Number(r.rows_llt_12m ?? 0).toLocaleString(
      "en-IN"
    );
    $(ids.seasonal).textContent = Number(
      r.rows_seasonal_12m ?? 0
    ).toLocaleString("en-IN");
    $(ids.neg).textContent = Number(r.negatives ?? 0).toLocaleString("en-IN");
    $(ids.oos).textContent = Number(r.out_of_season_rows ?? 0).toLocaleString(
      "en-IN"
    );
  } catch (e) {
    console.error("updateForecastOverview failed:", e);
  }
}

// Small retry loop for “empty until hard refresh”
async function fetchRecentRuns(maxTries = 3, delayMs = 600) {
  let attempt = 0;
  while (true) {
    const { data, error } = await supabase
      .from("v_forecast_runs_recent")
      .select(
        "id, as_of_date, status, created_at, closed_at, rows_base, rows_llt, rows_seasonal"
      )
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    if (rows.length > 0) return rows;

    attempt += 1;
    if (attempt >= maxTries) return rows;

    await new Promise((r) => setTimeout(r, delayMs));
  }
}

async function updateForecastRuns() {
  const tbody = document.getElementById("fc-runs-body");
  if (!tbody) return;
  showLoadingOnce(tbody, 8);

  try {
    const rows = await fetchRecentRuns(3, 700);
    tbody.innerHTML =
      rows
        .map(
          (r) => `
      <tr>
        <td>${r.id}</td>
        <td>${r.as_of_date ?? "—"}</td>
        <td>${r.status ?? "—"}</td>
        <td>${asDateTime(r.created_at)}</td>
        <td>${asDateTime(r.closed_at)}</td>
        <td style="text-align:right">${(r.rows_base ?? 0).toLocaleString(
          "en-IN"
        )}</td>
        <td style="text-align:right">${(r.rows_llt ?? 0).toLocaleString(
          "en-IN"
        )}</td>
        <td style="text-align:right">${(r.rows_seasonal ?? 0).toLocaleString(
          "en-IN"
        )}</td>
      </tr>`
        )
        .join("") || `<tr><td colspan="8" class="dim">No recent runs</td></tr>`;
  } catch (e) {
    console.error("updateForecastRuns failed:", e);
    tbody.innerHTML = `<tr><td colspan="8" class="dim">Runs unavailable</td></tr>`;
  }
}

/* ---------------------------- Refresh / Poll ---------------------------- */
async function refreshAll() {
  if (isPolling) return;
  isPolling = true;
  setStatus("Refreshing…", "ok");

  try {
    const needReport = !!document.getElementById("show-by-report")?.checked;
    await Promise.all([
      updateHeartbeat(),
      updateSnapshotToday(),
      updateMappingToday(),
      updateActivity(),
      needReport ? updateActivityByReport() : Promise.resolve(),
      updateForecastOverview(),
      updateForecastRuns(),
    ]);
    window.__etlHadFirstPaint = true;
    lastGoodAt = new Date();
    setStatus(
      `Updated ${lastGoodAt.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      "ok"
    );
  } catch (err) {
    console.warn("[ETL Monitor] refresh failed:", err);
    const when = lastGoodAt
      ? lastGoodAt.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "never";
    setStatus(
      `Network or query error • showing previous data (last good: ${when})`,
      "warn"
    );
  } finally {
    isPolling = false;
  }
}

function wireUI() {
  $("etl-refresh")?.addEventListener("click", () => refreshAll());
  $("homeBtn")?.addEventListener("click", () => Platform.goHome());

  const chk = document.getElementById("show-by-report");
  const byReport = document.getElementById("by-report");
  if (chk && byReport) {
    chk.addEventListener("change", () => {
      byReport.style.display = chk.checked ? "" : "none";
      refreshAll().catch((e) =>
        console.warn("refresh after toggle failed:", e)
      );
    });
  }

  // Re-run when window is refocused (helps Electron windows coming back)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshAll().catch((e) =>
        console.warn("refresh on visibilitychange failed:", e)
      );
    }
  });
}

/* --------------------------- Boot on DOM ready -------------------------- */
async function waitForSessionReady(timeoutMs = 3000) {
  try {
    const now = await supabase.auth.getSession();
    if (now?.data?.session?.user?.id) return now.data.session;
  } catch (e) {
    console.debug("getSession failed (ok to ignore):", e?.message || e);
  }
  return await new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(null);
      }
    }, timeoutMs);
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!done && session?.user?.id) {
        done = true;
        clearTimeout(timer);
        try {
          sub?.subscription?.unsubscribe();
        } catch (e) {
          console.debug("unsubscribe failed (safe):", e?.message || e);
        }
        resolve(session);
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  wireUI();

  try {
    await supabase.auth.refreshSession();
  } catch (e) {
    console.debug("refreshSession skipped:", e?.message || e);
  }

  // If your RLS needs a session, wait briefly; if not, we still proceed.
  await waitForSessionReady(2000);

  // Also refresh when a session *arrives later* (first load issue)
  const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
    if (session?.user?.id) {
      refreshAll().catch((e) =>
        console.warn("refresh on auth state change failed:", e)
      );
    }
  });

  // 1) Initial refresh
  await refreshAll().catch((e) => console.error("initial refresh failed:", e));

  // 2) Safety second refresh after a short delay (fixes “empty until hard refresh”)
  setTimeout(() => {
    refreshAll().catch((e) => console.warn("second refresh failed:", e));
  }, 1250);

  // 3) Light polling with jitter
  const BASE_MS = 60_000;
  setTimeout(() => {
    refreshAll().catch((e) => console.warn("poll refresh failed:", e));
    setInterval(
      () => refreshAll().catch((e) => console.warn("poll refresh failed:", e)),
      BASE_MS + Math.floor(Math.random() * 4000)
    );
  }, Math.floor(Math.random() * 800));

  // Clean up auth listener on unload (prevents duplicates if page hot-reloads)
  window.addEventListener("beforeunload", () => {
    try {
      sub?.subscription?.unsubscribe();
    } catch (e) {
      console.debug("unsubscribe cleanup failed (safe):", e?.message || e);
    }
  });
});
