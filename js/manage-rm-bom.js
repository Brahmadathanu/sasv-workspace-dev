/* eslint-env browser */
import { supabase } from "../public/shared/js/supabaseClient.js";

// Elements
const el = (id) => document.getElementById(id);
const productPicker = el("productPicker");
const refQty = el("refQty");
const refUom = el("refUom");
const lossPct = el("lossPct");
const linesBody = el("linesBody");
const qaList = el("qaList");
const qaChip = el("qaChip");
const qaPopover = el("qaPopover");
// Floating toast container (replaces inline status panel)
const toastContainer = el("statusToastContainer");
let activeToast = null;
let activeToastTimer = null;
// Header pill displays
const pillRefOutput = el("pillRefOutput");
const pillLossPct = el("pillLossPct");
// Selection pills container (view mode)
const selectionPills = el("selectionPills");

// const checkAll = el("checkAll"); // removed (legacy bulk select no longer used with SN column)
const reloadBtn = el("reloadBtn");
const saveBtn = el("saveBtn");
const cloneBtn = el("cloneBtn");
const deleteBtn = el("deleteBtn");
const editHeaderBtn = el("editHeaderBtn");
const moreMenuBtn = el("moreMenuBtn");
const moreMenu = el("moreMenu");
// Export menu elements
const exportBtn = el("exportBtn");
const exportMenu = el("exportMenu");
const exportCsvBtn = el("exportCsv");
const exportPdfBtn = el("exportPdf");
const exportHtmlBtn = el("exportHtml");
// Lines view/edit toggle
const linesPanel = el("linesPanel");
const linesViewBtn = el("linesViewBtn");
const linesEditBtn = el("linesEditBtn");
const kbHelpBtn = el("kbHelpBtn");
const kbHelpPopover = el("kbHelpPopover");
let LINES_EDIT_MODE = false; // default View mode
// Permissions
const MODULE_ID = "manage-rm-bom";
let PERM_CAN_VIEW = true;
let PERM_CAN_EDIT = true;
// Horizontal scroll sync and back-to-top
const linesScroll = document.getElementById("linesScroll");
const linesHScrollTop = document.getElementById("linesHScrollTop");
const linesHScrollInner = document.getElementById("linesHScrollInner");
const linesBackToTop = document.getElementById("linesBackToTop");
let _hSyncing = false;

function applyLinesMode() {
  if (linesPanel) {
    if (LINES_EDIT_MODE) {
      linesPanel.classList.remove("view-mode");
    } else {
      linesPanel.classList.add("view-mode");
    }
  }
  if (!LINES_EDIT_MODE && kbHelpPopover) kbHelpPopover.style.display = "none";
  // Re-render table according to mode
  renderLines();
  // Clear any selection when entering edit mode
  if (LINES_EDIT_MODE) clearSelection();
}
function applyPermissionUi() {
  // When no edit permission, force view and hide edit affordances
  if (!PERM_CAN_EDIT) {
    LINES_EDIT_MODE = false;
    applyLinesMode();
    if (linesEditBtn) linesEditBtn.style.display = "none";
    if (linesViewBtn) linesViewBtn.style.display = "none"; // hide toggle entirely
    if (kbHelpBtn) kbHelpBtn.style.display = "none";
    document.body.classList.add("no-edit");
    // Hide export for non-editors
    if (exportBtn) exportBtn.style.display = "none";
  } else {
    if (linesEditBtn) linesEditBtn.style.display = "";
    if (linesViewBtn) linesViewBtn.style.display = "";
    if (kbHelpBtn) kbHelpBtn.style.display = "";
    document.body.classList.remove("no-edit");
    // Show export for editors
    if (exportBtn) exportBtn.style.display = "";
  }
  // Additionally guard when no view at all
  if (!PERM_CAN_VIEW && exportBtn) exportBtn.style.display = "none";
}
// Modal elements for new header / clone lines
const nhModal = el("newHeaderModal");
const nhCloseBtn = el("nhCloseBtn");
const nhCancelBtn = el("nhCancelBtn");
const nhCreateBtn = el("nhCreateBtn");
const nhProduct = el("nhProduct");
const nhRefQty = el("nhRefQty");
const nhRefUom = el("nhRefUom");
const nhLossPct = el("nhLossPct");
const nhCloneToggle = el("nhCloneToggle");
const nhCloneSection = el("nhCloneSection");
const nhCloneProduct = el("nhCloneProduct");
// Loading mask elements
const pageMask = el("pageMask");
const pageMaskText = el("pageMaskText");
// Delete modal elements
const dhModal = el("deleteHeaderModal");
const dhCloseBtn = el("dhCloseBtn");
const dhCancelBtn = el("dhCancelBtn");
const dhConfirmBtn = el("dhConfirmBtn");
const dhProductName = el("dhProductName");
// Delete line modal elements
const dlModal = el("deleteLineModal");
const dlCloseBtn = el("dlCloseBtn");
const dlCancelBtn = el("dlCancelBtn");
const dlConfirmBtn = el("dlConfirmBtn");
const dlText = el("dlText");
let PENDING_DELETE_LINE_INDEX = null;
// Insert popover elements
const insertPopover = el("insertPopover");
const insCountInput = el("insCountInput");
const insCancelBtn = el("insCancelBtn");
const insOkBtn = el("insOkBtn");
let INSERT_TARGET_INDEX = null;
let INSERT_TARGET_MODE = null; // 'above' | 'below'

// Edit Header modal elements
const ehModal = el("editHeaderModal");
const ehCloseBtn = el("ehCloseBtn");
const ehCancelBtn = el("ehCancelBtn");
const ehApplyBtn = el("ehApplyBtn");
const ehRefQty = el("ehRefQty");
const ehRefUom = el("ehRefUom");
const ehLossPct = el("ehLossPct");
const ehNotes = el("ehNotes");

function showMask(msg = "Loading…") {
  if (pageMaskText) pageMaskText.textContent = msg;
  if (pageMask) pageMask.style.display = "flex";
}
function hideMask() {
  if (pageMask) pageMask.style.display = "none";
}

// Focus trap management
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
let UOMS = []; // [{id, code}]
let RM_ITEMS = []; // [{id, name}]
let PRODUCTS = []; // [{id, label, uom_code?}]
let CURRENT_PRODUCT_ID = null;
let CURRENT_HEADER = null; // {id,...}
let CURRENT_LINES = []; // array of line objects
let CURRENT_HEADER_NOTES = ""; // local-only notes (optional UI)

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

/* ---------------- Load pickers ---------------- */
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

async function loadProducts() {
  // Adjust view name/columns if different in your schema
  const { data, error } = await supabase
    .from("v_picker_products")
    .select("id, label, uom_code")
    .order("label", { ascending: true });
  if (error) throw error;
  PRODUCTS = data || [];
  productPicker.innerHTML = PRODUCTS.map(
    (p) => `<option value="${p.id}">${escapeHtml(p.label)}</option>`
  ).join("");
}

async function loadRmItems() {
  // Try RPC first for a fast path; if RPC fails or returns no data,
  // fall back to a paginated select that fetches all `inv_stock_item`
  // rows in batches and filters those having class code 'RM'.
  try {
    const { data, error } = await supabase.rpc("rpc_get_rm_items");
    if (!error && Array.isArray(data) && data.length) {
      // If the RPC returns a very large set (commonly 1000), it may be truncated
      // by Supabase/Postgres limits. In that case prefer the paginated fallback
      // to ensure we load everything.
      console.debug("loadRmItems: RPC returned", data.length, "rows");
      if (data.length < 1000) {
        RM_ITEMS = (data || []).map((r) => ({
          id: r.id,
          name: r.name,
          code: r.code || null,
        }));
        return;
      }
      console.warn(
        "loadRmItems: RPC returned >=1000 rows; falling back to paginated fetch to ensure completeness"
      );
    }
  } catch (e) {
    console.warn("rpc_get_rm_items failed; falling back to paginated query", e);
  }

  // Paginated fallback: fetch in batches to avoid server-side row limits.
  const batch = 500; // reasonable page size
  let from = 0;
  let fetched = [];
  while (true) {
    const to = from + batch - 1;
    const { data: rows, error: err } = await supabase
      .from("inv_stock_item")
      .select(
        "id,name,code,inv_stock_item_class_map(category_id, inv_class_category(code))"
      )
      .order("id", { ascending: true })
      .range(from, to);
    if (err) throw err;
    if (!rows || !rows.length) break;
    fetched = fetched.concat(rows);
    if (rows.length < batch) break; // last page
    from += batch;
  }

  RM_ITEMS = (fetched || [])
    .filter((r) => {
      const maps = r.inv_stock_item_class_map;
      if (!maps) return false;
      // Support both array and single-object shapes returned by different views/RPCs
      if (Array.isArray(maps))
        return maps.some((m) => m.inv_class_category?.code === "RM");
      if (typeof maps === "object")
        return maps.inv_class_category?.code === "RM";
      return false;
    })
    .map((r) => ({ id: r.id, name: r.name, code: r.code || null }));
  console.debug("loadRmItems: paginated fetched", RM_ITEMS.length, "RM items");
}

