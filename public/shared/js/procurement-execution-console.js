// public/shared/js/procurement-execution-console.js
import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

// ─── View / RPC name constants (adjust here if DB names differ) ───────────────
const PR_HEADER_VIEW = "v_proc_pr_header";

let prLineAll = [];
let prLineFiltered = [];
let prLinePage = 0;
let prLinePageSize = 50;
let prLineFilterValue = "all";
let iLineQuery = "";
let iLineFilter = "all";
let iLinePage = 0;
const iLinePageSize = 75;
let aqRawRows = [];
let aqFilteredRows = [];
let aqSelectedOnly = false;
let aqUnselectedOnly = false;
let aqGroupMode = "none";

const state = {
  tab: "pr",
  // action queue
  page: 0,
  pageSize: 30,
  rows: [],
  selected: null,
  // PR tab
  prPage: 0,
  prRows: [],
  selectedPr: null,
  prLinesRows: [],
  // indents tab
  indentsPage: 0,
  indentsRows: [],
  selectedIndent: null,
  currentIndentId: null,
  indentLinesRows: [],
  selectedIndentLine: null,
  // excess tab
  excessPage: 0,
  excessRows: [],
  excessAuditRows: [],
  // vendor-wise buylist tab
  vwl: {
    page: 0,
    pageSize: 75,
    totalCount: null,
    search: "",
    vendorId: "",
    rows: [],
    loaded: false,
    vendorsLoaded: false,
  },
  // vendor tab
  vendorPage: 0,
  vendorPageSize: 75,
  vendorQuery: "",
  vendorLoading: false,
  vendorsRows: [],
  vendorTotalCount: null,
  vendorList: [],
};

// Column headers for the PDF/CSV/TSV requisition form (single source of truth)
const INDENT_REQUISITION_HEADERS = [
  "SN",
  "Category",
  "Material Description",
  "Brand / Part No",
  "UOM",
  "Qty. Requested",
  "Qty. in Stock",
  "Qty. to be Purchased",
  "Unit Price",
  "Preferred Supplier Name",
  "Remarks",
];

function qs(id) {
  return document.getElementById(id);
}

function moveFocusOutsideModal(backdrop, candidates = []) {
  if (!backdrop) return;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !backdrop.contains(active)) return;

  for (const el of candidates) {
    if (!(el instanceof HTMLElement)) continue;
    if (!document.contains(el)) continue;
    if (
      el.matches(":disabled") ||
      el.getAttribute("aria-disabled") === "true"
    ) {
      continue;
    }
    try {
      el.focus();
    } catch {
      // no-op
    }
    if (!backdrop.contains(document.activeElement)) return;
  }

  active.blur();
  if (!backdrop.contains(document.activeElement)) return;

  const body = document.body;
  const hadTabIndex = body.hasAttribute("tabindex");
  if (!hadTabIndex) body.setAttribute("tabindex", "-1");
  body.focus();
  if (!hadTabIndex) body.removeAttribute("tabindex");
}

function hideModalBackdrop(backdrop, candidates = []) {
  if (!backdrop) return;
  moveFocusOutsideModal(backdrop, [...candidates, qs("homeBtn")]);
  backdrop.classList.remove("show");
  backdrop.setAttribute("aria-hidden", "true");
}

let lastFocusedBeforeGeneratePrModal = null;
let lastFocusedBeforePrViewModal = null;
let lastFocusedBeforePrRebuildModal = null;
let lastFocusedBeforeDetailModal = null;

function ensureIconBtnA11y(id, label) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", label);
  if (!el.getAttribute("title")) el.setAttribute("title", label);
}

// ─── Icon helper ─────────────────────────────────────────────────────────────
const _svgPaths = {
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  refresh:
    '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  arrowRight:
    '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  wand: '<path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h0"/><path d="M17.8 6.2 11 5"/><path d="M3 21l9-9"/><path d="M12.2 6.2 11 5"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  document:
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>',
  download:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  checkCircle:
    '<circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>',
  alertTriangle:
    '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  lockCheck:
    '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><polyline points="10 16 12 18 15 15"/>',
};

function iconSvg(name, size = 14) {
  const paths = _svgPaths[name] ?? "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="vertical-align:-2px;margin-right:4px">${paths}</svg>`;
}

function svgIcon(name, size = 16) {
  const paths = _svgPaths[name] ?? "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

function toIconBtn(btn, variant, label, iconName) {
  if (!btn) return;
  btn.type = "button";
  btn.classList.add("icon-btn", variant);
  btn.setAttribute("title", label);
  btn.setAttribute("aria-label", label);
  btn.innerHTML = svgIcon(iconName);
}

function upgradePrModalButtons(row) {
  const isDraft = row?.status === "draft";
  toIconBtn(qs("btnPrActivate"), "primary", "Activate PR", "arrowRight");
  toIconBtn(
    qs("btnPrClosePr"),
    "danger",
    isDraft ? "Cancel PR" : "Close PR",
    "x",
  );
  toIconBtn(qs("btnPrCreateIndent"), "primary", "Create Indent", "arrowRight");
  toIconBtn(qs("btnPrExportForm"), "primary", "Export Form", "download");
}

async function requireSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) window.location.href = "../../login.html";
}

function setTab(tab) {
  state.tab = tab;
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document
    .querySelectorAll(".tab-panel")
    .forEach((p) => p.classList.remove("active"));
  qs(`tab-${tab}`).classList.add("active");
  // lazy-load tab data on each visit
  if (tab === "action") loadActionQueue();
  if (tab === "pr") loadPrHeaders();
  if (tab === "indents") loadIndents();
  if (tab === "excess") {
    loadExcess();
    loadExcessAudit();
  }
  if (tab === "vendor-buylist") {
    if (!state.vwl.loaded) {
      state.vwl.loaded = true;
      loadVendorBuylist();
    }
  }
}

function fmt(n) {
  if (n === null || n === undefined) return "";
  const x = Number(n);
  if (Number.isNaN(x)) return String(n);
  return x.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function formatMoney(n, withCurrency = false) {
  if (n === null || n === undefined || n === "") return "";
  const x = Number(n);
  if (Number.isNaN(x)) return String(n);
  const val = x.toFixed(2);
  return withCurrency ? `₹${val}` : val;
}

function escapeCsv(value) {
  const s = String(value ?? "");
  if (!/[",\n]/.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

function sanitizeTsvValue(value) {
  return String(value ?? "")
    .replace(/[\t\r\n]+/g, " ")
    .trim();
}

function toCsv(rows, headers) {
  const out = [headers.join(",")];
  rows.forEach((row) => {
    out.push(headers.map((h) => escapeCsv(row[h] ?? "")).join(","));
  });
  return out.join("\n");
}

function toTsv(rows, headers) {
  const out = [headers.join("\t")];
  rows.forEach((row) => {
    out.push(headers.map((h) => sanitizeTsvValue(row[h] ?? "")).join("\t"));
  });
  return out.join("\n");
}

function downloadText(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function makeExportTimestamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}${m}${day}_${hh}${mm}`;
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim();
}

function extractRpcId(payload) {
  if (payload == null) return null;
  if (typeof payload === "number") return payload;
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const id = extractRpcId(item);
      if (id != null) return id;
    }
    return null;
  }
  if (typeof payload === "object") {
    const keys = ["new_pr_id", "pr_id", "indent_id", "id"];
    for (const k of keys) {
      const v = payload[k];
      if (typeof v === "number") return v;
      if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) {
        return Number(v);
      }
    }
  }
  if (
    typeof payload === "string" &&
    payload.trim() &&
    !Number.isNaN(Number(payload))
  ) {
    return Number(payload);
  }
  return null;
}

function updateExportButtonStates() {
  // AQ export button lives in the detail modal — enable when rows are loaded
  const aqBtn = qs("btnAqExportMenu");
  if (aqBtn) aqBtn.disabled = (state.rows || []).length === 0;

  // Indent export button lives in the indent view modal — keep enabled once an indent is selected.
  // Individual export actions already validate whether lines are available.
  const iBtn = qs("btnIExportMenu");
  if (iBtn) iBtn.disabled = !state.selectedIndent;
  updateIndentExportActionStates();
}

function updateIndentExportActionStates() {
  const hasIndent = !!state.selectedIndent;
  const isApproved = state.selectedIndent?.status === "approved";
  const pdfBtn = qs("btnIExportDropdownPdf");
  const csvBtn = qs("btnIExportDropdownCsv");
  const tsvBtn = qs("btnIExportDropdownTsv");

  if (pdfBtn) {
    pdfBtn.disabled = !isApproved;
    pdfBtn.setAttribute("aria-disabled", String(!isApproved));
    pdfBtn.title = isApproved
      ? "Export PDF"
      : hasIndent
        ? "PDF export is available only for approved indents."
        : "Select an indent first.";
  }
  if (csvBtn) {
    csvBtn.disabled = !hasIndent;
    csvBtn.setAttribute("aria-disabled", String(!hasIndent));
  }
  if (tsvBtn) {
    tsvBtn.disabled = !hasIndent;
    tsvBtn.setAttribute("aria-disabled", String(!hasIndent));
  }
}

function closeAllExportMenus() {
  document.querySelectorAll(".export-menu.open").forEach((m) => {
    m.classList.remove("open");
    const btn = m.querySelector("[aria-expanded]");
    if (btn) btn.setAttribute("aria-expanded", "false");
  });
}

function toggleExportMenu(menuId, btnEl) {
  const menu = qs(menuId);
  if (!menu) return;
  const isOpen = menu.classList.contains("open");
  closeAllExportMenus();
  if (!isOpen) {
    menu.classList.add("open");
    btnEl.setAttribute("aria-expanded", "true");
  }
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setLoading(active) {
  const panel = qs("mainPanel");
  if (!panel) return;
  panel.style.opacity = active ? "0.6" : "";
  panel.style.pointerEvents = active ? "none" : "";
}

function setTabTableLoading(tabName, active, loadingText = "Loading...") {
  const panel = qs(`tab-${tabName}`);
  if (!panel) return;

  const scrollAreas = panel.querySelectorAll(".card .table-scroll");
  if (!scrollAreas.length) return;

  scrollAreas.forEach((area) => {
    if (!(area instanceof HTMLElement)) return;

    if (active) {
      area.classList.add("loading");
      let mask = area.querySelector(":scope > .table-loading-mask");
      if (!mask) {
        mask = document.createElement("div");
        mask.className = "table-loading-mask";
        mask.innerHTML =
          '<span class="table-loading-spinner" aria-hidden="true"></span><span></span>';
        area.appendChild(mask);
      }
      const textEl = mask.querySelector("span:last-child");
      if (textEl) textEl.textContent = loadingText;
      return;
    }

    area.classList.remove("loading");
    area.querySelector(":scope > .table-loading-mask")?.remove();
  });
}

function toast(msg, type = "info") {
  const c = qs("toastContainer");
  if (!c) return;
  const div = document.createElement("div");
  div.textContent = msg;
  const bg =
    type === "error" ? "#c0392b" : type === "success" ? "#27ae60" : "#34495e";
  div.style.cssText = `background:${bg};color:#fff;padding:10px 14px;border-radius:10px;font-size:13px;pointer-events:auto;box-shadow:0 2px 8px rgba(0,0,0,.2);opacity:1;transition:opacity .4s;`;
  c.appendChild(div);
  setTimeout(() => {
    div.style.opacity = "0";
  }, 3000);
  setTimeout(() => div.remove(), 3500);
}

let hardDeleteResolve = null;
let hardDeleteOnConfirm = null;

function closeHardDeleteModal(result = false) {
  const backdrop = qs("hardDeleteModalBackdrop");
  if (!backdrop) return;
  hideModalBackdrop(backdrop, [qs("globalRefreshBtn")]);
  const resolve = hardDeleteResolve;
  hardDeleteResolve = null;
  hardDeleteOnConfirm = null;
  if (typeof resolve === "function") resolve(result);
}

async function submitHardDeleteConfirm() {
  const confirmText = (qs("hardDeleteConfirmText")?.value || "").trim();
  if (confirmText !== "DELETE") {
    toast('Type "DELETE" to confirm.', "error");
    qs("hardDeleteConfirmText")?.focus();
    return;
  }
  if (typeof hardDeleteOnConfirm !== "function") {
    closeHardDeleteModal(false);
    return;
  }

  const reason = (qs("hardDeleteReason")?.value || "").trim() || null;
  setLoading(true);
  try {
    await hardDeleteOnConfirm(reason);
    closeHardDeleteModal(true);
  } catch (err) {
    toast(err?.message || "Delete failed.", "error");
  } finally {
    setLoading(false);
  }
}

async function confirmHardDelete({ title, message, onConfirm }) {
  const backdrop = qs("hardDeleteModalBackdrop");
  if (!backdrop) return false;

  qs("hardDeleteTitle").textContent = title;
  qs("hardDeleteMessage").textContent = message;
  qs("hardDeleteConfirmText").value = "";
  qs("hardDeleteReason").value = "";
  hardDeleteOnConfirm = onConfirm;

  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  setTimeout(() => qs("hardDeleteConfirmText")?.focus(), 0);

  return new Promise((resolve) => {
    hardDeleteResolve = resolve;
  });
}

function wireHardDeleteControls() {
  qs("btnHardDeleteClose")?.addEventListener("click", () =>
    closeHardDeleteModal(false),
  );
  qs("btnHardDeleteCancel")?.addEventListener("click", () =>
    closeHardDeleteModal(false),
  );
  qs("btnHardDeleteConfirm")?.addEventListener(
    "click",
    submitHardDeleteConfirm,
  );
  qs("hardDeleteModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "hardDeleteModalBackdrop") {
      closeHardDeleteModal(false);
    }
  });
  qs("hardDeleteConfirmText")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitHardDeleteConfirm();
    }
  });
}

// ─── Detail modal helpers ────────────────────────────────────────────────────

function fmtValue(v) {
  if (v === null || v === undefined) return "-";
  const n = Number(v);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (!Number.isNaN(n) && typeof v !== "string") {
    return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }
  return esc(String(v));
}

function toHtmlTableFromPairs(pairs) {
  if (!pairs.length) return '<span class="muted">—</span>';
  const rows = pairs
    .map(
      ([k, v]) =>
        `<tr><td class="key">${esc(k)}</td><td>${fmtValue(v)}</td></tr>`,
    )
    .join("");
  return `<table class="kv-table">${rows}</table>`;
}

function parseEvidence(evidence) {
  if (!evidence || !Array.isArray(evidence) || !evidence.length) {
    return '<span class="muted">No evidence.</span>';
  }
  const rows = evidence
    .map((e) => {
      const source = esc(e.source ?? e.source_system ?? "-");
      const meta = e.meta ?? e;
      const metaStr = Object.entries(meta)
        .filter(([k]) => k !== "source" && k !== "source_system")
        .map(([k, v]) => `${esc(k)}: ${fmtValue(v)}`)
        .join(" · ");
      return `<tr><td class="key">${source}</td><td>${metaStr || "-"}</td></tr>`;
    })
    .join("");
  return `<table class="kv-table">${rows}</table>`;
}

