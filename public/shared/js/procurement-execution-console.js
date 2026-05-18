// public/shared/js/procurement-execution-console.js
import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

// ─── View / RPC name constants (adjust here if DB names differ) ───────────────
const RPC_VENDOR_UNMAPPED_QUEUE = "proc_vendor_unmapped_alias_queue";
const RPC_VENDOR_CREATE_AND_MAP = "proc_vendor_create_and_map_alias";
const RPC_VENDOR_MAP_ALIAS = "proc_vendor_map_alias";
const PR_HEADER_VIEW = "v_proc_pr_header";

const VENDOR_PAGE_SIZE = 50;

let prLineAll = [];
let prLineFiltered = [];
let prLinePage = 0;
let prLinePageSize = 50;
let prLineFilterValue = "all";

const state = {
  tab: "action",
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
  indentLinesRows: [],
  selectedIndentLine: null,
  // excess tab
  excessPage: 0,
  excessRows: [],
  excessAuditRows: [],
  // vendor tab
  vendorPage: 0,
  vendorsRows: [],
  vendorUnmappedAll: [],
  vendorList: [],
};

const EXPORT_HEADERS = [
  "Doc Type",
  "Indent Number",
  "Indent Date",
  "Material Class",
  "Category",
  "Item Code",
  "Material Description",
  "UOM",
  "Qty Requested",
  "Qty Allocated",
  "Qty Remaining / To Purchase",
  "Unit Price",
  "Preferred Supplier",
  "Vendor Decision Status",
  "Remarks",
];

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

let lastFocusedBeforeGeneratePrModal = null;
let lastFocusedBeforePrViewModal = null;
let lastFocusedBeforePrRebuildModal = null;

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
  if (tab === "pr") loadPrHeaders();
  if (tab === "indents") loadIndents();
  if (tab === "excess") {
    loadExcess();
    loadExcessAudit();
  }
  if (tab === "vendors") loadUnmappedAliases();
}

