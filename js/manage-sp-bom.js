/* eslint-env browser */
import { supabase } from "../public/shared/js/supabaseClient.js";

// Elements (reuse RM IDs for minimal HTML changes)
const el = (id) => document.getElementById(id);
const productPicker = el("productPicker"); // Owner picker (SP)
const refQty = el("refQty");
const refUom = el("refUom");
const lossPct = el("lossPct");
const linesBody = el("linesBody");
const qaList = el("qaList");
const qaChip = el("qaChip");
const qaPopover = el("qaPopover");
const toastContainer = el("statusToastContainer");
let activeToast = null;
let activeToastTimer = null;
const pillRefOutput = el("pillRefOutput");
const pillLossPct = el("pillLossPct");
const reloadBtn = el("reloadBtn");
const saveBtn = el("saveBtn");
const cloneBtn = el("cloneBtn");
const deleteBtn = el("deleteBtn");
const editHeaderBtn = el("editHeaderBtn");
const moreMenuBtn = el("moreMenuBtn");
const moreMenu = el("moreMenu");
const exportBtn = el("exportBtn");
// const exportMenu = el("exportMenu"); // menu element resolved by id; variable not needed
const exportCsvBtn = el("exportCsv");
const exportPdfBtn = el("exportPdf");
const exportHtmlBtn = el("exportHtml");
const linesPanel = el("linesPanel");
const linesViewBtn = el("linesViewBtn");
const linesEditBtn = el("linesEditBtn");
const kbHelpBtn = el("kbHelpBtn");
const kbHelpPopover = el("kbHelpPopover");
let LINES_EDIT_MODE = false;

// Permissions
const MODULE_ID = "manage-sp-bom";
let PERM_CAN_VIEW = true;
let PERM_CAN_EDIT = true;

// Horizontal scroll sync
const linesScroll = document.getElementById("linesScroll");
const linesHScrollTop = document.getElementById("linesHScrollTop");
const linesHScrollInner = document.getElementById("linesHScrollInner");
const linesBackToTop = document.getElementById("linesBackToTop");
let _hSyncing = false;

function applyLinesMode() {
  if (linesPanel) {
    if (LINES_EDIT_MODE) linesPanel.classList.remove("view-mode");
    else linesPanel.classList.add("view-mode");
  }
  if (!LINES_EDIT_MODE && kbHelpPopover) kbHelpPopover.style.display = "none";
  renderLines();
}
function applyPermissionUi() {
  if (!PERM_CAN_EDIT) {
    LINES_EDIT_MODE = false;
    applyLinesMode();
    linesEditBtn && (linesEditBtn.style.display = "none");
    linesViewBtn && (linesViewBtn.style.display = "none");
    kbHelpBtn && (kbHelpBtn.style.display = "none");
    document.body.classList.add("no-edit");
    exportBtn && (exportBtn.style.display = "none");
  } else {
    linesEditBtn && (linesEditBtn.style.display = "");
    linesViewBtn && (linesViewBtn.style.display = "");
    kbHelpBtn && (kbHelpBtn.style.display = "");
    document.body.classList.remove("no-edit");
    exportBtn && (exportBtn.style.display = "");
  }
  if (!PERM_CAN_VIEW && exportBtn) exportBtn.style.display = "none";
}

// Modals
const nhModal = el("newHeaderModal");
const nhCloseBtn = el("nhCloseBtn");
const nhCancelBtn = el("nhCancelBtn");
const nhCreateBtn = el("nhCreateBtn");
const nhProduct = el("nhProduct"); // owner in modal
const nhRefQty = el("nhRefQty");
const nhRefUom = el("nhRefUom");
const nhLossPct = el("nhLossPct");
const nhCloneToggle = el("nhCloneToggle");
const nhCloneSection = el("nhCloneSection");
const nhCloneProduct = el("nhCloneProduct");

const pageMask = el("pageMask");
const pageMaskText = el("pageMaskText");

const dhModal = el("deleteHeaderModal");
const dhCloseBtn = el("dhCloseBtn");
const dhCancelBtn = el("dhCancelBtn");
const dhConfirmBtn = el("dhConfirmBtn");
const dhProductName = el("dhProductName");

const dlModal = el("deleteLineModal");
const dlCloseBtn = el("dlCloseBtn");
const dlCancelBtn = el("dlCancelBtn");
const dlConfirmBtn = el("dlConfirmBtn");
const dlText = el("dlText");
let PENDING_DELETE_LINE_INDEX = null;

const insertPopover = el("insertPopover");
const insCountInput = el("insCountInput");
const insCancelBtn = el("insCancelBtn");
const insOkBtn = el("insOkBtn");
let INSERT_TARGET_INDEX = null;
let INSERT_TARGET_MODE = null;

const ehModal = el("editHeaderModal");
const ehCloseBtn = el("ehCloseBtn");
const ehCancelBtn = el("ehCancelBtn");
const ehApplyBtn = el("ehApplyBtn");
const ehRefQty = el("ehRefQty");
const ehRefUom = el("ehRefUom");
const ehLossPct = el("ehLossPct");
const ehNotes = el("ehNotes");

function showMask(msg = "Loading…") {
  pageMaskText && (pageMaskText.textContent = msg);
  pageMask && (pageMask.style.display = "flex");
}
function hideMask() {
  pageMask && (pageMask.style.display = "none");
}