function openDetailModal(row) {
  lastFocusedBeforeDetailModal =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  state.selected = row;

  // header
  qs("detailModalTitle").textContent =
    `${row.indent_number ?? ""} — ${row.stock_item_name ?? ""}`;
  qs("detailBand").textContent = `Band: ${row.priority_band_final ?? "-"}`;
  qs("detailBand").style.display = row.priority_band_final ? "" : "none";
  qs("detailMos").textContent = `MOS: ${row.mos_months ?? "-"}`;
  qs("detailMos").style.display = row.mos_months != null ? "" : "none";
  qs("detailLead").textContent = `Lead: ${row.lead_time_days ?? 0} d`;
  qs("detailLead").style.display = row.lead_time_days != null ? "" : "none";

  // flags
  const hasSelectedF = Boolean(
    row.has_selected_vendor || row.selected_vendor_id,
  );
  const hasExcessF = Boolean(row.has_net_excess);
  const mosRiskLowF =
    row.mos_risk_low != null
      ? Boolean(row.mos_risk_low)
      : Number(row.mos_months ?? 999) < 1;
  const flagsEl = qs("detailFlags");
  if (flagsEl) {
    flagsEl.innerHTML = [
      hasSelectedF
        ? '<span class="pill pill-flag" title="Selected vendor exists">S</span>'
        : "",
      hasExcessF
        ? '<span class="pill pill-flag" title="Has net excess">E</span>'
        : "",
      mosRiskLowF
        ? '<span class="pill pill-flag" title="MOS risk low">!</span>'
        : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  // summary table
  qs("detailSummary").innerHTML = toHtmlTableFromPairs(
    [
      ["Indent #", row.indent_number],
      ["Item", row.stock_item_name],
      ["Class", row.material_class_code],
      ["UOM", row.uom_code],
      ["Requested Qty", row.requested_qty ?? row.indent_qty],
      ["Allocated Qty", row.allocated_qty],
      ["Remaining Qty", row.remaining_qty],
      ["Priority Band", row.priority_band_final],
      ["Priority Score", row.priority_score_system],
      ["MOS (months)", row.mos_months],
      ["Lead Time (days)", row.lead_time_days],
      ["Approved Date", row.approved_date],
      ["Status", row.status],
    ].filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );

  // priority factors table
  const why = row.priority_why ?? {};
  const priorityPairs = [];
  if (why.components && typeof why.components === "object") {
    for (const [k, v] of Object.entries(why.components)) {
      priorityPairs.push([k, v]);
    }
  }
  [
    ["aging_days", why.aging_days ?? row.aging_days],
    ["stock_qty", why.stock_qty ?? row.stock_qty],
    ["avg_monthly_6m", why.avg_monthly_6m ?? row.avg_monthly_6m],
    ["prod_pull_score", why.prod_pull_score ?? row.prod_pull_score],
    ["net_excess_qty", why.net_excess_qty ?? row.net_excess_qty],
  ].forEach(([k, v]) => {
    if (v !== undefined && v !== null) priorityPairs.push([k, v]);
  });
  qs("detailPriority").innerHTML = toHtmlTableFromPairs(priorityPairs);

  // vendor decision table
  const recName =
    row.recommended_vendor_name ??
    (row.recommended_vendor_id ? `ID ${row.recommended_vendor_id}` : null);
  const vendorPairs = [
    ["Recommended Vendor", recName ?? row.l1_vendor_name],
    ["Recommended Rate", row.recommended_rate ?? row.l1_rate_value],
    [
      "Selected Vendor",
      row.selected_vendor_id ? `ID ${row.selected_vendor_id}` : null,
    ],
    ["Selected Rate", row.selected_rate],
    ["Selection Reason", row.selection_reason],
  ].filter(([, v]) => v !== undefined && v !== null && v !== "");
  qs("detailVendor").innerHTML = toHtmlTableFromPairs(vendorPairs);

  const actionHint = qs("detailActionHint");
  if (actionHint) {
    if (row.selected_vendor_id || row.selected_vendor_name) {
      actionHint.textContent =
        "A vendor is already selected for this line. Use Recommend only if you want a fresh suggestion, or Select to change the final choice.";
    } else if (row.recommended_vendor_id || row.recommended_vendor_name) {
      actionHint.textContent =
        "Review the recommendation first, then apply Select vendor if the suggestion is acceptable.";
    } else {
      actionHint.textContent =
        "No vendor has been selected yet. Use Recommend to generate a suggestion or Select to choose a vendor manually.";
    }
  }

  // evidence list
  qs("detailEvidenceList").innerHTML = parseEvidence(row.l1_evidence);

  const recBtn = qs("btnDetailRecommend");
  const selBtn = qs("btnDetailSelectVendor");
  const jumpBtn = qs("btnDetailJumpIndent");
  if (recBtn) recBtn.disabled = !row.indent_line_id;
  if (selBtn) selBtn.disabled = !row.indent_line_id;
  if (jumpBtn) jumpBtn.disabled = !row.indent_id;

  // open
  const backdrop = qs("detailModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  // scroll body back to top
  const body = qs("detailModalBody");
  if (body) body.scrollTop = 0;
  // focus close button
  requestAnimationFrame(() => qs("btnDetailClose")?.focus());
}

function closeDetailModal() {
  const backdrop = qs("detailModalBackdrop");
  hideModalBackdrop(backdrop, [lastFocusedBeforeDetailModal, qs("fSearch")]);
  lastFocusedBeforeDetailModal = null;
  closeAllExportMenus();
}

// Keep renderDetail as alias so any future callers still work
function renderDetail(row) {
  openDetailModal(row);
}

// ─── Tab count badges ───────────────────────────────────────────────────────

function updateTabCount(id, n) {
  const el = qs(id);
  if (!el) return;
  el.textContent = n > 0 ? String(n) : "";
}

async function refreshAllTabCounts() {
  const [indents, pr, excess] = await Promise.allSettled([
    supabase
      .from("v_proc_indent_console")
      .select("*", { count: "exact" })
      .limit(1),
    supabase.from(PR_HEADER_VIEW).select("*", { count: "exact" }).limit(1),
    supabase
      .from("v_proc_purchase_excess_console")
      .select("*", { count: "exact" })
      .limit(1),
  ]);
  if (indents.status === "fulfilled")
    updateTabCount("tabCountIndents", indents.value.count ?? 0);
  if (pr.status === "fulfilled")
    updateTabCount("tabCountPr", pr.value.count ?? 0);
  if (excess.status === "fulfilled")
    updateTabCount("tabCountExcess", excess.value.count ?? 0);
}

// ─── Jump to Indent (Part C) ─────────────────────────────────────────────────

async function jumpToIndent(indentId) {
  setTab("indents");
  qs("iStatus").value = "";
  qs("iClass").value = "";
  qs("iSearch").value = "";
  state.indentsPage = 0;
  await loadIndents();
  if (!indentId) return;
  const found = state.indentsRows.find((r) => r.indent_id === indentId);
  if (found) {
    renderIndents();
    openIndentViewModal(found);
  }
}

function renderRows() {
  const tbody = qs("aqTbody");
  tbody.innerHTML = "";

  for (const row of state.rows) {
    const vendorName = row.selected_vendor_name ?? row.l1_vendor_name ?? "-";
    const vendorRate = row.selected_rate ?? row.l1_rate_value ?? null;

    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    tr.innerHTML = `
      <td title="Indent ID: ${esc(row.indent_id ?? "")}">${esc(row.indent_number ?? "")}</td>
      <td title="${esc(row.material_class_code ?? "")} | ${esc(row.uom_code ?? "")}">${esc(row.stock_item_name ?? "")}</td>
      <td>${fmt(row.remaining_qty)}</td>
      <td><span class="pill">${esc(row.priority_band_final ?? "-")}</span></td>
      <td>${fmt(row.priority_score_system)}</td>
      <td title="${esc(vendorName)}">${esc(vendorName)}</td>
      <td>${vendorRate != null ? fmt(vendorRate) : "-"}</td>
    `;

    tr.addEventListener("click", () => renderDetail(row));

    tbody.appendChild(tr);
  }

  const _aqTotalPages = Math.max(
    1,
    Math.ceil(aqFilteredRows.length / state.pageSize),
  );
  const _aqTotal = aqFilteredRows.length;
  const _aqAll = aqRawRows.length;
  qs("aqMeta").textContent =
    _aqTotal < _aqAll
      ? `Showing ${_aqTotal} of ${_aqAll} lines`
      : `${_aqAll} line${_aqAll !== 1 ? "s" : ""}`;
  qs("aqPaging").textContent = `Page ${state.page + 1}/${_aqTotalPages}`;
  const _aqPrev = qs("btnPrev");
  const _aqNext = qs("btnNext");
  if (_aqPrev) _aqPrev.disabled = state.page <= 0;
  if (_aqNext) _aqNext.disabled = state.page >= _aqTotalPages - 1;
  updateTabCount("tabCountAction", aqFilteredRows.length);
  updateExportButtonStates();
}

function applyActionQueueLocalFilters() {
  let rows = aqRawRows.slice();

  if (aqSelectedOnly) {
    rows = rows.filter((row) =>
      Boolean(row.has_selected_vendor || row.selected_vendor_id),
    );
  }
  if (aqUnselectedOnly) {
    rows = rows.filter(
      (row) => !(row.has_selected_vendor || row.selected_vendor_id),
    );
  }

  if (aqGroupMode === "vendor") {
    rows.sort((a, b) => {
      const av = String(a.selected_vendor_name ?? a.l1_vendor_name ?? "");
      const bv = String(b.selected_vendor_name ?? b.l1_vendor_name ?? "");
      const vcmp = av.localeCompare(bv);
      if (vcmp) return vcmp;
      return String(a.indent_number ?? "").localeCompare(
        String(b.indent_number ?? ""),
      );
    });
  }

  aqFilteredRows = rows;

  const pageCount = Math.max(
    1,
    Math.ceil(aqFilteredRows.length / state.pageSize),
  );
  if (state.page > pageCount - 1) state.page = pageCount - 1;
  const start = state.page * state.pageSize;
  state.rows = aqFilteredRows.slice(start, start + state.pageSize);
  renderRows();
}

function buildActionQueueQuery() {
  let q = supabase.from("v_proc_procurement_action_queue").select("*");

  const band = qs("fBand").value;
  const cls = qs("fClass").value;
  const search = (qs("fSearch").value || "").trim();
  const needs = qs("fNeeds").value;

  if (band) q = q.eq("priority_band_final", band);
  if (cls) q = q.eq("material_class_id", Number(cls));

  if (needs === "needs_vendor") q = q.eq("has_vendor_candidates", false);
  if (needs === "needs_selection") q = q.eq("has_selected_vendor", false);
  if (needs === "has_excess") q = q.eq("has_net_excess", true);

  if (search) {
    // broad OR search across common fields
    q = q.or(
      [
        `stock_item_name.ilike.%${search}%`,
        `indent_number.ilike.%${search}%`,
        `l1_vendor_name.ilike.%${search}%`,
      ].join(","),
    );
  }

  q = q
    .order("priority_band_final", { ascending: true })
    .order("priority_score_system", { ascending: false })
    .limit(1200);

  return q;
}

async function loadActionQueue() {
  setTabTableLoading("action", true);
  try {
    const { data, error } = await buildActionQueueQuery();
    if (error) {
      console.error(error);
      toast(`Failed to load Action Queue: ${error.message}`, "error");
      return;
    }
    aqRawRows = data || [];
    applyActionQueueLocalFilters();
  } finally {
    setTabTableLoading("action", false);
  }
}

async function doRecommend(indentLineId) {
  const { error } = await supabase.rpc("proc_indent_recommend_vendor", {
    p_indent_line_id: indentLineId,
  });
  if (error) {
    toast(`Recommend failed: ${error.message}`, "error");
    return;
  }
  await loadActionQueue();
}

function openVendorModal(row) {
  const backdrop = qs("vendorModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");

  qs("vendorModalItem").textContent =
    `${row.stock_item_name} (${row.indent_number})`;

  const pick = qs("vendorPick");
  pick.innerHTML = "";

  const options = [];
  if (row.l1_vendor_id)
    options.push({
      id: row.l1_vendor_id,
      name: row.l1_vendor_name,
      rate: row.l1_rate_value,
      tag: "L1",
    });
  if (row.l2_vendor_id)
    options.push({
      id: row.l2_vendor_id,
      name: row.l2_vendor_name,
      rate: row.l2_rate_value,
      tag: "L2",
    });
  if (row.l3_vendor_id)
    options.push({
      id: row.l3_vendor_id,
      name: row.l3_vendor_name,
      rate: row.l3_rate_value,
      tag: "L3",
    });

  if (!options.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No candidates (map vendors / rate book first)";
    pick.appendChild(opt);
    qs("vendorRate").value = "";
  } else {
    for (const o of options) {
      const opt = document.createElement("option");
      opt.value = String(o.id);
      opt.textContent = `${o.tag}: ${o.name}${o.rate ? ` @ ${fmt(o.rate)}` : ""}`;
      opt.dataset.rate = o.rate ?? "";
      pick.appendChild(opt);
    }
    qs("vendorRate").value = pick.options[0].dataset.rate || "";
  }

  pick.onchange = () => {
    const selected = pick.options[pick.selectedIndex];
    qs("vendorRate").value = selected?.dataset?.rate || "";
  };

  qs("vendorReason").value = "";
  backdrop.dataset.indentLineId = String(row.indent_line_id);
  backdrop.dataset.recommendedVendorId = String(
    row.recommended_vendor_id ?? "",
  );
}

function closeVendorModal() {
  const backdrop = qs("vendorModalBackdrop");
  hideModalBackdrop(backdrop, [qs("btnDetailSelectVendor"), qs("fSearch")]);
}

async function saveVendorSelection() {
  const backdrop = qs("vendorModalBackdrop");
  const indentLineId = Number(backdrop.dataset.indentLineId);
  const recommendedVendorId = backdrop.dataset.recommendedVendorId
    ? Number(backdrop.dataset.recommendedVendorId)
    : null;

  const vendorId = Number(qs("vendorPick").value || 0);
  if (!vendorId) {
    toast("No vendor selected.", "error");
    return;
  }

  const rateText = (qs("vendorRate").value || "").trim();
  const rate = rateText ? Number(rateText) : null;
  const reason = (qs("vendorReason").value || "").trim() || null;

  // Client-side hint (server already enforces)
  if (recommendedVendorId && vendorId !== recommendedVendorId && !reason) {
    toast(
      "Reason required when selecting a vendor different from recommendation.",
      "error",
    );
    return;
  }

  const { error } = await supabase.rpc("proc_indent_set_vendor_selection", {
    p_indent_line_id: indentLineId,
    p_selected_vendor_id: vendorId,
    p_selected_rate: rate,
    p_reason: reason,
  });

  if (error) {
    toast(`Selection failed: ${error.message}`, "error");
    return;
  }

  closeVendorModal();
  await loadActionQueue();

  if (state.currentIndentId) {
    await loadIndentLines(state.currentIndentId);
  }

  if (state.tab === "vendor-buylist" && state.vwl.loaded) {
    await reloadVendorBuylist();
  }
}

function wireTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
  });
}

function wireLiveSearchInput({ inputId, clearId, onSearch, debounceMs = 220 }) {
  const input = qs(inputId);
  if (!input) return;

  const clearBtn = clearId ? qs(clearId) : null;
  const wrap = input.closest(".pec-search-wrap");
  let requestSeq = 0;

  const setSearching = (active) => {
    if (wrap) wrap.classList.toggle("is-searching", Boolean(active));
  };

  const runSearch = () => {
    const current = ++requestSeq;
    setSearching(true);
    return Promise.resolve(onSearch?.((input.value || "").trim()))
      .catch(() => {
        // Errors are surfaced by caller-specific loaders.
      })
      .finally(() => {
        if (current === requestSeq) setSearching(false);
      });
  };

  const runSearchDebounced = debounce(runSearch, debounceMs);

  const syncClearBtn = () => {
    if (!clearBtn) return;
    clearBtn.style.display = input.value ? "" : "none";
  };

  syncClearBtn();

  input.addEventListener("input", () => {
    syncClearBtn();
    runSearchDebounced();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    runSearch();
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (!input.value) return;
      input.value = "";
      syncClearBtn();
      runSearch();
      input.focus();
    });
  }
}

function wireActionQueueControls() {
  qs("btnPrev").addEventListener("click", () => {
    state.page = Math.max(0, state.page - 1);
    applyActionQueueLocalFilters();
  });
  qs("btnNext").addEventListener("click", () => {
    state.page += 1;
    applyActionQueueLocalFilters();
  });

  ["fBand", "fClass", "fNeeds"].forEach((id) =>
    qs(id).addEventListener("change", () => {
      state.page = 0;
      loadActionQueue();
    }),
  );
  wireLiveSearchInput({
    inputId: "fSearch",
    clearId: "fSearchClear",
    onSearch: () => {
      state.page = 0;
      loadActionQueue();
    },
  });
  qs("fSelectedOnly")?.addEventListener("change", (e) => {
    aqSelectedOnly = Boolean(e.target.checked);
    if (aqSelectedOnly) {
      aqUnselectedOnly = false;
      if (qs("fUnselectedOnly")) qs("fUnselectedOnly").checked = false;
    }
    state.page = 0;
    applyActionQueueLocalFilters();
  });
  qs("fUnselectedOnly")?.addEventListener("change", (e) => {
    aqUnselectedOnly = Boolean(e.target.checked);
    if (aqUnselectedOnly) {
      aqSelectedOnly = false;
      if (qs("fSelectedOnly")) qs("fSelectedOnly").checked = false;
    }
    state.page = 0;
    applyActionQueueLocalFilters();
  });
  qs("fGroupMode")?.addEventListener("change", (e) => {
    aqGroupMode = e.target.value || "none";
    state.page = 0;
    applyActionQueueLocalFilters();
  });

  qs("btnVendorCancel").addEventListener("click", closeVendorModal);
  qs("btnVendorSave").addEventListener("click", saveVendorSelection);

  // click outside modal closes
  qs("vendorModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "vendorModalBackdrop") closeVendorModal();
  });

  // detail modal close
  qs("btnDetailClose").addEventListener("click", closeDetailModal);
  qs("btnDetailClose2")?.addEventListener("click", closeDetailModal);
  qs("btnDetailRecommend")?.addEventListener("click", async () => {
    if (!state.selected?.indent_line_id) return;
    await doRecommend(state.selected.indent_line_id);
    await loadActionQueue();
    const updated = aqRawRows.find(
      (r) => r.indent_line_id === state.selected.indent_line_id,
    );
    if (updated) openDetailModal(updated);
  });
  qs("btnDetailSelectVendor")?.addEventListener("click", () => {
    if (!state.selected) return;
    openVendorModal(state.selected);
  });
  qs("btnDetailJumpIndent")?.addEventListener("click", () => {
    if (!state.selected?.indent_id) return;
    closeDetailModal();
    jumpToIndent(state.selected.indent_id);
  });
  qs("detailModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "detailModalBackdrop") closeDetailModal();
  });
  // Close export dropdowns when clicking outside them
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".export-menu")) closeAllExportMenus();
  });
  // ESC key closes detail modal (and vendor modal)
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeAllExportMenus();
    const modals = [
      { id: "workflowGuideModalBackdrop", close: closeWorkflowGuideModal },
      { id: "detailModalBackdrop", close: closeDetailModal },
      { id: "vendorModalBackdrop", close: closeVendorModal },
      { id: "vwlBreakdownModalBackdrop", close: closeVwlBreakdownModal },
      { id: "indentViewModalBackdrop", close: closeIndentViewModal },
      { id: "prViewModalBackdrop", close: closePrViewModal },
      { id: "prRebuildModalBackdrop", close: closePrRebuildModal },
      { id: "generatePrModalBackdrop", close: closeGeneratePrModal },
      { id: "prAddLineModalBackdrop", close: closePrAddLineModal },
      { id: "prSetStatusModalBackdrop", close: closePrSetStatusModal },
      { id: "createIndentModalBackdrop", close: closeCreateIndentModal },
      { id: "indentFromPrModalBackdrop", close: closeIndentFromPrModal },
      { id: "indentAddLineModalBackdrop", close: closeIndentAddLineModal },
      { id: "indentSourcePrModalBackdrop", close: closeIndentSourcePrModal },
      { id: "indentResyncModalBackdrop", close: closeIndentResyncModal },
      { id: "stockPickerModalBackdrop", close: closeStockItemPicker },
      { id: "exportIndentModalBackdrop", close: closeExportIndentModal },
    ];
    for (const m of [...modals].reverse()) {
      if (qs(m.id)?.classList.contains("show")) {
        m.close();
        return;
      }
    }
  });
}

// ─── INDENT TAB ───────────────────────────────────────────────────────────────

function setIndentSourcePrBadge(indentRow) {
  const el = qs("indentSourcePrBadge");
  if (!el) return;

  const prNo = indentRow?.source_pr_number || indentRow?.source_pr_no || "";
  const prId = indentRow?.source_pr_id ?? null;

  if (prNo) {
    el.textContent = `Source PR: ${prNo}`;
    el.title = `Source PR ID: ${prId ?? "—"}`;
    return;
  }

  if (prId) {
    el.textContent = `Source PR ID: ${prId}`;
    el.title = "Source PR number not loaded";
    return;
  }

  el.textContent = "Source PR: —";
  el.title = "";
}

function updateIndentDraftWorkflowControls(indent) {
  const group = qs("indentDraftWorkflowGroup");
  if (!group) return;
  const isDraft = indent?.status === "draft";
  group.style.display = isDraft ? "flex" : "none";

  const hasSourcePr = !!indent?.source_pr_id;
  const openPrBtn = qs("btnIndentOpenPr");
  const createRevBtn = qs("btnIndentCreatePrRevision");
  if (openPrBtn) openPrBtn.disabled = !hasSourcePr;
  if (createRevBtn) createRevBtn.disabled = !hasSourcePr;
}

function renderIndentModalHeader(indent) {
  qs("iLinesTitle").textContent = `Lines — ${indent.indent_number}`;
  qs("indentViewStatus").textContent = indent.status ?? "";
  const metaParts = [];
  if (indent.approved_date) metaParts.push(`Approved: ${indent.approved_date}`);
  if (indent.material_class_code)
    metaParts.push(`Class: ${indent.material_class_code}`);
  else if (indent.material_class_id)
    metaParts.push(`Class ID: ${indent.material_class_id}`);
  qs("indentViewMeta").textContent = metaParts.join(" · ");

  setIndentSourcePrBadge(indent);

  const hints = {
    draft: "Draft — use PR revision and Resync for quantity corrections.",
    approved: "Approved — issue to start fulfilment.",
    issued: "Issued — lines are being fulfilled.",
    closed: "Closed — read-only.",
    cancelled: "Cancelled — read-only.",
  };
  qs("indentViewHint").textContent = hints[indent.status] ?? "";
  const deleteBtn = qs("btnIndentDeleteDraft");
  if (deleteBtn)
    deleteBtn.style.display = indent.status === "draft" ? "" : "none";
  updateIndentDraftWorkflowControls(indent);
  renderIndentLinesActions(indent);
}

async function openPrViewModalById(prId) {
  const id = Number(prId || 0);
  if (!id) {
    toast("No source PR linked to this indent.", "error");
    return;
  }
  const { data, error } = await supabase
    .from(PR_HEADER_VIEW)
    .select("*")
    .eq("pr_id", id)
    .maybeSingle();
  if (error || !data) {
    toast(`Unable to open PR: ${error?.message || "PR not found"}`, "error");
    return;
  }
  openPrViewModal(data);
}

async function createIndentPrRevision() {
  const indent = state.selectedIndent;
  if (!indent) {
    toast("Select an indent first.", "error");
    return;
  }
  if (!indent.source_pr_id) {
    toast("This indent has no source PR. Set Source PR first.", "error");
    return;
  }
  if (indent.status !== "draft") {
    toast("PR revision can be created only for draft indents.", "error");
    return;
  }

  const { data, error } = await supabase.rpc(
    "proc_pr_create_revision_from_active",
    {
      p_pr_id: indent.source_pr_id,
      p_notes: `Revision for indent ${indent.indent_number}`,
    },
  );
  if (error) {
    toast(`Create revision failed: ${error.message}`, "error");
    return;
  }

  const newPrId = extractRpcId(data);
  if (!newPrId) {
    toast("Revision created, but returned PR id was not found.", "error");
    return;
  }

  await openPrViewModalById(newPrId);
  toast(
    "Revision PR created (Draft). Edit & Activate it, then set as source PR and resync.",
    "success",
  );
}

async function openIndentSourcePrModal() {
  const indent = state.selectedIndent;
  if (!indent) {
    toast("Select an indent first.", "error");
    return;
  }
  const pick = qs("indentSourcePrPick");
  const hint = qs("indentSourcePrModalHint");
  const backdrop = qs("indentSourcePrModalBackdrop");
  if (!pick || !backdrop) return;

  pick.innerHTML = "";
  if (hint) hint.textContent = `Indent: ${indent.indent_number}`;

  let currentSource = null;
  if (indent.source_pr_id) {
    const { data: source } = await supabase
      .from(PR_HEADER_VIEW)
      .select("pr_id,pr_number,status,effective_from_date,material_class_id")
      .eq("pr_id", indent.source_pr_id)
      .maybeSingle();
    currentSource = source || null;
  }

  const { data: recent, error } = await supabase
    .from(PR_HEADER_VIEW)
    .select("pr_id,pr_number,status,effective_from_date,material_class_id")
    .order("pr_id", { ascending: false })
    .limit(80);
  if (error) {
    toast(`Failed to load PR list: ${error.message}`, "error");
    return;
  }

  const basePrNo = currentSource?.pr_number
    ? currentSource.pr_number.replace(/\/REV\d+$/i, "")
    : "";
  const all = recent || [];
  const prioritized = [];
  const pushUnique = (row) => {
    if (!row || prioritized.some((x) => x.pr_id === row.pr_id)) return;
    prioritized.push(row);
  };

  pushUnique(currentSource);
  all
    .filter((r) => {
      if (!basePrNo) return false;
      const no = String(r.pr_number || "");
      return no === basePrNo || no.startsWith(`${basePrNo}/REV`);
    })
    .forEach(pushUnique);
  all
    .filter((r) => r.material_class_id === indent.material_class_id)
    .forEach(pushUnique);

  const rows = prioritized.slice(0, 30);
  rows.forEach((pr) => {
    const opt = document.createElement("option");
    opt.value = String(pr.pr_id);
    opt.dataset.status = String(pr.status || "");
    const stamp = pr.effective_from_date ? ` | ${pr.effective_from_date}` : "";
    const marker = pr.pr_id === indent.source_pr_id ? " [Current]" : "";
    opt.textContent = `${pr.pr_number} (${pr.status || "-"})${stamp}${marker}`;
    pick.appendChild(opt);
  });

  if (!rows.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No PRs available";
    pick.appendChild(opt);
  }

  if (indent.source_pr_id) pick.value = String(indent.source_pr_id);
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
}

function closeIndentSourcePrModal() {
  const bd = qs("indentSourcePrModalBackdrop");
  if (!bd) return;
  hideModalBackdrop(bd, [qs("btnIndentSetSourcePr"), qs("iSearch")]);
}

async function confirmIndentSourcePr() {
  const indent = state.selectedIndent;
  if (!indent) {
    toast("Select an indent first.", "error");
    return;
  }
  const pick = qs("indentSourcePrPick");
  const selectedOpt = pick?.options?.[pick.selectedIndex];
  const selectedId = Number(pick?.value || 0);
  if (!selectedId) {
    toast("Select an active PR.", "error");
    return;
  }
  if ((selectedOpt?.dataset?.status || "").toLowerCase() !== "active") {
    toast("Only ACTIVE PR can be set as source.", "error");
    return;
  }

  const { error } = await supabase.rpc("proc_indent_set_source_pr", {
    p_indent_id: indent.indent_id,
    p_pr_id: selectedId,
    p_note: "source switched for resync",
  });
  if (error) {
    toast(`Set source PR failed: ${error.message}`, "error");
    return;
  }

  closeIndentSourcePrModal();
  await loadIndents();
  const fresh = state.indentsRows.find(
    (r) => r.indent_id === state.selectedIndent.indent_id,
  );
  if (fresh) {
    state.selectedIndent = fresh;
    setIndentSourcePrBadge(fresh);
    renderIndentModalHeader(fresh);
  }
  await loadIndentLines(state.selectedIndent.indent_id);
  toast("Source PR updated.", "success");
}