/* ---------------- Rendering ---------------- */
function renderLines() {
  linesBody.innerHTML = CURRENT_LINES.map((ln, i) => {
    if (!LINES_EDIT_MODE) {
      // View mode row rendering
      const itemName = (() => {
        const item = RM_ITEMS.find((x) => x.id === ln.stock_item_id);
        if (item) return item.name;
        if (ln.stock_item_id) return `Item #${ln.stock_item_id}`;
        return "";
      })();
      const itemCode = (() => {
        const item = RM_ITEMS.find((x) => x.id === ln.stock_item_id);
        return item?.code || "";
      })();
      const uomCode = (() => {
        const u = UOMS.find((u) => u.id === ln.uom_id);
        return u ? u.code : "";
      })();
      const qtyStr =
        ln.qty_per_reference_output == null
          ? ""
          : String(ln.qty_per_reference_output);
      const wastStr = (() => {
        if (ln.wastage_pct == null) return "";
        const raw = Number(ln.wastage_pct);
        const pct = raw <= 1.5 ? raw * 100 : raw; // heuristic: fractions vs. legacy percent
        return `${pct.toFixed(2)}%`;
      })();
      const optStr = ln.is_optional ? "Yes" : "No";
      const remStr = escapeHtml(ln.remarks || "");
      return `
      <tr data-i="${i}">
        <td class="nowrap" data-col="sn">${i + 1}</td>
        <td class="nowrap code-cell" data-col="code">${escapeHtml(
          itemCode
        )}</td>
        <td class="item-cell" data-col="item">${escapeHtml(itemName)}</td>
        <td data-col="qty">${escapeHtml(qtyStr)}</td>
        <td data-col="uom">${escapeHtml(uomCode)}</td>
        <td data-col="wastage">${escapeHtml(wastStr)}</td>
        <td data-col="optional">${optStr}</td>
        <td data-col="remarks">${remStr}</td>
        <td data-col="actions"></td>
      </tr>`;
    }
    const itemOptions = [`<option value="">— select —</option>`]
      .concat(
        RM_ITEMS.map(
          (x) =>
            `<option value="${x.id}" ${
              x.id === ln.stock_item_id ? "selected" : ""
            }>${escapeHtml(x.name)}</option>`
        )
      )
      .join("");
    // If line references a stock_item_id missing from RM_ITEMS (e.g., not classified as RM yet), add a temporary fallback option
    if (
      ln.stock_item_id &&
      !RM_ITEMS.some((x) => x.id === ln.stock_item_id) &&
      !itemOptions.includes(`value="${ln.stock_item_id}"`)
    ) {
      const fallbackLabel = `Unknown Item (#${ln.stock_item_id})`;
      // Append fallback selected option
      const injected = `${itemOptions}<option value="${
        ln.stock_item_id
      }" selected>${escapeHtml(fallbackLabel)}</option>`;
      const itemCode = ""; // unknown fallback has no code
      // replace itemOptions string for this row
      return `
      <tr data-i="${i}">
        <td class="nowrap" data-col="sn">${i + 1}</td>
        <td class="nowrap code-cell" data-col="code">${escapeHtml(
          itemCode
        )}</td>
        <td class="item-cell" data-col="item"><select class="cell item">${injected}</select></td>
        <td class="right" data-col="qty"><input class="cell qty" type="number" step="0.0001" min="0" value="${
          ln.qty_per_reference_output ?? ""
        }" /></td>
        <td data-col="uom"><select class="cell uom">${[
          `<option value="">— select —</option>`,
        ]
          .concat(
            UOMS.map(
              (u) =>
                `<option value="${u.id}" ${
                  u.id === ln.uom_id ? "selected" : ""
                }>${u.code}</option>`
            )
          )
          .join("")}</select></td>
        <td class="right" data-col="wastage"><input class="cell wast" type="number" step="0.0001" min="0" max="0.9999" value="${
          ln.wastage_pct ?? ""
        }" /></td>
        <td data-col="optional"><input type="checkbox" class="cell opt" ${
          ln.is_optional ? "checked" : ""
        } /></td>
        <td data-col="remarks"><input type="text" class="cell rem" value="${escapeHtml(
          ln.remarks || ""
        )}" /></td>
      </tr>`;
    }
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
    const itemCode = (() => {
      const it = RM_ITEMS.find((x) => x.id === ln.stock_item_id);
      return it?.code || "";
    })();
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
            <button class="icon-btn small" data-act="up" title="Move up" aria-label="Move up">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            <button class="icon-btn small" data-act="down" title="Move down" aria-label="Move down">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <button class="icon-btn small" data-act="insAbove" title="Insert rows above" aria-label="Insert rows above">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v8"/><path d="M8 9h8"/></svg>
            </button>
            <button class="icon-btn small" data-act="insBelow" title="Insert rows below" aria-label="Insert rows below">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19v-8"/><path d="M8 15h8"/></svg>
            </button>
            <button class="icon-btn small" data-act="del" title="Delete row" aria-label="Delete row">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
  }).join("");

  // Append add-row provision at end in edit mode
  if (LINES_EDIT_MODE) {
    const colCount = 9; // SN, Code, Item, Qty, UOM, Wastage, Optional, Remarks, Actions
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="${colCount}" style="text-align:center; padding:10px;">
      <button class="icon-btn small" data-act="addEnd" title="Add row" aria-label="Add row">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
      </button>
      <span class="hint" style="margin-left:6px; color:#64748b; font-size:12px;">Add new row</span>
    </td>`;
    linesBody.appendChild(tr);
  }
  // Update scroll shadow state
  const scrollWrap = linesScroll;
  if (scrollWrap) {
    // Attach one-time scroll listener if not already
    if (!scrollWrap.dataset.shadowBound) {
      scrollWrap.addEventListener("scroll", () => {
        // vertical shadow
        if (scrollWrap.scrollTop > 2) scrollWrap.classList.add("scrolled");
        else scrollWrap.classList.remove("scrolled");
        // sync horizontal to top bar
        if (!_hSyncing && linesHScrollTop) {
          _hSyncing = true;
          linesHScrollTop.scrollLeft = scrollWrap.scrollLeft;
          _hSyncing = false;
        }
        // back-to-top visibility
        if (linesBackToTop) {
          if (scrollWrap.scrollTop > 120) linesBackToTop.classList.add("show");
          else linesBackToTop.classList.remove("show");
        }
      });
      scrollWrap.dataset.shadowBound = "1";
    }
    // Initial state
    if (scrollWrap.scrollTop > 2) scrollWrap.classList.add("scrolled");
    else scrollWrap.classList.remove("scrolled");
  }
  // Setup top horizontal scrollbar width/visibility
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
  // Bind sync listeners once
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
  // UI shows percent (e.g. 5 for 5%). DB should store fractional (e.g. 0.05).
  // Backward compatibility: if existing headers were saved as percent (>= 1.5) we normalize on load.
  const percentVal = lossPct.value === "" ? null : parseFloat(lossPct.value);
  return {
    reference_output_qty: refQty.value ? parseFloat(refQty.value) : null,
    reference_output_uom_id: refUom.value ? parseInt(refUom.value, 10) : null,
    process_loss_pct: percentVal == null ? null : percentVal / 100, // convert to fraction for persistence
  };
}
function collectLines() {
  // Only pick real data rows (those with data-i); ignore footer add-row
  return Array.from(linesBody.querySelectorAll("tr[data-i]"))
    .map((tr) => parseInt(tr.dataset.i, 10))
    .filter((i) => Number.isFinite(i) && i >= 0 && i < CURRENT_LINES.length)
    .map((i) => ({ ...CURRENT_LINES[i] }));
}

function updateHeaderPills() {
  // Reference Output: qty + UOM code
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
  // Loss percent pill
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
  // Validate using percent entered (before division)
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
  qaList.innerHTML = issues.length
    ? issues.map((m) => `<li class="danger">${escapeHtml(m)}</li>`).join("")
    : '<li class="success">Looks good ✅</li>';
  // Update compact QA status chip (if present)
  if (qaChip) {
    qaChip.style.display = "inline-flex";
    if (issues.length) {
      qaChip.classList.remove("ok");
      qaChip.classList.add("warn");
      const warnSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
      qaChip.querySelector(".qa-icon").innerHTML = warnSvg;
      qaChip.setAttribute("aria-label", `Validation issues: ${issues.length}`);
    } else {
      qaChip.classList.remove("warn");
      qaChip.classList.add("ok");
      const okSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      qaChip.querySelector(".qa-icon").innerHTML = okSvg;
      qaChip.setAttribute("aria-label", "All checks passed");
    }
  }
  if (qaPopover) {
    if (issues.length) {
      qaPopover.innerHTML = `<button type="button" class="qa-popover-close" aria-label="Close">×</button><h4 id="qaPopoverTitle">Validation Issues (${
        issues.length
      })</h4><ul class="qa-issues">${issues
        .map((m) => `<li class="danger">${escapeHtml(m)}</li>`)
        .join("")}</ul>`;
    } else {
      qaPopover.innerHTML = `<button type="button" class="qa-popover-close" aria-label="Close">×</button><h4 id="qaPopoverTitle">All Checks Passed</h4><p class="success-msg">No validation issues detected.</p>`;
    }
  }
  return issues;
}

function setStatus(msg, kind = "info", timeoutMs = 5000) {
  if (!toastContainer) return;
  // If msg is empty/falsey, clear any active toast and return
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

  // Ensure only one toast is visible; update existing or create one
  if (!activeToast) {
    activeToast = document.createElement("div");
    toastContainer.innerHTML = ""; // safety: clear any stale toasts
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

/* ---------------- Data IO ---------------- */
async function loadBom(pid) {
  // Header
  const { data: hdr, error: hdrErr } = await supabase
    .from("rm_bom_header")
    .select(
      "id, reference_output_qty, reference_output_uom_id, process_loss_pct"
    )
    .eq("product_id", pid)
    .limit(1)
    .maybeSingle();
  if (hdrErr) throw hdrErr;
  CURRENT_HEADER = hdr || null;

  // Lines
  let lines = [];
  if (CURRENT_HEADER?.id) {
    const { data: lnRows, error: lnErr } = await supabase
      .from("rm_bom_line")
      .select(
        "stock_item_id, qty_per_reference_output, uom_id, wastage_pct, is_optional, remarks"
      )
      .eq("rm_bom_id", CURRENT_HEADER.id)
      .order("line_no", { ascending: true });
    if (lnErr) throw lnErr;
    lines = lnRows || [];
  }
  CURRENT_LINES = lines.length ? lines : [blankLine()];

  // Ensure any stock_item_ids referenced in lines but missing from RM_ITEMS are fetched (so names appear)
  await ensureMissingRmItems();

  // Seed header UI
  if (CURRENT_HEADER) {
    refQty.value = CURRENT_HEADER.reference_output_qty ?? "";
    refUom.value = CURRENT_HEADER.reference_output_uom_id ?? "";
    // Display percent to user. DB may have stored fraction (<1) or legacy percent (>=1.5)
    if (CURRENT_HEADER.process_loss_pct == null) {
      lossPct.value = "";
    } else {
      const raw = Number(CURRENT_HEADER.process_loss_pct);
      const displayPct = raw <= 1.5 ? raw * 100 : raw; // heuristic: treat <=1.5 as fractional
      lossPct.value = displayPct.toFixed(2);
    }
  } else {
    refQty.value = "1";
    lossPct.value = "";
    // Attempt auto UOM selection from product.uom_code
    const prod = PRODUCTS.find((p) => p.id === pid);
    if (prod?.uom_code) {
      const match = UOMS.find(
        (u) => u.code.toLowerCase() === prod.uom_code.toLowerCase()
      );
      if (match) refUom.value = match.id;
    }
  }

  renderLines();
  renderQA();
  updateHeaderPills();
  // Refresh selection pills (initially empty)
  updateSelectionPills();
  if (deleteBtn) deleteBtn.disabled = !CURRENT_HEADER;
  if (editHeaderBtn) editHeaderBtn.disabled = !pid; // enable when a product is selected
  if (typeof syncMenuState === "function") syncMenuState();
}

async function saveBom() {
  const issues = renderQA();
  if (issues.length)
    return setStatus("Fix validation issues before saving.", "error");
  const header = collectHeader();
  const lines = collectLines();
  saveBtn.disabled = true;
  if (deleteBtn) deleteBtn.disabled = true; // prevent race during save
  if (editHeaderBtn) editHeaderBtn.disabled = true; // mirror delete transient disable
  setStatus("Saving…");
  const { error } = await supabase.rpc("fn_rm_bom_upsert", {
    p_product_id: CURRENT_PRODUCT_ID,
    p_header: header,
    p_lines: lines,
  });
  saveBtn.disabled = false;
  if (error) {
    console.error(error);
    setStatus(`Save failed: ${error.message}`, "error");
    if (deleteBtn) deleteBtn.disabled = !CURRENT_HEADER; // restore prior state
    if (editHeaderBtn) editHeaderBtn.disabled = !CURRENT_PRODUCT_ID; // restore based on product selection
    return;
  }
  setStatus("Saved successfully.", "success");
  await loadBom(CURRENT_PRODUCT_ID);
  if (deleteBtn) deleteBtn.disabled = !CURRENT_HEADER;
  if (typeof syncMenuState === "function") syncMenuState();
}

/* ---------------- Events ---------------- */
productPicker.addEventListener("change", async () => {
  CURRENT_PRODUCT_ID = parseInt(productPicker.value, 10);
  setStatus("");
  showMask("Loading…");
  try {
    await loadBom(CURRENT_PRODUCT_ID);
  } finally {
    hideMask();
  }
});
[refQty, refUom, lossPct].forEach((inp) =>
  inp.addEventListener("input", renderQA)
);

// Removed bulk select logic since SN column replaced checkboxes
linesBody.addEventListener("change", (e) => {
  if (!LINES_EDIT_MODE) return; // view mode blocks edits
  const tr = e.target.closest("tr");
  if (!tr) return;
  const i = parseInt(tr.dataset.i, 10);
  const ln = CURRENT_LINES[i];
  if (e.target.classList.contains("item"))
    ln.stock_item_id = e.target.value ? parseInt(e.target.value, 10) : null;
  // Update code cell in-place when item changes
  if (e.target.classList.contains("item")) {
    const it = RM_ITEMS.find((x) => x.id === ln.stock_item_id);
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
// Track last focused/clicked row index for keyboard shortcuts
let FOCUSED_ROW_INDEX = null;
linesBody.addEventListener("focusin", (e) => {
  const tr = e.target.closest("tr[data-i]");
  if (tr) FOCUSED_ROW_INDEX = parseInt(tr.dataset.i, 10);
});
linesBody.addEventListener("click", (e) => {
  const tr = e.target.closest("tr[data-i]");
  if (tr) FOCUSED_ROW_INDEX = parseInt(tr.dataset.i, 10);
});
// Row-level actions (Edit mode)
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
  if (Number.isNaN(i)) return;
  // update focused index based on last clicked row
  FOCUSED_ROW_INDEX = i;
  switch (act) {
    case "del": {
      // Open confirmation modal
      PENDING_DELETE_LINE_INDEX = i;
      if (dlText) dlText.textContent = `Delete line ${i + 1}?`;
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
  if (CURRENT_PRODUCT_ID) {
    showMask("Refreshing…");
    try {
      await loadBom(CURRENT_PRODUCT_ID);
    } finally {
      hideMask();
    }
  }
});
saveBtn.addEventListener("click", saveBom);
// QA chip popover interaction
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
// Back to top click
if (linesBackToTop && linesScroll) {
  linesBackToTop.addEventListener("click", () => {
    linesScroll.scrollTo({ top: 0, behavior: "smooth" });
  });
}
/* -------- Edit Header Modal Logic -------- */
function openEditHeaderModal() {
  // Populate UOMs
  ehRefUom.innerHTML = UOMS.map(
    (u) => `<option value="${u.id}">${u.code}</option>`
  ).join("");
  // Seed with current inline values (UI shows percent)
  ehRefQty.value = refQty.value || "";
  ehRefUom.value = refUom.value || "";
  ehLossPct.value = lossPct.value || "";
  ehNotes.value = CURRENT_HEADER_NOTES || "";
  ehModal.style.display = "flex";
  if (focusTrapDispose) focusTrapDispose();
  focusTrapDispose = trapFocusIn(ehModal);
  ehRefQty.focus();
  // ESC and backdrop close
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
if (editHeaderBtn) editHeaderBtn.addEventListener("click", openEditHeaderModal);
if (ehCloseBtn) ehCloseBtn.addEventListener("click", closeEditHeaderModal);
if (ehCancelBtn)
  ehCancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    closeEditHeaderModal();
  });
if (ehApplyBtn)
  ehApplyBtn.addEventListener("click", (e) => {
    e.preventDefault();
    // Basic validation on modal inputs
    const q = ehRefQty.value === "" ? null : parseFloat(ehRefQty.value);
    const u = ehRefUom.value ? parseInt(ehRefUom.value, 10) : null;
    const p = ehLossPct.value === "" ? null : parseFloat(ehLossPct.value);
    if (!q || q <= 0) return alert("Reference Output Qty must be > 0.");
    if (!u) return alert("Reference Output UOM required.");
    if (p != null && (p < 0 || p > 100))
      return alert("Process Loss % must be between 0 and 100.");
    // Apply back to main, which is the source of truth for Save
    refQty.value = q.toFixed(3);
    refUom.value = String(u);
    lossPct.value = p == null ? "" : p.toFixed(2);
    CURRENT_HEADER_NOTES = ehNotes.value || ""; // local only
    closeEditHeaderModal();
    renderQA();
    updateHeaderPills();
    setStatus("Header updated. Press Save to persist.", "info");
    if (typeof syncMenuState === "function") syncMenuState();
  });
/* -------- New Header / Clone Lines Modal Logic -------- */
function openNewHeaderModal() {
  // Populate product select with only products lacking a header
  nhProduct.innerHTML = "<option value=''>— select product —</option>";
  loadProductsWithoutHeader().then((list) => {
    nhProduct.innerHTML =
      "<option value=''>— select product —</option>" +
      list
        .map((p) => `<option value="${p.id}">${escapeHtml(p.label)}</option>`)
        .join("");
    const msgDiv = nhProduct.parentElement.querySelector(".muted, .danger");
    if (!list.length) {
      nhCreateBtn.disabled = true;
      nhProduct.disabled = true;
      if (msgDiv) {
        msgDiv.textContent =
          "All products already have BOM headers. No new header can be initialized.";
        msgDiv.classList.remove("muted");
        msgDiv.classList.add("danger");
      }
    } else {
      nhCreateBtn.disabled = false;
      nhProduct.disabled = false;
      if (msgDiv) {
        msgDiv.textContent = "Choose the product for the new header.";
        msgDiv.classList.remove("danger");
        msgDiv.classList.add("muted");
      }
    }
  });
  nhRefUom.innerHTML = UOMS.map(
    (u) => `<option value="${u.id}">${u.code}</option>`
  ).join("");
  // Default selections
  if (CURRENT_PRODUCT_ID) nhProduct.value = String(CURRENT_PRODUCT_ID);
  nhRefQty.value = "1.000";
  nhLossPct.value = "";
  nhCloneToggle.checked = false;
  nhCloneSection.style.display = "none";
  // Populate clone sources (exclude currently selected target product)
  populateCloneSources(nhProduct.value ? parseInt(nhProduct.value, 10) : null);
  nhModal.style.display = "flex";
  // Focus first field
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
  if (!CURRENT_HEADER || !CURRENT_PRODUCT_ID) return;
  const prod = PRODUCTS.find((p) => p.id === CURRENT_PRODUCT_ID);
  if (dhProductName)
    dhProductName.textContent = prod ? prod.label : `ID ${CURRENT_PRODUCT_ID}`;
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
// Rebuild clone source list when target product changes to avoid self-clone
nhProduct.addEventListener("change", () => {
  const targetId = nhProduct.value ? parseInt(nhProduct.value, 10) : null;
  populateCloneSources(targetId);
});
nhModal.addEventListener("click", (e) => {
  if (e.target === nhModal) closeNewHeaderModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && nhModal.style.display === "flex")
    closeNewHeaderModal();
});

/* ---------------- Keyboard help popover (Edit mode only) ---------------- */
function positionKbHelp(anchor) {
  if (!kbHelpPopover || !anchor) return;
  kbHelpPopover.style.display = "block";
  kbHelpPopover.style.top = "0px";
  kbHelpPopover.style.left = "0px";
  const a = anchor.getBoundingClientRect();
  const popW = kbHelpPopover.offsetWidth || 260;
  const popH = kbHelpPopover.offsetHeight || 160;
  let top = a.bottom + 6;
  let left = a.left;
  if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
  if (top + popH > window.innerHeight - 8) top = a.top - popH - 8; // flip if needed
  if (top < 8) top = 8;
  if (left < 8) left = 8;
  kbHelpPopover.style.top = `${top + window.scrollY}px`;
  kbHelpPopover.style.left = `${left + window.scrollX}px`;
}
if (kbHelpBtn && kbHelpPopover) {
  const showKb = () => {
    if (!LINES_EDIT_MODE) return;
    positionKbHelp(kbHelpBtn);
    kbHelpBtn.setAttribute("aria-expanded", "true");
  };
  const hideKb = () => {
    kbHelpPopover.style.display = "none";
    kbHelpBtn.setAttribute("aria-expanded", "false");
  };
  // Click-to-toggle
  kbHelpBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = kbHelpPopover.style.display === "block";
    if (open) hideKb();
    else showKb();
  });
  // Outside click closes
  document.addEventListener("click", (e) => {
    if (kbHelpPopover.style.display !== "block") return;
    if (!kbHelpPopover.contains(e.target) && e.target !== kbHelpBtn) {
      hideKb();
    }
  });
  // ESC closes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && kbHelpPopover.style.display === "block") hideKb();
  });
  // Focus leaving popover/button closes
  document.addEventListener("focusin", (e) => {
    if (kbHelpPopover.style.display !== "block") return;
    if (!kbHelpPopover.contains(e.target) && e.target !== kbHelpBtn) hideKb();
  });
  // Reposition on scroll/resize when open
  window.addEventListener(
    "scroll",
    () => {
      if (kbHelpPopover.style.display === "block") positionKbHelp(kbHelpBtn);
    },
    { passive: true }
  );
  window.addEventListener("resize", () => {
    if (kbHelpPopover.style.display === "block") positionKbHelp(kbHelpBtn);
  });
}

async function loadProductsWithoutHeader() {
  const { data: hdrRows, error } = await supabase
    .from("rm_bom_header")
    .select("product_id");
  if (error) {
    console.warn("Failed to load existing headers", error);
    return PRODUCTS; // fallback: show all
  }
  const existing = new Set((hdrRows || []).map((r) => r.product_id));
  return PRODUCTS.filter((p) => !existing.has(p.id));
}

async function loadProductsWithBomLines() {
  // Load products that have a BOM header with at least one line
  const { data, error } = await supabase
    .from("rm_bom_header")
    .select("id, product_id, rm_bom_line(count)");
  if (error) {
    console.warn("Failed to load clone sources", error);
    return [];
  }
  const withLines = (data || []).filter(
    (h) => Array.isArray(h.rm_bom_line) && h.rm_bom_line[0]?.count > 0
  );
  const ids = new Set(withLines.map((h) => h.product_id));
  return PRODUCTS.filter((p) => ids.has(p.id));
}

async function populateCloneSources(excludeProductId) {
  const list = await loadProductsWithBomLines();
  const filtered = list.filter((p) => p.id !== excludeProductId);
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

// Delete header modal bindings
if (dhCloseBtn) dhCloseBtn.addEventListener("click", closeDeleteHeaderModal);
if (dhCancelBtn)
  dhCancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    closeDeleteHeaderModal();
  });
if (dhConfirmBtn)
  dhConfirmBtn.addEventListener("click", async () => {
    if (!CURRENT_HEADER?.id) return;
    dhConfirmBtn.disabled = true;
    if (deleteBtn) deleteBtn.disabled = true; // already in a delete operation
    if (editHeaderBtn) editHeaderBtn.disabled = true; // mirror transient disable
    showMask("Deleting…");
    try {
      const { error } = await supabase
        .from("rm_bom_header")
        .delete()
        .eq("id", CURRENT_HEADER.id);
      if (error) {
        console.error(error);
        setStatus(`Delete failed: ${error.message}`, "error");
      } else {
        setStatus("Header deleted.", "success");
        CURRENT_HEADER = null;
        CURRENT_LINES = [blankLine()];
        await loadBom(CURRENT_PRODUCT_ID);
      }
    } finally {
      hideMask();
      closeDeleteHeaderModal();
      if (deleteBtn) deleteBtn.disabled = !CURRENT_HEADER; // reflect new state
      if (editHeaderBtn) editHeaderBtn.disabled = !CURRENT_PRODUCT_ID; // reflect product selection
      if (typeof syncMenuState === "function") syncMenuState();
    }
  });

nhCreateBtn.addEventListener("click", async () => {
  // Collect modal header data
  const prodId = parseInt(nhProduct.value, 10);
  if (!prodId) return alert("Select a product for the new header.");
  const refQtyVal = nhRefQty.value ? parseFloat(nhRefQty.value) : null;
  const refUomId = nhRefUom.value ? parseInt(nhRefUom.value, 10) : null;
  const lossVal = nhLossPct.value === "" ? null : parseFloat(nhLossPct.value);
  if (!refQtyVal || refQtyVal <= 0)
    return alert("Reference Output Qty must be > 0.");
  if (!refUomId) return alert("Reference Output UOM required.");
  if (lossVal != null && (lossVal < 0 || lossVal > 100))
    return alert("Process Loss % must be between 0 and 100.");

  // Warn if existing BOM header present
  const { data: existingHdr } = await supabase
    .from("rm_bom_header")
    .select("id")
    .eq("product_id", prodId)
    .limit(1)
    .maybeSingle();
  if (existingHdr?.id) {
    const proceed = confirm(
      "A BOM already exists for this product. Initialize new unsaved header anyway?"
    );
    if (!proceed) return;
  }

  CURRENT_PRODUCT_ID = prodId;
  productPicker.value = String(prodId);
  CURRENT_HEADER = null; // new unsaved header state
  refQty.value = refQtyVal.toFixed(3);
  refUom.value = refUomId;
  // Main form shows percent
  lossPct.value = lossVal == null ? "" : lossVal.toFixed(2);
  CURRENT_LINES = [blankLine()];

  // Optional clone lines from source product
  if (nhCloneToggle.checked && nhCloneProduct.value) {
    const sourceId = parseInt(nhCloneProduct.value, 10);
    if (sourceId && sourceId !== prodId) {
      const { data: sh, error: e1 } = await supabase
        .from("rm_bom_header")
        .select("id")
        .eq("product_id", sourceId)
        .maybeSingle();
      if (e1) {
        console.warn("Clone source header read error", e1);
      } else if (sh?.id) {
        const { data: sl, error: e2 } = await supabase
          .from("rm_bom_line")
          .select(
            "stock_item_id, qty_per_reference_output, uom_id, wastage_pct, is_optional, remarks"
          )
          .eq("rm_bom_id", sh.id)
          .order("line_no", { ascending: true });
        if (!e2 && sl && sl.length) CURRENT_LINES = sl;
      }
    }
  }
  await ensureMissingRmItems();
  closeNewHeaderModal();
  renderLines();
  renderQA();
  updateHeaderPills();
  setStatus("Initialized new unsaved header.", "info");
  if (typeof syncMenuState === "function") syncMenuState();
});

/* ---------------- Line delete modal handlers ---------------- */
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

/* ---------------- Insert popover logic ---------------- */
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
  if (top + popH > cardRect.bottom - 8) {
    top = anchorRect.top - popH - 8; // flip above
  }
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
  INSERT_TARGET_MODE = mode; // 'above' or 'below'
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
    FOCUSED_ROW_INDEX = pos; // focus first inserted row
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

/* ---------------- Boot ---------------- */
(async function init() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return (window.location.href = "login.html");
    // Load permissions for this module (prefer canonical RPC)
    try {
      const { data: perms, error: permsErr } = await supabase.rpc(
        "get_user_permissions",
        { p_user_id: session.user.id }
      );
      if (!permsErr && Array.isArray(perms)) {
        const p = perms.find((r) => r && r.target === `module:${MODULE_ID}`);
        if (p) {
          PERM_CAN_VIEW = !!p.can_view;
          PERM_CAN_EDIT = !!p.can_edit;
        }
      } else {
        // fallback
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
          console.warn("Permission load failed (legacy)", pErr);
        }
      }
    } catch (pErr) {
      console.warn("Permission load failed (RPC)", pErr);
    }
    if (!PERM_CAN_VIEW) {
      setStatus("You do not have permission to view this module.", "error");
      return;
    }
    await loadUoms();
    await loadProducts();
    await loadRmItems();
    // Backfill codes if any missing (some RPC versions might not return code)
    await ensureRmItemCodes();
    if (PRODUCTS.length) {
      CURRENT_PRODUCT_ID = PRODUCTS[0].id;
      productPicker.value = String(CURRENT_PRODUCT_ID);
      await loadBom(CURRENT_PRODUCT_ID);
      await ensureRmItemCodes();
    } else {
      setStatus("No products available.", "error");
    }
    applyPermissionUi();
  } catch (err) {
    console.error(err);
    setStatus(`Init error: ${err.message}`, "error");
  }
})();

/* ---------------- Helpers ---------------- */
async function ensureMissingRmItems() {
  // Gather unique missing IDs from CURRENT_LINES
  const missingIds = Array.from(
    new Set(
      CURRENT_LINES.map((l) => l.stock_item_id).filter(
        (id) =>
          id && !RM_ITEMS.some((x) => x.id === id) && typeof id === "number"
      )
    )
  );
  if (!missingIds.length) return;
  // Fetch their names directly (they may not be classified yet as RM)
  const { data, error } = await supabase
    .from("inv_stock_item")
    .select("id,name,code")
    .in("id", missingIds);
  if (error) {
    console.warn("Failed fetching missing RM item names", error);
    // Add placeholders to avoid blank selects
    missingIds.forEach((id) =>
      RM_ITEMS.push({ id, name: `Item #${id}`, code: null })
    );
    return;
  }
  (data || []).forEach((row) =>
    RM_ITEMS.push({ id: row.id, name: row.name, code: row.code || null })
  );
}

