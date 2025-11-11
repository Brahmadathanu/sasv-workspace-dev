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
// Floating toast container (replaces inline status panel)
const toastContainer = el("statusToastContainer");
let activeToast = null;
let activeToastTimer = null;
// Header pill displays
const pillRefOutput = el("pillRefOutput");
const pillLossPct = el("pillLossPct");

// const checkAll = el("checkAll"); // removed (legacy bulk select no longer used with SN column)
const reloadBtn = el("reloadBtn");
const saveBtn = el("saveBtn");
const cloneBtn = el("cloneBtn");
const deleteBtn = el("deleteBtn");
const editHeaderBtn = el("editHeaderBtn");
const moreMenuBtn = el("moreMenuBtn");
const moreMenu = el("moreMenu");
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
  } else {
    if (linesEditBtn) linesEditBtn.style.display = "";
    if (linesViewBtn) linesViewBtn.style.display = "";
    if (kbHelpBtn) kbHelpBtn.style.display = "";
    document.body.classList.remove("no-edit");
  }
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
  // Preferred: dedicated RPC returning RM items
  try {
    const { data, error } = await supabase.rpc("rpc_get_rm_items");
    if (!error && Array.isArray(data) && data.length) {
      RM_ITEMS = (data || []).map((r) => ({
        id: r.id,
        name: r.name,
        code: r.code || null,
      }));
      return;
    }
  } catch (e) {
    console.warn("rpc_get_rm_items failed; falling back", e);
  }
  // Fallback: filter by category code 'RM'
  const { data: rows, error: err2 } = await supabase
    .from("inv_stock_item")
    .select(
      "id,name,code,inv_stock_item_class_map(category_id, inv_class_category(code))"
    )
    .order("name", { ascending: true });
  if (err2) throw err2;
  RM_ITEMS = (rows || [])
    .filter((r) => {
      const maps = r.inv_stock_item_class_map;
      if (!Array.isArray(maps)) return false;
      return maps.some((m) => m.inv_class_category?.code === "RM");
    })
    .map((r) => ({ id: r.id, name: r.name, code: r.code || null }));
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
        <td class="nowrap">${i + 1}</td>
        <td class="nowrap code-cell">${escapeHtml(itemCode)}</td>
        <td class="item-cell"><select class="cell item">${injected}</select></td>
        <td class="right"><input class="cell qty" type="number" step="0.0001" min="0" value="${
          ln.qty_per_reference_output ?? ""
        }" /></td>
        <td><select class="cell uom">${[`<option value="">— select —</option>`]
          .concat(
            UOMS.map(
              (u) =>
                `<option value="${u.id}" ${
                  u.id === ln.uom_id ? "selected" : ""
                }>${u.code}</option>`
            )
          )
          .join("")}</select></td>
        <td class="right"><input class="cell wast" type="number" step="0.0001" min="0" max="0.9999" value="${
          ln.wastage_pct ?? ""
        }" /></td>
        <td><input type="checkbox" class="cell opt" ${
          ln.is_optional ? "checked" : ""
        } /></td>
        <td><input type="text" class="cell rem" value="${escapeHtml(
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
    // Load permissions for this module
    try {
      const { data: permRows, error: permErr } = await supabase
        .from("user_permissions")
        .select("module_id, can_view, can_edit")
        .eq("user_id", session.user.id)
        .eq("module_id", MODULE_ID)
        .limit(1);
      if (!permErr && Array.isArray(permRows) && permRows.length) {
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
  };
  moreMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = !moreMenu.classList.contains("open");
    if (willOpen) {
      moreMenu.classList.add("open");
      moreMenuBtn.setAttribute("aria-expanded", "true");
      // Clamp horizontal position within viewport
      requestAnimationFrame(() => {
        const rect = moreMenu.getBoundingClientRect();
        const overflowRight = rect.right - window.innerWidth;
        if (overflowRight > 0) {
          // shift left by overflowRight + small padding
          moreMenu.style.left = `${
            (moreMenu.offsetLeft || 0) - overflowRight - 8
          }px`;
        }
        // If still off-screen left, align to left edge
        const newRect = moreMenu.getBoundingClientRect();
        if (newRect.left < 0) {
          moreMenu.style.left = `${
            (moreMenu.offsetLeft || 0) - newRect.left + 8
          }px`;
        }
      });
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
  linesEditBtn.addEventListener("click", () => {
    if (LINES_EDIT_MODE) return; // already in edit
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