function openIndentResyncModal(mode) {
  const indent = state.selectedIndent;
  if (!indent) {
    toast("Select an indent first.", "error");
    return;
  }
  const normalized = mode === "full" ? "full" : "safe";
  const bd = qs("indentResyncModalBackdrop");
  const text = qs("indentResyncModeText");
  bd.dataset.mode = normalized;
  if (text) {
    text.textContent =
      normalized === "full"
        ? "Mode: Full (replace with PR quantities completely)."
        : "Mode: Safe (conservative sync from source PR).";
  }
  bd.classList.add("show");
  bd.setAttribute("aria-hidden", "false");
}

function closeIndentResyncModal() {
  const bd = qs("indentResyncModalBackdrop");
  if (!bd) return;
  hideModalBackdrop(bd, [qs("btnIndentResyncSafe"), qs("iSearch")]);
}

async function confirmIndentResync() {
  const indent = state.selectedIndent;
  const bd = qs("indentResyncModalBackdrop");
  if (!indent || !bd) {
    toast("Select an indent first.", "error");
    return;
  }
  const mode = bd.dataset.mode === "full" ? "full" : "safe";

  const { error } = await supabase.rpc("proc_indent_resync_from_pr", {
    p_indent_id: indent.indent_id,
    p_mode: mode,
  });
  if (error) {
    toast(`Resync failed: ${error.message}`, "error");
    return;
  }

  closeIndentResyncModal();
  await loadIndents();
  const fresh = state.indentsRows.find(
    (r) => r.indent_id === state.selectedIndent.indent_id,
  );
  if (fresh) {
    state.selectedIndent = fresh;
    setIndentSourcePrBadge(fresh);
    renderIndentModalHeader(fresh);
  }
  await loadIndentLines(state.selectedIndent.indent_id);
  toast(`Indent resynced (${mode}).`, "success");
}

function openIndentViewModal(row) {
  state.selectedIndent = row;
  state.currentIndentId = row?.indent_id ?? null;
  state.selectedIndentLine = null;
  state.indentLinesRows = [];
  updateExportButtonStates();
  renderIndentModalHeader(row);
  setIndentSourcePrBadge(row);
  const btnEditQty = qs("iBtnEditLineQty");
  if (btnEditQty) btnEditQty.disabled = true;
  qs("iLinesEmpty").style.display = "";
  qs("iLinesEmpty").textContent = "Loading lines…";
  qs("iLinesTable").style.display = "none";
  qs("iLinesTbody").innerHTML = "";
  const backdrop = qs("indentViewModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  loadIndentLines(row.indent_id);
}

function closeIndentViewModal() {
  state.currentIndentId = null;
  hideModalBackdrop(qs("indentViewModalBackdrop"), [qs("iSearch")]);
  closeAllExportMenus();
}

function renderIndentLinesActions(indent) {
  // show/hide action buttons in the static iLinesActions toolbar
  const container = qs("iLinesActions");
  // Remove old dynamic buttons (legacy), keep the static ones
  container
    .querySelectorAll("button.dynamic-action")
    .forEach((b) => b.remove());

  const btnAddLine = qs("iBtnAddLine");
  const btnEditQty = qs("iBtnEditLineQty");
  const isDraft = indent?.status === "draft";
  if (btnAddLine) btnAddLine.style.display = isDraft ? "none" : "";
  if (btnEditQty) {
    btnEditQty.style.display = isDraft ? "none" : "";
    btnEditQty.disabled = !state.selectedIndentLine || isDraft;
  }

  // Status action buttons (approve / issue / close) — rendered dynamically
  // Remove previously injected status buttons
  container.querySelectorAll("button.status-action").forEach((b) => b.remove());
  const makeIcon = (label, act, iconName, variant = "primary", id = "") => {
    const b = document.createElement("button");
    b.type = "button";
    b.classList.add("icon-btn", variant, "status-action");
    if (id) b.id = id;
    b.setAttribute("title", label);
    b.setAttribute("aria-label", label);
    b.innerHTML = svgIcon(iconName);
    b.addEventListener("click", () => openIndentActionModal(indent, act));
    container.appendChild(b);
  };
  const s = indent.status;
  if (s === "draft") makeIcon("Approve", "approve", "check", "primary");
  if (s === "approved") {
    makeIcon(
      "Issue to Purchase (mark as issued)",
      "issue",
      "send",
      "primary",
      "btnIndentIssue",
    );
  }
  if (s === "approved" || s === "issued") {
    makeIcon(
      "Close Strict (only if fully satisfied)",
      "close_strict",
      "lockCheck",
      "primary",
      "btnIndentCloseStrict",
    );
    makeIcon(
      "Close with Override (force close with reason)",
      "close_override",
      "alertTriangle",
      "danger",
      "btnIndentCloseOverride",
    );
  }
}

function renderIndentLines(rows) {
  const empty = qs("iLinesEmpty");
  const table = qs("iLinesTable");
  const tbody = qs("iLinesTbody");
  tbody.innerHTML = "";
  if (!rows.length) {
    empty.style.display = "";
    empty.textContent = "No lines for this indent.";
    table.style.display = "none";
    return;
  }
  empty.style.display = "none";
  table.style.display = "";
  rows.forEach((row, idx) => {
    const lineNo = idx + 1;
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    if (state.selectedIndentLine?.indent_line_id === row.indent_line_id) {
      tr.style.background = "rgba(10,100,200,.06)";
    }
    const recVendor = esc(row.recommended_vendor_name ?? "-");
    const recRate =
      row.recommended_rate != null ? fmt(row.recommended_rate) : "-";
    const selVendor = esc(row.selected_vendor_name ?? "-");
    const selRate = row.selected_rate != null ? fmt(row.selected_rate) : "-";
    const resolvedVendor = row.resolved_vendor_name
      ? esc(row.resolved_vendor_name)
      : "&mdash;";
    const resolvedRate =
      row.resolved_rate != null ? fmt(row.resolved_rate) : "&mdash;";
    tr.innerHTML = `
      <td class="muted" style="text-align:center">${lineNo}</td>
      <td>${esc(row.stock_item_name)}</td>
      <td>${esc(row.material_class_code ?? "")}</td>
      <td>${esc(row.uom_code ?? "")}</td>
      <td>${fmt(row.requested_qty)}</td>
      <td>${fmt(row.allocated_qty)}</td>
      <td><span class="pill">${Number(row.remaining_qty) <= 0 ? "fulfilled" : fmt(row.remaining_qty)}</span></td>
      <td>${resolvedVendor}</td>
      <td class="muted">${resolvedRate}</td>
      <td>${recVendor}</td>
      <td class="muted">${recRate}</td>
      <td>${selVendor}</td>
      <td class="muted">${selRate}</td>
    `;
    tr.addEventListener("click", () => {
      state.selectedIndentLine = row;
      const btnEditQty = qs("iBtnEditLineQty");
      if (btnEditQty)
        btnEditQty.disabled = state.selectedIndent?.status === "draft";
      tbody.querySelectorAll("tr").forEach((r) => (r.style.background = ""));
      tr.style.background = "rgba(10,100,200,.06)";
    });
    tbody.appendChild(tr);
  });
}

function syncIndentLineFilterBadge() {
  const badge = qs("iLineFilterBadge");
  const btn = qs("iLineFilterBtn");
  if (badge) {
    badge.style.display = iLineFilter && iLineFilter !== "all" ? "" : "none";
  }
  if (btn) {
    btn.classList.toggle("pec-filter-btn--active", iLineFilter !== "all");
  }
}

function applyIndentLineFiltersAndRender() {
  const all = state.indentLinesRows || [];
  let rows = all;

  if (iLineQuery) {
    rows = rows.filter((r) => {
      const hay = [
        r.stock_item_name,
        r.stock_item_code,
        r.code,
        r.uom_code,
        r.material_class_code,
        r.material_class_label,
        String(r.stock_item_id ?? ""),
        String(r.uom_id ?? ""),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(iLineQuery);
    });
  }

  if (iLineFilter === "remaining_only") {
    rows = rows.filter((r) => Number(r.remaining_qty || 0) > 0);
  } else if (iLineFilter === "allocated_only") {
    rows = rows.filter((r) => Number(r.allocated_qty || 0) > 0);
  } else if (iLineFilter === "zero_requested") {
    rows = rows.filter((r) => Number(r.requested_qty || 0) === 0);
  }

  const pager = qs("iLinesPager");
  const pageInfo = qs("iLinesPageInfo");
  const prevBtn = qs("iLinesPrev");
  const nextBtn = qs("iLinesNext");
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / iLinePageSize));
  if (iLinePage > totalPages - 1) iLinePage = totalPages - 1;
  const start = iLinePage * iLinePageSize;
  const end = Math.min(start + iLinePageSize, total);
  const pageRows = rows.slice(start, end);

  renderIndentLines(pageRows);

  if (pager) pager.style.display = total > iLinePageSize ? "" : "none";
  if (pageInfo)
    pageInfo.textContent = total ? `${start + 1}-${end} of ${total}` : "0";
  if (prevBtn) prevBtn.disabled = iLinePage <= 0;
  if (nextBtn) nextBtn.disabled = end >= total;
}

async function loadIndentLines(indentId) {
  setLoading(true);
  const { data, error } = await supabase
    .from("v_proc_indent_lines_console")
    .select(
      "indent_line_id,indent_id,stock_item_id,stock_item_name,stock_item_code,code,material_class_code,material_class_label,uom_id,uom_code,requested_qty,allocated_qty,remaining_qty,resolved_vendor_name,resolved_rate,selected_vendor_name,selected_rate,recommended_vendor_name,recommended_rate,has_selected_vendor",
    )
    .eq("indent_id", indentId)
    .order("indent_line_id", { ascending: true });
  setLoading(false);
  if (error) {
    toast(`Failed to load indent lines: ${error.message}`, "error");
    return;
  }
  state.indentLinesRows = data || [];
  iLineQuery = "";
  iLineFilter = "all";
  iLinePage = 0;
  const searchInput = qs("iLineSearch");
  const filterSelect = qs("iLineFilterSelect");
  const filterDrawer = qs("iLineFilterDrawer");
  const filterBtn = qs("iLineFilterBtn");
  if (searchInput) searchInput.value = "";
  if (filterSelect) filterSelect.value = "all";
  if (filterDrawer) filterDrawer.classList.remove("open");
  if (filterBtn) filterBtn.setAttribute("aria-expanded", "false");
  syncIndentLineFilterBadge();
  applyIndentLineFiltersAndRender();
  updateExportButtonStates();
}

function renderIndents() {
  const tbody = qs("iTbody");
  tbody.innerHTML = "";
  for (const row of state.indentsRows) {
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    if (state.selectedIndent?.indent_id === row.indent_id) {
      tr.style.background = "rgba(10,100,200,.06)";
    }
    tr.innerHTML = `
      <td>${esc(String(row.indent_id ?? ""))}</td>
      <td>${esc(row.indent_number ?? "")}</td>
      <td>${esc(row.approved_date ?? "")}</td>
      <td><span class="pill">${esc(row.status ?? "")}</span></td>
      <td>${esc(row.material_class_code ?? "")}</td>
      <td>${fmt(row.line_count ?? "")}</td>
    `;
    tr.addEventListener("click", () => {
      openIndentViewModal(row);
      renderIndents();
    });
    tbody.appendChild(tr);
  }
  const _iCnt = state.indentsRows.length;
  qs("iMeta").textContent = `${_iCnt} indent${_iCnt !== 1 ? "s" : ""}`;
  qs("iPaging").textContent = `Page ${state.indentsPage + 1}`;
  const _iPrev = qs("iBtnPrev");
  const _iNext = qs("iBtnNext");
  if (_iPrev) _iPrev.disabled = state.indentsPage <= 0;
  if (_iNext) _iNext.disabled = _iCnt < state.pageSize;
  updateTabCount("tabCountIndents", _iCnt);
  updateExportButtonStates();
}

async function loadIndents() {
  setTabTableLoading("indents", true);
  try {
    let q = supabase.from("v_proc_indent_console").select("*");
    const status = qs("iStatus").value;
    const cls = qs("iClass").value;
    const search = (qs("iSearch").value || "").trim();
    if (status) q = q.eq("status", status);
    if (cls) q = q.eq("material_class_id", Number(cls));
    if (search) q = q.ilike("indent_number", `%${search}%`);
    q = q
      .order("indent_id", { ascending: false })
      .range(
        state.indentsPage * state.pageSize,
        state.indentsPage * state.pageSize + state.pageSize - 1,
      );
    const { data, error } = await q;
    if (error) {
      toast(`Failed to load indents: ${error.message}`, "error");
      return;
    }
    state.indentsRows = data || [];
    renderIndents();
  } finally {
    setTabTableLoading("indents", false);
  }
}

function openIndentActionModal(indent, action) {
  const backdrop = qs("indentActionModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  const titles = {
    approve: "Approve Indent",
    issue: "Issue Indent",
    close_strict: "Close Indent (Strict)",
    close_override: "Close Indent with Override",
  };
  const explain = {
    approve:
      "Confirming will mark this indent as approved with the selected approval date.",
    issue:
      "Confirming will mark this indent as issued and allow purchase fulfilment to proceed.",
    close_strict:
      "Confirming will attempt strict close. This succeeds only when all lines are fully satisfied.",
    close_override:
      "Confirming will force-close this indent using your override reason and bypass strict completion checks.",
  };
  qs("indentActionTitle").textContent = titles[action] ?? "Confirm Action";
  qs("indentActionItem").textContent = indent.indent_number;
  qs("indentActionExplain").textContent =
    explain[action] ?? "Please review this action before confirming.";
  qs("indentApproveDateRow").style.display = action === "approve" ? "" : "none";
  qs("indentOverrideReasonRow").style.display =
    action === "close_override" ? "" : "none";
  if (action === "approve") {
    qs("indentApproveDate").value = new Date().toISOString().slice(0, 10);
  }
  qs("indentOverrideReason").value = "";
  backdrop.dataset.indentId = String(indent.indent_id);
  backdrop.dataset.action = action;
}

function closeIndentActionModal() {
  const backdrop = qs("indentActionModalBackdrop");
  hideModalBackdrop(backdrop, [qs("iSearch")]);
}

async function confirmIndentAction() {
  const backdrop = qs("indentActionModalBackdrop");
  const indentId = Number(backdrop.dataset.indentId);
  const action = backdrop.dataset.action;
  let error;
  if (action === "approve") {
    const approvedDate = qs("indentApproveDate").value;
    if (!approvedDate) {
      toast("Approval date is required.", "error");
      return;
    }
    ({ error } = await supabase.rpc("proc_indent_set_status", {
      p_indent_id: indentId,
      p_status: "approved",
      p_approved_date: approvedDate,
    }));
  } else if (action === "issue") {
    ({ error } = await supabase.rpc("proc_indent_issue", {
      p_indent_id: indentId,
    }));
  } else if (action === "close_strict") {
    ({ error } = await supabase.rpc("proc_indent_close_strict", {
      p_indent_id: indentId,
    }));
  } else if (action === "close_override") {
    const reason = (qs("indentOverrideReason").value || "").trim();
    if (!reason) {
      toast("Override reason is required.", "error");
      return;
    }
    ({ error } = await supabase.rpc("proc_indent_close_with_override", {
      p_indent_id: indentId,
      p_reason: reason,
    }));
  }
  if (error) {
    toast(`Action failed: ${error.message}`, "error");
    return;
  }
  toast("Action completed.", "success");
  closeIndentActionModal();
  await loadIndents();
  if (state.selectedIndent?.indent_id === indentId) {
    // Refresh the selected indent data and update modal header
    const updated = state.indentsRows.find((r) => r.indent_id === indentId);
    if (updated) {
      state.selectedIndent = updated;
      renderIndentModalHeader(updated);
    }
    await loadIndentLines(indentId);
  }
}

