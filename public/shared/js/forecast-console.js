import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

// ------------- Helpers
// --- Additional helpers for forecast job control ---
function fmt(d) {
  // YYYY-MM-DD
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// addMonths already exists, so skip redefining

// fenceStart already exists, so skip redefining

function setStatus(html) {
  const el = document.getElementById("runStatus");
  if (el) el.innerHTML = html;
}

function chip(txt, tone = "muted") {
  const bg =
    tone === "ok"
      ? "#e6ffed"
      : tone === "warn"
      ? "#fff7e6"
      : tone === "err"
      ? "#ffecec"
      : "#f3f4f6";
  const brd =
    tone === "ok"
      ? "#b7f5c2"
      : tone === "warn"
      ? "#ffd591"
      : tone === "err"
      ? "#ffb3b3"
      : "#e5e7eb";
  return `<span style="display:inline-block;margin:2px 6px 0 0;padding:4px 8px;border:1px solid ${brd};border-radius:999px;background:${bg};font-size:12px;">${txt}</span>`;
}

// ---------- RPC wrappers ----------
async function rpcApplyMarketingOverrides(fromISO, toISO) {
  return supabase.rpc("apply_marketing_overrides", {
    p_from: fromISO,
    p_to: toISO,
  });
}

async function rpcEnqueueForecast(jobType, asOfISO, dryRun, priority = 10) {
  // Use your existing RPC that accepts (job_type, as_of_date, dry_run, priority)
  return supabase.rpc("enqueue_forecast_job", {
    p_job_type: jobType,
    p_as_of_date: asOfISO || null,
    p_dry_run: !!dryRun,
    p_priority: priority,
  });
}

async function fetchRecentRuns(limit = 6) {
  // Pull recent forecast_run rows for the tracker
  const { data, error } = await supabase
    .from("forecast_run")
    .select("id,module_slot,status,created_at,closed_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

// ---------- Tracker UI ----------
async function refreshTracker() {
  try {
    const rows = await fetchRecentRuns(8);
    const html =
      `<div style="margin-top:8px">` +
      rows
        .map((r) => {
          const tone =
            r.status === "OK" ? "ok" : r.status === "ERROR" ? "err" : "warn";
          return chip(`#${r.id} ${r.module_slot} -> ${r.status}`, tone);
        })
        .join(" ") +
      `</div>`;
    setStatus(html);
  } catch (err) {
    console.error(err);
    setStatus(chip("Tracker error", "err"));
  }
}

function startTracker() {
  clearInterval(trackerTimer);
  refreshTracker();
  trackerTimer = setInterval(refreshTracker, 5000);
}

// ---------- Button handlers ----------
let trackerTimer = null;
async function onPrimaryRun() {
  const dryRun = document.getElementById("dryRun").checked;
  const asOfRaw = document.getElementById("asOfDate").value;
  const today = asOfRaw ? new Date(`${asOfRaw}T00:00:00`) : new Date();

  setStatus(chip("Applying overrides...", "warn"));
  const { data: ovData, error: ovErr } = await rpcApplyMarketingOverrides(
    null,
    null
  );
  if (ovErr) {
    setStatus(chip("Overrides failed", "err"));
    console.error("apply_marketing_overrides", ovErr);
    return;
  }
  const [inserted, updated, deactivated] = ovData || [0, 0, 0];
  const overrideSummary =
    chip(`+${inserted} overrides`, "ok") +
    chip(`${updated} updated`, "muted") +
    chip(`${deactivated} deactivated`, "muted");

  setStatus(overrideSummary + chip("Queueing LLT", "warn"));
  const { error: lltErr } = await rpcEnqueueForecast(
    "FORECAST_LLT",
    fmt(today),
    dryRun,
    10
  );
  if (lltErr) {
    setStatus(chip("LLT queue failed", "err"));
    console.error("FORECAST_LLT", lltErr);
    return;
  }

  setStatus(
    overrideSummary +
      chip("LLT queued", "ok") +
      chip("Queueing seasonal", "warn")
  );
  const { error: seasErr } = await rpcEnqueueForecast(
    "FORECAST_SEASONAL",
    fmt(today),
    dryRun,
    10
  );
  if (seasErr) {
    setStatus(chip("Seasonal queue failed", "err"));
    console.error("FORECAST_SEASONAL", seasErr);
    return;
  }

  setStatus(
    overrideSummary +
      chip("LLT queued", "ok") +
      chip("Seasonal queued", "ok") +
      chip("Monitoring runs", "warn")
  );
  startTracker();
}

async function onFullRebuild() {
  const dryRun = document.getElementById("dryRun").checked;
  const asOfRaw = document.getElementById("asOfDate").value;
  const asOfISO = asOfRaw || fmt(new Date());

  const ok = window.confirm(
    "This will regenerate Baseline before LLT & Seasonal.\nUse at cycle start or when you intend to refresh the foundation.\n\nProceed?"
  );
  if (!ok) return;

  setStatus(chip("Queueing full rebuild", "warn"));
  const { error } = await rpcEnqueueForecast(
    "FORECAST_ALL",
    asOfISO,
    dryRun,
    10
  );
  if (error) {
    setStatus(chip("Full rebuild queue failed", "err"));
    console.error("FORECAST_ALL", error);
    return;
  }

  setStatus(
    chip("Full rebuild queued", "ok") + chip("Monitoring runs", "warn")
  );
  startTracker();
}

// ---------- wire up run controls ----------
function initRunControls() {
  const a = document.getElementById("btnApplyOverridesAndDerived");
  const b = document.getElementById("btnFullRebuild");
  if (a) a.addEventListener("click", onPrimaryRun);
  if (b) b.addEventListener("click", onFullRebuild);
  startTracker(); // show recent runs on load
}
// wire HOME button to Platform.goHome if present
try {
  const hb = document.getElementById("homeBtn");
  if (hb) hb.addEventListener("click", () => Platform.goHome());
} catch {
  /* ignore */
}
function showModal(message, title = "Notice") {
  const dlg = document.getElementById("fcModal");
  if (!dlg) return alert(message); // graceful fallback

  const titleEl = document.getElementById("fcModalTitle");
  const msgEl = document.getElementById("fcModalMessage");
  titleEl.textContent = title;
  msgEl.innerHTML = message; // message can include simple <b>...</b> if needed

  // Ensure <dialog> works even if not supported
  if (typeof dlg.showModal === "function") {
    dlg.showModal();
  } else {
    // Fallback shim: emulate a modal
    dlg.setAttribute("open", "");
  }
}

function closeModal() {
  const dlg = document.getElementById("fcModal");
  if (!dlg) return;
  if (typeof dlg.close === "function") dlg.close();
  else dlg.removeAttribute("open");
}

// small helpers used by missing modal
function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function rowsToCsv(rows, cols) {
  const head = cols.join(",");
  const body = (rows || [])
    .map((r) =>
      cols
        .map((c) => {
          const v = r[c] ?? "";
          if (
            typeof v === "string" &&
            (v.includes(",") || v.includes('"') || v.includes("\n"))
          ) {
            return '"' + v.replace(/"/g, '""') + '"';
          }
          return v;
        })
        .join(",")
    )
    .join("\n");
  return head + "\n" + body;
}

// ---------------- Missing items modal & RPC helpers
// Fetch a paginated page of missing relevant items (calls DB RPC 'fetch_missing_relevant')
async function fetchMissingPage(
  kind,
  startISO,
  endISO,
  page = 0,
  pageSize = 100
) {
  const offset = page * pageSize;
  const { data, error } = await supabase.rpc("fetch_missing_relevant", {
    p_start: startISO,
    p_end: endISO,
    p_kind: kind,
    p_limit: pageSize,
    p_offset: offset,
  });
  if (error) throw error;
  return data || [];
}

// Render a simple modal with rows and pagination + copy-to-clipboard
async function showMissingModal(kind) {
  const start = fenceStart(new Date());
  const end = addMonths(start, 12);
  const startISO = fmtDate(start);
  const endISO = fmtDate(end);
  const pageSize = 200;
  let page = 0;

  // Create modal container if missing
  let modal = document.getElementById("missingItemsModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "missingItemsModal";
    modal.style.position = "fixed";
    modal.style.left = "0";
    modal.style.top = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.background = "rgba(0,0,0,0.4)";
    modal.style.zIndex = 9999;
    modal.innerHTML = `
      <div id="missingInner" style="background:#fff;max-width:1000px;margin:5% auto;padding:16px;border-radius:6px;box-shadow:0 6px 24px rgba(0,0,0,0.2);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <h3 id="missingTitle" style="margin:0">Missing Items</h3>
          <div>
            <button id="missingCopy" style="margin-right:8px">Copy list</button>
            <button id="missingClose">Close</button>
          </div>
        </div>
        <div id="missingTableWrap" style="max-height:60vh;overflow:auto;border:1px solid #eee;padding:6px;"></div>
        <div id="missingPager" style="margin-top:8px;display:flex;align-items:center;justify-content:space-between;">
          <div id="missingCount">&nbsp;</div>
          <div>
            <button id="missingPrev">Prev</button>
            <button id="missingNext">Next</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document
      .getElementById("missingClose")
      .addEventListener("click", () => modal.remove());
  }

  const title = document.getElementById("missingTitle");
  title.textContent =
    kind === "llt" ? "Missing LLT (relevant)" : "Missing Seasonal (relevant)";

  const wrap = document.getElementById("missingTableWrap");
  const countEl = document.getElementById("missingCount");
  const prevBtn = document.getElementById("missingPrev");
  const nextBtn = document.getElementById("missingNext");
  const copyBtn = document.getElementById("missingCopy");

  async function render() {
    try {
      const rows = await fetchMissingPage(
        kind,
        startISO,
        endISO,
        page,
        pageSize
      );
      wrap.innerHTML = "";
      if (!rows || rows.length === 0) {
        wrap.textContent = "No rows";
        countEl.textContent = "";
        prevBtn.disabled = page === 0;
        nextBtn.disabled = true;
        return;
      }

      // total_count is on each row (COUNT OVER)
      const total = Number(rows[0].total_count || 0);
      countEl.textContent = `Page ${page + 1} — ${
        rows.length
      } rows (total ${total})`;

      // build table
      const table = document.createElement("table");
      table.className = "small";
      const thead = document.createElement("thead");
      thead.innerHTML =
        "<tr><th>SKU</th><th>Item</th><th>Pack</th><th>UoM</th><th>Month</th><th>Region</th><th>Godown</th></tr>";
      table.appendChild(thead);
      const tbody = document.createElement("tbody");
      for (const r of rows) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${r.sku_id ?? ""}</td>
                        <td>${escapeHtml(r.item ?? r.sku_label ?? "")}</td>
                        <td>${r.pack_size ?? ""}</td>
                        <td>${r.uom ?? ""}</td>
                        <td>${r.month_start ?? ""}</td>
                        <td>${r.region_id ?? ""}</td>
                        <td>${r.godown_id ?? ""}</td>`;
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      wrap.appendChild(table);

      prevBtn.disabled = page === 0;
      nextBtn.disabled = (page + 1) * pageSize >= total;

      copyBtn.onclick = () => {
        // copy CSV lines of sku_id, item, pack_size, uom, month_start
        const cols = [
          "sku_id",
          "item",
          "pack_size",
          "uom",
          "month_start",
          "region_id",
          "godown_id",
        ];
        const csv = rowsToCsv(
          rows,
          cols.map((c) => c)
        );
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(csv);
          showToast("Copied to clipboard");
        } else {
          const ta = document.createElement("textarea");
          ta.value = csv;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
          showToast("Copied to clipboard");
        }
      };
    } catch (err) {
      console.error("renderMissingModal", err);
      wrap.textContent = "Error loading";
    }
  }

  prevBtn.onclick = async () => {
    if (page > 0) {
      page--;
      await render();
    }
  };
  nextBtn.onclick = async () => {
    page++;
    await render();
  };

  // initial render
  await render();
}

// Close on OK button or ESC
document.addEventListener("DOMContentLoaded", () => {
  const dlg = document.getElementById("fcModal");
  const ok = document.getElementById("fcModalClose");
  if (ok) ok.addEventListener("click", () => closeModal());
  if (dlg)
    dlg.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeModal();
    });
});

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtMonthInput(d) {
  if (!d) return "";
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseMonthInput(value) {
  if (!value) return null;
  const [yy, mm] = String(value).split("-");
  if (!yy || !mm) return null;
  const year = Number(yy);
  const month = Number(mm) - 1;
  if (Number.isNaN(year) || Number.isNaN(month)) return null;
  return new Date(year, month, 1);
}

function monthInputToISO(value) {
  const parsed = parseMonthInput(value);
  return parsed ? fmtDate(parsed) : null;
}

function monthInputToExclusiveISO(value) {
  const parsed = parseMonthInput(value);
  if (!parsed) return null;
  return fmtDate(addMonths(parsed, 1));
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatMonthLabel(date) {
  if (!date) return "";
  return `${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
}

function monthFloor(dt = new Date()) {
  return new Date(dt.getFullYear(), dt.getMonth(), 1);
}

function fenceStart(today = new Date()) {
  const day = today.getDate();
  const base = monthFloor(today);
  if (day > 25) {
    // next month
    return new Date(base.getFullYear(), base.getMonth() + 1, 1);
  }
  return base;
}

function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function getWindow() {
  const fromRaw = document.getElementById("fromDate")?.value;
  const toRaw = document.getElementById("toDate")?.value;
  return {
    from: monthInputToISO(fromRaw),
    to: monthInputToISO(toRaw),
  };
}

function getFilters() {
  const sku = document.getElementById("skuId").value;
  const region = document.getElementById("regionId").value;
  const godown = document.getElementById("godownId").value;
  return {
    sku_id: sku ? Number(sku) : null,
    region_id: region ? Number(region) : null,
    godown_id: godown ? Number(godown) : null,
  };
}

function toCSV(rows) {
  if (!rows || !rows.length) return "";
  const cols = Object.keys(rows[0]);
  const head = cols.join(",");
  const body = rows
    .map((r) =>
      cols
        .map((c) => {
          const v = r[c] ?? "";
          if (typeof v === "string" && (v.includes(",") || v.includes('"'))) {
            return `"${v.replace(/"/g, '""')}"`;
          }
          return v;
        })
        .join(",")
    )
    .join("\n");
  return head + "\n" + body;
}
function downloadFile(name, content, mime = "text/csv") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ------------- Auth & init
async function ensureAuth() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "../../login.html";
    return null;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function setupTabs() {
  const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
  const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));
  const tabsEl = document.querySelector(".tabs");
  const leftChevron = document.querySelector(".tabs-chevron.left");
  const rightChevron = document.querySelector(".tabs-chevron.right");

  if (!tabButtons.length) return;

  const panelById = new Map();
  tabPanels.forEach((panel) => {
    panelById.set(panel.id, panel);
    if (!panel.classList.contains("active")) panel.setAttribute("hidden", "");
    else panel.removeAttribute("hidden");
  });

  tabButtons.forEach((btn) => {
    const isSelected = btn.getAttribute("aria-selected") === "true";
    btn.setAttribute("tabindex", isSelected ? "0" : "-1");
    if (isSelected) btn.classList.add("active");
    else btn.classList.remove("active");
  });

  const SCROLL_DELTA = 200;

  function updateChevronState() {
    if (!tabsEl || !leftChevron || !rightChevron) return;
    const isOverflowing = tabsEl.scrollWidth > tabsEl.clientWidth + 2;
    if (!isOverflowing) {
      leftChevron.style.display = "none";
      rightChevron.style.display = "none";
      leftChevron.setAttribute("disabled", "true");
      rightChevron.setAttribute("disabled", "true");
      return;
    }

    leftChevron.style.display = "inline-flex";
    rightChevron.style.display = "inline-flex";

    const canScrollLeft = tabsEl.scrollLeft > 2;
    const canScrollRight =
      tabsEl.scrollLeft + tabsEl.clientWidth < tabsEl.scrollWidth - 2;

    if (canScrollLeft) leftChevron.removeAttribute("disabled");
    else leftChevron.setAttribute("disabled", "true");

    if (canScrollRight) rightChevron.removeAttribute("disabled");
    else rightChevron.setAttribute("disabled", "true");
  }

  function showPanel(panel) {
    panel.classList.add("active");
    panel.removeAttribute("hidden");
  }

  function hidePanel(panel) {
    panel.classList.remove("active");
    panel.setAttribute("hidden", "");
  }

  function centerTab(btn, behavior = "smooth") {
    if (!tabsEl || !btn) return;
    const center = btn.offsetLeft + btn.offsetWidth / 2;
    const target = Math.max(0, center - tabsEl.clientWidth / 2);
    tabsEl.scrollTo({ left: target, behavior });
    updateChevronState();
  }

  function activate(btn, opts = {}) {
    if (!btn) return;
    const { focus = true, scroll = true } = opts;
    const panelId = btn.getAttribute("aria-controls");
    if (!panelId) return;

    tabButtons.forEach((b) => {
      b.setAttribute("aria-selected", "false");
      b.setAttribute("tabindex", "-1");
      b.classList.remove("active");
    });
    tabPanels.forEach((panel) => hidePanel(panel));

    btn.setAttribute("aria-selected", "true");
    btn.setAttribute("tabindex", "0");
    btn.classList.add("active");
    if (focus) btn.focus({ preventScroll: true });

    const panel = panelById.get(panelId);
    if (panel) showPanel(panel);

    if (scroll) centerTab(btn);
    else updateChevronState();
  }

  tabButtons.forEach((btn, index) => {
    btn.addEventListener("click", () => activate(btn));

    btn.addEventListener("keydown", (event) => {
      const { key } = event;
      if (key === "ArrowRight") {
        event.preventDefault();
        const next = tabButtons[(index + 1) % tabButtons.length];
        tabButtons.forEach((b) => b.setAttribute("tabindex", "-1"));
        next.setAttribute("tabindex", "0");
        next.focus();
      } else if (key === "ArrowLeft") {
        event.preventDefault();
        const prev =
          tabButtons[(index - 1 + tabButtons.length) % tabButtons.length];
        tabButtons.forEach((b) => b.setAttribute("tabindex", "-1"));
        prev.setAttribute("tabindex", "0");
        prev.focus();
      } else if (key === "Home") {
        event.preventDefault();
        tabButtons.forEach((b) => b.setAttribute("tabindex", "-1"));
        const first = tabButtons[0];
        first.setAttribute("tabindex", "0");
        first.focus();
      } else if (key === "End") {
        event.preventDefault();
        tabButtons.forEach((b) => b.setAttribute("tabindex", "-1"));
        const last = tabButtons[tabButtons.length - 1];
        last.setAttribute("tabindex", "0");
        last.focus();
      } else if (key === "Enter" || key === " ") {
        event.preventDefault();
        activate(btn);
      }
    });
  });

  if (leftChevron && tabsEl) {
    leftChevron.addEventListener("click", () => {
      const newLeft = Math.max(0, tabsEl.scrollLeft - SCROLL_DELTA);
      tabsEl.scrollTo({ left: newLeft, behavior: "smooth" });
      setTimeout(updateChevronState, 120);
    });
  }

  if (rightChevron && tabsEl) {
    rightChevron.addEventListener("click", () => {
      const maxLeft = tabsEl.scrollWidth - tabsEl.clientWidth;
      const newLeft = Math.min(maxLeft, tabsEl.scrollLeft + SCROLL_DELTA);
      tabsEl.scrollTo({ left: newLeft, behavior: "smooth" });
      setTimeout(updateChevronState, 120);
    });
  }

  if (tabsEl) {
    tabsEl.addEventListener("scroll", () => {
      window.requestAnimationFrame(updateChevronState);
    });
  }

  if (typeof window !== "undefined") {
    let resizeTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateChevronState, 120);
    });
  }

  updateChevronState();
  const initiallySelected =
    tabButtons.find((btn) => btn.getAttribute("aria-selected") === "true") ||
    tabButtons[0];
  if (initiallySelected)
    activate(initiallySelected, { focus: false, scroll: false });
}