// Ensure codes exist for any RM_ITEMS entries lacking a code (RPC may omit)
async function ensureRmItemCodes() {
  const need = RM_ITEMS.filter((r) => !r.code).map((r) => r.id);
  if (!need.length) return;
  const { data, error } = await supabase
    .from("inv_stock_item")
    .select("id, code")
    .in("id", need);
  if (error) {
    console.warn("ensureRmItemCodes failed", error);
    return;
  }
  const map = new Map((data || []).map((r) => [r.id, r.code]));
  RM_ITEMS.forEach((r) => {
    if (!r.code) r.code = map.get(r.id) || r.code || null;
  });
}

// Debug helper: fetch a specific stock item and its class mappings to diagnose
// why it may not be included in `RM_ITEMS` (exposed to `window` for console use).
async function debugCheckStockItem(id) {
  try {
    console.groupCollapsed(`debugCheckStockItem: id=${id}`);
    const { data, error } = await supabase
      .from("inv_stock_item")
      .select(
        "id,name,code,inv_stock_item_class_map(category_id, inv_class_category(code))"
      )
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("debugCheckStockItem: query error", error);
      console.groupEnd();
      return { error };
    }
    console.log("row:", data);
    const maps = data?.inv_stock_item_class_map;
    console.log("class maps:", maps);
    const isRM =
      Array.isArray(maps) &&
      maps.some((m) => m.inv_class_category?.code === "RM");
    console.log("is classified RM?", isRM);
    console.groupEnd();
    return { data, isRM };
  } catch (e) {
    console.error("debugCheckStockItem: unexpected error", e);
    return { error: e };
  }
}
// expose to console for ad-hoc checks
window.debugCheckStockItem = debugCheckStockItem;