function wireIndentControls() {
  qs("iBtnPrev").addEventListener("click", () => {
    state.indentsPage = Math.max(0, state.indentsPage - 1);
    loadIndents();
  });
  qs("iBtnNext").addEventListener("click", () => {
    state.indentsPage += 1;
    loadIndents();
  });
  qs("iStatus").addEventListener("change", () => {
    state.indentsPage = 0;
    loadIndents();
  });
  qs("iClass").addEventListener("change", () => {
    state.indentsPage = 0;
    loadIndents();
  });
  wireLiveSearchInput({
    inputId: "iSearch",
    clearId: "iSearchClear",
    onSearch: () => {
      state.indentsPage = 0;
      loadIndents();
    },
  });

  const iLineSearchEl = qs("iLineSearch");
  const iLineFilterBtn = qs("iLineFilterBtn");
  const iLineFilterDrawer = qs("iLineFilterDrawer");
  const iLineFilterSelect = qs("iLineFilterSelect");
  const iLinesPrev = qs("iLinesPrev");
  const iLinesNext = qs("iLinesNext");

  iLineSearchEl?.addEventListener("input", (e) => {
    iLineQuery = e.target.value.trim().toLowerCase();
    iLinePage = 0;
    applyIndentLineFiltersAndRender();
  });

  if (iLineFilterBtn && iLineFilterDrawer) {
    iLineFilterBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = iLineFilterDrawer.classList.contains("open");
      document.querySelectorAll(".pec-filter-drawer.open").forEach((drawer) => {
        if (drawer !== iLineFilterDrawer) {
          drawer.classList.remove("open");
          drawer
            .closest(".pec-filter-wrap")
            ?.querySelector(".pec-filter-btn")
            ?.setAttribute("aria-expanded", "false");
        }
      });
      iLineFilterDrawer.classList.toggle("open", !isOpen);
      iLineFilterBtn.setAttribute("aria-expanded", String(!isOpen));
      if (!isOpen) {
        const rect = iLineFilterBtn.getBoundingClientRect();
        iLineFilterDrawer.style.position = "fixed";
        iLineFilterDrawer.style.top = rect.bottom + 4 + "px";
        iLineFilterDrawer.style.left = rect.left + "px";
        iLineFilterDrawer.style.zIndex = "10001";
        requestAnimationFrame(() => {
          const dropW = iLineFilterDrawer.offsetWidth || 220;
          if (rect.left + dropW > window.innerWidth) {
            iLineFilterDrawer.style.left =
              Math.max(4, rect.right - dropW) + "px";
          }
        });
        iLineFilterSelect?.focus();
      }
    });
    iLineFilterDrawer.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", (e) => {
      if (
        iLineFilterDrawer.classList.contains("open") &&
        !iLineFilterDrawer.contains(e.target) &&
        e.target !== iLineFilterBtn &&
        !iLineFilterBtn.contains(e.target)
      ) {
        iLineFilterDrawer.classList.remove("open");
        iLineFilterBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  iLineFilterSelect?.addEventListener("change", () => {
    iLineFilter = iLineFilterSelect.value;
    syncIndentLineFilterBadge();
    iLinePage = 0;
    applyIndentLineFiltersAndRender();
  });

  iLinesPrev?.addEventListener("click", () => {
    if (iLinePage <= 0) return;
    iLinePage -= 1;
    applyIndentLineFiltersAndRender();
  });
  iLinesNext?.addEventListener("click", () => {
    const all = state.indentLinesRows || [];
    let rows = all;
    if (iLineQuery) {
      rows = rows.filter((r) => {
        const hay = [
          r.stock_item_name,
          r.stock_item_code,
          r.code,
          r.uom_code,
          r.material_class_code,
          r.material_class_label,
          String(r.stock_item_id ?? ""),
          String(r.uom_id ?? ""),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(iLineQuery);
      });
    }
    if (iLineFilter === "remaining_only") {
      rows = rows.filter((r) => Number(r.remaining_qty || 0) > 0);
    } else if (iLineFilter === "allocated_only") {
      rows = rows.filter((r) => Number(r.allocated_qty || 0) > 0);
    } else if (iLineFilter === "zero_requested") {
      rows = rows.filter((r) => Number(r.requested_qty || 0) === 0);
    }
    const hasNext = (iLinePage + 1) * iLinePageSize < rows.length;
    if (!hasNext) return;
    iLinePage += 1;
    applyIndentLineFiltersAndRender();
  });

  qs("btnIndentActionCancel").addEventListener("click", closeIndentActionModal);
  qs("btnIndentActionConfirm").addEventListener("click", confirmIndentAction);
  qs("indentActionModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "indentActionModalBackdrop") closeIndentActionModal();
  });

  // Indent view modal close
  qs("btnIndentViewClose").addEventListener("click", closeIndentViewModal);
  qs("indentViewModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "indentViewModalBackdrop") closeIndentViewModal();
  });

  // New Draft Indent
  qs("iBtnNewDraft").addEventListener("click", openCreateIndentModal);
  // Create from PR
  qs("iBtnFromPR").addEventListener("click", openIndentFromPrModal);
  // Add Line
  qs("iBtnAddLine").addEventListener("click", () => {
    if (!state.selectedIndent) {
      toast("Select an indent first.", "error");
      return;
    }
    if (state.selectedIndent.status === "draft") {
      toast(
        "Draft indent lines are managed via PR revision + resync.",
        "error",
      );
      return;
    }
    openIndentAddLineModal(null);
  });
  // Edit Line Qty
  const btnEditLineQty = qs("iBtnEditLineQty");
  if (btnEditLineQty) {
    btnEditLineQty.addEventListener("click", () => {
      if (!state.selectedIndentLine) {
        toast("Select a line first.", "error");
        return;
      }
      if (state.selectedIndent?.status === "draft") {
        toast(
          "Draft indent quantities are corrected via PR revision + resync.",
          "error",
        );
        return;
      }
      openIndentAddLineModal(state.selectedIndentLine);
    });
  }

  qs("btnIndentOpenPr")?.addEventListener("click", async () => {
    if (!state.selectedIndent?.source_pr_id) {
      toast("No source PR linked to this indent.", "error");
      return;
    }
    await openPrViewModalById(state.selectedIndent.source_pr_id);
  });
  qs("btnIndentCreatePrRevision")?.addEventListener(
    "click",
    createIndentPrRevision,
  );
  qs("btnIndentSetSourcePr")?.addEventListener(
    "click",
    openIndentSourcePrModal,
  );
  qs("btnIndentDeleteDraft")?.addEventListener("click", async () => {
    const indent = state.selectedIndent;
    if (!indent) {
      toast("Select an indent first.", "error");
      return;
    }
    const confirmed = await confirmHardDelete({
      title: "Delete Draft Indent?",
      message:
        "This will permanently delete the draft Indent and all its lines. This cannot be undone.",
      onConfirm: async (reason) => {
        const { error } = await supabase.rpc("proc_indent_delete_draft", {
          p_indent_id: indent.indent_id,
          p_reason: reason,
        });
        if (error) throw new Error(error.message);
      },
    });
    if (!confirmed) return;
    toast("Draft Indent deleted.", "success");
    state.selectedIndent = null;
    state.selectedIndentLine = null;
    state.indentLinesRows = [];
    closeIndentViewModal();
    await loadIndents();
  });
  qs("btnIndentResyncMenu")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleExportMenu("iResyncMenu", qs("btnIndentResyncMenu"));
  });
  qs("btnIndentResyncSafe")?.addEventListener("click", () => {
    closeAllExportMenus();
    openIndentResyncModal("safe");
  });
  qs("btnIndentResyncFull")?.addEventListener("click", () => {
    closeAllExportMenus();
    openIndentResyncModal("full");
  });

  qs("btnIndentSourcePrCancel")?.addEventListener(
    "click",
    closeIndentSourcePrModal,
  );
  qs("btnIndentSourcePrConfirm")?.addEventListener(
    "click",
    confirmIndentSourcePr,
  );
  qs("indentSourcePrModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "indentSourcePrModalBackdrop")
      closeIndentSourcePrModal();
  });

  qs("btnIndentResyncCancel")?.addEventListener(
    "click",
    closeIndentResyncModal,
  );
  qs("btnIndentResyncConfirm")?.addEventListener("click", confirmIndentResync);
  qs("indentResyncModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "indentResyncModalBackdrop") closeIndentResyncModal();
  });
  // Indent view export dropdown (PDF / CSV / TSV)
  qs("btnIExportMenu").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleExportMenu("iExportMenu", qs("btnIExportMenu"));
  });
  qs("btnIExportDropdownPdf").addEventListener("click", () => {
    closeAllExportMenus();
    if (!state.selectedIndent) {
      toast("Select an indent first.", "error");
      return;
    }
    if (state.selectedIndent.status !== "approved") {
      toast("PDF export is available only for approved indents.", "error");
      return;
    }
    openExportIndentModal();
  });
  qs("btnIExportDropdownCsv").addEventListener("click", async () => {
    closeAllExportMenus();
    if (!state.selectedIndent) {
      toast("Select an indent first.", "error");
      return;
    }
    try {
      const { rows } = await buildIndentRequisitionRows(
        state.selectedIndent.indent_id,
      );
      if (!rows.length) {
        toast("No lines to export.", "error");
        return;
      }
      const stamp = makeExportTimestamp();
      const base = `indent_${state.selectedIndent.indent_number || "lines"}_${stamp}`;
      downloadText(
        `${base}.csv`,
        toCsv(rows, INDENT_REQUISITION_HEADERS),
        "text/csv;charset=utf-8;",
      );
      toast(`CSV exported (${rows.length} rows).`, "success");
    } catch (err) {
      toast(`CSV export failed: ${err.message}`, "error");
    }
  });
  qs("btnIExportDropdownTsv").addEventListener("click", async () => {
    closeAllExportMenus();
    if (!state.selectedIndent) {
      toast("Select an indent first.", "error");
      return;
    }
    try {
      const { rows } = await buildIndentRequisitionRows(
        state.selectedIndent.indent_id,
      );
      if (!rows.length) {
        toast("No lines to export.", "error");
        return;
      }
      const stamp = makeExportTimestamp();
      const base = `indent_${state.selectedIndent.indent_number || "lines"}_${stamp}`;
      downloadText(
        `${base}.tsv`,
        toTsv(rows, INDENT_REQUISITION_HEADERS),
        "text/tab-separated-values;charset=utf-8;",
      );
      toast(`TSV exported (${rows.length} rows).`, "success");
    } catch (err) {
      toast(`TSV export failed: ${err.message}`, "error");
    }
  });
  qs("btnExpCancel").addEventListener("click", closeExportIndentModal);
  qs("exportIndentModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "exportIndentModalBackdrop") closeExportIndentModal();
  });
  qs("btnExpExportPdf").addEventListener("click", exportIndentToPdf);
}

function openWorkflowGuideModal() {
  const bd = qs("workflowGuideModalBackdrop");
  if (!bd) return;
  bd.classList.add("show");
  bd.setAttribute("aria-hidden", "false");
}

function closeWorkflowGuideModal() {
  const bd = qs("workflowGuideModalBackdrop");
  if (!bd) return;
  hideModalBackdrop(bd, [qs("workflowGuideBtn")]);
}