let focusTrapDispose = null;
function trapFocusIn(modalEl) {
  const FOCUSABLE = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");
  const handler = (e) => {
    if (e.key !== "Tab") return;
    const nodes = Array.from(modalEl.querySelectorAll(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null
    );
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey) {
      if (
        document.activeElement === first ||
        !modalEl.contains(document.activeElement)
      ) {
        last.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  };
  modalEl.addEventListener("keydown", handler);
  return () => modalEl.removeEventListener("keydown", handler);
}

// Data caches
let UOMS = [];
let STOCK_ITEMS = []; // generic picker (not restricted to RM)
let OWNERS = []; // SP owners
let CURRENT_OWNER_ID = null;
let CURRENT_HEADER = null;
let CURRENT_LINES = [];
let CURRENT_HEADER_NOTES = "";

function escapeHtml(s = "") {
  return s.replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
  );
}
function blankLine() {
  return {
    stock_item_id: null,
    qty_per_reference_output: null,
    uom_id: null,
    wastage_pct: null,
    is_optional: false,
    remarks: "",
  };
}

/* Load pickers */
async function loadUoms() {
  const { data, error } = await supabase
    .from("inv_uom")
    .select("id, code")
    .order("code", { ascending: true });
  if (error) throw error;
  UOMS = data || [];
  refUom.innerHTML = UOMS.map(
    (u) => `<option value="${u.id}">${u.code}</option>`
  ).join("");
}
async function loadOwners() {
  // Prefer server-provided SP owners view; else fallback to generic stock item picker filtered to RM
  const tryView = await supabase
    .from("v_picker_sp_owners")
    .select("id, label, default_uom_code")
    .order("label", { ascending: true });
  if (!tryView.error && Array.isArray(tryView.data)) {
    OWNERS = tryView.data || [];
  } else {
    const { data, error } = await supabase
      .from("v_stock_item_picker")
      .select(
        "stock_item_id, stock_item_name, stock_item_code, default_uom_code, category_code, active, is_rm"
      )
      .order("stock_item_name", { ascending: true });
    if (error) throw error;
    const rows = (data || []).filter((r) => r.active !== false && r.is_rm);
    OWNERS = rows.map((r) => ({
      id: r.stock_item_id,
      label:
        (r.stock_item_code ? `[${r.stock_item_code}] ` : "") +
        r.stock_item_name,
      default_uom_code: r.default_uom_code || null,
    }));
  }
  productPicker.innerHTML = OWNERS.map(
    (p) => `<option value="${p.id}">${escapeHtml(p.label)}</option>`
  ).join("");
}
// loadStockItems defined later with pagination

/* Rendering */
function renderLines() {
  linesBody.innerHTML = CURRENT_LINES.map((ln, i) => {
    if (!LINES_EDIT_MODE) {
      const item = STOCK_ITEMS.find((x) => x.id === ln.stock_item_id);
      const itemName = item
        ? item.name
        : ln.stock_item_id
        ? `Item #${ln.stock_item_id}`
        : "";
      const itemCode = item?.code || "";
      const u = UOMS.find((u) => u.id === ln.uom_id);
      const uomCode = u ? u.code : "";
      const qtyStr =
        ln.qty_per_reference_output == null
          ? ""
          : String(ln.qty_per_reference_output);
      const wastStr = (() => {
        if (ln.wastage_pct == null) return "";
        const raw = Number(ln.wastage_pct);
        const pct = raw <= 1.5 ? raw * 100 : raw;
        return `${pct.toFixed(2)}%`;
      })();
      const optStr = ln.is_optional ? "Yes" : "No";
      const remStr = escapeHtml(ln.remarks || "");
      return `
      <tr data-i="${i}">
        <td class="nowrap">${i + 1}</td>
        <td class="nowrap code-cell">${escapeHtml(itemCode)}</td>
        <td class="item-cell">${escapeHtml(itemName)}</td>
        <td>${escapeHtml(qtyStr)}</td>
        <td>${escapeHtml(uomCode)}</td>
        <td>${escapeHtml(wastStr)}</td>
        <td>${optStr}</td>
        <td>${remStr}</td>
        <td></td>
      </tr>`;
    }
    const itemOptions = [`<option value="">— select —</option>`]
      .concat(
        STOCK_ITEMS.map(
          (x) =>
            `<option value="${x.id}" ${
              x.id === ln.stock_item_id ? "selected" : ""
            }>${escapeHtml(x.name)}</option>`
        )
      )
      .join("");
    const uomOptions = [`<option value="">— select —</option>`]
      .concat(
        UOMS.map(
          (u) =>
            `<option value="${u.id}" ${u.id === ln.uom_id ? "selected" : ""}>${
              u.code
            }</option>`
        )
      )
      .join("");
    const itemCode =
      STOCK_ITEMS.find((x) => x.id === ln.stock_item_id)?.code || "";
    return `
      <tr data-i="${i}">
        <td class="nowrap">${i + 1}</td>
        <td class="nowrap code-cell">${escapeHtml(itemCode)}</td>
        <td class="item-cell"><select class="cell item">${itemOptions}</select></td>
        <td class="right"><input class="cell qty" type="number" step="0.0001" min="0" value="${
          ln.qty_per_reference_output ?? ""
        }" /></td>
        <td><select class="cell uom">${uomOptions}</select></td>
        <td class="right"><input class="cell wast" type="number" step="0.0001" min="0" max="0.9999" value="${
          ln.wastage_pct ?? ""
        }" /></td>
        <td><input type="checkbox" class="cell opt" ${
          ln.is_optional ? "checked" : ""
        } /></td>
        <td><input type="text" class="cell rem" value="${escapeHtml(
          ln.remarks || ""
        )}" /></td>
        <td>
          <div class="row-actions">
            <button class="icon-btn small" data-act="up" title="Move up" aria-label="Move up"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg></button>
            <button class="icon-btn small" data-act="down" title="Move down" aria-label="Move down"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>
            <button class="icon-btn small" data-act="insAbove" title="Insert rows above" aria-label="Insert rows above"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v8"/><path d="M8 9h8"/></svg></button>
            <button class="icon-btn small" data-act="insBelow" title="Insert rows below" aria-label="Insert rows below"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19v-8"/><path d="M8 15h8"/></svg></button>
            <button class="icon-btn small" data-act="del" title="Delete row" aria-label="Delete row"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
          </div>
        </td>
      </tr>`;
  }).join("");
  if (LINES_EDIT_MODE) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="9" style="text-align:center; padding:10px;"><button class="icon-btn small" data-act="addEnd" title="Add row" aria-label="Add row"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg></button><span class="hint" style="margin-left:6px; color:#64748b; font-size:12px;">Add new row</span></td>`;
    linesBody.appendChild(tr);
  }
  const scrollWrap = linesScroll;
  if (scrollWrap && !scrollWrap.dataset.shadowBound) {
    scrollWrap.addEventListener("scroll", () => {
      if (scrollWrap.scrollTop > 2) scrollWrap.classList.add("scrolled");
      else scrollWrap.classList.remove("scrolled");
      if (!_hSyncing && linesHScrollTop) {
        _hSyncing = true;
        linesHScrollTop.scrollLeft = scrollWrap.scrollLeft;
        _hSyncing = false;
      }
      if (linesBackToTop) {
        if (scrollWrap.scrollTop > 120) linesBackToTop.classList.add("show");
        else linesBackToTop.classList.remove("show");
      }
    });
    scrollWrap.dataset.shadowBound = "1";
  }
  setupHorizontalScrollSync();
}
function setupHorizontalScrollSync() {
  if (!linesScroll || !linesHScrollTop || !linesHScrollInner) return;
  const needH = linesScroll.scrollWidth > linesScroll.clientWidth + 1;
  if (needH) {
    linesHScrollTop.classList.add("visible");
    linesHScrollInner.style.width = `${linesScroll.scrollWidth}px`;
  } else {
    linesHScrollTop.classList.remove("visible");
    linesHScrollInner.style.width = "0px";
  }
  if (!linesHScrollTop.dataset.bound) {
    linesHScrollTop.addEventListener("scroll", () => {
      if (_hSyncing) return;
      _hSyncing = true;
      linesScroll.scrollLeft = linesHScrollTop.scrollLeft;
      _hSyncing = false;
    });
    linesHScrollTop.dataset.bound = "1";
  }
}

function collectHeader() {
  const percentVal = lossPct.value === "" ? null : parseFloat(lossPct.value);
  return {
    reference_output_qty: refQty.value ? parseFloat(refQty.value) : null,
    reference_output_uom_id: refUom.value ? parseInt(refUom.value, 10) : null,
    process_loss_pct: percentVal == null ? null : percentVal / 100,
  };
}
function collectLines() {
  return Array.from(linesBody.querySelectorAll("tr[data-i]"))
    .map((tr) => parseInt(tr.dataset.i, 10))
    .filter((i) => Number.isFinite(i) && i >= 0 && i < CURRENT_LINES.length)
    .map((i) => ({ ...CURRENT_LINES[i] }));
}

function updateHeaderPills() {
  const q = refQty.value === "" ? null : parseFloat(refQty.value);
  const uId = refUom.value ? parseInt(refUom.value, 10) : null;
  const u = UOMS.find((x) => x.id === uId);
  if (pillRefOutput) {
    if (q == null || !u) {
      pillRefOutput.textContent = "—";
      pillRefOutput.setAttribute("data-state", "empty");
    } else {
      pillRefOutput.textContent = `${q.toFixed(3)} ${u.code}`;
      pillRefOutput.removeAttribute("data-state");
    }
  }
  const p = lossPct.value === "" ? null : parseFloat(lossPct.value);
  if (pillLossPct) {
    if (p == null) {
      pillLossPct.textContent = "—";
      pillLossPct.setAttribute("data-state", "empty");
    } else {
      pillLossPct.textContent = `${p.toFixed(2)}%`;
      pillLossPct.removeAttribute("data-state");
    }
  }
}

function renderQA() {
  const issues = [];
  const h = collectHeader();
  const percentVal = lossPct.value === "" ? null : parseFloat(lossPct.value);
  if (!h.reference_output_qty || h.reference_output_qty <= 0)
    issues.push("Header: reference output qty must be > 0");
  if (!h.reference_output_uom_id)
    issues.push("Header: reference output UOM required");
  if (percentVal != null && (percentVal < 0 || percentVal > 100))
    issues.push("Header: process loss % must be between 0 and 100");
  const lines = collectLines();
  if (!lines.length) issues.push("No lines defined");
  lines.forEach((ln, i) => {
    if (!ln.stock_item_id) issues.push(`Line ${i + 1}: stock item required`);
    if (!ln.uom_id) issues.push(`Line ${i + 1}: UOM required`);
    if (ln.qty_per_reference_output == null || ln.qty_per_reference_output <= 0)
      issues.push(`Line ${i + 1}: qty per reference must be > 0`);
  });
  qaList &&
    (qaList.innerHTML = issues.length
      ? issues.map((m) => `<li class="danger">${escapeHtml(m)}</li>`).join("")
      : '<li class="success">Looks good ✅</li>');
  if (qaChip) {
    qaChip.style.display = "inline-flex";
    if (issues.length) {
      qaChip.classList.remove("ok");
      qaChip.classList.add("warn");
      qaChip.querySelector(".qa-icon").innerHTML =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
      qaChip.setAttribute("aria-label", `Validation issues: ${issues.length}`);
    } else {
      qaChip.classList.remove("warn");
      qaChip.classList.add("ok");
      qaChip.querySelector(".qa-icon").innerHTML =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      qaChip.setAttribute("aria-label", "All checks passed");
    }
  }
  if (qaPopover) {
    if (issues.length)
      qaPopover.innerHTML = `<button type="button" class="qa-popover-close" aria-label="Close">×</button><h4 id="qaPopoverTitle">Validation Issues (${
        issues.length
      })</h4><ul class="qa-issues">${issues
        .map((m) => `<li class="danger">${escapeHtml(m)}</li>`)
        .join("")}</ul>`;
    else
      qaPopover.innerHTML = `<button type="button" class="qa-popover-close" aria-label="Close">×</button><h4 id="qaPopoverTitle">All Checks Passed</h4><p class="success-msg">No validation issues detected.</p>`;
  }
  return issues;
}

function setStatus(msg, kind = "info", timeoutMs = 5000) {
  if (!toastContainer) return;
  if (!msg) {
    if (activeToastTimer) {
      clearTimeout(activeToastTimer);
      activeToastTimer = null;
    }
    if (activeToast) {
      activeToast.remove();
      activeToast = null;
    }
    return;
  }
  if (!activeToast) {
    activeToast = document.createElement("div");
    toastContainer.innerHTML = "";
    toastContainer.appendChild(activeToast);
  }
  activeToast.className = `toast ${kind}`;
  activeToast.innerHTML = `<div style="flex:1">${escapeHtml(
    msg
  )}</div><button class="toast-close" aria-label="Dismiss">×</button>`;
  const closeBtn = activeToast.querySelector(".toast-close");
  closeBtn.addEventListener("click", () => {
    if (activeToastTimer) {
      clearTimeout(activeToastTimer);
      activeToastTimer = null;
    }
    if (activeToast) {
      activeToast.remove();
      activeToast = null;
    }
  });
  if (activeToastTimer) {
    clearTimeout(activeToastTimer);
    activeToastTimer = null;
  }
  if (timeoutMs) {
    activeToastTimer = setTimeout(() => {
      if (!activeToast) return;
      activeToast.style.opacity = "0";
      setTimeout(() => {
        activeToast?.remove?.();
        activeToast = null;
      }, 250);
    }, timeoutMs);
  }
}

/* Data IO for SP BOM */
async function loadStockItems() {
  // Try paged load from v_stock_item_picker with RM filter
  const pageSize = 1000;
  let from = 0;
  let all = [];
  // try paginated view first; on error fall back to base tables
  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("v_stock_item_picker")
      .select("stock_item_id, stock_item_name, stock_item_code, active, is_rm")
      .eq("active", true)
      .eq("is_rm", true)
      .order("stock_item_name", { ascending: true })
      .range(from, to);
    if (error) {
      all = [];
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  if (all.length) {
    STOCK_ITEMS = all.map((r) => ({
      id: r.stock_item_id,
      name: r.stock_item_name,
      code: r.stock_item_code || null,
    }));
    return;
  }
  // Fallback: paginate base table with category join, then filter to RM
  from = 0;
  all = [];
  while (true) {
    const to = from + pageSize - 1;
    const { data: rows, error: err2 } = await supabase
      .from("inv_stock_item")
      .select(
        "id,name,code,inv_stock_item_class_map(category_id, inv_class_category(code))"
      )
      .order("name", { ascending: true })
      .range(from, to);
    if (err2) throw err2;
    if (!rows || rows.length === 0) break;
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  STOCK_ITEMS = all
    .filter((r) => {
      const maps = r.inv_stock_item_class_map;
      if (!Array.isArray(maps)) return false;
      return maps.some((m) => m.inv_class_category?.code === "RM");
    })
    .map((r) => ({ id: r.id, name: r.name, code: r.code || null }));
}

async function loadBom(ownerId) {
  // Header
  const { data: hdr, error: hdrErr } = await supabase
    .from("sp_bom_header")
    .select(
      "id, reference_output_qty, reference_output_uom_id, process_loss_pct, notes"
    )
    .eq("owner_item_id", ownerId)
    .maybeSingle();
  if (hdrErr) throw hdrErr;
  CURRENT_HEADER = hdr || null;
  CURRENT_HEADER_NOTES = hdr?.notes || "";

  // Lines
  let lines = [];
  if (CURRENT_HEADER?.id) {
    const { data: lnRows, error: lnErr } = await supabase
      .from("sp_bom_line")
      .select(
        "stock_item_id, qty_per_reference_output, uom_id, wastage_pct, is_optional, remarks"
      )
      .eq("sp_bom_id", CURRENT_HEADER.id)
      .order("line_no", { ascending: true });
    if (lnErr) throw lnErr;
    lines = lnRows || [];
  }
  CURRENT_LINES = lines.length ? lines : [blankLine()];

  await ensureMissingStockItems();

  // Seed header UI
  if (CURRENT_HEADER) {
    refQty.value = CURRENT_HEADER.reference_output_qty ?? "";
    refUom.value = CURRENT_HEADER.reference_output_uom_id ?? "";
    if (CURRENT_HEADER.process_loss_pct == null) {
      lossPct.value = "";
    } else {
      const raw = Number(CURRENT_HEADER.process_loss_pct);
      const displayPct = raw <= 1.5 ? raw * 100 : raw;
      lossPct.value = displayPct.toFixed(2);
    }
  } else {
    refQty.value = "1";
    lossPct.value = "";
    const owner = OWNERS.find((p) => p.id === ownerId);
    if (owner?.default_uom_code) {
      const match = UOMS.find(
        (u) => u.code.toLowerCase() === owner.default_uom_code.toLowerCase()
      );
      if (match) refUom.value = match.id;
    }
  }

  renderLines();
  renderQA();
  updateHeaderPills();
  deleteBtn && (deleteBtn.disabled = !CURRENT_HEADER);
  editHeaderBtn && (editHeaderBtn.disabled = !ownerId);
  if (typeof syncMenuState === "function") syncMenuState();
}

async function saveBom() {
  const issues = renderQA();
  if (issues.length)
    return setStatus("Fix validation issues before saving.", "error");
  const header = collectHeader();
  const lines = collectLines();
  saveBtn.disabled = true;
  deleteBtn && (deleteBtn.disabled = true);
  editHeaderBtn && (editHeaderBtn.disabled = true);
  setStatus("Saving…");
  try {
    // Upsert header
    const u = UOMS.find((x) => x.id === header.reference_output_uom_id);
    const uomCode = u ? u.code : null;
    if (!uomCode) throw new Error("Reference Output UOM invalid.");
    const { error: upHdrErr } = await supabase.rpc("rpc_sp_bom_upsert_header", {
      p_owner_item_id: CURRENT_OWNER_ID,
      p_reference_output_qty: header.reference_output_qty,
      p_reference_output_uom: uomCode,
      p_process_loss_pct: header.process_loss_pct,
      p_notes: null,
    });
    if (upHdrErr) throw upHdrErr;

    // Fetch existing lines to compute deletes
    const { data: dbLines, error: listErr } = await supabase.rpc(
      "rpc_sp_bom_list_lines",
      { p_owner_item_id: CURRENT_OWNER_ID }
    );
    if (listErr) throw listErr;
    const toKey = (sid, uid) => `${sid}::${uid}`;
    const dbKeys = new Set(
      (dbLines || []).map((r) => toKey(r.stock_item_id, r.uom_id))
    );
    const newKeys = new Set(lines.map((l) => toKey(l.stock_item_id, l.uom_id)));

    // Deletes (present in DB but not in new set)
    const delTasks = [];
    for (const key of dbKeys) {
      if (!newKeys.has(key)) {
        const [sidStr, uidStr] = key.split("::");
        const sid = parseInt(sidStr, 10);
        const uid = parseInt(uidStr, 10);
        const uom = UOMS.find((x) => x.id === uid);
        if (sid && uom) {
          delTasks.push(
            supabase.rpc("rpc_sp_bom_delete_line", {
              p_owner_item_id: CURRENT_OWNER_ID,
              p_stock_item_id: sid,
              p_uom_code: uom.code,
            })
          );
        }
      }
    }
    if (delTasks.length) await Promise.all(delTasks);

    // Upserts (for all lines)
    const upTasks = lines.map((l) => {
      const u = UOMS.find((x) => x.id === l.uom_id);
      const code = u ? u.code : null;
      if (!l.stock_item_id || !code || !l.qty_per_reference_output)
        return Promise.resolve({});
      return supabase.rpc("rpc_sp_bom_upsert_line", {
        p_owner_item_id: CURRENT_OWNER_ID,
        p_stock_item_id: l.stock_item_id,
        p_qty: l.qty_per_reference_output,
        p_uom_code: code,
        p_wastage_pct: l.wastage_pct,
        p_is_optional: l.is_optional,
        p_remarks: l.remarks || null,
      });
    });
    await Promise.all(upTasks);

    // Renumber
    const { error: renErr } = await supabase.rpc("rpc_sp_bom_renumber", {
      p_owner_item_id: CURRENT_OWNER_ID,
    });
    if (renErr) throw renErr;

    setStatus("Saved successfully.", "success");
    await loadBom(CURRENT_OWNER_ID);
  } catch (e) {
    console.error(e);
    setStatus(`Save failed: ${e.message}`, "error");
  } finally {
    saveBtn.disabled = false;
    deleteBtn && (deleteBtn.disabled = !CURRENT_HEADER);
    editHeaderBtn && (editHeaderBtn.disabled = !CURRENT_OWNER_ID);
    if (typeof syncMenuState === "function") syncMenuState();
  }
}

/* Events */
productPicker.addEventListener("change", async () => {
  CURRENT_OWNER_ID = parseInt(productPicker.value, 10);
  setStatus("");
  showMask("Loading…");
  try {
    await loadBom(CURRENT_OWNER_ID);
  } finally {
    hideMask();
  }
});
[refQty, refUom, lossPct].forEach((inp) =>
  inp.addEventListener("input", renderQA)
);

linesBody.addEventListener("change", (e) => {
  if (!LINES_EDIT_MODE) return;
  const tr = e.target.closest("tr");
  if (!tr) return;
  const i = parseInt(tr.dataset.i, 10);
  const ln = CURRENT_LINES[i];
  if (e.target.classList.contains("item"))
    ln.stock_item_id = e.target.value ? parseInt(e.target.value, 10) : null;
  if (e.target.classList.contains("item")) {
    const it = STOCK_ITEMS.find((x) => x.id === ln.stock_item_id);
    const codeTd = tr.querySelector(".code-cell");
    if (codeTd) codeTd.textContent = it?.code || "";
  }
  if (e.target.classList.contains("qty"))
    ln.qty_per_reference_output =
      e.target.value === "" ? null : parseFloat(e.target.value);
  if (e.target.classList.contains("uom"))
    ln.uom_id = e.target.value ? parseInt(e.target.value, 10) : null;
  if (e.target.classList.contains("wast"))
    ln.wastage_pct = e.target.value === "" ? null : parseFloat(e.target.value);
  if (e.target.classList.contains("opt")) ln.is_optional = e.target.checked;
  if (e.target.classList.contains("rem")) ln.remarks = e.target.value || null;
  renderQA();
});
let FOCUSED_ROW_INDEX = null;
linesBody.addEventListener("focusin", (e) => {
  const tr = e.target.closest("tr[data-i]");
  if (tr) FOCUSED_ROW_INDEX = parseInt(tr.dataset.i, 10);
});
linesBody.addEventListener("click", (e) => {
  const tr = e.target.closest("tr[data-i]");
  if (tr) FOCUSED_ROW_INDEX = parseInt(tr.dataset.i, 10);
});

linesBody.addEventListener("click", (e) => {
  if (!LINES_EDIT_MODE) return;
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const act = btn.dataset.act;
  if (act === "addEnd") {
    CURRENT_LINES.push(blankLine());
    renderLines();
    renderQA();
    return;
  }
  const tr = e.target.closest("tr[data-i]");
  if (!tr) return;
  const i = parseInt(tr.dataset.i, 10);
  FOCUSED_ROW_INDEX = i;
  switch (act) {
    case "del": {
      PENDING_DELETE_LINE_INDEX = i;
      dlText && (dlText.textContent = `Delete line ${i + 1}?`);
      if (dlModal) {
        dlModal.style.display = "flex";
        if (focusTrapDispose) focusTrapDispose();
        focusTrapDispose = trapFocusIn(dlModal);
      }
      break;
    }
    case "up": {
      if (i > 0) {
        const tmp = CURRENT_LINES[i - 1];
        CURRENT_LINES[i - 1] = CURRENT_LINES[i];
        CURRENT_LINES[i] = tmp;
        renderLines();
        renderQA();
        setStatus("Line moved up.", "success", 1800);
        FOCUSED_ROW_INDEX = i - 1;
      }
      break;
    }
    case "down": {
      if (i < CURRENT_LINES.length - 1) {
        const tmp = CURRENT_LINES[i + 1];
        CURRENT_LINES[i + 1] = CURRENT_LINES[i];
        CURRENT_LINES[i] = tmp;
        renderLines();
        renderQA();
        setStatus("Line moved down.", "success", 1800);
        FOCUSED_ROW_INDEX = i + 1;
      }
      break;
    }
    case "insAbove": {
      openInsertPopover(btn, i, "above");
      break;
    }
    case "insBelow": {
      openInsertPopover(btn, i, "below");
      break;
    }
    default:
      break;
  }
});

reloadBtn.addEventListener("click", async () => {
  if (CURRENT_OWNER_ID) {
    showMask("Refreshing…");
    try {
      await loadBom(CURRENT_OWNER_ID);
    } finally {
      hideMask();
    }
  }
});
saveBtn.addEventListener("click", saveBom);

// QA chip popover wiring (same as RM)
if (qaChip && qaPopover) {
  let qaHideTimer = null;
  function positionQaPopover() {
    const rect = qaChip.getBoundingClientRect();
    const top = rect.bottom + 6 + window.scrollY;
    const left = rect.left + rect.width / 2 + window.scrollX;
    qaPopover.style.top = `${top}px`;
    qaPopover.style.left = `${Math.max(8, left - qaPopover.offsetWidth / 2)}px`;
  }
  function showQaPopover() {
    if (qaHideTimer) {
      clearTimeout(qaHideTimer);
      qaHideTimer = null;
    }
    if (qaPopover.style.display === "none") {
      qaPopover.style.display = "block";
      qaChip.setAttribute("aria-expanded", "true");
      positionQaPopover();
    } else positionQaPopover();
  }
  function hideQaPopover(force = false) {
    if (force) {
      qaPopover.style.display = "none";
      qaChip.setAttribute("aria-expanded", "false");
      return;
    }
    qaHideTimer = setTimeout(() => {
      qaPopover.style.display = "none";
      qaChip.setAttribute("aria-expanded", "false");
    }, 160);
  }
  qaChip.addEventListener("mouseenter", showQaPopover);
  qaChip.addEventListener("focus", showQaPopover);
  qaChip.addEventListener("mouseleave", () => hideQaPopover());
  qaChip.addEventListener("blur", () => hideQaPopover());
  qaChip.addEventListener("click", () => {
    if (qaPopover.style.display === "none") showQaPopover();
    else hideQaPopover(true);
  });
  qaPopover.addEventListener("mouseenter", () => {
    if (qaHideTimer) {
      clearTimeout(qaHideTimer);
      qaHideTimer = null;
    }
  });
  qaPopover.addEventListener("mouseleave", () => hideQaPopover());
  qaPopover.addEventListener("click", (e) => {
    const btn = e.target.closest(".qa-popover-close");
    if (btn) hideQaPopover(true);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && qaPopover.style.display !== "none") {
      hideQaPopover(true);
      qaChip.focus();
    }
  });
  window.addEventListener(
    "scroll",
    () => {
      if (qaPopover.style.display !== "none") positionQaPopover();
    },
    { passive: true }
  );
}

if (linesBackToTop && linesScroll) {
  linesBackToTop.addEventListener("click", () => {
    linesScroll.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// Edit header modal
function openEditHeaderModal() {
  ehRefUom.innerHTML = UOMS.map(
    (u) => `<option value="${u.id}">${u.code}</option>`
  ).join("");
  ehRefQty.value = refQty.value || "";
  ehRefUom.value = refUom.value || "";
  ehLossPct.value = lossPct.value || "";
  ehNotes.value = CURRENT_HEADER_NOTES || "";
  ehModal.style.display = "flex";
  if (focusTrapDispose) focusTrapDispose();
  focusTrapDispose = trapFocusIn(ehModal);
  ehRefQty.focus();
  const onKey = (e) => {
    if (e.key === "Escape" && ehModal.style.display === "flex")
      closeEditHeaderModal();
  };
  document.addEventListener("keydown", onKey, { once: true });
  ehModal.addEventListener(
    "click",
    (e) => {
      if (e.target === ehModal) closeEditHeaderModal();
    },
    { once: true }
  );
}
function closeEditHeaderModal() {
  ehModal.style.display = "none";
  if (focusTrapDispose) {
    focusTrapDispose();
    focusTrapDispose = null;
  }
}
editHeaderBtn && editHeaderBtn.addEventListener("click", openEditHeaderModal);
ehCloseBtn && ehCloseBtn.addEventListener("click", closeEditHeaderModal);
if (ehCancelBtn)
  ehCancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    closeEditHeaderModal();
  });
if (ehApplyBtn)
  ehApplyBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const q = ehRefQty.value === "" ? null : parseFloat(ehRefQty.value);
    const u = ehRefUom.value ? parseInt(ehRefUom.value, 10) : null;
    const p = ehLossPct.value === "" ? null : parseFloat(ehLossPct.value);
    if (!q || q <= 0) return alert("Reference Output Qty must be > 0.");
    if (!u) return alert("Reference Output UOM required.");
    if (p != null && (p < 0 || p > 100))
      return alert("Process Loss % must be between 0 and 100.");
    refQty.value = q.toFixed(3);
    refUom.value = String(u);
    lossPct.value = p == null ? "" : p.toFixed(2);
    CURRENT_HEADER_NOTES = ehNotes.value || "";
    closeEditHeaderModal();
    renderQA();
    updateHeaderPills();
    setStatus("Header updated. Press Save to persist.", "info");
    if (typeof syncMenuState === "function") syncMenuState();
  });

// New header / clone modal
function openNewHeaderModal() {
  nhProduct.innerHTML = "<option value=''>— select owner —</option>";
  loadOwnersWithoutHeader().then((list) => {
    nhProduct.innerHTML =
      "<option value=''>— select owner —</option>" +
      list
        .map((p) => `<option value="${p.id}">${escapeHtml(p.label)}</option>`)
        .join("");
    const msgDiv = nhProduct.parentElement.querySelector(".muted, .danger");
    if (!list.length) {
      nhCreateBtn.disabled = true;
      nhProduct.disabled = true;
      if (msgDiv) {
        msgDiv.textContent = "All selected owners already have BOM headers.";
        msgDiv.classList.remove("muted");
        msgDiv.classList.add("danger");
      }
    } else {
      nhCreateBtn.disabled = false;
      nhProduct.disabled = false;
      if (msgDiv) {
        msgDiv.textContent = "Choose the owner for the new header.";
        msgDiv.classList.remove("danger");
        msgDiv.classList.add("muted");
      }
    }
  });
  nhRefUom.innerHTML = UOMS.map(
    (u) => `<option value="${u.id}">${u.code}</option>`
  ).join("");
  if (CURRENT_OWNER_ID) nhProduct.value = String(CURRENT_OWNER_ID);
  nhRefQty.value = "1.000";
  nhLossPct.value = "";
  nhCloneToggle.checked = false;
  nhCloneSection.style.display = "none";
  populateCloneSources(nhProduct.value ? parseInt(nhProduct.value, 10) : null);
  nhModal.style.display = "flex";
  nhProduct.focus();
  if (focusTrapDispose) {
    focusTrapDispose();
  }
  focusTrapDispose = trapFocusIn(nhModal);
}
function closeNewHeaderModal() {
  nhModal.style.display = "none";
  if (focusTrapDispose) {
    focusTrapDispose();
    focusTrapDispose = null;
  }
}
function openDeleteHeaderModal() {
  if (!CURRENT_OWNER_ID) return;
  const owner = OWNERS.find((p) => p.id === CURRENT_OWNER_ID);
  if (dhProductName)
    dhProductName.textContent = owner ? owner.label : `ID ${CURRENT_OWNER_ID}`;
  dhModal.style.display = "flex";
  dhConfirmBtn.disabled = false;
  if (focusTrapDispose) {
    focusTrapDispose();
  }
  focusTrapDispose = trapFocusIn(dhModal);
  (dhCancelBtn || dhConfirmBtn || dhCloseBtn)?.focus?.();
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dhModal.style.display === "flex")
      closeDeleteHeaderModal();
  });
  dhModal.addEventListener("click", (e) => {
    if (e.target === dhModal) closeDeleteHeaderModal();
  });
}
function closeDeleteHeaderModal() {
  dhModal.style.display = "none";
  if (focusTrapDispose) {
    focusTrapDispose();
    focusTrapDispose = null;
  }
}
cloneBtn.addEventListener("click", () => openNewHeaderModal());
deleteBtn.addEventListener("click", () => openDeleteHeaderModal());
nhCloseBtn.addEventListener("click", closeNewHeaderModal);
nhCancelBtn.addEventListener("click", (e) => {
  e.preventDefault();
  closeNewHeaderModal();
});
nhCloneToggle.addEventListener("change", () => {
  nhCloneSection.style.display = nhCloneToggle.checked ? "block" : "none";
});
nhProduct.addEventListener("change", () => {
  const targetId = nhProduct.value ? parseInt(nhProduct.value, 10) : null;
  populateCloneSources(targetId);
});
nhModal.addEventListener("click", (e) => {
  if (e.target === nhModal) closeNewHeaderModal();
});

if (dhCloseBtn) dhCloseBtn.addEventListener("click", closeDeleteHeaderModal);
if (dhCancelBtn)
  dhCancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    closeDeleteHeaderModal();
  });
if (dhConfirmBtn)
  dhConfirmBtn.addEventListener("click", async () => {
    if (!CURRENT_OWNER_ID) return;
    dhConfirmBtn.disabled = true;
    deleteBtn && (deleteBtn.disabled = true);
    editHeaderBtn && (editHeaderBtn.disabled = true);
    showMask("Deleting…");
    try {
      const { data: hdr, error: findErr } = await supabase
        .from("sp_bom_header")
        .select("id")
        .eq("owner_item_id", CURRENT_OWNER_ID)
        .maybeSingle();
      if (findErr) throw findErr;
      if (hdr?.id) {
        const { error } = await supabase
          .from("sp_bom_header")
          .delete()
          .eq("id", hdr.id);
        if (error) {
          console.error(error);
          setStatus(`Delete failed: ${error.message}`, "error");
        } else {
          setStatus("Header deleted.", "success");
          CURRENT_HEADER = null;
          CURRENT_LINES = [blankLine()];
          await loadBom(CURRENT_OWNER_ID);
        }
      }
    } finally {
      hideMask();
      closeDeleteHeaderModal();
      deleteBtn && (deleteBtn.disabled = !CURRENT_HEADER);
      editHeaderBtn && (editHeaderBtn.disabled = !CURRENT_OWNER_ID);
      if (typeof syncMenuState === "function") syncMenuState();
    }
  });

nhCreateBtn.addEventListener("click", async () => {
  const ownerId = parseInt(nhProduct.value, 10);
  if (!ownerId) return alert("Select an owner for the new header.");
  const refQtyVal = nhRefQty.value ? parseFloat(nhRefQty.value) : null;
  const refUomId = nhRefUom.value ? parseInt(nhRefUom.value, 10) : null;
  const lossVal = nhLossPct.value === "" ? null : parseFloat(nhLossPct.value);
  if (!refQtyVal || refQtyVal <= 0)
    return alert("Reference Output Qty must be > 0.");
  if (!refUomId) return alert("Reference Output UOM required.");
  if (lossVal != null && (lossVal < 0 || lossVal > 100))
    return alert("Process Loss % must be between 0 and 100.");

  const { data: existingHdr } = await supabase
    .from("sp_bom_header")
    .select("id")
    .eq("owner_item_id", ownerId)
    .limit(1)
    .maybeSingle();
  if (existingHdr?.id) {
    const proceed = confirm(
      "A BOM already exists for this owner. Initialize new unsaved header anyway?"
    );
    if (!proceed) return;
  }

  CURRENT_OWNER_ID = ownerId;
  productPicker.value = String(ownerId);
  CURRENT_HEADER = null;
  refQty.value = refQtyVal.toFixed(3);
  refUom.value = refUomId;
  lossPct.value = lossVal == null ? "" : lossVal.toFixed(2);
  CURRENT_LINES = [blankLine()];

  if (nhCloneToggle.checked && nhCloneProduct.value) {
    const sourceId = parseInt(nhCloneProduct.value, 10);
    if (sourceId && sourceId !== ownerId) {
      const { data: sh, error: e1 } = await supabase
        .from("sp_bom_header")
        .select("id")
        .eq("owner_item_id", sourceId)
        .maybeSingle();
      if (!e1 && sh?.id) {
        const { data: sl, error: e2 } = await supabase
          .from("sp_bom_line")
          .select(
            "stock_item_id, qty_per_reference_output, uom_id, wastage_pct, is_optional, remarks"
          )
          .eq("sp_bom_id", sh.id)
          .order("line_no", { ascending: true });
        if (!e2 && sl && sl.length) CURRENT_LINES = sl;
      }
    }
  }
  await ensureMissingStockItems();
  closeNewHeaderModal();
  renderLines();
  renderQA();
  updateHeaderPills();
  setStatus("Initialized new unsaved header.", "info");
  if (typeof syncMenuState === "function") syncMenuState();
});

/* Delete line modal handlers */
function closeDeleteLineModal() {
  if (dlModal) dlModal.style.display = "none";
  if (focusTrapDispose) {
    focusTrapDispose();
    focusTrapDispose = null;
  }
  PENDING_DELETE_LINE_INDEX = null;
}
if (dlCloseBtn) dlCloseBtn.addEventListener("click", closeDeleteLineModal);
if (dlCancelBtn)
  dlCancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    closeDeleteLineModal();
  });
if (dlConfirmBtn)
  dlConfirmBtn.addEventListener("click", () => {
    if (PENDING_DELETE_LINE_INDEX != null) {
      CURRENT_LINES.splice(PENDING_DELETE_LINE_INDEX, 1);
      if (!CURRENT_LINES.length) CURRENT_LINES.push(blankLine());
      renderLines();
      renderQA();
      setStatus("Line deleted.", "success", 2500);
    }
    closeDeleteLineModal();
  });

/* Insert popover logic (same as RM) */
let insertPopoverResizeHandler = null;
function positionInsertPopover(anchorBtn) {
  if (!insertPopover || !anchorBtn) return;
  const anchorRect = anchorBtn.getBoundingClientRect();
  const card = linesPanel || anchorBtn.closest(".panel");
  insertPopover.style.top = "0px";
  insertPopover.style.left = "0px";
  const popW = insertPopover.offsetWidth || 200;
  const popH = insertPopover.offsetHeight || 140;
  const cardRect = card
    ? card.getBoundingClientRect()
    : { left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight };
  let top = anchorRect.bottom + 6;
  let left = anchorRect.left - 40;
  if (top + popH > cardRect.bottom - 8) top = anchorRect.top - popH - 8;
  const minTop = Math.max(cardRect.top + 8, 8);
  const maxTop = Math.min(
    cardRect.bottom - popH - 8,
    window.innerHeight - popH - 8
  );
  top = Math.min(Math.max(top, minTop), maxTop);
  const minLeft = Math.max(cardRect.left + 8, 8);
  const maxLeft = Math.min(
    cardRect.right - popW - 8,
    window.innerWidth - popW - 8
  );
  left = Math.min(Math.max(left, minLeft), maxLeft);
  insertPopover.style.top = `${top + window.scrollY}px`;
  insertPopover.style.left = `${left + window.scrollX}px`;
}
function openInsertPopover(anchorBtn, index, mode) {
  if (!insertPopover) return;
  INSERT_TARGET_INDEX = index;
  INSERT_TARGET_MODE = mode;
  insertPopover.style.display = "block";
  positionInsertPopover(anchorBtn);
  if (window.innerWidth < 600) insertPopover.classList.add("compact");
  else insertPopover.classList.remove("compact");
  if (insCountInput) insCountInput.value = "1";
  setTimeout(() => insCountInput?.focus(), 10);
  const onDoc = (e) => {
    if (!insertPopover.contains(e.target) && e.target !== anchorBtn) {
      closeInsertPopover();
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
      if (insertPopoverResizeHandler) {
        window.removeEventListener("resize", insertPopoverResizeHandler);
        insertPopoverResizeHandler = null;
      }
    }
  };
  const onEsc = (e) => {
    if (e.key === "Escape") {
      closeInsertPopover();
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
      if (insertPopoverResizeHandler) {
        window.removeEventListener("resize", insertPopoverResizeHandler);
        insertPopoverResizeHandler = null;
      }
    }
  };
  insertPopoverResizeHandler = () => {
    if (insertPopover.style.display === "block")
      positionInsertPopover(anchorBtn);
  };
  window.addEventListener("resize", insertPopoverResizeHandler);
  document.addEventListener("mousedown", onDoc);
  document.addEventListener("keydown", onEsc);
}
function closeInsertPopover() {
  if (insertPopover) insertPopover.style.display = "none";
  INSERT_TARGET_INDEX = null;
  INSERT_TARGET_MODE = null;
  if (insertPopoverResizeHandler) {
    window.removeEventListener("resize", insertPopoverResizeHandler);
    insertPopoverResizeHandler = null;
  }
}
function performInsertRows(count) {
  if (INSERT_TARGET_INDEX == null || !INSERT_TARGET_MODE) return;
  const n = Math.min(Math.max(count, 1), 100);
  if (n > 0) {
    const arr = Array.from({ length: n }, () => blankLine());
    const pos =
      INSERT_TARGET_MODE === "above"
        ? INSERT_TARGET_INDEX
        : INSERT_TARGET_INDEX + 1;
    CURRENT_LINES.splice(pos, 0, ...arr);
    renderLines();
    renderQA();
    setStatus(
      `${n} row${n > 1 ? "s" : ""} inserted ${INSERT_TARGET_MODE}.`,
      "success",
      3000
    );
    FOCUSED_ROW_INDEX = pos;
    focusLineRow(FOCUSED_ROW_INDEX);
  }
  closeInsertPopover();
}
if (insCancelBtn)
  insCancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    closeInsertPopover();
  });
if (insOkBtn)
  insOkBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const val = parseInt(insCountInput?.value || "1", 10);
    performInsertRows(Number.isFinite(val) ? val : 1);
  });
if (insertPopover)
  insertPopover.addEventListener("click", (e) => {
    const qBtn = e.target.closest("button[data-q]");
    if (qBtn) {
      const q = parseInt(qBtn.dataset.q, 10);
      if (Number.isFinite(q)) {
        performInsertRows(q);
      }
    }
  });

/* Boot */
(async function init() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return (window.location.href = "login.html");
    try {
      const { data: permRows } = await supabase
        .from("user_permissions")
        .select("module_id, can_view, can_edit")
        .eq("user_id", session.user.id)
        .eq("module_id", MODULE_ID)
        .limit(1);
      if (Array.isArray(permRows) && permRows.length) {
        PERM_CAN_VIEW = !!permRows[0].can_view;
        PERM_CAN_EDIT = !!permRows[0].can_edit;
      }
    } catch (pErr) {
      console.warn("Permission load failed", pErr);
    }
    if (!PERM_CAN_VIEW) {
      setStatus("You do not have permission to view this module.", "error");
      return;
    }
    await loadUoms();
    await loadOwners();
    await loadStockItems();
    await ensureStockItemCodes();
    if (OWNERS.length) {
      CURRENT_OWNER_ID = OWNERS[0].id;
      productPicker.value = String(CURRENT_OWNER_ID);
      await loadBom(CURRENT_OWNER_ID);
      await ensureStockItemCodes();
    } else {
      setStatus("No SP owners available.", "error");
    }
    applyPermissionUi();
  } catch (err) {
    console.error(err);
    setStatus(`Init error: ${err.message}`, "error");
  }
})();

/* Helpers */
async function ensureMissingStockItems() {
  const missingIds = Array.from(
    new Set(
      CURRENT_LINES.map((l) => l.stock_item_id).filter(
        (id) =>
          id && !STOCK_ITEMS.some((x) => x.id === id) && typeof id === "number"
      )
    )
  );
  if (!missingIds.length) return;
  const { data, error } = await supabase
    .from("inv_stock_item")
    .select("id,name,code")
    .in("id", missingIds);
  if (error) {
    console.warn("Failed fetching missing item names", error);
    missingIds.forEach((id) =>
      STOCK_ITEMS.push({ id, name: `Item #${id}`, code: null })
    );
    return;
  }
  (data || []).forEach((row) =>
    STOCK_ITEMS.push({ id: row.id, name: row.name, code: row.code || null })
  );
}
async function ensureStockItemCodes() {
  const need = STOCK_ITEMS.filter((r) => !r.code).map((r) => r.id);
  if (!need.length) return;
  const { data, error } = await supabase
    .from("inv_stock_item")
    .select("id, code")
    .in("id", need);
  if (error) {
    console.warn("ensureStockItemCodes failed", error);
    return;
  }
  const map = new Map((data || []).map((r) => [r.id, r.code]));
  STOCK_ITEMS.forEach((r) => {
    if (!r.code) r.code = map.get(r.id) || r.code || null;
  });
}