function setDefaultWindow() {
  const fromEl = document.getElementById("fromDate");
  const toEl = document.getElementById("toDate");
  const start = fenceStart(new Date());
  const end = addMonths(start, 12);
  if (fromEl) fromEl.value = fmtMonthInput(start);
  if (toEl) toEl.value = fmtMonthInput(addMonths(end, -1)); // inclusive last month
}

// ------------- Overview
async function loadOverviewTiles() {
  const start = fenceStart(new Date());
  const end = addMonths(start, 12);

  const tileWindow = document.getElementById("tileWindow");
  if (tileWindow) {
    tileWindow.textContent = `${formatMonthLabel(start)} to ${formatMonthLabel(
      addMonths(end, -1)
    )}`;
  }

  // Combined: use materialized-view RPC for fast aggregate counts
  const startISO = fmtDate(start);
  const endISO = fmtDate(end);
  const elPairs = document.getElementById("tilePairs");
  const elRows = document.getElementById("tileRows");
  const elMissLLT = document.getElementById("tileMissLLT");
  const elMissSeason = document.getElementById("tileMissSeason");
  // show loading state
  if (elPairs) elPairs.textContent = "...";
  if (elRows) elRows.textContent = "...";
  if (elMissLLT) elMissLLT.textContent = "...";
  if (elMissSeason) elMissSeason.textContent = "...";

  try {
    const { data, error } = await supabase.rpc("count_forecast_health_mv", {
      p_start: startISO,
      p_end: endISO,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (elPairs) elPairs.textContent = row?.pairs_count ?? 0;
    if (elRows) elRows.textContent = row?.rows_count ?? 0;
    if (elMissLLT) elMissLLT.textContent = row?.missing_llt_relevant ?? 0;
    if (elMissSeason)
      elMissSeason.textContent = row?.missing_seasonal_relevant ?? 0;
    // set overrides tile if present
    const elOverrides = document.getElementById("tileOverrides");
    if (elOverrides && typeof row?.active_overrides_count !== "undefined")
      elOverrides.textContent = row.active_overrides_count;
  } catch (err) {
    console.error("count_forecast_health_mv failed", err);
    if (elPairs) elPairs.textContent = "-";
    if (elRows) elRows.textContent = "-";
    if (elMissLLT) elMissLLT.textContent = "-";
    if (elMissSeason) elMissSeason.textContent = "-";
  }

  // (counts for missing LLT/seasonal are computed above using DB-side counts)

  // Active overrides (use count returned by head:true query)
  {
    const { count, error } = await supabase
      .from("forecast_demand_overrides")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);
    if (error) {
      console.error(error);
      document.getElementById("tileOverrides").textContent = "-";
    } else {
      document.getElementById("tileOverrides").textContent = count ?? 0;
    }
  }
}

async function loadRunsTable() {
  const tbody = document.querySelector("#runsTable tbody");
  tbody.innerHTML = "";
  const { data, error } = await supabase
    .from("v_forecast_runs_recent")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error(error);
    return;
  }
  (data || []).forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${r.module_slot}</td>
      <td>${r.as_of_date ?? ""}</td>
      <td>${r.horizon_months ?? ""}</td>
      <td>${r.status}</td>
      <td>${r.created_at ?? ""}</td>
      <td>${r.closed_at ?? ""}</td>
      <td class="small muted">${
        typeof r.notes === "string" ? r.notes : JSON.stringify(r.notes ?? "")
      }</td>
    `;
    tbody.appendChild(tr);
  });
}

// ------------- Model Outputs
let outputsPage = 0;
const PAGE_SIZE = 100;

function buildOutputsQuery(dataset) {
  // returns { table, cols, rename }
  switch (dataset) {
    case "baseline":
      return {
        table: "v_forecast_baseline_effective",
        cols: [
          "sku_id",
          "region_id",
          "godown_id",
          "month_start",
          "demand_baseline",
          "override_delta",
          "demand_effective",
        ],
      };
    case "llt":
      return {
        table: "sku_forecast_monthly_llt",
        cols: ["sku_id", "region_id", "godown_id", "month_start", "y_supply"],
      };
    case "seasonal":
      return {
        table: "sku_forecast_monthly_seasonal",
        cols: ["sku_id", "region_id", "godown_id", "month_start", "y_supply"],
      };
    case "combined":
    default:
      return {
        table: "v_forecast_plan_12m",
        cols: [
          "sku_id",
          "region_id",
          "godown_id",
          "month_start",
          "demand_baseline",
          "supply_llt",
          "supply_seasonal",
          "supply_final",
        ],
      };
  }
}

async function loadOutputs() {
  const ds = document.getElementById("outputsDataset").value;
  const cfg = buildOutputsQuery(ds);
  const head = document.getElementById("outputsHeader");
  const body = document.getElementById("outputsBody");
  const status = document.getElementById("outputsStatus");
  head.innerHTML = "";
  body.innerHTML = "";
  status.textContent = "Loading...";

  const { from, to } = getWindow();
  const { sku_id, region_id, godown_id } = getFilters();

  let q = supabase.from(cfg.table).select(cfg.cols.join(","));
  if (from) q = q.gte("month_start", from);
  if (to) q = q.lte("month_start", to);
  if (sku_id) q = q.eq("sku_id", sku_id);
  if (region_id) q = q.eq("region_id", region_id);
  if (godown_id) q = q.eq("godown_id", godown_id);

  q = q
    .order("sku_id")
    .order("region_id")
    .order("godown_id")
    .order("month_start")
    .range(outputsPage * PAGE_SIZE, outputsPage * PAGE_SIZE + PAGE_SIZE - 1);

  const { data, error } = await q;
  if (error) {
    console.error(error);
    status.textContent = "Error loading.";
    return;
  }

  // header
  cfg.cols.forEach((c) => {
    const th = document.createElement("th");
    th.textContent = c;
    head.appendChild(th);
  });

  // rows
  (data || []).forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = cfg.cols.map((c) => `<td>${r[c] ?? ""}</td>`).join("");
    body.appendChild(tr);
  });

  status.textContent = `${data?.length ?? 0} rows`;
  document.getElementById("pageInfoOutputs").textContent = `Page ${
    outputsPage + 1
  }`;
}

function exportOutputs() {
  const rows = [];
  const thead = document.getElementById("outputsHeader");
  const cols = [...thead.querySelectorAll("th")].map((th) => th.textContent);
  const body = document.getElementById("outputsBody");
  [...body.querySelectorAll("tr")].forEach((tr) => {
    const obj = {};
    [...tr.children].forEach((td, i) => (obj[cols[i]] = td.textContent));
    rows.push(obj);
  });
  const csv = toCSV(rows);
  downloadFile("model_outputs.csv", csv);
}

// ------------- Overrides
async function loadOverrides() {
  const tbody = document.querySelector("#overridesTable tbody");
  const status = document.getElementById("overridesStatus");
  tbody.innerHTML = "";
  status.textContent = "Loading...";
  const { from, to } = getWindow();

  let q = supabase
    .from("forecast_demand_overrides")
    .select(
      "sku_id,region_id,godown_id,month_start,delta_units,reason,is_active,created_at,updated_at"
    )
    .order("month_start");

  if (from) q = q.gte("month_start", from);
  if (to) q = q.lte("month_start", to);

  const { data, error } = await q;
  if (error) {
    console.error(error);
    status.textContent = "Error loading.";
    return;
  }

  (data || []).forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.sku_id}</td><td>${r.region_id}</td><td>${r.godown_id}</td>
      <td>${r.month_start}</td><td>${r.delta_units}</td>
      <td>${r.reason ?? ""}</td><td>${r.is_active ? "true" : "false"}</td>
      <td>${r.created_at ?? ""}</td><td>${r.updated_at ?? ""}</td>
    `;
    tbody.appendChild(tr);
  });
  status.textContent = `${data?.length ?? 0} rows`;
}