async function refreshAllTabsData() {
  const btn = qs("globalRefreshBtn");
  if (btn) btn.disabled = true;
  try {
    await loadActionQueue();
    await loadPrHeaders();
    await loadIndents();
    await loadExcess();
    await loadExcessAudit();
    if (state.vwl.loaded) await loadVendorBuylist();

    if (state.selectedIndent?.indent_id) {
      await loadIndentLines(state.selectedIndent.indent_id);
    }
    // if (
    //   state.selectedPr?.pr_id &&
    //   qs("prViewModalBackdrop")?.classList.contains("show")
    // ) {
    //   await loadPrLines(state.selectedPr.pr_id);
    // }

    await refreshAllTabCounts();
    updateExportButtonStates();
    toast("All tabs refreshed.", "success");
  } catch (err) {
    console.error("Global refresh failed:", err);
    toast("Global refresh failed. Check console/logs.", "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

function wireGlobalHeaderControls() {
  qs("globalRefreshBtn")?.addEventListener("click", refreshAllTabsData);
  qs("workflowGuideBtn")?.addEventListener("click", openWorkflowGuideModal);
  qs("btnWorkflowGuideClose")?.addEventListener(
    "click",
    closeWorkflowGuideModal,
  );
  qs("workflowGuideModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "workflowGuideModalBackdrop") closeWorkflowGuideModal();
  });
}

// ─── EXPORT / PRINT INDENT ───────────────────────────────────────────────────

/**
 * Shared data-fetch for the requisition table (PDF, CSV, TSV).
 * Returns { pdfLines, rows } where:
 *   pdfLines – named-prop objects used by the PDF renderer
 *   rows     – object-keyed rows aligned to INDENT_REQUISITION_HEADERS (for CSV/TSV)
 */
async function buildIndentRequisitionRows(indentId) {
  // 1. Indent lines
  const { data: lines, error: lErr } = await supabase
    .from("v_proc_indent_lines_console")
    .select("*")
    .eq("indent_id", indentId)
    .order("indent_line_id");
  if (lErr) throw lErr;

  if (!lines || lines.length === 0) return { pdfLines: [], rows: [] };

  // 2. Sourcing decisions
  const lineIds = lines.map((l) => l.indent_line_id);
  let decisionMap = {};
  if (lineIds.length) {
    const { data: decisions, error: dErr } = await supabase
      .from("proc_indent_line_sourcing_decision")
      .select("*")
      .in("indent_line_id", lineIds);
    if (dErr) throw dErr;
    (decisions ?? []).forEach((d) => (decisionMap[d.indent_line_id] = d));
  }

  // 3. Vendor names
  const vendorIds = [
    ...new Set(
      Object.values(decisionMap).flatMap((d) =>
        [d.selected_vendor_id, d.recommended_vendor_id].filter(Boolean),
      ),
    ),
  ];
  let vendorMap = {};
  if (vendorIds.length) {
    const { data: vendors } = await supabase
      .from("proc_vendor")
      .select("vendor_id,display_name")
      .in("vendor_id", vendorIds);
    (vendors ?? []).forEach((v) => (vendorMap[v.vendor_id] = v.display_name));
  }

  // 4. Item category labels
  const itemIds = [...new Set(lines.map((l) => l.stock_item_id))];
  let itemCatMap = {};
  if (itemIds.length) {
    const { data: items } = await supabase
      .from("v_inv_stock_item_with_class")
      .select("stock_item_id,code,category_label,subcategory_label,group_label")
      .in("stock_item_id", itemIds);
    (items ?? []).forEach(
      (i) =>
        (itemCatMap[i.stock_item_id] = {
          code: i.code,
          category:
            i.subcategory_label || i.group_label || i.category_label || "",
        }),
    );
  }

  // 5. Current stock
  let stockMap = {};
  if (itemIds.length) {
    const { data: stocks } = await supabase
      .from("v_stock_current_by_item")
      .select("inv_stock_item_id,qty_on_hand,source_kind")
      .in("inv_stock_item_id", itemIds);
    const ORDER = ["rm", "plm", "consumables"];
    (stocks ?? []).forEach((s) => {
      const cur = stockMap[s.inv_stock_item_id];
      if (!cur) {
        stockMap[s.inv_stock_item_id] = s;
      } else {
        const curIdx = ORDER.indexOf(cur.source_kind ?? "");
        const newIdx = ORDER.indexOf(s.source_kind ?? "");
        if (newIdx !== -1 && (curIdx === -1 || newIdx < curIdx)) {
          stockMap[s.inv_stock_item_id] = s;
        }
      }
    });
  }

  // Build canonical pdfLines (named props, fmt() for PDF renderer)
  const pdfLines = lines.map((l) => {
    const dec = decisionMap[l.indent_line_id] ?? {};
    const vendorId = dec.selected_vendor_id ?? dec.recommended_vendor_id;
    const unitPriceRaw = dec.selected_rate ?? dec.recommended_rate;
    const cat = itemCatMap[l.stock_item_id] ?? {};
    const qtyInStock = stockMap[l.stock_item_id]?.qty_on_hand ?? 0;
    return {
      category: cat.category || l.material_class_label || "",
      materialDescription: l.stock_item_name ?? "",
      uom: l.uom_code ?? String(l.uom_id ?? ""),
      qtyRequested: fmt(l.requested_qty ?? ""),
      qtyInStock: fmt(qtyInStock),
      qtyToPurchase: fmt(l.remaining_qty ?? l.requested_qty ?? ""),
      // fmt() for PDF display; formatMoney() (2dp, no symbol) for CSV/TSV
      unitPrice:
        unitPriceRaw !== null && unitPriceRaw !== undefined
          ? fmt(unitPriceRaw)
          : "",
      unitPriceCsv:
        unitPriceRaw !== null && unitPriceRaw !== undefined
          ? formatMoney(unitPriceRaw)
          : "",
      preferredSupplier: vendorId ? (vendorMap[vendorId] ?? "") : "",
      remarks: l.manual_reason || "",
    };
  });

  // Build object rows keyed by INDENT_REQUISITION_HEADERS (for CSV/TSV)
  const rows = pdfLines.map((line, idx) => ({
    SN: String(idx + 1),
    Category: line.category || "",
    "Material Description": line.materialDescription || "",
    "Brand / Part No": "-",
    UOM: line.uom || "",
    "Qty. Requested": line.qtyRequested || "",
    "Qty. in Stock": line.qtyInStock || "0",
    "Qty. to be Purchased": line.qtyToPurchase || "",
    "Unit Price": line.unitPriceCsv || "",
    "Preferred Supplier Name": line.preferredSupplier || "",
    Remarks: line.remarks || "",
  }));

  return { pdfLines, rows };
}

function openExportIndentModal() {
  if (!state.selectedIndent) return;
  const row = state.selectedIndent;
  qs("expReqNo").value = row.indent_number ?? "";
  qs("expReqType").value =
    row.material_class_label ?? row.material_class_code ?? "All";
  qs("expReqDate").value = new Date().toISOString().slice(0, 10);
  qs("expDeptUnit").value = "SHRO / SASV";
  qs("expLocation").value =
    "Raw Material Store, Santhigiri Ayurveda Siddha Vaidyasala";
  qs("expRequestedBy").value = "";
  qs("expContactDetails").value = "";
  const bd = qs("exportIndentModalBackdrop");
  bd.classList.add("show");
  bd.setAttribute("aria-hidden", "false");
}

function closeExportIndentModal() {
  hideModalBackdrop(qs("exportIndentModalBackdrop"), [qs("btnIExportMenu")]);
}

async function exportIndentToPdf() {
  if (!state.selectedIndent) return;

  /* global jspdf */
  if (typeof jspdf === "undefined") {
    toast("PDF library not available. Please reload the page.", "error");
    return;
  }

  const indentId = state.selectedIndent.indent_id;
  const deptUnit = qs("expDeptUnit").value.trim();
  const location = qs("expLocation").value.trim();
  const indentNumber = qs("expReqNo").value.trim();
  const reqDate = qs("expReqDate").value;
  const reqType = qs("expReqType").value.trim();
  const requestedBy = qs("expRequestedBy").value.trim();
  const contactDetails = qs("expContactDetails").value.trim();

  const btn = qs("btnExpExportPdf");
  btn.disabled = true;
  btn.textContent = "Generating\u2026";

  try {
    // Fetch all requisition data via shared function (same source as CSV/TSV)
    const { pdfLines } = await buildIndentRequisitionRows(indentId);

    if (!pdfLines.length) {
      toast("No lines in this indent. Cannot export.", "error");
      return;
    }

    // Generate PDF using jsPDF
    const { jsPDF } = jspdf;
    const doc = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "landscape",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    const FOOTER_H = 12;
    const contact = contactDetails;

    // Context for header/footer drawing
    const ctx = {
      margin,
      pageWidth: doc.internal.pageSize.getWidth(),
      deptUnit,
      location,
      indentNumber,
      reqDate,
      reqType,
      requestedBy,
      contact,
    };

    function buildHeaderLayoutEngine(doc, ctx) {
      const margin = ctx.margin;
      const pageW = ctx.pageWidth;

      // Two columns on the page
      const colGap = 10;
      const colW = (pageW - margin * 2 - colGap) / 2;
      const leftX = margin;
      const rightX = margin + colW + colGap;

      // Inside each column: label | : | value (tab stop)
      const labelW = 30;
      const colonX = labelW + 2;
      const valueX = colonX + 4;
      const valueW = colW - valueX;

      const metaFont = 9;
      const metaLH = 5.2;
      const rowGap = 1.2;

      function wrap(text, maxW) {
        const s = String(text ?? "").trim();
        if (!s) return ["-"];
        return doc.splitTextToSize(s, maxW);
      }

      function drawKV(x, y, label, value) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(metaFont);
        doc.text(String(label), x, y, { align: "left" });

        // Colon aligned in a fixed vertical line
        doc.text(":", x + colonX, y, { align: "left" });

        doc.setFont("helvetica", "normal");
        const lines = wrap(value, valueW);
        doc.text(lines, x + valueX, y);

        return lines.length * metaLH;
      }

      function measureKV(value) {
        const lines = wrap(value, valueW);
        return lines.length * metaLH;
      }

      function drawRow(y, leftLabel, leftVal, rightLabel, rightVal) {
        const hL = drawKV(leftX, y, leftLabel, leftVal);
        const hR = rightLabel
          ? drawKV(rightX, y, rightLabel, rightVal)
          : metaLH;
        return y + Math.max(hL, hR) + rowGap;
      }

      function drawRightOnlyRow(y, rightLabel, rightVal) {
        const hR = drawKV(rightX, y, rightLabel, rightVal);
        return y + hR + rowGap;
      }

      function measureRow(y, leftVal, rightVal, hasRight) {
        const hL = measureKV(leftVal);
        const hR = hasRight ? measureKV(rightVal) : metaLH;
        return y + Math.max(hL, hR) + rowGap;
      }

      function measureRightOnlyRow(y, rightVal) {
        const hR = measureKV(rightVal);
        return y + hR + rowGap;
      }

      function drawTitleBlock(y) {
        function centered(text, yPos, font, size) {
          doc.setFont("times", font);
          doc.setFontSize(size);
          const w = doc.getTextWidth(text);
          doc.text(text, (pageW - w) / 2, yPos);
        }

        centered("Gurucharanam Saranam", y, "italic", 11);
        y += 7.0;
        centered("Santhigiri Ashram", y, "bold", 11);
        y += 9.0;
        centered("PURCHASE REQUISITION FORM", y, "bold", 17);
        y += 11.0;

        // Subtle divider under title block
        doc.setDrawColor(0);
        doc.setLineWidth(0.15);
        doc.line(ctx.margin, y - 4, ctx.pageWidth - ctx.margin, y - 4);

        // Breathing room after the divider before metadata grid
        y += 2;

        return y;
      }

      function measureTitleBlock(y) {
        y += 7.0;
        y += 9.0;
        y += 11.0;
        y += 2;
        return y;
      }

      function drawHeader(_doc = doc, _ctx = ctx) {
        let y = _ctx.margin;

        y = drawTitleBlock(y);
        y = drawRow(y, "Dept/Unit", _ctx.deptUnit, "Date", _ctx.reqDate);
        y = drawRow(y, "Location", _ctx.location, "Req No", _ctx.indentNumber);
        y = drawRow(y, "Type", _ctx.reqType, "Requested By", _ctx.requestedBy);
        y = drawRightOnlyRow(y, "Contact", _ctx.contact);

        _doc.setFont("helvetica", "bold");
        _doc.setFontSize(11);
        _doc.text("MATERIAL DETAILS", _ctx.margin, y + 2);

        // Keep table close to section heading (no large white gap)
        return y + 2;
      }

      function measureHeader(_doc = doc, _ctx = ctx) {
        void _doc;
        let y = _ctx.margin;

        y = measureTitleBlock(y);
        y = measureRow(y, _ctx.deptUnit, _ctx.reqDate, true);
        y = measureRow(y, _ctx.location, _ctx.indentNumber, true);
        y = measureRow(y, _ctx.reqType, _ctx.requestedBy, true);
        y = measureRightOnlyRow(y, _ctx.contact);

        // MATERIAL DETAILS + tight gap
        return y + 2;
      }

      return { drawHeader, measureHeader };
    }

    const headerEngine = buildHeaderLayoutEngine(doc, ctx);

    // Exact header bottom (no extra whitespace above table)
    const HEADER_H = headerEngine.measureHeader(doc, ctx);

    // Helper: Draw footer with page numbers
    const drawPageFooter = (doc, ctx, pageNo, totalPages) => {
      const { margin, pageWidth } = ctx;
      const ph = doc.internal.pageSize.getHeight();
      doc.setFontSize(7).setFont("helvetica", "normal").setTextColor(100);
      doc.text(
        `Page ${pageNo} of ${totalPages}`,
        pageWidth - margin - 10,
        ph - 5,
        {
          align: "right",
        },
      );
      if (ctx.indentNumber) {
        doc.text(`PR: ${ctx.indentNumber}`, margin, ph - 5);
      }
    };

    function formatHeaderLabel(label, maxWidthMm) {
      const text = String(label || "").trim();
      if (!text) return "";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      const usableWidth = Math.max(4, maxWidthMm - 2.5);
      if (doc.getTextWidth(text) <= usableWidth) return text;

      const preferredBreaks = {
        "Brand / Part No": ["Brand /", "Part No"],
        "Qty. Requested": ["Qty.", "Requested"],
        "Qty. in Stock": ["Qty. in", "Stock"],
        "Qty. to Purchase": ["Qty. to", "Purchase"],
        "Unit Price": ["Unit", "Price"],
        "Preferred Supplier": ["Preferred", "Supplier"],
        "Material Description": ["Material", "Description"],
      };
      if (preferredBreaks[text]) return preferredBreaks[text].join("\n");

      const words = text.split(/\s+/).filter(Boolean);
      if (words.length <= 1) return text;
      let best = text;
      let bestScore = Number.POSITIVE_INFINITY;
      for (let i = 1; i < words.length; i += 1) {
        const left = words.slice(0, i).join(" ");
        const right = words.slice(i).join(" ");
        const leftW = doc.getTextWidth(left);
        const rightW = doc.getTextWidth(right);
        if (leftW <= usableWidth && rightW <= usableWidth) {
          const score = Math.abs(leftW - rightW);
          if (score < bestScore) {
            bestScore = score;
            best = `${left}\n${right}`;
          }
        }
      }
      return best;
    }

    // Build table data
    const tableHead = [
      [
        "SN",
        "Category",
        "Material Description",
        "Brand / Part No",
        "UOM",
        "Qty. Requested",
        "Qty. in Stock",
        "Qty. to Purchase",
        "Unit Price",
        "Preferred Supplier",
        "Remarks",
      ],
    ];

    const tableBody = pdfLines.map((line, idx) => [
      String(idx + 1),
      line.category || "",
      line.materialDescription || "",
      "-",
      line.uom || "",
      line.qtyRequested || "",
      line.qtyInStock || "0",
      line.qtyToPurchase || "",
      line.unitPrice || "",
      line.preferredSupplier || "",
      line.remarks || "",
    ]);

    // Fill table across printable width using relative column weights
    const availableWidth = ctx.pageWidth - ctx.margin * 2;
    const weights = [
      0.7, // SN
      2.2, // Category
      6.6, // Material Description
      1.4, // Brand/Part No
      1.0, // UOM
      1.6, // Qty Requested
      1.6, // Qty in Stock
      1.8, // Qty to Purchase
      1.6, // Unit Price
      3.8, // Preferred Supplier
      2.3, // Remarks
    ];
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const colW = weights.map((w) => (availableWidth * w) / weightSum);

    const columnStyles = {
      0: { cellWidth: colW[0], halign: "center" },
      1: { cellWidth: colW[1] },
      2: { cellWidth: colW[2] },
      3: { cellWidth: colW[3], halign: "center" },
      4: { cellWidth: colW[4], halign: "center" },
      5: { cellWidth: colW[5], halign: "right" },
      6: { cellWidth: colW[6], halign: "right" },
      7: { cellWidth: colW[7], halign: "right" },
      8: { cellWidth: colW[8], halign: "right" },
      9: { cellWidth: colW[9] },
      10: { cellWidth: colW[10] },
    };

    tableHead[0] = tableHead[0].map((label, index) =>
      formatHeaderLabel(label, colW[index]),
    );

    // Draw table — didDrawPage fires for every page including page 1
    doc.autoTable({
      theme: "grid",
      showHead: "everyPage",
      head: tableHead,
      body: tableBody,
      margin: { top: HEADER_H, left: margin, right: margin, bottom: FOOTER_H },
      styles: {
        fontSize: 8,
        cellPadding: 1.8,
        overflow: "linebreak",
        valign: "middle",
        lineWidth: 0.2,
        lineColor: 0,
        textColor: 0,
      },
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: 0,
        fontStyle: "bold",
        lineWidth: 0.2,
        lineColor: 0,
        fontSize: 8,
        halign: "center",
        valign: "middle",
      },
      columnStyles,
      didDrawPage: () => {
        headerEngine.drawHeader(doc, ctx);
      },
    });

    // Stamp accurate page numbers on every page after table is complete
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawPageFooter(doc, ctx, i, totalPages);
    }

    // Signature block on last page; add new page if insufficient space
    doc.setPage(totalPages);
    const pageHeight = doc.internal.pageSize.getHeight();
    let sigY = doc.lastAutoTable.finalY + 16;
    if (sigY + 20 > pageHeight - FOOTER_H) {
      doc.addPage("a4", "landscape");
      sigY = margin + 20;
    }

    const colWidth = (pageWidth - 2 * margin) / 3;
    doc.setDrawColor(0).setLineWidth(0.2);
    doc.line(margin, sigY, margin + colWidth - 5, sigY);
    doc.line(margin + colWidth + 5, sigY, margin + 2 * colWidth, sigY);
    doc.line(margin + 2 * colWidth + 5, sigY, pageWidth - margin, sigY);

    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(0);
    doc.text("Requested By", margin + colWidth / 2, sigY + 4, {
      align: "center",
    });
    doc.text("Approved By", margin + colWidth + colWidth / 2, sigY + 4, {
      align: "center",
    });
    doc.text(
      "Procurement Officer",
      margin + 2 * colWidth + colWidth / 2,
      sigY + 4,
      { align: "center" },
    );

    // If a new page was added for signatures, re-stamp page numbers with updated total
    const finalTotalPages = doc.internal.getNumberOfPages();
    if (finalTotalPages > totalPages) {
      for (let i = 1; i <= finalTotalPages; i++) {
        doc.setPage(i);
        drawPageFooter(doc, ctx, i, finalTotalPages);
      }
    }

    // Save PDF
    doc.save(`${indentNumber || "PR"}.pdf`);

    toast("PDF exported successfully", "success");
    closeExportIndentModal();
  } catch (err) {
    toast(`Export error: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `${iconSvg("document")}Export PDF`;
  }
}

// ─── INDENT CREATION ─────────────────────────────────────────────────────────

function openCreateIndentModal() {
  const backdrop = qs("createIndentModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  qs("ciIndentDate").value = new Date().toISOString().slice(0, 10);
  qs("ciIndentNumber").value = "";
  qs("ciMaterialClass").value = "";
  qs("ciNotes").value = "";
}

function closeCreateIndentModal() {
  hideModalBackdrop(qs("createIndentModalBackdrop"), [qs("iBtnNewDraft")]);
}

async function saveCreateIndent() {
  const indentDate = qs("ciIndentDate").value;
  if (!indentDate) {
    toast("Indent date is required.", "error");
    return;
  }
  const indentNumber = (qs("ciIndentNumber").value || "").trim() || null;
  const materialClassIdRaw = qs("ciMaterialClass").value;
  const materialClassId = materialClassIdRaw
    ? Number(materialClassIdRaw)
    : null;
  const notes = (qs("ciNotes").value || "").trim() || null;

  setLoading(true);
  const { data, error } = await supabase.rpc("proc_indent_create", {
    p_indent_number: indentNumber,
    p_indent_date: indentDate,
    p_material_class_id: materialClassId,
    p_generation_filters: null,
    p_notes: notes,
  });
  setLoading(false);
  if (error) {
    toast(`Create indent failed: ${error.message}`, "error");
    return;
  }
  toast("Indent created.", "success");
  closeCreateIndentModal();
  state.indentsPage = 0;
  await loadIndents();
  // Auto-select the new indent (by indent_id returned from RPC or first row)
  const newId = data?.indent_id ?? data;
  if (newId) {
    const found = state.indentsRows.find((r) => r.indent_id === newId);
    if (found) {
      renderIndents();
      openIndentViewModal(found);
    }
  }
}

async function openIndentFromPrModal() {
  // Load active PRs
  setLoading(true);
  const { data, error } = await supabase
    .from(PR_HEADER_VIEW)
    .select(
      "pr_id, pr_number, effective_from_date, horizon_start_month, horizon_end_month, material_class_id",
    )
    .eq("status", "active")
    .order("pr_number", { ascending: true });
  setLoading(false);
  if (error) {
    toast(`Failed to load PRs: ${error.message}`, "error");
    return;
  }

  const pick = qs("ifpPrPick");
  pick.innerHTML = "";
  for (const pr of data || []) {
    const opt = document.createElement("option");
    opt.value = String(pr.pr_id);
    opt.textContent = `${pr.pr_number} | ${pr.effective_from_date ?? ""} | Class:${pr.material_class_id ?? "All"}`;
    pick.appendChild(opt);
  }
  if (!pick.options.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No active PRs found";
    pick.appendChild(opt);
  }
  qs("ifpIndentNumber").value = "";
  const backdrop = qs("indentFromPrModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
}

function closeIndentFromPrModal() {
  hideModalBackdrop(qs("indentFromPrModalBackdrop"), [qs("iBtnFromPR")]);
}

async function saveIndentFromPr() {
  const prId = Number(qs("ifpPrPick").value || 0);
  if (!prId) {
    toast("Select a PR.", "error");
    return;
  }
  const indentNumber = (qs("ifpIndentNumber").value || "").trim() || null;
  setLoading(true);
  const { data, error } = await supabase.rpc("proc_indent_create_from_pr", {
    p_pr_id: prId,
    p_indent_number: indentNumber,
  });
  setLoading(false);
  if (error) {
    toast(`Create from PR failed: ${error.message}`, "error");
    return;
  }
  toast("Indent created from PR.", "success");
  closeIndentFromPrModal();
  state.indentsPage = 0;
  await loadIndents();
  const newId = data?.indent_id ?? data;
  if (newId) {
    const found = state.indentsRows.find((r) => r.indent_id === newId);
    if (found) {
      renderIndents();
      openIndentViewModal(found);
    }
  }
}

// ─── INDENT LINE ADD / EDIT ───────────────────────────────────────────────────

// ─── Stock Item Picker ────────────────────────────────────────────────────────

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

async function fetchUomCode(uomId) {
  if (!uomId) return "—";
  const { data } = await supabase
    .from("inv_uom")
    .select("code")
    .eq("id", uomId)
    .single();
  return data?.code ?? String(uomId);
}

let _pickerOnSelect = null;
let _pickerClassFilter = null;

function openStockItemPicker({ materialClassId, onSelect }) {
  _pickerOnSelect = onSelect;
  _pickerClassFilter = materialClassId || null;
  qs("stockPickerSearch").value = "";
  qs("stockPickerStatus").textContent = "Type to search…";
  qs("stockPickerTable").style.display = "none";
  qs("stockPickerTbody").innerHTML = "";
  const backdrop = qs("stockPickerModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  setTimeout(() => qs("stockPickerSearch").focus(), 50);
}
void openStockItemPicker;

function closeStockItemPicker() {
  hideModalBackdrop(qs("stockPickerModalBackdrop"));
}

async function runStockPickerSearch(query) {
  const status = qs("stockPickerStatus");
  const q = (query || "").trim();
  if (q.length < 1) {
    status.textContent = "Type to search…";
    qs("stockPickerTable").style.display = "none";
    return;
  }
  status.textContent = "Searching…";
  let req = supabase
    .from("v_inv_stock_item_with_class")
    .select(
      [
        "stock_item_id",
        "code",
        "name",
        "default_uom_id",
        "active",
        "category_id",
        "category_code",
        "category_label",
      ].join(","),
    )
    .eq("active", true)
    .or(`name.ilike.%${q}%,code.ilike.%${q}%`)
    .order("name", { ascending: true })
    .limit(50);
  if (_pickerClassFilter) req = req.eq("category_id", _pickerClassFilter);
  const { data, error } = await req;
  if (error) {
    status.textContent = `Error: ${error.message}`;
    return;
  }
  const rows = data || [];
  status.textContent = `${rows.length} result${rows.length !== 1 ? "s" : ""}`;
  const tbody = qs("stockPickerTbody");
  tbody.innerHTML = "";
  if (rows.length === 0) {
    qs("stockPickerTable").style.display = "none";
    return;
  }
  qs("stockPickerTable").style.display = "";
  for (const item of rows) {
    const classLabel =
      item.category_code ??
      (item.category_id === 1
        ? "RM"
        : item.category_id === 2
          ? "PLM"
          : item.category_id === 5
            ? "IND"
            : String(item.category_id ?? ""));
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    tr.innerHTML = `<td><b>${esc(item.code ?? "")}</b></td><td>${esc(item.name ?? "")}</td><td>${esc(classLabel)}</td>`;
    tr.addEventListener("click", () => {
      closeStockItemPicker();
      if (_pickerOnSelect)
        _pickerOnSelect({
          stock_item_id: item.stock_item_id,
          code: item.code,
          name: item.name,
          default_uom_id: item.default_uom_id,
          category_id: item.category_id,
          category_code: item.category_code,
          category_label: item.category_label,
        });
    });
    tbody.appendChild(tr);
  }
}

function wireAddPrLineItemSearch() {
  const input = qs("prAddLineItemSearch");
  const results = qs("prAddLineItemResults");
  const backdrop = qs("prAddLineModalBackdrop");
  if (!input || !results || !backdrop) return;

  let _timer = null;
  let currentItems = [];
  let highlighted = -1;

  function getOptionEls() {
    return Array.from(results.querySelectorAll("li:not(.no-results)"));
  }

  function setHighlight(idx) {
    const els = getOptionEls();
    if (!els.length) return;
    highlighted = Math.max(0, Math.min(idx, els.length - 1));
    els.forEach((el, i) => {
      if (i === highlighted) {
        el.setAttribute("aria-selected", "true");
        el.scrollIntoView({ block: "nearest" });
      } else {
        el.removeAttribute("aria-selected");
      }
    });
  }

  async function selectItem(item) {
    backdrop.dataset.stockItemId = String(item.stock_item_id);
    backdrop.dataset.uomId = String(item.default_uom_id ?? "");
    input.value = `${item.code} — ${item.name}`;
    currentItems = [];
    highlighted = -1;
    results.innerHTML = "";
    results.classList.remove("show");
    input.setAttribute("aria-expanded", "false");
    qs("prAddLineUomText").textContent = await fetchUomCode(
      item.default_uom_id,
    );
  }

  async function doSearch(q) {
    q = (q || "").trim();
    highlighted = -1;
    currentItems = [];
    if (q.length < 1) {
      results.innerHTML = "";
      results.classList.remove("show");
      input.setAttribute("aria-expanded", "false");
      return;
    }
    const classVal = qs("prAddLineClass").value || null;
    let req = supabase
      .from("v_inv_stock_item_with_class")
      .select(
        "stock_item_id,code,name,default_uom_id,category_code,category_id",
      )
      .eq("active", true)
      .or(`name.ilike.%${q}%,code.ilike.%${q}%`)
      .order("name", { ascending: true })
      .limit(50);
    if (classVal) req = req.eq("category_id", Number(classVal));
    const { data, error } = await req;
    results.innerHTML = "";
    if (error) {
      const li = document.createElement("li");
      li.className = "no-results";
      li.textContent = `Error: ${error.message}`;
      results.appendChild(li);
      results.classList.add("show");
      input.setAttribute("aria-expanded", "true");
      return;
    }
    const rows = data || [];
    if (rows.length === 0) {
      const li = document.createElement("li");
      li.className = "no-results";
      li.textContent = "No items found";
      results.appendChild(li);
      results.classList.add("show");
      input.setAttribute("aria-expanded", "true");
      return;
    }
    currentItems = rows;
    rows.forEach((item, idx) => {
      const classLabel = item.category_code ?? String(item.category_id ?? "");
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      li.dataset.idx = String(idx);
      li.innerHTML = `<b>${esc(item.code ?? "")}</b> \u2014 ${esc(item.name ?? "")} <span style="opacity:0.5;font-size:11px">${esc(classLabel)}</span>`;
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectItem(item);
      });
      results.appendChild(li);
    });
    results.classList.add("show");
    input.setAttribute("aria-expanded", "true");
  }

  input.addEventListener("input", (e) => {
    clearTimeout(_timer);
    backdrop.dataset.stockItemId = "";
    backdrop.dataset.uomId = "";
    qs("prAddLineUomText").textContent = "\u2014";
    _timer = setTimeout(() => doSearch(e.target.value), 250);
  });

  input.addEventListener("blur", () => {
    setTimeout(() => {
      results.classList.remove("show");
      input.setAttribute("aria-expanded", "false");
      highlighted = -1;
    }, 150);
  });

  input.addEventListener("keydown", (e) => {
    const open = results.classList.contains("show");
    const els = getOptionEls();

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open || !els.length) return;
      setHighlight(highlighted < 0 ? 0 : highlighted + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open || !els.length) return;
      setHighlight(highlighted <= 0 ? els.length - 1 : highlighted - 1);
    } else if (e.key === "Enter") {
      if (open && highlighted >= 0 && currentItems[highlighted]) {
        e.preventDefault();
        selectItem(currentItems[highlighted]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        results.classList.remove("show");
        input.setAttribute("aria-expanded", "false");
        highlighted = -1;
        e.stopPropagation(); // close dropdown only; don't bubble to modal handler
      }
      // dropdown already closed → let ESC bubble to the modal ESC handler
    }
  });

  qs("prAddLineClass")?.addEventListener("change", () => {
    backdrop.dataset.stockItemId = "";
    backdrop.dataset.uomId = "";
    input.value = "";
    currentItems = [];
    highlighted = -1;
    results.innerHTML = "";
    results.classList.remove("show");
    qs("prAddLineUomText").textContent = "\u2014";
  });
}

function wireAddIndentLineItemSearch() {
  const input = qs("ialItemSearch");
  const results = qs("ialItemResults");
  const helper = qs("ialItemHelper");
  const backdrop = qs("indentAddLineModalBackdrop");
  if (!input || !results || !backdrop) return;

  let timer = null;
  let currentItems = [];
  let highlighted = -1;

  function getOptionEls() {
    return Array.from(results.querySelectorAll("li:not(.no-results)"));
  }

  function setHighlight(idx) {
    const els = getOptionEls();
    if (!els.length) return;
    highlighted = Math.max(0, Math.min(idx, els.length - 1));
    els.forEach((el, i) => {
      if (i === highlighted) {
        el.setAttribute("aria-selected", "true");
        el.scrollIntoView({ block: "nearest" });
      } else {
        el.removeAttribute("aria-selected");
      }
    });
  }

  async function selectItem(item) {
    backdrop.dataset.stockItemId = String(item.stock_item_id);
    backdrop.dataset.uomId = String(item.default_uom_id ?? "");
    input.value = `${item.code} — ${item.name}`;
    currentItems = [];
    highlighted = -1;
    results.innerHTML = "";
    results.classList.remove("show");
    input.setAttribute("aria-expanded", "false");
    qs("ialUomText").textContent = await fetchUomCode(item.default_uom_id);
    qs("ialMaterialClass").disabled = true;
    if (helper) helper.textContent = "Item selected, UOM auto-filled.";
  }

  async function doSearch(q) {
    q = (q || "").trim();
    highlighted = -1;
    currentItems = [];
    if (q.length < 1) {
      results.innerHTML = "";
      results.classList.remove("show");
      input.setAttribute("aria-expanded", "false");
      return;
    }
    const classVal = qs("ialMaterialClass").value || null;
    let req = supabase
      .from("v_inv_stock_item_with_class")
      .select(
        "stock_item_id,code,name,default_uom_id,category_code,category_id",
      )
      .eq("active", true)
      .or(`name.ilike.%${q}%,code.ilike.%${q}%`)
      .order("name", { ascending: true })
      .limit(50);
    if (classVal) req = req.eq("category_id", Number(classVal));

    const { data, error } = await req;
    results.innerHTML = "";
    if (error) {
      const li = document.createElement("li");
      li.className = "no-results";
      li.textContent = `Error: ${error.message}`;
      results.appendChild(li);
      results.classList.add("show");
      input.setAttribute("aria-expanded", "true");
      return;
    }
    const rows = data || [];
    if (rows.length === 0) {
      const li = document.createElement("li");
      li.className = "no-results";
      li.textContent = "No items found";
      results.appendChild(li);
      results.classList.add("show");
      input.setAttribute("aria-expanded", "true");
      return;
    }
    currentItems = rows;
    rows.forEach((item, idx) => {
      const classLabel = item.category_code ?? String(item.category_id ?? "");
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      li.dataset.idx = String(idx);
      li.innerHTML = `<b>${esc(item.code ?? "")}</b> — ${esc(item.name ?? "")} <span style="opacity:0.5;font-size:11px">${esc(classLabel)}</span>`;
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectItem(item);
      });
      results.appendChild(li);
    });
    results.classList.add("show");
    input.setAttribute("aria-expanded", "true");
  }

  input.addEventListener("input", (e) => {
    if (input.disabled) return;
    clearTimeout(timer);
    backdrop.dataset.stockItemId = "";
    backdrop.dataset.uomId = "";
    qs("ialUomText").textContent = "—";
    if (helper) helper.textContent = "Type to search and pick a stock item.";
    timer = setTimeout(() => doSearch(e.target.value), 250);
  });

  input.addEventListener("blur", () => {
    setTimeout(() => {
      results.classList.remove("show");
      input.setAttribute("aria-expanded", "false");
      highlighted = -1;
    }, 150);
  });

  input.addEventListener("keydown", (e) => {
    if (input.disabled) return;
    const open = results.classList.contains("show");
    const els = getOptionEls();

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open || !els.length) return;
      setHighlight(highlighted < 0 ? 0 : highlighted + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open || !els.length) return;
      setHighlight(highlighted <= 0 ? els.length - 1 : highlighted - 1);
    } else if (e.key === "Enter") {
      if (open && highlighted >= 0 && currentItems[highlighted]) {
        e.preventDefault();
        selectItem(currentItems[highlighted]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        results.classList.remove("show");
        input.setAttribute("aria-expanded", "false");
        highlighted = -1;
        e.stopPropagation();
      }
    }
  });

  qs("ialMaterialClass")?.addEventListener("change", () => {
    if (input.disabled) return;
    backdrop.dataset.stockItemId = "";
    backdrop.dataset.uomId = "";
    input.value = "";
    currentItems = [];
    highlighted = -1;
    results.innerHTML = "";
    results.classList.remove("show");
    input.setAttribute("aria-expanded", "false");
    qs("ialUomText").textContent = "—";
    if (helper) helper.textContent = "Type to search and pick a stock item.";
  });
}

function wireStockItemPicker() {
  qs("btnStockPickerClose").addEventListener("click", closeStockItemPicker);
  qs("stockPickerModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "stockPickerModalBackdrop") closeStockItemPicker();
  });
  qs("stockPickerSearch").addEventListener(
    "input",
    debounce((e) => runStockPickerSearch(e.target.value), 250),
  );
}

function openIndentAddLineModal(existingLine) {
  const backdrop = qs("indentAddLineModalBackdrop");
  const indent = state.selectedIndent;
  const itemInput = qs("ialItemSearch");
  const itemResults = qs("ialItemResults");
  const itemHelper = qs("ialItemHelper");
  const needsReason =
    indent && (indent.status === "approved" || indent.status === "issued");
  qs("ialReasonReq").style.display = needsReason ? "" : "none";
  qs("ialTitle").textContent = existingLine
    ? "Edit Line Qty"
    : "Add Indent Line";

  // Material class: derive from indent if set, else show selector
  const indentClass = indent?.material_class_id ?? null;
  const classRow = qs("ialClassRow");
  const classSelect = qs("ialMaterialClass");
  if (indentClass) {
    classRow.style.display = "none";
    classSelect.value = String(indentClass);
  } else {
    classRow.style.display = "";
    classSelect.value = "";
  }

  // Reset state
  backdrop.dataset.stockItemId = "";
  backdrop.dataset.uomId = "";
  backdrop.dataset.existingLineId = "";
  itemInput.value = "";
  itemInput.disabled = false;
  itemInput.setAttribute("aria-expanded", "false");
  itemResults.innerHTML = "";
  itemResults.classList.remove("show");
  qs("ialUomText").textContent = "—";
  qs("ialQty").value = "";
  qs("ialReason").value = "";
  qs("ialMaterialClass").disabled = false;
  if (itemHelper)
    itemHelper.textContent = "Type to search and pick a stock item.";

  if (existingLine) {
    // In edit mode: lock item, only allow qty change
    backdrop.dataset.stockItemId = String(existingLine.stock_item_id ?? "");
    backdrop.dataset.uomId = String(existingLine.uom_id ?? "");
    backdrop.dataset.existingLineId = String(existingLine.indent_line_id ?? "");
    itemInput.value = existingLine.stock_item_name
      ? `${existingLine.stock_item_name}`
      : `Item #${existingLine.stock_item_id}`;
    itemInput.disabled = true;
    itemInput.setAttribute("aria-expanded", "false");
    qs("ialUomText").textContent = existingLine.uom_code ?? "—";
    qs("ialQty").value = existingLine.requested_qty ?? "";
    qs("ialMaterialClass").disabled = true;
    if (itemHelper)
      itemHelper.textContent = "Item locked in edit mode; UOM shown.";
  }

  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");

  if (!existingLine) {
    setTimeout(() => itemInput.focus(), 50);
  }
}

