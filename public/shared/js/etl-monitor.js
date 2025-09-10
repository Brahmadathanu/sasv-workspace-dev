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
    console.error("format datetime failed:", e);
    return "—";
  }
};
const asPercent = (v) => {
  if (v == null || Number.isNaN(v)) return "—";
  const n = Number(v);
  const isAlreadyPct = n > 1.0; // 97.3 means already percent
  return `${(isAlreadyPct ? n : n * 100).toFixed(1)}%`;
};

/** Ensure a status pill exists and set it */
function setStatus(text, kind = "ok") {
  let el = $("etl-status");
  if (!el) {
    // try to create one inside the .toolbar if missing
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
  if (!el) {
    console.warn("Element #etl-status not found and could not be created");
    return; // last resort: silently skip
  }
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
  if (!elHost) console.warn("Element #hb-host not found");
  const elVer = $("hb-ver");
  if (!elVer) console.warn("Element #hb-ver not found");
  const elTime = $("hb-time");
  if (!elTime) console.warn("Element #hb-time not found");
  const elErr = $("hb-err");
  if (!elErr) console.warn("Element #hb-err not found");

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
  if (!elDate) console.warn("Element #snap-date not found");
  const elRows = $("snap-rows");
  if (!elRows) console.warn("Element #snap-rows not found");
  const elGdn = $("snap-godowns");
  if (!elGdn) console.warn("Element #snap-godowns not found");

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
  if (!elPct) console.warn("Element #map-pct not found");
  const elTot = $("map-total");
  if (!elTot) console.warn("Element #map-total not found");
  const elSku = $("map-miss-sku");
  if (!elSku) console.warn("Element #map-miss-sku not found");
  const elGdn = $("map-miss-gdn");
  if (!elGdn) console.warn("Element #map-miss-gdn not found");

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
  if (!tbody) {
    console.warn("Element #act-body not found");
    return;
  }
  showLoadingOnce(tbody, 5); // table has 5 columns

  const { data, error } = await supabase
    .from("v_job_activity")
    .select("job_type, status, jobs, first_created, last_finished")
    .order("job_type", { ascending: true })
    .limit(50); // Limit to 50 rows for performance

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
  // Removed unused variable 'wrap'
  const tbody = document.getElementById("act2-body");
  if (!tbody) return;

  // show skeleton only on first paint
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

/* ---------------------------- Refresh / Poll ---------------------------- */
async function refreshAll() {
  if (isPolling) return; // avoid overlap
  isPolling = true;
  setStatus("Refreshing…", "ok");

  try {
    const chk = document.getElementById("show-by-report");
    const needReport = !!(chk && chk.checked);
    await Promise.all([
      updateHeartbeat(),
      updateSnapshotToday(),
      updateMappingToday(),
      updateActivity(),
      needReport ? updateActivityByReport() : Promise.resolve(),
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
  const btnRefresh = $("etl-refresh");
  if (btnRefresh) btnRefresh.addEventListener("click", () => refreshAll());

  const homeBtn = $("homeBtn");
  if (homeBtn) homeBtn.addEventListener("click", () => Platform.goHome());

  const chk = document.getElementById("show-by-report");
  const byReport = document.getElementById("by-report");
  if (chk && byReport) {
    chk.addEventListener("change", () => {
      byReport.style.display = chk.checked ? "" : "none";
      // Kick a refresh when toggled
      refreshAll().catch(() => {});
    });
  }
}

/* --------------------------- Boot on DOM ready -------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  wireUI();
  // first run
  refreshAll().catch((e) => console.error("initial refresh failed:", e));
  // light polling with jitter
  const BASE_MS = 60_000; // Increased polling interval to 60 seconds
  setTimeout(() => {
    refreshAll().catch(() => {});
    setInterval(
      () => refreshAll().catch(() => {}),
      BASE_MS + Math.floor(Math.random() * 4000)
    );
  }, Math.floor(Math.random() * 800));
});