async function upsertOverride() {
  const sku = Number(document.getElementById("ovSku").value);
  const region = Number(document.getElementById("ovRegion").value);
  const godown = Number(document.getElementById("ovGodown").value);
  const month = monthInputToISO(document.getElementById("ovMonth")?.value);
  const delta = Number(document.getElementById("ovDelta").value);
  const reason = document.getElementById("ovReason").value || null;
  if (!sku || !region || !godown || !month) {
    showModal("SKU, Region, Godown, Month are required.");
    return;
  }
  // Try update first (replace delta/reason + keep active)
  const { error: upErr } = await supabase
    .from("forecast_demand_overrides")
    .update({ delta_units: delta, reason, is_active: true })
    .match({
      sku_id: sku,
      region_id: region,
      godown_id: godown,
      month_start: month,
    });
  if (upErr) {
    console.error("update error", upErr);
  }
  // If no row updated, do insert (will fail only if RLS/constraint blocks)
  const { error: insErr } = await supabase
    .from("forecast_demand_overrides")
    .insert([
      {
        sku_id: sku,
        region_id: region,
        godown_id: godown,
        month_start: month,
        delta_units: delta,
        reason,
      },
    ]);
  if (insErr && insErr.code !== "23505") {
    // ignore duplicate if update already handled
    console.error("insert error", insErr);
  }
  await loadOverrides();
  showModal("Override saved.");
}