function fmt(n) {
  if (n === null || n === undefined) return "";
  const x = Number(n);
  if (Number.isNaN(x)) return String(n);
  return x.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function formatQty(n) {
  if (n === null || n === undefined || n === "") return "";
  const x = Number(n);
  if (Number.isNaN(x)) return String(n);
  return x
    .toFixed(3)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
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

function materialClassLabel(row) {
  return row.material_class_label || row.material_class_code || "";
}

function getVendorDecisionStatus(rowLike) {
  const hasSelected =
    !!rowLike.selected_vendor_id ||
    !!rowLike.selected_vendor_name ||
    rowLike.selected_rate != null;
  if (hasSelected) return "Selected";
  const hasRecommended =
    !!rowLike.recommended_vendor_id ||
    !!rowLike.recommended_vendor_name ||
    rowLike.recommended_rate != null ||
    !!rowLike.l1_vendor_name ||
    rowLike.l1_rate_value != null;
  return hasRecommended ? "Recommended" : "None";
}

function mergeRemarks(...parts) {
  return parts
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .join(" | ");
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim();
}

async function fetchStockMetaByItemIds(stockItemIds) {
  const ids = [...new Set((stockItemIds || []).filter(Boolean))];
  const out = {};
  if (!ids.length) return out;
  const { data, error } = await supabase
    .from("v_inv_stock_item_with_class")
    .select("stock_item_id,code,subcategory_label,category_label")
    .in("stock_item_id", ids);
  if (error) {
    console.warn("Stock metadata fetch failed:", error);
    return out;
  }
  (data || []).forEach((r) => {
    out[r.stock_item_id] = {
      code: r.code || "",
      category: r.subcategory_label || r.category_label || "",
    };
  });
  return out;
}

async function buildActionQueueExportRows() {
  const rows = state.rows || [];
  if (!rows.length) return [];
  const stockMeta = await fetchStockMetaByItemIds(
    rows.map((r) => r.stock_item_id),
  );

  return rows.map((r) => {
    const meta = stockMeta[r.stock_item_id] || {};
    const unitPrice = r.selected_rate ?? r.recommended_rate ?? r.l1_rate_value;
    const preferredSupplier =
      r.selected_vendor_name ||
      r.recommended_vendor_name ||
      r.l1_vendor_name ||
      "";
    const remaining = r.remaining_qty;
    const qtyRequested = r.requested_qty ?? remaining ?? "";
    return {
      "Doc Type": "ActionQueue",
      "Indent Number": r.indent_number || "",
      "Indent Date": r.approved_date || r.indent_date || "",
      "Material Class": materialClassLabel(r),
      Category: r.subcategory_label || r.category_label || meta.category || "",
      "Item Code": r.item_code || r.stock_item_code || meta.code || "",
      "Material Description": r.stock_item_name || "",
      UOM: r.uom_code || "",
      "Qty Requested": formatQty(qtyRequested),
      "Qty Allocated": formatQty(r.allocated_qty),
      "Qty Remaining / To Purchase": formatQty(remaining),
      "Unit Price": formatMoney(unitPrice),
      "Preferred Supplier": preferredSupplier,
      "Vendor Decision Status": getVendorDecisionStatus(r),
      Remarks: mergeRemarks(r.manual_reason, r.selection_reason),
    };
  });
}

function exportRowsAsFile(rows, format, baseName) {
  if (!rows.length) {
    toast("No rows available to export.", "error");
    return;
  }
  const stamp = makeExportTimestamp();
  const ext = format.toLowerCase();
  const fileName = `${baseName}_${stamp}.${ext}`;
  if (ext === "csv") {
    const csv = toCsv(rows, EXPORT_HEADERS);
    downloadText(fileName, csv, "text/csv;charset=utf-8;");
    toast(`CSV exported (${rows.length} rows).`, "success");
    return;
  }
  const tsv = toTsv(rows, EXPORT_HEADERS);
  downloadText(fileName, tsv, "text/tab-separated-values;charset=utf-8;");
  toast(`TSV exported (${rows.length} rows).`, "success");
}

function updateExportButtonStates() {
  // AQ export button lives in the detail modal — enable when rows are loaded
  const aqBtn = qs("btnAqExportMenu");
  if (aqBtn) aqBtn.disabled = (state.rows || []).length === 0;

  // Indent export button lives in the indent view modal — keep enabled once an indent is selected.
  // Individual export actions already validate whether lines are available.
  const iBtn = qs("btnIExportMenu");
  if (iBtn) iBtn.disabled = !state.selectedIndent;
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

  // evidence list
  qs("detailEvidenceList").innerHTML = parseEvidence(row.l1_evidence);

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
  backdrop.classList.remove("show");
  backdrop.setAttribute("aria-hidden", "true");
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
  const [indents, pr, excess, vendors] = await Promise.allSettled([
    supabase
      .from("v_proc_indent_console")
      .select("*", { count: "exact" })
      .limit(1),
    supabase.from(PR_HEADER_VIEW).select("*", { count: "exact" }).limit(1),
    supabase
      .from("v_proc_purchase_excess_console")
      .select("*", { count: "exact" })
      .limit(1),
    supabase.rpc(RPC_VENDOR_UNMAPPED_QUEUE),
  ]);
  if (indents.status === "fulfilled")
    updateTabCount("tabCountIndents", indents.value.count ?? 0);
  if (pr.status === "fulfilled")
    updateTabCount("tabCountPr", pr.value.count ?? 0);
  if (excess.status === "fulfilled")
    updateTabCount("tabCountExcess", excess.value.count ?? 0);
  if (vendors.status === "fulfilled") {
    updateTabCount("tabCountVendors", (vendors.value.data || []).length);
  }
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
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div>${row.indent_number}</div>
        <div class="muted">${row.approved_date ?? ""}</div>
      </td>
      <td>
        <div><b>${row.stock_item_name}</b></div>
        <div class="muted">${row.material_class_code ?? ""} • ${row.uom_code ?? ""}</div>
      </td>
      <td>${fmt(row.remaining_qty)}</td>
      <td>
        <span class="pill">${row.priority_band_final ?? "-"}</span>
        <div class="muted">${fmt(row.priority_score_system)}</div>
      </td>
      <td>
        <div>${row.l1_vendor_name ?? "-"}</div>
        <div class="muted">${row.l1_rate_value ? fmt(row.l1_rate_value) : ""}</div>
      </td>
      <td class="row-actions">
        <button data-act="select">${iconSvg("check")}Select</button>
        <button data-act="recommend">${iconSvg("wand")}Recommend</button>
        <button data-act="jump">${iconSvg("arrowRight")}Indent</button>
      </td>
    `;

    tr.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (btn) return; // handled below
      renderDetail(row);
    });

    tr.querySelector('[data-act="recommend"]').addEventListener(
      "click",
      async (e) => {
        e.stopPropagation();
        await doRecommend(row.indent_line_id);
      },
    );

    tr.querySelector('[data-act="select"]').addEventListener("click", (e) => {
      e.stopPropagation();
      openVendorModal(row);
    });

    tr.querySelector('[data-act="jump"]').addEventListener("click", (e) => {
      e.stopPropagation();
      jumpToIndent(row.indent_id ?? row.indent_line_id);
    });

    tbody.appendChild(tr);
  }

  qs("aqMeta").textContent = `Showing ${state.rows.length} lines`;
  qs("aqPaging").textContent = `Page ${state.page + 1}`;
  updateTabCount("tabCountAction", state.rows.length);
  updateExportButtonStates();
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
    .range(
      state.page * state.pageSize,
      state.page * state.pageSize + state.pageSize - 1,
    );

  return q;
}

async function loadActionQueue() {
  const { data, error } = await buildActionQueueQuery();
  if (error) {
    console.error(error);
    toast(`Failed to load Action Queue: ${error.message}`, "error");
    return;
  }
  state.rows = data || [];
  renderRows();
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
  backdrop.classList.remove("show");
  backdrop.setAttribute("aria-hidden", "true");
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
}

function wireTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
  });
}

function wireActionQueueControls() {
  qs("btnPrev").addEventListener("click", () => {
    state.page = Math.max(0, state.page - 1);
    loadActionQueue();
  });
  qs("btnNext").addEventListener("click", () => {
    state.page += 1;
    loadActionQueue();
  });

  ["fBand", "fClass", "fNeeds"].forEach((id) =>
    qs(id).addEventListener("change", () => {
      state.page = 0;
      loadActionQueue();
    }),
  );
  qs("fSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      state.page = 0;
      loadActionQueue();
    }
  });

  // Action Queue export dropdown (lives in detail modal header)
  qs("btnAqExportMenu").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleExportMenu("aqExportMenu", qs("btnAqExportMenu"));
  });
  qs("btnAqExportDropdownCsv").addEventListener("click", async () => {
    closeAllExportMenus();
    const rows = await buildActionQueueExportRows();
    exportRowsAsFile(rows, "csv", "procurement_action_queue");
  });
  qs("btnAqExportDropdownTsv").addEventListener("click", async () => {
    closeAllExportMenus();
    const rows = await buildActionQueueExportRows();
    exportRowsAsFile(rows, "tsv", "procurement_action_queue");
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
      { id: "indentViewModalBackdrop", close: closeIndentViewModal },
      { id: "prViewModalBackdrop", close: closePrViewModal },
      { id: "prRebuildModalBackdrop", close: closePrRebuildModal },
      { id: "generatePrModalBackdrop", close: closeGeneratePrModal },
      { id: "prAddLineModalBackdrop", close: closePrAddLineModal },
      { id: "prSetStatusModalBackdrop", close: closePrSetStatusModal },
      { id: "createIndentModalBackdrop", close: closeCreateIndentModal },
      { id: "indentFromPrModalBackdrop", close: closeIndentFromPrModal },
      { id: "indentAddLineModalBackdrop", close: closeIndentAddLineModal },
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

function openIndentViewModal(row) {
  state.selectedIndent = row;
  state.selectedIndentLine = null;
  state.indentLinesRows = [];
  updateExportButtonStates();
  qs("iLinesTitle").textContent = `Lines — ${row.indent_number}`;
  qs("indentViewStatus").textContent = row.status ?? "";
  const metaParts = [];
  if (row.approved_date) metaParts.push(`Approved: ${row.approved_date}`);
  if (row.material_class_code)
    metaParts.push(`Class: ${row.material_class_code}`);
  else if (row.material_class_id)
    metaParts.push(`Class ID: ${row.material_class_id}`);
  qs("indentViewMeta").textContent = metaParts.join(" · ");
  const btnEditQty = qs("iBtnEditLineQty");
  if (btnEditQty) btnEditQty.disabled = true;
  // Update hint based on status
  const hints = {
    draft: "Draft — you can add/edit lines and approve.",
    approved: "Approved — issue to start fulfilment.",
    issued: "Issued — lines are being fulfilled.",
    closed: "Closed — read-only.",
    cancelled: "Cancelled — read-only.",
  };
  qs("indentViewHint").textContent = hints[row.status] ?? "";
  renderIndentLinesActions(row);
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
  qs("indentViewModalBackdrop").classList.remove("show");
  qs("indentViewModalBackdrop").setAttribute("aria-hidden", "true");
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
  if (btnAddLine) btnAddLine.style.display = "";
  if (btnEditQty) {
    btnEditQty.style.display = "";
    btnEditQty.disabled = !state.selectedIndentLine;
  }

  // Status action buttons (approve / issue / close) — rendered dynamically
  const btnStyle =
    "padding:6px 12px;border:1px solid rgba(0,0,0,.12);border-radius:10px;background:transparent;cursor:pointer;";
  // Remove previously injected status buttons
  container.querySelectorAll("button.status-action").forEach((b) => b.remove());
  const make = (label, act) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.cssText = btnStyle;
    b.classList.add("status-action");
    b.addEventListener("click", () => openIndentActionModal(indent, act));
    container.appendChild(b);
  };
  const s = indent.status;
  if (s === "draft") make("Approve", "approve");
  if (s === "approved") make("Issue", "issue");
  if (s === "approved" || s === "issued") {
    make("Close Strict", "close_strict");
    make("Close w/ Override", "close_override");
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
  const isDraft =
    !state.selectedIndent || state.selectedIndent.status === "draft";
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
    tr.innerHTML = `
      <td class="muted" style="text-align:center">${lineNo}</td>
      <td>${esc(row.stock_item_name)}</td>
      <td>${esc(row.material_class_code ?? "")}</td>
      <td>${esc(row.uom_code ?? "")}</td>
      <td>${fmt(row.requested_qty)}</td>
      <td>${fmt(row.allocated_qty)}</td>
      <td><span class="pill">${Number(row.remaining_qty) <= 0 ? "fulfilled" : fmt(row.remaining_qty)}</span></td>
      <td>${recVendor}</td>
      <td class="muted">${recRate}</td>
      <td>${selVendor}</td>
      <td class="muted">${selRate}</td>
      <td class="row-actions">
        <button data-act="recommend" title="Run vendor recommendation">Recommend</button>
        <button data-act="select" title="Select vendor for this line">Select</button>
      </td>
    `;
    tr.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      state.selectedIndentLine = row;
      const btnEditQty = qs("iBtnEditLineQty");
      if (btnEditQty) btnEditQty.disabled = false;
      tbody.querySelectorAll("tr").forEach((r) => (r.style.background = ""));
      tr.style.background = "rgba(10,100,200,.06)";
    });
    tr.querySelector('[data-act="recommend"]').addEventListener(
      "click",
      async (e) => {
        e.stopPropagation();
        const { error } = await supabase.rpc("proc_indent_recommend_vendor", {
          p_indent_line_id: row.indent_line_id,
        });
        if (error) {
          toast(`Recommend failed: ${error.message}`, "error");
          return;
        }
        toast("Vendor recommended.", "success");
        await loadIndentLines(state.selectedIndent.indent_id);
      },
    );
    tr.querySelector('[data-act="select"]').addEventListener("click", (e) => {
      e.stopPropagation();
      // Build a synthetic row compatible with openVendorModal
      const synthetic = {
        indent_line_id: row.indent_line_id,
        stock_item_name: row.stock_item_name,
        indent_number: state.selectedIndent?.indent_number ?? "",
        l1_vendor_id: row.l1_vendor_id ?? null,
        l1_vendor_name:
          row.l1_vendor_name ?? row.recommended_vendor_name ?? null,
        l1_rate_value: row.l1_rate_value ?? row.recommended_rate ?? null,
        l2_vendor_id: row.l2_vendor_id ?? null,
        l2_vendor_name: row.l2_vendor_name ?? null,
        l2_rate_value: row.l2_rate_value ?? null,
        l3_vendor_id: row.l3_vendor_id ?? null,
        l3_vendor_name: row.l3_vendor_name ?? null,
        l3_rate_value: row.l3_rate_value ?? null,
        recommended_vendor_id: row.recommended_vendor_id ?? null,
      };
      openVendorModal(synthetic);
    });
    tbody.appendChild(tr);
  });
  void isDraft;
}

async function loadIndentLines(indentId) {
  setLoading(true);
  const { data, error } = await supabase
    .from("v_proc_indent_lines_console")
    .select("*")
    .eq("indent_id", indentId)
    .order("indent_line_id", { ascending: true });
  setLoading(false);
  if (error) {
    toast(`Failed to load indent lines: ${error.message}`, "error");
    return;
  }
  state.indentLinesRows = data || [];
  renderIndentLines(state.indentLinesRows);
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
      <td><b>${esc(row.indent_number)}</b></td>
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
  qs("iMeta").textContent = `Showing ${state.indentsRows.length}`;
  qs("iPaging").textContent = `Page ${state.indentsPage + 1}`;
  updateTabCount("tabCountIndents", state.indentsRows.length);
  updateExportButtonStates();
}

async function loadIndents() {
  setLoading(true);
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
  setLoading(false);
  if (error) {
    toast(`Failed to load indents: ${error.message}`, "error");
    return;
  }
  state.indentsRows = data || [];
  renderIndents();
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
  qs("indentActionTitle").textContent = titles[action] ?? "Confirm Action";
  qs("indentActionItem").textContent = indent.indent_number;
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
  backdrop.classList.remove("show");
  backdrop.setAttribute("aria-hidden", "true");
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
      qs("indentViewStatus").textContent = updated.status ?? "";
      const hints = {
        draft: "Draft — you can add/edit lines and approve.",
        approved: "Approved — issue to start fulfilment.",
        issued: "Issued — lines are being fulfilled.",
        closed: "Closed — read-only.",
        cancelled: "Cancelled — read-only.",
      };
      qs("indentViewHint").textContent = hints[updated.status] ?? "";
      renderIndentLinesActions(updated);
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
  qs("iSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      state.indentsPage = 0;
      loadIndents();
    }
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
      openIndentAddLineModal(state.selectedIndentLine);
    });
  }
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
    openExportIndentModal();
  });
  qs("btnIExportDropdownCsv").addEventListener("click", async () => {
    closeAllExportMenus();
    if (!state.selectedIndent || !state.indentLinesRows.length) {
      toast("No indent lines loaded.", "error");
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
    if (!state.selectedIndent || !state.indentLinesRows.length) {
      toast("No indent lines loaded.", "error");
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
  bd.classList.remove("show");
  bd.setAttribute("aria-hidden", "true");
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
    await loadUnmappedAliases();

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
  qs("exportIndentModalBackdrop").classList.remove("show");
  qs("exportIndentModalBackdrop").setAttribute("aria-hidden", "true");
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
  qs("createIndentModalBackdrop").classList.remove("show");
  qs("createIndentModalBackdrop").setAttribute("aria-hidden", "true");
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
  qs("indentFromPrModalBackdrop").classList.remove("show");
  qs("indentFromPrModalBackdrop").setAttribute("aria-hidden", "true");
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

function closeStockItemPicker() {
  qs("stockPickerModalBackdrop").classList.remove("show");
  qs("stockPickerModalBackdrop").setAttribute("aria-hidden", "true");
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
  qs("ialItemText").textContent = "None selected";
  qs("ialItemText").classList.add("muted");
  qs("ialUomText").textContent = "—";
  qs("ialItemChange").textContent = "Select";
  qs("ialQty").value = "";
  qs("ialReason").value = "";

  if (existingLine) {
    // In edit mode: lock item, only allow qty change
    backdrop.dataset.stockItemId = String(existingLine.stock_item_id ?? "");
    backdrop.dataset.uomId = String(existingLine.uom_id ?? "");
    backdrop.dataset.existingLineId = String(existingLine.indent_line_id ?? "");
    qs("ialItemText").textContent = existingLine.stock_item_name
      ? `${existingLine.stock_item_name}`
      : `Item #${existingLine.stock_item_id}`;
    qs("ialItemText").classList.remove("muted");
    qs("ialItemChange").style.display = "none"; // locked in edit
    qs("ialUomText").textContent = existingLine.uom_code ?? "—";
    qs("ialQty").value = existingLine.requested_qty ?? "";
  } else {
    qs("ialItemChange").style.display = "";
  }

  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");

  // Wire Change button (re-wire each open to capture current class)
  qs("ialItemChange").onclick = () => {
    const classId =
      indent?.material_class_id ??
      (Number(qs("ialMaterialClass").value || 0) || null);
    openStockItemPicker({
      materialClassId: classId,
      onSelect: async (picked) => {
        backdrop.dataset.stockItemId = String(picked.stock_item_id);
        backdrop.dataset.uomId = String(picked.default_uom_id ?? "");
        qs("ialItemText").textContent = `${picked.code} — ${picked.name}`;
        qs("ialItemText").classList.remove("muted");
        qs("ialItemChange").textContent = "Change";
        qs("ialUomText").textContent = await fetchUomCode(
          picked.default_uom_id,
        );
        // Lock class selector once an item is chosen
        qs("ialMaterialClass").disabled = true;
      },
    });
  };

  // Unlock class selector whenever modal opens fresh (before item picked)
  qs("ialMaterialClass").disabled = false;
}

function closeIndentAddLineModal() {
  qs("indentAddLineModalBackdrop").classList.remove("show");
  qs("indentAddLineModalBackdrop").setAttribute("aria-hidden", "true");
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
      <td><b>${esc(row.pr_number ?? "")}</b></td>
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
  qs("prMeta").textContent = `Showing ${state.prRows.length}`;
  qs("prPaging").textContent = `Page ${state.prPage + 1}`;
  updateTabCount("tabCountPr", state.prRows.length);
}

async function loadPrHeaders() {
  setLoading(true);
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
  setLoading(false);
  if (error) {
    toast(`Failed to load PRs: ${error.message}`, "error");
    return;
  }
  state.prRows = data || [];
  renderPrHeaders();
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
  const isDraft = !state.selectedPr || state.selectedPr.status === "draft";
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

function openPrViewModal(row) {
  lastFocusedBeforePrViewModal =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
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
  loadPrLines(row.pr_id);
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
  backdrop.classList.remove("show");
  backdrop.setAttribute("aria-hidden", "true");
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
  toast(`PR status set to ${targetStatus}.`, "success");
  closePrSetStatusModal();
  state.prPage = 0;
  await loadPrHeaders();
  if (state.selectedPr?.pr_id === prId) {
    await loadPrLines(prId);
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
  qs("prSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      state.prPage = 0;
      loadPrHeaders();
    }
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
  qs("eMeta").textContent = `Showing ${state.excessRows.length}`;
  qs("ePaging").textContent = `Page ${state.excessPage + 1}`;
  updateTabCount("tabCountExcess", state.excessRows.length);
}

async function loadExcess() {
  setLoading(true);
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
  setLoading(false);
  if (error) {
    toast(`Failed to load excess purchases: ${error.message}`, "error");
    return;
  }
  state.excessRows = data || [];
  renderExcess();
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
  backdrop.classList.remove("show");
  backdrop.setAttribute("aria-hidden", "true");
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
  qs("eSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      state.excessPage = 0;
      loadExcess();
    }
  });
  qs("btnAcceptExcessCancel").addEventListener("click", closeAcceptExcessModal);
  qs("btnAcceptExcessSave").addEventListener("click", saveAcceptExcess);
  qs("acceptExcessModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "acceptExcessModalBackdrop") closeAcceptExcessModal();
  });
}