/* ---------------- Selection & Pills (View mode) ---------------- */
// selection set stores keys like "row:col" (e.g. "3:qty")
let SELECTED_CELLS = new Set();
let ANCHOR = null; // {i, col}
let LAST_SELECTED = null; // {i, col}
let SELECTION_OP = false; // when true, suppress native text selection
let LAST_DRAG_AT = 0; // timestamp of last drag end, used to ignore immediate click after drag
let LAST_DRAG_POS = null; // {x,y} of last mouseup during drag
// make `linesBody` focusable so we can move focus off individual cells when needed
if (linesBody && typeof linesBody.setAttribute === "function")
  linesBody.tabIndex = -1;

// Debug helpers removed for production — keep a no-op to avoid references
function dbg() {
  /* debug logging removed */
}

// Column ordering used for rectangle selection and arrow navigation
const COL_ORDER = [
  "sn",
  "code",
  "item",
  "qty",
  "uom",
  "wastage",
  "optional",
  "remarks",
];
function getColIndex(col) {
  return COL_ORDER.indexOf(col);
}
function getColByIndex(idx) {
  return COL_ORDER[Math.max(0, Math.min(COL_ORDER.length - 1, idx))];
}

function cellKey(i, col) {
  return `${i}:${col}`;
}
function parseCellKey(k) {
  const [sI, col] = String(k).split(":");
  return { i: parseInt(sI, 10), col };
}