async function deleteOverride() {
  const sku = Number(document.getElementById("ovSku").value);
  const region = Number(document.getElementById("ovRegion").value);
  const godown = Number(document.getElementById("ovGodown").value);
  const month = monthInputToISO(document.getElementById("ovMonth")?.value);
  if (!sku || !region || !godown || !month) {
    showModal("SKU, Region, Godown, Month are required.");
    return;
  }
  const { error } = await supabase
    .from("forecast_demand_overrides")
    .delete()
    .match({
      sku_id: sku,
      region_id: region,
      godown_id: godown,
      month_start: month,
    });
  if (error) {
    console.error(error);
    showModal("Delete failed.");
    return;
  }
  await loadOverrides();
  showModal("Override deleted.");
}

function exportOverrides() {
  const body = document.querySelector("#overridesTable tbody");
  const rows = [...body.querySelectorAll("tr")].map((tr) => {
    const tds = [...tr.children].map((td) => td.textContent);
    return {
      sku_id: tds[0],
      region_id: tds[1],
      godown_id: tds[2],
      month_start: tds[3],
      delta_units: tds[4],
      reason: tds[5],
      is_active: tds[6],
      created_at: tds[7],
      updated_at: tds[8],
    };
  });
  downloadFile("overrides.csv", toCSV(rows));
}