/* Kebab menu interactions */
function syncMenuState() {
  deleteBtn && (deleteBtn.disabled = !CURRENT_HEADER);
  editHeaderBtn && (editHeaderBtn.disabled = !CURRENT_OWNER_ID);
}
if (moreMenuBtn && moreMenu) {
  const closeMenu = () => {
    moreMenu.classList.remove("open");
    moreMenuBtn.setAttribute("aria-expanded", "false");
    moreMenu.style.position = "";
    moreMenu.style.top = "";
    moreMenu.style.left = "";
    moreMenu.style.display = "";
    window.removeEventListener("resize", onMenuResize);
  };
  const positionMenu = () => {
    if (!moreMenu.classList.contains("open")) return;
    // Use fixed positioning to escape panel overflow clipping
    moreMenu.style.position = "fixed";
    moreMenu.style.display = "block"; // ensure dimensions
    const rect = moreMenuBtn.getBoundingClientRect();
    const menuW = moreMenu.offsetWidth || 220;
    const menuH = moreMenu.offsetHeight || 160;
    let top = rect.bottom + 6; // place below by default
    let left = rect.left; // align left edges
    // Clamp horizontally
    if (left + menuW > window.innerWidth - 8)
      left = window.innerWidth - menuW - 8;
    if (left < 8) left = 8;
    // If bottom overflows viewport, place above
    if (top + menuH > window.innerHeight - 8) top = rect.top - menuH - 8;
    if (top < 8) top = 8;
    moreMenu.style.top = `${top}px`;
    moreMenu.style.left = `${left}px`;
  };
  const onMenuResize = () => positionMenu();
  moreMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = !moreMenu.classList.contains("open");
    if (willOpen) {
      moreMenu.classList.add("open");
      moreMenuBtn.setAttribute("aria-expanded", "true");
      positionMenu();
      window.addEventListener("resize", onMenuResize);
      setTimeout(() => {
        const onDocClick = (ev) => {
          if (!moreMenu.contains(ev.target) && ev.target !== moreMenuBtn) {
            closeMenu();
            document.removeEventListener("click", onDocClick);
            document.removeEventListener("keydown", onEsc);
          }
        };
        const onEsc = (ev) => {
          if (ev.key === "Escape") {
            closeMenu();
            document.removeEventListener("click", onDocClick);
            document.removeEventListener("keydown", onEsc);
          }
        };
        document.addEventListener("click", onDocClick);
        document.addEventListener("keydown", onEsc);
      }, 0);
    } else closeMenu();
  });
  moreMenu.addEventListener("click", (e) => {
    if (e.target.closest(".menu-item")) closeMenu();
  });
}