function isNumericColumn(col) {
  return col === "qty" || col === "wastage";
}

function getCellValue(i, col) {
  const ln = CURRENT_LINES[i];
  if (!ln) return null;
  if (col === "qty")
    return ln.qty_per_reference_output == null
      ? null
      : Number(ln.qty_per_reference_output);
  if (col === "wastage") {
    if (ln.wastage_pct == null) return null;
    const raw = Number(ln.wastage_pct);
    return raw <= 1.5 ? raw * 100 : raw; // return percent
  }
  if (col === "code") return getItemCode(ln.stock_item_id) || "";
  if (col === "item") return getItemName(ln.stock_item_id) || "";
  if (col === "uom") return getUomCode(ln.uom_id) || "";
  if (col === "optional") return ln.is_optional ? "Yes" : "No";
  if (col === "remarks") return ln.remarks || "";
  if (col === "sn") return i + 1;
  return null;
}

function clearSelection() {
  SELECTED_CELLS.clear();
  ANCHOR = null;
  LAST_SELECTED = null;
  refreshSelectionVisuals();
  updateSelectionPills();
}

function refreshSelectionVisuals() {
  dbg("refreshSelectionVisuals:start", { size: SELECTED_CELLS.size });
  // Build a quick lookup for selected cells
  const isSelected = (r, c) => SELECTED_CELLS.has(cellKey(r, c));
  Array.from(linesBody.querySelectorAll("td[data-col]")).forEach((td) => {
    const tr = td.closest("tr[data-i]");
    const i = tr ? parseInt(tr.dataset.i, 10) : null;
    const col = td.dataset.col;
    if (!Number.isFinite(i) || !col) return;
    const k = cellKey(i, col);
    const selected = SELECTED_CELLS.has(k);
    // Clear edge classes
    td.classList.remove(
      "cell-selected",
      "sel-t",
      "sel-b",
      "sel-l",
      "sel-r",
      "cell-active",
      "cell-focused"
    );
    if (selected) {
      td.classList.add("cell-selected");
      // Determine which edges need an outer border by checking neighbors
      const upSel = isSelected(i - 1, col);
      const downSel = isSelected(i + 1, col);
      const leftCol = getColByIndex(getColIndex(col) - 1);
      const rightCol = getColByIndex(getColIndex(col) + 1);
      const leftSel = leftCol ? isSelected(i, leftCol) : false;
      const rightSel = rightCol ? isSelected(i, rightCol) : false;
      if (!upSel) td.classList.add("sel-t");
      if (!downSel) td.classList.add("sel-b");
      if (!leftSel) td.classList.add("sel-l");
      if (!rightSel) td.classList.add("sel-r");
    }
    // Accessibility: expose selection state, indices and make cells focusable
    td.setAttribute("aria-selected", selected ? "true" : "false");
    td.setAttribute("role", "gridcell");
    td.setAttribute("aria-rowindex", String(i + 1));
    td.setAttribute("aria-colindex", String(getColIndex(col) + 1));
    td.tabIndex = 0;
    // Ensure row has role
    if (tr) tr.setAttribute("role", "row");
  });
  // Highlight LAST_SELECTED (active cell) with stronger border
  if (LAST_SELECTED) {
    const lastEl = linesBody.querySelector(
      `tr[data-i='${LAST_SELECTED.i}'] td[data-col='${LAST_SELECTED.col}']`
    );
    if (lastEl) {
      lastEl.classList.add("cell-active");
      // ensure active cell is visible
      try {
        lastEl.scrollIntoView({ block: "nearest", inline: "nearest" });
      } catch (err) {
        void err;
      }
    }
  }
  dbg("refreshSelectionVisuals:end", { size: SELECTED_CELLS.size });
  // Diagnostic: compare DOM selected cells to the set
  try {
    const domEls = Array.from(
      linesBody.querySelectorAll("td.cell-selected, td.cell-active")
    );
    const domCount = domEls.length;
    const domKeys = domEls
      .map((el) => {
        const r = el.closest("tr[data-i]");
        const ri = r ? parseInt(r.dataset.i, 10) : -1;
        const c = el.dataset.col || "";
        return `${ri}:${c}`;
      })
      .slice(0, 20);
    if (domCount !== SELECTED_CELLS.size) {
      dbg("refreshSelectionVisuals:mismatch", {
        domCount,
        setSize: SELECTED_CELLS.size,
        domSample: domKeys,
        setSample: Array.from(SELECTED_CELLS).slice(0, 20),
      });
    } else {
      dbg("refreshSelectionVisuals:match", { domCount, sample: domKeys });
    }
  } catch (err) {
    void err;
  }
}

// Helpers for connected component and selection operations
function getNeighborCoords(i, col) {
  const idx = getColIndex(col);
  const neighbors = [];
  neighbors.push({ i: i - 1, col });
  neighbors.push({ i: i + 1, col });
  if (idx - 1 >= 0) neighbors.push({ i, col: getColByIndex(idx - 1) });
  if (idx + 1 < COL_ORDER.length)
    neighbors.push({ i, col: getColByIndex(idx + 1) });
  return neighbors;
}

function getConnectedComponent(anchor) {
  if (!anchor) return new Set();
  const startKey = cellKey(anchor.i, anchor.col);
  if (!SELECTED_CELLS.has(startKey)) return new Set([startKey]);
  const visited = new Set();
  const q = [anchor];
  while (q.length) {
    const cur = q.shift();
    const k = cellKey(cur.i, cur.col);
    if (visited.has(k)) continue;
    if (!SELECTED_CELLS.has(k)) continue;
    visited.add(k);
    const neigh = getNeighborCoords(cur.i, cur.col);
    for (const n of neigh) {
      const nk = cellKey(n.i, n.col);
      if (!visited.has(nk) && SELECTED_CELLS.has(nk)) q.push(n);
    }
  }
  return visited;
}

function componentBottomRight(component) {
  let maxI = -Infinity;
  let maxColIdx = -Infinity;
  for (const k of component) {
    const { i, col } = parseCellKey(k);
    if (i > maxI) maxI = i;
    const cidx = getColIndex(col);
    if (cidx > maxColIdx) maxColIdx = cidx;
  }
  if (maxI === -Infinity) return null;
  return { i: maxI, col: getColByIndex(maxColIdx) };
}

function selectRectangle(a, b, additive = false) {
  // a and b are {i, col}
  if (!a || !b) return;
  const r1 = Math.min(a.i, b.i);
  const r2 = Math.max(a.i, b.i);
  const c1 = Math.min(getColIndex(a.col), getColIndex(b.col));
  const c2 = Math.max(getColIndex(a.col), getColIndex(b.col));
  dbg("selectRectangle", { a, b, additive, r1, r2, c1, c2 });
  if (!additive) SELECTED_CELLS.clear();
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const col = getColByIndex(c);
      SELECTED_CELLS.add(cellKey(r, col));
    }
  }
  dbg("selectRectangle:after", {
    size: SELECTED_CELLS.size,
    sample: Array.from(SELECTED_CELLS).slice(0, 12),
  });
  refreshSelectionVisuals();
  updateSelectionPills();
}

// Reconcile DOM selection classes with internal SET: remove any visual-only
// selection markers that are not present in SELECTED_CELLS. This is defensive
// against transient DOM state left behind by race conditions.
function reconcileDomWithSet() {
  try {
    const els = Array.from(
      linesBody.querySelectorAll("td.cell-selected, td.cell-active")
    );
    let removed = 0;
    for (const el of els) {
      const tr = el.closest("tr[data-i]");
      const ri = tr ? parseInt(tr.dataset.i, 10) : -1;
      const col = el.dataset.col || "";
      const k = cellKey(ri, col);
      if (!SELECTED_CELLS.has(k)) {
        el.classList.remove(
          "cell-selected",
          "sel-t",
          "sel-b",
          "sel-l",
          "sel-r",
          "cell-active",
          "cell-focused"
        );
        el.setAttribute("aria-selected", "false");
        removed++;
      }
    }
    if (removed)
      dbg("reconcileDomWithSet", { removed, setSize: SELECTED_CELLS.size });
  } catch (err) {
    void err;
  }
}

// Force clear all selection visuals from the table. This is a blunt tool
// to remove any stray highlight element immediately. The real selection
// state (`SELECTED_CELLS`) is not modified; `refreshSelectionVisuals`
// will reapply visuals for the real set when needed.
function clearAllSelectionVisuals() {
  try {
    const els = Array.from(linesBody.querySelectorAll("td[data-col]"));
    for (const el of els) {
      el.classList.remove(
        "cell-selected",
        "sel-t",
        "sel-b",
        "sel-l",
        "sel-r",
        "cell-active",
        "cell-focused"
      );
      el.setAttribute("aria-selected", "false");
    }
    dbg("clearAllSelectionVisuals");
  } catch (err) {
    void err;
  }
}

// Detect if any table cell is showing a persistent visual (outline/box-shadow/bg)
// after shift-based selection and, conservatively, blur it to remove the visual.
// This is intentionally conservative: it only blurs focused/visually-highlighted
// cells after shift actions so we don't interfere with normal keyboard navigation.
// `linesBody` was made focusable above so we can move focus off cells.

// Prevent native select when we are performing selection operations
document.addEventListener("selectstart", (e) => {
  if (SELECTION_OP) e.preventDefault();
});