// ------------- Exceptions (next phase: client-side join MVP)
async function loadExceptions() {
  const status = document.getElementById("exceptionsStatus");
  const tbody = document.querySelector("#exceptionsTable tbody");
  tbody.innerHTML = "";
  status.textContent = "Loading...";
  const { from, to } = getWindow();

  let qPlan = supabase
    .from("v_forecast_plan_12m")
    .select("sku_id,region_id,godown_id,month_start,supply_llt,supply_seasonal")
    .order("sku_id")
    .order("region_id")
    .order("godown_id")
    .order("month_start");
  if (from) qPlan = qPlan.gte("month_start", from);
  if (to) qPlan = qPlan.lte("month_start", to);

  const { data: plan, error } = await qPlan;
  if (error) {
    console.error(error);
    status.textContent = "Error";
    return;
  }

  // Pull baseline effective for the same window and map
  let qEff = supabase
    .from("v_forecast_baseline_effective")
    .select("sku_id,region_id,godown_id,month_start,demand_effective");
  if (from) qEff = qEff.gte("month_start", from);
  if (to) qEff = qEff.lte("month_start", to);
  const { data: eff, error: e2 } = await qEff;
  if (e2) {
    console.error(e2);
    status.textContent = "Error";
    return;
  }

  const effMap = new Map(
    (eff || []).map((r) => [
      `${r.sku_id}-${r.region_id}-${r.godown_id}-${r.month_start}`,
      r.demand_effective,
    ])
  );

  let rows = 0;
  (plan || []).forEach((p) => {
    if (p.supply_llt === null || p.supply_seasonal === null) {
      const key = `${p.sku_id}-${p.region_id}-${p.godown_id}-${p.month_start}`;
      const demand_effective = effMap.get(key) ?? null;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.sku_id}</td><td>${p.region_id}</td><td>${p.godown_id}</td>
        <td>${p.month_start}</td>
        <td>${demand_effective ?? ""}</td>
        <td>${p.supply_llt ?? ""}</td>
        <td>${p.supply_seasonal ?? ""}</td>
      `;
      tbody.appendChild(tr);
      rows++;
    }
  });
  status.textContent = `${rows} exceptions`;
}

function exportExceptions() {
  const body = document.querySelector("#exceptionsTable tbody");
  const rows = [...body.querySelectorAll("tr")].map((tr) => {
    const tds = [...tr.children].map((td) => td.textContent);
    return {
      sku_id: tds[0],
      region_id: tds[1],
      godown_id: tds[2],
      month_start: tds[3],
      demand_effective: tds[4],
      supply_llt: tds[5],
      supply_seasonal: tds[6],
    };
  });
  downloadFile("exceptions.csv", toCSV(rows));
}

// ------------- Publish (stub - we'll wire batch snapshot next)
async function listPublishes() {
  const tbody = document.querySelector("#publishTable tbody");
  tbody.innerHTML = "";
  const { data, error } = await supabase
    .from("plan_publish_headers")
    .select("id,plan_key,as_of_date,created_at,notes")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error(error);
    return;
  }
  (data || []).forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.id}</td><td>${r.plan_key}</td><td>${r.as_of_date ?? ""}</td>
      <td>${r.created_at ?? ""}</td><td class="small muted">${
      r.notes ?? ""
    }</td>
    `;
    tbody.appendChild(tr);
  });
}