/* Export helpers */
function sanitizeFilename(s) {
  return (s || "untitled")
    .replace(/[^a-z0-9\-_]+/gi, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}
function formatDateStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(
    d.getHours()
  )}${pad(d.getMinutes())}`;
}
function getOwnerLabel(id) {
  const p = OWNERS.find((x) => x.id === id);
  return p ? p.label : `Owner-${id}`;
}
function getUomCode(id) {
  const u = UOMS.find((x) => x.id === id);
  return u ? u.code : "";
}
function getItemName(id) {
  const it = STOCK_ITEMS.find((x) => x.id === id);
  return it ? it.name : id ? `Item #${id}` : "";
}
function getItemCode(id) {
  const it = STOCK_ITEMS.find((x) => x.id === id);
  return it?.code || "";
}
function buildBomSnapshot() {
  const ownerLabel = getOwnerLabel(CURRENT_OWNER_ID);
  const header = collectHeader();
  const displayPct = lossPct.value === "" ? null : parseFloat(lossPct.value);
  const lines = collectLines().map((ln, idx) => ({
    sn: idx + 1,
    itemCode: getItemCode(ln.stock_item_id),
    itemName: getItemName(ln.stock_item_id),
    qty: ln.qty_per_reference_output ?? "",
    uom: getUomCode(ln.uom_id),
    wastagePct:
      ln.wastage_pct == null
        ? ""
        : ln.wastage_pct <= 1.5
        ? ln.wastage_pct * 100
        : ln.wastage_pct,
    optional: ln.is_optional ? "Yes" : "No",
    remarks: ln.remarks || "",
  }));
  return {
    ownerLabel,
    refQty: header.reference_output_qty,
    refUom: getUomCode(header.reference_output_uom_id),
    lossPct: displayPct,
    lines,
  };
}
function downloadBlob(content, mime, filename) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}
function exportCsv() {
  if (!PERM_CAN_EDIT)
    return setStatus("You do not have permission to export.", "error");
  if (!CURRENT_OWNER_ID)
    return setStatus("Select an owner to export.", "error");
  const snap = buildBomSnapshot();
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [];
  rows.push(["Owner", snap.ownerLabel]);
  rows.push([
    "Reference Output",
    snap.refQty != null ? snap.refQty : "",
    snap.refUom || "",
  ]);
  rows.push([
    "Process Loss %",
    snap.lossPct != null ? snap.lossPct.toFixed(2) : "",
  ]);
  rows.push([]);
  rows.push([
    "SN",
    "Stock Item Code",
    "Stock Item",
    "Qty per Ref",
    "UOM",
    "Wastage %",
    "Optional",
    "Remarks",
  ]);
  for (const ln of snap.lines)
    rows.push([
      ln.sn,
      ln.itemCode,
      ln.itemName,
      ln.qty,
      ln.uom,
      ln.wastagePct === "" ? "" : Number(ln.wastagePct).toFixed(2),
      ln.optional,
      ln.remarks,
    ]);
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const filename = `sp-bom_${sanitizeFilename(
    snap.ownerLabel
  )}_${formatDateStamp()}.csv`;
  downloadBlob(csv, "text/csv;charset=utf-8", filename);
  setStatus("CSV exported.", "success", 1800);
}
function buildHtmlDocument({ snap, color = true, autoPrint = false }) {
  const title = `Semi-finished BOM — ${snap.ownerLabel}`;
  const style = color
    ? `body{font-family:Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;margin:24px}h1{font-size:20px;margin:0 0 12px 0}.meta{display:grid;grid-template-columns:220px 1fr;row-gap:6px;column-gap:12px;margin:12px 0 16px}.meta .label{color:#64748b;text-transform:uppercase;letter-spacing:.5px;font-size:12px;font-weight:600}.pill{display:inline-flex;align-items:center;border:1px solid #0ea5e9;background:#f0f9ff;border-radius:999px;padding:4px 10px;color:#0c4a6e;font-weight:600}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e2e8f0;padding:8px 10px;font-size:13px}thead th{background:#f1f5f9;text-align:center}tbody tr:nth-child(even){background:#fafafa}td.right{text-align:right}td.center{text-align:center}.muted{color:#64748b}`
    : `@media screen{body{margin:24px}}body{font-family:Segoe UI,Roboto,Arial,sans-serif;color:#000}h1{font-size:18px;margin:0 0 10px 0}.meta{display:grid;grid-template-columns:220px 1fr;row-gap:6px;column-gap:12px;margin:10px 0 14px}.meta .label{color:#000;text-transform:uppercase;letter-spacing:.5px;font-size:11px;font-weight:700}table{border-collapse:collapse;width:100%}th,td{border:1px solid #000;padding:6px 8px;font-size:12px}thead th{text-align:center;background:#fff}td.right{text-align:right}td.center{text-align:center}@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0}h1{font-size:16px;margin:0 0 8px 0}}`;
  const loss = snap.lossPct != null ? `${snap.lossPct.toFixed(2)}%` : "—";
  const headerHtml = `<div class="meta"><div class="label">Owner</div><div>${
    snap.ownerLabel
  }</div><div class="label">Reference Output</div><div>${snap.refQty ?? "—"} ${
    snap.refUom || ""
  }</div><div class="label">Process Loss %</div><div>${loss}</div><div class="label">Exported At</div><div>${new Date().toLocaleString()}</div></div>`;
  const rows = snap.lines
    .map(
      (ln) =>
        `<tr><td class="center">${ln.sn}</td><td class="center">${
          ln.itemCode || ""
        }</td><td>${ln.itemName || ""}</td><td class="right">${
          ln.qty ?? ""
        }</td><td class="center">${ln.uom || ""}</td><td class="right">${
          ln.wastagePct === "" ? "" : Number(ln.wastagePct).toFixed(2)
        }%</td><td class="center">${ln.optional}</td><td>${(ln.remarks || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")}</td></tr>`
    )
    .join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${title}</title><style>${style}</style></head><body><h1>${title}</h1>${headerHtml}<table><thead><tr><th>SN</th><th>Stock Item Code</th><th>Stock Item</th><th>Qty per Ref</th><th>UOM</th><th>Wastage %</th><th>Optional</th><th>Remarks</th></tr></thead><tbody>${rows}</tbody></table>${
    autoPrint ? "<script>window.onload=()=>{window.print();}</script>" : ""
  }</body></html>`;
  return html;
}
function exportPdf() {
  if (!PERM_CAN_EDIT)
    return setStatus("You do not have permission to export.", "error");
  if (!CURRENT_OWNER_ID)
    return setStatus("Select an owner to export.", "error");
  const snap = buildBomSnapshot();
  const jspdfNS = window.jspdf || window.jsPDF || {};
  const jsPDF = jspdfNS.jsPDF || jspdfNS;
  if (typeof jsPDF !== "function")
    return setStatus(
      "PDF generator unavailable. Check network or jsPDF load.",
      "error"
    );
  const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
  const margin = 36;
  const page = doc.internal.pageSize;
  const pageWidth = page.getWidth ? page.getWidth() : page.width;
  const pageHeight = page.getHeight ? page.getHeight() : page.height;
  let y = margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`Semi-finished BOM — ${snap.ownerLabel}`, margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const meta = [
    ["Owner", snap.ownerLabel],
    ["Reference Output", `${snap.refQty ?? "—"} ${snap.refUom || ""}`],
    [
      "Process Loss %",
      snap.lossPct != null ? snap.lossPct.toFixed(2) + "%" : "—",
    ],
    ["Exported At", new Date().toLocaleString()],
  ];
  const labelWidth = 150;
  meta.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(label.toUpperCase(), margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(value || ""), margin + labelWidth, y);
    y += 14;
  });
  y += 8;
  doc.setLineWidth(0.75);
  doc.line(margin, y, pageWidth - margin, y);
  y += 12;
  const head = [
    [
      "SN",
      "Stock Item Code",
      "Stock Item",
      "Qty per Ref",
      "UOM",
      "Wastage %",
      "Optional",
      "Remarks",
    ],
  ];
  const body = snap.lines.map((ln) => [
    String(ln.sn),
    ln.itemCode || "",
    ln.itemName || "",
    ln.qty == null ? "" : String(ln.qty),
    ln.uom || "",
    ln.wastagePct === "" ? "" : Number(ln.wastagePct).toFixed(2),
    ln.optional,
    ln.remarks || "",
  ]);
  if (doc.autoTable) {
    doc.autoTable({
      head,
      body,
      startY: y,
      styles: {
        font: "helvetica",
        fontSize: 9,
        lineColor: [0, 0, 0],
        lineWidth: 0.5,
        textColor: [0, 0, 0],
        cellPadding: 4,
        halign: "center",
        valign: "middle",
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.75,
        fontStyle: "bold",
      },
      columnStyles: {
        2: { halign: "left" },
        3: { halign: "right" },
        5: { halign: "right" },
        7: { halign: "left" },
      },
      didDrawPage: () => {
        const str = `Page ${doc.internal.getNumberOfPages()}`;
        doc.setFontSize(9);
        doc.text(str, pageWidth - margin, pageHeight - 12, { align: "right" });
      },
      margin: { left: margin, right: margin },
    });
  } else {
    doc.setFontSize(10);
    const colX = [
      margin,
      margin + 40,
      margin + 140,
      margin + 380,
      margin + 440,
      margin + 480,
      margin + 540,
      margin + 590,
    ];
    const headers = head[0];
    headers.forEach((t, i) => doc.text(String(t), colX[i], y));
    doc.setLineWidth(0.5);
    doc.line(margin, y + 4, pageWidth - margin, y + 4);
    y += 16;
    body.forEach((r) => {
      if (y > pageHeight - margin - 20) {
        doc.addPage();
        y = margin + 10;
      }
      r.forEach((t, i) => {
        const text = String(t ?? "");
        doc.text(text, colX[i], y);
      });
      y += 14;
    });
  }
  const filename = `sp-bom_${sanitizeFilename(
    snap.ownerLabel
  )}_${formatDateStamp()}.pdf`;
  try {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
    setStatus("PDF export initiated.", "success", 1800);
  } catch (e) {
    console.warn("PDF blob download failed; falling back to doc.save", e);
    doc.save(filename);
  }
}
function exportHtml() {
  if (!PERM_CAN_EDIT)
    return setStatus("You do not have permission to export.", "error");
  if (!CURRENT_OWNER_ID)
    return setStatus("Select an owner to export.", "error");
  const snap = buildBomSnapshot();
  const html = buildHtmlDocument({ snap, color: true, autoPrint: false });
  const filename = `sp-bom_${sanitizeFilename(
    snap.ownerLabel
  )}_${formatDateStamp()}.html`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}
if (exportCsvBtn) exportCsvBtn.addEventListener("click", exportCsv);
if (exportPdfBtn) exportPdfBtn.addEventListener("click", exportPdf);
if (exportHtmlBtn) exportHtmlBtn.addEventListener("click", exportHtml);

if (linesViewBtn) {
  linesViewBtn.addEventListener("click", () => {
    if (!LINES_EDIT_MODE) return;
    LINES_EDIT_MODE = false;
    linesViewBtn.classList.add("active");
    linesEditBtn?.classList.remove("active");
    applyLinesMode();
  });
}
if (linesEditBtn) {
  linesEditBtn.addEventListener("click", () => {
    if (LINES_EDIT_MODE) return;
    LINES_EDIT_MODE = true;
    linesEditBtn.classList.add("active");
    linesViewBtn?.classList.remove("active");
    applyLinesMode();
  });
}

function focusLineRow(idx) {
  if (!LINES_EDIT_MODE) return;
  setTimeout(() => {
    const tr = linesBody.querySelector(`tr[data-i='${idx}']`);
    if (!tr) return;
    const focusEl = tr.querySelector(
      "select.cell.item, input.cell.qty, input.cell.wast, select.cell.uom, input.cell.rem"
    );
    focusEl?.focus?.();
  }, 30);
}

document.addEventListener("keydown", (e) => {
  if (!LINES_EDIT_MODE) return;
  if (
    nhModal?.style.display === "flex" ||
    dhModal?.style.display === "flex" ||
    dlModal?.style.display === "flex" ||
    ehModal?.style.display === "flex"
  )
    return;
  if (insertPopover?.style.display === "block") return;
  const activeTag = document.activeElement?.tagName;
  const isTyping = activeTag === "INPUT" || activeTag === "TEXTAREA";
  const idx = FOCUSED_ROW_INDEX != null ? FOCUSED_ROW_INDEX : 0;
  if (e.altKey && e.key === "ArrowUp") {
    e.preventDefault();
    if (idx > 0) {
      const tmp = CURRENT_LINES[idx - 1];
      CURRENT_LINES[idx - 1] = CURRENT_LINES[idx];
      CURRENT_LINES[idx] = tmp;
      FOCUSED_ROW_INDEX = idx - 1;
      renderLines();
      renderQA();
      setStatus("Line moved up.", "success", 1600);
      focusLineRow(FOCUSED_ROW_INDEX);
    }
    return;
  }
  if (
    e.key === "Insert" &&
    e.shiftKey &&
    !e.altKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    !isTyping
  ) {
    e.preventDefault();
    const tr = linesBody.querySelector(`tr[data-i='${idx}']`);
    const btn = tr?.querySelector('button[data-act="insAbove"]');
    if (btn) openInsertPopover(btn, idx, "above");
    return;
  }
  if (e.altKey && e.key === "ArrowDown") {
    e.preventDefault();
    if (idx < CURRENT_LINES.length - 1) {
      const tmp = CURRENT_LINES[idx + 1];
      CURRENT_LINES[idx + 1] = CURRENT_LINES[idx];
      CURRENT_LINES[idx] = tmp;
      FOCUSED_ROW_INDEX = idx + 1;
      renderLines();
      renderQA();
      setStatus("Line moved down.", "success", 1600);
      focusLineRow(FOCUSED_ROW_INDEX);
    }
    return;
  }
  if (
    e.key === "Insert" &&
    !e.altKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    !isTyping
  ) {
    e.preventDefault();
    const pos = Math.min(idx + 1, CURRENT_LINES.length);
    CURRENT_LINES.splice(pos, 0, blankLine());
    FOCUSED_ROW_INDEX = pos;
    renderLines();
    renderQA();
    setStatus("Row inserted below.", "success", 1800);
    focusLineRow(FOCUSED_ROW_INDEX);
    return;
  }
  if (
    e.key === "Delete" &&
    !e.altKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    !isTyping
  ) {
    e.preventDefault();
    if (CURRENT_LINES.length && idx >= 0 && idx < CURRENT_LINES.length) {
      PENDING_DELETE_LINE_INDEX = idx;
      if (dlText) dlText.textContent = `Delete line ${idx + 1}?`;
      if (dlModal) {
        dlModal.style.display = "flex";
        if (focusTrapDispose) focusTrapDispose();
        focusTrapDispose = trapFocusIn(dlModal);
      }
    }
  }
});

/* Clone modal data sources (mirror RM patterns) */
async function loadOwnersWithoutHeader() {
  const { data: hdrRows, error } = await supabase
    .from("sp_bom_header")
    .select("owner_item_id");
  if (error) {
    console.warn("Failed to load existing SP headers", error);
    return OWNERS; // fallback: show all owners
  }
  const existing = new Set((hdrRows || []).map((r) => r.owner_item_id));
  return OWNERS.filter((p) => !existing.has(p.id));
}

async function loadOwnersWithBomLines() {
  // Load owners that have a BOM header with at least one line
  const { data, error } = await supabase
    .from("sp_bom_header")
    .select("id, owner_item_id, sp_bom_line(count)");
  if (error) {
    console.warn("Failed to load SP clone sources", error);
    return [];
  }
  const withLines = (data || []).filter(
    (h) => Array.isArray(h.sp_bom_line) && h.sp_bom_line[0]?.count > 0
  );
  const ids = new Set(withLines.map((h) => h.owner_item_id));
  return OWNERS.filter((p) => ids.has(p.id));
}

async function populateCloneSources(excludeOwnerId) {
  const list = await loadOwnersWithBomLines();
  const filtered = list.filter((p) => p.id !== excludeOwnerId);
  if (!filtered.length) {
    nhCloneProduct.innerHTML = `<option value="">— no sources available —</option>`;
    nhCloneToggle.checked = false;
    nhCloneSection.style.display = "none";
    nhCloneToggle.disabled = true;
  } else {
    nhCloneToggle.disabled = false;
    nhCloneProduct.innerHTML =
      `<option value="">— select source —</option>` +
      filtered
        .map((p) => `<option value="${p.id}">${escapeHtml(p.label)}</option>`)
        .join("");
  }
}