function closeIndentAddLineModal() {
  hideModalBackdrop(qs("indentAddLineModalBackdrop"), [qs("iBtnAddLine")]);
}

async function saveIndentAddLine() {
  if (!state.selectedIndent) {
    toast("No indent selected.", "error");
    return;
  }
  const backdrop = qs("indentAddLineModalBackdrop");
  const indentId = state.selectedIndent.indent_id;
  const stockItemId = Number(backdrop.dataset.stockItemId || "0");
  const uomId = Number(backdrop.dataset.uomId || "0");
  const qty = Number((qs("ialQty").value || "").trim());
  const reason = (qs("ialReason").value || "").trim() || null;

  // Derive material class: from indent or from selector
  const indentClass = state.selectedIndent.material_class_id ?? null;
  const materialClassId = indentClass
    ? Number(indentClass)
    : qs("ialMaterialClass").value
      ? Number(qs("ialMaterialClass").value)
      : null;

  if (!stockItemId) {
    toast("Select a stock item.", "error");
    return;
  }
  if (!uomId) {
    toast("UOM could not be determined. Re-select the stock item.", "error");
    return;
  }
  if (!qty || qty <= 0) {
    toast("Enter a valid requested qty.", "error");
    return;
  }
  const needsReason =
    state.selectedIndent.status === "approved" ||
    state.selectedIndent.status === "issued";
  if (needsReason && !reason) {
    toast("Reason is required for approved/issued indents.", "error");
    return;
  }

  setLoading(true);
  const { error } = await supabase.rpc("proc_indent_add_line", {
    p_indent_id: indentId,
    p_material_class_id: materialClassId,
    p_stock_item_id: stockItemId,
    p_uom_id: uomId,
    p_requested_qty: qty,
    p_reason: reason,
  });
  setLoading(false);
  if (error) {
    toast(`Save failed: ${error.message}`, "error");
    return;
  }
  toast("Line saved.", "success");
  closeIndentAddLineModal();
  state.selectedIndentLine = null;
  const btnEditQty = qs("iBtnEditLineQty");
  if (btnEditQty) btnEditQty.disabled = true;
  await loadIndentLines(indentId);
}

// ─── PR TAB ───────────────────────────────────────────────────────────────────

function renderPrHeaders() {
  const tbody = qs("prTbody");
  tbody.innerHTML = "";
  for (const row of state.prRows) {
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    if (state.selectedPr?.pr_id === row.pr_id) {
      tr.style.background = "rgba(10,100,200,.06)";
    }
    const horizonStr = row.horizon_start_month
      ? `${row.horizon_start_month.slice(0, 7)}${row.horizon_end_month ? ` – ${row.horizon_end_month.slice(0, 7)}` : ""}`
      : "";
    tr.innerHTML = `
      <td>${esc(row.pr_number ?? "")}</td>
      <td><span class="pill">${esc(row.status ?? "")}</span></td>
      <td>${esc(row.effective_from_date ?? "")}</td>
      <td class="muted">${esc(horizonStr)}</td>
      <td>${esc(row.material_class_id ? String(row.material_class_id) : "All")}</td>
      <td>${fmt(row.line_count ?? "")}</td>
    `;
    tr.addEventListener("click", () => {
      openPrViewModal(row);
      renderPrHeaders();
    });
    tbody.appendChild(tr);
  }
  const _prCnt = state.prRows.length;
  qs("prMeta").textContent = `${_prCnt} PR${_prCnt !== 1 ? "s" : ""}`;
  qs("prPaging").textContent = `Page ${state.prPage + 1}`;
  const _prPrev = qs("prBtnPrev");
  const _prNext = qs("prBtnNext");
  if (_prPrev) _prPrev.disabled = state.prPage <= 0;
  if (_prNext) _prNext.disabled = _prCnt < state.pageSize;
  updateTabCount("tabCountPr", _prCnt);
}

async function loadPrHeaders() {
  setTabTableLoading("pr", true);
  try {
    const status = qs("prFilterStatus").value;
    const cls = qs("prFilterClass").value;
    const search = (qs("prSearch").value || "").trim();
    let q = supabase.from(PR_HEADER_VIEW).select("*");
    if (status) q = q.eq("status", status);
    if (cls) q = q.eq("material_class_id", Number(cls));
    if (search) q = q.ilike("pr_number", `%${search}%`);
    q = q
      .order("pr_id", { ascending: false })
      .range(
        state.prPage * state.pageSize,
        state.prPage * state.pageSize + state.pageSize - 1,
      );
    const { data, error } = await q;
    if (error) {
      toast(`Failed to load PRs: ${error.message}`, "error");
      return;
    }
    state.prRows = data || [];
    renderPrHeaders();
  } finally {
    setTabTableLoading("pr", false);
  }
}

function renderPrLineRowHtml(row, isDraft) {
  const requestedQtyNum = Number(row.requested_qty || 0);
  const deltaQtyNum = Number(row.manual_delta_qty || 0);
  const finalQtyNum = requestedQtyNum + deltaQtyNum;
  const reasonText = row.manual_reason ?? "";
  return `
    <tr data-pr-line-id="${esc(row.pr_line_id)}" ${isDraft ? "" : 'class="locked-row"'}>
      <td>${esc(row.stock_item_name ?? row.stock_item_code ?? row.code ?? String(row.stock_item_id ?? ""))}</td>
      <td>${esc(row.material_class_code ?? row.category_label ?? row.subcategory_label ?? "")}</td>
      <td>${esc(row.uom_code ?? "")}</td>
      <td>${fmt(row.system_suggested_qty)}</td>
      <td>${fmt(requestedQtyNum)}</td>
      <td data-col="delta">${fmt(deltaQtyNum)}</td>
      <td>
        ${
          isDraft
            ? `<input
                class="pr-line-inline-input qty"
                type="number"
                min="0"
                step="any"
                data-field="final_qty"
                data-line-id="${esc(row.pr_line_id)}"
                data-requested="${esc(requestedQtyNum)}"
                data-old="${esc(finalQtyNum)}"
                value="${esc(finalQtyNum)}"
              />`
            : `<span>${fmt(finalQtyNum)}</span>`
        }
      </td>
      <td>
        ${
          isDraft
            ? `<input
                class="pr-line-inline-input reason"
                type="text"
                data-field="reason"
                data-line-id="${esc(row.pr_line_id)}"
                data-old="${esc(reasonText)}"
                value="${esc(reasonText)}"
                placeholder="Reason (optional)"
              />`
            : `<span>${esc(reasonText)}</span>`
        }
      </td>
    </tr>`;
}

function updatePrLinePagingUi(total) {
  const rangeEl = qs("prLineRange");
  const prevBtn = qs("prLinePrev");
  const nextBtn = qs("prLineNext");
  const pageCount = prLinePageSize > 0 ? Math.ceil(total / prLinePageSize) : 0;
  const totalPages = Math.max(1, pageCount);
  if (prLinePage > totalPages - 1) prLinePage = totalPages - 1;
  const start = total ? prLinePage * prLinePageSize + 1 : 0;
  const end = total ? Math.min((prLinePage + 1) * prLinePageSize, total) : 0;
  if (rangeEl) {
    rangeEl.textContent = total ? `${start}–${end} / ${total}` : "0 / 0";
    rangeEl.title = total
      ? `Showing ${start} to ${end} of ${total} lines`
      : "No matching lines";
  }
  if (prevBtn) prevBtn.disabled = prLinePage <= 0;
  if (nextBtn) nextBtn.disabled = total === 0 || prLinePage >= totalPages - 1;
}

function renderPrLinesPage() {
  const empty = qs("prLinesEmpty");
  const table = qs("prLinesTable");
  const tbody = qs("prLinesTbody");
  const isDraft = state.selectedPr?.status === "draft";
  const total = prLineFiltered.length;
  const start = total ? prLinePage * prLinePageSize : 0;
  const end = total ? Math.min(start + prLinePageSize, total) : 0;
  const rows = total ? prLineFiltered.slice(start, end) : [];
  if (!total) {
    empty.style.display = "";
    empty.textContent = prLineAll.length
      ? "No matching lines."
      : "No lines for this PR.";
    table.style.display = "none";
    tbody.innerHTML = "";
    updatePrLinePagingUi(0);
    return;
  }
  empty.style.display = "none";
  table.style.display = "";
  tbody.innerHTML = rows
    .map((row) => renderPrLineRowHtml(row, isDraft))
    .join("");
  updatePrLinePagingUi(total);
}

function setInlineCellSaving(inputEl, saving) {
  if (!(inputEl instanceof HTMLInputElement)) return;
  inputEl.classList.toggle("is-saving", saving);
  if (saving) {
    inputEl.dataset.wasDisabled = inputEl.disabled ? "1" : "0";
    inputEl.disabled = true;
  } else if (inputEl.dataset.wasDisabled !== "1") {
    inputEl.disabled = false;
  }
}

async function commitFinalQty(
  prLineId,
  requestedQty,
  newFinalQty,
  currentReason,
) {
  const row = prLineAll.find((item) => Number(item.pr_line_id) === prLineId);
  if (!row) return;
  const delta = Number(newFinalQty) - Number(requestedQty || 0);
  let reasonText = (currentReason || "").trim();
  const reasonInput = document.querySelector(
    `.pr-line-inline-input.reason[data-line-id="${prLineId}"]`,
  );
  if (delta === 0) {
    reasonText = "";
    if (reasonInput) reasonInput.value = "";
  } else if (!reasonText) {
    reasonText = "Quantity adjustment";
    if (reasonInput) reasonInput.value = reasonText;
  }
  // Use correct DB param names: p_manual_reason instead of p_reason
  const { error } = await supabase.rpc("proc_pr_set_manual_delta", {
    p_pr_line_id: prLineId,
    p_manual_delta_qty: delta,
    p_manual_reason: reasonText,
  });
  if (error) throw error;
  row.manual_delta_qty = delta;
  row.final_requested_qty = Number(newFinalQty);
  row.manual_reason = reasonText;
}

async function commitReason(prLineId, reasonText) {
  const row = prLineAll.find((item) => Number(item.pr_line_id) === prLineId);
  if (!row) return;
  const currentDelta = Number(row.manual_delta_qty || 0);
  // If only the reason changed (final qty unchanged), call proc_pr_set_manual_reason
  if (!currentDelta) {
    const { error } = await supabase.rpc("proc_pr_set_manual_reason", {
      p_pr_line_id: prLineId,
      p_reason: (reasonText || "").trim(),
    });
    if (error) throw error;
    row.manual_reason = (reasonText || "").trim();
    return;
  }
  // If delta is nonzero, update both delta and reason (for completeness)
  const { error } = await supabase.rpc("proc_pr_set_manual_delta", {
    p_pr_line_id: prLineId,
    p_manual_delta_qty: currentDelta,
    p_manual_reason: (reasonText || "").trim(),
  });
  if (error) throw error;
  row.manual_reason = (reasonText || "").trim();
}