// ===== Baseline Export/Import (Marketing)
function showToast(msg) {
  const el = document.getElementById("toast");
  if (!el) return; // graceful if toast element missing
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => (el.style.display = "none"), 3500);
}

function yyyymmdd(d) {
  // Date -> 'YYYY-MM-DD'
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function fenceWindow(asOf = new Date(), frozenAfter = 25, months = 12) {
  // Reproduce fence logic used in DB: start = month floor or +1M if day>frozenAfter
  const start = new Date(asOf.getFullYear(), asOf.getMonth(), 1);
  if (asOf.getDate() > frozenAfter) start.setMonth(start.getMonth() + 1);
  const end = new Date(start.getFullYear(), start.getMonth() + months, 1);
  return { start: yyyymmdd(start), end: yyyymmdd(end) };
}

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadBlob(text, filename) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ===== Export Baseline CSV =====
async function exportBaselineCsv() {
  try {
    const months = Math.max(
      1,
      Math.min(12, Number(document.getElementById("moMonths").value || 3))
    );
    // derive window (allow manual override)
    const fromEl = document.getElementById("moFrom");
    const toEl = document.getElementById("moTo");
    let from = monthInputToISO(fromEl?.value);
    let toExclusive = monthInputToExclusiveISO(toEl?.value);
    if (!from || !toExclusive) {
      const w = fenceWindow(new Date(), 25, months);
      from = w.start;
      toExclusive = w.end;
      const startDate = new Date(`${w.start}T00:00:00`);
      const inclusiveEnd = addMonths(new Date(`${w.end}T00:00:00`), -1);
      if (fromEl) fromEl.value = fmtMonthInput(startDate);
      if (toEl) toEl.value = fmtMonthInput(inclusiveEnd);
    }

    // Pull from v_forecast_baseline_effective (effective demand = baseline + overrides)
    // Columns for marketing: sku_id,region_id,godown_id,month_start,baseline_demand
    // NOTE: we export the baseline_demand (effective), not supply, and not the delta.
    const rows = [];
    const pageSize = 2000;
    let fromIdx = 0;

    while (true) {
      const { data, error } = await supabase
        .from("v_forecast_baseline_effective")
        .select("sku_id,region_id,godown_id,month_start,demand_effective")
        .gte("month_start", from)
        .lt("month_start", toExclusive)
        .order("sku_id", { ascending: true })
        .order("region_id", { ascending: true })
        .order("godown_id", { ascending: true })
        .order("month_start", { ascending: true })
        .range(fromIdx, fromIdx + pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      for (const r of data) {
        rows.push({
          sku_id: r.sku_id,
          region_id: r.region_id,
          godown_id: r.godown_id,
          month_start: r.month_start,
          baseline_demand: r.demand_effective, // for marketing to propose increments
        });
      }
      if (data.length < pageSize) break;
      fromIdx += data.length;
    }

    // CSV
    const header = [
      "sku_id",
      "region_id",
      "godown_id",
      "month_start",
      "baseline_demand",
      "delta_units",
      "note",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          csvEscape(r.sku_id),
          csvEscape(r.region_id),
          csvEscape(r.godown_id),
          csvEscape(r.month_start),
          csvEscape(r.baseline_demand),
          "", // delta_units (blank for marketing to fill)
          "", // note
        ].join(",")
      );
    }
    downloadBlob(
      lines.join("\n"),
      `marketing_baseline_${from}_to_${toExclusive}.csv`
    );
    showToast(`Exported ${rows.length} rows`);
  } catch (err) {
    console.error("exportBaselineCsv failed:", err);
    showToast("Export failed (see console)");
  }
}

