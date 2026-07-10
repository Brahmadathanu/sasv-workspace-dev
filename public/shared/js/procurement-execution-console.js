// public/shared/js/procurement-execution-console.js
import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

// ─── Module access (direct URL + read-only) ─────────────────────────────────
const MODULE_ID = "procurement-execution-console";
const MODULE_TARGET = `module:${MODULE_ID}`;

const accessState = {
  userId: null,
  canView: false,
  canEdit: false,
  loaded: false,
};

function setStatus(message, type = "info") {
  const el = qs("statusArea");
  if (!el) return;
  el.textContent = message || "";
  el.hidden = !message;
  el.classList.remove("error", "success", "info");
  if (message) el.classList.add(type);
}

function canAccessModule() {
  return Boolean(accessState.canView || accessState.canEdit);
}

function canWriteModule() {
  return Boolean(accessState.canEdit);
}

function canPerformEditAction(actionLabel = "This action") {
  if (canWriteModule()) return true;
  toast(`${actionLabel} is not available with read-only access.`, "error");
  return false;
}

function markEditAction(el, reason = "Read-only access") {
  if (!el) return;
  el.dataset.editAction = "true";
  if (!el.dataset.originalTitle) {
    el.dataset.originalTitle = el.getAttribute("title") || "";
  }
  if (!el.dataset.viewOnlyReason) {
    el.dataset.viewOnlyReason = reason;
  }
}

function applyPermissionUi() {
  const hasAccess = canAccessModule();
  const canEdit = canWriteModule();

  document.body.classList.toggle("view-only-mode", hasAccess && !canEdit);

  const banner = qs("viewOnlyBanner");
  if (banner) {
    banner.hidden = !(hasAccess && !canEdit);
  }

  document.querySelectorAll("[data-edit-action='true']").forEach((el) => {
    if (
      !(
        el instanceof HTMLButtonElement ||
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement
      )
    ) {
      return;
    }

    if (!el.dataset.permissionTracked) {
      el.dataset.permissionTracked = "true";
      el.dataset.originalDisabled = String(el.disabled);
      el.dataset.originalTitle = el.getAttribute("title") || "";
    }

    if (!canEdit) {
      el.disabled = true;
      el.setAttribute("aria-disabled", "true");
      el.setAttribute("title", el.dataset.viewOnlyReason || "Read-only access");
      return;
    }

    el.setAttribute("aria-disabled", String(el.disabled));

    const originalTitle = el.dataset.originalTitle || "";
    if (originalTitle) {
      el.setAttribute("title", originalTitle);
    } else if (!el.disabled) {
      el.removeAttribute("title");
    }
  });
}

async function loadAccessState() {
  accessState.userId = null;
  accessState.canView = false;
  accessState.canEdit = false;
  accessState.loaded = false;

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.user?.id) {
    throw sessionError || new Error("No active session");
  }

  accessState.userId = session.user.id;
  const uid = accessState.userId;
  let found = null;

  try {
    const { data: perms, error } = await supabase.rpc("get_user_permissions", {
      p_user_id: uid,
    });
    if (!error && Array.isArray(perms)) {
      const hit = perms.find((r) => r?.target === MODULE_TARGET);
      if (hit) found = hit;
    }
  } catch {
    // fall through
  }

  if (!found) {
    try {
      const { data: canonicalRows } = await supabase
        .from("user_permissions_canonical")
        .select("can_view, can_edit")
        .eq("user_id", uid)
        .eq("target", MODULE_TARGET)
        .limit(1);
      if (Array.isArray(canonicalRows) && canonicalRows.length) {
        found = canonicalRows[0];
      }
    } catch {
      // fall through
    }
  }

  if (!found) {
    try {
      const { data: rows } = await supabase
        .from("user_permissions")
        .select("can_view, can_edit")
        .eq("user_id", uid)
        .eq("module_id", MODULE_ID)
        .limit(1);
      if (Array.isArray(rows) && rows.length) {
        found = rows[0];
      }
    } catch {
      // fail closed
    }
  }

  if (found) {
    accessState.canView = Boolean(found.can_view);
    accessState.canEdit = Boolean(found.can_edit);
  }

  accessState.loaded = true;
}

// ─── View / RPC name constants (adjust here if DB names differ) ───────────────
const PR_HEADER_VIEW = "v_proc_pr_header";
const PR_LINES_ORDERED_VIEW = "v_proc_pr_lines_ordered";
const INDENT_LINES_ORDERED_VIEW = "v_proc_indent_lines_console_ordered";
const ERP_QTY_DECIMALS = 3;
const DEFAULT_PAGE_SIZE = 30;

let prLineAll = [];
let prLineFiltered = [];
let prLinePageSize = 50;
let prLineVisibleCount = 0;
let prLineFilterValue = "all";
let pendingPrQtyFocusLineId = null;
let iLineQuery = "";
let iLineFilter = "all";
const iLinePageSize = 75;
let iLineVisibleCount = 0;
let iLineFilteredRows = [];
let aqRawRows = [];
let aqRows = [];
let aqOffset = 0;
let aqPageSize = 75;
let aqHasMore = true;
let aqLoading = false;
let aqLoadingMore = false;
let aqTotalCount = 0;
let aqSelectedOnly = false;
let aqUnselectedOnly = false;
let aqGroupMode = "none";
let aqRequestSeq = 0;
let aqIndentOptionsLoaded = false;
let aqSearchDebounceMs = 500;

const state = {
  tab: "pr",
  // shared pagination for PR / Indents / Excess / Excess Audit
  pageSize: DEFAULT_PAGE_SIZE,
  // action queue
  rows: [],
  selected: null,
  actionLoaded: false,
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
  excessTotalCount: 0,
  excessTotalPages: 1,
  excessRows: [],
  excessAuditPage: 0,
  excessAuditTotalCount: 0,
  excessAuditTotalPages: 1,
  excessAuditRows: [],
  excessModal: null,
  excessFilters: {
    materialClassId: "",
    datePreset: "30d",
    dateFrom: "",
    dateTo: "",
    minQty: 0,
    vendorQ: "",
    itemQ: "",
    unmappedOnly: false,
  },
  // vendor-wise buylist tab
  vwl: {
    page: 0,
    pageSize: 75,
    totalCount: null,
    search: "",
    vendorId: "",
    rows: [],
    splitRows: [],
    splitLookup: {},
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

state.vwlFilters = state.vwlFilters || {
  materialClassId: "",
  materialClassCode: "",
  rmScope: "",
  rateStatus: "",
  assignmentStatus: "",
  splitOnly: false,
};

state.vwlMaterialClassOptions = state.vwlMaterialClassOptions || [];
state.vwlRmScopeOptions = state.vwlRmScopeOptions || [];
state.vwlSplitReview = state.vwlSplitReview || null;
state.vwlBreakdownRow = state.vwlBreakdownRow || null;

let vwlSplitActionConfirmResolve = null;

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
  toIconBtn(qs("btnPrExportMenu"), "primary", "Export Form", "download");
  applyPermissionUi();
}

async function requireSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) window.location.href = "../../login.html";
}