function updateSelectionPills() {
  if (!selectionPills) return;
  const totalLines = CURRENT_LINES.length;
  const selCount = SELECTED_CELLS.size;
  const cols = new Map();
  for (const k of SELECTED_CELLS) {
    const { i, col } = parseCellKey(k);
    if (!cols.has(col)) cols.set(col, []);
    cols.get(col).push(i);
  }
  const parts = [];

  parts.push(
    `<div class="erp-pill-chip small"><span class="pill-seg title"><span class="title-text">Lines</span></span><span class="pill-seg value">${totalLines}</span></div>`
  );
  if (selCount) {
    parts.push(
      `<div class="erp-pill-chip small" title="Selected cells"><span class="pill-seg title"><span class="title-text">Selected</span></span><span class="pill-seg value">${selCount}</span></div>`
    );
    if (cols.size === 1) {
      const col = Array.from(cols.keys())[0];
      if (isNumericColumn(col)) {
        const vals = cols
          .get(col)
          .map((r) => getCellValue(r, col))
          .filter((v) => Number.isFinite(v));
        const sum = vals.reduce((a, b) => a + b, 0);
        const avg = vals.length ? sum / vals.length : 0;
        const min = vals.length ? Math.min(...vals) : 0;
        const max = vals.length ? Math.max(...vals) : 0;
        parts.push(
          `<div class="erp-pill-chip small" title="Sum"><span class="pill-seg title"><span class="title-text">Sum</span></span><span class="pill-seg value">${sum.toFixed(
            3
          )}</span></div>`
        );
        parts.push(
          `<div class="erp-pill-chip small" title="Avg"><span class="pill-seg title"><span class="title-text">Avg</span></span><span class="pill-seg value">${avg.toFixed(
            3
          )}</span></div>`
        );
        parts.push(
          `<div class="erp-pill-chip small" title="Min"><span class="pill-seg title"><span class="title-text">Min</span></span><span class="pill-seg value">${min.toFixed(
            3
          )}</span></div>`
        );
        parts.push(
          `<div class="erp-pill-chip small" title="Max"><span class="pill-seg title"><span class="title-text">Max</span></span><span class="pill-seg value">${max.toFixed(
            3
          )}</span></div>`
        );
      } else {
        const uniq = new Set(
          cols.get(col).map((r) => String(getCellValue(r, col)))
        );
        parts.push(
          `<div class="erp-pill-chip small" title="Unique values"><span class="pill-seg title"><span class="title-text">Unique</span></span><span class="pill-seg value">${uniq.size}</span></div>`
        );
      }
    } else if (cols.size > 1) {
      for (const [col, rows] of cols) {
        parts.push(
          `<div class="erp-pill-chip small" title="${col}"><span class="pill-seg title"><span class="title-text">${col}</span></span><span class="pill-seg value">${rows.length}</span></div>`
        );
      }
    }
    parts.push(
      `<button id="selCopyBtn" class="btn ghost" title="Copy selection" style="padding:6px 8px">Copy</button>`
    );
    parts.push(
      `<button id="selCsvBtn" class="btn ghost" title="Export selection CSV" style="padding:6px 8px">Export CSV</button>`
    );
    parts.push(
      `<button id="selClearBtn" class="btn ghost" title="Clear selection" style="padding:6px 8px">Clear</button>`
    );
  }
  selectionPills.innerHTML = parts.join("");
  const copyBtn = document.getElementById("selCopyBtn");
  const csvBtn = document.getElementById("selCsvBtn");
  const clearBtn = document.getElementById("selClearBtn");
  if (copyBtn) copyBtn.addEventListener("click", copySelection);
  if (csvBtn) csvBtn.addEventListener("click", exportSelectionCsv);
  if (clearBtn)
    clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      clearSelection();
    });
}

function copySelection() {
  if (!SELECTED_CELLS.size) return;
  const lines = ["Row,Column,Value"];
  for (const k of SELECTED_CELLS) {
    const { i, col } = parseCellKey(k);
    const v = getCellValue(i, col);
    lines.push(`${i + 1},${col},"${String(v ?? "").replace(/"/g, '""')}"`);
  }
  const text = lines.join("\n");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => setStatus("Copied selection to clipboard.", "success", 1400));
  } else {
    setStatus("Clipboard unavailable.", "error", 2000);
  }
}