// ===== Import & Apply =====
let importRows = []; // holds parsed CSV rows (validated)
function parseCsv(text) {
  // Minimal CSV parser (expects header row)
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { header: [], rows: [] };
  const header = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    // naive split on commas, respecting quoted fields
    const cols = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = !inQ;
      } else if (ch === "," && !inQ) {
        cols.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    const obj = {};
    header.forEach((h, idx) => (obj[h] = (cols[idx] ?? "").trim()));
    return obj;
  });
  return { header, rows };
}

function renderPreview(rows, header) {
  const wrap = document.getElementById("moPreview");
  const info = document.getElementById("moPreviewInfo");
  const thead = document.querySelector("#moPreviewTable thead");
  const tbody = document.querySelector("#moPreviewTable tbody");
  thead.innerHTML = "";
  tbody.innerHTML = "";
  wrap.style.display = "block";

  // header
  const trh = document.createElement("tr");
  header.forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    trh.appendChild(th);
  });
  thead.appendChild(trh);

  // first 50 rows
  const sample = rows.slice(0, 50);
  for (const r of sample) {
    const tr = document.createElement("tr");
    header.forEach((h) => {
      const td = document.createElement("td");
      td.textContent = r[h];
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
  info.textContent = `Total rows: ${rows.length} (showing first ${sample.length})`;
}

async function previewImport() {
  try {
    const file = document.getElementById("moFile").files?.[0];
    if (!file) return showToast("Pick a CSV file first");
    const text = await file.text();
    const { header, rows } = parseCsv(text);

    // Validate mandatory columns
    const need = [
      "sku_id",
      "region_id",
      "godown_id",
      "month_start",
      "delta_units",
    ];
    const missing = need.filter((n) => !header.includes(n));
    if (missing.length) {
      showToast(`CSV missing columns: ${missing.join(", ")}`);
      return;
    }

    // Basic normalization
    importRows = rows
      .filter((r) => r.sku_id && r.region_id && r.godown_id && r.month_start)
      .map((r) => ({
        sku_id: Number(r.sku_id),
        region_id: Number(r.region_id),
        godown_id: Number(r.godown_id),
        month_start: r.month_start,
        delta_units: Number(r.delta_units || 0),
        note: r.note || null,
      }));

    renderPreview(rows, header);
    document.getElementById("btnApplyImport").disabled =
      importRows.length === 0;
    showToast(`Parsed ${importRows.length} valid rows`);
  } catch (err) {
    console.error("previewImport failed:", err);
    showToast("Preview failed (see console)");
  }
}

async function applyImport() {
  try {
    if (!importRows.length) return showToast("Nothing to apply");

    // Window selection (derive if empty)
    let from = monthInputToISO(document.getElementById("moFrom")?.value);
    let toExclusive = monthInputToExclusiveISO(
      document.getElementById("moTo")?.value
    );
    if (!from || !toExclusive) {
      const w = fenceWindow(new Date(), 25, 12);
      from = w.start;
      toExclusive = w.end;
      const startDate = new Date(`${from}T00:00:00`);
      const inclusiveEnd = addMonths(new Date(`${toExclusive}T00:00:00`), -1);
      const fromInput = document.getElementById("moFrom");
      const toInput = document.getElementById("moTo");
      if (fromInput) fromInput.value = fmtMonthInput(startDate);
      if (toInput) toInput.value = fmtMonthInput(inclusiveEnd);
    }

    // 1) Clear staging window
    let { error: delError } = await supabase
      .from("marketing_overrides_staging")
      .delete()
      .gte("month_start", from)
      .lt("month_start", toExclusive);
    if (delError) throw delError;

    // 2) Insert to staging (chunked)
    const chunk = 1000;
    for (let i = 0; i < importRows.length; i += chunk) {
      const slice = importRows.slice(i, i + chunk);
      const { error } = await supabase
        .from("marketing_overrides_staging")
        .insert(slice);
      if (error) throw error;
    }

    // 3) Apply via SQL function
    const { data, error } = await supabase.rpc("apply_marketing_overrides", {
      p_from: from,
      p_to: toExclusive,
    });
    if (error) throw error;

    // data = [ inserted_count, updated_count, deactivated_count ]
    const [inserted, updated, deactivated] = data || [0, 0, 0];
    showToast(
      `Overrides applied. Inserted=${inserted}, Updated=${updated}, Deactivated=${deactivated}`
    );

    // 4) Refresh whatever grids you show
    if (typeof window.refreshPlanGrids === "function")
      window.refreshPlanGrids();
  } catch (err) {
    console.error("applyImport failed:", err);
    showToast("Apply failed (see console)");
  }
}

// ------------- Wire UI events
function wireEvents() {
  // Baseline Export/Import
  safeAddEventListener("btnExportBaselineCsv", "click", exportBaselineCsv);
  safeAddEventListener("btnPreviewImport", "click", previewImport);
  safeAddEventListener("btnApplyImport", "click", applyImport);
  // Helper to safely add event listeners
  function safeAddEventListener(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  }

  safeAddEventListener("resetFilters", "click", () => {
    const sku = document.getElementById("skuId");
    const region = document.getElementById("regionId");
    const godown = document.getElementById("godownId");
    if (sku) sku.value = "";
    if (region) region.value = "";
    if (godown) godown.value = "";
  });

  // Outputs
  safeAddEventListener("btnLoadOutputs", "click", () => {
    outputsPage = 0;
    loadOutputs();
  });
  safeAddEventListener("btnExportOutputs", "click", exportOutputs);
  safeAddEventListener("prevPageOutputs", "click", () => {
    outputsPage = Math.max(0, outputsPage - 1);
    loadOutputs();
  });
  safeAddEventListener("nextPageOutputs", "click", () => {
    outputsPage += 1;
    loadOutputs();
  });

  // Overrides
  safeAddEventListener("btnLoadOverrides", "click", loadOverrides);
  safeAddEventListener("btnUpsertOverride", "click", upsertOverride);
  safeAddEventListener("btnDeleteOverride", "click", deleteOverride);
  safeAddEventListener("btnExportOverrides", "click", exportOverrides);

  // Exceptions (client-side MVP join)
  safeAddEventListener("btnLoadExceptions", "click", loadExceptions);
  safeAddEventListener("btnExportExceptions", "click", exportExceptions);

  // Make the missing tiles clickable to show detailed lists
  safeAddEventListener("tileMissLLT", "click", () => showMissingModal("llt"));
  safeAddEventListener("tileMissSeason", "click", () =>
    showMissingModal("seasonal")
  );

  safeAddEventListener("btnPublish", "click", async () => {
    try {
      const plan_key = (document.getElementById("pubKey")?.value || "").trim();
      const as_of_date = document.getElementById("pubAsOf")?.value || null;
      const notes = document.getElementById("pubNotes")?.value || null;

      if (!plan_key) {
        showModal("Please provide a Plan Key (e.g., Plan 2025-11 (R1)).");
        return;
      }

      // 1) Create header
      const { data: hdrIns, error: hdrErr } = await supabase
        .from("plan_publish_headers")
        .insert([{ plan_key, as_of_date, notes }])
        .select("id")
        .single();

      if (hdrErr) {
        console.error(hdrErr);
        showModal("Failed to create publish header.");
        return;
      }
      const plan_id = hdrIns.id;

      // 2) Determine window from the page controls
      const fromIso = monthInputToISO(
        document.getElementById("fromDate")?.value
      );
      const toIso = monthInputToISO(document.getElementById("toDate")?.value);
      if (!fromIso || !toIso) {
        showModal("Please set From/To months at the top before publishing.");
        return;
      }

      // 3) Pull rows from Combined plan view for this window (optionally apply filters)
      const { sku_id, region_id, godown_id } = (function () {
        const sku = document.getElementById("skuId")?.value;
        const region = document.getElementById("regionId")?.value;
        const godown = document.getElementById("godownId")?.value;
        return {
          sku_id: sku ? Number(sku) : null,
          region_id: region ? Number(region) : null,
          godown_id: godown ? Number(godown) : null,
        };
      })();

      let q = supabase
        .from("v_forecast_plan_12m")
        .select(
          "sku_id,region_id,godown_id,month_start,demand_baseline,supply_llt,supply_seasonal,supply_final"
        )
        .gte("month_start", fromIso)
        .lte("month_start", toIso)
        .order("sku_id")
        .order("region_id")
        .order("godown_id")
        .order("month_start");

      if (sku_id) q = q.eq("sku_id", sku_id);
      if (region_id) q = q.eq("region_id", region_id);
      if (godown_id) q = q.eq("godown_id", godown_id);

      const { data: rows, error: pullErr } = await q;
      if (pullErr) {
        console.error(pullErr);
        showModal("Failed to read combined plan rows.");
        return;
      }

      if (!rows || rows.length === 0) {
        showModal("No rows found in the selected window to publish.");
        return;
      }

      // 4) Insert lines in chunks
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const payload = slice.map((r) => ({
          plan_id,
          sku_id: r.sku_id,
          region_id: r.region_id,
          godown_id: r.godown_id,
          month_start: r.month_start,
          demand_baseline: r.demand_baseline,
          supply_llt: r.supply_llt,
          supply_seasonal: r.supply_seasonal,
          supply_final: r.supply_final,
        }));
        const { error: insErr } = await supabase
          .from("plan_publish_lines")
          .insert(payload);
        if (insErr) {
          console.error(insErr);
          showModal(`Failed while inserting lines (chunk starting at ${i}).`);
          return;
        }
      }

      showModal(`Published snapshot #${plan_id} with ${rows.length} rows.`);
      const pubKey = document.getElementById("pubKey");
      const pubAsOf = document.getElementById("pubAsOf");
      const pubNotes = document.getElementById("pubNotes");
      if (pubKey) pubKey.value = "";
      if (pubAsOf) pubAsOf.value = "";
      if (pubNotes) pubNotes.value = "";

      // Refresh the list
      await listPublishes();
    } catch (e) {
      console.error(e);
      showModal("Unexpected error while publishing.");
    }
  });
}

// ------------- Boot

// Boot: wait for DOM content to be ready to avoid races where elements are not yet in DOM
(async function boot() {
  if (document.readyState === "loading") {
    await new Promise((resolve) =>
      document.addEventListener("DOMContentLoaded", resolve, { once: true })
    );
  }

  const user = await ensureAuth();
  if (!user) return;

  setupTabs();
  setDefaultWindow();
  wireEvents();

  // Only initialize the forecast UI pieces if the page contains the expected elements
  const hasForecastUI = !!(
    document.getElementById("tileWindow") ||
    document.getElementById("tilePairs") ||
    document.getElementById("tileRows") ||
    document.getElementById("tileMissLLT") ||
    document.getElementById("runsTable")
  );

  if (hasForecastUI) {
    // Initialize run controls for forecast job UI
    initRunControls();

    await loadOverviewTiles();
    await loadRunsTable();
    await listPublishes();
  }
})();