function setTab(tab) {
  closeVendorBuylistDrawers();
  closeAllProcurementFilterDrawers();
  state.tab = tab;
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document
    .querySelectorAll(".tab-panel")
    .forEach((p) => p.classList.remove("active"));
  qs(`tab-${tab}`).classList.add("active");
  // lazy-load tab data on each visit
  if (tab === "action")
    loadActionQueue({ refreshIndentOptions: !aqIndentOptionsLoaded });
  if (tab === "pr") loadPrHeaders();
  if (tab === "indents") loadIndents();
  if (tab === "excess") {
    loadExcess();
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

function truncateToDecimals(value, decimals = ERP_QTY_DECIMALS) {
  const num = Number(value);
  if (!Number.isFinite(num)) return NaN;
  const factor = 10 ** Math.max(0, decimals);
  return Math.trunc(num * factor) / factor;
}

function fmtQty(n, decimals = ERP_QTY_DECIMALS) {
  if (n === null || n === undefined || n === "") return "";
  const truncated = truncateToDecimals(n, decimals);
  if (Number.isNaN(truncated)) return String(n);
  return truncated.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function qtyInputValue(n, decimals = ERP_QTY_DECIMALS) {
  const truncated = truncateToDecimals(n, decimals);
  if (Number.isNaN(truncated)) return "";
  return truncated
    .toFixed(decimals)
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

const PILL_VARIANTS = [
  "pill-info",
  "pill-success",
  "pill-warning",
  "pill-danger",
  "pill-neutral",
  "pill-band-p1",
  "pill-band-p2",
  "pill-band-p3",
];

function statusPillClass(status) {
  const s = String(status || "").toLowerCase();
  if (["approved", "issued", "active", "open"].includes(s))
    return "pill-success";
  if (["draft", "pending"].includes(s)) return "pill-warning";
  if (["closed", "cancelled", "inactive", "rejected"].includes(s))
    return "pill-neutral";
  return "pill-info";
}

function priorityBandPillClass(band) {
  const b = String(band || "").toUpperCase();
  if (b === "P1") return "pill-band-p1";
  if (b === "P2") return "pill-band-p2";
  if (b === "P3") return "pill-band-p3";
  return "pill-neutral";
}

function setPillVariant(el, variant) {
  if (!el) return;
  el.classList.remove(...PILL_VARIANTS);
  if (variant) el.classList.add(variant);
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

function displayMaterialClassCode(code) {
  const c = String(code ?? "").trim().toUpperCase();
  if (c === "PLM") return "PM";
  return c;
}

function displayMaterialClassText(text) {
  return String(text ?? "").replace(/\bPLM\b/g, "PM");
}

function normalizeRmProcurementMode(row) {
  const raw = String(
    row?.rm_procurement_mode ?? row?.stock_item_rm_procurement_mode ?? "",
  )
    .trim()
    .toLowerCase();

  if (["jit_procured", "jit", "just_in_time"].includes(raw)) {
    return "jit";
  }

  if (
    [
      "stock_required",
      "normal",
      "regular",
      "stock",
      "stocked",
      "non_jit",
    ].includes(raw)
  ) {
    return "normal";
  }

  return raw || "";
}

function focusElementIfPossible(el) {
  if (!(el instanceof HTMLElement) || !document.contains(el)) return;
  requestAnimationFrame(() => {
    if (!document.contains(el)) return;
    el.focus({ preventScroll: true });
  });
}

function findControlledTrigger(panel) {
  const panelId = panel?.id;
  if (!panelId) return panel?._ownerBtn ?? panel?._triggerBtn ?? null;
  try {
    return (
      panel?._ownerBtn ??
      panel?._triggerBtn ??
      document.querySelector('[aria-controls="' + CSS.escape(panelId) + '"]')
    );
  } catch {
    return panel?._ownerBtn ?? panel?._triggerBtn ?? null;
  }
}

function configureDisclosureTrigger(
  btnId,
  panelId,
  { hasPopup = "dialog" } = {},
) {
  const btn = qs(btnId);
  if (!(btn instanceof HTMLElement)) return;
  if (panelId) btn.setAttribute("aria-controls", panelId);
  if (!btn.hasAttribute("aria-expanded")) {
    btn.setAttribute("aria-expanded", "false");
  }
  if (hasPopup) btn.setAttribute("aria-haspopup", hasPopup);
  if (
    btn instanceof HTMLButtonElement &&
    (!btn.getAttribute("type") || btn.getAttribute("type") === "submit")
  ) {
    btn.type = "button";
  }
}

function configureStaticDisclosureTriggers() {
  [
    ["aqFilterBtn", "aqFilterDrawer", "dialog"],
    ["prFilterBtn", "prFilterDrawer", "dialog"],
    ["iFilterBtn", "iFilterDrawer", "dialog"],
    ["vwlFilterBtn", "vwlFilterDrawer", "dialog"],
    ["eFilterBtn", "eFilterPanel", "dialog"],
    ["prLineFilterBtn", "prLineFilterDrawer", "dialog"],
    ["iLineFilterBtn", "iLineFilterDrawer", "dialog"],
    ["vwlExportBtn", "vwlExportMenu", "menu"],
    ["btnIndentResyncMenu", "iResyncMenu", "menu"],
    ["btnIExportMenu", "iExportMenu", "menu"],
    ["btnPrExportMenu", "prExportMenu", "menu"],
  ].forEach(([btnId, panelId, hasPopup]) =>
    configureDisclosureTrigger(btnId, panelId, { hasPopup }),
  );
}

let procurementOverlayA11yBound = false;

const FILTER_DRAWER_SELECT_INTERACT_MS = 750;

function markFilterDrawerSelectInteraction(drawer) {
  if (!(drawer instanceof HTMLElement)) return;
  drawer._selectInteractUntil = Date.now() + FILTER_DRAWER_SELECT_INTERACT_MS;
}

function isFilterDrawerSelectInteractionGrace(drawer) {
  if (!(drawer instanceof HTMLElement)) return false;
  return (
    typeof drawer._selectInteractUntil === "number" &&
    Date.now() < drawer._selectInteractUntil
  );
}

function shouldKeepFilterDrawerOpen(drawer, event) {
  if (!(drawer instanceof HTMLElement)) return false;
  const target = event?.target;

  if (target instanceof Element) {
    if (drawer.contains(target)) return true;
    const ownerBtn = findControlledTrigger(drawer);
    if (ownerBtn?.contains(target)) return true;
  }

  // Native <select> option menus render outside the DOM tree.
  return isFilterDrawerSelectInteractionGrace(drawer);
}

function bindFilterDrawerSelectGuards() {
  document.querySelectorAll(".pec-filter-drawer").forEach((drawer) => {
    if (drawer._selectGuardBound) return;
    drawer._selectGuardBound = true;
    drawer.addEventListener("mousedown", (e) => {
      const select =
        e.target instanceof HTMLSelectElement
          ? e.target
          : e.target instanceof Element
            ? e.target.closest("select")
            : null;
      if (select && drawer.contains(select)) {
        markFilterDrawerSelectInteraction(drawer);
      }
    });
  });
}

function closeProcurementFilterDrawer(drawer, { restoreFocus = false } = {}) {
  if (!drawer) return false;
  const ownerBtn = findControlledTrigger(drawer);
  const wasOpen = drawer.classList.contains("open");
  closeFloatingFilterDrawer(ownerBtn, drawer, { restoreFocus });
  return wasOpen;
}

function closeAllProcurementFilterDrawers({
  exceptId = null,
  restoreFocus = false,
} = {}) {
  let closed = false;
  document.querySelectorAll(".pec-filter-drawer.open").forEach((drawer) => {
    if (exceptId && drawer.id === exceptId) return;
    if (closeProcurementFilterDrawer(drawer, { restoreFocus })) {
      closed = true;
    }
  });
  return closed;
}

function wireProcurementOverlayA11y() {
  if (procurementOverlayA11yBound) return;
  procurementOverlayA11yBound = true;

  bindFilterDrawerSelectGuards();

  document.addEventListener(
    "click",
    (e) => {
      if (!(e.target instanceof Element)) return;

      document.querySelectorAll(".pec-filter-drawer.open").forEach((drawer) => {
        if (shouldKeepFilterDrawerOpen(drawer, e)) return;
        closeProcurementFilterDrawer(drawer, { restoreFocus: false });
      });

      if (!e.target.closest(".export-menu")) {
        closeAllExportMenus();
      }
    },
    true,
  );

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape") return;

      const openDrawers = [...document.querySelectorAll(".pec-filter-drawer.open")];
      const openDrawer = openDrawers[openDrawers.length - 1] || null;
      if (openDrawer) {
        e.preventDefault();
        e.stopPropagation();
        closeProcurementFilterDrawer(openDrawer, { restoreFocus: true });
        return;
      }

      if (document.querySelector(".export-menu.open")) {
        e.preventDefault();
        e.stopPropagation();
        closeAllExportMenus({ restoreFocus: true });
      }
    },
    true,
  );
}

function prClassText(row) {
  return (
    displayMaterialClassText(row?.material_class_display) ||
    [displayMaterialClassCode(row?.material_class_code), row?.material_class_label]
      .filter(Boolean)
      .join(" - ") ||
    (row?.material_class_id ? `Class ID: ${row.material_class_id}` : "—")
  );
}

function prScopeText(row) {
  return (
    row?.rm_scope_label ||
    row?.rm_scope ||
    row?.generation_filters?.rm_scope ||
    "—"
  );
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

function closeAllExportMenus({ exceptId = null, restoreFocus = false } = {}) {
  let closed = false;

  document.querySelectorAll(".export-menu.open").forEach((menu) => {
    if (exceptId && menu.id === exceptId) return;
    const btn = findControlledTrigger(menu);
    menu.classList.remove("open");
    menu._triggerBtn = null;
    if (btn) btn.setAttribute("aria-expanded", "false");
    if (restoreFocus && btn) focusElementIfPossible(btn);
    closed = true;
  });

  if (closeVendorBuylistDrawers(exceptId, { restoreFocus })) {
    closed = true;
  }

  return closed;
}

function closeVendorBuylistDrawers(
  exceptId = null,
  { restoreFocus = false } = {},
) {
  let closed = false;

  // Export UI only. Filter drawer follows the same pec-filter-drawer pattern as other tabs.
  if (exceptId !== "vwlExportDrawer") {
    const el = qs("vwlExportDrawer");
    if (el) {
      const wasOpen =
        el.classList.contains("open") ||
        el.classList.contains("show") ||
        el.classList.contains("active") ||
        !el.hasAttribute("hidden");
      el.classList.remove("open", "show", "active");
      el.setAttribute("hidden", "hidden");
      const btn = qs("vwlExportBtn");
      if (btn) btn.setAttribute("aria-expanded", "false");
      if (restoreFocus && wasOpen && btn) focusElementIfPossible(btn);
      if (wasOpen) closed = true;
    }
  }

  if (exceptId !== "vwlExportMenu") {
    const menu = qs("vwlExportMenu");
    const btn = qs("vwlExportBtn");
    const wasOpen = menu?.classList.contains("open");
    menu?.classList.remove("open");
    if (btn) btn.setAttribute("aria-expanded", "false");
    if (restoreFocus && wasOpen && btn) focusElementIfPossible(btn);
    if (wasOpen) closed = true;
  }

  return closed;
}

function toggleExportMenu(menuId, btnEl) {
  const menu = qs(menuId);
  if (!menu || !btnEl) return;

  menu._triggerBtn = btnEl;
  btnEl.setAttribute("aria-controls", menuId);
  btnEl.setAttribute("aria-haspopup", btnEl.getAttribute("aria-haspopup") || "menu");

  const isOpen = menu.classList.contains("open");
  if (isOpen) {
    closeAllExportMenus({ restoreFocus: true });
    return;
  }

  closeAllExportMenus({ exceptId: menuId });
  menu.classList.add("open");
  btnEl.setAttribute("aria-expanded", "true");
}

function positionFloatingFilterDrawer(btn, drawer) {
  if (!btn || !drawer) return;
  const rect = btn.getBoundingClientRect();
  const isInsideModal = !!btn.closest(".modal");
  drawer.style.position = "fixed";
  drawer.style.right = "auto";
  drawer.style.bottom = "auto";
  drawer.style.zIndex = "2147483647";

  const margin = 4;
  const dropW = drawer.offsetWidth || 220;

  let left = rect.left;
  if (left + dropW > window.innerWidth - margin) {
    left = Math.max(margin, rect.right - dropW);
  }

  let top = rect.bottom + margin;
  if (!isInsideModal) {
    const dropH = drawer.offsetHeight || 220;
    if (top + dropH > window.innerHeight - margin) {
      const up = rect.top - margin - dropH;
      if (up >= margin) top = up;
    }
  }

  if (isInsideModal) {
    const availableBelow = Math.max(140, window.innerHeight - top - margin);
    drawer.style.maxHeight = `${Math.floor(availableBelow)}px`;
  } else {
    drawer.style.maxHeight = "";
  }

  drawer.style.left = `${Math.round(left)}px`;
  drawer.style.top = `${Math.round(top)}px`;
}

function stopFloatingFilterDrawerTracking(drawer) {
  if (!drawer) return;
  if (typeof drawer._stopFollowPosition === "function") {
    drawer._stopFollowPosition();
    drawer._stopFollowPosition = null;
  }
}

function startFloatingFilterDrawerTracking(btn, drawer) {
  if (!btn || !drawer) return;
  stopFloatingFilterDrawerTracking(drawer);

  let rafId = 0;
  const tick = () => {
    if (!drawer.classList.contains("open")) {
      rafId = 0;
      return;
    }
    positionFloatingFilterDrawer(btn, drawer);
    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);
  drawer._stopFollowPosition = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  };
}

function openFloatingFilterDrawer(btn, drawer, focusEl) {
  if (!btn || !drawer) return;
  document.querySelectorAll(".pec-filter-drawer.open").forEach((d) => {
    if (d !== drawer) closeFloatingFilterDrawer(null, d);
  });

  if (!drawer._portalPlaceholder) {
    drawer._portalPlaceholder = document.createComment("pec-filter-drawer");
  }
  if (drawer.parentNode !== document.body) {
    const parent = drawer.parentNode;
    if (parent) {
      drawer._portalParent = parent;
      parent.insertBefore(drawer._portalPlaceholder, drawer);
      document.body.appendChild(drawer);
    }
  }

  drawer.classList.add("open");
  drawer._ownerBtn = btn;
  btn.setAttribute("aria-expanded", "true");
  positionFloatingFilterDrawer(btn, drawer);
  startFloatingFilterDrawerTracking(btn, drawer);
  focusEl?.focus?.();
}

function closeFloatingFilterDrawer(btn, drawer, options = {}) {
  if (!drawer) return;
  const { restoreFocus = false } = options;
  const ownerBtn = btn || drawer._ownerBtn || findControlledTrigger(drawer);
  drawer.classList.remove("open");
  if (ownerBtn) ownerBtn.setAttribute("aria-expanded", "false");
  stopFloatingFilterDrawerTracking(drawer);

  if (
    drawer._portalPlaceholder &&
    drawer._portalPlaceholder.parentNode instanceof Node
  ) {
    drawer._portalPlaceholder.parentNode.insertBefore(
      drawer,
      drawer._portalPlaceholder,
    );
    drawer._portalPlaceholder.remove();
    drawer._portalPlaceholder = null;
  }
  drawer._portalParent = null;
  drawer._ownerBtn = null;

  if (restoreFocus && ownerBtn) {
    focusElementIfPossible(ownerBtn);
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

function setModalProcessing(backdropId, active, text = "Processing…") {
  const backdrop = qs(backdropId);
  if (!backdrop) return;
  const modal = backdrop.querySelector(":scope > .modal");
  if (!modal) return;

  let mask = modal.querySelector(":scope > .modal-processing-mask");
  if (active) {
    if (!mask) {
      mask = document.createElement("div");
      mask.className = "modal-processing-mask";
      mask.style.cssText =
        "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.18);backdrop-filter:blur(1px);z-index:20;";
      mask.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;background:var(--panel-bg,#fff);border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:8px 12px;font-size:13px;box-shadow:0 8px 22px rgba(0,0,0,.16)"><span class="spinner tiny"></span><span class="modal-processing-text"></span></div>';
      modal.style.position = modal.style.position || "relative";
      modal.appendChild(mask);
    }
    const txt = mask.querySelector(".modal-processing-text");
    if (txt) txt.textContent = text;
    return;
  }

  mask?.remove();
}

const tabLoadingControlStates = new WeakMap();

function isTabPanelLoadingControl(control) {
  if (
    !(
      control instanceof HTMLButtonElement ||
      control instanceof HTMLInputElement ||
      control instanceof HTMLSelectElement ||
      control instanceof HTMLTextAreaElement
    )
  ) {
    return false;
  }

  if (
    control instanceof HTMLInputElement &&
    control.classList.contains("pec-search-input")
  ) {
    return false;
  }

  return true;
}

function setTabPanelControlsLoading(panel, active) {
  if (!(panel instanceof HTMLElement)) return;

  if (active) {
    panel._pecControlsLoadingDepth = (panel._pecControlsLoadingDepth || 0) + 1;
    if (panel._pecControlsLoadingDepth > 1) return;

    panel.querySelectorAll("button, input, select, textarea").forEach((control) => {
      if (!isTabPanelLoadingControl(control)) return;

      if (!tabLoadingControlStates.has(control)) {
        tabLoadingControlStates.set(control, {
          disabled: control.disabled,
          ariaDisabled: control.getAttribute("aria-disabled"),
        });
      }
      control.disabled = true;
      control.setAttribute("aria-disabled", "true");
    });
    return;
  }

  panel._pecControlsLoadingDepth = Math.max(
    0,
    (panel._pecControlsLoadingDepth || 0) - 1,
  );
  if (panel._pecControlsLoadingDepth > 0) return;

  panel.querySelectorAll("button, input, select, textarea").forEach((control) => {
    if (!isTabPanelLoadingControl(control)) return;

    const previous = tabLoadingControlStates.get(control);
    if (!previous) return;

    control.disabled = previous.disabled;
    if (previous.ariaDisabled == null) {
      control.removeAttribute("aria-disabled");
    } else {
      control.setAttribute("aria-disabled", previous.ariaDisabled);
    }
    tabLoadingControlStates.delete(control);
  });
}

function resetTabPanelLoadingState(tabName) {
  const panel = qs(`tab-${tabName}`);
  if (!panel) return;

  panel._pecControlsLoadingDepth = 0;
  panel._pecTableLoadingDepth = 0;
  panel.setAttribute("aria-busy", "false");
  panel.classList.remove("is-table-loading");

  panel.querySelectorAll(".card .table-scroll").forEach((area) => {
    if (!(area instanceof HTMLElement)) return;
    area.classList.remove("loading");
    area.querySelector(":scope > .table-loading-mask")?.remove();
  });

  panel.querySelectorAll("button, input, select, textarea").forEach((control) => {
    if (!isTabPanelLoadingControl(control)) {
      if (
        control instanceof HTMLInputElement &&
        control.classList.contains("pec-search-input")
      ) {
        control.disabled = false;
        control.removeAttribute("aria-disabled");
      }
      return;
    }

    const previous = tabLoadingControlStates.get(control);
    if (!previous) return;

    control.disabled = previous.disabled;
    if (previous.ariaDisabled == null) {
      control.removeAttribute("aria-disabled");
    } else {
      control.setAttribute("aria-disabled", previous.ariaDisabled);
    }
    tabLoadingControlStates.delete(control);
  });
}

function setTabTableLoading(tabName, active, loadingText = "Loading...") {
  const panel = qs(`tab-${tabName}`);
  if (!panel) return;

  if (active) {
    panel._pecTableLoadingDepth = (panel._pecTableLoadingDepth || 0) + 1;
  } else {
    panel._pecTableLoadingDepth = Math.max(
      0,
      (panel._pecTableLoadingDepth || 0) - 1,
    );
  }

  const isLoading = (panel._pecTableLoadingDepth || 0) > 0;
  panel.setAttribute("aria-busy", isLoading ? "true" : "false");
  panel.classList.toggle("is-table-loading", isLoading);
  setTabPanelControlsLoading(panel, active);

  const scrollAreas = panel.querySelectorAll(".card .table-scroll");
  if (!scrollAreas.length) return;

  scrollAreas.forEach((area) => {
    if (!(area instanceof HTMLElement)) return;

    if (isLoading) {
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
  const palette =
    type === "error"
      ? {
          bg: "var(--toast-error-bg, #fef2f2)",
          color: "var(--toast-error-text, #991b1b)",
          border: "var(--toast-error-border, #fca5a5)",
        }
      : type === "success"
        ? {
            bg: "var(--toast-success-bg, #f0fdf4)",
            color: "var(--toast-success-text, #166534)",
            border: "var(--toast-success-border, #86efac)",
          }
        : {
            bg: "var(--toast-info-bg, #eff6ff)",
            color: "var(--toast-info-text, #1e40af)",
            border: "var(--toast-info-border, #bfdbfe)",
          };
  div.style.cssText = `background:${palette.bg};color:${palette.color};border:1px solid ${palette.border};padding:10px 14px;border-radius:10px;font-size:13px;pointer-events:auto;box-shadow:0 2px 8px rgba(0,0,0,.2);opacity:1;transition:opacity .4s;`;
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
  hideModalBackdrop(backdrop, [qs("workflowGuideBtn")]);
  const resolve = hardDeleteResolve;
  hardDeleteResolve = null;
  hardDeleteOnConfirm = null;
  if (typeof resolve === "function") resolve(result);
}

async function submitHardDeleteConfirm() {
  if (!canPerformEditAction("Delete")) return;
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
  if (!canPerformEditAction("Delete")) return false;
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

function isVendorAssignmentCleared(row) {
  const cleared = row?.vendor_assignment_cleared;
  return cleared === true || String(cleared) === "true";
}

function getActionQueueAssignedVendorLabel(row) {
  if (isVendorAssignmentCleared(row)) return "UNASSIGNED";
  return row?.resolved_vendor_name || "";
}

function getActionQueueAssignedVendorRate(row) {
  if (isVendorAssignmentCleared(row)) return null;
  const rate = row?.resolved_rate;
  return rate == null || rate === "" ? null : rate;
}

function renderActionQueueVendorCell(row) {
  if (isVendorAssignmentCleared(row)) {
    return '<span class="pill pill-neutral" title="Vendor assignment cleared">UNASSIGNED</span>';
  }
  const label = getActionQueueAssignedVendorLabel(row);
  return esc(label || "-");
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
  setPillVariant(
    qs("detailBand"),
    priorityBandPillClass(row.priority_band_final),
  );
  qs("detailMos").textContent = `MOS: ${row.mos_months ?? "-"}`;
  qs("detailMos").style.display = row.mos_months != null ? "" : "none";
  setPillVariant(
    qs("detailMos"),
    Number(row.mos_months ?? 999) < 1 ? "pill-danger" : "pill-info",
  );
  qs("detailLead").textContent = `Lead: ${row.lead_time_days ?? 0} d`;
  qs("detailLead").style.display = row.lead_time_days != null ? "" : "none";
  setPillVariant(qs("detailLead"), "pill-neutral");

  // flags
  const hasSelectedF =
    !isVendorAssignmentCleared(row) &&
    Boolean(row.has_selected_vendor || row.selected_vendor_id);
  const hasExcessF = Boolean(row.has_net_excess);
  const mosRiskLowF =
    row.mos_risk_low != null
      ? Boolean(row.mos_risk_low)
      : Number(row.mos_months ?? 999) < 1;
  const flagsEl = qs("detailFlags");
  if (flagsEl) {
    flagsEl.innerHTML = [
      hasSelectedF
        ? '<span class="pill pill-flag pill-success" title="Selected vendor exists">S</span>'
        : "",
      hasExcessF
        ? '<span class="pill pill-flag pill-warning" title="Has net excess">E</span>'
        : "",
      mosRiskLowF
        ? '<span class="pill pill-flag pill-danger" title="MOS risk low">!</span>'
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
  const selName =
    row.selected_vendor_name ??
    (row.selected_vendor_id ? `ID ${row.selected_vendor_id}` : null);
  const vendorPairs = isVendorAssignmentCleared(row)
    ? [["Resolved Vendor", "UNASSIGNED"]]
    : [
        ["Resolved Vendor", row.resolved_vendor_name],
        ["Resolved Rate", row.resolved_rate],
        ["Recommended Vendor", recName],
        ["Recommended Rate", row.recommended_rate],
        ["Selected Vendor", selName],
        ["Selected Rate", row.selected_rate],
        ["Selection Reason", row.selection_reason],
      ].filter(([, v]) => v !== undefined && v !== null && v !== "");
  qs("detailVendor").innerHTML = toHtmlTableFromPairs(vendorPairs);

  const actionHint = qs("detailActionHint");
  if (actionHint) {
    if (isVendorAssignmentCleared(row)) {
      actionHint.textContent =
        "No vendor is assigned. Use Recommend or Select to assign a vendor.";
    } else if (row.selected_vendor_id || row.selected_vendor_name) {
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
  const clearBtn = qs("btnDetailClearSelectedVendor");
  const jumpBtn = qs("btnDetailJumpIndent");
  const hasSelectedVendor = Boolean(
    row.has_selected_vendor || row.selected_vendor_id,
  );
  const canClear = canClearSelectedVendor(row);

  if (recBtn) {
    recBtn.disabled = !canWriteModule() || !row.indent_line_id;
    if (!canWriteModule()) recBtn.title = "Read-only access";
  }
  if (selBtn) {
    selBtn.disabled = !canWriteModule() || !row.indent_line_id;
    if (!canWriteModule()) selBtn.title = "Read-only access";
  }
  if (clearBtn) {
    if (!hasSelectedVendor) {
      clearBtn.style.display = "none";
      clearBtn.disabled = true;
    } else {
      clearBtn.style.display = "";
      clearBtn.disabled = !canClear;
      clearBtn.title = canClear
        ? "Clear Vendor Assignment"
        : "This indent is not editable.";
      clearBtn.setAttribute(
        "aria-label",
        canClear ? "Clear Vendor Assignment" : "This indent is not editable.",
      );
    }
  }
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
  applyPermissionUi();
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
    const vendorCell = renderActionQueueVendorCell(row);
    const vendorRate = getActionQueueAssignedVendorRate(row);

    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    tr.innerHTML = `
      <td title="Indent ID: ${esc(row.indent_id ?? "")}">${esc(row.indent_number ?? "")}</td>
      <td title="${esc(row.material_class_code ?? "")} | ${esc(row.uom_code ?? "")}">${esc(row.stock_item_name ?? "")}</td>
      <td>${fmt(row.remaining_qty)}</td>
      <td><span class="pill ${priorityBandPillClass(row.priority_band_final)}">${esc(row.priority_band_final ?? "-")}</span></td>
      <td>${fmt(row.priority_score_system)}</td>
      <td>${vendorCell}</td>
      <td>${vendorRate != null ? fmt(vendorRate) : "-"}</td>
    `;

    tr.addEventListener("click", () => renderDetail(row));

    tbody.appendChild(tr);
  }

  if (aqLoadingMore && state.rows.length > 0) {
    const loadingRow = document.createElement("tr");
    loadingRow.className = "aq-loading-row";
    loadingRow.innerHTML =
      '<td colspan="7" style="text-align:center;padding:12px 10px;color:rgba(15,23,42,0.65);font-size:12px;">Loading more lines...</td>';
    tbody.appendChild(loadingRow);
  }

  qs("aqMeta").textContent =
    aqTotalCount === 0 ? "0 lines" : `Showing ${state.rows.length} of ${aqTotalCount} lines`;

  updateTabCount("tabCountAction", aqTotalCount);
  updateExportButtonStates();
}

function getActionQueueSelectedState() {
  if (aqSelectedOnly) return "selected";
  if (aqUnselectedOnly) return "unselected";
  return null;
}

function buildActionQueueRpcParams({ offset = 0, limit = aqPageSize } = {}) {
  const indentId = qs("fIndent")?.value || "";
  const band = qs("fBand")?.value || "";
  const cls = qs("fClass")?.value || "";
  const search = (qs("fSearch")?.value || "").trim();
  const needs = qs("fNeeds")?.value || "";

  return {
    p_indent_id: indentId ? Number(indentId) : null,
    p_priority_band: band || null,
    p_material_class_id: cls ? Number(cls) : null,
    p_needs: needs || null,
    p_selected_state: getActionQueueSelectedState(),
    p_group_mode: aqGroupMode || "none",
    p_q: search || null,
    p_limit: limit,
    p_offset: offset,
  };
}

function actionQueueParamsStillCurrent(params) {
  const current = buildActionQueueRpcParams();
  return (
    current.p_indent_id === params.p_indent_id &&
    current.p_priority_band === params.p_priority_band &&
    current.p_material_class_id === params.p_material_class_id &&
    current.p_needs === params.p_needs &&
    current.p_selected_state === params.p_selected_state &&
    current.p_group_mode === params.p_group_mode &&
    current.p_q === params.p_q
  );
}

async function loadActionQueueIndentOptions() {
  const sel = qs("fIndent");
  if (!sel) return true;

  const current = sel.value || "";

  const { data, error } = await supabase
    .from("v_proc_indent_console")
    .select("indent_id, indent_number, status, total_remaining_qty, line_count")
    .in("status", ["approved", "issued"])
    .gt("total_remaining_qty", 0)
    .order("indent_number", { ascending: true });

  if (error) {
    console.error("Failed to load Action Queue indent options", error);
    return false;
  }

  sel.innerHTML = `<option value="">All Indents</option>`;

  for (const r of data || []) {
    const opt = document.createElement("option");
    opt.value = String(r.indent_id);
    opt.textContent =
      `${r.indent_number || r.indent_id} - ${r.status || ""} - ` +
      `${fmt(r.total_remaining_qty || 0)} pending`;
    sel.appendChild(opt);
  }

  if ([...sel.options].some((o) => o.value === current)) {
    sel.value = current;
  }

  return true;
}

let aqLoadingDepth = 0;

function bumpActionQueueLoading(active, loadingText = "Loading...") {
  if (active) {
    aqLoadingDepth += 1;
    if (aqLoadingDepth === 1) setActionQueueLoading(true, loadingText);
    return;
  }

  aqLoadingDepth = Math.max(0, aqLoadingDepth - 1);
  if (aqLoadingDepth === 0) setActionQueueLoading(false);
}

function setActionQueueLoading(active, loadingText = "Loading...") {
  const panel = qs("tab-action");
  const searchWrap = qs("fSearch")?.closest(".pec-search-wrap");
  const tableScroll = qs("aqScroll") ?? panel?.querySelector(".card .table-scroll");

  if (panel) {
    panel.setAttribute("aria-busy", active ? "true" : "false");
  }

  if (searchWrap) {
    searchWrap.classList.toggle("is-searching", Boolean(active));
  }

  if (!(tableScroll instanceof HTMLElement)) return;

  if (active) {
    tableScroll.classList.add("loading");
    let mask = tableScroll.querySelector(":scope > .table-loading-mask");
    if (!mask) {
      mask = document.createElement("div");
      mask.className = "table-loading-mask";
      mask.innerHTML =
        '<span class="table-loading-spinner" aria-hidden="true"></span><span></span>';
      tableScroll.appendChild(mask);
    }
    const textEl = mask.querySelector("span:last-child");
    if (textEl) textEl.textContent = loadingText;
    return;
  }

  tableScroll.classList.remove("loading");
  tableScroll.querySelector(":scope > .table-loading-mask")?.remove();
}

function captureActionQueueSearchFocus() {
  const input = qs("fSearch");
  if (!(input instanceof HTMLInputElement)) {
    return { input: null, focused: false, start: null, end: null };
  }

  return {
    input,
    focused: document.activeElement === input,
    start: input.selectionStart,
    end: input.selectionEnd,
  };
}

function restoreActionQueueSearchFocus(snapshot) {
  const { input, focused, start, end } = snapshot || {};
  if (!(input instanceof HTMLInputElement) || !focused) return;
  if (!document.contains(input)) return;
  if (
    document.activeElement !== input &&
    document.activeElement !== document.body
  ) {
    return;
  }

  input.focus({ preventScroll: true });
  if (start != null && end != null) {
    try {
      input.setSelectionRange(start, end);
    } catch {
      // Some input types do not support selection ranges.
    }
  }
}

async function loadActionQueue(options = {}) {
  const {
    reset = true,
    append = false,
    refreshIndentOptions = false,
    preserveFocus = true,
  } = options;
  const requestSeq = ++aqRequestSeq;
  const focusSnapshot = preserveFocus
    ? captureActionQueueSearchFocus()
    : { input: null, focused: false, start: null, end: null };
  const isAppend = Boolean(append && !reset);
  let bumpedAqLoading = false;

  if (reset) {
    aqRows = [];
    aqOffset = 0;
    aqHasMore = true;
    aqTotalCount = 0;
    state.rows = [];
    aqLoadingMore = false;
    aqLoading = true;
    renderRows();
    bumpedAqLoading = true;
    bumpActionQueueLoading(true);
  } else if (isAppend) {
    if (aqLoading || aqLoadingMore || !aqHasMore) return;
    aqLoadingMore = true;
    renderRows();
  } else {
    aqLoading = true;
    bumpedAqLoading = true;
    bumpActionQueueLoading(true);
  }

  try {
    if (refreshIndentOptions || !aqIndentOptionsLoaded) {
      const loaded = await loadActionQueueIndentOptions();
      if (loaded) aqIndentOptionsLoaded = true;
    }

    const params = buildActionQueueRpcParams({
      offset: isAppend ? aqOffset : 0,
      limit: aqPageSize,
    });

    const { data, error } = await supabase.rpc(
      "proc_procurement_action_queue_paged",
      params,
    );

    if (requestSeq !== aqRequestSeq || !actionQueueParamsStillCurrent(params)) {
      return;
    }

    if (error) {
      console.error(error);
      toast(`Failed to load Action Queue: ${error.message}`, "error");
      return;
    }

    const rows = (data || []).map((r) => ({
      ...(r.row_data || {}),
      total_count: r.total_count,
    }));

    aqRawRows = rows;
    aqTotalCount = data?.length ? Number(data[0].total_count || 0) : 0;
    aqRows = isAppend ? [...aqRows, ...rows] : rows;
    aqHasMore = aqRows.length < aqTotalCount;
    aqOffset = aqRows.length;
    state.rows = aqRows;
    state.actionLoaded = true;
    renderRows();
    restoreActionQueueSearchFocus(focusSnapshot);
  } finally {
    if (bumpedAqLoading) bumpActionQueueLoading(false);
    if (requestSeq === aqRequestSeq) {
      aqLoading = false;
      aqLoadingMore = false;
      renderRows();
    }
  }
}

async function doRecommend(indentLineId) {
  if (!canPerformEditAction("Recommend vendor")) return;
  const { error } = await supabase.rpc("proc_indent_recommend_vendor", {
    p_indent_line_id: indentLineId,
  });
  if (error) {
    toast(`Recommend failed: ${error.message}`, "error");
    return;
  }
  await loadActionQueue();
}

function canClearSelectedVendor(row) {
  if (!row) return false;
  if (typeof canWriteModule === "function" && !canWriteModule()) return false;
  const hasSelected = Boolean(row.has_selected_vendor || row.selected_vendor_id);
  if (!hasSelected) return false;
  const status = String(row.status || row.indent_status || "").toLowerCase();
  if (status === "closed" || status === "cancelled") return false;
  return true;
}

function mapClearSelectedVendorError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  if (
    msg.includes("closed") ||
    msg.includes("cancelled") ||
    msg.includes("not editable")
  ) {
    return "This indent is not editable.";
  }
  if (
    msg.includes("no selected vendor") ||
    msg.includes("not selected") ||
    msg.includes("nothing to clear")
  ) {
    return "No selected vendor exists for this line.";
  }
  return "Could not clear vendor assignment.";
}

let clearSelectedVendorResolve = null;

function closeClearSelectedVendorModal(result = false) {
  const backdrop = qs("clearSelectedVendorModalBackdrop");
  if (!backdrop) return;
  hideModalBackdrop(backdrop, [qs("btnDetailClearSelectedVendor")]);
  const resolve = clearSelectedVendorResolve;
  clearSelectedVendorResolve = null;
  if (typeof resolve === "function") resolve(result);
}

function confirmClearSelectedVendor() {
  const backdrop = qs("clearSelectedVendorModalBackdrop");
  if (!backdrop) return Promise.resolve(false);

  const messageEl = qs("clearSelectedVendorMessage");
  if (messageEl) {
    messageEl.textContent =
      "Clear vendor assignment for this line? This will make the line unassigned until a vendor is selected or recommended again.";
  }

  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  setTimeout(() => qs("btnClearSelectedVendorConfirm")?.focus(), 0);

  return new Promise((resolve) => {
    clearSelectedVendorResolve = resolve;
  });
}

function wireClearSelectedVendorModalControls() {
  qs("btnClearSelectedVendorClose")?.addEventListener("click", () =>
    closeClearSelectedVendorModal(false),
  );
  qs("btnClearSelectedVendorCancel")?.addEventListener("click", () =>
    closeClearSelectedVendorModal(false),
  );
  qs("btnClearSelectedVendorConfirm")?.addEventListener("click", () =>
    closeClearSelectedVendorModal(true),
  );
  qs("clearSelectedVendorModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "clearSelectedVendorModalBackdrop") {
      closeClearSelectedVendorModal(false);
    }
  });
}

async function afterClearSelectedVendorSaved(indentLineId, indentId) {
  await loadActionQueue();

  if (typeof loadVendorBuylist === "function" && state.vwl?.loaded) {
    await reloadVendorBuylist();
  }

  const openIndentId =
    state.currentIndentId || state.selectedIndent?.indent_id || null;
  if (openIndentId && Number(openIndentId) === Number(indentId)) {
    await loadIndentLines(openIndentId);
  }

  if (state.selected?.indent_line_id === indentLineId) {
    const updated = aqRawRows.find(
      (r) => Number(r.indent_line_id) === Number(indentLineId),
    );
    if (updated) openDetailModal(updated);
  }
}

async function clearSelectedVendorForRow(row) {
  if (!canPerformEditAction("Clear vendor assignment")) return;
  if (!canClearSelectedVendor(row)) {
    if (row?.has_selected_vendor || row?.selected_vendor_id) {
      toast("This indent is not editable.", "error");
    } else {
      toast("No selected vendor exists for this line.", "error");
    }
    return;
  }

  const confirmed = await confirmClearSelectedVendor();
  if (!confirmed) return;

  setLoading(true);
  const { error } = await supabase.rpc("proc_indent_clear_vendor_assignment", {
    p_indent_line_id: row.indent_line_id,
  });
  setLoading(false);

  if (error) {
    toast(mapClearSelectedVendorError(error), "error");
    return;
  }

  toast("Vendor assignment cleared. Line is now unassigned.", "success");
  await afterClearSelectedVendorSaved(row.indent_line_id, row.indent_id);
}

function openVendorModal(row) {
  if (!canPerformEditAction("Select vendor")) return;
  const backdrop = qs("vendorModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => qs("vendorPick")?.focus());

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
  if (!canPerformEditAction("Save vendor selection")) return;
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
  configureStaticDisclosureTriggers();
  wireProcurementOverlayA11y();
  ["fIndent", "fBand", "fClass", "fNeeds"].forEach((id) =>
    qs(id)?.addEventListener("change", () => {
      loadActionQueue({ reset: true, append: false, preserveFocus: false });
    }),
  );

  const searchInput = qs("fSearch");
  const searchClear = qs("fSearchClear");
  let aqSearchTimer = null;

  const syncActionQueueSearchClear = () => {
    if (searchClear) {
      searchClear.style.display = searchInput?.value ? "" : "none";
    }
  };

  const runActionQueueSearch = () => {
    if (aqSearchTimer) {
      clearTimeout(aqSearchTimer);
      aqSearchTimer = null;
    }
    loadActionQueue({ reset: true, append: false, preserveFocus: true });
  };

  if (searchInput) {
    syncActionQueueSearchClear();
    searchInput.addEventListener("input", () => {
      syncActionQueueSearchClear();
      if (aqSearchTimer) clearTimeout(aqSearchTimer);
      aqSearchTimer = setTimeout(runActionQueueSearch, aqSearchDebounceMs);
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      runActionQueueSearch();
    });
  }

  searchClear?.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();

      if (!searchInput?.value) return;
      searchInput.value = "";
      syncActionQueueSearchClear();
      runActionQueueSearch();
      searchInput.focus({ preventScroll: true });
    },
    true,
  );

  qs("fSelectedOnly")?.addEventListener("change", (e) => {
    aqSelectedOnly = Boolean(e.target.checked);
    if (aqSelectedOnly) {
      aqUnselectedOnly = false;
      if (qs("fUnselectedOnly")) qs("fUnselectedOnly").checked = false;
    }
    loadActionQueue({ reset: true, append: false, preserveFocus: false });
  });
  qs("fUnselectedOnly")?.addEventListener("change", (e) => {
    aqUnselectedOnly = Boolean(e.target.checked);
    if (aqUnselectedOnly) {
      aqSelectedOnly = false;
      if (qs("fSelectedOnly")) qs("fSelectedOnly").checked = false;
    }
    loadActionQueue({ reset: true, append: false, preserveFocus: false });
  });
  qs("fGroupMode")?.addEventListener("change", (e) => {
    aqGroupMode = e.target.value || "none";
    loadActionQueue({ reset: true, append: false, preserveFocus: false });
  });

  qs("aqScroll")?.addEventListener("scroll", () => {
    const scroller = qs("aqScroll");
    if (!(scroller instanceof HTMLElement)) return;
    if (aqLoading || aqLoadingMore || !aqHasMore) return;
    const nearBottom =
      scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 120;
    if (!nearBottom) return;
    loadActionQueue({ reset: false, append: true, preserveFocus: false });
  });

  qs("btnVendorClose")?.addEventListener("click", closeVendorModal);
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
  qs("btnDetailClearSelectedVendor")?.addEventListener("click", async () => {
    if (!state.selected) return;
    await clearSelectedVendorForRow(state.selected);
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
      { id: "acceptExcessModalBackdrop", close: closeAcceptExcessModal },
      { id: "eAuditModalBackdrop", close: closeExcessAuditModal },
      {
        id: "vwlSplitReviewModalBackdrop",
        close: closeVwlSplitReviewModal,
      },
      {
        id: "vwlSplitActionConfirmModalBackdrop",
        close: () => closeVwlSplitActionConfirmModal(false),
      },
      { id: "vwlBreakdownModalBackdrop", close: closeVwlBreakdownModal },
      { id: "indentViewModalBackdrop", close: closeIndentViewModal },
      { id: "prViewModalBackdrop", close: closePrViewModal },
      { id: "prRebuildModalBackdrop", close: closePrRebuildModal },
      { id: "generatePrModalBackdrop", close: closeGeneratePrModal },
      { id: "prAddLineModalBackdrop", close: closePrAddLineModal },
      { id: "prSetStatusModalBackdrop", close: closePrSetStatusModal },
      { id: "createIndentModalBackdrop", close: closeCreateIndentModal },
      { id: "indentFromPrModalBackdrop", close: closeIndentFromPrModal },
      { id: "indentActionModalBackdrop", close: closeIndentActionModal },
      { id: "indentAddLineModalBackdrop", close: closeIndentAddLineModal },
      {
        id: "vendorAcceptModeModalBackdrop",
        close: closeVendorAcceptModeModal,
      },
      { id: "indentSourcePrModalBackdrop", close: closeIndentSourcePrModal },
      { id: "indentResyncModalBackdrop", close: closeIndentResyncModal },
      { id: "stockPickerModalBackdrop", close: closeStockItemPicker },
      { id: "exportIndentModalBackdrop", close: closeExportIndentModal },
      { id: "hardDeleteModalBackdrop", close: () => closeHardDeleteModal(false) },
      {
        id: "snapshotRefreshModalBackdrop",
        close: () => closeSnapshotRefreshModal(false),
      },
      {
        id: "clearSelectedVendorModalBackdrop",
        close: () => closeClearSelectedVendorModal(false),
      },
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

function canAddIndentLine(indent) {
  if (!indent) return false;
  if (typeof canWriteModule === "function" && !canWriteModule()) return false;
  if (indent.source_pr_id) return false;
  const status = String(indent.status || "").toLowerCase();
  if (status === "closed" || status === "cancelled") return false;
  return status === "draft" || status === "approved" || status === "issued";
}

function getIndentAddLinePrBlockedMessage() {
  return "Lines for PR-linked indents must be changed through PR revision/resync.";
}

function getIndentMaterialClassPickerFilter(materialClassId) {
  const id = Number(materialClassId);
  if (id === 1) return { column: "is_rm", value: true };
  if (id === 2) return { column: "is_plm", value: true };
  if (id === 5) return { column: "is_ind", value: true };
  return null;
}

function materialClassIdFromCategoryCode(categoryCode) {
  const code = String(categoryCode || "").trim().toUpperCase();
  if (code === "RM") return 1;
  if (code === "PM" || code === "PLM") return 2;
  if (code === "IND") return 5;
  return null;
}

function mapIndentLineSaveError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  const code = String(error?.code || "");

  if (
    code === "23505" ||
    msg.includes("duplicate") ||
    msg.includes("already exists")
  ) {
    return "This item already exists in the indent. Edit the existing line instead.";
  }
  if (
    msg.includes("quantity") &&
    (msg.includes("<= 0") ||
      msg.includes("greater than zero") ||
      msg.includes("must be >"))
  ) {
    return "Requested quantity must be greater than zero.";
  }
  if (
    msg.includes("pr-linked") ||
    msg.includes("linked to a pr") ||
    (msg.includes("source_pr") && msg.includes("pr"))
  ) {
    return "This indent is linked to a PR. Update the PR and resync instead.";
  }
  if (msg.includes("inactive") && msg.includes("stock")) {
    return "This stock item is inactive and cannot be added.";
  }
  if (
    code === "23503" ||
    msg.includes("foreign key") ||
    msg.includes("violates foreign key")
  ) {
    return "Selected item or UOM is invalid. Please reselect.";
  }

  return error?.message || "Failed to save indent line.";
}

async function afterIndentLineSaved(indentId) {
  await loadIndentLines(indentId);
  await loadIndents();
  const updated = state.indentsRows.find(
    (row) => Number(row.indent_id) === Number(indentId),
  );
  if (updated) {
    state.selectedIndent = updated;
    renderIndentModalHeader(updated);
  }
  if (typeof loadActionQueue === "function") {
    await loadActionQueue();
  }
  if (typeof loadVendorBuylist === "function" && state.vwl?.loaded) {
    await loadVendorBuylist();
  }
}

function setIndentSourcePrBadge(indentRow) {
  const el = qs("indentSourcePrBadge");
  if (!el) return;

  const prNo = indentRow?.source_pr_number || indentRow?.source_pr_no || "";
  const prId = indentRow?.source_pr_id ?? null;

  if (prNo) {
    el.textContent = `Source PR: ${prNo}`;
    el.title = `Source PR ID: ${prId ?? "—"}`;
    setPillVariant(el, "pill-info");
    return;
  }

  if (prId) {
    el.textContent = `Source PR ID: ${prId}`;
    el.title = "Source PR number not loaded";
    setPillVariant(el, "pill-info");
    return;
  }

  el.textContent = "Source PR: —";
  el.title = "";
  setPillVariant(el, "pill-neutral");
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
  setPillVariant(qs("indentViewStatus"), statusPillClass(indent.status));
  const metaParts = [];
  if (indent.approved_date) metaParts.push(`Approved: ${indent.approved_date}`);
  if (indent.material_class_code)
    metaParts.push(`Class: ${displayMaterialClassCode(indent.material_class_code)}`);
  else if (indent.material_class_id)
    metaParts.push(`Class ID: ${indent.material_class_id}`);
  qs("indentViewMeta").textContent = metaParts.join(" · ");

  setIndentSourcePrBadge(indent);

  const hints = {
    draft: indent.source_pr_id
      ? "Draft — use PR revision and Resync for quantity corrections."
      : "Draft manual indent — add lines here, then Approve.",
    approved: "Approved — recommend/accept vendors, then issue to purchase.",
    issued:
      "Issued — fulfilment is in progress. Unselected lines can still be assigned vendors.",
    closed: "Closed — read-only.",
    cancelled: "Cancelled — read-only.",
  };
  let hint = hints[indent.status] ?? "";
  if (indent.source_pr_id && indent.status !== "closed" && indent.status !== "cancelled") {
    hint = `${hint} ${getIndentAddLinePrBlockedMessage()}`.trim();
  }
  qs("indentViewHint").textContent = hint;
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
  if (!canPerformEditAction("Create PR revision")) return;
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
  if (!canPerformEditAction("Set source PR")) return;
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
  requestAnimationFrame(() => qs("indentSourcePrPick")?.focus());
}

function closeIndentSourcePrModal() {
  const bd = qs("indentSourcePrModalBackdrop");
  if (!bd) return;
  hideModalBackdrop(bd, [qs("btnIndentSetSourcePr"), qs("iSearch")]);
}

async function confirmIndentSourcePr() {
  if (!canPerformEditAction("Set source PR")) return;
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
  if (!canPerformEditAction("Resync indent")) return;
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
  if (!canPerformEditAction("Resync indent")) return;
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
  requestAnimationFrame(() => qs("btnIndentViewClose")?.focus());
  loadIndentLines(row.indent_id);
}

function closeIndentViewModal() {
  closeProcurementFilterDrawer(qs("iLineFilterDrawer"));
  state.currentIndentId = null;
  hideModalBackdrop(qs("indentViewModalBackdrop"), [qs("iSearch")]);
  closeAllExportMenus();
}

function openVendorAcceptModeModal(indentArg) {
  if (!canPerformEditAction("Recommend and accept vendors")) return;
  const indent = indentArg || state.selectedIndent;

  if (!indent?.indent_id) {
    toast("Select an indent first.", "error");
    return;
  }

  if (!["approved", "issued"].includes(indent.status)) {
    toast(
      "Vendor recommendation is available only for approved or issued indents.",
      "error",
    );
    return;
  }

  const backdrop = qs("vendorAcceptModeModalBackdrop");
  if (!backdrop) return;

  backdrop.dataset.indentId = String(indent.indent_id);
  qs("vendorAcceptModeItem").textContent = indent.indent_number || "";

  const defaultMode = backdrop.querySelector(
    'input[name="vendorAcceptMode"][value="false"]',
  );
  if (defaultMode) defaultMode.checked = true;

  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => defaultMode?.focus());
}

function closeVendorAcceptModeModal() {
  hideModalBackdrop(qs("vendorAcceptModeModalBackdrop"), [
    qs("btnIndentRecommendAcceptVendors"),
    qs("iSearch"),
  ]);
}

async function confirmVendorAcceptMode() {
  if (!canPerformEditAction("Recommend and accept vendors")) return;
  const backdrop = qs("vendorAcceptModeModalBackdrop");
  const indentId = Number(backdrop?.dataset.indentId || 0);
  const clearSelectedInactive =
    backdrop?.querySelector('input[name="vendorAcceptMode"]:checked')?.value ===
    "true";

  if (!indentId) {
    toast("Select an indent first.", "error");
    return;
  }

  const indent =
    state.indentsRows?.find((r) => Number(r.indent_id) === indentId) ||
    state.selectedIndent;

  closeVendorAcceptModeModal();
  await recommendAndAcceptVendorsForIndent(indent, { clearSelectedInactive });
}

async function recommendAndAcceptVendorsForIndent(indentArg, options = null) {
  const indent = indentArg || state.selectedIndent;

  if (!options || typeof options.clearSelectedInactive !== "boolean") {
    if (!canPerformEditAction("Recommend and accept vendors")) return;
    openVendorAcceptModeModal(indent);
    return;
  }

  if (!canPerformEditAction("Recommend and accept vendors")) return;

  if (!indent?.indent_id) {
    toast("Select an indent first.", "error");
    return;
  }

  if (!["approved", "issued"].includes(indent.status)) {
    toast(
      "Vendor recommendation is available only for approved or issued indents.",
      "error",
    );
    return;
  }

  const clearSelectedInactive = options.clearSelectedInactive;

  const btn = qs("btnIndentRecommendAcceptVendors");

  try {
    if (btn) {
      btn.disabled = true;
    }
    setModalProcessing(
      "indentViewModalBackdrop",
      true,
      "Recommending and accepting vendors…",
    );

    let totalRecommended = 0;
    let totalAccepted = 0;
    let totalStaleCleared = 0;
    let totalInactiveSelectionsCleared = 0;
    let remainingUnselected = null;
    let batchesRun = 0;

    const batchSize = 25;
    const maxBatches = 20;

    for (let i = 0; i < maxBatches; i += 1) {
      batchesRun += 1;
      setModalProcessing(
        "indentViewModalBackdrop",
        true,
        `Processing batch ${batchesRun}…`,
      );

      const { data, error } = await supabase.rpc(
        "proc_indent_recommend_and_accept_vendors_step",
        {
          p_indent_id: indent.indent_id,
          p_limit: batchSize,
          p_reason: clearSelectedInactive
            ? "Recommended and accepted after clearing inactive selected vendors from indent modal"
            : "Recommended and accepted system L1 vendor from indent modal",
          p_clear_selected_inactive: clearSelectedInactive,
        },
      );

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;

      const candidateBatch = Number(row?.candidate_batch_count || 0);
      const recommended = Number(row?.recommended_count || 0);
      const accepted = Number(row?.accepted_count || 0);
      const staleCleared = Number(row?.stale_recommendations_cleared || 0);
      const inactiveSelectionsCleared = Number(
        row?.inactive_selections_cleared || 0,
      );
      remainingUnselected = Number(row?.remaining_open_unselected_count || 0);

      totalRecommended += recommended;
      totalAccepted += accepted;
      totalStaleCleared += staleCleared;
      totalInactiveSelectionsCleared += inactiveSelectionsCleared;

      if (remainingUnselected <= 0) break;
      if (
        candidateBatch === 0 &&
        accepted === 0 &&
        staleCleared === 0 &&
        inactiveSelectionsCleared === 0
      ) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    toast(
      `Vendor action completed. Accepted: ${totalAccepted}. ` +
        `Recommended: ${totalRecommended}. ` +
        `Inactive recommendations cleared: ${totalStaleCleared}. ` +
        `Inactive selected vendors cleared: ${totalInactiveSelectionsCleared}. ` +
        `Remaining unselected: ${remainingUnselected ?? "—"}.`,
      "success",
    );

    await loadIndents();

    const updated = state.indentsRows?.find(
      (r) => Number(r.indent_id) === Number(indent.indent_id),
    );

    if (updated) {
      state.selectedIndent = updated;
      renderIndentModalHeader(updated);
    }

    await loadIndentLines(indent.indent_id);

    if (typeof loadActionQueue === "function") {
      await loadActionQueue();
    }

    if (typeof reloadVendorBuylist === "function") {
      await reloadVendorBuylist();
    }
  } catch (e) {
    console.error("Recommend & accept vendors failed", e);
    toast(`Recommend & accept vendors failed: ${e.message || e}`, "error");
  } finally {
    setModalProcessing("indentViewModalBackdrop", false);

    if (btn) {
      btn.disabled = false;
    }
  }
}

function renderIndentLinesActions(indent) {
  // show/hide action buttons in the static iLinesActions toolbar
  const container = qs("iLinesActions");
  if (!container) return;
  // Remove old dynamic buttons (legacy), keep the static ones
  container
    .querySelectorAll("button.dynamic-action")
    .forEach((b) => b.remove());

  const btnAddLine = qs("iBtnAddLine");
  const btnEditQty = qs("iBtnEditLineQty");
  const isDraft = indent?.status === "draft";
  const canAdd = canAddIndentLine(indent);
  const isPrLinked = !!indent?.source_pr_id;
  const blockedMsg = getIndentAddLinePrBlockedMessage();

  if (btnAddLine) {
    if (canAdd) {
      btnAddLine.style.display = "";
      btnAddLine.disabled = false;
      btnAddLine.title = "Add Line";
      btnAddLine.setAttribute("aria-label", "Add Line");
    } else if (
      isPrLinked &&
      indent?.status !== "closed" &&
      indent?.status !== "cancelled"
    ) {
      btnAddLine.style.display = "";
      btnAddLine.disabled = true;
      btnAddLine.title = blockedMsg;
      btnAddLine.setAttribute("aria-label", blockedMsg);
    } else {
      btnAddLine.style.display = "none";
      btnAddLine.disabled = false;
      btnAddLine.title = "Add Line";
      btnAddLine.setAttribute("aria-label", "Add Line");
    }
  }

  if (btnEditQty) {
    btnEditQty.style.display = isDraft ? "none" : "";
    btnEditQty.disabled = !state.selectedIndentLine || isDraft;
  }

  // Status action buttons (approve / issue / close) — rendered dynamically
  // Remove previously injected status buttons
  container.querySelectorAll("button.status-action").forEach((b) => b.remove());
  container
    .querySelectorAll("button.vendor-bulk-action")
    .forEach((b) => b.remove());

  const makeIcon = (label, act, iconName, variant = "primary", id = "") => {
    const b = document.createElement("button");
    b.type = "button";
    b.classList.add("icon-btn", variant, "status-action");
    if (id) b.id = id;
    b.setAttribute("title", label);
    b.setAttribute("aria-label", label);
    b.innerHTML = svgIcon(iconName);
    b.addEventListener("click", () => openIndentActionModal(indent, act));
    markEditAction(b);
    container.appendChild(b);
  };
  const makeVendorBulkButton = () => {
    const b = document.createElement("button");
    b.type = "button";
    b.id = "btnIndentRecommendAcceptVendors";
    b.classList.add("icon-btn", "primary", "vendor-bulk-action");
    b.title = "Recommend & Accept Vendors";
    b.setAttribute(
      "aria-label",
      "Recommend and accept vendors for this indent",
    );

    b.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round"
        stroke-linejoin="round" aria-hidden="true">
        <path d="M20 6 9 17l-5-5"></path>
      </svg>
    `;

    b.addEventListener("click", () =>
      recommendAndAcceptVendorsForIndent(indent),
    );
    markEditAction(b);
    container.appendChild(b);
  };

  const s = indent.status;
  if (s === "approved" || s === "issued") {
    makeVendorBulkButton();
  }
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
  applyPermissionUi();
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
      <td>${esc(displayMaterialClassCode(row.material_class_code ?? ""))}</td>
      <td>${esc(row.uom_code ?? "")}</td>
      <td>${fmt(row.requested_qty)}</td>
      <td>${fmt(row.allocated_qty)}</td>
      <td>${fmt(row.remaining_qty)}</td>
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

function updateIndentLinesCountUi(total) {
  const countEl = qs("iLinesCount");
  if (!countEl) return;
  const shown = total ? Math.min(iLineVisibleCount, total) : 0;
  countEl.textContent = total ? `${shown} / ${total}` : "0 / 0";
  countEl.title = total
    ? `Showing ${shown} of ${total} lines`
    : "No matching lines";
}

function resetIndentLinesInfiniteScroll(resetScrollTop = true) {
  iLineVisibleCount = Math.max(0, iLinePageSize);
  if (!resetScrollTop) return;
  const scroller = qs("iLinesScroll");
  if (scroller) scroller.scrollTop = 0;
}

function renderIndentLinesInfinite(options = {}) {
  const { appendOnly = false } = options;
  const empty = qs("iLinesEmpty");
  const table = qs("iLinesTable");
  const tbody = qs("iLinesTbody");
  const total = iLineFilteredRows.length;
  if (iLineVisibleCount <= 0) {
    iLineVisibleCount = Math.max(0, iLinePageSize);
  }
  const shown = total ? Math.min(iLineVisibleCount, total) : 0;
  const rows = shown ? iLineFilteredRows.slice(0, shown) : [];

  if (!total) {
    empty.style.display = "";
    empty.textContent = state.indentLinesRows.length
      ? "No matching lines."
      : "No lines for this indent.";
    table.style.display = "none";
    tbody.innerHTML = "";
    updateIndentLinesCountUi(0);
    return;
  }

  empty.style.display = "none";
  table.style.display = "";

  const shouldAppend =
    appendOnly &&
    tbody.children.length > 0 &&
    tbody.children.length < rows.length;
  if (!shouldAppend) {
    renderIndentLines(rows);
  } else {
    const startAt = tbody.children.length;
    rows.slice(startAt).forEach((row, idx) => {
      const lineNo = startAt + idx + 1;
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
      <td>${esc(displayMaterialClassCode(row.material_class_code ?? ""))}</td>
      <td>${esc(row.uom_code ?? "")}</td>
      <td>${fmt(row.requested_qty)}</td>
      <td>${fmt(row.allocated_qty)}</td>
      <td>${fmt(row.remaining_qty)}</td>
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

  updateIndentLinesCountUi(total);
}

function maybeLoadMoreIndentLines() {
  const scroller = qs("iLinesScroll");
  if (!scroller) return;
  const total = iLineFilteredRows.length;
  if (!total || iLineVisibleCount >= total) return;
  const nearBottom =
    scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 80;
  if (!nearBottom) return;
  iLineVisibleCount = Math.min(iLineVisibleCount + iLinePageSize, total);
  renderIndentLinesInfinite({ appendOnly: true });
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
        r.source_stock_item_code,
        r.code,
        r.uom_code,
        r.material_class_code,
        r.material_class_label,
        r.source_category_label,
        r.source_subcategory_label,
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
  iLineFilteredRows = rows;
  resetIndentLinesInfiniteScroll(true);
  renderIndentLinesInfinite();
}

async function loadIndentLines(indentId) {
  setLoading(true);
  const { data, error } = await supabase
    .from(INDENT_LINES_ORDERED_VIEW)
    .select(
      "indent_line_id,indent_id,stock_item_id,stock_item_name,stock_item_code,code,material_class_code,material_class_label,uom_id,uom_code,requested_qty,allocated_qty,remaining_qty,resolved_vendor_name,resolved_rate,selected_vendor_name,selected_rate,recommended_vendor_name,recommended_rate,has_selected_vendor,source_pr_id,source_pr_line_id,source_pr_line_sort_no,source_pr_unmapped_sort,indent_line_sort_no,indent_line_sort_key,source_stock_item_code,source_category_label,source_subcategory_label",
    )
    .eq("indent_id", indentId)
    .order("indent_line_sort_no", { ascending: true })
    .order("indent_line_id", { ascending: true });
  setLoading(false);
  if (error) {
    toast(`Failed to load indent lines: ${error.message}`, "error");
    return;
  }
  state.indentLinesRows = data || [];
  iLineQuery = "";
  iLineFilter = "all";
  iLineVisibleCount = 0;
  iLineFilteredRows = [];
  const searchInput = qs("iLineSearch");
  const searchClear = qs("iLineSearchClear");
  const filterSelect = qs("iLineFilterSelect");
  const filterDrawer = qs("iLineFilterDrawer");
  const filterBtn = qs("iLineFilterBtn");
  if (searchInput) searchInput.value = "";
  if (searchClear) searchClear.style.display = "none";
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
      <td><span class="pill ${statusPillClass(row.status)}">${esc(row.status ?? "")}</span></td>
      <td>${esc(displayMaterialClassCode(row.material_class_code ?? ""))}</td>
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
  const pageSize = Number(state.pageSize || DEFAULT_PAGE_SIZE);
  if (_iPrev) _iPrev.disabled = state.indentsPage <= 0;
  if (_iNext) _iNext.disabled = _iCnt < pageSize;
  updateTabCount("tabCountIndents", _iCnt);
  updateExportButtonStates();
}

async function loadIndents() {
  setTabTableLoading("indents", true);
  try {
    const pageSize = Number(state.pageSize || DEFAULT_PAGE_SIZE);
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
        state.indentsPage * pageSize,
        state.indentsPage * pageSize + pageSize - 1,
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
  const actionLabels = {
    approve: "Approve indent",
    issue: "Issue indent",
    recommend_accept: "Recommend and accept vendors",
    close_strict: "Close indent",
    close_override: "Close indent with override",
  };
  if (!canPerformEditAction(actionLabels[action] || "This action")) return;
  const backdrop = qs("indentActionModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  const titles = {
    approve: "Approve Indent",
    issue: "Issue Indent",
    recommend_accept: "Recommend & Accept Vendors",
    close_strict: "Close Indent (Strict)",
    close_override: "Close Indent with Override",
  };
  const explain = {
    approve:
      "Confirming will mark this indent as approved with the selected approval date.",
    issue:
      "Confirming will mark this indent as issued and allow purchase fulfilment to proceed.",
    recommend_accept:
      "Confirming will open inactive vendor handling options before recommending and accepting available system L1 vendors for this indent.",
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
  const focusTarget =
    action === "approve"
      ? qs("indentApproveDate")
      : action === "close_override"
        ? qs("indentOverrideReason")
        : qs("btnIndentActionConfirm");
  requestAnimationFrame(() => focusTarget?.focus());
}

function closeIndentActionModal() {
  const backdrop = qs("indentActionModalBackdrop");
  hideModalBackdrop(backdrop, [qs("iSearch")]);
}

async function confirmIndentAction() {
  const backdrop = qs("indentActionModalBackdrop");
  const indentId = Number(backdrop.dataset.indentId);
  const action = backdrop.dataset.action;
  const actionLabels = {
    approve: "Approve indent",
    issue: "Issue indent",
    recommend_accept: "Recommend and accept vendors",
    close_strict: "Close indent",
    close_override: "Close indent with override",
  };
  if (!canPerformEditAction(actionLabels[action] || "This action")) return;
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
  } else if (action === "recommend_accept") {
    closeIndentActionModal();
    const indent =
      state.indentsRows.find((r) => Number(r.indent_id) === indentId) ||
      state.selectedIndent;
    await recommendAndAcceptVendorsForIndent(indent);
    return;
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

function getSnapshotStageCount(statusRow, stageCode) {
  const stages = Array.isArray(statusRow?.stages) ? statusRow.stages : [];
  const stage = stages.find((s) => s.stage_code === stageCode);
  return stage?.row_count ?? null;
}

function formatStagedSnapshotRefreshToast(statusRow) {
  const vendorCount = getSnapshotStageCount(statusRow, "01_VENDOR_CANDIDATES");
  const balanceCount = getSnapshotStageCount(statusRow, "02_INDENT_BALANCES");
  const priorityCount = getSnapshotStageCount(statusRow, "03_PRIORITY_SNAPSHOT");

  const parts = [];

  if (vendorCount != null) {
    parts.push(
      `Vendor candidates: ${Number(vendorCount).toLocaleString("en-IN")}`,
    );
  }

  if (balanceCount != null) {
    parts.push(
      `Indent balances: ${Number(balanceCount).toLocaleString("en-IN")}`,
    );
  }

  if (priorityCount != null) {
    parts.push(`Priorities: ${Number(priorityCount).toLocaleString("en-IN")}`);
  }

  return parts.length
    ? `Procurement snapshots refreshed. ${parts.join(". ")}.`
    : "Procurement snapshots refreshed.";
}

async function getSnapshotRefreshStatus(runId) {
  const { data, error } = await supabase.rpc(
    "proc_get_snapshot_refresh_status",
    {
      p_run_id: runId,
    },
  );

  if (error) throw error;

  return Array.isArray(data) ? data[0] : data;
}

async function processSnapshotRefreshUntilDone(runId, onStatus) {
  const maxAttempts = 12;

  for (let i = 0; i < maxAttempts; i += 1) {
    const { error: processError } = await supabase.rpc(
      "proc_process_snapshot_refresh_next_stage",
    );

    if (processError) throw processError;

    const statusRow = await getSnapshotRefreshStatus(runId);

    if (typeof onStatus === "function") onStatus(statusRow);

    if (statusRow?.status === "SUCCESS") {
      return statusRow;
    }

    if (statusRow?.status === "FAILED") {
      const err = new Error(statusRow?.message || "Snapshot refresh failed.");
      err.statusRow = statusRow;
      throw err;
    }

    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  throw new Error(
    "Snapshot refresh is still running. Please check status after a few seconds.",
  );
}

function showProcSnapshotRefreshOverlay() {
  const overlay = qs("procSnapshotRefreshOverlay");
  if (!overlay) return;
  overlay.hidden = false;
  overlay.classList.add("is-visible");
}

function hideProcSnapshotRefreshOverlay() {
  const overlay = qs("procSnapshotRefreshOverlay");
  if (!overlay) return;
  overlay.classList.remove("is-visible");
  overlay.hidden = true;
}

function renderProcSnapshotRefreshStages(statusRow) {
  const wrap = qs("procSnapshotRefreshStages");
  const msg = qs("procSnapshotRefreshMessage");
  if (!wrap) return;

  const stages = Array.isArray(statusRow?.stages) ? statusRow.stages : [];

  const fallbackStages = [
    {
      stage_code: "01_VENDOR_CANDIDATES",
      stage_label: "Refresh vendor candidate snapshot",
      status: "PENDING",
    },
    {
      stage_code: "02_INDENT_BALANCES",
      stage_label: "Refresh indent line balance snapshot",
      status: "PENDING",
    },
    {
      stage_code: "03_PRIORITY_SNAPSHOT",
      stage_label: "Refresh indent line priority snapshot",
      status: "PENDING",
    },
    {
      stage_code: "04_FINAL_STATUS_CHECK",
      stage_label: "Final snapshot status check",
      status: "PENDING",
    },
  ];

  const rows = stages.length ? stages : fallbackStages;

  wrap.innerHTML = rows
    .map((stage) => {
      const status = String(stage.status || "PENDING").toUpperCase();
      const count =
        stage.row_count == null
          ? ""
          : `${Number(stage.row_count).toLocaleString("en-IN")} rows`;

      const detail = count || stage.message || "";

      return `
        <div class="pec-refresh-stage" data-status="${esc(status)}">
          <div class="pec-refresh-stage-main">
            <span class="pec-refresh-stage-label">${esc(stage.stage_label || stage.stage_code || "")}</span>
            <span class="pec-refresh-stage-detail">${esc(detail)}</span>
          </div>
          <span class="pec-refresh-stage-pill">${esc(status)}</span>
        </div>
      `;
    })
    .join("");

  if (msg) {
    msg.textContent = statusRow?.message || "Refresh is running...";
  }
}

let snapshotRefreshResolve = null;

function closeSnapshotRefreshModal(result = false) {
  const backdrop = qs("snapshotRefreshModalBackdrop");
  if (!backdrop) return;
  hideModalBackdrop(backdrop, [qs("btnRefreshProcurementSnapshots")]);
  const resolve = snapshotRefreshResolve;
  snapshotRefreshResolve = null;
  if (typeof resolve === "function") resolve(result);
}

function confirmSnapshotRefresh() {
  const backdrop = qs("snapshotRefreshModalBackdrop");
  if (!backdrop) return Promise.resolve(false);

  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  setTimeout(() => qs("btnSnapshotRefreshConfirm")?.focus(), 0);

  return new Promise((resolve) => {
    snapshotRefreshResolve = resolve;
  });
}

function setProcSnapshotRefreshBusy(isBusy) {
  const btn = document.getElementById("btnRefreshProcurementSnapshots");
  if (!btn) return;

  btn.dataset.busy = isBusy ? "true" : "false";

  const canEdit =
    typeof canWriteModule === "function" ? canWriteModule() : true;

  btn.disabled = Boolean(isBusy) || !canEdit;

  btn.setAttribute("aria-busy", isBusy ? "true" : "false");
}

function unlockProcurementUiAfterSnapshotRefresh() {
  setProcSnapshotRefreshBusy(false);
  ["action", "pr", "indents", "vendor-buylist", "excess"].forEach(
    resetTabPanelLoadingState,
  );
  aqLoadingDepth = 0;
  setActionQueueLoading(false);
  document.querySelectorAll(".pec-search-wrap.is-searching").forEach((wrap) => {
    wrap.classList.remove("is-searching");
  });
}

async function reloadTabsAfterSnapshotRefresh(activeTab = state.tab) {
  const loaders = {
    action: () => loadActionQueue({ refreshIndentOptions: false }),
    pr: () => loadPrHeaders(),
    indents: () => loadIndents(),
    "vendor-buylist": () => loadVendorBuylist(),
  };

  const snapshotTabs = ["action", "indents", "vendor-buylist"];
  const ordered = [
    ...(loaders[activeTab] ? [activeTab] : []),
    ...snapshotTabs.filter((tab) => tab !== activeTab),
  ];

  for (const tab of ordered) {
    try {
      await loaders[tab]();
    } catch (err) {
      console.warn(`Post-snapshot reload failed for ${tab}`, err);
    }
  }
}

async function refreshProcurementSnapshotsManually() {
  if (!canPerformEditAction("Refresh procurement snapshots")) return;

  const btn = document.getElementById("btnRefreshProcurementSnapshots");

  // Guard against a duplicate click while a refresh is already running.
  if (btn?.dataset.busy === "true") return;

  const ok = await confirmSnapshotRefresh();
  if (!ok) return;

  try {
    setProcSnapshotRefreshBusy(true);

    showProcSnapshotRefreshOverlay();
    renderProcSnapshotRefreshStages(null);

    const { data, error } = await supabase.rpc(
      "proc_request_snapshot_refresh",
      {
        p_request_source: "manual_ui",
      },
    );

    if (error) throw error;

    const requestRow = Array.isArray(data) ? data[0] : data;
    const runId = requestRow?.run_id;

    if (!runId) {
      throw new Error("Refresh request did not return a run_id.");
    }

    const initialStatus = await getSnapshotRefreshStatus(runId);
    renderProcSnapshotRefreshStages(initialStatus);

    const statusRow = await processSnapshotRefreshUntilDone(
      runId,
      renderProcSnapshotRefreshStages,
    );

    renderProcSnapshotRefreshStages(statusRow);
    toast(formatStagedSnapshotRefreshToast(statusRow), "success");

    hideProcSnapshotRefreshOverlay();
    unlockProcurementUiAfterSnapshotRefresh();

    void reloadTabsAfterSnapshotRefresh(state.tab).catch((reloadErr) => {
      console.warn(
        "Snapshot refresh succeeded but post-refresh reload failed",
        reloadErr,
      );
      toast(
        "Snapshots refreshed, but one or more sections could not reload automatically.",
        "info",
      );
    });
  } catch (err) {
    console.error("Staged snapshot refresh failed", err);

    const msg =
      err?.message ||
      "Snapshot refresh failed. Check server status and console.";

    // Keep overlay visible so the user can see which stage failed.
    if (err?.statusRow) {
      renderProcSnapshotRefreshStages(err.statusRow);
    }
    const msgEl = qs("procSnapshotRefreshMessage");
    if (msgEl) msgEl.textContent = msg;

    toast(msg, "error");
  } finally {
    unlockProcurementUiAfterSnapshotRefresh();
  }
}

function wireSnapshotRefreshModalControls() {
  qs("btnSnapshotRefreshClose")?.addEventListener("click", () =>
    closeSnapshotRefreshModal(false),
  );
  qs("btnSnapshotRefreshCancel")?.addEventListener("click", () =>
    closeSnapshotRefreshModal(false),
  );
  qs("btnSnapshotRefreshConfirm")?.addEventListener("click", () =>
    closeSnapshotRefreshModal(true),
  );
  qs("snapshotRefreshModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "snapshotRefreshModalBackdrop") {
      closeSnapshotRefreshModal(false);
    }
  });

  qs("procSnapshotRefreshOverlay")?.addEventListener("click", (e) => {
    if (e.target.id === "procSnapshotRefreshOverlay") {
      hideProcSnapshotRefreshOverlay();
    }
  });
}

function wireProcurementSnapshotRefreshButton() {
  wireSnapshotRefreshModalControls();

  const btn = document.getElementById("btnRefreshProcurementSnapshots");
  if (!btn) return;

  if (btn.dataset.wired === "true") return;
  btn.dataset.wired = "true";

  btn.addEventListener("click", refreshProcurementSnapshotsManually);
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

  const iLineFilterBtn = qs("iLineFilterBtn");
  const iLineFilterDrawer = qs("iLineFilterDrawer");
  const iLineFilterSelect = qs("iLineFilterSelect");
  const iLinesScroll = qs("iLinesScroll");

  wireLiveSearchInput({
    inputId: "iLineSearch",
    clearId: "iLineSearchClear",
    onSearch: (query) => {
      iLineQuery = String(query || "")
        .trim()
        .toLowerCase();
      applyIndentLineFiltersAndRender();
    },
    debounceMs: 150,
  });

  if (iLineFilterBtn && iLineFilterDrawer) {
    iLineFilterBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = iLineFilterDrawer.classList.contains("open");
      if (isOpen) {
        closeFloatingFilterDrawer(iLineFilterBtn, iLineFilterDrawer);
      } else {
        openFloatingFilterDrawer(
          iLineFilterBtn,
          iLineFilterDrawer,
          iLineFilterSelect,
        );
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
        closeFloatingFilterDrawer(iLineFilterBtn, iLineFilterDrawer);
      }
    });
  }

  iLineFilterSelect?.addEventListener("change", () => {
    iLineFilter = iLineFilterSelect.value;
    syncIndentLineFilterBadge();
    applyIndentLineFiltersAndRender();
  });
  if (iLinesScroll && iLinesScroll.dataset.boundInfinite !== "1") {
    iLinesScroll.dataset.boundInfinite = "1";
    iLinesScroll.addEventListener("scroll", () => {
      maybeLoadMoreIndentLines();
    });
  }

  qs("btnIndentActionClose")?.addEventListener("click", closeIndentActionModal);
  qs("btnIndentActionCancel").addEventListener("click", closeIndentActionModal);
  qs("btnIndentActionConfirm").addEventListener("click", confirmIndentAction);
  qs("indentActionModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "indentActionModalBackdrop") closeIndentActionModal();
  });
  qs("btnVendorAcceptModeClose")?.addEventListener(
    "click",
    closeVendorAcceptModeModal,
  );
  qs("btnVendorAcceptModeCancel")?.addEventListener(
    "click",
    closeVendorAcceptModeModal,
  );
  qs("btnVendorAcceptModeConfirm")?.addEventListener(
    "click",
    confirmVendorAcceptMode,
  );
  qs("vendorAcceptModeModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "vendorAcceptModeModalBackdrop")
      closeVendorAcceptModeModal();
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
    if (!canAddIndentLine(state.selectedIndent)) {
      if (state.selectedIndent.source_pr_id) {
        toast(getIndentAddLinePrBlockedMessage(), "error");
      } else {
        toast("This indent cannot accept new lines in its current status.", "error");
      }
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

  qs("btnIndentSourcePrClose")?.addEventListener(
    "click",
    closeIndentSourcePrModal,
  );
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

  qs("btnIndentResyncClose")?.addEventListener(
    "click",
    closeIndentResyncModal,
  );
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
  qs("btnExportIndentClose")?.addEventListener("click", closeExportIndentModal);
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
  requestAnimationFrame(() => qs("btnWorkflowGuideClose")?.focus());
}

function closeWorkflowGuideModal() {
  const bd = qs("workflowGuideModalBackdrop");
  if (!bd) return;
  hideModalBackdrop(bd, [qs("workflowGuideBtn")]);
}

function wireGlobalHeaderControls() {
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
    .from(INDENT_LINES_ORDERED_VIEW)
    .select("*")
    .eq("indent_id", indentId)
    .order("indent_line_sort_no", { ascending: true })
    .order("indent_line_id", { ascending: true });
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

  // Build canonical pdfLines (named props for PDF renderer)
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
      qtyRequested: fmtFixed(l.requested_qty ?? "", 2),
      qtyInStock: fmtFixed(qtyInStock, 2),
      qtyToPurchase: fmtFixed(l.remaining_qty ?? l.requested_qty ?? "", 2),
      unitPrice:
        unitPriceRaw !== null && unitPriceRaw !== undefined
          ? fmtFixed(unitPriceRaw, 2)
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
  requestAnimationFrame(() => qs("expDeptUnit")?.focus());
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

    // Keep SN as a fixed code column so row numbers never wrap.
    const availableWidth = ctx.pageWidth - ctx.margin * 2;
    const snColWidth = 9;
    const remainingWidth = availableWidth - snColWidth;
    const weights = [
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
    const colW = [
      snColWidth,
      ...weights.map((w) => (remainingWidth * w) / weightSum),
    ];

    const columnStyles = {
      0: {
        cellWidth: colW[0],
        halign: "center",
        overflow: "visible",
        cellPadding: { top: 1.4, right: 0.6, bottom: 1.4, left: 0.6 },
      },
      1: { cellWidth: colW[1] },
      2: { cellWidth: colW[2] },
      3: { cellWidth: colW[3], halign: "center" },
      4: { cellWidth: colW[4], halign: "center" },
      5: {
        cellWidth: colW[5],
        halign: "right",
        overflow: "visible",
        cellPadding: { top: 1.4, right: 1, bottom: 1.4, left: 0.6 },
      },
      6: {
        cellWidth: colW[6],
        halign: "right",
        overflow: "visible",
        cellPadding: { top: 1.4, right: 1, bottom: 1.4, left: 0.6 },
      },
      7: {
        cellWidth: colW[7],
        halign: "right",
        overflow: "visible",
        cellPadding: { top: 1.4, right: 1, bottom: 1.4, left: 0.6 },
      },
      8: {
        cellWidth: colW[8],
        halign: "right",
        overflow: "visible",
        cellPadding: { top: 1.4, right: 1, bottom: 1.4, left: 0.6 },
      },
      9: { cellWidth: colW[9] },
      10: { cellWidth: colW[10] },
    };

    tableHead[0] = tableHead[0].map((label, index) =>
      formatHeaderLabel(label, colW[index]),
    );

    // Draw table. AutoTable repeats only the column header on later pages.
    headerEngine.drawHeader(doc, ctx);

    doc.autoTable({
      theme: "grid",
      showHead: "everyPage",
      head: tableHead,
      body: tableBody,
      startY: HEADER_H,
      margin: { top: margin, left: margin, right: margin, bottom: FOOTER_H },
      styles: {
        fontSize: 7.6,
        cellPadding: 1.45,
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
        fontSize: 7.6,
        halign: "center",
        valign: "middle",
      },
      columnStyles,
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
    doc.text("Prepared By", margin + colWidth / 2, sigY + 4, {
      align: "center",
    });
    doc.text("Verified By", margin + colWidth + colWidth / 2, sigY + 4, {
      align: "center",
    });
    doc.text("Approved By", margin + 2 * colWidth + colWidth / 2, sigY + 4, {
      align: "center",
    });

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
  if (!canPerformEditAction("Create indent")) return;
  const backdrop = qs("createIndentModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => qs("ciIndentNumber")?.focus());
  qs("ciIndentDate").value = new Date().toISOString().slice(0, 10);
  qs("ciIndentNumber").value = "";
  qs("ciMaterialClass").value = "";
  qs("ciNotes").value = "";
}

function closeCreateIndentModal() {
  hideModalBackdrop(qs("createIndentModalBackdrop"), [qs("iBtnNewDraft")]);
}

async function saveCreateIndent() {
  if (!canPerformEditAction("Create indent")) return;
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

async function openIndentFromPrModal(options = {}) {
  if (!canPerformEditAction("Create indent from PR")) return;
  const { preselectedPrId = null } = options;
  // Load active PRs
  setLoading(true);
  const { data, error } = await supabase
    .from(PR_HEADER_VIEW)
    .select(
      "pr_id, pr_number, effective_from_date, horizon_start_month, horizon_end_month, material_class_id, material_class_code, material_class_label, material_class_display, rm_scope, rm_scope_label",
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
    opt.textContent = `${pr.pr_number} | ${pr.effective_from_date ?? ""} | Class: ${prClassText(pr)} | Scope: ${prScopeText(pr)}`;
    pick.appendChild(opt);
  }
  if (!pick.options.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No active PRs found";
    pick.appendChild(opt);
  }
  if (preselectedPrId) {
    pick.value = String(preselectedPrId);
  }
  qs("ifpIndentNumber").value = "";
  const backdrop = qs("indentFromPrModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => qs("ifpPrPick")?.focus());
}

function closeIndentFromPrModal() {
  hideModalBackdrop(qs("indentFromPrModalBackdrop"), [qs("iBtnFromPR")]);
}

async function saveIndentFromPr() {
  if (!canPerformEditAction("Create indent from PR")) return;
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
  if (qs("prViewModalBackdrop")?.classList.contains("show")) {
    closePrViewModal();
  }
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
      displayMaterialClassCode(item.category_code) ||
      (item.category_id === 1
        ? "RM"
        : item.category_id === 2
          ? "PM"
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
    if (!item.default_uom_id) {
      toast("This stock item has no default UOM and cannot be added.", "error");
      return;
    }

    backdrop.dataset.stockItemId = String(item.stock_item_id);
    backdrop.dataset.uomId = String(item.default_uom_id);
    backdrop.dataset.uomCode = item.default_uom_code || "";

    const code = item.stock_item_code ?? "";
    const name = item.stock_item_name ?? "";
    input.value = code ? `${code} — ${name}` : name;

    currentItems = [];
    highlighted = -1;
    results.innerHTML = "";
    results.classList.remove("show");
    input.setAttribute("aria-expanded", "false");

    qs("ialUomText").textContent =
      item.default_uom_code ||
      (await fetchUomCode(item.default_uom_id));

    const indentClass = state.selectedIndent?.material_class_id ?? null;
    const selectedClass = qs("ialMaterialClass").value || "";
    const materialClassId =
      indentClass ||
      (selectedClass ? Number(selectedClass) : null) ||
      materialClassIdFromCategoryCode(item.category_code);

    if (materialClassId) {
      backdrop.dataset.materialClassId = String(materialClassId);
      if (!indentClass && selectedClass) {
        qs("ialMaterialClass").value = String(materialClassId);
      }
    }

    if (indentClass || selectedClass || materialClassId) {
      qs("ialMaterialClass").disabled = true;
    }

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

    const indentClass = state.selectedIndent?.material_class_id ?? null;
    const classVal = indentClass || qs("ialMaterialClass").value || null;
    if (!classVal) {
      results.innerHTML = "";
      const li = document.createElement("li");
      li.className = "no-results";
      li.textContent = "Select a material class first.";
      results.appendChild(li);
      results.classList.add("show");
      input.setAttribute("aria-expanded", "true");
      return;
    }

    let req = supabase
      .from("v_stock_item_picker")
      .select(
        "stock_item_id,stock_item_code,stock_item_name,default_uom_id,default_uom_code,category_code,is_rm,is_plm,is_ind",
      )
      .eq("active", true)
      .or(`stock_item_name.ilike.%${q}%,stock_item_code.ilike.%${q}%`)
      .order("stock_item_name", { ascending: true })
      .limit(50);

    const classFilter = getIndentMaterialClassPickerFilter(classVal);
    if (classFilter) req = req.eq(classFilter.column, classFilter.value);

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
      const classLabel = item.category_code ?? "";
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      li.dataset.idx = String(idx);
      li.innerHTML = `<b>${esc(item.stock_item_code ?? "")}</b> — ${esc(item.stock_item_name ?? "")} <span style="opacity:0.5;font-size:11px">${esc(classLabel)}</span>`;
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
    backdrop.dataset.uomCode = "";
    backdrop.dataset.materialClassId = "";
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
    backdrop.dataset.uomCode = "";
    backdrop.dataset.materialClassId = "";
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
  qs("btnIndentAddLineClose")?.addEventListener("click", closeIndentAddLineModal);
  qs("stockPickerModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "stockPickerModalBackdrop") closeStockItemPicker();
  });
  qs("stockPickerSearch").addEventListener(
    "input",
    debounce((e) => runStockPickerSearch(e.target.value), 250),
  );
}

function openIndentAddLineModal(existingLine) {
  if (!canPerformEditAction(existingLine ? "Edit indent line" : "Add indent line")) return;
  const backdrop = qs("indentAddLineModalBackdrop");
  const indent = state.selectedIndent;
  if (!existingLine && !canAddIndentLine(indent)) {
    if (indent?.source_pr_id) {
      toast(getIndentAddLinePrBlockedMessage(), "error");
    } else {
      toast("This indent cannot accept new lines in its current status.", "error");
    }
    return;
  }

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
    classSelect.disabled = true;
  } else {
    classRow.style.display = "";
    classSelect.value = "";
    classSelect.disabled = false;
  }

  // Reset state
  backdrop.dataset.stockItemId = "";
  backdrop.dataset.uomId = "";
  backdrop.dataset.uomCode = "";
  backdrop.dataset.materialClassId = "";
  backdrop.dataset.existingLineId = "";
  itemInput.value = "";
  itemInput.disabled = false;
  itemInput.setAttribute("aria-expanded", "false");
  itemResults.innerHTML = "";
  itemResults.classList.remove("show");
  qs("ialUomText").textContent = "—";
  qs("ialQty").value = "";
  qs("ialReason").value = "";
  if (itemHelper)
    itemHelper.textContent = indentClass
      ? "Type to search and pick a stock item."
      : "Select material class, then search for a stock item.";

  if (existingLine) {
    // In edit mode: lock item, only allow qty change
    backdrop.dataset.stockItemId = String(existingLine.stock_item_id ?? "");
    backdrop.dataset.uomId = String(existingLine.uom_id ?? "");
    backdrop.dataset.uomCode = existingLine.uom_code ?? "";
    backdrop.dataset.materialClassId = String(
      existingLine.material_class_id ??
        indent?.material_class_id ??
        materialClassIdFromCategoryCode(existingLine.material_class_code) ??
        "",
    );
    backdrop.dataset.existingLineId = String(existingLine.indent_line_id ?? "");
    const itemCode = existingLine.stock_item_code ?? existingLine.code ?? "";
    const itemName = existingLine.stock_item_name ?? "";
    itemInput.value = itemCode
      ? `${itemCode} — ${itemName}`
      : itemName || `Item #${existingLine.stock_item_id}`;
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
  if (!canPerformEditAction("Save indent line")) return;
  if (!state.selectedIndent) {
    toast("No indent selected.", "error");
    return;
  }
  if (!canAddIndentLine(state.selectedIndent)) {
    if (state.selectedIndent.source_pr_id) {
      toast(getIndentAddLinePrBlockedMessage(), "error");
    } else {
      toast("This indent cannot accept new lines in its current status.", "error");
    }
    return;
  }

  const backdrop = qs("indentAddLineModalBackdrop");
  const indentId = state.selectedIndent.indent_id;
  const stockItemId = Number(backdrop.dataset.stockItemId || "0");
  const uomId = Number(backdrop.dataset.uomId || "0");
  const qty = Number((qs("ialQty").value || "").trim());
  const reason = (qs("ialReason").value || "").trim() || null;

  const indentClass = state.selectedIndent.material_class_id ?? null;
  const materialClassId = Number(
    indentClass ||
      backdrop.dataset.materialClassId ||
      qs("ialMaterialClass").value ||
      0,
  );

  if (!materialClassId) {
    toast("Material class is required.", "error");
    return;
  }
  if (!stockItemId) {
    toast("Select a stock item.", "error");
    return;
  }
  if (!uomId) {
    toast("UOM could not be determined. Re-select the stock item.", "error");
    return;
  }
  if (!qty || qty <= 0) {
    toast("Requested quantity must be greater than zero.", "error");
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
    toast(mapIndentLineSaveError(error), "error");
    return;
  }
  toast("Line added to indent.", "success");
  closeIndentAddLineModal();
  state.selectedIndentLine = null;
  const btnEditQty = qs("iBtnEditLineQty");
  if (btnEditQty) btnEditQty.disabled = true;
  await afterIndentLineSaved(indentId);
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
      <td><span class="pill ${statusPillClass(row.status)}">${esc(row.status ?? "")}</span></td>
      <td>${esc(row.effective_from_date ?? "")}</td>
      <td class="muted">${esc(horizonStr)}</td>
      <td>${esc(prClassText(row))}</td>
      <td>${esc(prScopeText(row))}</td>
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
  const pageSize = Number(state.pageSize || DEFAULT_PAGE_SIZE);
  if (_prPrev) _prPrev.disabled = state.prPage <= 0;
  if (_prNext) _prNext.disabled = _prCnt < pageSize;
  updateTabCount("tabCountPr", _prCnt);
}

async function loadPrHeaders() {
  setTabTableLoading("pr", true);
  try {
    const pageSize = Number(state.pageSize || DEFAULT_PAGE_SIZE);
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
        state.prPage * pageSize,
        state.prPage * pageSize + pageSize - 1,
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
  const isEditable = isDraft && canWriteModule();
  const requestedQtyNum = Number(row.requested_qty || 0);
  const deltaQtyNum = Number(row.manual_delta_qty || 0);
  const finalQtyNum = requestedQtyNum + deltaQtyNum;
  const reasonText = row.manual_reason ?? "";
  return `
    <tr data-pr-line-id="${esc(row.pr_line_id)}" ${isEditable ? "" : 'class="locked-row"'}>
      <td>${esc(row.stock_item_name ?? row.stock_item_code ?? row.code ?? String(row.stock_item_id ?? ""))}</td>
      <td>${esc(
        displayMaterialClassCode(row.material_class_code) ||
          row.category_label ||
          row.subcategory_label ||
          "",
      )}</td>
      <td>${esc(row.uom_code ?? "")}</td>
      <td>${fmtQty(row.system_suggested_qty)}</td>
      <td>${fmtQty(requestedQtyNum)}</td>
      <td data-col="delta">${fmtQty(deltaQtyNum)}</td>
      <td>
        ${
          isEditable
            ? `<input
                class="pr-line-inline-input qty"
                type="number"
                min="0"
                step="any"
                data-field="final_qty"
                data-line-id="${esc(row.pr_line_id)}"
                data-requested="${esc(requestedQtyNum)}"
                data-old="${esc(qtyInputValue(finalQtyNum))}"
                value="${esc(qtyInputValue(finalQtyNum))}"
              />`
            : `<span>${fmtQty(finalQtyNum)}</span>`
        }
      </td>
      <td>
        ${
          isEditable
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
  const shown = total ? Math.min(prLineVisibleCount, total) : 0;
  if (rangeEl) {
    rangeEl.textContent = total ? `${shown} / ${total}` : "0 / 0";
    rangeEl.title = total
      ? `Showing ${shown} of ${total} lines`
      : "No matching lines";
  }
  if (prevBtn) prevBtn.disabled = true;
  if (nextBtn) nextBtn.disabled = shown >= total;
}

function resetPrLinesInfiniteScroll(resetScrollTop = true) {
  prLineVisibleCount = Math.max(0, prLinePageSize);
  if (!resetScrollTop) return;
  const scroller = qs("prLinesScroll");
  if (scroller) scroller.scrollTop = 0;
}

function maybeLoadMorePrLines() {
  const scroller = qs("prLinesScroll");
  if (!scroller) return;
  const total = prLineFiltered.length;
  if (!total || prLineVisibleCount >= total) return;
  const nearBottom =
    scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 80;
  if (!nearBottom) return;
  prLineVisibleCount = Math.min(prLineVisibleCount + prLinePageSize, total);
  renderPrLinesPage({ appendOnly: true });
}

function renderPrLinesPage(options = {}) {
  const { appendOnly = false } = options;
  const empty = qs("prLinesEmpty");
  const table = qs("prLinesTable");
  const tbody = qs("prLinesTbody");
  const isDraft = state.selectedPr?.status === "draft";
  const total = prLineFiltered.length;
  if (prLineVisibleCount <= 0) {
    prLineVisibleCount = Math.max(0, prLinePageSize);
  }
  const shown = total ? Math.min(prLineVisibleCount, total) : 0;
  const rows = shown ? prLineFiltered.slice(0, shown) : [];
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
  const shouldAppend =
    appendOnly &&
    tbody.children.length > 0 &&
    tbody.children.length < rows.length &&
    Array.isArray(rows);
  if (shouldAppend) {
    const startAt = tbody.children.length;
    const appendRows = rows.slice(startAt);
    if (appendRows.length) {
      tbody.insertAdjacentHTML(
        "beforeend",
        appendRows.map((row) => renderPrLineRowHtml(row, isDraft)).join(""),
      );
    }
  } else {
    tbody.innerHTML = rows
      .map((row) => renderPrLineRowHtml(row, isDraft))
      .join("");
  }

  if (pendingPrQtyFocusLineId) {
    requestAnimationFrame(() => {
      const target = document.querySelector(
        `.pr-line-inline-input.qty[data-line-id="${pendingPrQtyFocusLineId}"]`,
      );
      if (target instanceof HTMLInputElement) {
        target.focus();
        target.select();
        target.scrollIntoView({ block: "nearest" });
      }
      pendingPrQtyFocusLineId = null;
    });
  }
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
  if (!canWriteModule()) return;
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
  if (!canWriteModule()) return;
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

function setPrActiveQtyRow(inputEl) {
  const tbody = qs("prLinesTbody");
  if (!tbody) return;
  tbody
    .querySelectorAll("tr.pr-active-qty-row")
    .forEach((row) => row.classList.remove("pr-active-qty-row"));
  if (!(inputEl instanceof HTMLInputElement)) return;
  if (inputEl.dataset.field !== "final_qty") return;
  const row = inputEl.closest("tr");
  if (row) row.classList.add("pr-active-qty-row");
}

function focusAdjacentPrFinalQty(currentInput, direction) {
  if (!(currentInput instanceof HTMLInputElement)) return;
  if (currentInput.dataset.field !== "final_qty") return;
  const currentLineId = Number(currentInput.dataset.lineId || "0");
  if (
    !currentLineId ||
    !Array.isArray(prLineFiltered) ||
    !prLineFiltered.length
  ) {
    return;
  }

  const currentIndex = prLineFiltered.findIndex(
    (row) => Number(row.pr_line_id) === currentLineId,
  );
  if (currentIndex < 0) return;

  const targetIndex = currentIndex + direction;
  if (targetIndex < 0 || targetIndex >= prLineFiltered.length) return;

  const targetLineId = Number(prLineFiltered[targetIndex]?.pr_line_id || "0");
  if (!targetLineId) return;
  pendingPrQtyFocusLineId = targetLineId;

  if (targetIndex >= prLineVisibleCount) {
    prLineVisibleCount = Math.min(prLineFiltered.length, targetIndex + 1);
    renderPrLinesPage({ appendOnly: true });
  }

  requestAnimationFrame(() => {
    const target = document.querySelector(
      `.pr-line-inline-input.qty[data-line-id="${targetLineId}"]`,
    );
    if (target instanceof HTMLInputElement) {
      target.focus();
      target.select();
      target.scrollIntoView({ block: "nearest" });
      pendingPrQtyFocusLineId = null;
    }
  });
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
      if (isOpen) {
        closeFloatingFilterDrawer(filterBtn, filterDrawer);
      } else {
        openFloatingFilterDrawer(filterBtn, filterDrawer, filterSelect);
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
        closeFloatingFilterDrawer(filterBtn, filterDrawer);
      }
    });
  }

  if (filterSelect) {
    filterSelect.value = prLineFilterValue;
    filterSelect.addEventListener("change", () => {
      prLineFilterValue = filterSelect.value;
      syncPrLineFilterBadge();
      applyPrLineFiltersAndRender();
    });
  }
  const commitInlineEdit = async (inputEl) => {
    if (!(inputEl instanceof HTMLInputElement)) return false;
    if (inputEl.disabled) return false;
    if (!canPerformEditAction("Edit PR line")) return false;
    const rowId = Number(inputEl.dataset.lineId || "0");
    const field = inputEl.dataset.field || "";
    const row = prLineAll.find((item) => Number(item.pr_line_id) === rowId);
    if (!row || !field) return false;

    const oldValue = inputEl.dataset.old ?? "";
    const newValue = inputEl.value.trim();
    if (normalize(oldValue) === normalize(newValue)) return true;

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
        inputEl.value = qtyInputValue(newFinalQty);
        inputEl.dataset.old = qtyInputValue(newFinalQty);
        // Sync reason input's data-old so change-detection stays accurate
        if (reasonInput instanceof HTMLInputElement) {
          reasonInput.dataset.old = reasonInput.value;
        }
      } else if (field === "reason") {
        await commitReason(rowId, newValue);
        inputEl.dataset.old = newValue;
      }
      renderPrLinesPage();
      return true;
    } catch (err) {
      inputEl.value = oldValue;
      const message = err?.message || "Save failed.";
      toast(message, "error");
      return false;
    } finally {
      setInlineCellSaving(inputEl, false);
    }
  };

  tbody.addEventListener("focusin", (e) => {
    const inputEl = e.target.closest("input[data-field]");
    if (!inputEl) return;
    inputEl.dataset.old = inputEl.value;
    setPrActiveQtyRow(inputEl);
  });

  tbody.addEventListener("focusout", (e) => {
    const inputEl = e.target.closest("input[data-field]");
    if (!inputEl) return;
    commitInlineEdit(inputEl);
    requestAnimationFrame(() => setPrActiveQtyRow(document.activeElement));
  });

  tbody.addEventListener("keydown", async (e) => {
    const inputEl = e.target.closest("input[data-field]");
    if (!inputEl) return;
    if (e.key === "Enter") {
      e.preventDefault();
      const isFinalQty = inputEl.dataset.field === "final_qty";
      const dir = e.shiftKey ? -1 : 1;
      if (isFinalQty) {
        const ok = await commitInlineEdit(inputEl);
        if (ok) {
          focusAdjacentPrFinalQty(inputEl, dir);
        }
      } else {
        inputEl.blur();
      }
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
        row.stock_item_code ?? "",
        displayMaterialClassCode(row.material_class_code ?? ""),
        row.category_label ?? "",
        row.subcategory_label ?? "",
        row.group_label ?? "",
        row.subgroup_label ?? "",
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
    } else if (filter === "nonzero_suggested") {
      if (Number(row.system_suggested_qty ?? 0) === 0) return false;
    } else if (filter === "jit_only") {
      const mode = normalizeRmProcurementMode(row);
      if (mode !== "jit") return false;
    } else if (filter === "normal_only") {
      const mode = normalizeRmProcurementMode(row);
      if (mode !== "normal") return false;
    }

    return true;
  });

  resetPrLinesInfiniteScroll(true);
  renderPrLinesPage();
}

async function loadPrLines(prId) {
  if (!prId) return;
  setLoading(true);
  const { data, error } = await supabase
    .from(PR_LINES_ORDERED_VIEW)
    .select(
      [
        "pr_line_id",
        "pr_id",
        "stock_item_id",
        "stock_item_name",
        "stock_item_code",
        "material_class_id",
        "material_class_code",
        "material_class_label",
        "uom_id",
        "uom_code",
        "system_suggested_qty",
        "requested_qty",
        "manual_delta_qty",
        "manual_reason",
        "final_requested_qty",
        "rm_procurement_mode",
        "stock_item_rm_procurement_mode",
        "category_label",
        "subcategory_label",
        "group_label",
        "subgroup_label",
        "line_sort_no",
        "line_sort_key",
      ].join(","),
    )
    .eq("pr_id", prId)
    .order("line_sort_no", { ascending: true })
    .order("pr_line_id", { ascending: true });
  setLoading(false);
  if (error) {
    toast(`Failed to load PR lines: ${error.message}`, "error");
    return;
  }
  prLineAll = data || [];
  state.prLinesRows = prLineAll;
  resetPrLinesInfiniteScroll(true);
  applyPrLineFiltersAndRender();
}

function openPrRebuildModal() {
  if (!canPerformEditAction("Rebuild PR from MRP")) return;
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
  if (!canPerformEditAction("Rebuild PR from MRP")) return;
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
  setPillVariant(qs("prDetailStatus"), statusPillClass(row.status));
  const horizonStr = row.horizon_start_month
    ? `${row.horizon_start_month.slice(0, 7)}${row.horizon_end_month ? ` – ${row.horizon_end_month.slice(0, 7)}` : ""}`
    : "";
  const metaParts = [];
  if (row.effective_from_date)
    metaParts.push(`Eff. from: ${row.effective_from_date}`);
  if (horizonStr) metaParts.push(`Horizon: ${horizonStr}`);
  metaParts.push(`Class: ${prClassText(row)}`);
  metaParts.push(`Scope: ${prScopeText(row)}`);
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
  applyPermissionUi();
}

function openPrViewModal(row, options = {}) {
  const { reloadLines = true } = options;
  lastFocusedBeforePrViewModal =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  refreshPrViewModal(row);
  const prLineSearch = qs("prLineSearch");
  const prLineSearchClear = qs("prLineSearchClear");
  const prLineFilter = qs("prLineFilter");
  const prLinePageSizeEl = qs("prLinePageSize");
  if (prLineSearch) prLineSearch.value = "";
  if (prLineSearchClear) prLineSearchClear.style.display = "none";
  if (prLineFilter) prLineFilter.value = "all";
  if (prLinePageSizeEl) prLinePageSizeEl.value = "50";
  prLinePageSize = 50;
  prLineVisibleCount = 0;
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

function toSafeFilenamePart(value, fallback = "export") {
  const raw = String(value ?? "").trim();
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned || fallback;
}

function buildPrFormExportRows(pr) {
  const lines = Array.isArray(prLineFiltered) ? prLineFiltered : [];
  const horizonStr = pr.horizon_start_month
    ? `${pr.horizon_start_month.slice(0, 7)}${pr.horizon_end_month ? ` – ${pr.horizon_end_month.slice(0, 7)}` : ""}`
    : "—";
  const classText = prClassText(pr);
  const scopeText = prScopeText(pr);

  const tableRows = lines.map((row, i) => ({
    sn: i + 1,
    item: row.stock_item_name ?? String(row.stock_item_id ?? ""),
    materialClass: row.material_class_code ?? "",
    uom: row.uom_code ?? "",
    systemSuggested: fmtQty(row.system_suggested_qty),
    requested: fmtQty(row.requested_qty),
    delta: fmtQty(row.manual_delta_qty),
    finalRequested: fmtQty(row.final_requested_qty),
    reason: row.manual_reason ?? "",
  }));

  return {
    horizonStr,
    classText,
    scopeText,
    tableRows,
    generatedAt: new Date().toLocaleString(),
  };
}

function exportPrFormCsv(pr) {
  const { tableRows, classText, scopeText } = buildPrFormExportRows(pr);
  if (!tableRows.length) {
    toast("No PR lines available to export.", "error");
    return;
  }

  const rows = tableRows.map((row) => ({
    PR_Number: pr.pr_number ?? "",
    Material_Class: classText,
    Scope: scopeText,
    SN: row.sn,
    Item: row.item,
    Class: row.materialClass,
    UOM: row.uom,
    Sys_Suggested: row.systemSuggested,
    Requested: row.requested,
    Delta: row.delta,
    Final: row.finalRequested,
    Reason: row.reason,
  }));
  const headers = [
    "PR_Number",
    "Material_Class",
    "Scope",
    "SN",
    "Item",
    "Class",
    "UOM",
    "Sys_Suggested",
    "Requested",
    "Delta",
    "Final",
    "Reason",
  ];

  const stamp = makeExportTimestamp();
  const namePart = toSafeFilenamePart(pr.pr_number, `pr_${pr.pr_id ?? "form"}`);
  downloadText(
    `${namePart}_${stamp}.csv`,
    toCsv(rows, headers),
    "text/csv;charset=utf-8;",
  );
  toast("PR CSV exported.", "success");
}

function exportPrFormPdf(pr) {
  if (typeof jspdf === "undefined") {
    toast("PDF library not available. Please reload the page.", "error");
    return;
  }

  const { horizonStr, classText, scopeText, tableRows, generatedAt } =
    buildPrFormExportRows(pr);
  if (!tableRows.length) {
    toast("No PR lines available to export.", "error");
    return;
  }

  try {
    const { jsPDF } = jspdf;
    const doc = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
    });

    const margin = 12;
    let y = 14;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`Purchase Requisition: ${pr.pr_number ?? ""}`, margin, y);

    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `Status: ${pr.status ?? ""} | Effective from: ${pr.effective_from_date ?? "—"} | Horizon: ${horizonStr}`,
      margin,
      y,
    );

    y += 4.5;
    doc.text(
      `Material Class: ${classText} | Scope: ${scopeText} | Generated: ${generatedAt}`,
      margin,
      y,
    );

    if (pr.notes) {
      y += 4.5;
      const notes = doc.splitTextToSize(`Notes: ${String(pr.notes)}`, 180);
      doc.text(notes, margin, y);
      y += notes.length * 3.8;
    }

    doc.autoTable({
      head: [
        [
          "#",
          "Item",
          "Class",
          "UOM",
          "Sys. Sug.",
          "Requested",
          "Delta",
          "Final",
          "Reason",
        ],
      ],
      body: tableRows.map((row) => [
        String(row.sn),
        String(row.item ?? ""),
        String(row.materialClass ?? ""),
        String(row.uom ?? ""),
        String(row.systemSuggested ?? ""),
        String(row.requested ?? ""),
        String(row.delta ?? ""),
        String(row.finalRequested ?? ""),
        String(row.reason ?? ""),
      ]),
      startY: y + 4,
      margin: { left: margin, right: margin },
      tableWidth: "auto",
      styles: {
        fontSize: 7.6,
        cellPadding: 1.6,
        lineColor: [60, 60, 60],
        lineWidth: 0.1,
        textColor: [20, 20, 20],
        overflow: "linebreak",
        valign: "middle",
      },
      headStyles: {
        fillColor: false,
        textColor: [20, 20, 20],
        lineColor: [60, 60, 60],
        lineWidth: 0.1,
        fontStyle: "bold",
        valign: "middle",
        minCellHeight: 7,
      },
      rowPageBreak: "avoid",
      theme: "grid",
      columnStyles: {
        0: { halign: "center", cellWidth: 8 },
        1: { cellWidth: 41 },
        2: { cellWidth: 14 },
        3: { cellWidth: 12 },
        4: { halign: "right", cellWidth: 16 },
        5: { halign: "right", cellWidth: 18 },
        6: { halign: "right", cellWidth: 14 },
        7: { halign: "right", cellWidth: 14 },
        8: { cellWidth: 41 },
      },
    });

    const pageCount = doc.internal.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
      doc.setPage(pageNum);
      doc.text(
        `Page ${pageNum} of ${pageCount}`,
        pageWidth - margin,
        pageHeight - 6,
        { align: "right" },
      );
    }

    const stamp = makeExportTimestamp();
    const namePart = toSafeFilenamePart(
      pr.pr_number,
      `pr_${pr.pr_id ?? "form"}`,
    );
    doc.save(`${namePart}_${stamp}.pdf`);
    toast("PR PDF exported.", "success");
  } catch (err) {
    toast(`Failed to export PR PDF: ${err.message || err}`, "error");
  }
}

function closePrViewModal() {
  closeProcurementFilterDrawer(qs("prLineFilterDrawer"));
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
  if (!canPerformEditAction("Generate PR")) return;
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
  if (!canPerformEditAction("Create indent from PR")) return;
  if (!state.selectedPr) {
    toast("No PR selected.", "error");
    return;
  }
  if (state.selectedPr.status !== "active") {
    toast("PR must be active to create an indent.", "error");
    return;
  }
  await openIndentFromPrModal({ preselectedPrId: state.selectedPr.pr_id });
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
  if (!canPerformEditAction("Generate PR")) return;
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
  if (!canPerformEditAction("Add PR line")) return;
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
  if (!canPerformEditAction("Add PR line")) return;
  if (!state.selectedPr) {
    toast("No PR selected.", "error");
    return;
  }
  const prId = Number(state.selectedPr.pr_id || 0);
  if (!prId) {
    toast("Invalid PR selection.", "error");
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
    p_pr_id: prId,
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

  await loadPrHeaders();
  await loadPrLines(prId);

  const updatedRow =
    state.prRows.find((row) => Number(row.pr_id) === prId) || state.selectedPr;
  if (updatedRow && qs("prViewModalBackdrop")?.classList.contains("show")) {
    refreshPrViewModal(updatedRow);
    applyPrLineFiltersAndRender();
  }
}

function openPrSetStatusModal(row, targetStatus) {
  const statusLabels = {
    active: "Activate PR",
    closed: "Close PR",
    cancelled: "Cancel PR",
  };
  if (!canPerformEditAction(statusLabels[targetStatus] || "Change PR status")) return;
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
  const targetStatus = backdrop.dataset.targetStatus;
  const statusLabels = {
    active: "Activate PR",
    closed: "Close PR",
    cancelled: "Cancel PR",
  };
  if (!canPerformEditAction(statusLabels[targetStatus] || "Change PR status")) return;
  const prId = Number(backdrop.dataset.prId);
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
  qs("btnPrExportMenu")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleExportMenu("prExportMenu", qs("btnPrExportMenu"));
  });
  qs("btnPrExportPdf")?.addEventListener("click", () => {
    closeAllExportMenus();
    if (!state.selectedPr) return;
    exportPrFormPdf(state.selectedPr);
  });
  qs("btnPrExportCsv")?.addEventListener("click", () => {
    closeAllExportMenus();
    if (!state.selectedPr) return;
    exportPrFormCsv(state.selectedPr);
  });
  wirePrLineTableActions();
  wireLiveSearchInput({
    inputId: "prLineSearch",
    clearId: "prLineSearchClear",
    onSearch: () => {
      applyPrLineFiltersAndRender();
    },
    debounceMs: 150,
  });
  qs("prLineFilter")?.addEventListener("change", () => {
    applyPrLineFiltersAndRender();
  });
  qs("prLinePageSize")?.addEventListener("change", () => {
    const sizeVal = Number(qs("prLinePageSize")?.value || "50");
    prLinePageSize = Number.isFinite(sizeVal) && sizeVal > 0 ? sizeVal : 50;
    applyPrLineFiltersAndRender();
  });
  qs("prLinePrev")?.addEventListener("click", () => {
    // Infinite scroll mode: Prev paging is intentionally disabled.
  });
  qs("prLineNext")?.addEventListener("click", () => {
    const total = prLineFiltered.length;
    if (prLineVisibleCount >= total) return;
    prLineVisibleCount = Math.min(prLineVisibleCount + prLinePageSize, total);
    renderPrLinesPage();
  });
  qs("prLinePrev")?.setAttribute("aria-disabled", "true");
  qs("prLinePrev")?.setAttribute("title", "Disabled in infinite scroll mode");
  qs("prLinesScroll")?.addEventListener("scroll", () => {
    maybeLoadMorePrLines();
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
  qs("btnPrAddLineClose")?.addEventListener("click", closePrAddLineModal);
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
  qs("btnPrSetStatusClose")?.addEventListener("click", closePrSetStatusModal);
  qs("btnPrSetStatusCancel").addEventListener("click", closePrSetStatusModal);
  qs("btnPrSetStatusConfirm").addEventListener("click", confirmPrSetStatus);
  qs("prSetStatusModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "prSetStatusModalBackdrop") closePrSetStatusModal();
  });

  // Indent creation modals
  qs("btnCreateIndentClose")?.addEventListener("click", closeCreateIndentModal);
  qs("btnCiCancel").addEventListener("click", closeCreateIndentModal);
  qs("btnCiCreate").addEventListener("click", saveCreateIndent);
  qs("createIndentModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "createIndentModalBackdrop") closeCreateIndentModal();
  });
  qs("btnIndentFromPrClose")?.addEventListener("click", closeIndentFromPrModal);
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
    tr.classList.add("clickable-row");
    tr.style.cursor = "pointer";
    tr.innerHTML = `
      <td>
        <div>${esc(row.voucher_number ?? "")}</div>
        <div class="muted">${esc(row.voucher_date ?? "")}</div>
      </td>
      <td>${esc(row.stock_item_name ?? "")}</td>
      <td>${esc(displayMaterialClassCode(row.material_class_code ?? ""))}</td>
      <td>${fmt(row.purchase_qty)}</td>
      <td>${fmt(row.allocated_qty)}</td>
      <td>${fmt(row.unallocated_qty)}</td>
      <td>${fmt(row.accepted_qty)}</td>
      <td>${fmt(row.net_unallocated_qty)}</td>
    `;
    tr.addEventListener("click", () => {
      openExcessPurchaseModal(row);
    });
    tbody.appendChild(tr);
  }
  qs("eMeta").textContent = getExcessMetaSummary();
  qs("ePaging").textContent =
    `Page ${state.excessPage + 1}/${state.excessTotalPages}`;
  const _ePrev = qs("eBtnPrev");
  const _eNext = qs("eBtnNext");
  if (_ePrev) _ePrev.disabled = state.excessPage <= 0;
  if (_eNext) _eNext.disabled = state.excessPage >= state.excessTotalPages - 1;
  updateTabCount("tabCountExcess", state.excessRows.length);
}

function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getExcessDateRange() {
  const preset = state.excessFilters.datePreset || "30d";
  const today = new Date();
  const end = formatIsoDate(today);
  if (preset === "custom") {
    return {
      from: state.excessFilters.dateFrom || "",
      to: state.excessFilters.dateTo || "",
      label:
        state.excessFilters.dateFrom || state.excessFilters.dateTo
          ? `${state.excessFilters.dateFrom || "…"} to ${state.excessFilters.dateTo || "…"}`
          : "custom range",
    };
  }
  if (preset === "7d") {
    const from = new Date(today);
    from.setDate(today.getDate() - 7);
    return { from: formatIsoDate(from), to: end, label: "last 7 days" };
  }
  if (preset === "fy") {
    const from = new Date(today);
    from.setDate(today.getDate() - 365);
    return { from: formatIsoDate(from), to: end, label: "last 365 days" };
  }
  const from = new Date(today);
  from.setDate(today.getDate() - 30);
  return { from: formatIsoDate(from), to: end, label: "last 30 days" };
}

function getExcessMetaSummary() {
  const parts = [
    `${state.excessTotalCount} line${state.excessTotalCount !== 1 ? "s" : ""}`,
  ];
  const filters = state.excessFilters;
  if (filters.materialClassId) parts.push(filters.materialClassId);
  const dateRange = getExcessDateRange();
  if (filters.datePreset !== "custom" || dateRange.from || dateRange.to) {
    parts.push(dateRange.label);
  }
  if (Number(filters.minQty) > 0) parts.push(`min ${Number(filters.minQty)}`);
  if (filters.vendorQ) parts.push(`vendor: '${filters.vendorQ}'`);
  if (filters.itemQ) parts.push(`item: '${filters.itemQ}'`);
  if (filters.unmappedOnly) parts.push("unmapped only");
  const quickSearch = (qs("eSearch")?.value || "").trim();
  if (quickSearch) parts.push(`search: '${quickSearch}'`);
  return parts.join(" • ");
}

function applyExcessFilterChange(patch = {}) {
  Object.assign(state.excessFilters, patch);
  state.excessPage = 0;
  syncExcessFilterBadge();
  loadExcess();
}

function getExcessActiveFilterCount() {
  const filters = state.excessFilters || {};
  let count = 0;
  if (filters.materialClassId) count += 1;
  if ((filters.datePreset || "30d") !== "30d") count += 1;
  if (filters.dateFrom) count += 1;
  if (filters.dateTo) count += 1;
  if (Number(filters.minQty || 0) > 0) count += 1;
  if ((filters.vendorQ || "").trim()) count += 1;
  if ((filters.itemQ || "").trim()) count += 1;
  if (filters.unmappedOnly) count += 1;
  return count;
}

function syncExcessFilterBadge() {
  const badge = qs("eFilterBadge");
  const btn = qs("eFilterBtn");
  if (!btn) return;
  const count = getExcessActiveFilterCount();
  if (badge) {
    badge.textContent = String(count);
    badge.style.display = count > 0 ? "" : "none";
  }
  btn.classList.toggle("pec-filter-btn--active", count > 0);
}

function closeExcessFilterPanel({ restoreFocus = false } = {}) {
  const panel = qs("eFilterPanel");
  const btn = qs("eFilterBtn");
  if (!panel || !btn) return;
  closeFloatingFilterDrawer(btn, panel, { restoreFocus });
}

function toggleExcessFilterPanel() {
  const panel = qs("eFilterPanel");
  const btn = qs("eFilterBtn");
  if (!panel || !btn) return;

  const isOpen = panel.classList.contains("open");
  if (isOpen) {
    closeExcessFilterPanel({ restoreFocus: true });
    return;
  }

  closeAllProcurementFilterDrawers({ exceptId: panel.id });
  panel.classList.add("open");
  panel._ownerBtn = btn;
  btn.setAttribute("aria-expanded", "true");
  const rect = btn.getBoundingClientRect();
  panel.style.position = "fixed";
  panel.style.top = rect.bottom + 4 + "px";
  panel.style.left = rect.left + "px";
  panel.style.zIndex = "10001";
  requestAnimationFrame(() => {
    const drawerWidth = panel.offsetWidth || 320;
    if (rect.left + drawerWidth > window.innerWidth) {
      panel.style.left = Math.max(4, rect.right - drawerWidth) + "px";
    }
    const firstField = panel.querySelector(
      'select, input, button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusElementIfPossible(firstField);
  });
}

async function loadExcess() {
  setTabTableLoading("excess", true);
  try {
    const search = (qs("eSearch")?.value || "").trim();
    const filters = state.excessFilters;
    const pageSize = Number(state.pageSize || DEFAULT_PAGE_SIZE);
    const from = state.excessPage * pageSize;
    const to = from + pageSize - 1;
    let q = supabase
      .from("v_proc_purchase_excess_console")
      .select("*", { count: "exact" });
    if (search) q = q.ilike("stock_item_name", `%${search}%`);
    if (filters.materialClassId) {
      q = q.eq("material_class_code", filters.materialClassId);
    }
    if (Number(filters.minQty) > 0) {
      q = q.gte("net_unallocated_qty", Number(filters.minQty));
    }
    const dateRange = getExcessDateRange();
    if (dateRange.from) q = q.gte("voucher_date", dateRange.from);
    if (dateRange.to) q = q.lte("voucher_date", dateRange.to);
    if (filters.vendorQ) {
      q = q.ilike("vendor_display_name", `%${filters.vendorQ}%`);
    }
    if (filters.itemQ) {
      const escapedItemQ = filters.itemQ.replaceAll(",", "\\,");
      q = q.or(
        `stock_item_name.ilike.%${escapedItemQ}%,stock_item_code.ilike.%${escapedItemQ}%`,
      );
    }
    if (filters.unmappedOnly) {
      q = q.is("vendor_display_name", null);
    }
    q = q
      .order("net_unallocated_qty", { ascending: false })
      .order("voucher_date", { ascending: false })
      .range(from, to);
    const { data, error, count } = await q;
    if (error) {
      toast(`Failed to load excess purchases: ${error.message}`, "error");
      return;
    }
    state.excessRows = data || [];
    state.excessTotalCount = count ?? 0;
    state.excessTotalPages = Math.max(
      1,
      Math.ceil(state.excessTotalCount / pageSize),
    );
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

async function loadExcessAuditPaged() {
  const pageSize = Number(state.pageSize || DEFAULT_PAGE_SIZE);
  const from = state.excessAuditPage * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("v_proc_excess_acceptance_audit_console")
    .select("*", { count: "exact" })
    .order("accepted_at", { ascending: false })
    .range(from, to);
  if (error) {
    toast(`Failed to load acceptance audit: ${error.message}`, "error");
    return;
  }
  state.excessAuditRows = data || [];
  state.excessAuditTotalCount = count ?? 0;
  state.excessAuditTotalPages = Math.max(
    1,
    Math.ceil(state.excessAuditTotalCount / pageSize),
  );
  renderExcessAudit();
  qs("eAuditMeta").textContent =
    `${state.excessAuditTotalCount} line${state.excessAuditTotalCount !== 1 ? "s" : ""}`;
  qs("eAuditPaging").textContent =
    `Page ${state.excessAuditPage + 1}/${state.excessAuditTotalPages}`;
  qs("eAuditBtnPrev").disabled = state.excessAuditPage <= 0;
  qs("eAuditBtnNext").disabled =
    state.excessAuditPage >= state.excessAuditTotalPages - 1;
}

function openExcessAuditModal() {
  const backdrop = qs("eAuditModalBackdrop");
  if (!backdrop) return;
  state.excessAuditPage = 0;
  backdrop.removeAttribute("inert");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  loadExcessAuditPaged();
}

function closeExcessAuditModal() {
  const backdrop = qs("eAuditModalBackdrop");
  if (!backdrop) return;
  backdrop.setAttribute("inert", "");
  hideModalBackdrop(backdrop, [qs("eAuditBtn"), qs("eSearch")]);
}

function updateExcessAcceptState() {
  const row = state.excessModal || {};
  const max = Number(row.net_unallocated_qty || 0);
  const qty = Number(qs("excessAcceptQty")?.value || 0);
  const reason = (qs("excessAcceptReason")?.value || "").trim();
  const ok = qty > 0 && qty <= max && reason.length >= 10;
  const btn = qs("btnExcessAccept");
  if (!btn) return;
  if (!canWriteModule()) {
    btn.disabled = true;
    btn.setAttribute("title", "Read-only access");
    return;
  }
  btn.disabled = !ok;
  if (ok) {
    btn.removeAttribute("title");
  }
}

function openExcessPurchaseModal(row) {
  const backdrop = qs("acceptExcessModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => qs("excessAcceptQty")?.focus());
  state.excessModal = row;

  const subtitleParts = [];
  subtitleParts.push(`Fact #${row.purchase_fact_id ?? "—"}`);
  if (row.voucher_date) subtitleParts.push(String(row.voucher_date));
  if (row.vendor_display_name && String(row.vendor_display_name).trim()) {
    subtitleParts.push(String(row.vendor_display_name).trim());
  }
  qs("excessModalSub").textContent = subtitleParts.join(" • ");
  qs("excessItemValue").textContent =
    row.stock_item_name && String(row.stock_item_name).trim()
      ? String(row.stock_item_name).trim()
      : "—";
  qs("excessItemCodeValue").textContent =
    row.stock_item_code && String(row.stock_item_code).trim()
      ? String(row.stock_item_code).trim()
      : "—";
  qs("excessUomValue").textContent =
    row.uom_code && String(row.uom_code).trim()
      ? String(row.uom_code).trim()
      : "—";
  qs("excessPurchaseQtyValue").textContent =
    row.purchase_qty == null ? "—" : fmt(row.purchase_qty);
  qs("excessAllocatedQtyValue").textContent =
    row.allocated_qty == null ? "—" : fmt(row.allocated_qty);
  qs("excessNetUnallocValue").textContent =
    row.net_unallocated_qty == null ? "—" : fmt(row.net_unallocated_qty);
  qs("excessAcceptMax").textContent =
    row.net_unallocated_qty == null ? "—" : fmt(row.net_unallocated_qty);
  const max = Number(row.net_unallocated_qty || 0);
  qs("excessAcceptQty").value = max > 0 ? String(max) : "0";
  qs("excessAcceptQty").max = String(max);
  qs("excessAcceptReason").value = "";
  backdrop.dataset.purchaseFactId = String(row.purchase_fact_id);
  backdrop.dataset.maxQty = String(max);
  updateExcessAcceptState();
  applyPermissionUi();
}

function closeAcceptExcessModal() {
  const backdrop = qs("acceptExcessModalBackdrop");
  state.excessModal = null;
  hideModalBackdrop(backdrop, [qs("eSearch")]);
}

async function saveAcceptExcess() {
  if (!canPerformEditAction("Accept excess purchase")) return;
  const backdrop = qs("acceptExcessModalBackdrop");
  const purchaseFactId = Number(backdrop.dataset.purchaseFactId);
  const maxQty = Number(backdrop.dataset.maxQty);
  const qty = Number(qs("excessAcceptQty").value || 0);
  const reason = (qs("excessAcceptReason").value || "").trim();
  if (Number.isNaN(qty) || qty <= 0) {
    toast("Enter a valid quantity greater than zero.", "error");
    return;
  }
  if (qty > maxQty) {
    toast(`Quantity cannot exceed max unallocated (${fmt(maxQty)}).`, "error");
    return;
  }
  if (reason.length < 10) {
    toast("Reason is required (minimum 10 characters).", "error");
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
  if (qs("eAuditModalBackdrop")?.classList.contains("show")) {
    await loadExcessAuditPaged();
  }
}

function wireExcessControls() {
  qs("eBtnPrev").addEventListener("click", () => {
    state.excessPage = Math.max(0, state.excessPage - 1);
    loadExcess();
  });
  qs("eBtnNext").addEventListener("click", () => {
    if (state.excessPage >= state.excessTotalPages - 1) return;
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
  const eFilterBtn = qs("eFilterBtn");
  const eFilterPanel = qs("eFilterPanel");
  const applyExcessFilterSearchVendor = debounce((value) => {
    applyExcessFilterChange({ vendorQ: value.trim() });
  }, 250);
  const applyExcessFilterSearchItem = debounce((value) => {
    applyExcessFilterChange({ itemQ: value.trim() });
  }, 250);

  eFilterBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleExcessFilterPanel();
  });
  eFilterPanel?.addEventListener("click", (e) => {
    e.stopPropagation();
  });
  document.addEventListener("click", (e) => {
    if (
      !e.target.closest("#eFilterBtn") &&
      !e.target.closest("#eFilterPanel")
    ) {
      closeExcessFilterPanel();
    }
  });
  window.addEventListener("resize", closeExcessFilterPanel);

  syncExcessFilterBadge();

  qs("eFMaterialClass")?.addEventListener("change", (e) => {
    applyExcessFilterChange({ materialClassId: e.target.value });
  });
  qs("eFDatePreset")?.addEventListener("change", (e) => {
    applyExcessFilterChange({ datePreset: e.target.value });
  });
  qs("eFDateFrom")?.addEventListener("change", (e) => {
    applyExcessFilterChange({ dateFrom: e.target.value, datePreset: "custom" });
  });
  qs("eFDateTo")?.addEventListener("change", (e) => {
    applyExcessFilterChange({ dateTo: e.target.value, datePreset: "custom" });
  });
  qs("eFMinQty")?.addEventListener("input", (e) => {
    applyExcessFilterChange({ minQty: Number(e.target.value || 0) });
  });
  qs("eFVendorQ")?.addEventListener("input", (e) => {
    applyExcessFilterSearchVendor(e.target.value || "");
  });
  qs("eFItemQ")?.addEventListener("input", (e) => {
    applyExcessFilterSearchItem(e.target.value || "");
  });
  qs("eFUnmappedOnly")?.addEventListener("change", (e) => {
    applyExcessFilterChange({ unmappedOnly: e.target.checked });
  });

  qs("btnAcceptExcessCancel").addEventListener("click", closeAcceptExcessModal);
  qs("btnAcceptExcessClose")?.addEventListener("click", closeAcceptExcessModal);
  qs("btnExcessAccept").addEventListener("click", saveAcceptExcess);
  qs("excessAcceptQty").addEventListener("input", updateExcessAcceptState);
  qs("excessAcceptReason").addEventListener("input", updateExcessAcceptState);
  qs("acceptExcessModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "acceptExcessModalBackdrop") closeAcceptExcessModal();
  });

  qs("eAuditBtn")?.addEventListener("click", openExcessAuditModal);
  qs("btnEAuditClose")?.addEventListener("click", closeExcessAuditModal);
  qs("eAuditModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "eAuditModalBackdrop") closeExcessAuditModal();
  });
  qs("eAuditBtnPrev")?.addEventListener("click", () => {
    if (state.excessAuditPage <= 0) return;
    state.excessAuditPage -= 1;
    loadExcessAuditPaged();
  });
  qs("eAuditBtnNext")?.addEventListener("click", () => {
    if (state.excessAuditPage >= state.excessAuditTotalPages - 1) return;
    state.excessAuditPage += 1;
    loadExcessAuditPaged();
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
      entry?.indent_id ??
      "-",
    qty_to_buy:
      entry?.qty_to_buy ??
      entry?.qty ??
      entry?.remaining_qty ??
      entry?.qtyToBuy ??
      0,
    uom_code: entry?.uom_code ?? entry?.uom ?? "",
  }));
}

function breakdownToCompactText(raw, row = {}) {
  const parts = normalizeVwlBreakdown(raw).map((b) => {
    const qty = Number(b.qty_to_buy || 0).toLocaleString("en-IN", {
      maximumFractionDigits: 3,
    });
    const uom = b.uom_code || row.uom_code || row.uom || "";
    const indent = b.indent_number;
    return `${qty}${uom ? " " + uom : ""} [${indent}]`;
  });
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
  state.vwlBreakdownRow = null;
}

function openVwlBreakdown(row) {
  const backdrop = qs("vwlBreakdownModalBackdrop");
  const title = qs("vwlBdTitle");
  const sub = qs("vwlBdSub");
  const tbody = qs("vwlBdTbody");
  const splitCallout = qs("vwlBdSplitCallout");
  const splitMessage = qs("vwlBdSplitMessage");
  if (!backdrop || !title || !sub || !tbody) return;

  state.vwlBreakdownRow = row;

  title.textContent = `${row.vendor_name ?? "-"} - ${row.stock_item_name ?? "-"}`;
  sub.textContent = `Total Qty to Buy: ${fmt(row.total_qty_to_buy)} ${row.uom_code ?? ""}`;

  const splitMeta = getVwlSplitMeta(row);
  if (splitCallout && splitMessage) {
    if (splitMeta) {
      const bucketCount = splitMeta.vendorBucketCount ?? "-";
      splitMessage.textContent = `This item is split across ${bucketCount} vendor bucket${bucketCount !== 1 ? "s" : ""}. Review consolidation.`;
      splitCallout.hidden = false;
    } else {
      splitCallout.hidden = true;
      splitMessage.textContent = "";
    }
  }

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
    const isSplit = isVwlSplitRow(row);
    const tr = document.createElement("tr");
    tr.classList.add("clickable-row");
    if (isSplit) tr.classList.add("vwl-row-split");

    const itemCell = isSplit
      ? `${esc(row.stock_item_name ?? "-")} <span class="pill pill-warning" title="Split across multiple vendor buckets">Split vendor</span>`
      : esc(row.stock_item_name ?? "-");

    tr.innerHTML = `
      <td>${esc(row.vendor_name ?? "-")}</td>
      <td>${itemCell}</td>
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

async function loadVendorBuylistFilterOptions() {
  const [
    { data: classRows, error: classError },
    { data: rmRows, error: rmError },
  ] = await Promise.all([
    supabase
      .from("v_proc_vendorwise_buylist_material_class_options")
      .select("*")
      .order("material_class_code", { ascending: true }),
    supabase
      .from("v_proc_vendorwise_buylist_rm_scope_options")
      .select("*")
      .order("rm_scope_label", { ascending: true }),
  ]);

  if (classError) throw classError;
  if (rmError) throw rmError;

  state.vwlMaterialClassOptions = classRows || [];
  state.vwlRmScopeOptions = rmRows || [];

  populateVwlMaterialClassFilter();
  populateVwlRmScopeFilter();
  refreshVwlRmScopeAvailability();
}

function populateVwlMaterialClassFilter() {
  const sel = qs("vwlMaterialClassFilter");
  if (!sel) return;

  const current = state.vwlFilters?.materialClassId || sel.value || "";

  sel.innerHTML = '<option value="">All Material Classes</option>';

  (state.vwlMaterialClassOptions || []).forEach((row) => {
    const opt = document.createElement("option");
    opt.value = String(row.material_class_id ?? "");
    opt.dataset.code = row.material_class_code || "";
    opt.textContent =
      row.material_class_display ||
      `${row.material_class_code || ""} - ${row.material_class_label || ""}`.trim();
    sel.appendChild(opt);
  });

  sel.value = current;
  state.vwlFilters.materialClassId = sel.value || "";
  state.vwlFilters.materialClassCode =
    sel.selectedOptions?.[0]?.dataset?.code || "";
}

function populateVwlRmScopeFilter() {
  const sel = qs("vwlRmScopeFilter");
  if (!sel) return;

  const current = state.vwlFilters?.rmScope || sel.value || "";

  sel.innerHTML = '<option value="">All RM Scope</option>';

  (state.vwlRmScopeOptions || []).forEach((row) => {
    const opt = document.createElement("option");
    opt.value = row.rm_scope || "";
    opt.textContent = row.rm_scope_label || row.rm_scope || "";
    sel.appendChild(opt);
  });

  sel.value = current;
}

function getSelectedVwlMaterialClassCode() {
  const sel = qs("vwlMaterialClassFilter");
  return sel?.selectedOptions?.[0]?.dataset?.code || "";
}

function refreshVwlRmScopeAvailability() {
  const rmSel = qs("vwlRmScopeFilter");
  if (!rmSel) return;

  const isRm = getSelectedVwlMaterialClassCode().toUpperCase() === "RM";

  rmSel.disabled = !isRm;

  if (!isRm) {
    rmSel.value = "";
    state.vwlFilters.rmScope = "";
  }
}

function getVwlActiveFilterCount() {
  const filters = state.vwlFilters || {};
  let count = 0;
  if ((state.vwl.vendorId || "").trim()) count += 1;
  if ((filters.materialClassId || "").trim()) count += 1;
  if ((filters.rmScope || "").trim()) count += 1;
  if ((filters.rateStatus || "").trim()) count += 1;
  if ((filters.assignmentStatus || "").trim()) count += 1;
  if (filters.splitOnly) count += 1;
  return count;
}

function syncVwlFilterBadge() {
  const badge = qs("vwlFilterBadge");
  const btn = qs("vwlFilterBtn");
  if (!btn) return;

  const count = getVwlActiveFilterCount();
  if (badge) {
    badge.textContent = String(count);
    badge.style.display = count > 0 ? "" : "none";
  }
  btn.classList.toggle("pec-filter-btn--active", count > 0);
}

function buildVwlRpcFilterParams() {
  const f = state.vwlFilters || {};
  const q =
    qs("vwlSearch")?.value?.trim() ||
    state.vendorBuylistSearch ||
    state.vwl.search ||
    "";

  return {
    p_material_class_id: f.materialClassId ? Number(f.materialClassId) : null,
    p_rm_scope: f.rmScope || null,
    p_rate_status: f.rateStatus || null,
    p_assignment_status: f.assignmentStatus || null,
    p_q: q || null,
  };
}

function pickRpcField(row, ...keys) {
  if (!row) return null;
  for (const key of keys) {
    const val = row[key];
    if (val !== undefined && val !== null && val !== "") return val;
  }
  return null;
}

function asRpcArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function buildVwlSplitKey(row) {
  const mc = pickRpcField(row, "material_class_id") ?? "";
  const si = pickRpcField(row, "stock_item_id", "item_id") ?? "";
  const uom = pickRpcField(row, "uom_id") ?? "";
  return `${mc}|${si}|${uom}`;
}

function buildVwlSplitLookup(rows) {
  const lookup = {};
  for (const row of rows || []) {
    const key = buildVwlSplitKey(row);
    if (!key || key === "||") continue;
    lookup[key] = {
      vendorBucketCount: pickRpcField(
        row,
        "vendor_bucket_count",
        "vendor_count",
        "bucket_count",
      ),
      totalQty: pickRpcField(
        row,
        "total_qty_to_buy",
        "total_qty",
        "total_quantity",
      ),
      hasUnassigned: Boolean(
        pickRpcField(
          row,
          "has_unassigned_vendor",
          "has_unassigned",
          "unassigned_exists",
        ),
      ),
      itemName: pickRpcField(row, "stock_item_name", "item_name"),
      uomCode: pickRpcField(row, "uom_code", "uom"),
      materialClassId: pickRpcField(row, "material_class_id"),
      stockItemId: pickRpcField(row, "stock_item_id", "item_id"),
      uomId: pickRpcField(row, "uom_id"),
    };
  }
  return lookup;
}

function getVwlSplitMeta(row) {
  const key = buildVwlSplitKey(row);
  return state.vwl.splitLookup?.[key] ?? null;
}

function isVwlSplitRow(row) {
  return Boolean(getVwlSplitMeta(row));
}

function mapVwlSplitActionError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  if (msg.includes("vendor") && msg.includes("required")) {
    return "Vendor is required.";
  }
  if (
    msg.includes("rate") &&
    (msg.includes("greater than zero") ||
      msg.includes("must be >") ||
      msg.includes("> 0"))
  ) {
    return "Rate must be greater than zero.";
  }
  if (msg.includes("reason") && msg.includes("required")) {
    return "Reason is required.";
  }
  if (msg.includes("inactive") && msg.includes("vendor")) {
    return "Vendor inactive.";
  }
  if (msg.includes("no affected") || msg.includes("no lines")) {
    return "No affected lines.";
  }
  return error?.message || "Could not complete vendor consolidation.";
}

function closeVwlSplitActionConfirmModal(result = false) {
  const backdrop = qs("vwlSplitActionConfirmModalBackdrop");
  if (!backdrop) {
    const resolve = vwlSplitActionConfirmResolve;
    vwlSplitActionConfirmResolve = null;
    if (typeof resolve === "function") resolve(result);
    return;
  }
  hideModalBackdrop(backdrop, [qs("btnVwlSplitApply")]);
  backdrop.setAttribute("inert", "");
  const resolve = vwlSplitActionConfirmResolve;
  vwlSplitActionConfirmResolve = null;
  if (typeof resolve === "function") resolve(result);
}

function confirmVwlSplitAction(message) {
  const backdrop = qs("vwlSplitActionConfirmModalBackdrop");
  const messageEl = qs("vwlSplitActionConfirmMessage");
  if (!backdrop) return Promise.resolve(window.confirm(message));

  if (messageEl) messageEl.textContent = message;
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  backdrop.removeAttribute("inert");
  setTimeout(() => qs("btnVwlSplitActionConfirm")?.focus(), 0);

  return new Promise((resolve) => {
    vwlSplitActionConfirmResolve = resolve;
  });
}

async function afterVwlSplitActionSuccess(message) {
  toast(message || "Changes applied.", "success");
  closeVwlSplitReviewModal();
  closeVwlBreakdownModal();
  await reloadVendorBuylist();
  if (typeof loadActionQueue === "function") {
    await loadActionQueue();
  }
}

async function refreshVwlSplitLookup() {
  try {
    const { data, error } = await supabase.rpc(
      "proc_vendorwise_buylist_split_items",
      buildVwlRpcFilterParams(),
    );
    if (error) throw error;
    state.vwl.splitRows = data || [];
    state.vwl.splitLookup = buildVwlSplitLookup(state.vwl.splitRows);
  } catch (e) {
    console.warn("Failed to load split-vendor lookup", e);
    state.vwl.splitRows = [];
    state.vwl.splitLookup = {};
  }
}

function closeVwlSplitReviewModal() {
  const backdrop = qs("vwlSplitReviewModalBackdrop");
  if (!backdrop) return;
  hideModalBackdrop(backdrop, [qs("vwlTbody"), qs("btnVwlBdReviewSplit")]);
  backdrop.setAttribute("inert", "");
  state.vwlSplitReview = null;
}

function setVwlSplitActionMode(mode) {
  const review = state.vwlSplitReview;
  if (!review) return;
  review.actionMode = mode;

  const consolidatePanel = qs("vwlSplitConsolidatePanel");
  const clearPanel = qs("vwlSplitClearPanel");
  const applyBtn = qs("btnVwlSplitApply");
  const noteEl = qs("vwlSplitActionNote");

  if (consolidatePanel) consolidatePanel.hidden = mode !== "consolidate";
  if (clearPanel) clearPanel.hidden = mode !== "clear";

  if (noteEl) {
    noteEl.textContent =
      mode === "consolidate"
        ? "This will apply the selected vendor to all qualifying open lines for this item/UOM."
        : "This will make all qualifying open lines for this item/UOM unassigned.";
  }

  if (applyBtn) {
    applyBtn.textContent =
      mode === "consolidate" ? "Apply vendor" : "Clear assignments";
    applyBtn.classList.toggle("primary", mode === "consolidate");
    applyBtn.classList.toggle("secondary", mode === "clear");
  }

  document.querySelectorAll('input[name="vwlSplitActionMode"]').forEach((el) => {
    if (el instanceof HTMLInputElement) {
      el.checked = el.value === mode;
    }
  });

  document
    .querySelectorAll(".vwl-split-review-modal .erp-choice-row[data-vwl-split-mode]")
    .forEach((row) => {
      row.classList.toggle(
        "is-selected",
        row.getAttribute("data-vwl-split-mode") === mode,
      );
    });

  applyPermissionUi();
}

function renderVwlSplitReviewModal() {
  const review = state.vwlSplitReview;
  const preview = review?.preview;
  if (!review || !preview) return;

  const itemName = pickRpcField(
    preview,
    "stock_item_name",
    "item_name",
    review.itemName,
  );
  const uomCode = pickRpcField(preview, "uom_code", "uom", review.uomCode);
  const lineCount = pickRpcField(preview, "affected_line_count", "line_count");
  const indentCount = pickRpcField(
    preview,
    "affected_indent_count",
    "indent_count",
  );
  const totalQty = pickRpcField(preview, "total_qty", "total_qty_to_buy");

  const itemNameEl = qs("vwlSplitReviewItemName");
  if (itemNameEl) itemNameEl.textContent = itemName ?? "-";

  const refEl = qs("vwlSplitReviewRef");
  if (refEl) {
    const qtyLabel = `${fmt(totalQty ?? "-")}${uomCode ? ` ${uomCode}` : ""}`;
    refEl.textContent = `UOM: ${uomCode ?? "-"} | Total Qty: ${qtyLabel} | Affected Lines: ${fmt(lineCount ?? "-")} | Affected Indents: ${fmt(indentCount ?? "-")}`;
  }

  const affectedLines = asRpcArray(
    pickRpcField(preview, "affected_lines", "lines", "open_lines"),
  );
  const linesTbody = qs("vwlSplitReviewLinesTbody");
  if (linesTbody) {
    linesTbody.innerHTML = affectedLines.length
      ? affectedLines
          .map((line) => {
            const indentNo = pickRpcField(line, "indent_number", "indent_no");
            const qty = pickRpcField(
              line,
              "qty",
              "qty_to_buy",
              "remaining_qty",
              "requested_qty",
            );
            const vendorName = pickRpcField(
              line,
              "current_vendor_name",
              "resolved_vendor_name",
              "selected_vendor_name",
              "recommended_vendor_name",
              "vendor_name",
            );
            const rate = pickRpcField(
              line,
              "rate_value",
              "rate",
              "resolved_rate",
              "selected_rate",
              "current_rate",
            );
            const qtyLabel = `${fmt(qty ?? "-")}${uomCode ? ` ${uomCode}` : ""}`;
            const rateLabel =
              rate != null && rate !== "" ? fmtFixed(rate, 2) : "-";
            return `<tr>
              <td>${esc(indentNo ?? "-")}</td>
              <td>${esc(vendorName ?? "UNASSIGNED")}</td>
              <td class="num">${esc(qtyLabel)}</td>
              <td class="num">${esc(rateLabel)}</td>
            </tr>`;
          })
          .join("")
      : '<tr><td colspan="4" class="muted">No affected lines.</td></tr>';
  }

  const vendorPick = qs("vwlSplitVendorPick");
  const candidates = asRpcArray(
    pickRpcField(preview, "candidate_vendors", "vendors", "vendor_candidates"),
  );
  if (vendorPick) {
    vendorPick.innerHTML = '<option value="">Select vendor…</option>';
    candidates.forEach((vendor) => {
      const vendorId = pickRpcField(vendor, "vendor_id", "id");
      if (!vendorId) return;
      const opt = document.createElement("option");
      opt.value = String(vendorId);
      opt.textContent =
        pickRpcField(vendor, "vendor_name", "display_name", "vendor_display_name") ||
        `Vendor #${vendorId}`;
      opt.dataset.rate = String(
        pickRpcField(vendor, "rate_value", "rate", "selected_rate") ?? "",
      );
      vendorPick.appendChild(opt);
    });
    if (review.selectedVendorId) {
      vendorPick.value = String(review.selectedVendorId);
    }
  }

  const rateInput = qs("vwlSplitVendorRate");
  if (rateInput && review.selectedRate != null) {
    rateInput.value = review.selectedRate;
  }

  setVwlSplitActionMode(review.actionMode || "consolidate");
  applyPermissionUi();

  const modalBody = document.querySelector(
    "#vwlSplitReviewModalBackdrop .erp-modal-body",
  );
  if (modalBody) modalBody.scrollTop = 0;
}

async function loadVwlSplitPreview(includeCleared = false) {
  const review = state.vwlSplitReview;
  if (!review?.stockItemId || !review?.uomId) return;

  const materialClassId =
    review.materialClassId ||
    (state.vwlFilters.materialClassId
      ? Number(state.vwlFilters.materialClassId)
      : null);

  const { data, error } = await supabase.rpc(
    "proc_preview_same_item_vendor_action",
    {
      p_material_class_id: materialClassId,
      p_stock_item_id: Number(review.stockItemId),
      p_uom_id: Number(review.uomId),
      p_include_cleared: Boolean(includeCleared),
    },
  );

  if (error) throw error;

  review.preview = Array.isArray(data) ? data[0] : data;
  review.materialClassId =
    pickRpcField(review.preview, "material_class_id") || materialClassId;
  renderVwlSplitReviewModal();
}

function getVwlSplitPreviewIncludeCleared() {
  return Boolean(
    qs("vwlSplitConsolidateIncludeCleared")?.checked ||
      qs("vwlSplitClearIncludeCleared")?.checked,
  );
}

async function reloadVwlSplitPreviewFromCheckboxes() {
  try {
    await loadVwlSplitPreview(getVwlSplitPreviewIncludeCleared());
  } catch (err) {
    toast(mapVwlSplitActionError(err), "error");
  }
}

async function openVwlSplitReviewModal(row) {
  const stockItemId = pickRpcField(row, "stock_item_id", "item_id");
  const uomId = pickRpcField(row, "uom_id");
  if (!stockItemId || !uomId) {
    toast("Split item is missing stock item or UOM.", "error");
    return;
  }

  state.vwlSplitReview = {
    stockItemId,
    uomId,
    materialClassId: pickRpcField(row, "material_class_id"),
    itemName: pickRpcField(row, "stock_item_name", "item_name"),
    uomCode: pickRpcField(row, "uom_code", "uom"),
    actionMode: "consolidate",
    selectedVendorId: "",
    selectedRate: "",
    preview: null,
  };

  qs("vwlSplitConsolidateReason").value = "";
  qs("vwlSplitClearReason").value = "";
  if (qs("vwlSplitConsolidateIncludeCleared"))
    qs("vwlSplitConsolidateIncludeCleared").checked = false;
  if (qs("vwlSplitClearIncludeCleared"))
    qs("vwlSplitClearIncludeCleared").checked = false;
  if (qs("vwlSplitVendorRate")) qs("vwlSplitVendorRate").value = "";

  setVwlSplitActionMode("consolidate");

  const backdrop = qs("vwlSplitReviewModalBackdrop");
  backdrop.removeAttribute("inert");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");

  try {
    await loadVwlSplitPreview(false);
  } catch (e) {
    closeVwlSplitReviewModal();
    toast(mapVwlSplitActionError(e), "error");
  }
}

function onVwlSplitVendorPickChange() {
  const review = state.vwlSplitReview;
  if (!review) return;

  const vendorPick = qs("vwlSplitVendorPick");
  const selected = vendorPick?.selectedOptions?.[0];
  review.selectedVendorId = vendorPick?.value || "";

  const rate =
    selected?.dataset?.rate ||
    pickRpcField(
      asRpcArray(
        pickRpcField(
          review.preview,
          "candidate_vendors",
          "vendors",
          "vendor_candidates",
        ),
      ).find(
        (v) =>
          String(pickRpcField(v, "vendor_id", "id")) ===
          String(review.selectedVendorId),
      ),
      "rate_value",
      "rate",
    );

  review.selectedRate = rate ?? "";
  if (qs("vwlSplitVendorRate")) {
    qs("vwlSplitVendorRate").value =
      review.selectedRate === "" ? "" : String(review.selectedRate);
  }
}

async function submitVwlSplitApply() {
  const mode = state.vwlSplitReview?.actionMode || "consolidate";
  if (mode === "clear") {
    await submitVwlClearVendorAssignments();
  } else {
    await submitVwlConsolidateVendor();
  }
}

async function submitVwlConsolidateVendor() {
  if (!canPerformEditAction("Consolidate vendor assignment")) return;

  const review = state.vwlSplitReview;
  if (!review?.stockItemId || !review?.uomId) return;

  const vendorId = Number(qs("vwlSplitVendorPick")?.value || 0);
  const rate = Number((qs("vwlSplitVendorRate")?.value || "").trim());
  const reason = (qs("vwlSplitConsolidateReason")?.value || "").trim();
  const includeCleared = Boolean(
    qs("vwlSplitConsolidateIncludeCleared")?.checked,
  );

  if (!vendorId) {
    toast("Vendor is required.", "error");
    return;
  }
  if (!rate || rate <= 0) {
    toast("Rate must be greater than zero.", "error");
    return;
  }
  if (!reason) {
    toast("Reason is required.", "error");
    return;
  }

  const confirmed = await confirmVwlSplitAction(
    "This will apply the selected vendor to all qualifying open lines for this item/UOM.",
  );
  if (!confirmed) return;

  setLoading(true);
  try {
    const { data, error } = await supabase.rpc(
      "proc_apply_vendor_to_same_item_lines",
      {
        p_material_class_id: review.materialClassId
          ? Number(review.materialClassId)
          : null,
        p_stock_item_id: Number(review.stockItemId),
        p_uom_id: Number(review.uomId),
        p_vendor_id: vendorId,
        p_rate_value: rate,
        p_reason: reason,
        p_include_cleared: includeCleared,
      },
    );
    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    await afterVwlSplitActionSuccess(
      result?.message || "Vendor applied to qualifying lines.",
    );
  } catch (e) {
    toast(mapVwlSplitActionError(e), "error");
  } finally {
    setLoading(false);
  }
}

async function submitVwlClearVendorAssignments() {
  if (!canPerformEditAction("Clear vendor assignments")) return;

  const review = state.vwlSplitReview;
  if (!review?.stockItemId || !review?.uomId) return;

  const reason = (qs("vwlSplitClearReason")?.value || "").trim() || null;
  const includeCleared = Boolean(qs("vwlSplitClearIncludeCleared")?.checked);

  const confirmed = await confirmVwlSplitAction(
    "This will make all qualifying open lines for this item/UOM unassigned.",
  );
  if (!confirmed) return;

  setLoading(true);
  try {
    const { data, error } = await supabase.rpc(
      "proc_clear_vendor_assignment_for_same_item_lines",
      {
        p_material_class_id: review.materialClassId
          ? Number(review.materialClassId)
          : null,
        p_stock_item_id: Number(review.stockItemId),
        p_uom_id: Number(review.uomId),
        p_reason: reason,
        p_include_cleared: includeCleared,
      },
    );
    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    await afterVwlSplitActionSuccess(
      result?.message || "Vendor assignments cleared for qualifying lines.",
    );
  } catch (e) {
    toast(mapVwlSplitActionError(e), "error");
  } finally {
    setLoading(false);
  }
}

function sortVendorBuylistRows(rows) {
  return [...(rows || [])].sort((a, b) => {
    const vendorCmp = String(a.vendor_name || "").localeCompare(
      String(b.vendor_name || ""),
    );
    if (vendorCmp !== 0) return vendorCmp;
    return String(a.stock_item_name || "").localeCompare(
      String(b.stock_item_name || ""),
    );
  });
}

async function fetchVendorBuylistFilteredRows() {
  const { data, error } = await supabase.rpc(
    "proc_vendorwise_buylist_filtered",
    buildVwlRpcFilterParams(),
  );

  if (error) throw error;

  return data || [];
}

async function loadVendorBuylist() {
  showLoadingMask();
  try {
    await ensureVendorBuylistVendorsLoaded();

    if (!state.vwlMaterialClassOptions?.length) {
      await loadVendorBuylistFilterOptions();
    }

    const [rawRows] = await Promise.all([
      fetchVendorBuylistFilteredRows(),
      refreshVwlSplitLookup(),
    ]);

    let rows = sortVendorBuylistRows(rawRows);
    if (state.vwlFilters.splitOnly) {
      rows = rows.filter(isVwlSplitRow);
    }

    const total = rows.length;
    const from = state.vwl.page * state.vwl.pageSize;
    if (from >= total && state.vwl.page > 0) {
      state.vwl.page = Math.max(0, Math.ceil(total / state.vwl.pageSize) - 1);
    }
    const start = state.vwl.page * state.vwl.pageSize;
    const end = start + state.vwl.pageSize;

    state.vwl.totalCount = total;
    state.vwl.rows = rows.slice(start, end);
    renderVendorBuylistTable();
    updateVendorBuylistPager();
    syncVwlFilterBadge();
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
  return sortVendorBuylistRows(await fetchVendorBuylistFilteredRows());
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
      Indent_Breakdown: breakdownToCompactText(r.indent_breakdown, r),
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

function getJsPdfApi() {
  const api = window.jspdf || window.jsPDF || null;
  return api?.jsPDF || api || null;
}

function pdfSafeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function pdfMoney(value) {
  const n = Number(value || 0);
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function pdfQty(value) {
  const n = Number(value || 0);
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function pdfDateStamp() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("");
}

function getVwlPdfVendorName(row) {
  return pdfSafeText(
    row.vendor_display_name ||
      row.vendor_name ||
      row.resolved_vendor_name ||
      row.selected_vendor_name ||
      "",
  );
}

function getVwlPdfItemName(row) {
  return pdfSafeText(
    row.stock_item_name || row.item_name || row.item || row.stock_item || "",
  );
}

function getVwlPdfQty(row) {
  return Number(
    row.total_qty_to_buy ?? row.qty_to_buy ?? row.remaining_qty ?? row.qty ?? 0,
  );
}

function getVwlPdfRate(row) {
  return Number(row.rate_value ?? row.rate ?? row.selected_rate ?? 0);
}

function formatVwlIndentSplitEntry(x, row) {
  const qty = Number(x.qty_to_buy || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 3,
  });
  const uom = pdfSafeText(x.uom_code || row.uom_code || row.uom || "");
  const indent = pdfSafeText(x.indent_number || x.indent_id || "");
  if (!indent) return "";
  return `${qty}${uom ? " " + uom : ""} [${indent}]`;
}

function formatVwlIndentSplit(row) {
  const raw = row.indent_breakdown || row.indent_split || "";

  if (Array.isArray(raw)) {
    return raw.map((x) => formatVwlIndentSplitEntry(x, row)).filter(Boolean).join("; ");
  }

  const text = pdfSafeText(raw);
  if (!text) return "";

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed
        .map((x) => formatVwlIndentSplitEntry(x, row))
        .filter(Boolean)
        .join("; ");
    }
  } catch (_) {
    // fall through to old text parser
  }

  const parts = text
    .split(/[;|]/)
    .map((p) => pdfSafeText(p))
    .filter(Boolean);

  const formatted = parts.map((part) => {
    let indent = "";
    let qty = "";

    if (part.includes(":")) {
      const pieces = part.split(":");
      indent = pdfSafeText(pieces[0]);
      qty = pdfSafeText(pieces.slice(1).join(":"));
    } else if (part.includes(" - ")) {
      const pieces = part.split(" - ");
      indent = pdfSafeText(pieces[0]);
      qty = pdfSafeText(pieces.slice(1).join(" - "));
    } else {
      return part;
    }

    if (!indent || !qty) return part;

    return `${qty} [${indent}]`;
  });

  const out = formatted.join("; ");
  return out.length <= 120 ? out : out.slice(0, 117) + "...";
}

function buildVendorBuylistPdfFileName() {
  return `VENDOR_WISE_BUYING_LIST_${pdfDateStamp()}.pdf`;
}

async function exportVendorBuylistPdf() {
  const JsPDF = getJsPdfApi();

  if (!JsPDF) {
    toast(
      "PDF export library is not loaded. Please check jsPDF loading.",
      "error",
    );
    return;
  }

  showLoadingMask("Preparing Vendor-wise PDF...");
  try {
    toast("Preparing Vendor-wise PDF export...", "info");
    const rows = await fetchAllVendorBuylistRows();

    if (!rows?.length) {
      toast(
        "No vendor-wise buying list rows available for PDF export.",
        "error",
      );
      return;
    }

    const doc = new JsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
      compress: true,
    });

    if (typeof doc.autoTable !== "function") {
      toast(
        "PDF table plugin is not loaded. Please check jsPDF AutoTable loading.",
        "error",
      );
      return;
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    /*
      Keep left/right margins visually equal.
      AutoTable width is fixed below so it does not leave a larger right gap.
    */
    const marginX = 30;
    const tableWidth = pageWidth - marginX * 2;
    const generatedOn = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    function drawVwlPdfFooter() {
      const pageNo = doc.internal.getCurrentPageInfo().pageNumber;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(0);

      /*
          Generated date/time moved to left footer.
        */
      doc.text(`Generated: ${generatedOn}`, marginX, pageHeight - 14);

      doc.text(`Page ${pageNo}`, pageWidth - marginX, pageHeight - 14, {
        align: "right",
      });
    }

    const vendorFilter = pdfSafeText(
      qs("vwlVendorFilter")?.selectedOptions?.[0]?.textContent || "",
    );
    const searchFilter = pdfSafeText(qs("vwlSearch")?.value || "");

    const groups = new Map();
    rows.forEach((r) => {
      const rawVendor = getVwlPdfVendorName(r);
      const vendorName = rawVendor || "Unassigned Vendor";
      if (!groups.has(vendorName)) groups.set(vendorName, []);
      groups.get(vendorName).push(r);
    });

    const vendorNames = Array.from(groups.keys()).sort((a, b) => {
      const au = a === "Unassigned Vendor";
      const bu = b === "Unassigned Vendor";
      if (au && !bu) return 1;
      if (!au && bu) return -1;
      return a.localeCompare(b);
    });
    let valuedTotal = 0;
    let rowsWithoutRate = 0;

    rows.forEach((r) => {
      const qty = getVwlPdfQty(r);
      const rate = getVwlPdfRate(r);
      const rawAmount = Number(
        r.total_amount ?? r.amount ?? r.estimated_amount ?? 0,
      );
      const hasRate = Number.isFinite(rate) && rate > 0;
      const hasAmount = Number.isFinite(rawAmount) && rawAmount > 0;
      const amount = hasAmount ? rawAmount : hasRate ? qty * rate : 0;

      if (!hasRate) rowsWithoutRate += 1;

      valuedTotal += amount;
    });

    const body = [];
    vendorNames.forEach((vendorName) => {
      const vendorRows = groups.get(vendorName) || [];
      let vendorAmount = 0;
      let vendorRowsWithoutRate = 0;

      vendorRows.forEach((r) => {
        const qty = getVwlPdfQty(r);
        const rate = getVwlPdfRate(r);
        const rawAmount = Number(
          r.total_amount ?? r.amount ?? r.estimated_amount ?? 0,
        );
        const hasRate = Number.isFinite(rate) && rate > 0;
        const hasAmount = Number.isFinite(rawAmount) && rawAmount > 0;
        const amount = hasAmount ? rawAmount : hasRate ? qty * rate : 0;

        if (!hasRate) vendorRowsWithoutRate += 1;
        vendorAmount += amount;
      });

      body.push([
        "",
        vendorName,
        "",
        "",
        vendorRowsWithoutRate ? `${vendorRowsWithoutRate} rate missing` : "",
        vendorAmount ? pdfMoney(vendorAmount) : "",
        "",
      ]);

      vendorRows
        .slice()
        .sort((a, b) =>
          getVwlPdfItemName(a).localeCompare(getVwlPdfItemName(b)),
        )
        .forEach((r, idx) => {
          const qty = getVwlPdfQty(r);
          const rate = getVwlPdfRate(r);
          const rawAmount = Number(
            r.total_amount ?? r.amount ?? r.estimated_amount ?? 0,
          );
          const hasRate = Number.isFinite(rate) && rate > 0;
          const hasAmount = Number.isFinite(rawAmount) && rawAmount > 0;
          const amount = hasAmount ? rawAmount : hasRate ? qty * rate : 0;

          body.push([
            String(idx + 1),
            getVwlPdfItemName(r),
            pdfSafeText(r.uom_code || r.uom || ""),
            pdfQty(qty),
            hasRate ? pdfMoney(rate) : "Rate missing",
            amount ? pdfMoney(amount) : "",
            formatVwlIndentSplit(r),
          ]);
        });
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Santhigiri Ayurveda Siddha Vaidyasala", marginX, 30);

    doc.setFontSize(10);
    doc.text("Vendor-wise Buying List", marginX, 46);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(0);

    const filterLine = [
      vendorFilter && vendorFilter !== "All Vendors"
        ? `Vendor: ${vendorFilter}`
        : "Vendor: All",
      searchFilter ? `Search: ${searchFilter}` : "Search: None",
      `Vendors: ${vendorNames.length}`,
      `Rows: ${rows.length}`,
      `Valued total: Rs. ${pdfMoney(valuedTotal)}`,
      rowsWithoutRate ? `Rows without rate: ${rowsWithoutRate}` : "",
    ]
      .filter(Boolean)
      .join("   |   ");

    doc.text(filterLine, marginX, 63);

    doc.autoTable({
      startY: 78,
      margin: { left: marginX, right: marginX, bottom: 28 },
      tableWidth,
      theme: "grid",
      head: [
        ["SN", "Item", "UOM", "Qty to Buy", "Rate", "Amount", "Indent Split"],
      ],
      body,
      styles: {
        font: "helvetica",
        fontSize: 7.1,
        cellPadding: 2,
        overflow: "linebreak",
        valign: "top",
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        textColor: [0, 0, 0],
        fillColor: false,
      },
      headStyles: {
        fillColor: false,
        textColor: [0, 0, 0],
        fontStyle: "bold",
        fontSize: 7.4,
        halign: "center",
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      bodyStyles: {
        textColor: [0, 0, 0],
        fillColor: false,
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      alternateRowStyles: {
        fillColor: false,
      },
      columnStyles: {
        0: { cellWidth: 24, halign: "center" },
        1: { cellWidth: 185 },
        2: { cellWidth: 34, halign: "center" },
        3: { cellWidth: 62, halign: "right" },
        4: { cellWidth: 58, halign: "right" },
        5: { cellWidth: 66, halign: "right" },
        6: {
          cellWidth: tableWidth - 24 - 185 - 34 - 62 - 58 - 66,
          halign: "left",
        },
      },
      didParseCell: function (data) {
        /*
          Vendor rows are detected by blank SN, blank UOM, blank Qty.
          Use medium weight by using bold only for vendor name and amount,
          but no background fill and no merged cells.
        */
        if (
          data.section === "body" &&
          data.row.raw &&
          data.row.raw[0] === "" &&
          data.row.raw[2] === "" &&
          data.row.raw[3] === ""
        ) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = false;
          data.cell.styles.textColor = [0, 0, 0];
          data.cell.styles.lineColor = [0, 0, 0];
          data.cell.styles.lineWidth = 0.1;

          /*
            Keep vendor row visually lighter by reducing font size slightly.
          */
          data.cell.styles.fontSize = 7.0;
        }

        if (data.section === "head") {
          data.cell.styles.halign = "center";
        }
      },
      didDrawPage: function () {
        drawVwlPdfFooter();
      },
    });

    let finalY = doc.lastAutoTable?.finalY || 100;

    if (finalY > pageHeight - 85) {
      doc.addPage();
      drawVwlPdfFooter();
      finalY = 50;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    const signY = finalY + 28;

    doc.text("Prepared by:", marginX, signY);
    doc.line(marginX + 62, signY, marginX + 170, signY);

    doc.text("Checked by:", marginX + 200, signY);
    doc.line(marginX + 260, signY, marginX + 370, signY);

    doc.text("Approved by:", marginX + 400, signY);
    doc.line(marginX + 465, signY, pageWidth - marginX, signY);

    doc.save(buildVendorBuylistPdfFileName());

    toast(
      rowsWithoutRate
        ? `Vendor-wise PDF exported. ${rowsWithoutRate} row(s) have missing rate; valued total is partial.`
        : "Vendor-wise PDF exported.",
      "success",
    );
  } catch (e) {
    console.error("Vendor-wise PDF export failed", e);
    toast(`Vendor-wise PDF export failed: ${e.message || e}`, "error");
  } finally {
    hideLoadingMask();
  }
}

function wireVendorBuylistControls() {
  qs("vwlFilterBtn")?.addEventListener(
    "click",
    () => {
      closeVendorBuylistDrawers();
    },
    true,
  );

  wireLiveSearchInput({
    inputId: "vwlSearch",
    clearId: "vwlSearchClear",
    debounceMs: 250,
    onSearch: (query) => {
      state.vwl.search = query;
      state.vwl.page = 0;
      syncVwlFilterBadge();
      loadVendorBuylist();
    },
  });

  qs("vwlVendorFilter")?.addEventListener("change", (e) => {
    state.vwl.vendorId = e.target.value || "";
    state.vwl.page = 0;
    syncVwlFilterBadge();
    loadVendorBuylist();
  });

  qs("vwlMaterialClassFilter")?.addEventListener("change", () => {
    const sel = qs("vwlMaterialClassFilter");
    state.vwlFilters.materialClassId = sel?.value || "";
    state.vwlFilters.materialClassCode =
      sel?.selectedOptions?.[0]?.dataset?.code || "";

    refreshVwlRmScopeAvailability();
    state.vwl.page = 0;
    syncVwlFilterBadge();
    loadVendorBuylist();
  });

  qs("vwlRmScopeFilter")?.addEventListener("change", () => {
    state.vwlFilters.rmScope = qs("vwlRmScopeFilter")?.value || "";
    state.vwl.page = 0;
    syncVwlFilterBadge();
    loadVendorBuylist();
  });

  qs("vwlRateStatusFilter")?.addEventListener("change", () => {
    state.vwlFilters.rateStatus = qs("vwlRateStatusFilter")?.value || "";
    state.vwl.page = 0;
    syncVwlFilterBadge();
    loadVendorBuylist();
  });

  qs("vwlAssignmentStatusFilter")?.addEventListener("change", () => {
    state.vwlFilters.assignmentStatus =
      qs("vwlAssignmentStatusFilter")?.value || "";
    state.vwl.page = 0;
    syncVwlFilterBadge();
    loadVendorBuylist();
  });

  qs("vwlShowSplitOnly")?.addEventListener("change", (e) => {
    state.vwlFilters.splitOnly = Boolean(e.target.checked);
    state.vwl.page = 0;
    syncVwlFilterBadge();
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
    closeProcurementFilterDrawer(qs("vwlFilterDrawer"));
    closeVendorBuylistDrawers("vwlExportDrawer");
    const drawer = qs("vwlExportDrawer");
    const menu = qs("vwlExportMenu");
    const willOpen = !menu?.classList.contains("open");
    toggleExportMenu("vwlExportMenu", qs("vwlExportBtn"));
    if (drawer) {
      if (willOpen) drawer.removeAttribute("hidden");
      else drawer.setAttribute("hidden", "hidden");
    }
  });
  qs("vwlExportPdf")?.addEventListener("click", () => {
    closeAllExportMenus();
    exportVendorBuylistPdf();
  });
  qs("vwlExportCsv")?.addEventListener("click", () => {
    exportVendorBuylist("csv");
    closeAllExportMenus();
  });
  qs("vwlExportTsv")?.addEventListener("click", () => {
    exportVendorBuylist("tsv");
    closeAllExportMenus();
  });

  const vwlClearFilterBtn =
    qs("vwlFilterClear") || qs("vwlClearFilters") || qs("btnVwlClearFilters");
  vwlClearFilterBtn?.addEventListener("click", () => {
    state.vwlFilters.materialClassId = "";
    state.vwlFilters.materialClassCode = "";
    state.vwlFilters.rmScope = "";
    state.vwlFilters.rateStatus = "";
    state.vwlFilters.assignmentStatus = "";
    state.vwlFilters.splitOnly = false;

    if (qs("vwlMaterialClassFilter")) qs("vwlMaterialClassFilter").value = "";
    if (qs("vwlRmScopeFilter")) qs("vwlRmScopeFilter").value = "";
    if (qs("vwlRateStatusFilter")) qs("vwlRateStatusFilter").value = "";
    if (qs("vwlAssignmentStatusFilter"))
      qs("vwlAssignmentStatusFilter").value = "";
    if (qs("vwlShowSplitOnly")) qs("vwlShowSplitOnly").checked = false;

    refreshVwlRmScopeAvailability();
    state.vwl.page = 0;
    syncVwlFilterBadge();
    loadVendorBuylist();
  });

  syncVwlFilterBadge();

  qs("btnVwlBdClose")?.addEventListener("click", closeVwlBreakdownModal);
  qs("vwlBreakdownModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "vwlBreakdownModalBackdrop") closeVwlBreakdownModal();
  });
  qs("btnVwlBdReviewSplit")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const row = state.vwlBreakdownRow;
    if (!row) return;
    closeVwlBreakdownModal();
    openVwlSplitReviewModal(row);
  });

  qs("btnVwlSplitReviewClose")?.addEventListener("click", closeVwlSplitReviewModal);
  qs("btnVwlSplitReviewCancel")?.addEventListener("click", closeVwlSplitReviewModal);
  qs("vwlSplitReviewModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "vwlSplitReviewModalBackdrop") closeVwlSplitReviewModal();
  });
  document.querySelectorAll('input[name="vwlSplitActionMode"]').forEach((el) => {
    el.addEventListener("change", (e) => {
      if (e.target.checked) setVwlSplitActionMode(e.target.value);
    });
  });
  qs("vwlSplitVendorPick")?.addEventListener("change", onVwlSplitVendorPickChange);
  qs("vwlSplitConsolidateIncludeCleared")?.addEventListener("change", () => {
    reloadVwlSplitPreviewFromCheckboxes();
  });
  qs("vwlSplitClearIncludeCleared")?.addEventListener("change", () => {
    reloadVwlSplitPreviewFromCheckboxes();
  });
  qs("btnVwlSplitApply")?.addEventListener("click", submitVwlSplitApply);
  qs("btnVwlSplitActionConfirmClose")?.addEventListener("click", () =>
    closeVwlSplitActionConfirmModal(false),
  );
  qs("btnVwlSplitActionConfirmCancel")?.addEventListener("click", () =>
    closeVwlSplitActionConfirmModal(false),
  );
  qs("btnVwlSplitActionConfirm")?.addEventListener("click", () =>
    closeVwlSplitActionConfirmModal(true),
  );
  qs("vwlSplitActionConfirmModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "vwlSplitActionConfirmModalBackdrop") {
      closeVwlSplitActionConfirmModal(false);
    }
  });
}

(async function main() {
  await requireSession();

  try {
    await loadAccessState();
  } catch (err) {
    console.error(err);
    setStatus("Unable to verify Procurement Execution Console access.", "error");
    const panel = qs("mainPanel");
    if (panel) panel.hidden = true;
    return;
  }

  if (!canAccessModule()) {
    setStatus(
      "You do not have permission to open Procurement Execution Console.",
      "error",
    );
    const panel = qs("mainPanel");
    if (panel) panel.hidden = true;
    return;
  }

  applyPermissionUi();

  document
    .getElementById("homeBtn")
    ?.addEventListener("click", () => Platform.goHome());

  // Safety pass: ensure key icon buttons expose tooltip + label
  ensureIconBtnA11y("btnRefresh", "Refresh");
  ensureIconBtnA11y("iBtnRefresh", "Refresh");
  ensureIconBtnA11y("iBtnNewDraft", "New draft indent");
  ensureIconBtnA11y("iBtnFromPR", "Create indent from PR");
  ensureIconBtnA11y("btnExportPdf", "Export PDF");
  ensureIconBtnA11y("btnExportTsv", "Export TSV");
  ensureIconBtnA11y("btnExportCsv", "Export CSV");
  ensureIconBtnA11y("btnRefreshProcurementSnapshots", "Refresh procurement snapshots");
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
  wireProcurementSnapshotRefreshButton();
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
  wireClearSelectedVendorModalControls();
  setTab(state.tab);
  updateExportButtonStates();
  refreshAllTabCounts();
  applyPermissionUi();
})();