function wirePrLineTableActions() {
  const tbody = qs("prLinesTbody");
  if (!tbody || tbody.dataset.bound === "1") return;
  tbody.dataset.bound = "1";

  // --- Filter drawer (matches main pec-filter-* pattern) ---
  const filterBtn = qs("prLineFilterBtn");
  const filterDrawer = qs("prLineFilterDrawer");
  const filterSelect = qs("prLineFilterSelect");
  const filterBadge = qs("prLineFilterBadge");
  console.log(
    "[PR Filter] btn:",
    !!filterBtn,
    "drawer:",
    !!filterDrawer,
    "select:",
    !!filterSelect,
  );

  function syncPrLineFilterBadge() {
    const active = prLineFilterValue !== "all";
    if (filterBadge) filterBadge.style.display = active ? "" : "none";
    if (filterBtn) filterBtn.classList.toggle("pec-filter-btn--active", active);
  }

  if (filterBtn && filterDrawer) {
    filterBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = filterDrawer.classList.contains("open");
      // Close any other open drawers
      document.querySelectorAll(".pec-filter-drawer.open").forEach((d) => {
        if (d !== filterDrawer) {
          d.classList.remove("open");
          d.closest(".pec-filter-wrap")
            ?.querySelector(".pec-filter-btn")
            ?.setAttribute("aria-expanded", "false");
        }
      });
      filterDrawer.classList.toggle("open", !isOpen);
      filterBtn.setAttribute("aria-expanded", String(!isOpen));
      if (!isOpen) {
        // Use position:fixed so the drawer escapes modal-body overflow:auto clipping
        const rect = filterBtn.getBoundingClientRect();
        filterDrawer.style.position = "fixed";
        filterDrawer.style.top = rect.bottom + 4 + "px";
        filterDrawer.style.left = rect.left + "px";
        filterDrawer.style.zIndex = "10001";
        // Prevent clipping off right edge
        requestAnimationFrame(() => {
          const dropW = filterDrawer.offsetWidth || 220;
          if (rect.left + dropW > window.innerWidth) {
            filterDrawer.style.left = Math.max(4, rect.right - dropW) + "px";
          }
        });
        if (filterSelect) filterSelect.focus();
      }
    });
    filterDrawer.addEventListener("click", (e) => e.stopPropagation());
    // Close on outside click (outside the drawer and button)
    document.addEventListener("click", (e) => {
      if (
        filterDrawer.classList.contains("open") &&
        !filterDrawer.contains(e.target) &&
        e.target !== filterBtn &&
        !filterBtn.contains(e.target)
      ) {
        filterDrawer.classList.remove("open");
        filterBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  if (filterSelect) {
    filterSelect.value = prLineFilterValue;
    filterSelect.addEventListener("change", () => {
      prLineFilterValue = filterSelect.value;
      syncPrLineFilterBadge();
      prLinePage = 0;
      applyPrLineFiltersAndRender();
    });
  }
  const commitInlineEdit = async (inputEl) => {
    if (!(inputEl instanceof HTMLInputElement)) return;
    if (inputEl.disabled) return;
    const rowId = Number(inputEl.dataset.lineId || "0");
    const field = inputEl.dataset.field || "";
    const row = prLineAll.find((item) => Number(item.pr_line_id) === rowId);
    if (!row || !field) return;

    const oldValue = inputEl.dataset.old ?? "";
    const newValue = inputEl.value.trim();
    if (normalize(oldValue) === normalize(newValue)) return;

    try {
      setInlineCellSaving(inputEl, true);
      if (field === "final_qty") {
        const newFinalQty = Number(newValue);
        if (!newValue || Number.isNaN(newFinalQty) || newFinalQty < 0) {
          throw new Error("Enter a valid final qty.");
        }
        const requestedQty = Number(
          inputEl.dataset.requested || row.requested_qty || 0,
        );
        const rowEl = inputEl.closest("tr");
        const reasonInput = rowEl?.querySelector('input[data-field="reason"]');
        const reasonText =
          reasonInput instanceof HTMLInputElement
            ? reasonInput.value.trim()
            : "";
        // commitFinalQty handles auto-fill/auto-clear of reason based on delta
        await commitFinalQty(rowId, requestedQty, newFinalQty, reasonText);
        inputEl.value = String(newFinalQty);
        inputEl.dataset.old = String(newFinalQty);
        // Sync reason input's data-old so change-detection stays accurate
        if (reasonInput instanceof HTMLInputElement) {
          reasonInput.dataset.old = reasonInput.value;
        }
      } else if (field === "reason") {
        await commitReason(rowId, newValue);
        inputEl.dataset.old = newValue;
      }
      renderPrLinesPage();
    } catch (err) {
      inputEl.value = oldValue;
      const message = err?.message || "Save failed.";
      toast(message, "error");
    } finally {
      setInlineCellSaving(inputEl, false);
    }
  };

  tbody.addEventListener("focusin", (e) => {
    const inputEl = e.target.closest("input[data-field]");
    if (!inputEl) return;
    inputEl.dataset.old = inputEl.value;
  });

  tbody.addEventListener("focusout", (e) => {
    const inputEl = e.target.closest("input[data-field]");
    if (!inputEl) return;
    commitInlineEdit(inputEl);
  });

  tbody.addEventListener("keydown", (e) => {
    const inputEl = e.target.closest("input[data-field]");
    if (!inputEl) return;
    if (e.key === "Enter") {
      e.preventDefault();
      inputEl.blur();
    } else if (e.key === "Escape") {
      inputEl.value = inputEl.dataset.old ?? "";
      inputEl.blur();
    }
  });
}

function applyPrLineFiltersAndRender() {
  const searchRaw = (qs("prLineSearch")?.value ?? "").toLowerCase().trim();
  const filter = prLineFilterValue || "all";

  prLineFiltered = prLineAll.filter((row) => {
    // Search filter
    if (searchRaw) {
      const haystack = [
        row.stock_item_name ?? "",
        row.stock_item_code ?? row.code ?? "",
        row.material_class_code ??
          row.category_label ??
          row.subcategory_label ??
          "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(searchRaw)) return false;
    }

    // Category/type filter
    if (filter === "edited_only") {
      const delta = Number(row.manual_delta_qty || 0);
      if (!delta && !row.manual_reason) return false;
    } else if (filter === "zero_suggested") {
      if (Number(row.system_suggested_qty ?? 0) !== 0) return false;
    } else if (filter === "jit_only") {
      const mode = String(
        row.rm_procurement_mode ?? row.stock_item_rm_procurement_mode ?? "",
      ).toLowerCase();
      if (mode !== "jit_procured" && mode !== "jit") return false;
    } else if (filter === "normal_only") {
      const mode = String(
        row.rm_procurement_mode ?? row.stock_item_rm_procurement_mode ?? "",
      ).toLowerCase();
      if (mode === "jit_procured" || mode === "jit") return false;
    }

    return true;
  });

  renderPrLinesPage();
}

async function loadPrLines(prId) {
  if (!prId) return;
  setLoading(true);
  const { data, error } = await supabase
    .from("v_proc_pr_lines")
    .select("*")
    .eq("pr_id", prId)
    .order("pr_line_id", { ascending: true });
  setLoading(false);
  if (error) {
    toast(`Failed to load PR lines: ${error.message}`, "error");
    return;
  }
  prLineAll = data || [];
  state.prLinesRows = prLineAll;
  prLinePage = 0;
  applyPrLineFiltersAndRender();
}

function openPrRebuildModal() {
  if (!state.selectedPr || state.selectedPr.status !== "draft") return;
  lastFocusedBeforePrRebuildModal =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  const backdrop = qs("prRebuildModalBackdrop");
  qs("prRebuildMode").value = "safe";
  backdrop.dataset.prId = String(state.selectedPr.pr_id);
  qs("prViewModalBackdrop").inert = true;
  backdrop.inert = false;
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  qs("prRebuildMode")?.focus();
}

function closePrRebuildModal() {
  const backdrop = qs("prRebuildModalBackdrop");
  moveFocusOutsideModal(backdrop, [
    lastFocusedBeforePrRebuildModal,
    qs("btnPrRebuildFromMrp"),
    qs("btnPrViewClose"),
  ]);
  backdrop.inert = true;
  backdrop.classList.remove("show");
  backdrop.setAttribute("aria-hidden", "true");
  qs("prViewModalBackdrop").inert = false;
}

async function confirmPrRebuildFromMrp() {
  const backdrop = qs("prRebuildModalBackdrop");
  const prId = Number(backdrop.dataset.prId);
  const mode = qs("prRebuildMode").value || "safe";
  setLoading(true);
  const { error } = await supabase.rpc("proc_pr_rebuild_from_mrp", {
    p_pr_id: prId,
    p_mode: mode,
  });
  setLoading(false);
  if (error) {
    toast(`Rebuild failed: ${error.message}`, "error");
    return;
  }
  toast("Rebuilt from MRP", "success");
  closePrRebuildModal();
  // requestAnimationFrame(() => {
  //   refreshPrLines();
  // });
  if (state.selectedPr?.pr_id) {
    requestAnimationFrame(() => loadPrLines(state.selectedPr.pr_id));
  }
}

function refreshPrViewModal(row) {
  state.selectedPr = row;
  upgradePrModalButtons(row);
  qs("prLinesTitle").textContent = row.pr_number ?? "";
  qs("prDetailStatus").textContent = row.status ?? "";
  const horizonStr = row.horizon_start_month
    ? `${row.horizon_start_month.slice(0, 7)}${row.horizon_end_month ? ` – ${row.horizon_end_month.slice(0, 7)}` : ""}`
    : "";
  const metaParts = [];
  if (row.effective_from_date)
    metaParts.push(`Eff. from: ${row.effective_from_date}`);
  if (horizonStr) metaParts.push(`Horizon: ${horizonStr}`);
  if (row.material_class_id) metaParts.push(`Class: ${row.material_class_id}`);
  qs("prDetailMeta").textContent = metaParts.join(" \u00b7 ");
  const isDraft = row.status === "draft";
  const isActive = row.status === "active";
  const isTerminal = row.status === "closed" || row.status === "cancelled";
  const btnActivate = qs("btnPrActivate");
  const btnClose = qs("btnPrClosePr");
  const btnAddLine = qs("btnPrAddLine");
  const btnRebuild = qs("btnPrRebuildFromMrp");
  const btnCreateIndent = qs("btnPrCreateIndent");
  const btnDeleteDraft = qs("btnPrDeleteDraft");
  const lockPill = qs("prLineLockPill");
  if (btnActivate) btnActivate.style.display = isDraft ? "" : "none";
  if (btnClose) {
    btnClose.style.display = isTerminal ? "none" : "";
    const closeLabel = isDraft ? "Cancel PR" : "Close PR";
    btnClose.setAttribute("title", closeLabel);
    btnClose.setAttribute("aria-label", closeLabel);
  }
  if (btnAddLine) btnAddLine.style.display = isDraft ? "" : "none";
  if (btnRebuild) btnRebuild.style.display = isDraft ? "" : "none";
  if (btnCreateIndent) btnCreateIndent.style.display = isActive ? "" : "none";
  if (btnDeleteDraft) btnDeleteDraft.style.display = isDraft ? "" : "none";
  if (lockPill) lockPill.style.display = isDraft ? "none" : "";
  // Set lifecycle hint
  const prHints = {
    draft: "Draft — edit lines, then Activate to proceed.",
    active: "Active — create an Indent or Close when done.",
    closed: "Closed — read-only.",
    cancelled: "Cancelled — read-only.",
  };
  const hintEl = qs("prDetailHint");
  if (hintEl) hintEl.textContent = prHints[row.status] ?? "";
}

function openPrViewModal(row, options = {}) {
  const { reloadLines = true } = options;
  lastFocusedBeforePrViewModal =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  refreshPrViewModal(row);
  const prLineSearch = qs("prLineSearch");
  const prLineFilter = qs("prLineFilter");
  const prLinePageSizeEl = qs("prLinePageSize");
  if (prLineSearch) prLineSearch.value = "";
  if (prLineFilter) prLineFilter.value = "all";
  if (prLinePageSizeEl) prLinePageSizeEl.value = "50";
  prLinePage = 0;
  prLinePageSize = 50;
  prLineAll = [];
  prLineFiltered = [];
  qs("prLinesEmpty").style.display = "";
  qs("prLinesTable").style.display = "none";
  qs("prLinesTbody").innerHTML = "";
  prLineFilterValue = "all";
  const _filterSel = qs("prLineFilterSelect");
  if (_filterSel) _filterSel.value = "all";
  const _filterBadge = qs("prLineFilterBadge");
  if (_filterBadge) _filterBadge.style.display = "none";
  qs("prLineFilterBtn")?.classList.remove("pec-filter-btn--active");
  qs("prLineFilterDrawer")?.classList.remove("open");
  const backdrop = qs("prViewModalBackdrop");
  backdrop.inert = false;
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  qs("btnPrViewClose")?.focus();
  if (reloadLines) {
    loadPrLines(row.pr_id);
  } else {
    applyPrLineFiltersAndRender();
  }
}

function exportPrForm(pr) {
  const lines = state.prLinesRows;
  const horizonStr = pr.horizon_start_month
    ? `${pr.horizon_start_month.slice(0, 7)}${pr.horizon_end_month ? ` – ${pr.horizon_end_month.slice(0, 7)}` : ""}`
    : "—";
  const rowsHtml = lines
    .map(
      (row, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(row.stock_item_name ?? String(row.stock_item_id ?? ""))}</td>
      <td>${esc(row.material_class_code ?? "")}</td>
      <td>${esc(row.uom_code ?? "")}</td>
      <td style="text-align:right">${fmt(row.system_suggested_qty)}</td>
      <td style="text-align:right">${fmt(row.requested_qty)}</td>
      <td style="text-align:right">${fmt(row.manual_delta_qty)}</td>
      <td style="text-align:right">${fmt(row.final_requested_qty)}</td>
      <td>${esc(row.manual_reason ?? "")}</td>
    </tr>`,
    )
    .join("");
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>PR ${esc(pr.pr_number)}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;margin:24px;color:#222}
  h1{font-size:18px;margin:0 0 4px}
  .meta{color:#555;margin-bottom:18px;font-size:11px;line-height:1.7}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #ccc;padding:6px 8px}
  th{background:#f2f2f2;text-align:left;font-weight:600}
  tfoot td{background:#f9f9f9;font-weight:600}
  @media print{.no-print{display:none}}
</style>
</head><body>
<h1>Purchase Requisition: ${esc(pr.pr_number)}</h1>
<div class="meta">
  Status: <b>${esc(pr.status ?? "")}</b> &nbsp;|&nbsp;
  Effective from: ${esc(pr.effective_from_date ?? "—")} &nbsp;|&nbsp;
  Horizon: ${esc(horizonStr)} &nbsp;|&nbsp;
  Class: ${esc(pr.material_class_id ? String(pr.material_class_id) : "All")} &nbsp;|&nbsp;
  Generated: ${new Date().toLocaleString()}
  ${pr.notes ? `<br>Notes: ${esc(pr.notes)}` : ""}
</div>
<table>
  <thead><tr>
    <th>#</th><th>Item</th><th>Class</th><th>UOM</th>
    <th>Sys. Sug.</th><th>Requested</th><th>Delta</th><th>Final</th><th>Reason</th>
  </tr></thead>
  <tbody>${rowsHtml || "<tr><td colspan='9' style='color:#999;text-align:center'>No lines</td></tr>"}</tbody>
</table>
<br><br>
<button class="no-print" onclick="window.print()" style="padding:8px 16px;font-size:13px;cursor:pointer">Print / Save PDF</button>
</body></html>`;
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  } else {
    toast("Pop-up blocked — allow pop-ups for this page to export.", "error");
  }
}

function closePrViewModal() {
  const backdrop = qs("prViewModalBackdrop");
  moveFocusOutsideModal(backdrop, [
    lastFocusedBeforePrViewModal,
    qs("prSearch"),
    qs("btnGeneratePr"),
    qs("homeBtn"),
  ]);
  backdrop.inert = true;
  backdrop.classList.remove("show");
  backdrop.setAttribute("aria-hidden", "true");
}

function openGeneratePrModal() {
  lastFocusedBeforeGeneratePrModal =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  qs("prEffectiveFrom").value = new Date().toISOString().slice(0, 10);
  qs("prNewNumber").value = "";
  qs("prHorizonStart").value = "";
  qs("prHorizonEnd").value = "";
  qs("prMaterialClass").value = "";
  qs("prRmScope").value = "normal";
  qs("prRmScopeRow").style.display = "none";
  qs("prNotes").value = "";
  const backdrop = qs("generatePrModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  qs("prNewNumber")?.focus();
}

function updateGeneratePrRmScopeVisibility() {
  const materialClassId = Number(qs("prMaterialClass").value || 0);
  const rmScopeRow = qs("prRmScopeRow");
  if (!rmScopeRow) return;
  rmScopeRow.style.display = materialClassId === 1 ? "" : "none";
}

function closeGeneratePrModal() {
  const backdrop = qs("generatePrModalBackdrop");
  const active = document.activeElement;
  if (active instanceof HTMLElement && backdrop.contains(active)) {
    const fallback = qs("btnGeneratePr");
    if (
      lastFocusedBeforeGeneratePrModal instanceof HTMLElement &&
      document.contains(lastFocusedBeforeGeneratePrModal)
    ) {
      lastFocusedBeforeGeneratePrModal.focus();
    } else if (fallback) {
      fallback.focus();
    } else {
      active.blur();
    }
  }
  hideModalBackdrop(backdrop, [
    lastFocusedBeforeGeneratePrModal,
    qs("btnGeneratePr"),
  ]);
}

async function createIndentFromSelectedPr() {
  if (!state.selectedPr) {
    toast("No PR selected.", "error");
    return;
  }
  if (state.selectedPr.status !== "active") {
    toast("PR must be active to create an indent.", "error");
    return;
  }
  setLoading(true);
  const { data, error } = await supabase.rpc("proc_indent_create_from_pr", {
    p_pr_id: state.selectedPr.pr_id,
    p_indent_number: null,
  });
  setLoading(false);
  if (error) {
    toast(`Create indent failed: ${error.message}`, "error");
    return;
  }
  toast("Indent created from PR.", "success");
  closePrViewModal();
  setTab("indents");
  state.indentsPage = 0;
  await loadIndents();
  const newId = data?.indent_id ?? data;
  if (newId) {
    const found = state.indentsRows.find((r) => r.indent_id === newId);
    if (found) {
      renderIndents();
      openIndentViewModal(found);
    }
  }
}

function monthToFirstDate(monthStr) {
  // Accepts "YYYY-MM" or "YYYY-MM-01"
  if (!monthStr) return null;
  const s = String(monthStr).trim();
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return s; // fallback, will error if invalid
}

async function generateDraftPr() {
  const prNumber = (qs("prNewNumber").value || "").trim();
  if (!prNumber) {
    toast("PR Number is required.", "error");
    return;
  }
  const effectiveFrom = qs("prEffectiveFrom").value;
  if (!effectiveFrom) {
    toast("Effective From date is required.", "error");
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
    toast("Effective From must be a full date (YYYY-MM-DD).", "error");
    return;
  }
  const horizonStartRaw = qs("prHorizonStart").value || null;
  const horizonEndRaw = qs("prHorizonEnd").value || null;

  const horizonStart = monthToFirstDate(horizonStartRaw);
  const horizonEnd = monthToFirstDate(horizonEndRaw);
  const materialClassRaw = qs("prMaterialClass").value;
  const materialClassId = materialClassRaw ? Number(materialClassRaw) : null;
  const notes = (qs("prNotes").value || "").trim() || null;
  const genFilters = {
    source: "v_mrp_procurement_plan",
    run: new Date().toISOString().slice(0, 10).replaceAll("-", ""),
  };
  if (materialClassId === 1) {
    genFilters.rm_scope = qs("prRmScope").value || "all";
  }

  setLoading(true);
  const { error } = await supabase.rpc("create_pr_from_mrp_plan", {
    p_pr_number: prNumber,
    p_effective_from_date: effectiveFrom, // must be YYYY-MM-DD
    p_horizon_start_month: horizonStart, // now YYYY-MM-01
    p_horizon_end_month: horizonEnd, // now YYYY-MM-01
    p_material_class_id: materialClassId,
    p_generation_filters: genFilters,
    p_notes: notes,
  });
  setLoading(false);
  if (error) {
    toast(`Generate PR failed: ${error.message}`, "error");
    return;
  }
  toast("Draft PR generated.", "success");
  closeGeneratePrModal();
  // Reload list
  state.prPage = 0;
  await loadPrHeaders();
}

function openPrAddLineModal() {
  const backdrop = qs("prAddLineModalBackdrop");
  qs("prAddLineClass").value = "";
  backdrop.dataset.stockItemId = "";
  backdrop.dataset.uomId = "";
  const searchInput = qs("prAddLineItemSearch");
  const resultsList = qs("prAddLineItemResults");
  if (searchInput) {
    searchInput.value = "";
    searchInput.setAttribute("aria-expanded", "false");
  }
  if (resultsList) {
    resultsList.innerHTML = "";
    resultsList.classList.remove("show");
  }
  qs("prAddLineUomText").textContent = "—";
  qs("prAddLineQty").value = "";
  qs("prAddLineReason").value = "";
  backdrop.inert = false;
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  setTimeout(() => searchInput?.focus(), 50);
}

function closePrAddLineModal() {
  const backdrop = qs("prAddLineModalBackdrop");
  moveFocusOutsideModal(backdrop, [
    qs("btnPrAddLine"),
    qs("btnPrViewClose"),
    qs("btnGeneratePr"),
  ]);
  backdrop.inert = true;
  backdrop.classList.remove("show");
  backdrop.setAttribute("aria-hidden", "true");
}

async function savePrAddLine() {
  if (!state.selectedPr) {
    toast("No PR selected.", "error");
    return;
  }
  const backdrop = qs("prAddLineModalBackdrop");
  const stockItemId = Number(backdrop.dataset.stockItemId || "0");
  const uomId = Number(backdrop.dataset.uomId || "0");
  const qty = Number((qs("prAddLineQty").value || "").trim());
  const reason = (qs("prAddLineReason").value || "").trim() || null;
  const materialClassRaw = qs("prAddLineClass").value;
  const materialClassId = materialClassRaw ? Number(materialClassRaw) : null;
  if (!stockItemId) {
    toast("Select a stock item.", "error");
    return;
  }
  if (!uomId) {
    toast("UOM could not be determined. Re-select the stock item.", "error");
    return;
  }
  if (!qty || qty <= 0) {
    toast("Enter a valid requested qty.", "error");
    return;
  }
  setLoading(true);
  const { error } = await supabase.rpc("proc_pr_add_line", {
    p_pr_id: state.selectedPr.pr_id,
    p_material_class_id: materialClassId,
    p_stock_item_id: stockItemId,
    p_uom_id: uomId,
    p_requested_qty: qty,
    p_reason: reason,
  });
  setLoading(false);
  if (error) {
    toast(`Add line failed: ${error.message}`, "error");
    return;
  }
  toast("Line added.", "success");
  closePrAddLineModal();
  if (state.selectedPr?.pr_id) loadPrLines(state.selectedPr.pr_id);
}

function openPrSetStatusModal(row, targetStatus) {
  const backdrop = qs("prSetStatusModalBackdrop");
  const titles = {
    active: "Activate PR",
    closed: "Close PR",
    cancelled: "Cancel PR",
  };
  qs("prSetStatusTitle").textContent =
    titles[targetStatus] ?? "Change PR Status";
  qs("prSetStatusItem").textContent = row.pr_number;
  qs("prSetStatusNote").value = "";
  backdrop.inert = false;
  backdrop.dataset.prId = String(row.pr_id);
  backdrop.dataset.targetStatus = targetStatus;
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
}

function closePrSetStatusModal() {
  const backdrop = qs("prSetStatusModalBackdrop");
  moveFocusOutsideModal(backdrop, [
    qs("btnPrClosePr"),
    qs("btnPrViewClose"),
    qs("btnGeneratePr"),
  ]);
  backdrop.inert = true;
  backdrop.classList.remove("show");
  backdrop.setAttribute("aria-hidden", "true");
}

async function confirmPrSetStatus() {
  const backdrop = qs("prSetStatusModalBackdrop");
  const prId = Number(backdrop.dataset.prId);
  const targetStatus = backdrop.dataset.targetStatus;
  const note = (qs("prSetStatusNote").value || "").trim() || null;
  setLoading(true);
  const { error } = await supabase.rpc("proc_pr_set_status", {
    p_pr_id: prId,
    p_status: targetStatus,
    p_note: note,
  });
  setLoading(false);
  if (error) {
    toast(`Status change failed: ${error.message}`, "error");
    return;
  }
  const currentPr =
    state.selectedPr?.pr_id === prId
      ? state.selectedPr
      : state.prRows.find((row) => Number(row.pr_id) === prId) || null;
  if (currentPr) {
    currentPr.status = targetStatus;
  }
  if (state.selectedPr?.pr_id === prId) {
    state.selectedPr.status = targetStatus;
  }
  state.prRows.forEach((row) => {
    if (Number(row.pr_id) === prId) row.status = targetStatus;
  });

  toast(`PR status set to ${targetStatus}.`, "success");
  closePrSetStatusModal();
  await loadPrHeaders();
  if (state.selectedPr?.pr_id === prId) {
    await loadPrLines(prId);
  }

  const updatedRow =
    state.prRows.find((row) => Number(row.pr_id) === prId) ||
    (state.selectedPr?.pr_id === prId ? state.selectedPr : null);
  if (updatedRow && qs("prViewModalBackdrop")?.classList.contains("show")) {
    refreshPrViewModal(updatedRow);
    applyPrLineFiltersAndRender();
  }
}

function wirePrControls() {
  qs("btnGeneratePr").addEventListener("click", openGeneratePrModal);
  // PR detail modal
  qs("btnPrViewClose").addEventListener("click", closePrViewModal);
  qs("btnPrExportForm").addEventListener("click", () => {
    if (!state.selectedPr) return;
    exportPrForm(state.selectedPr);
  });
  wirePrLineTableActions();
  const applyPrLineSearchDebounced = debounce(() => {
    prLinePage = 0;
    applyPrLineFiltersAndRender();
  }, 150);
  qs("prLineSearch")?.addEventListener("input", applyPrLineSearchDebounced);
  qs("prLineFilter")?.addEventListener("change", () => {
    prLinePage = 0;
    applyPrLineFiltersAndRender();
  });
  qs("prLinePageSize")?.addEventListener("change", () => {
    prLinePage = 0;
    applyPrLineFiltersAndRender();
  });
  qs("prLinePrev")?.addEventListener("click", () => {
    if (prLinePage <= 0) return;
    prLinePage -= 1;
    renderPrLinesPage();
  });
  qs("prLineNext")?.addEventListener("click", () => {
    const totalPages = Math.max(
      1,
      Math.ceil(prLineFiltered.length / prLinePageSize),
    );
    if (prLinePage >= totalPages - 1) return;
    prLinePage += 1;
    renderPrLinesPage();
  });
  qs("prViewModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "prViewModalBackdrop") closePrViewModal();
  });
  // Generate PR modal buttons
  qs("btnGenPrCancel").addEventListener("click", closeGeneratePrModal);
  qs("btnGenPrClose").addEventListener("click", closeGeneratePrModal);
  qs("btnGenPrConfirm").addEventListener("click", generateDraftPr);
  qs("prMaterialClass").addEventListener(
    "change",
    updateGeneratePrRmScopeVisibility,
  );
  qs("generatePrModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "generatePrModalBackdrop") closeGeneratePrModal();
  });
  qs("prBtnPrev").addEventListener("click", () => {
    state.prPage = Math.max(0, state.prPage - 1);
    loadPrHeaders();
  });
  qs("prBtnNext").addEventListener("click", () => {
    state.prPage += 1;
    loadPrHeaders();
  });
  ["prFilterStatus", "prFilterClass"].forEach((id) =>
    qs(id).addEventListener("change", () => {
      state.prPage = 0;
      loadPrHeaders();
    }),
  );
  wireLiveSearchInput({
    inputId: "prSearch",
    clearId: "prSearchClear",
    onSearch: () => {
      state.prPage = 0;
      loadPrHeaders();
    },
  });

  // PR lines header actions
  qs("btnPrAddLine").addEventListener("click", () => {
    if (!state.selectedPr) {
      toast("Select a PR first.", "error");
      return;
    }
    if (state.selectedPr.status !== "draft") {
      toast("Locked after activation.", "error");
      return;
    }
    openPrAddLineModal();
  });
  qs("btnPrRebuildFromMrp").addEventListener("click", () => {
    if (!state.selectedPr || state.selectedPr.status !== "draft") return;
    openPrRebuildModal();
  });
  qs("btnPrDeleteDraft")?.addEventListener("click", async () => {
    const pr = state.selectedPr;
    if (!pr) {
      toast("Select a PR first.", "error");
      return;
    }
    const confirmed = await confirmHardDelete({
      title: "Delete Draft PR?",
      message:
        "This will permanently delete the draft PR and all its lines. This cannot be undone.",
      onConfirm: async (reason) => {
        const { error } = await supabase.rpc("proc_pr_delete_draft", {
          p_pr_id: pr.pr_id,
          p_reason: reason,
        });
        if (error) throw new Error(error.message);
      },
    });
    if (!confirmed) return;
    toast("Draft PR deleted.", "success");
    state.selectedPr = null;
    state.prLinesRows = [];
    closePrViewModal();
    await loadPrHeaders();
  });
  qs("btnPrActivate").addEventListener("click", () => {
    if (!state.selectedPr) return;
    openPrSetStatusModal(state.selectedPr, "active");
  });
  qs("btnPrClosePr").addEventListener("click", () => {
    if (!state.selectedPr) return;
    const targetStatus =
      state.selectedPr.status === "draft" ? "cancelled" : "closed";
    openPrSetStatusModal(state.selectedPr, targetStatus);
  });
  qs("btnPrCreateIndent").addEventListener("click", createIndentFromSelectedPr);
  qs("btnPrAddLineCancel").addEventListener("click", closePrAddLineModal);
  qs("btnPrAddLineSave").addEventListener("click", savePrAddLine);
  qs("prAddLineModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "prAddLineModalBackdrop") closePrAddLineModal();
  });
  qs("btnPrRebuildCancel").addEventListener("click", closePrRebuildModal);
  qs("btnPrRebuildClose").addEventListener("click", closePrRebuildModal);
  qs("btnPrRebuildConfirm").addEventListener("click", confirmPrRebuildFromMrp);
  qs("prRebuildModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "prRebuildModalBackdrop") closePrRebuildModal();
  });
  qs("btnPrSetStatusCancel").addEventListener("click", closePrSetStatusModal);
  qs("btnPrSetStatusConfirm").addEventListener("click", confirmPrSetStatus);
  qs("prSetStatusModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "prSetStatusModalBackdrop") closePrSetStatusModal();
  });

  // Indent creation modals
  qs("btnCiCancel").addEventListener("click", closeCreateIndentModal);
  qs("btnCiCreate").addEventListener("click", saveCreateIndent);
  qs("createIndentModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "createIndentModalBackdrop") closeCreateIndentModal();
  });
  qs("btnIfpCancel").addEventListener("click", closeIndentFromPrModal);
  qs("btnIfpCreate").addEventListener("click", saveIndentFromPr);
  qs("indentFromPrModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "indentFromPrModalBackdrop") closeIndentFromPrModal();
  });

  // Indent add/edit line modal
  qs("btnIalCancel").addEventListener("click", closeIndentAddLineModal);
  qs("btnIalSave").addEventListener("click", saveIndentAddLine);
  qs("indentAddLineModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "indentAddLineModalBackdrop") closeIndentAddLineModal();
  });
}

