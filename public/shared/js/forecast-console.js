import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

// ------------- Helpers
// --- Additional helpers for forecast job control ---
function fmt(d) {
  // Minimal date formatter: callers expect an ISO-ish short date or string.
  if (!d) return "";
  if (typeof d === "string") return d;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d);
}

// small UI chip helper used by run status messages
const chip = (txt, tone = "") => `<span class="chip ${tone}">${txt}</span>`;

// setStatus: update the Run Controls status area (id="runStatus") if present
function setStatus(html) {
  try {
    const el = document.getElementById("runStatus");
    if (el) {
      // allow passing DOM nodes or strings
      if (typeof html === "string") el.innerHTML = html;
      else if (html instanceof Node) {
        el.innerHTML = "";
        el.appendChild(html);
      } else el.textContent = String(html);
    } else {
      // fallback to console when runStatus isn't present
      // keep behavior non-breaking for other embed contexts
      console.info("runStatus:", html);
    }
  } catch (e) {
    console.error("setStatus error", e);
  }
}

// Minimal RPC wrapper used by the Run Controls
async function rpcApplyMarketingOverrides(_from = null, _to = null) {
  // Call server RPC apply_marketing_overrides; demand-overrides expects this name
  try {
    const { data, error } = await supabase.rpc("apply_marketing_overrides", {
      p_from: _from,
      p_to: _to,
    });
    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

async function rpcEnqueueForecast(
  jobType,
  asOfDate,
  dryRun = false,
  priority = 10
) {
  try {
    const { data, error } = await supabase.rpc("enqueue_forecast_job", {
      p_job_type: jobType,
      p_as_of_date: asOfDate,
      p_dry_run: !!dryRun,
      p_priority: priority,
    });
    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

// ---------- Button handlers ----------
async function onPrimaryRun() {
  const dryRun = document.getElementById("dryRun")?.checked ?? false;
  const asOfRaw = document.getElementById("asOfDate")?.value || "";
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
}

async function onFullRebuild() {
  const dryRun = document.getElementById("dryRun")?.checked ?? false;
  const asOfRaw = document.getElementById("asOfDate")?.value || "";
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
}

// ---------- wire up run controls ----------
function initRunControls() {
  const a = document.getElementById("btnApplyOverridesAndDerived");
  const b = document.getElementById("btnFullRebuild");
  if (a) a.addEventListener("click", onPrimaryRun);
  if (b) b.addEventListener("click", onFullRebuild);
  // tracker removed: do not auto-start polling for recent runs
}
// Wire HOME button with a platform-aware, capture-phase handler so it cannot
// be unintentionally overridden by other modules (the demand-overrides module
// injects many controls; we must ensure HOME always goes to the app root).
// On HTTP(S) use absolute '/index.html' to avoid resolving relative to
// '/public/shared/...'. For file:// (Electron) fall back to '../../index.html'.
try {
  document.addEventListener(
    "click",
    (ev) => {
      try {
        const btn = ev.target?.closest ? ev.target.closest("#homeBtn") : null;
        if (!btn) return;
        // intercept and prevent other handlers
        ev.preventDefault();
        ev.stopImmediatePropagation();
        if (location.protocol && location.protocol.startsWith("http")) {
          window.location.href = "/index.html";
        } else {
          window.location.href = "../../index.html";
        }
      } catch {
        // best-effort fallback
        try {
          Platform.goHome();
        } catch {
          /* ignore */
        }
      }
    },
    true /* capture phase */
  );
} catch {
  /* ignore */
}
function showModal(message, title = "Notice") {
  const dlg = document.getElementById("fcModal");
  if (!dlg) return alert(message); // graceful fallback

  const titleEl = document.getElementById("fcModalTitle");
  const msgEl = document.getElementById("fcModalMessage");
  // If modal exists but its internal elements are missing, fallback to alert
  if (!titleEl || !msgEl) return alert(`${title}: ${String(message)}`);
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
            <button id="missingCopy" class="btn">Copy</button>
            <button id="missingDownload" class="btn btn-primary">Download CSV</button>
            <button id="missingClose" class="btn">Close</button>
          </div>
        </div>
        <div id="missingTableWrap" style="max-height:60vh;overflow:auto;border:1px solid #eee;padding:6px;"></div>
        <div id="missingPager" style="margin-top:8px;display:flex;align-items:center;justify-content:space-between;">
          <div id="missingCount">&nbsp;</div>
          <div>
            <button id="missingPrev" class="btn">Prev</button>
            <button id="missingNext" class="btn">Next</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Ensure table styles are present for the modal table
    if (!document.getElementById("fc-missing-table-styles")) {
      const ts = document.createElement("style");
      ts.id = "fc-missing-table-styles";
      ts.textContent = `
        .fc-missing-table{ width:100%; border-collapse:collapse; font-size:13px; }
        .fc-missing-table thead th{ position:sticky; top:0; background:#f7f7f8; z-index:1; text-align:left; padding:8px 10px; border:1px solid #e9e9ea; }
        .fc-missing-table th, .fc-missing-table td{ padding:8px 10px; border:1px solid #e9e9ea; }
        .fc-missing-table tbody tr:nth-child(odd){ background:#ffffff; }
        .fc-missing-table tbody tr:nth-child(even){ background:#fbfbfb; }
        .fc-missing-table td{ vertical-align:middle; }
        @media (max-width:640px){ .fc-missing-table th, .fc-missing-table td{ padding:6px 8px; font-size:12px; } }
      `;
      document.head.appendChild(ts);
    }

    document
      .getElementById("missingClose")
      .addEventListener("click", () => modal.remove());
  }

  const title = document.getElementById("missingTitle");
  title.textContent = kind === "llt" ? "Missing LLT" : "Missing Seasonal";

  const wrap = document.getElementById("missingTableWrap");
  const countEl = document.getElementById("missingCount");
  const prevBtn = document.getElementById("missingPrev");
  const nextBtn = document.getElementById("missingNext");
  const copyBtn = document.getElementById("missingCopy");
  const downloadBtn = document.getElementById("missingDownload");

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

      // Use authoritative counts from materialized view RPC to avoid mismatch with
      // dashboard tiles (the MV may differ from live view). This RPC returns many
      // health counts; pick the appropriate one based on kind.
      let total = Number(rows[0].total_count || 0);
      try {
        const { data: cdata, error: cerr } = await supabase.rpc(
          "count_forecast_health_mv",
          {
            p_start: startISO,
            p_end: endISO,
          }
        );
        if (!cerr && cdata) {
          const row = Array.isArray(cdata) ? cdata[0] : cdata;
          if (
            kind === "llt" &&
            typeof row?.missing_llt_relevant !== "undefined"
          ) {
            total = Number(row.missing_llt_relevant ?? total);
          } else if (
            kind === "seasonal" &&
            typeof row?.missing_seasonal_relevant !== "undefined"
          ) {
            total = Number(row.missing_seasonal_relevant ?? total);
          }
        }
      } catch (err) {
        console.debug("count_forecast_health_mv unavailable", err);
      }

      countEl.textContent = `Page ${page + 1} — ${
        rows.length
      } rows (total ${total})`;

      // build table
      const table = document.createElement("table");
      table.className = "small fc-missing-table";
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
      if (downloadBtn) {
        downloadBtn.onclick = () => {
          const cols = [
            "sku_id",
            "item",
            "pack_size",
            "uom",
            "month_start",
            "region_id",
            "godown_id",
          ];
          const csv2 = rowsToCsv(rows, cols);
          const y = new Date();
          const yyyymmdd = `${y.getFullYear()}${String(
            y.getMonth() + 1
          ).padStart(2, "0")}${String(y.getDate()).padStart(2, "0")}`;
          const kindLabel = kind === "llt" ? "llt" : "seasonal";
          downloadFile(`missing_${kindLabel}_${yyyymmdd}.csv`, csv2);
        };
      }
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
  const sku = document.getElementById("skuId")?.value || "";
  const region = document.getElementById("regionId")?.value || "";
  const godown = document.getElementById("godownId")?.value || "";
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

    // Auto-load Outputs tab when shown: set sane defaults and trigger load
    try {
      if (panelId === "tab-outputs") {
        // Ensure dataset default is Baseline (effective) when empty
        const dsEl = document.getElementById("outputsDataset");
        if (dsEl && !dsEl.value)
          dsEl.value = dsEl.querySelector("option")?.value || "baseline";
        // Ensure outputs FROM/TO default to current month when empty
        const of = document.getElementById("outputsFrom");
        const ot = document.getElementById("outputsTo");
        if (of && !of.value) of.value = fmtMonthInput(monthFloor(new Date()));
        if (ot && !ot.value) ot.value = fmtMonthInput(monthFloor(new Date()));
        // Reset paging and load
        outputsPage = 0;
        loadOutputs();
      }
    } catch (e) {
      console.debug("auto-load outputs failed:", e);
    }

    // Auto-load Exceptions tab when shown: reset paging and trigger load
    try {
      if (panelId === "tab-exceptions") {
        // Ensure exceptions page-size select reflects current PAGE_SIZE if present
        try {
          const ep = document.getElementById("exceptionsPageSize");
          if (ep) ep.value = String(PAGE_SIZE);
        } catch (inner) {
          void inner;
        }
        exceptionsPage = 0;
        loadExceptions();
      }
    } catch (e) {
      console.debug("auto-load exceptions failed:", e);
    }

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

// Set defaults for the Outputs window inputs (if present)
function setDefaultOutputsWindow() {
  const from = document.getElementById("outputsFrom");
  const to = document.getElementById("outputsTo");
  // Default both From and To to current month (user requested current month defaults)
  const now = monthFloor(new Date());
  if (from) from.value = fmtMonthInput(now);
  if (to) to.value = fmtMonthInput(now);
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
  // Make missing tiles visually clickable and keyboard accessible
  try {
    if (!document.getElementById("fc-missing-styles")) {
      const s = document.createElement("style");
      s.id = "fc-missing-styles";
      s.textContent = `
        .fc-clickable-tile{ cursor: pointer; user-select: none; }
        /* keep hover non-invasive: no lift/shadow; subtle border color hint */
        .fc-clickable-tile:hover{ border-color: rgba(15,23,42,0.12); }
      `;
      document.head.appendChild(s);
    }
    if (elMissLLT) {
      elMissLLT.classList.add("fc-clickable-tile");
      elMissLLT.setAttribute("role", "button");
      elMissLLT.setAttribute("tabindex", "0");
      elMissLLT.setAttribute("title", "Click to view missing LLT rows");
      elMissLLT.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") showMissingModal("llt");
      });
    }
    if (elMissSeason) {
      elMissSeason.classList.add("fc-clickable-tile");
      elMissSeason.setAttribute("role", "button");
      elMissSeason.setAttribute("tabindex", "0");
      elMissSeason.setAttribute("title", "Click to view missing Seasonal rows");
      elMissSeason.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") showMissingModal("seasonal");
      });
    }
  } catch {
    /* non-fatal */
  }
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
      const elOv = document.getElementById("tileOverrides");
      if (elOv) elOv.textContent = "-";
    } else {
      const elOv = document.getElementById("tileOverrides");
      if (elOv) elOv.textContent = count ?? 0;
    }
  }
}