function exportSelectionCsv() {
  if (!SELECTED_CELLS.size) return;
  const rows = [["Row", "Column", "Value"]];
  for (const k of SELECTED_CELLS) {
    const { i, col } = parseCellKey(k);
    const v = getCellValue(i, col);
    rows.push([String(i + 1), col, v == null ? "" : String(v)]);
  }
  const esc = (s) => {
    const ss = s == null ? "" : String(s);
    if (/[",\n]/.test(ss)) return `"${ss.replace(/"/g, '""')}"`;
    return ss;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const filename = `selection_${formatDateStamp()}.csv`;
  downloadBlob(csv, "text/csv;charset=utf-8", filename);
  setStatus("Selection exported.", "success", 1400);
}

// Mouse/keyboard selection handling (view mode)
function getTdFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  return el ? el.closest("td[data-col]") : null;
}

// Drag selection
linesBody.addEventListener("mousedown", (e) => {
  if (LINES_EDIT_MODE) return;
  if (e.button !== 0) return; // left button only
  const td = e.target.closest("td[data-col]");
  if (!td) return;
  // If modifier keys present, do not start a drag selection here
  // (click handler will handle Ctrl/Shift semantics)
  if (e.shiftKey || e.ctrlKey || e.metaKey) return;
  e.preventDefault();
  const tr = td.closest("tr[data-i]");
  const i = parseInt(tr.dataset.i, 10);
  const col = td.dataset.col;
  if (!Number.isFinite(i) || !col) return;
  ANCHOR = { i, col };
  LAST_SELECTED = { i, col };
  selectRectangle(ANCHOR, ANCHOR, false);
  // disable native text selection during drag
  SELECTION_OP = true;
  const prevUserSelect = document.body.style.userSelect;
  document.body.style.userSelect = "none";
  const onMove = (ev) => {
    const ctd = getTdFromPoint(ev.clientX, ev.clientY);
    if (!ctd) return;
    const ctr = ctd.closest("tr[data-i]");
    const ci = parseInt(ctr.dataset.i, 10);
    const ccol = ctd.dataset.col;
    if (!Number.isFinite(ci) || !ccol) return;
    dbg("drag:onMove", {
      x: ev.clientX,
      y: ev.clientY,
      to: { i: ci, col: ccol },
    });
    selectRectangle(ANCHOR, { i: ci, col: ccol }, false);
    LAST_SELECTED = { i: ci, col: ccol };
  };
  const onUp = (ev) => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    // restore text selection
    SELECTION_OP = false;
    document.body.style.userSelect = prevUserSelect || "";
    // finalise visuals
    refreshSelectionVisuals();
    updateSelectionPills();
    // done
    // mark recent drag end so a subsequent click (from the same action) is ignored
    LAST_DRAG_AT = Date.now();
    LAST_DRAG_POS = { x: ev.clientX, y: ev.clientY };
    setTimeout(() => {
      LAST_DRAG_AT = 0;
      LAST_DRAG_POS = null;
    }, 300);
    dbg("drag:onUp", {
      selectedSize: SELECTED_CELLS.size,
      anchor: ANCHOR,
      last: LAST_SELECTED,
      lastDragAt: LAST_DRAG_AT,
    });
  };
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
});

// Click / Ctrl / Shift handling
linesBody.addEventListener("click", (e) => {
  if (LINES_EDIT_MODE) return;
  const td = e.target.closest("td[data-col]");
  if (!td) return;
  const tr = td.closest("tr[data-i]");
  if (!tr) return;
  const i = parseInt(tr.dataset.i, 10);
  const col = td.dataset.col;
  if (!Number.isFinite(i) || !col) return;
  const coord = { i, col };

  // Clear any native text selection that may occur during clicks
  try {
    window.getSelection()?.removeAllRanges();
  } catch (err) {
    void err;
  }
  // If a drag just ended very recently, ignore the click only if it is the
  // synthetic click generated by the same mouseup (i.e. located at the same
  // coordinates). This avoids swallowing intentional quick clicks elsewhere.
  if (LAST_DRAG_AT && Date.now() - LAST_DRAG_AT < 300) {
    if (LAST_DRAG_POS) {
      const dx = Math.abs((e.clientX || 0) - LAST_DRAG_POS.x);
      const dy = Math.abs((e.clientY || 0) - LAST_DRAG_POS.y);
      if (dx < 6 && dy < 6) return; // likely the synthetic click from mouseup
    }
  }
  // Now that we know the click will be processed, clear any visual-only
  // selection artifacts and reconcile DOM with the internal set.
  clearAllSelectionVisuals();
  reconcileDomWithSet();
  const beforeSize = SELECTED_CELLS.size;
  dbg("click:start", {
    coord,
    shift: e.shiftKey,
    ctrl: e.ctrlKey,
    beforeSize,
    anchor: ANCHOR,
    last: LAST_SELECTED,
    tdClass: Array.from(td.classList),
    lastDragAt: LAST_DRAG_AT,
  });

  // Helper: derive a usable anchor when needed
  const resolveAnchor = () => {
    if (ANCHOR) return ANCHOR;
    if (LAST_SELECTED) return LAST_SELECTED;
    if (SELECTED_CELLS.size) {
      const first = SELECTED_CELLS.values().next().value;
      if (first) return parseCellKey(first);
    }
    return null;
  };

  // SHIFT handling: rectangle select from anchor/last to clicked cell
  if (e.shiftKey) {
    const base = resolveAnchor();
    if (base) {
      // Ctrl+Shift makes the rectangle additive
      const additive = e.ctrlKey || e.metaKey;
      selectRectangle(base, coord, additive);
      // If additive, keep the anchor as-is and place LAST_SELECTED at bottom-right of
      // the connected component containing the anchor, otherwise make the clicked cell the last
      if (additive) {
        const comp = getConnectedComponent(ANCHOR || base || coord);
        const br = componentBottomRight(comp);
        if (br) LAST_SELECTED = br;
      } else {
        LAST_SELECTED = coord;
        ANCHOR = base;
      }
      refreshSelectionVisuals();
      updateSelectionPills();
      // After mouse/Shift selection, move focus off the clicked cell so
      // the browser's mouse-focus ring does not remain visible on the td.
      try {
        td.blur && td.blur();
        // don't move focus to the container; leaving focus cleared
        // prevents the UA focus ring from appearing around the whole table
      } catch (err) {
        void err;
      }
      return;
    }
    // If no anchor to expand from, fall through to simple selection
  }

  // CTRL toggle individual cell (preserve existing anchor when possible)
  if (e.ctrlKey || e.metaKey) {
    const k = cellKey(i, col);
    // account for possible DOM vs set mismatch: sometimes a stray visual
    // highlight may remain on a cell though SELECTED_CELLS doesn't include it.
    // In that case, prefer the DOM state and toggle accordingly so Ctrl-click
    // on the same visually-highlighted cell will clear it.
    const had = SELECTED_CELLS.has(k);
    const domHas =
      td.classList.contains("cell-selected") ||
      td.classList.contains("cell-active");
    // If DOM indicates selected but set doesn't, treat as had=true so we remove it
    const treatAsHad = had || (!had && domHas);
    dbg("ctrl:toggle:pre", { coord, had, domHas, beforeSize });
    if (treatAsHad) SELECTED_CELLS.delete(k);
    else SELECTED_CELLS.add(k);
    dbg("ctrl:toggle:post", { coord, size: SELECTED_CELLS.size });
    // If selection became empty, clear anchor/active
    if (SELECTED_CELLS.size === 0) {
      ANCHOR = null;
      LAST_SELECTED = null;
      refreshSelectionVisuals();
      updateSelectionPills();
      return;
    }

    // If there was no prior selection, this becomes the anchor
    if (beforeSize === 0) {
      ANCHOR = coord;
      LAST_SELECTED = coord;
    } else {
      // If anchor was removed, pick a new anchor
      if (ANCHOR && !SELECTED_CELLS.has(cellKey(ANCHOR.i, ANCHOR.col))) {
        const first = SELECTED_CELLS.values().next().value;
        ANCHOR = first ? parseCellKey(first) : null;
      }
      // Ensure LAST_SELECTED is within the connected component of the anchor
      const comp = getConnectedComponent(ANCHOR || LAST_SELECTED || coord);
      const br = componentBottomRight(comp);
      if (br) LAST_SELECTED = br;
    }
    refreshSelectionVisuals();
    updateSelectionPills();
    return;
  }

  // Simple click: single select
  SELECTED_CELLS.clear();
  SELECTED_CELLS.add(cellKey(i, col));
  ANCHOR = coord;
  LAST_SELECTED = coord;
  refreshSelectionVisuals();
  updateSelectionPills();
});

// Keyboard: Shift+Arrows expand selection; Arrow alone moves anchor/last
document.addEventListener("keydown", (e) => {
  if (LINES_EDIT_MODE) return;
  const arrows = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
  const specials = ["Home", "End"];
  if (e.key === "Escape") {
    if (SELECTED_CELLS.size) clearSelection();
    return;
  }
  if (!arrows.includes(e.key) && !specials.includes(e.key)) return;
  const focused = LAST_SELECTED || ANCHOR;
  if (!focused) return;
  e.preventDefault();
  let target = { i: focused.i, col: focused.col };
  const colIdx = getColIndex(focused.col);
  // Home/End handling
  if (e.key === "Home") {
    if (e.ctrlKey) {
      // Ctrl+Home -> first cell of table
      target.i = 0;
      target.col = getColByIndex(0);
    } else {
      // Home -> first cell of row
      target.col = getColByIndex(0);
    }
  }
  if (e.key === "End") {
    if (e.ctrlKey) {
      // Ctrl+End -> last cell of table
      target.i = Math.max(0, CURRENT_LINES.length - 1);
      target.col = getColByIndex(COL_ORDER.length - 1);
    } else {
      // End -> last cell of row
      target.col = getColByIndex(COL_ORDER.length - 1);
    }
  }
  // Arrow navigation with Ctrl to jump to ends
  if (arrows.includes(e.key)) {
    if (e.key === "ArrowUp") {
      target.i = e.ctrlKey ? 0 : Math.max(0, focused.i - 1);
    }
    if (e.key === "ArrowDown") {
      target.i = e.ctrlKey
        ? Math.min(CURRENT_LINES.length - 1, CURRENT_LINES.length - 1)
        : Math.min(CURRENT_LINES.length - 1, focused.i + 1);
    }
    if (e.key === "ArrowLeft") {
      target.col = getColByIndex(e.ctrlKey ? 0 : Math.max(0, colIdx - 1));
    }
    if (e.key === "ArrowRight") {
      target.col = getColByIndex(
        e.ctrlKey
          ? COL_ORDER.length - 1
          : Math.min(COL_ORDER.length - 1, colIdx + 1)
      );
    }
  }

  if (e.shiftKey) {
    // expand rectangle from anchor (or focused) to target
    const base = ANCHOR || focused;
    // if Ctrl also pressed, make it additive
    selectRectangle(base, target, !!e.ctrlKey);
    LAST_SELECTED = target;
    refreshSelectionVisuals();
    updateSelectionPills();
  } else if (e.ctrlKey || e.metaKey) {
    // If Ctrl alone (no Shift): move selection/focus to target (single cell)
    // This matches spreadsheet behavior when a single cell is selected.
    if (!e.shiftKey) {
      SELECTED_CELLS.clear();
      SELECTED_CELLS.add(cellKey(target.i, target.col));
      ANCHOR = target;
      LAST_SELECTED = target;
      refreshSelectionVisuals();
      updateSelectionPills();
    } else {
      // otherwise move focus without changing selection
      ANCHOR = target;
      LAST_SELECTED = target;
      refreshSelectionVisuals();
    }
  } else {
    // move single selection
    SELECTED_CELLS.clear();
    SELECTED_CELLS.add(cellKey(target.i, target.col));
    ANCHOR = target;
    LAST_SELECTED = target;
    refreshSelectionVisuals();
    updateSelectionPills();
  }
});

/* -------- Kebab menu interactions -------- */
function syncMenuState() {
  // Reflect disabled states that are already managed elsewhere
  // Delete is enabled only when a header exists
  if (deleteBtn) deleteBtn.disabled = !CURRENT_HEADER;
  // Edit is enabled when a product is selected
  if (editHeaderBtn) editHeaderBtn.disabled = !CURRENT_PRODUCT_ID;
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
      // Defer binding to avoid immediate close from this click
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
    } else {
      closeMenu();
    }
  });
  // Close when clicking a menu item
  moreMenu.addEventListener("click", (e) => {
    if (e.target.closest(".menu-item")) closeMenu();
  });
}

/* -------- Export menu interactions -------- */
function positionMenuFixed(panel, anchor) {
  if (!panel || !anchor) return;
  // Use fixed positioning so the panel escapes any overflow clipping
  panel.style.position = "fixed";
  panel.style.top = "0px";
  panel.style.left = "0px";
  const a = anchor.getBoundingClientRect();
  // ensure we have dimensions
  const w = panel.offsetWidth || 220;
  const h = panel.offsetHeight || 140;
  let top = a.bottom + 6;
  let left = a.left;
  // clamp within viewport
  if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
  if (top + h > window.innerHeight - 8) top = a.top - h - 8;
  if (left < 8) left = 8;
  if (top < 8) top = 8;
  panel.style.top = `${top + window.scrollY}px`;
  panel.style.left = `${left + window.scrollX}px`;
}

if (exportBtn && exportMenu) {
  const closeExport = () => {
    exportMenu.classList.remove("open");
    exportBtn.setAttribute("aria-expanded", "false");
    // Clear fixed positioning when closed
    exportMenu.style.position = "";
    exportMenu.style.top = "";
    exportMenu.style.left = "";
  };
  exportBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = !exportMenu.classList.contains("open");
    if (willOpen) {
      exportMenu.classList.add("open");
      exportBtn.setAttribute("aria-expanded", "true");
      // Position relative to button and clamp within viewport
      requestAnimationFrame(() => positionMenuFixed(exportMenu, exportBtn));
      setTimeout(() => {
        const onDocClick = (ev) => {
          if (!exportMenu.contains(ev.target) && ev.target !== exportBtn) {
            closeExport();
            document.removeEventListener("click", onDocClick);
            document.removeEventListener("keydown", onEsc);
          }
        };
        const onEsc = (ev) => {
          if (ev.key === "Escape") {
            closeExport();
            document.removeEventListener("click", onDocClick);
            document.removeEventListener("keydown", onEsc);
          }
        };
        document.addEventListener("click", onDocClick);
        document.addEventListener("keydown", onEsc);
      }, 0);
    } else {
      closeExport();
    }
  });
  exportMenu.addEventListener("click", (e) => {
    if (e.target.closest(".menu-item")) closeExport();
  });
}

/* -------- Mode overflow menu (for very small screens) -------- */
const modeOverflowBtn = el("modeOverflowBtn");
const modeOverflowMenu = el("modeOverflowMenu");
const modeViewItem = el("modeViewItem");
const modeEditItem = el("modeEditItem");

if (modeOverflowBtn && modeOverflowMenu) {
  const closeMenu = () => {
    modeOverflowMenu.classList.remove("open");
    modeOverflowBtn.setAttribute("aria-expanded", "false");
    modeOverflowMenu.style.position = "";
    modeOverflowMenu.style.top = "";
    modeOverflowMenu.style.left = "";
    modeOverflowMenu.style.display = "";
    window.removeEventListener("resize", onMenuResize);
  };
  const positionMenu = () => {
    if (!modeOverflowMenu.classList.contains("open")) return;
    modeOverflowMenu.style.position = "fixed";
    modeOverflowMenu.style.display = "block";
    const rect = modeOverflowBtn.getBoundingClientRect();
    const menuW = modeOverflowMenu.offsetWidth || 180;
    const menuH = modeOverflowMenu.offsetHeight || 120;
    let top = rect.bottom + 6;
    let left = rect.left;
    if (left + menuW > window.innerWidth - 8)
      left = window.innerWidth - menuW - 8;
    if (left < 8) left = 8;
    if (top + menuH > window.innerHeight - 8) top = rect.top - menuH - 8;
    if (top < 8) top = 8;
    modeOverflowMenu.style.top = `${top}px`;
    modeOverflowMenu.style.left = `${left}px`;
  };
  const onMenuResize = () => positionMenu();

  modeOverflowBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = !modeOverflowMenu.classList.contains("open");
    if (willOpen) {
      modeOverflowMenu.classList.add("open");
      modeOverflowBtn.setAttribute("aria-expanded", "true");
      positionMenu();
      window.addEventListener("resize", onMenuResize);
      setTimeout(() => {
        const onDocClick = (ev) => {
          if (
            !modeOverflowMenu.contains(ev.target) &&
            ev.target !== modeOverflowBtn
          ) {
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
    } else {
      closeMenu();
    }
  });

  // Wire menu item clicks to the same handlers as the inline toggle
  if (modeViewItem) {
    modeViewItem.addEventListener("click", (e) => {
      e.stopPropagation();
      // trigger inline handler so state and UI remain in sync
      linesViewBtn?.click();
      modeOverflowMenu.classList.remove("open");
      modeOverflowBtn.setAttribute("aria-expanded", "false");
    });
  }
  if (modeEditItem) {
    modeEditItem.addEventListener("click", (e) => {
      e.stopPropagation();
      linesEditBtn?.click();
      modeOverflowMenu.classList.remove("open");
      modeOverflowBtn.setAttribute("aria-expanded", "false");
    });
  }
}

/* -------- Export helpers -------- */
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
function getProductLabel(pid) {
  const p = PRODUCTS.find((x) => x.id === pid);
  return p ? p.label : `Product-${pid}`;
}
function getUomCode(id) {
  const u = UOMS.find((x) => x.id === id);
  return u ? u.code : "";
}
function getItemName(id) {
  const it = RM_ITEMS.find((x) => x.id === id);
  return it ? it.name : id ? `Item #${id}` : "";
}
function getItemCode(id) {
  const it = RM_ITEMS.find((x) => x.id === id);
  return it?.code || "";
}
function buildBomSnapshot() {
  const productLabel = getProductLabel(CURRENT_PRODUCT_ID);
  const header = collectHeader();
  // display percent with 2 decimals for output
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
    productLabel,
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
  if (!CURRENT_PRODUCT_ID)
    return setStatus("Select a product to export.", "error");
  const snap = buildBomSnapshot();
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows = [];
  rows.push(["Product", snap.productLabel]);
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
    "Stock Item (RM)",
    "Qty per Ref",
    "UOM",
    "Wastage %",
    "Optional",
    "Remarks",
  ]);
  for (const ln of snap.lines) {
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
  }
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const filename = `rm-bom_${sanitizeFilename(
    snap.productLabel
  )}_${formatDateStamp()}.csv`;
  downloadBlob(csv, "text/csv;charset=utf-8", filename);
  setStatus("CSV exported.", "success", 1800);
}
function buildHtmlDocument({ snap, color = true, autoPrint = false }) {
  const title = `Raw Material BOM — ${snap.productLabel}`;
  const style = color
    ? `
    body{font-family:Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;margin:24px}
    h1{font-size:20px;margin:0 0 12px 0}
    .meta{display:grid;grid-template-columns:220px 1fr;row-gap:6px;column-gap:12px;margin:12px 0 16px}
    .meta .label{color:#64748b;text-transform:uppercase;letter-spacing:.5px;font-size:12px;font-weight:600}
    .pill{display:inline-flex;align-items:center;border:1px solid #0ea5e9;background:#f0f9ff;border-radius:999px;padding:4px 10px;color:#0c4a6e;font-weight:600}
    table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #e2e8f0;padding:8px 10px;font-size:13px}
    thead th{background:#f1f5f9;text-align:center}
    tbody tr:nth-child(even){background:#fafafa}
    td.right{text-align:right}
    td.center{text-align:center}
    .muted{color:#64748b}
  `
    : `
    @media screen{body{margin:24px}}
    body{font-family:Segoe UI,Roboto,Arial,sans-serif;color:#000}
    h1{font-size:18px;margin:0 0 10px 0}
    .meta{display:grid;grid-template-columns:220px 1fr;row-gap:6px;column-gap:12px;margin:10px 0 14px}
    .meta .label{color:#000;text-transform:uppercase;letter-spacing:.5px;font-size:11px;font-weight:700}
    table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #000;padding:6px 8px;font-size:12px}
    thead th{text-align:center;background:#fff}
    td.right{text-align:right}
    td.center{text-align:center}
    @media print{
      *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      body{margin:0}
      h1{font-size:16px;margin:0 0 8px 0}
    }
  `;
  const loss = snap.lossPct != null ? `${snap.lossPct.toFixed(2)}%` : "—";
  const headerHtml = `
    <div class="meta">
      <div class="label">Product</div><div>${snap.productLabel}</div>
      <div class="label">Reference Output</div><div>${snap.refQty ?? "—"} ${
    snap.refUom || ""
  }</div>
      <div class="label">Process Loss %</div><div>${loss}</div>
      <div class="label">Exported At</div><div>${new Date().toLocaleString()}</div>
    </div>
  `;
  const rows = snap.lines
    .map(
      (ln) => `
      <tr>
        <td class="center">${ln.sn}</td>
        <td class="center">${ln.itemCode || ""}</td>
        <td>${ln.itemName || ""}</td>
        <td class="right">${ln.qty ?? ""}</td>
        <td class="center">${ln.uom || ""}</td>
        <td class="right">${
          ln.wastagePct === "" ? "" : Number(ln.wastagePct).toFixed(2)
        }%</td>
        <td class="center">${ln.optional}</td>
        <td>${(ln.remarks || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")}</td>
      </tr>`
    )
    .join("");
  const html = `<!DOCTYPE html>
  <html><head><meta charset="utf-8" />
  <title>${title}</title>
  <style>${style}</style></head>
  <body>
    <h1>${title}</h1>
    ${headerHtml}
    <table>
      <thead><tr><th>SN</th><th>Stock Item Code</th><th>Stock Item (RM)</th><th>Qty per Ref</th><th>UOM</th><th>Wastage %</th><th>Optional</th><th>Remarks</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${autoPrint ? "<script>window.onload=()=>{window.print();}</script>" : ""}
  </body></html>`;
  return html;
}
function exportPdf() {
  if (!PERM_CAN_EDIT)
    return setStatus("You do not have permission to export.", "error");
  if (!CURRENT_PRODUCT_ID)
    return setStatus("Select a product to export.", "error");
  const snap = buildBomSnapshot();
  const jspdfNS = window.jspdf || window.jsPDF || {};
  const jsPDF = jspdfNS.jsPDF || jspdfNS;
  if (typeof jsPDF !== "function") {
    return setStatus(
      "PDF generator unavailable. Check network or jsPDF load.",
      "error"
    );
  }
  const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
  const margin = 36;
  const page = doc.internal.pageSize;
  const pageWidth = page.getWidth ? page.getWidth() : page.width;
  const pageHeight = page.getHeight ? page.getHeight() : page.height;
  let y = margin;
  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(`Raw Material BOM — ${snap.productLabel}`, margin, y);
  y += 18;
  // Meta
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const meta = [
    ["Product", snap.productLabel],
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
      "Stock Item (RM)",
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
        // footer page number
        const str = `Page ${doc.internal.getNumberOfPages()}`;
        doc.setFontSize(9);
        doc.text(str, pageWidth - margin, pageHeight - 12, { align: "right" });
      },
      margin: { left: margin, right: margin },
    });
  } else {
    // Basic fallback table
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
  const filename = `rm-bom_${sanitizeFilename(
    snap.productLabel
  )}_${formatDateStamp()}.pdf`;
  // Prefer explicit blob download to avoid environment-specific quirks
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
    // Fallback to jsPDF's built-in saver
    console.warn("PDF blob download failed; falling back to doc.save", e);
    doc.save(filename);
  }
}
function exportHtml() {
  if (!PERM_CAN_EDIT)
    return setStatus("You do not have permission to export.", "error");
  if (!CURRENT_PRODUCT_ID)
    return setStatus("Select a product to export.", "error");
  const snap = buildBomSnapshot();
  const html = buildHtmlDocument({ snap, color: true, autoPrint: false });
  // Offer both open-in-new-tab and download
  const filename = `rm-bom_${sanitizeFilename(
    snap.productLabel
  )}_${formatDateStamp()}.html`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  // Also trigger a download silently
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

// Wire export actions
if (exportCsvBtn) exportCsvBtn.addEventListener("click", exportCsv);
if (exportPdfBtn) exportPdfBtn.addEventListener("click", exportPdf);
if (exportHtmlBtn) exportHtmlBtn.addEventListener("click", exportHtml);

// Toggle handlers
if (linesViewBtn) {
  linesViewBtn.addEventListener("click", () => {
    if (!LINES_EDIT_MODE) return; // already in view
    LINES_EDIT_MODE = false;
    linesViewBtn.classList.add("active");
    linesEditBtn?.classList.remove("active");
    applyLinesMode();
  });
}
if (linesEditBtn) {
  linesEditBtn.addEventListener("click", async () => {
    if (LINES_EDIT_MODE) return; // already in edit
    // Reload RM items to include any recently added stock items
    try {
      showMask("Loading items…");
      await loadRmItems();
      await ensureRmItemCodes();
      // If a known missing item (2613) is still absent, fetch and log it for diagnosis
      try {
        if (
          !RM_ITEMS.some((x) => x.id === 2613) &&
          typeof debugCheckStockItem === "function"
        ) {
          console.warn(
            "Stock item 2613 not present in RM_ITEMS — running debugCheckStockItem(2613)"
          );
          debugCheckStockItem(2613);
        }
      } catch (e) {
        console.warn("debug presence check failed", e);
      }
    } catch (err) {
      console.warn("Failed to reload RM items before edit", err);
    } finally {
      hideMask();
    }
    LINES_EDIT_MODE = true;
    linesEditBtn.classList.add("active");
    linesViewBtn?.classList.remove("active");
    applyLinesMode();
  });
}

/* ---------------- Keyboard shortcuts (Edit Mode) ---------------- */
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
  if (!LINES_EDIT_MODE) return; // only in edit mode
  // Ignore if modal/popover open
  if (
    nhModal?.style.display === "flex" ||
    dhModal?.style.display === "flex" ||
    dlModal?.style.display === "flex" ||
    ehModal?.style.display === "flex"
  )
    return;
  if (insertPopover?.style.display === "block") return; // let popover handle keys
  const activeTag = document.activeElement?.tagName;
  const isTyping = activeTag === "INPUT" || activeTag === "TEXTAREA";
  const idx = FOCUSED_ROW_INDEX != null ? FOCUSED_ROW_INDEX : 0;
  // Alt+ArrowUp / Alt+ArrowDown to move rows
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
  // Shift+Insert: open insert popover for Insert Above
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
    if (btn) {
      openInsertPopover(btn, idx, "above");
    }
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
  // Insert key to add a row below focused row (ignore when typing inside a text field)
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
  // Delete key opens delete confirmation (unless typing in a field)
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