// ─── EXCESS TAB ───────────────────────────────────────────────────────────────

function renderExcess() {
  const tbody = qs("eTbody");
  tbody.innerHTML = "";
  for (const row of state.excessRows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div>${esc(row.voucher_number ?? "")}</div>
        <div class="muted">${esc(row.voucher_date ?? "")}</div>
      </td>
      <td><b>${esc(row.stock_item_name ?? "")}</b></td>
      <td>${esc(row.material_class_code ?? "")}</td>
      <td>${fmt(row.purchase_qty)}</td>
      <td>${fmt(row.allocated_qty)}</td>
      <td>${fmt(row.unallocated_qty)}</td>
      <td>${fmt(row.accepted_qty)}</td>
      <td>${fmt(row.net_unallocated_qty)}</td>
      <td class="row-actions">
        <button data-act="accept">Accept</button>
      </td>
    `;
    tr.querySelector('[data-act="accept"]').addEventListener("click", (e) => {
      e.stopPropagation();
      openAcceptExcessModal(row);
    });
    tbody.appendChild(tr);
  }
  const _eCnt = state.excessRows.length;
  qs("eMeta").textContent = `${_eCnt} item${_eCnt !== 1 ? "s" : ""}`;
  qs("ePaging").textContent = `Page ${state.excessPage + 1}`;
  const _ePrev = qs("eBtnPrev");
  const _eNext = qs("eBtnNext");
  if (_ePrev) _ePrev.disabled = state.excessPage <= 0;
  if (_eNext) _eNext.disabled = _eCnt < state.pageSize;
  updateTabCount("tabCountExcess", _eCnt);
}

async function loadExcess() {
  setTabTableLoading("excess", true);
  try {
    const search = (qs("eSearch").value || "").trim();
    let q = supabase.from("v_proc_purchase_excess_console").select("*");
    if (search) q = q.ilike("stock_item_name", `%${search}%`);
    q = q
      .order("voucher_date", { ascending: false })
      .range(
        state.excessPage * state.pageSize,
        state.excessPage * state.pageSize + state.pageSize - 1,
      );
    const { data, error } = await q;
    if (error) {
      toast(`Failed to load excess purchases: ${error.message}`, "error");
      return;
    }
    state.excessRows = data || [];
    renderExcess();
  } finally {
    setTabTableLoading("excess", false);
  }
}

function renderExcessAudit() {
  const tbody = qs("eAuditTbody");
  tbody.innerHTML = "";
  for (const row of state.excessAuditRows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(row.accepted_at ?? row.created_at ?? "")}</td>
      <td>${esc(row.stock_item_name ?? "")}</td>
      <td>${fmt(row.accepted_qty)}</td>
      <td>${esc(row.reason ?? "")}</td>
      <td>${esc(row.accepted_by ?? row.user_email ?? "")}</td>
    `;
    tbody.appendChild(tr);
  }
}

async function loadExcessAudit() {
  const { data, error } = await supabase
    .from("v_proc_excess_acceptance_audit_console")
    .select("*")
    .order("accepted_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("Audit load error:", error);
    return;
  }
  state.excessAuditRows = data || [];
  renderExcessAudit();
}

function openAcceptExcessModal(row) {
  const backdrop = qs("acceptExcessModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  qs("acceptExcessItem").textContent = `${row.stock_item_name} — Voucher ${
    row.voucher_number ?? row.purchase_fact_id
  }`;
  qs("acceptExcessMax").textContent = fmt(row.net_unallocated_qty);
  qs("acceptExcessQty").value = "";
  qs("acceptExcessQty").max = String(row.net_unallocated_qty ?? "");
  qs("acceptExcessReason").value = "";
  backdrop.dataset.purchaseFactId = String(row.purchase_fact_id);
  backdrop.dataset.maxQty = String(row.net_unallocated_qty ?? 0);
}

function closeAcceptExcessModal() {
  const backdrop = qs("acceptExcessModalBackdrop");
  hideModalBackdrop(backdrop, [qs("eSearch")]);
}

async function saveAcceptExcess() {
  const backdrop = qs("acceptExcessModalBackdrop");
  const purchaseFactId = Number(backdrop.dataset.purchaseFactId);
  const maxQty = Number(backdrop.dataset.maxQty);
  const qtyText = (qs("acceptExcessQty").value || "").trim();
  const qty = Number(qtyText);
  if (!qtyText || Number.isNaN(qty) || qty <= 0) {
    toast("Enter a valid quantity greater than zero.", "error");
    return;
  }
  if (qty > maxQty) {
    toast(`Quantity cannot exceed max unallocated (${fmt(maxQty)}).`, "error");
    return;
  }
  const reason = (qs("acceptExcessReason").value || "").trim();
  if (!reason) {
    toast("Reason is required.", "error");
    return;
  }
  const { error } = await supabase.rpc("proc_indent_accept_excess", {
    p_purchase_fact_id: purchaseFactId,
    p_accept_qty: qty,
    p_reason: reason,
  });
  if (error) {
    toast(`Accept excess failed: ${error.message}`, "error");
    return;
  }
  toast("Excess accepted.", "success");
  closeAcceptExcessModal();
  await loadExcess();
  await loadExcessAudit();
}

function wireExcessControls() {
  qs("eBtnPrev").addEventListener("click", () => {
    state.excessPage = Math.max(0, state.excessPage - 1);
    loadExcess();
  });
  qs("eBtnNext").addEventListener("click", () => {
    state.excessPage += 1;
    loadExcess();
  });
  wireLiveSearchInput({
    inputId: "eSearch",
    clearId: "eSearchClear",
    onSearch: () => {
      state.excessPage = 0;
      loadExcess();
    },
  });
  qs("btnAcceptExcessCancel").addEventListener("click", closeAcceptExcessModal);
  qs("btnAcceptExcessSave").addEventListener("click", saveAcceptExcess);
  qs("acceptExcessModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "acceptExcessModalBackdrop") closeAcceptExcessModal();
  });
}

function showLoadingMask(message = "Loading...") {
  setTabTableLoading("vendor-buylist", true, message);
}

function hideLoadingMask() {
  setTabTableLoading("vendor-buylist", false);
}

function toastError(prefix, error) {
  const msg = error?.message || String(error || "Unknown error");
  toast(`${prefix}: ${msg}`, "error");
}

function fmtFixed(n, digits = 2) {
  if (n === null || n === undefined || n === "") return "";
  const x = Number(n);
  if (Number.isNaN(x)) return String(n);
  return x.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function normalizeVwlBreakdown(raw) {
  const parsed =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw);
          } catch {
            return [];
          }
        })()
      : raw;

  if (!Array.isArray(parsed)) return [];
  return parsed.map((entry) => ({
    indent_number:
      entry?.indent_number ??
      entry?.indent_no ??
      entry?.indent ??
      entry?.indentNumber ??
      "-",
    qty_to_buy:
      entry?.qty_to_buy ??
      entry?.qty ??
      entry?.remaining_qty ??
      entry?.qtyToBuy ??
      0,
  }));
}

function breakdownToCompactText(raw) {
  const parts = normalizeVwlBreakdown(raw).map(
    (b) => `${b.indent_number}:${fmt(b.qty_to_buy)}`,
  );
  return parts.join("; ");
}

function updateVendorBuylistPager() {
  const { page, pageSize, rows, totalCount } = state.vwl;
  const prev = qs("vwlPrev");
  const next = qs("vwlNext");
  const text = qs("vwlPaging");
  const count = qs("vwlMeta");
  const total = Number.isFinite(totalCount) ? totalCount : rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (prev) prev.disabled = page <= 0;
  if (next) next.disabled = rows.length < pageSize;
  if (text) {
    text.textContent = `Page ${page + 1}/${totalPages}`;
  }
  if (count) {
    count.textContent = total
      ? `${total} line${total !== 1 ? "s" : ""}`
      : "0 lines";
  }
}

function closeVwlBreakdownModal() {
  const backdrop = qs("vwlBreakdownModalBackdrop");
  if (!backdrop) return;
  backdrop.setAttribute("inert", "");
  hideModalBackdrop(backdrop, [qs("vwlTbody"), qs("vwlSearch")]);
}

function openVwlBreakdown(row) {
  const backdrop = qs("vwlBreakdownModalBackdrop");
  const title = qs("vwlBdTitle");
  const sub = qs("vwlBdSub");
  const tbody = qs("vwlBdTbody");
  if (!backdrop || !title || !sub || !tbody) return;

  title.textContent = `${row.vendor_name ?? "-"} - ${row.stock_item_name ?? "-"}`;
  sub.textContent = `Total Qty to Buy: ${fmt(row.total_qty_to_buy)} ${row.uom_code ?? ""}`;

  const breakdown = normalizeVwlBreakdown(row.indent_breakdown);
  tbody.innerHTML = "";
  if (!breakdown.length) {
    tbody.innerHTML =
      '<tr><td colspan="2" class="muted">No indent breakdown.</td></tr>';
  } else {
    for (const item of breakdown) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${esc(item.indent_number)}</td>
        <td class="num">${esc(fmt(item.qty_to_buy))}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  backdrop.removeAttribute("inert");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
}

function renderVendorBuylistTable() {
  const tbody = qs("vwlTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!state.vwl.rows.length) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="muted">No rows found.</td></tr>';
    return;
  }

  for (const row of state.vwl.rows) {
    const indentCount = normalizeVwlBreakdown(row.indent_breakdown).length;
    const tr = document.createElement("tr");
    tr.classList.add("clickable-row");
    tr.innerHTML = `
      <td>${esc(row.vendor_name ?? "-")}</td>
      <td>${esc(row.stock_item_name ?? "-")}</td>
      <td>${esc(row.uom_code ?? "-")}</td>
      <td class="num">${esc(fmt(row.total_qty_to_buy))}</td>
      <td class="num">${esc(fmtFixed(row.rate_value ?? 0, 2))}</td>
      <td class="num">${esc(fmtFixed(row.total_amount ?? 0, 2))}</td>
      <td><button type="button" class="linklike" data-act="bd">${indentCount} indent${indentCount !== 1 ? "s" : ""}</button></td>
    `;

    tr.addEventListener("click", () => openVwlBreakdown(row));
    tr.querySelector('[data-act="bd"]')?.addEventListener("click", (e) => {
      e.stopPropagation();
      openVwlBreakdown(row);
    });

    tbody.appendChild(tr);
  }
}

async function ensureVendorBuylistVendorsLoaded() {
  if (state.vwl.vendorsLoaded) return;
  const { data, error } = await supabase
    .from("proc_vendor")
    .select("vendor_id, display_name")
    .order("display_name", { ascending: true });
  if (error) {
    toastError("Failed to load vendor filter", error);
    return;
  }

  const pick = qs("vwlVendorFilter");
  if (!pick) return;
  for (const row of data || []) {
    const opt = document.createElement("option");
    opt.value = String(row.vendor_id);
    opt.textContent = row.display_name;
    pick.appendChild(opt);
  }
  state.vwl.vendorsLoaded = true;
}

async function loadVendorBuylist() {
  showLoadingMask();
  try {
    await ensureVendorBuylistVendorsLoaded();

    const from = state.vwl.page * state.vwl.pageSize;
    const to = from + state.vwl.pageSize - 1;

    let q = supabase
      .from("v_proc_vendorwise_buylist")
      .select(
        "vendor_id,vendor_name,stock_item_id,stock_item_name,uom_code,total_qty_to_buy,rate_value,total_amount,indent_breakdown",
        { count: "exact" },
      )
      .order("vendor_name", { ascending: true })
      .order("stock_item_name", { ascending: true })
      .range(from, to);

    if (state.vwl.vendorId) q = q.eq("vendor_id", Number(state.vwl.vendorId));

    const term = (state.vwl.search || "").trim();
    if (term) {
      q = q.or(`vendor_name.ilike.%${term}%,stock_item_name.ilike.%${term}%`);
    }

    const { data, error, count } = await q;
    if (error) throw error;

    state.vwl.totalCount = count ?? (data || []).length;
    state.vwl.rows = data || [];
    renderVendorBuylistTable();
    updateVendorBuylistPager();
  } catch (e) {
    toastError("Failed to load vendor-wise list", e);
    state.vwl.totalCount = 0;
    const tbody = qs("vwlTbody");
    if (tbody)
      tbody.innerHTML =
        '<tr><td colspan="7" class="muted">Failed to load.</td></tr>';
  } finally {
    hideLoadingMask();
  }
}

async function reloadVendorBuylist() {
  await loadVendorBuylist();
}

function makeDateStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

async function fetchAllVendorBuylistRows() {
  const all = [];
  const pageSize = state.vwl.pageSize || 75;
  let page = 0;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let q = supabase
      .from("v_proc_vendorwise_buylist")
      .select(
        "vendor_id,vendor_name,stock_item_id,stock_item_name,uom_code,total_qty_to_buy,rate_value,total_amount,indent_breakdown",
      )
      .order("vendor_name", { ascending: true })
      .order("stock_item_name", { ascending: true })
      .range(from, to);

    if (state.vwl.vendorId) q = q.eq("vendor_id", Number(state.vwl.vendorId));

    const term = (state.vwl.search || "").trim();
    if (term) {
      q = q.or(`vendor_name.ilike.%${term}%,stock_item_name.ilike.%${term}%`);
    }

    const { data, error } = await q;
    if (error) throw error;

    const rows = data || [];
    all.push(...rows);

    if (rows.length < pageSize) break;
    page += 1;
  }

  return all;
}

async function exportVendorBuylist(format) {
  showLoadingMask("Preparing export…");
  try {
    const rows = await fetchAllVendorBuylistRows();
    if (!rows.length) {
      toast("No rows to export for current filters.", "error");
      return;
    }

    const mapped = rows.map((r) => ({
      Vendor: r.vendor_name ?? "",
      Item: r.stock_item_name ?? "",
      UOM: r.uom_code ?? "",
      Qty_to_Buy: r.total_qty_to_buy ?? "",
      Rate: r.rate_value ?? "",
      Amount: r.total_amount ?? "",
      Indent_Breakdown: breakdownToCompactText(r.indent_breakdown),
    }));

    const headers = [
      "Vendor",
      "Item",
      "UOM",
      "Qty_to_Buy",
      "Rate",
      "Amount",
      "Indent_Breakdown",
    ];

    const stamp = makeDateStamp();
    if (format === "tsv") {
      downloadText(
        `VENDOR_WISE_BUYLIST_${stamp}.tsv`,
        toTsv(mapped, headers),
        "text/tab-separated-values;charset=utf-8;",
      );
      return;
    }

    downloadText(
      `VENDOR_WISE_BUYLIST_${stamp}.csv`,
      toCsv(mapped, headers),
      "text/csv;charset=utf-8;",
    );
  } catch (e) {
    toastError("Failed to export vendor-wise buy list", e);
  } finally {
    hideLoadingMask();
  }
}

function wireVendorBuylistControls() {
  const vwlFilterBtn = qs("vwlFilterBtn");
  const vwlFilterDrawer = qs("vwlFilterDrawer");
  const vwlVendorFilter = qs("vwlVendorFilter");

  if (vwlFilterBtn && vwlFilterDrawer) {
    vwlFilterBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = vwlFilterDrawer.classList.contains("open");
      document.querySelectorAll(".pec-filter-drawer.open").forEach((drawer) => {
        if (drawer !== vwlFilterDrawer) {
          drawer.classList.remove("open");
          drawer
            .closest(".pec-filter-wrap")
            ?.querySelector(".pec-filter-btn")
            ?.setAttribute("aria-expanded", "false");
        }
      });
      vwlFilterDrawer.classList.toggle("open", !isOpen);
      vwlFilterBtn.setAttribute("aria-expanded", String(!isOpen));
      if (!isOpen) {
        const rect = vwlFilterBtn.getBoundingClientRect();
        vwlFilterDrawer.style.position = "fixed";
        vwlFilterDrawer.style.top = rect.bottom + 4 + "px";
        vwlFilterDrawer.style.left = rect.left + "px";
        vwlFilterDrawer.style.zIndex = "10001";
        requestAnimationFrame(() => {
          const dropW = vwlFilterDrawer.offsetWidth || 220;
          if (rect.left + dropW > window.innerWidth) {
            vwlFilterDrawer.style.left = Math.max(4, rect.right - dropW) + "px";
          }
        });
        vwlVendorFilter?.focus();
      }
    });
    vwlFilterDrawer.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", (e) => {
      if (
        vwlFilterDrawer.classList.contains("open") &&
        !vwlFilterDrawer.contains(e.target) &&
        !vwlFilterBtn.contains(e.target)
      ) {
        vwlFilterDrawer.classList.remove("open");
        vwlFilterBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  wireLiveSearchInput({
    inputId: "vwlSearch",
    clearId: "vwlSearchClear",
    debounceMs: 250,
    onSearch: (query) => {
      state.vwl.search = query;
      state.vwl.page = 0;
      loadVendorBuylist();
    },
  });

  qs("vwlVendorFilter")?.addEventListener("change", (e) => {
    state.vwl.vendorId = e.target.value || "";
    state.vwl.page = 0;
    loadVendorBuylist();
  });

  qs("vwlPrev")?.addEventListener("click", () => {
    if (state.vwl.page <= 0) return;
    state.vwl.page -= 1;
    loadVendorBuylist();
  });

  qs("vwlNext")?.addEventListener("click", () => {
    if ((state.vwl.rows || []).length < state.vwl.pageSize) return;
    state.vwl.page += 1;
    loadVendorBuylist();
  });

  qs("vwlExportBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleExportMenu("vwlExportMenu", qs("vwlExportBtn"));
  });
  qs("vwlExportCsv")?.addEventListener("click", () => {
    exportVendorBuylist("csv");
    closeAllExportMenus();
  });
  qs("vwlExportTsv")?.addEventListener("click", () => {
    exportVendorBuylist("tsv");
    closeAllExportMenus();
  });

  qs("btnVwlBdClose")?.addEventListener("click", closeVwlBreakdownModal);
  qs("vwlBreakdownModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "vwlBreakdownModalBackdrop") closeVwlBreakdownModal();
  });
}

(async function main() {
  await requireSession();
  document
    .getElementById("homeBtn")
    ?.addEventListener("click", () => Platform.goHome());

  // Safety pass: ensure key icon buttons expose tooltip + label
  ensureIconBtnA11y("btnRefresh", "Refresh");
  ensureIconBtnA11y("btnPrev", "Previous page");
  ensureIconBtnA11y("btnNext", "Next page");
  ensureIconBtnA11y("iBtnRefresh", "Refresh");
  ensureIconBtnA11y("iBtnNewDraft", "New draft indent");
  ensureIconBtnA11y("iBtnFromPR", "Create indent from PR");
  ensureIconBtnA11y("btnExportPdf", "Export PDF");
  ensureIconBtnA11y("btnExportTsv", "Export TSV");
  ensureIconBtnA11y("btnExportCsv", "Export CSV");
  ensureIconBtnA11y("globalRefreshBtn", "Refresh All Tabs");
  ensureIconBtnA11y("prBtnPrev", "Previous page");
  ensureIconBtnA11y("prBtnNext", "Next page");
  ensureIconBtnA11y("iBtnPrev", "Previous page");
  ensureIconBtnA11y("iBtnNext", "Next page");
  ensureIconBtnA11y("eBtnPrev", "Previous page");
  ensureIconBtnA11y("eBtnNext", "Next page");
  ensureIconBtnA11y("vwlPrev", "Previous page");
  ensureIconBtnA11y("vwlNext", "Next page");
  ensureIconBtnA11y("vwlExportBtn", "Export");
  ensureIconBtnA11y("vBtnPrev", "Previous page");
  ensureIconBtnA11y("vBtnNext", "Next page");
  ensureIconBtnA11y("btnAqExportMenu", "Export options");
  ensureIconBtnA11y("btnIExportMenu", "Export options");

  wireGlobalHeaderControls();
  wireTabs();
  wireStockItemPicker();
  wireAddPrLineItemSearch();
  wireAddIndentLineItemSearch();
  wireActionQueueControls();
  wireVendorBuylistControls();
  wireIndentControls();
  wireExcessControls();
  wirePrControls();
  wireHardDeleteControls();
  setTab(state.tab);
  updateExportButtonStates();
  refreshAllTabCounts();
})();