async function loadRunsTable() {
  const tbody = document.querySelector("#runsTable tbody");
  if (!tbody) return; // table not present on this page
  tbody.innerHTML = "";
  // Try the recent-runs view first; if it's not present or lacks expected
  // columns, gracefully fall back to the raw table. Use a small helper to
  // map a column to one of several candidate field names.
  function pick(r, candidates) {
    for (const c of candidates) {
      if (typeof r[c] !== "undefined" && r[c] !== null) return r[c];
    }
    return null;
  }

  // Query the view (preferred), but if it fails try the base table
  let res = await supabase
    .from("v_forecast_runs_recent")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (res.error) {
    // view might not exist; try the raw table
    try {
      res = await supabase
        .from("forecast_run")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
    } catch (err) {
      console.error("loadRunsTable: fallback query failed", err);
      return;
    }
  }

  const { data, error } = res;
  if (error) {
    console.error(error);
    return;
  }

  // If the view omitted module/horizon, fetch them from the base table for
  // all runs we retrieved (batch query by id) and merge into each row.
  let enrichMap = null;
  try {
    const needsEnrich = (data || []).some((row) => {
      return (
        typeof row.module_slot === "undefined" ||
        row.module_slot === null ||
        typeof row.horizon_months === "undefined" ||
        row.horizon_months === null
      );
    });
    if (needsEnrich) {
      const ids = (data || []).map((row) => row.id).filter(Boolean);
      if (ids.length) {
        const { data: baseRows, error: baseErr } = await supabase
          .from("forecast_run")
          .select("id,module_slot,horizon_months")
          .in("id", ids);
        if (!baseErr && Array.isArray(baseRows)) {
          enrichMap = new Map(baseRows.map((b) => [b.id, b]));
        }
      }
    }
  } catch (err) {
    console.debug("loadRunsTable: enrich failed", err);
  }

  // small helper: format ISO timestamps to `YYYY-MM-DD HH:MM` in IST (UTC+5:30)
  function formatDateTime(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    // shift to IST (UTC+5:30)
    const istOffsetMs = (5 * 60 + 30) * 60 * 1000; // 5.5 hours
    const ist = new Date(d.getTime() + istOffsetMs);
    // use UTC getters on the shifted time so it's independent of the client's TZ
    const y = ist.getUTCFullYear();
    const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
    const day = String(ist.getUTCDate()).padStart(2, "0");
    const hh = String(ist.getUTCHours()).padStart(2, "0");
    const min = String(ist.getUTCMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${hh}:${min}`;
  }

  (data || []).forEach((r) => {
    const id = pick(r, ["id", "run_id", "forecast_run_id"]) ?? "";
    let moduleSlot = pick(r, ["module_slot", "module", "job_type"]) ?? "";
    const asOf = pick(r, ["as_of_date", "as_of", "as_of_iso"]) ?? "";
    let horizon = pick(r, ["horizon_months", "horizon", "horizon_m"]) ?? "";
    const status = pick(r, ["status"]) ?? "";
    const created = pick(r, ["created_at", "started_at", "queued_at"]) ?? "";
    const closed = pick(r, ["closed_at", "finished_at"]) ?? "";
    const createdFmt = formatDateTime(created);
    const closedFmt = formatDateTime(closed);

    // Merge enrichment if available
    if (enrichMap && enrichMap.has(r.id)) {
      const b = enrichMap.get(r.id);
      if (!moduleSlot && b.module_slot) moduleSlot = b.module_slot;
      if (!horizon && typeof b.horizon_months !== "undefined")
        horizon = b.horizon_months;
    }

    // notes may be present on the table; the view often exposes row counts.
    let notes = "";
    if (typeof r.notes === "string") {
      notes = r.notes;
    } else if (r.notes) {
      try {
        notes = JSON.stringify(r.notes);
      } catch {
        notes = String(r.notes);
      }
    } else {
      // If notes absent, but the view provides row counts, show those.
      const rb = pick(r, ["rows_base", "rows_baseline", "rows_baseline_count"]);
      const rl = pick(r, ["rows_llt", "rows_llts", "rows_llt_count"]);
      const rs = pick(r, [
        "rows_seasonal",
        "rows_season",
        "rows_seasonal_count",
      ]);
      const parts = [];
      if (rb !== null) parts.push(`base:${rb}`);
      if (rl !== null) parts.push(`llt:${rl}`);
      if (rs !== null) parts.push(`seasonal:${rs}`);
      notes = parts.join(" ") || "";
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(id)}</td>
      <td>${escapeHtml(moduleSlot)}</td>
      <td>${escapeHtml(asOf)}</td>
      <td>${escapeHtml(horizon)}</td>
      <td>${escapeHtml(status)}</td>
  <td>${escapeHtml(createdFmt)}</td>
  <td>${escapeHtml(closedFmt)}</td>
      <td class="small muted">${escapeHtml(notes)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ------------- Model Outputs
let outputsPage = 0;
let PAGE_SIZE = 100;
// Exceptions paging state
let exceptionsPage = 0;

// In-memory metadata caches to avoid repeated DB lookups while paging
// Lightweight LRU + TTL cache used for metadata lookups.
// Keeps insertion/access order in a Map; when size exceeds `maxEntries` the
// oldest entry is evicted. Each entry can have an expiry (TTL in ms) and
// expired entries are treated as missing.
class LRUCache {
  constructor({ maxEntries = 2000, ttlMs = 1000 * 60 * 60 } = {}) {
    this.max = maxEntries;
    this.ttl = ttlMs;
    this.map = new Map(); // key -> { value, expiresAt }
  }

  _isExpired(entry) {
    return !!(entry && entry.expiresAt && Date.now() > entry.expiresAt);
  }

  get(key) {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (this._isExpired(e)) {
      this.map.delete(key);
      return undefined;
    }
    // refresh LRU position
    this.map.delete(key);
    this.map.set(key, e);
    return e.value;
  }

  has(key) {
    const e = this.map.get(key);
    if (!e) return false;
    if (this._isExpired(e)) {
      this.map.delete(key);
      return false;
    }
    return true;
  }

  set(key, value) {
    const expiresAt = this.ttl ? Date.now() + this.ttl : null;
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt });
    // evict oldest if over limit
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
  }

  delete(key) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }

  keys() {
    return Array.from(this.map.keys());
  }
}

// Instantiate caches with reasonable defaults. SKU metadata changes more
// frequently across sessions, so keep a shorter TTL; region/godown codes are
// relatively stable so a longer TTL is fine.
const skuMetadataCache = new LRUCache({
  maxEntries: 2000,
  ttlMs: 1000 * 60 * 60,
}); // 1 hour
const regionCodeCache = new LRUCache({
  maxEntries: 2000,
  ttlMs: 1000 * 60 * 60 * 24,
}); // 24 hours
const godownCodeCache = new LRUCache({
  maxEntries: 2000,
  ttlMs: 1000 * 60 * 60 * 24,
}); // 24 hours

// Debug helper: allow clearing caches from console if needed
window.clearForecastMetadataCache = function () {
  try {
    skuMetadataCache.clear();
    regionCodeCache.clear();
    godownCodeCache.clear();
    console.info("Forecast metadata caches cleared");
  } catch (e) {
    console.warn("Failed to clear forecast metadata caches", e);
  }
};

async function ensureSkuMetadata(ids) {
  const missing = ids.filter((id) => id && !skuMetadataCache.has(id));
  if (!missing.length) return;
  try {
    const { data: sdata, error: sErr } = await supabase
      .from("v_sku_catalog_enriched")
      .select("sku_id,item,pack_size,uom,sku_label")
      .in("sku_id", missing);
    if (!sErr && sdata) {
      for (const s of sdata) {
        skuMetadataCache.set(Number(s.sku_id), {
          item: s.item || s.sku_label || "",
          pack_size: s.pack_size ?? "",
          uom: s.uom ?? "",
          sku_label: s.sku_label ?? "",
        });
      }
    }
  } catch (e) {
    console.debug("ensureSkuMetadata failed", e);
  }
}

async function ensureRegionCodes(ids) {
  const missing = ids.filter((id) => id && !regionCodeCache.has(id));
  if (!missing.length) return;
  try {
    const { data: rdata, error: rErr } = await supabase
      .from("v_sdv_dim_godown_region")
      .select("region_id,region_code")
      .in("region_id", missing);
    if (!rErr && rdata) {
      for (const r of rdata)
        regionCodeCache.set(Number(r.region_id), r.region_code);
    }
  } catch (e) {
    console.debug("ensureRegionCodes failed", e);
  }
}

async function ensureGodownCodes(ids) {
  const missing = ids.filter((id) => id && !godownCodeCache.has(id));
  if (!missing.length) return;
  try {
    const { data: gdata, error: gErr } = await supabase
      .from("v_sdv_dim_godown_region")
      .select("godown_id,godown_code")
      .in("godown_id", missing);
    if (!gErr && gdata) {
      for (const g of gdata)
        godownCodeCache.set(Number(g.godown_id), g.godown_code);
    }
  } catch (e) {
    console.debug("ensureGodownCodes failed", e);
  }
}

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
  const dsEl = document.getElementById("outputsDataset");
  const head = document.getElementById("outputsHeader");
  const body = document.getElementById("outputsBody");
  if (!dsEl || !head || !body) return; // outputs UI missing
  const ds = dsEl.value;
  const cfg = buildOutputsQuery(ds);
  head.innerHTML = "";
  body.innerHTML = "";

  // Prefer outputs-specific window inputs when present, fall back to global window
  let { from, to } = getWindow();
  try {
    const of = document.getElementById("outputsFrom")?.value;
    const ot = document.getElementById("outputsTo")?.value;
    const ofISO = monthInputToISO(of);
    const otISO = monthInputToISO(ot);
    // If both month inputs provided, use them
    if (ofISO) from = ofISO;
    if (otISO) to = otISO;
  } catch {
    // ignore and continue with global window
  }

  // Local outputs filters (UI fields)
  const skuInput = document.getElementById("outputsSku")?.value?.trim();
  const itemInput = document.getElementById("outputsItem")?.value?.trim();
  const regionCodeInput = document
    .getElementById("outputsRegion")
    ?.value?.trim();
  const godownCodeInput = document
    .getElementById("outputsGodown")
    ?.value?.trim();
  const filterOverride = !!document.getElementById("outputsFilterOverride")
    ?.checked;
  const filterSupplyLlt = !!document.getElementById("outputsFilterSupplyLlt")
    ?.checked;
  const filterSupplySeasonal = !!document.getElementById(
    "outputsFilterSupplySeasonal"
  )?.checked;

  // Resolve textual filters to ids when necessary (item -> sku_ids, region/godown codes -> ids)
  let skuIdsFromItem = [];
  if (itemInput) {
    try {
      const { data: skudata, error: skuErr } = await supabase
        .from("v_sku_catalog_enriched")
        .select("sku_id")
        .ilike("item", `%${itemInput}%`);
      if (!skuErr && skudata)
        skuIdsFromItem = skudata.map((s) => Number(s.sku_id)).filter(Boolean);
    } catch (e) {
      console.debug("item -> sku lookup failed", e);
    }
  }

  let regionIdsFromCode = [];
  if (regionCodeInput) {
    try {
      const { data: rdata, error: rErr } = await supabase
        .from("v_sdv_dim_godown_region")
        .select("region_id")
        .ilike("region_code", `%${regionCodeInput}%`);
      if (!rErr && rdata)
        regionIdsFromCode = rdata
          .map((r) => Number(r.region_id))
          .filter(Boolean);
    } catch (e) {
      console.debug("region code lookup failed", e);
    }
  }

  let godownIdsFromCode = [];
  if (godownCodeInput) {
    try {
      const { data: gdata, error: gErr } = await supabase
        .from("v_sdv_dim_godown_region")
        .select("godown_id")
        .ilike("godown_code", `%${godownCodeInput}%`);
      if (!gErr && gdata)
        godownIdsFromCode = gdata
          .map((g) => Number(g.godown_id))
          .filter(Boolean);
    } catch (e) {
      console.debug("godown code lookup failed", e);
    }
  }

  // Also respect any global filters (if present elsewhere)
  const {
    sku_id: globalSkuId,
    region_id: globalRegionId,
    godown_id: globalGodownId,
  } = getFilters();

  // Request exact count so we can show "Page X of Y" in the paginator
  let q = supabase
    .from(cfg.table)
    .select(cfg.cols.join(","), { count: "exact" });
  if (from) q = q.gte("month_start", from);
  if (to) q = q.lte("month_start", to);

  // SKU filter precedence: explicit SKU ID input > item-derived sku ids > global filter
  if (skuInput) {
    const n = Number(skuInput);
    if (!Number.isNaN(n)) q = q.eq("sku_id", n);
  } else if (skuIdsFromItem.length) {
    q = q.in("sku_id", skuIdsFromItem);
  } else if (globalSkuId) {
    q = q.eq("sku_id", globalSkuId);
  }

  // Region / Godown: prefer code-based lookups, fall back to global filters
  if (regionIdsFromCode.length) q = q.in("region_id", regionIdsFromCode);
  else if (globalRegionId) q = q.eq("region_id", globalRegionId);

  if (godownIdsFromCode.length) q = q.in("godown_id", godownIdsFromCode);
  else if (globalGodownId) q = q.eq("godown_id", globalGodownId);

  // Dataset-specific boolean filters (only apply when relevant)
  // When checked, these boxes should filter rows where the column is
  // present and non-zero (not null AND not equal to 0).
  if (ds === "baseline" && filterOverride) {
    q = q.not("override_delta", "is", null).neq("override_delta", 0);
  }
  if (ds === "combined") {
    if (filterSupplyLlt)
      q = q.not("supply_llt", "is", null).neq("supply_llt", 0);
    if (filterSupplySeasonal)
      q = q.not("supply_seasonal", "is", null).neq("supply_seasonal", 0);
  }

  q = q
    .order("sku_id")
    .order("region_id")
    .order("godown_id")
    .order("month_start")
    .range(outputsPage * PAGE_SIZE, outputsPage * PAGE_SIZE + PAGE_SIZE - 1);

  const { data, error, count } = await q;
  if (error) {
    console.error(error);
    const pageInfoErr = document.getElementById("pageInfoOutputs");
    if (pageInfoErr) pageInfoErr.textContent = "Error loading.";
    return;
  }

  // Determine display columns: prefer expanded SKU / region / godown labels
  const hasSku = cfg.cols.includes("sku_id");
  const hasRegion = cfg.cols.includes("region_id");
  const hasGodown = cfg.cols.includes("godown_id");

  const otherCols = cfg.cols.filter(
    (c) => !["sku_id", "region_id", "godown_id"].includes(c)
  );

  // desired order: SKU ID, ITEM, PACK SIZE, UOM, REGION, GODOWN, ...otherCols
  const displayCols = [];
  if (hasSku) {
    displayCols.push("sku_id", "item", "pack_size", "uom");
  }
  if (hasRegion) displayCols.push("region");
  if (hasGodown) displayCols.push("godown");
  displayCols.push(...otherCols);

  // Fetch metadata for SKUs, regions and godowns in this page so we can render labels
  const skuIds = Array.from(
    new Set((data || []).map((r) => Number(r.sku_id)).filter(Boolean))
  );
  const regionIds = Array.from(
    new Set((data || []).map((r) => Number(r.region_id)).filter(Boolean))
  );
  const godownIds = Array.from(
    new Set((data || []).map((r) => Number(r.godown_id)).filter(Boolean))
  );

  const skuMap = new Map();
  const regionMap = new Map();
  const godownMap = new Map();

  // Use in-memory caches: ensure metadata for missing ids only
  await ensureSkuMetadata(skuIds);
  for (const id of skuIds) {
    const m = skuMetadataCache.get(Number(id));
    if (m) skuMap.set(Number(id), m);
  }

  await ensureGodownCodes(godownIds);
  for (const id of godownIds) {
    const code = godownCodeCache.get(Number(id));
    if (code) godownMap.set(Number(id), code);
  }

  await ensureRegionCodes(regionIds);
  for (const id of regionIds) {
    const code = regionCodeCache.get(Number(id));
    if (code) regionMap.set(Number(id), code);
  }

  // header
  displayCols.forEach((c) => {
    const th = document.createElement("th");

    // dataset-aware pretty labels
    const prettyLabel = (col, dataset) => {
      // base overrides for commonly-expanded columns
      if (col === "sku_id") return "SKU ID";
      if (col === "item") return "ITEM";
      if (col === "pack_size") return "PACK SIZE";
      if (col === "uom") return "UOM";
      if (col === "region") return "REGION";
      if (col === "godown") return "GODOWN";
      if (col === "month_start") return "MONTH";

      // dataset-specific overrides
      const ds = (dataset || "").toLowerCase();
      if (ds === "baseline") {
        if (col === "demand_baseline") return "DEMAND BASELINE";
        if (col === "override_delta") return "OVERRIDE Δ";
        if (col === "demand_effective") return "DEMAND EFFECTIVE";
      }
      if (ds === "llt" || ds === "seasonal") {
        if (col === "y_supply") return "Y SUPPLY";
      }
      if (ds === "combined") {
        if (col === "demand_effective") return "DEMAND EFFECTIVE";
        if (col === "supply_llt") return "SUPPLY LLT";
        if (col === "supply_seasonal") return "SUPPLY SEASONAL";
        if (col === "supply_final") return "SUPPLY FINAL";
        if (col === "demand_baseline") return "DEMAND BASELINE";
      }

      // fallback: turn snake_case into words and uppercase
      return String(col).replace(/_/g, " ").toUpperCase();
    };

    th.textContent = prettyLabel(c, ds);
    // add classes so we can control alignment via CSS
    if (c === "item") th.classList.add("col-item");
    else th.classList.add("col-center");
    head.appendChild(th);
  });

  // rows
  (data || []).forEach((r) => {
    const tr = document.createElement("tr");
    const cells = displayCols.map((c) => {
      if (c === "sku_id")
        return `<td class="col-center">${escapeHtml(r.sku_id ?? "")}</td>`;
      if (c === "item") {
        const m = skuMap.get(Number(r.sku_id));
        return `<td class="col-item">${escapeHtml(
          m?.item ?? r.sku_label ?? ""
        )}</td>`;
      }
      if (c === "pack_size") {
        const m = skuMap.get(Number(r.sku_id));
        return `<td class="col-center">${escapeHtml(m?.pack_size ?? "")}</td>`;
      }
      if (c === "month_start") {
        const ms = r.month_start;
        let mlabel = "";
        try {
          if (ms) mlabel = formatMonthLabel(new Date(ms + "T00:00:00"));
        } catch {
          mlabel = String(ms || "");
        }
        return `<td class="col-center">${escapeHtml(mlabel)}</td>`;
      }
      if (c === "uom") {
        const m = skuMap.get(Number(r.sku_id));
        return `<td class="col-center">${escapeHtml(m?.uom ?? "")}</td>`;
      }
      if (c === "region") {
        const code = regionMap.get(Number(r.region_id));
        return `<td class="col-center">${escapeHtml(
          code ?? r.region_id ?? ""
        )}</td>`;
      }
      if (c === "godown") {
        const code = godownMap.get(Number(r.godown_id));
        return `<td class="col-center">${escapeHtml(
          code ?? r.godown_id ?? ""
        )}</td>`;
      }
      return `<td class="col-center">${escapeHtml(r[c] ?? "")}</td>`;
    });
    tr.innerHTML = cells.join("");
    body.appendChild(tr);
  });

  // row counter removed — page info/paginator shows counts instead
  const pageInfo = document.getElementById("pageInfoOutputs");
  const prevBtn = document.getElementById("prevPageOutputs");
  const nextBtn = document.getElementById("nextPageOutputs");
  const total = Number(count || 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pageInfo)
    pageInfo.textContent = `Page ${
      outputsPage + 1
    } of ${totalPages} (${total} records)`;
  if (prevBtn) prevBtn.disabled = outputsPage === 0;
  if (nextBtn) nextBtn.disabled = outputsPage + 1 >= totalPages;
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

// Overrides removed: Load / Save / Delete / Export controls and table

// ------------- Exceptions (next phase: client-side join MVP)
async function loadExceptions() {
  const status = document.getElementById("exceptionsStatus");
  const tbody = document.querySelector("#exceptionsTable tbody");
  if (!tbody) return; // UI missing
  tbody.innerHTML = "";
  if (status) status.textContent = "Loading...";

  // derive window
  let { from, to } = getWindow();
  if (!from || !to) {
    const w = fenceWindow(new Date(), 25, 12);
    from = w.start;
    to = w.end;
  }

  try {
    // Build filter params from UI inputs (allow code lookups for region/godown and item->sku mapping)
    const skuInput = (
      document.getElementById("exceptionsSku")?.value || ""
    ).trim();
    const itemInput = (
      document.getElementById("exceptionsItem")?.value || ""
    ).trim();
    const regionInput = (
      document.getElementById("exceptionsRegion")?.value || ""
    ).trim();
    const godownInput = (
      document.getElementById("exceptionsGodown")?.value || ""
    ).trim();
    const filterSupplyLlt = !!document.getElementById(
      "exceptionsFilterSupplyLlt"
    )?.checked;
    const filterSupplySeasonal = !!document.getElementById(
      "exceptionsFilterSupplySeasonal"
    )?.checked;

    // Try to resolve SKU via numeric input or item text lookup
    let p_sku_id = null;
    let skuIdsFromItem = [];
    if (skuInput) {
      const n = Number(skuInput);
      if (!Number.isNaN(n)) p_sku_id = n;
    }
    if (!p_sku_id && itemInput) {
      try {
        const { data: sdata, error: sErr } = await supabase
          .from("v_sku_catalog_enriched")
          .select("sku_id")
          .ilike("item", `%${itemInput}%`)
          .limit(500);
        if (!sErr && sdata)
          skuIdsFromItem = sdata.map((s) => Number(s.sku_id)).filter(Boolean);
      } catch (e) {
        console.debug("item->sku lookup failed", e);
      }
      if (skuIdsFromItem.length === 1) p_sku_id = skuIdsFromItem[0];
    }

    // Resolve region/godown by numeric id or code lookup (may return multiple)
    let p_region_id = null;
    let regionIdsFromCode = [];
    if (regionInput) {
      const n = Number(regionInput);
      if (!Number.isNaN(n)) p_region_id = n;
      else {
        try {
          const { data: rdata, error: rErr } = await supabase
            .from("v_sdv_dim_godown_region")
            .select("region_id")
            .ilike("region_code", `%${regionInput}%`)
            .limit(500);
          if (!rErr && rdata)
            regionIdsFromCode = rdata
              .map((r) => Number(r.region_id))
              .filter(Boolean);
        } catch (e) {
          console.debug("region code lookup failed", e);
        }
        if (regionIdsFromCode.length === 1) p_region_id = regionIdsFromCode[0];
      }
    }

    let p_godown_id = null;
    let godownIdsFromCode = [];
    if (godownInput) {
      const n = Number(godownInput);
      if (!Number.isNaN(n)) p_godown_id = n;
      else {
        try {
          const { data: gdata, error: gErr } = await supabase
            .from("v_sdv_dim_godown_region")
            .select("godown_id")
            .ilike("godown_code", `%${godownInput}%`)
            .limit(500);
          if (!gErr && gdata)
            godownIdsFromCode = gdata
              .map((g) => Number(g.godown_id))
              .filter(Boolean);
        } catch (e) {
          console.debug("godown code lookup failed", e);
        }
        if (godownIdsFromCode.length === 1) p_godown_id = godownIdsFromCode[0];
      }
    }

    // Call server RPC which applies product-flag filtering and pagination
    const { data, error } = await supabase.rpc("rpc_forecast_exceptions", {
      p_start: from,
      p_end: to,
      p_sku_id: p_sku_id,
      p_region_id: p_region_id,
      p_godown_id: p_godown_id,
      p_page: Math.max(1, exceptionsPage + 1),
      p_page_size: Math.max(1, PAGE_SIZE),
      p_treat_zero_missing: false,
      p_include_unknown_mappings: false,
    });
    if (error) throw error;

    // supabase may return the JSON result directly or wrapped in an array
    const payload = Array.isArray(data) ? data[0] || {} : data || {};
    let rows = payload.rows || [];

    // Build a small client-side filter helper that's used when the UI
    // needs to refine results that cannot be expressed server-side
    // (e.g. free-text ITEM matches or post-return supply-NULL relevance).
    const truthyFlag = (v) => {
      if (v === true) return true;
      if (v === false || v === null || v === undefined) return false;
      const s = String(v).toLowerCase();
      return s === "t" || s === "true" || s === "1" || s === "yes";
    };

    function applyClientFiltersToArray(src) {
      let out = src || [];
      if (skuIdsFromItem.length > 1) {
        const q = String(itemInput || "").toLowerCase();
        if (q)
          out = out.filter(
            (r) =>
              String(r.item || r.sku_label || "")
                .toLowerCase()
                .includes(q) || skuIdsFromItem.includes(Number(r.sku_id))
          );
      }
      if (regionIdsFromCode.length > 1) {
        const q = String(regionInput || "").toLowerCase();
        if (q)
          out = out.filter((r) =>
            String(r.region_code || r.region_id || "")
              .toLowerCase()
              .includes(q)
          );
      }
      if (godownIdsFromCode.length > 1) {
        const q = String(godownInput || "").toLowerCase();
        if (q)
          out = out.filter((r) =>
            String(r.godown_code || r.godown_id || "")
              .toLowerCase()
              .includes(q)
          );
      }
      if (filterSupplyLlt || filterSupplySeasonal) {
        out = out.filter((r) => {
          const missingLlt =
            r.supply_llt === null ||
            r.supply_llt === undefined ||
            Number(r.supply_llt) === 0;
          const missingSeasonal =
            r.supply_seasonal === null ||
            r.supply_seasonal === undefined ||
            Number(r.supply_seasonal) === 0;
          const isLltRelevant = truthyFlag(r.is_llt);
          const isSeasonalRelevant = truthyFlag(r.is_seasonal);
          const matchLlt = filterSupplyLlt && isLltRelevant && missingLlt;
          const matchSeasonal =
            filterSupplySeasonal && isSeasonalRelevant && missingSeasonal;
          return matchLlt || matchSeasonal;
        });
      }
      return out;
    }

    // Server-provided total for the unfiltered query
    const serverTotal = Number(payload.total_count || 0);
    let renderRows = rows;
    let effectiveTotal = serverTotal;

    const clientFilterUsed =
      skuIdsFromItem.length > 1 ||
      regionIdsFromCode.length > 1 ||
      godownIdsFromCode.length > 1 ||
      filterSupplyLlt ||
      filterSupplySeasonal;

    const MAX_SCAN = 10000; // safety cap
    if (clientFilterUsed) {
      if (serverTotal === 0) {
        renderRows = [];
        effectiveTotal = 0;
      } else if (serverTotal <= MAX_SCAN) {
        // fetch all candidates and apply client filters to compute true total
        try {
          const { data: allPageData, error: allErr } = await supabase.rpc(
            "rpc_forecast_exceptions",
            {
              p_start: from,
              p_end: to,
              p_sku_id: p_sku_id,
              p_region_id: p_region_id,
              p_godown_id: p_godown_id,
              p_page: 1,
              p_page_size: Math.max(1, Math.min(serverTotal, MAX_SCAN)),
              p_treat_zero_missing: false,
              p_include_unknown_mappings: false,
            }
          );
          if (!allErr) {
            const allPayload = Array.isArray(allPageData)
              ? allPageData[0] || {}
              : allPageData || {};
            const allRows = allPayload.rows || [];
            const allFiltered = applyClientFiltersToArray(allRows);
            effectiveTotal = allFiltered.length;
            const start = exceptionsPage * PAGE_SIZE;
            renderRows = allFiltered.slice(start, start + PAGE_SIZE);
          } else {
            console.debug(
              "full-scan rpc failed, falling back to page-only filter",
              allErr
            );
            renderRows = applyClientFiltersToArray(rows);
            effectiveTotal = renderRows.length;
          }
        } catch (e) {
          console.debug(
            "full-scan exception, falling back to page-only filter",
            e
          );
          renderRows = applyClientFiltersToArray(rows);
          effectiveTotal = renderRows.length;
        }
      } else {
        // too many results to scan; apply filters to current page only
        renderRows = applyClientFiltersToArray(rows);
        effectiveTotal = renderRows.length;
        if (status)
          status.textContent = `Filtered (showing ${renderRows.length}) — refine filters to compute full count`;
      }
    } else {
      renderRows = rows;
      effectiveTotal = serverTotal;
    }

    // render with new columns: SKU ID, ITEM, PACK SIZE, UOM, REGION CODE, GODOWN CODE, MONTH (MMM YYYY), DEMAND (EFFECTIVE)
    let shown = 0;
    for (const r of renderRows) {
      try {
        const tr = document.createElement("tr");

        // format month to 'Mon YYYY' if possible, then escape values
        let monthLabel = "";
        try {
          if (r.month_start)
            monthLabel = formatMonthLabel(
              new Date(r.month_start + "T00:00:00")
            );
        } catch (e) {
          monthLabel = String(r.month_start ?? "");
          void e;
        }

        const skuId = escapeHtml(r.sku_id ?? "");
        const item = escapeHtml(r.item ?? r.sku_label ?? "");
        const pack = escapeHtml(r.pack_size ?? "");
        const uom = escapeHtml(r.uom ?? "");
        const region = escapeHtml(r.region_code ?? r.region_id ?? "");
        const godown = escapeHtml(r.godown_code ?? r.godown_id ?? "");
        const demand = escapeHtml(
          r.demand_baseline ?? r.demand_effective ?? ""
        );
        const llt = escapeHtml(r.supply_llt ?? "");
        const seasonal = escapeHtml(r.supply_seasonal ?? "");
        const monthEsc = escapeHtml(monthLabel);

        tr.innerHTML = `
          <td class="col-center">${skuId}</td>
          <td class="col-item">${item}</td>
          <td class="col-center">${pack}</td>
          <td class="col-center">${uom}</td>
          <td class="col-center">${region}</td>
          <td class="col-center">${godown}</td>
          <td class="col-center">${monthEsc}</td>
          <td class="col-center">${demand}</td>
          <td class="col-center">${llt}</td>
          <td class="col-center">${seasonal}</td>
        `;

        tbody.appendChild(tr);
        shown++;
      } catch (rowErr) {
        console.debug("Failed to render exceptions row, skipping:", rowErr, r);
        // append a placeholder row so visible count matches rows processed
        try {
          const tr = document.createElement("tr");
          tr.innerHTML = `<td colspan="10">Error rendering row</td>`;
          tbody.appendChild(tr);
          shown++;
        } catch (e) {
          void e;
        }
      }
    }
    if (status)
      status.textContent = `${effectiveTotal} exceptions (showing ${shown})`;
    // Update paginator UI (page info + prev/next enable state)
    try {
      const pageInfo = document.getElementById("pageInfoExceptions");
      const prevBtn = document.getElementById("prevPageExceptions");
      const nextBtn = document.getElementById("nextPageExceptions");
      const totalPages = Math.max(
        1,
        Math.ceil(Number(effectiveTotal || 0) / PAGE_SIZE)
      );
      if (pageInfo)
        pageInfo.textContent = `Page ${
          exceptionsPage + 1
        } of ${totalPages} (${effectiveTotal} records)`;
      if (prevBtn) prevBtn.disabled = exceptionsPage === 0;
      if (nextBtn) nextBtn.disabled = exceptionsPage + 1 >= totalPages;
    } catch (e) {
      // non-fatal UI update error
      console.debug("Failed to update exceptions paginator UI", e);
    }
  } catch (err) {
    // Improve error visibility: Supabase returns an object with .message/.code/.status
    try {
      const code = err?.code ?? err?.status ?? null;
      const message =
        err?.message ?? err?.error ?? (typeof err === "string" ? err : null);
      console.error("loadExceptions failed:", { code, message, raw: err });
      if (code === 404 || (typeof code === "string" && code.includes("404"))) {
        if (status)
          status.textContent =
            "Error: RPC not found (404). Ensure rpc_forecast_exceptions is deployed in Supabase.";
      } else if (message) {
        if (status) status.textContent = `Error: ${message}`;
      } else {
        if (status) status.textContent = "Error: see console for details";
      }
    } catch (e) {
      // fallback
      console.error(
        "loadExceptions failed (and error formatting failed):",
        err,
        e
      );
      status.textContent = "Error";
    }
  }
}

function exportExceptions() {
  const body = document.querySelector("#exceptionsTable tbody");
  const rows = [...body.querySelectorAll("tr")].map((tr) => {
    const tds = [...tr.children].map((td) => td.textContent);
    return {
      sku_id: tds[0],
      item: tds[1],
      pack_size: tds[2],
      uom: tds[3],
      region_code: tds[4],
      godown_code: tds[5],
      month: tds[6],
      demand_effective: tds[7],
      supply_llt: tds[8],
      supply_seasonal: tds[9],
    };
  });
  downloadFile("exceptions.csv", toCSV(rows));
}

// ------------- Publish (stub - we'll wire batch snapshot next)
async function listPublishes() {
  const tbody = document.querySelector("#publishTable tbody");
  if (!tbody) return; // nothing to list on pages without publish table
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

// ------------- Wire UI events
function wireEvents() {
  // (Marketing Overrides UI removed) Export/Import event listeners removed
  // Helper to safely add event listeners
  function safeAddEventListener(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  }

  function triggerEvents(id, types = ["change"]) {
    const el = document.getElementById(id);
    if (!el) return;
    types.forEach((type) => {
      try {
        el.dispatchEvent(new Event(type, { bubbles: true }));
      } catch {
        /* ignore */
      }
    });
  }

  function requestStagingReload() {
    try {
      window.__DO_stagingPage = 1;
      let invoked = false;
      if (typeof window.loadStaging === "function") {
        window.loadStaging();
        invoked = true;
      } else if (typeof window.loadStagingOverrides === "function") {
        window.loadStagingOverrides();
        invoked = true;
      }
      if (!invoked) {
        document.dispatchEvent(
          new CustomEvent("forecast-staging-filters-change")
        );
      }
    } catch {
      /* ignore */
    }
  }

  function requestActiveReload() {
    try {
      window.__DO_activePage = 1;
      let invoked = false;
      if (typeof window.loadActive === "function") {
        window.loadActive();
        invoked = true;
      } else if (typeof window.loadActiveOverrides === "function") {
        window.loadActiveOverrides();
        invoked = true;
      }
      if (!invoked) {
        document.dispatchEvent(
          new CustomEvent("forecast-active-filters-change")
        );
      }
    } catch {
      /* ignore */
    }
  }

  function syncDeltaVisibility(operatorId, secondInputId) {
    const op = document.getElementById(operatorId);
    const delta2 = document.getElementById(secondInputId);
    if (!delta2) return;
    delta2.style.display =
      op && op.value === "between" ? "inline-block" : "none";
  }

  function resetStagingFilters() {
    const product = document.getElementById("filterProduct");
    const region = document.getElementById("filterRegion");
    const godown = document.getElementById("filterGodown");
    const deltaOp = document.getElementById("filterDeltaOp");
    const delta1 = document.getElementById("filterDeltaVal1");
    const delta2 = document.getElementById("filterDeltaVal2");

    if (product) product.value = "";
    if (region) region.value = "";
    if (godown) godown.value = "";
    if (deltaOp) deltaOp.value = "";
    if (delta1) delta1.value = "";
    if (delta2) {
      delta2.value = "";
      delta2.style.display = "none";
    }

    triggerEvents("filterProduct");
    triggerEvents("filterRegion");
    triggerEvents("filterGodown");
    triggerEvents("filterDeltaOp");
    triggerEvents("filterDeltaVal1", ["input", "change"]);
    triggerEvents("filterDeltaVal2", ["input", "change"]);
    requestStagingReload();
  }

  function resetActiveFilters() {
    const product = document.getElementById("activeFilterProduct");
    const region = document.getElementById("activeFilterRegion");
    const godown = document.getElementById("activeFilterGodown");
    const deltaOp = document.getElementById("activeFilterDeltaOp");
    const delta1 = document.getElementById("activeFilterDeltaVal1");
    const delta2 = document.getElementById("activeFilterDeltaVal2");

    if (product) product.value = "";
    if (region) region.value = "";
    if (godown) godown.value = "";
    if (deltaOp) deltaOp.value = "";
    if (delta1) delta1.value = "";
    if (delta2) {
      delta2.value = "";
      delta2.style.display = "none";
    }

    triggerEvents("activeFilterProduct");
    triggerEvents("activeFilterRegion");
    triggerEvents("activeFilterGodown");
    triggerEvents("activeFilterDeltaOp");
    triggerEvents("activeFilterDeltaVal1", ["input", "change"]);
    triggerEvents("activeFilterDeltaVal2", ["input", "change"]);
    requestActiveReload();
  }

  safeAddEventListener("btnResetStagingFilters", "click", resetStagingFilters);
  safeAddEventListener("btnResetActiveFilters", "click", resetActiveFilters);

  ["filterProduct", "filterRegion", "filterGodown"].forEach((id) => {
    safeAddEventListener(id, "change", requestStagingReload);
  });
  safeAddEventListener("filterDeltaOp", "change", () => {
    syncDeltaVisibility("filterDeltaOp", "filterDeltaVal2");
    requestStagingReload();
  });
  ["filterDeltaVal1", "filterDeltaVal2"].forEach((id) => {
    safeAddEventListener(id, "input", requestStagingReload);
    safeAddEventListener(id, "change", requestStagingReload);
  });
  syncDeltaVisibility("filterDeltaOp", "filterDeltaVal2");

  ["activeFilterProduct", "activeFilterRegion", "activeFilterGodown"].forEach(
    (id) => {
      safeAddEventListener(id, "change", requestActiveReload);
    }
  );
  safeAddEventListener("activeFilterDeltaOp", "change", () => {
    syncDeltaVisibility("activeFilterDeltaOp", "activeFilterDeltaVal2");
    requestActiveReload();
  });
  ["activeFilterDeltaVal1", "activeFilterDeltaVal2"].forEach((id) => {
    safeAddEventListener(id, "input", requestActiveReload);
    safeAddEventListener(id, "change", requestActiveReload);
  });
  syncDeltaVisibility("activeFilterDeltaOp", "activeFilterDeltaVal2");

  // Outputs
  safeAddEventListener("btnLoadOutputs", "click", () => {
    outputsPage = 0;
    loadOutputs();
  });
  safeAddEventListener("btnExportOutputs", "click", exportOutputs);
  // Page size selector for Outputs table
  safeAddEventListener("outputsPageSize", "change", () => {
    const v = Number(document.getElementById("outputsPageSize")?.value || 0);
    if (v && v > 0) {
      PAGE_SIZE = v;
      outputsPage = 0;
      loadOutputs();
    }
  });
  // Page size selector for Exceptions table (mirrors Outputs behavior)
  safeAddEventListener("exceptionsPageSize", "change", () => {
    const v = Number(document.getElementById("exceptionsPageSize")?.value || 0);
    if (v && v > 0) {
      PAGE_SIZE = v;
      exceptionsPage = 0;
      loadExceptions();
    }
  });
  safeAddEventListener("prevPageOutputs", "click", () => {
    outputsPage = Math.max(0, outputsPage - 1);
    loadOutputs();
  });
  safeAddEventListener("nextPageOutputs", "click", () => {
    outputsPage += 1;
    loadOutputs();
  });

  // Exceptions paginator buttons
  safeAddEventListener("prevPageExceptions", "click", () => {
    exceptionsPage = Math.max(0, exceptionsPage - 1);
    loadExceptions();
  });
  safeAddEventListener("nextPageExceptions", "click", () => {
    exceptionsPage += 1;
    loadExceptions();
  });

  // Enable/disable Load button for Outputs: require dataset + window (from & to)
  function updateOutputsLoadState() {
    const ds = document.getElementById("outputsDataset");
    const from = document.getElementById("outputsFrom");
    const to = document.getElementById("outputsTo");
    const btn = document.getElementById("btnLoadOutputs");
    if (!btn) return;
    const ok = ds && ds.value && from && from.value && to && to.value;
    btn.disabled = !ok;
  }

  // Hook dataset and month inputs
  safeAddEventListener("outputsDataset", "change", () => {
    updateOutputsLoadState();
    updateOutputsFiltersState();
  });
  // wire month inputs if present (use input event for immediate feedback)
  const outFrom = document.getElementById("outputsFrom");
  const outTo = document.getElementById("outputsTo");
  if (outFrom) outFrom.addEventListener("input", updateOutputsLoadState);
  if (outTo) outTo.addEventListener("input", updateOutputsLoadState);
  // initialize state (disable until both dataset & window are present)
  updateOutputsLoadState();

  // Dataset-dependent checkbox filters: enable only when relevant to the dataset
  function updateOutputsFiltersState() {
    const ds = document.getElementById("outputsDataset")?.value;
    const oOverride = document.getElementById("outputsFilterOverride");
    const oLlt = document.getElementById("outputsFilterSupplyLlt");
    const oSeason = document.getElementById("outputsFilterSupplySeasonal");
    if (oOverride) {
      oOverride.disabled = ds !== "baseline";
      if (oOverride.disabled) oOverride.checked = false;
    }
    if (oLlt) {
      oLlt.disabled = ds !== "combined";
      if (oLlt.disabled) oLlt.checked = false;
    }
    if (oSeason) {
      oSeason.disabled = ds !== "combined";
      if (oSeason.disabled) oSeason.checked = false;
    }
  }
  // initialize filters state
  updateOutputsFiltersState();

  // When boolean filters change, reload outputs immediately
  [
    "outputsFilterOverride",
    "outputsFilterSupplyLlt",
    "outputsFilterSupplySeasonal",
  ].forEach((id) => {
    safeAddEventListener(id, "change", () => {
      outputsPage = 0;
      loadOutputs();
    });
  });

  // When typing in the textual/numeric filter boxes, support Enter to trigger load
  ["outputsSku", "outputsItem", "outputsRegion", "outputsGodown"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          outputsPage = 0;
          loadOutputs();
        }
      });
    }
  );

  // Reset Outputs filters to defaults and reload
  function resetOutputsFilters() {
    const ds = document.getElementById("outputsDataset");
    const from = document.getElementById("outputsFrom");
    const to = document.getElementById("outputsTo");
    const sku = document.getElementById("outputsSku");
    const item = document.getElementById("outputsItem");
    const region = document.getElementById("outputsRegion");
    const godown = document.getElementById("outputsGodown");
    const oOverride = document.getElementById("outputsFilterOverride");
    const oLlt = document.getElementById("outputsFilterSupplyLlt");
    const oSeason = document.getElementById("outputsFilterSupplySeasonal");

    if (ds) ds.value = ds.querySelector("option")?.value || "baseline";
    // Default FROM/TO to current month
    if (from) from.value = fmtMonthInput(monthFloor(new Date()));
    if (to) to.value = fmtMonthInput(monthFloor(new Date()));
    if (sku) sku.value = "";
    if (item) item.value = "";
    if (region) region.value = "";
    if (godown) godown.value = "";
    if (oOverride) {
      oOverride.checked = false;
    }
    if (oLlt) {
      oLlt.checked = false;
    }
    if (oSeason) {
      oSeason.checked = false;
    }

    // Update UI state and reload
    try {
      updateOutputsFiltersState();
    } catch {
      /* ignore */
    }
    try {
      updateOutputsLoadState();
    } catch {
      /* ignore */
    }
    outputsPage = 0;
    loadOutputs();
  }

  safeAddEventListener("btnResetOutputs", "click", resetOutputsFilters);
  safeAddEventListener("btnResetExceptions", "click", resetExceptionsFilters);

  // Reset Exceptions filters to defaults and reload
  function resetExceptionsFilters() {
    const sku = document.getElementById("exceptionsSku");
    const item = document.getElementById("exceptionsItem");
    const region = document.getElementById("exceptionsRegion");
    const godown = document.getElementById("exceptionsGodown");
    const eLlt = document.getElementById("exceptionsFilterSupplyLlt");
    const eSeason = document.getElementById("exceptionsFilterSupplySeasonal");

    if (sku) sku.value = "";
    if (item) item.value = "";
    if (region) region.value = "";
    if (godown) godown.value = "";
    if (eLlt) eLlt.checked = false;
    if (eSeason) eSeason.checked = false;

    // Reset paging and reload
    exceptionsPage = 0;
    loadExceptions();
  }

  // Overrides removed: no Load/Save/Delete/Export wiring

  // Exceptions (client-side MVP join) - auto-loads on tab activation; no manual Load button
  safeAddEventListener("btnExportExceptions", "click", exportExceptions);

  // Initialize page-size selectors to current PAGE_SIZE where present
  try {
    const op = document.getElementById("outputsPageSize");
    if (op) op.value = String(PAGE_SIZE);
    const ep = document.getElementById("exceptionsPageSize");
    if (ep) ep.value = String(PAGE_SIZE);
  } catch (err) {
    // non-fatal; reference err to satisfy linters
    void err;
  }

  // Wire exceptions filter inputs: Enter key to apply, checkboxes to auto-apply
  [
    "exceptionsSku",
    "exceptionsItem",
    "exceptionsRegion",
    "exceptionsGodown",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        exceptionsPage = 0;
        loadExceptions();
      }
    });
  });
  ["exceptionsFilterSupplyLlt", "exceptionsFilterSupplySeasonal"].forEach(
    (id) => {
      safeAddEventListener(id, "change", () => {
        exceptionsPage = 0;
        loadExceptions();
      });
    }
  );

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
  try {
    if (document.readyState === "loading") {
      await new Promise((resolve) =>
        document.addEventListener("DOMContentLoaded", resolve, { once: true })
      );
    }

    const user = await ensureAuth();
    if (!user) return;

    setupTabs();
    setDefaultWindow();
    // set defaults for outputs-specific window inputs
    setDefaultOutputsWindow();
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
  } catch (e) {
    console.error("forecast-console boot failed:", e);
  }
})();