// ─── VENDOR TAB ───────────────────────────────────────────────────────────────

async function loadVendorList() {
  if (state.vendorList.length) return; // cached
  const { data, error } = await supabase
    .from("proc_vendor")
    .select("vendor_id, display_name")
    .order("display_name", { ascending: true });
  if (!error) state.vendorList = data || [];
}

function filterVendorPick(filterText) {
  const pick = qs("mapVendorPick");
  pick.innerHTML = "";
  const lower = filterText.toLowerCase();
  const filtered = state.vendorList.filter(
    (v) => !lower || v.display_name.toLowerCase().includes(lower),
  );
  for (const v of filtered) {
    const opt = document.createElement("option");
    opt.value = String(v.vendor_id);
    opt.textContent = v.display_name;
    pick.appendChild(opt);
  }
}

function renderUnmappedAliases() {
  const tbody = qs("vTbody");
  tbody.innerHTML = "";
  for (const row of state.vendorsRows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${esc(row.alias_text ?? "")}</b></td>
      <td>${esc(row.source_system ?? "")}</td>
      <td><span class="pill">${esc(row.status ?? "")}</span></td>
      <td class="row-actions">
        <button data-act="create">Create + Map</button>
        <button data-act="mapexisting">Map Existing</button>
      </td>
    `;
    tr.querySelector('[data-act="create"]').addEventListener("click", (e) => {
      e.stopPropagation();
      openCreateVendorModal(row);
    });
    tr.querySelector('[data-act="mapexisting"]').addEventListener(
      "click",
      async (e) => {
        e.stopPropagation();
        await openMapVendorModal(row);
      },
    );
    tbody.appendChild(tr);
  }
  qs("vMeta").textContent = `Showing ${state.vendorsRows.length}`;
  qs("vPaging").textContent = `Page ${state.vendorPage + 1}`;
  updateTabCount("tabCountVendors", state.vendorsRows.length);
}

async function loadUnmappedAliases() {
  setLoading(true);
  const search = (qs("vSearch").value || "").trim();
  const { data, error } = await supabase.rpc(RPC_VENDOR_UNMAPPED_QUEUE);
  setLoading(false);
  if (error) {
    toast(`Failed to load unmapped aliases: ${error.message}`, "error");
    return;
  }
  const allRows = (data || [])
    .slice()
    .sort((a, b) =>
      String(a.alias_text ?? "").localeCompare(String(b.alias_text ?? "")),
    );
  state.vendorUnmappedAll = allRows;
  const filteredRows = search
    ? allRows.filter((row) =>
        String(row.alias_text ?? "")
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
    : allRows;
  const start = state.vendorPage * VENDOR_PAGE_SIZE;
  const end = (state.vendorPage + 1) * VENDOR_PAGE_SIZE;
  state.vendorsRows = filteredRows.slice(start, end);
  renderUnmappedAliases();
}

function openCreateVendorModal(row) {
  const backdrop = qs("createVendorModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  qs("createVendorAlias").textContent = `Alias: ${row.alias_text}`;
  qs("createVendorName").value = row.alias_text ?? "";
  backdrop.dataset.aliasText = row.alias_text ?? "";
  backdrop.dataset.sourceSystem = row.source_system ?? "";
}

function closeCreateVendorModal() {
  const backdrop = qs("createVendorModalBackdrop");
  backdrop.classList.remove("show");
  backdrop.setAttribute("aria-hidden", "true");
}

async function saveCreateVendor() {
  const backdrop = qs("createVendorModalBackdrop");
  const displayName = (qs("createVendorName").value || "").trim();
  if (!displayName) {
    toast("Vendor display name is required.", "error");
    return;
  }
  const { error } = await supabase.rpc(RPC_VENDOR_CREATE_AND_MAP, {
    p_display_name: displayName,
    p_alias_text: backdrop.dataset.aliasText,
    p_source_system: backdrop.dataset.sourceSystem,
  });
  if (error) {
    toast(`Create + map failed: ${error.message}`, "error");
    return;
  }
  toast("Vendor created and alias mapped.", "success");
  state.vendorList = []; // invalidate cache
  closeCreateVendorModal();
  await loadUnmappedAliases();
}

async function openMapVendorModal(row) {
  await loadVendorList();
  const backdrop = qs("mapVendorModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  qs("mapVendorAlias").textContent = `Alias: ${row.alias_text}`;
  qs("mapVendorFilter").value = "";
  filterVendorPick("");
  backdrop.dataset.aliasText = row.alias_text ?? "";
  backdrop.dataset.sourceSystem = row.source_system ?? "";
}

function closeMapVendorModal() {
  const backdrop = qs("mapVendorModalBackdrop");
  backdrop.classList.remove("show");
  backdrop.setAttribute("aria-hidden", "true");
}

async function saveMapVendor() {
  const backdrop = qs("mapVendorModalBackdrop");
  const vendorId = Number(qs("mapVendorPick").value || 0);
  if (!vendorId) {
    toast("Select a vendor from the list.", "error");
    return;
  }
  const { error } = await supabase.rpc(RPC_VENDOR_MAP_ALIAS, {
    p_vendor_id: vendorId,
    p_alias_text: backdrop.dataset.aliasText,
    p_source_system: backdrop.dataset.sourceSystem,
  });
  if (error) {
    toast(`Map failed: ${error.message}`, "error");
    return;
  }
  toast("Alias mapped to vendor.", "success");
  closeMapVendorModal();
  await loadUnmappedAliases();
}

function wireVendorControls() {
  qs("vBtnPrev").addEventListener("click", () => {
    state.vendorPage = Math.max(0, state.vendorPage - 1);
    loadUnmappedAliases();
  });
  qs("vBtnNext").addEventListener("click", () => {
    state.vendorPage += 1;
    loadUnmappedAliases();
  });
  qs("vSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      state.vendorPage = 0;
      loadUnmappedAliases();
    }
  });
  qs("btnCreateVendorCancel").addEventListener("click", closeCreateVendorModal);
  qs("btnCreateVendorSave").addEventListener("click", saveCreateVendor);
  qs("createVendorModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "createVendorModalBackdrop") closeCreateVendorModal();
  });
  qs("btnMapVendorCancel").addEventListener("click", closeMapVendorModal);
  qs("btnMapVendorSave").addEventListener("click", saveMapVendor);
  qs("mapVendorModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "mapVendorModalBackdrop") closeMapVendorModal();
  });
  qs("mapVendorFilter").addEventListener("input", (e) => {
    filterVendorPick(e.target.value);
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
  ensureIconBtnA11y("vBtnPrev", "Previous page");
  ensureIconBtnA11y("vBtnNext", "Next page");
  ensureIconBtnA11y("btnAqExportMenu", "Export options");
  ensureIconBtnA11y("btnIExportMenu", "Export options");

  wireGlobalHeaderControls();
  wireTabs();
  wireStockItemPicker();
  wireAddPrLineItemSearch();
  wireActionQueueControls();
  wireIndentControls();
  wireExcessControls();
  wireVendorControls();
  wirePrControls();
  await loadActionQueue();
  updateExportButtonStates();
  refreshAllTabCounts();
})();
