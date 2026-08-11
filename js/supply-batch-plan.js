import { supabase } from "../public/shared/js/supabaseClient.js";
import { Platform } from "../public/shared/js/platform.js";
import { hasPermission } from "../public/shared/js/appAuth.js";
import { showToast as sasvShowToast } from "../public/shared/js/toast.js";
import { mountModuleHome } from "../public/shared/js/sasv-module-chrome.js";
import {
  ADMIN_CORRECTION_ROLE,
  OPERATION_TYPES,
} from "../public/shared/js/bmr-admin-correction.js";
import { openBmrAdminCorrectionModal } from "../public/shared/js/bmr-admin-correction-modal.js";
import {
  SUPPLY_BATCH_PLAN_PERMISSION_TARGET,
  SUPPLY_BATCH_SIZE_INACTIVATE_COPY,
  SUPPLY_BATCH_SIZE_RPC_NAMES,
  buildCreateSupplyBatchSizeReferenceArgs,
  buildGetSupplyBatchSizeReferencesArgs,
  buildInactivateSupplyBatchSizeReferenceArgs,
  buildReviseSupplyBatchSizeReferenceArgs,
  isMeaningfulSupplyBatchSizeChangeReason,
  normalizeSupplyBatchSizeIntegerId,
  normalizeSupplyBatchSizeReferenceRow,
  parseSupplyBatchPlanDeepLink,
  resolveQuickEditSupplyBatchSizeBranch,
  supplyBatchSizeTodayIsoDate,
  unwrapSupplyBatchSizeReferencesPayload,
  validateSupplyBatchSizeRange,
} from "../public/shared/js/supply-batch-size-references.js";

const q = (id) => document.getElementById(id);

/** Thin adapter → canonical toast.js; keep call sites as toast(msg). */
const toast = (m, type = "info") => {
  try {
    sasvShowToast(m, type, 3000);
    return;
  } catch {
    /* fall through */
  }
  const t = q("toast");
  if (!t) return showAlert(m);
  t.hidden = false;
  t.textContent = m == null ? "" : String(m);
  t.style.display = "block";
  setTimeout(() => {
    t.style.display = "none";
    t.hidden = true;
  }, 3000);
};

/** Canonical HOME chrome (presentation). Click handler remains on #homeBtn. */
try {
  const homeEl = q("homeBtn");
  if (homeEl) mountModuleHome(homeEl);
  else {
    document.addEventListener(
      "DOMContentLoaded",
      () => mountModuleHome(q("homeBtn")),
      { once: true },
    );
  }
} catch {
  /* ignore chrome mount failures */
}

/** Exceptional admin-correction permission (UX gate only). */
let _canAdminCorrect = false;

/** Preferred batch-size register — fail closed until permission resolves. */
let _canViewBatchSizes = false;
let _canEditBatchSizes = false;

// Processing overlay helpers
function showProcessingOverlay(message) {
  let ov = document.getElementById("processingOverlay");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "processingOverlay";
    ov.className = "processing-overlay";
    ov.innerHTML = `
      <div class="processing-box">
        <div class="processing-spinner" aria-hidden="true"></div>
        <div class="processing-text" id="processingOverlayText">${
          message || "Processing..."
        }</div>
      </div>
    `;
    document.body.appendChild(ov);
  } else {
    const txt = document.getElementById("processingOverlayText");
    if (txt) txt.textContent = message || "Processing...";
    ov.style.display = "flex";
  }
  // prevent page interactions via overlay
  document.body.style.pointerEvents = "none";
  ov.style.pointerEvents = "auto";
}

function updateProcessingOverlay(message) {
  const txt = document.getElementById("processingOverlayText");
  if (txt) txt.textContent = message || "Processing...";
}

function hideProcessingOverlay() {
  const ov = document.getElementById("processingOverlay");
  if (ov) ov.style.display = "none";
  document.body.style.pointerEvents = "auto";
}

// (use existing `showConfirm` modal defined elsewhere in this file)

// track some local state
let _batchesCache = []; // last loadBatches() result
let _headerStatus = "draft"; // track current header status
let _productsCache = new Map(); // product_id -> product info cache
let _bnPickerCleanup = null; // cleanup handlers for inline BN picker

// Allow BMRs created a few days before/after the plan month to appear as candidates.
// Example: June plan can still use BMRs created on May 29.
const BMR_CANDIDATE_WINDOW_MARGIN_DAYS = 7;

// Product lookup utilities
async function loadProductsCache() {
  if (_productsCache.size > 0) return; // Already loaded

  try {
    let allProducts = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    // Load all products with pagination
    while (hasMore) {
      const { data, error } = await supabase
        .from("products")
        .select("id,item,malayalam_name,status,uom_base")
        .order("item")
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error("Failed to load products cache:", error);
        return;
      }

      if (data && data.length > 0) {
        allProducts = allProducts.concat(data);
        hasMore = data.length === pageSize; // Continue if we got a full page
        page++;
      } else {
        hasMore = false;
      }
    }

    // Populate cache
    allProducts.forEach((product) => {
      _productsCache.set(product.id, product);
    });

    console.log(
      `Loaded ${_productsCache.size} products into cache (${page} pages)`,
    );
  } catch (e) {
    console.error("Products cache exception:", e);
  }
} // Robust product name resolution with fallback
async function getProductName(productId) {
  // First try cache
  const product = _productsCache.get(productId);
  if (product && product.item) {
    return product.item;
  }

  // If cache miss, query database directly
  try {
    const { data, error } = await supabase
      .from("products")
      .select("id,item")
      .eq("id", productId)
      .single();

    if (error) {
      console.warn(`Product ID ${productId} not found in database:`, error);
      return `Product ID ${productId}`;
    }

    if (data && data.item) {
      // Cache the result for future use
      _productsCache.set(productId, data);
      return data.item;
    }

    return `Product ID ${productId}`;
  } catch (e) {
    console.error(`Error fetching product ${productId}:`, e);
    return `Product ID ${productId}`;
  }
}

// Enhanced product display with fallback (still sync for backward compatibility)
function getProductDisplay(productId) {
  const product = _productsCache.get(Number(productId));
  if (product && product.item) {
    return `${product.item} (#${productId})`;
  }
  return `Product #${productId}`; // Fallback if not found
}

// Return malayalam name if available (sync from cache)
function getProductMalayalam(productId) {
  const product = _productsCache.get(Number(productId));
  if (product && product.malayalam_name) return product.malayalam_name;
  return "";
}

function getProductUom(productId) {
  const product = _productsCache.get(Number(productId));
  if (product && product.uom_base) return product.uom_base;
  return "";
}

// Format timestamp to IST 24-hour format
function formatTimestampIST(isoString) {
  if (!isoString) return "—";

  const date = new Date(isoString);

  // Convert to IST using proper timezone handling
  const options = {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };

  const istTime = date.toLocaleString("en-GB", options);
  // Format will be "12/10/2025, 17:29" - we want "12/10/2025 17:29"
  return istTime.replace(",", "");
}

// Format month from YYYY-MM-DD to MMM YYYY (e.g., "2025-10-01" to "Oct 2025")
function formatMonthDisplay(dateString) {
  if (!dateString) return "—";

  const date = new Date(dateString);
  const options = {
    month: "short",
    year: "numeric",
  };

  return date.toLocaleDateString("en-US", options);
}

// Format numbers without rounding: show full precision present in the value.
// - null/undefined => empty string
// - numeric => minimal string representation (no forced decimals)
function formatExact(val) {
  if (val === null || val === undefined) return "";
  const n = Number(val);
  if (Number.isFinite(n)) return String(n);
  return String(val);
}

// lightweight DOM prompt (returns string or null)
function showPrompt(message, defaultValue = "") {
  return new Promise((resolve) => {
    // build modal
    const wrap = document.createElement("div");
    wrap.style = `position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);z-index:10000`;
    const box = document.createElement("div");
    box.style = `background:#fff;padding:16px;border-radius:6px;min-width:320px;max-width:90%`;
    const msg = document.createElement("div");
    msg.textContent = message;
    msg.style = "margin-bottom:8px;";
    const input = document.createElement("input");
    input.type = "text";
    input.value = defaultValue;
    input.style =
      "width:100%;box-sizing:border-box;margin-bottom:8px;padding:6px";
    const btnRow = document.createElement("div");
    btnRow.style = "display:flex;gap:8px;justify-content:flex-end";
    const ok = document.createElement("button");
    ok.textContent = "OK";
    const cancel = document.createElement("button");
    cancel.textContent = "Cancel";
    btnRow.appendChild(cancel);
    btnRow.appendChild(ok);
    box.appendChild(msg);
    box.appendChild(input);
    box.appendChild(btnRow);
    wrap.appendChild(box);
    document.body.appendChild(wrap);

    input.focus();
    input.select(); // Select the default text for easy replacement

    const cleanup = (val) => {
      resolve(val);
      wrap.remove();
    };

    ok.addEventListener("click", () => cleanup(input.value || null));
    cancel.addEventListener("click", () => cleanup(null));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") cleanup(input.value || null);
      if (e.key === "Escape") cleanup(null);
    });
  });
}

// ========= CUSTOM MODAL SYSTEM =========

// Custom Alert Modal (replaces window.alert)
function showAlert(message, title = "Alert") {
  return new Promise((resolve) => {
    const modal = q("alertModal");
    const titleEl = q("alertTitle");
    const messageEl = q("alertMessage");
    const okBtn = q("alertOk");
    const closeBtn = q("alertClose");

    // Set content
    titleEl.textContent = title;
    messageEl.textContent = message;

    // Show modal
    modal.classList.add("show");

    // Event handlers
    const cleanup = () => {
      modal.classList.remove("show");
      resolve();
    };

    const handleOk = () => cleanup();
    const handleClose = () => cleanup();
    const handleEscape = (e) => {
      if (e.key === "Escape") cleanup();
    };

    okBtn.addEventListener("click", handleOk, { once: true });
    closeBtn.addEventListener("click", handleClose, { once: true });
    document.addEventListener("keydown", handleEscape, { once: true });

    // Clean up event listeners when modal is closed
    modal.addEventListener(
      "transitionend",
      () => {
        if (!modal.classList.contains("show")) {
          okBtn.removeEventListener("click", handleOk);
          closeBtn.removeEventListener("click", handleClose);
          document.removeEventListener("keydown", handleEscape);
        }
      },
      { once: true },
    );

    // Focus the OK button
    setTimeout(() => okBtn.focus(), 100);
  });
}

// Custom Confirm Modal (replaces window.confirm)
function showConfirm(message, title = "Confirm") {
  return new Promise((resolve) => {
    const modal = q("confirmModal");
    const titleEl = q("confirmTitle");
    const messageEl = q("confirmMessage");
    const okBtn = q("confirmOk");
    const cancelBtn = q("confirmCancel");
    const closeBtn = q("confirmClose");

    // Set content
    titleEl.textContent = title;
    messageEl.textContent = message;

    // Show modal
    modal.classList.add("show");

    // Event handlers
    const cleanup = (result) => {
      modal.classList.remove("show");
      resolve(result);
    };

    const handleOk = () => cleanup(true);
    const handleCancel = () => cleanup(false);
    const handleClose = () => cleanup(false);
    const handleEscape = (e) => {
      if (e.key === "Escape") cleanup(false);
    };

    okBtn.addEventListener("click", handleOk, { once: true });
    cancelBtn.addEventListener("click", handleCancel, { once: true });
    closeBtn.addEventListener("click", handleClose, { once: true });
    document.addEventListener("keydown", handleEscape, { once: true });

    // Clean up event listeners when modal is closed
    modal.addEventListener(
      "transitionend",
      () => {
        if (!modal.classList.contains("show")) {
          okBtn.removeEventListener("click", handleOk);
          cancelBtn.removeEventListener("click", handleCancel);
          closeBtn.removeEventListener("click", handleClose);
          document.removeEventListener("keydown", handleEscape);
        }
      },
      { once: true },
    );

    // Focus the OK button
    setTimeout(() => okBtn.focus(), 100);
  });
}

// -------- headers list (robust)
async function loadHeaders() {
  const sel = q("bpHeaderSel");
  const meta = q("planMeta"); // Updated to use the correct element ID
  sel.innerHTML = "";
  if (meta) meta.textContent = "Select a plan header to begin"; // Safe check and default message

  // primary query (expects plan_title to exist)
  let query = supabase
    .from("batch_plan_headers")
    .select("id,plan_title,status,window_from,window_to,created_at,created_by")
    .order("created_at", { ascending: false })
    .limit(50);

  let data, error;
  try {
    const res = await query;
    data = res.data;
    error = res.error;
  } catch (e) {
    console.error("loadHeaders exception:", e);
    toast("Load headers failed (exception)");
    return;
  }

  if (error) {
    // print everything we can
    console.error("loadHeaders error:", {
      message: error.message,
      code: error.code,
      hint: error.hint,
      details: error.details,
    });

    // If it's an invalid column (42703), try a minimal fallback
    if (error.code === "42703") {
      try {
        const fallback = await supabase
          .from("batch_plan_headers")
          .select("id,status,created_at") // minimal columns that surely exist
          .order("created_at", { ascending: false })
          .limit(50);

        if (fallback.error) {
          console.error("fallback select error:", fallback.error);
          toast(
            `Load headers failed: ${
              fallback.error.message || "400 Bad Request"
            }`,
          );
          if (meta) meta.textContent = "No headers yet.";
          return;
        }
        data = fallback.data;
      } catch (e2) {
        console.error("fallback exception:", e2);
        toast("Load headers failed (fallback)");
        if (meta) meta.textContent = "No headers yet.";
        return;
      }
    } else {
      toast(`Load headers failed: ${error.message || "400 Bad Request"}`);
      if (meta) meta.textContent = "No headers yet.";
      return;
    }
  }

  (data || []).forEach((r) => {
    const opt = document.createElement("option");
    // prefer plan_title if present, else show just the id/status
    const title = (r.plan_title ?? "").trim();
    opt.value = r.id;
    opt.textContent = title
      ? `#${r.id} · ${title} · ${r.status}`
      : `#${r.id} · ${r.status}`;
    sel.appendChild(opt);
  });

  if (data?.length) {
    sel.value = data[0].id;
    onHeaderChanged();
  } else {
    if (meta) meta.textContent = "No headers yet.";
  }
}

async function onHeaderChanged() {
  const id = Number(q("bpHeaderSel").value);
  if (!id) {
    updateHeaderBar();
    return;
  }
  const { data: hdr, error } = await supabase
    .from("batch_plan_headers")
    .select(
      "id,plan_title,status,created_at,updated_at,created_by,window_from,window_to",
    )
    .eq("id", id)
    .single();
  if (error) {
    console.error(error);
    return;
  }
  // track current header status
  _headerStatus = hdr.status;

  // Store header window globally for BMR candidate filtering
  window._headerFrom = hdr.window_from;
  window._headerTo = hdr.window_to;

  // Update the plan meta with detailed info
  const planMeta = q("planMeta");
  if (planMeta) {
    planMeta.textContent =
      `#${hdr.id} · ${hdr.status} · ` +
      `window ${hdr.window_from ?? "—"} → ${hdr.window_to ?? "—"} · ` +
      `created ${formatTimestampIST(hdr.created_at)}`;
  }

  // Update persistent header bar
  updateHeaderBar();

  await loadRollup();
  await loadLines();
  await loadBatches();
  await loadMapRollup();
  await loadUnmappedBatches();

  // Update tab status indicators (metrics already updated by loadRollup)
  updateTabStatuses();

  // Update overrides tab content based on status
  updateOverridesTabContent();
}

// ========= CORE RPCs (direct to SQL) =========
// Legacy build RPC (retained for backwards migration; currently unused)
// Removed invocation; can delete after confirming rebuild_batch_plan adoption.

// New: full recompute using improved batching logic (compute_batches via rebuild_batch_plan)
async function rpcRebuildBatchPlan(headerId) {
  return supabase.rpc("rebuild_batch_plan", { p_header_id: headerId });
}

async function rpcRecalcForProduct(headerId, productId) {
  return supabase.rpc("recalc_batch_plan_for_product", {
    p_header_id: headerId,
    p_product_id: productId,
  });
}

async function rpcNudgeResiduals(headerId, thresholdPct = 0.1) {
  return supabase.rpc("nudge_small_residuals", {
    p_header_id: headerId,
    p_threshold_pct: thresholdPct,
  });
}

// Change header status (submit/reopen/apply/archive)
async function setHeaderStatus(next) {
  const headerId = Number(q("bpHeaderSel").value);
  if (!headerId) return toast("Pick a header");

  // simple guardrails: applied → read-only
  if (_headerStatus === "applied" && next !== "archived")
    return toast("Header already applied; reopen not allowed (archive only).");

  const { error } = await supabase
    .from("batch_plan_headers")
    .update({ status: next })
    .eq("id", headerId);
  if (error) {
    console.error(error);
    toast("Status change failed");
    return;
  }
  q("bpStatusMsg").textContent = `status → ${next}`;
  await onHeaderChanged();
}

// create header
async function onCreateHeader() {
  const title = (q("newHeaderTitle").value || "").trim();
  if (!title) return toast("Give a title");

  // derive month window
  const m = q("newPlanMonth").value; // "YYYY-MM"
  let from, to;
  if (m) {
    const [yy, mm] = m.split("-").map(Number);
    // Use simple string formatting to avoid timezone issues
    const monthStr = mm.toString().padStart(2, "0");

    // First day of month
    from = `${yy}-${monthStr}-01`;

    // Last day of month - get the number of days in the month
    const daysInMonth = new Date(yy, mm, 0).getDate(); // This works correctly
    const dayStr = daysInMonth.toString().padStart(2, "0");
    to = `${yy}-${monthStr}-${dayStr}`;
  } else {
    // fallback: current month
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    from = first.toISOString().slice(0, 10);
    to = last.toISOString().slice(0, 10);
    q("newPlanMonth").value = `${first.getFullYear()}-${String(
      first.getMonth() + 1,
    ).padStart(2, "0")}`;
  }

  // Get current user for created_by field
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) {
    console.error("Failed to get current user:", authError);
    return toast("Authentication error");
  }

  const insertData = {
    plan_title: title,
    window_from: from,
    window_to: to,
    created_by: user?.id || null,
    plan_month: m ? `${m}-01` : null, // Convert "2025-10" to "2025-10-01" for date field
  };

  const { data, error } = await supabase
    .from("batch_plan_headers")
    .insert([insertData])
    .select("id")
    .single();

  if (error) {
    console.error(error);
    return toast("Create failed");
  }
  // Immediately attempt initial build so the user sees lines without extra clicks.
  let built = false;
  try {
    // Use new rebuild RPC (ignores provided window; header stores window_from/to)
    const { data: buildData, error: buildError } = await rpcRebuildBatchPlan(
      data.id,
    );
    if (buildError) {
      console.error("Initial build failed:", buildError);
      if (
        buildError.message &&
        /v_product_batches_plan/i.test(buildError.message)
      ) {
        toast(
          `Header #${data.id} created – missing view v_product_batches_plan.`,
        );
      } else {
        toast(`Created header #${data.id} (initial build failed)`);
      }
    } else {
      built = true;
      let linesInfo = "?",
        batchesInfo = "?";
      if (Array.isArray(buildData) && buildData.length) {
        const row = buildData[0];
        const li = row.lines_inserted ?? 0;
        const lu = row.lines_updated ?? 0;
        const br = row.batches_replaced ?? 0;
        linesInfo = `${li} ins, ${lu} upd`;
        batchesInfo = `${br}`;
      }
      toast(
        `Created & built header #${data.id} (lines: ${linesInfo}, batches: ${batchesInfo})`,
      );
    }
  } catch (e) {
    console.error("Initial build exception:", e);
    toast(`Created header #${data.id} (build exception)`);
  }
  q("newHeaderTitle").value = "";
  // Reload headers list so new header appears; then select and load its data.
  await loadHeaders();
  q("bpHeaderSel").value = data.id;
  // onHeaderChanged will load lines/batches; they will exist if build succeeded.
  await onHeaderChanged();
  // If build succeeded we already toasted; if not, offer quick rebuild hint.
  if (!built) {
    const hint = q("bpStatusMsg");
    if (hint) hint.textContent = "Initial build failed – use Rebuild All.";
  }
  // Built but still no lines? Surface probable root cause (source view empty)
  const linesBody = q("bpLinesBody");
  if (built && linesBody && linesBody.children.length === 0) {
    toast(
      "Built header – no lines: upstream consolidated view returned 0 rows.",
    );
    const hint = q("bpStatusMsg");
    if (hint)
      hint.textContent =
        "No source data; check v_product_bulk_consolidated_effective.";
  }
}

async function onRenameHeader() {
  const headerId = Number(q("bpHeaderSel").value);
  if (!headerId) return toast("Pick a header");
  const { data: hdr, error } = await supabase
    .from("batch_plan_headers")
    .select("plan_title,status")
    .eq("id", headerId)
    .single();
  if (error) {
    console.error(error);
    return toast("Header read failed");
  }

  // Use showPrompt with the current title as default value
  const newTitle = await showPrompt("New title:", hdr.plan_title || "");
  if (!newTitle || !newTitle.trim()) return;

  const { error: e2 } = await supabase
    .from("batch_plan_headers")
    .update({
      plan_title: newTitle.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", headerId);
  if (e2) {
    console.error(e2);
    return toast("Rename failed");
  }
  toast("Renamed ✔");
  await loadHeaders();
  q("bpHeaderSel").value = headerId;
  await onHeaderChanged();
}

async function onDeleteHeader() {
  const headerId = Number(q("bpHeaderSel").value);
  if (!headerId) return toast("Pick a header");

  const { data: hdr, error } = await supabase
    .from("batch_plan_headers")
    .select("status,plan_title")
    .eq("id", headerId)
    .single();
  if (error) {
    console.error(error);
    return toast("Header read failed");
  }

  if (hdr.status === "applied")
    return toast("Applied headers cannot be deleted. Archive instead.");

  const ok = await showConfirm(
    `Delete header #${headerId} "${hdr.plan_title}"? ` +
      `This will also delete its lines & batches.`,
    "Delete Plan",
  );
  if (!ok) return;

  const { error: e2 } = await supabase
    .from("batch_plan_headers")
    .delete()
    .eq("id", headerId);
  if (e2) {
    console.error(e2);
    return toast("Delete failed");
  }

  toast("Deleted ✔");
  await loadHeaders();
  // Update header bar to reflect the deletion
  updateHeaderBar();
}

async function onArchiveHeader() {
  const headerId = Number(q("bpHeaderSel").value);
  if (!headerId) return toast("Pick a header");

  // Read current status to show a meaningful confirm
  const { data: hdr, error } = await supabase
    .from("batch_plan_headers")
    .select("plan_title,status")
    .eq("id", headerId)
    .single();

  if (error) {
    console.error(error);
    return toast("Header read failed");
  }

  // Archiving is allowed from any state; it simply hides the header from "one-per-month" uniqueness
  const ok = await showConfirm(
    `Archive header #${headerId} "${hdr.plan_title}"? ` +
      `This keeps all lines/batches for audit, but the plan is read-only.`,
    "Archive Plan",
  );
  if (!ok) return;

  const { error: e2 } = await supabase
    .from("batch_plan_headers")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", headerId);

  if (e2) {
    console.error(e2);
    return toast("Archive failed");
  }

  toast("Archived ✔");
  // After archiving, reload header list; if you prefer to hide archived, filter in loadHeaders()
  await loadHeaders();
}

// -------- Persistent Header Bar Functions --------
function updateHeaderBar() {
  const headerSel = q("bpHeaderSel");
  const statusChip = q("statusChip");
  const planWindow = q("planWindow");

  if (!headerSel || !headerSel.value) {
    // No plan selected
    if (statusChip) {
      statusChip.textContent = "No Plan";
      statusChip.className = "status-chip status-none";
    }
    if (planWindow) planWindow.textContent = "";

    // Hide persistent header Archive button when no plan is selected
    const persistentArchiveBtn = q("btnArchiveHeader");
    if (persistentArchiveBtn) persistentArchiveBtn.style.display = "none";

    updateHeaderMetrics({
      products_total: 0,
      batches_mapped: 0,
      batches_unmapped: 0,
      products_no_batch_ref: 0,
      products_residual: 0,
    });
    updateActionVisibility("none");
    return;
  }

  const selectedOption = headerSel.options[headerSel.selectedIndex];
  if (!selectedOption) return;

  // Parse the actual format: "#ID · Title · Status"
  const optionText = selectedOption.textContent;
  const parts = optionText.split(" · ");

  let status = "draft";

  if (parts.length >= 3) {
    // Format: "#3 · Batch Production Plan October 2025 · draft"
    status = parts[2].trim().toLowerCase();
  } else if (parts.length >= 2) {
    // Format: "#3 · draft" (no title)
    status = parts[1].trim().toLowerCase();
  }

  // Update plan window with actual dates if available
  if (planWindow) {
    if (window._headerFrom && window._headerTo) {
      planWindow.textContent = `Plan Window: ${window._headerFrom} to ${window._headerTo}`;
    } else {
      planWindow.textContent = "";
    }
  }

  if (statusChip) {
    statusChip.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    statusChip.className = `status-chip status-${status}`;
  }

  _headerStatus = status;

  // Update persistent header Archive button visibility
  const persistentArchiveBtn = q("btnArchiveHeader");
  if (persistentArchiveBtn) {
    // Archive button should be visible for all statuses except "archived"
    persistentArchiveBtn.style.display =
      status !== "archived" ? "inline-block" : "none";
  }

  updateActionVisibility(status);
  // Note: updateHeaderMetrics() will be called by loadRollup() with actual data
}

function updateHeaderMetrics(metrics = null) {
  const productsTotal = q("productsTotal");
  const batchesMapped = q("batchesMapped");
  const batchesUnmapped = q("batchesUnmapped");
  const productsNoBatch = q("productsNoBatch");
  const productsResidual = q("productsResidual");

  if (metrics) {
    if (productsTotal)
      productsTotal.textContent = `Products (total): ${
        metrics.products_total || 0
      }`;
    if (batchesMapped)
      batchesMapped.textContent = `Batches (mapped): ${
        metrics.batches_mapped || 0
      }`;
    if (batchesUnmapped)
      batchesUnmapped.textContent = `Batches (unmapped): ${
        metrics.batches_unmapped || 0
      }`;
    if (productsNoBatch)
      productsNoBatch.textContent = `No batch ref: ${
        metrics.products_no_batch_ref || 0
      }`;
    if (productsResidual)
      productsResidual.textContent = `With residuals: ${
        metrics.products_residual || 0
      }`;

    // Store metrics for use in other functions
    window._currentPlanMetrics = metrics;
  } else {
    // Fallback when no metrics available
    if (productsTotal) productsTotal.textContent = `Products (total): 0`;
    if (batchesMapped) batchesMapped.textContent = `Batches (mapped): 0`;
    if (batchesUnmapped) batchesUnmapped.textContent = `Batches (unmapped): 0`;
    if (productsNoBatch) productsNoBatch.textContent = `No batch ref: 0`;
    if (productsResidual) productsResidual.textContent = `With residuals: 0`;
  }

  // Also update the readiness checklist in the Apply tab
  if (window.updateReadinessChecklist) {
    window.updateReadinessChecklist();
  }

  // Setup metric modal handlers after badges are updated
  setupMetricModals();
}

function updateActionVisibility(status) {
  const kebabActions = q("kebabActions");
  if (!kebabActions) return;

  // Show/hide actions based on status
  const renameAction = kebabActions.querySelector('[data-action="rename"]');
  const deleteAction = kebabActions.querySelector('[data-action="delete"]');
  const archiveAction = kebabActions.querySelector('[data-action="archive"]');

  if (renameAction)
    renameAction.style.display =
      status === "draft" || status === "submitted" ? "block" : "none";
  if (deleteAction)
    deleteAction.style.display = status === "draft" ? "block" : "none";
  if (archiveAction)
    archiveAction.style.display = status !== "archived" ? "block" : "none";
}

function updateTabStatuses() {
  const tabs = document.querySelectorAll('[role="tab"]');

  tabs.forEach((tab) => {
    const tabId = tab.getAttribute("aria-controls");
    let status = "incomplete";

    switch (tabId) {
      case "tab-build":
        // Build is complete if we have lines
        status =
          q("bpLinesBody")?.children.length > 0 ? "complete" : "incomplete";
        break;
      case "tab-lines":
        status =
          q("bpLinesBody")?.children.length > 0 ? "complete" : "incomplete";
        break;
      case "tab-batches":
        status = _batchesCache.length > 0 ? "complete" : "incomplete";
        break;
      case "tab-mapping": {
        const unmappedCount = _batchesCache.filter(
          (b) => b.bmr_id === null,
        ).length;
        status =
          unmappedCount === 0 && _batchesCache.length > 0
            ? "complete"
            : unmappedCount < _batchesCache.length && _batchesCache.length > 0
              ? "warning"
              : "incomplete";
        break;
      }
      case "tab-overrides":
        // Overrides are only available when plan is applied
        if (_headerStatus === "applied") {
          status = "complete";
          // Enable the tab
          tab.style.opacity = "1";
          tab.style.pointerEvents = "auto";
        } else {
          status = "incomplete";
          // Disable the tab
          tab.style.opacity = "0.5";
          tab.style.pointerEvents = "none";
        }
        break;
      case "tab-apply": {
        const allMapped =
          _batchesCache.length > 0 &&
          _batchesCache.filter((b) => b.bmr_id === null).length === 0;
        status = allMapped ? "complete" : "incomplete";
        break;
      }
    }

    // Remove existing status classes
    tab.classList.remove("tab-complete", "tab-warning", "tab-incomplete");
    // Add new status class
    tab.classList.add(`tab-${status}`);
  });
}

// full rebuild
async function onRebuildAll() {
  const headerId = Number(q("bpHeaderSel").value);
  if (!headerId) return toast("Pick a header");

  // Read window from header
  const { data: hdr, error: hErr } = await supabase
    .from("batch_plan_headers")
    .select("window_from,window_to")
    .eq("id", headerId)
    .single();
  if (hErr) {
    console.error(hErr);
    return toast("Header read failed");
  }
  if (!hdr?.window_from || !hdr?.window_to)
    return toast("Header has no window_from/to");

  const ok = await showConfirm(
    "Rebuild all lines & batches from consolidated plan?",
    "Rebuild All",
  );
  if (!ok) return;

  const { data: buildData, error } = await rpcRebuildBatchPlan(headerId);
  if (error) {
    console.error("Rebuild failed:", error);
    if (error.message && /v_product_batches_plan/i.test(error.message)) {
      toast("Missing view v_product_batches_plan – deploy SQL fix script.");
    } else {
      toast("Rebuild failed");
    }
    return;
  }
  // Debug: log the raw response structure
  console.log("rebuild_batch_plan response:", buildData);

  // buildData is array with one row containing lines_inserted, lines_updated, batches_replaced
  let linesInfo = "?",
    batchesInfo = "?";
  if (Array.isArray(buildData) && buildData.length) {
    const row = buildData[0];
    console.log("First row:", row);
    const li = row.lines_inserted ?? 0;
    const lu = row.lines_updated ?? 0;
    const br = row.batches_replaced ?? 0;
    linesInfo = `${li} ins, ${lu} upd`;
    batchesInfo = `${br}`;
  }
  toast(`Rebuilt ✔ (lines: ${linesInfo}, batches: ${batchesInfo})`);
  await loadRollup();
  await loadLines();
  await loadBatches();
  await loadMapRollup();
  await loadUnmappedBatches();
}

// nudge residuals
async function onNudgeResiduals() {
  const headerId = Number(q("bpHeaderSel").value);
  if (!headerId) return toast("Pick a header");
  const { data, error } = await rpcNudgeResiduals(headerId, 0.1);
  if (error) {
    console.error(error);
    return toast("Nudge failed");
  }
  toast(`Nudged ${data || 0} lines ✔`);
  await loadLines();
  await loadBatches();
}

// rebuild subset (previously called onRefreshSelected)
async function onRebuildSelected() {
  const headerId = Number(q("bpHeaderSel").value);
  const raw = (q("bpProductIds").value || "").trim();
  if (!headerId || !raw) return toast("Header & product IDs required");

  // optional guardrail: header must be editable
  const { data: hdr, error: hErr } = await supabase
    .from("batch_plan_headers")
    .select("status")
    .eq("id", headerId)
    .single();
  if (hErr) {
    console.error(hErr);
    return toast("Header read failed");
  }
  if (!["draft", "submitted"].includes(hdr.status))
    return toast(`Rebuild blocked; status is ${hdr.status}`);

  const productIds = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter(Boolean);
  if (!productIds.length) return toast("No valid product IDs");

  const btn = q("btnRefreshSelected");
  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Rebuilding…";

  for (const pid of productIds) {
    const { error } = await rpcRecalcForProduct(headerId, pid);
    if (error) {
      console.error(error);
      btn.disabled = false;
      btn.textContent = prev;
      return toast(`Recalc failed for ${pid}`);
    }
  }

  btn.disabled = false;
  btn.textContent = prev;
  toast(`Rebuilt ${productIds.length} products ✔`);
  await loadRollup();
  await loadLines();
  await loadBatches();
  await loadMapRollup();
  await loadUnmappedBatches();
}

// -------- views
async function loadRollup() {
  const headerId = Number(q("bpHeaderSel").value);
  if (!headerId) {
    q("bpStatTotals").textContent = "Select a plan to view statistics";
    return;
  }

  try {
    // 1. Products (total) - count of lines (products in plan)
    const { data: lines, error: linesError } = await supabase
      .from("batch_plan_lines")
      .select(
        "product_id, residual_qty, preferred_batch_size, min_batch_size, max_batch_size",
      )
      .eq("header_id", headerId);

    if (linesError) throw linesError;

    // 2. Batches (mapped) - count of batches with BMR assigned
    const { count: mappedCount, error: mappedError } = await supabase
      .from("batch_plan_batches")
      .select("id", { count: "exact" })
      .eq("header_id", headerId)
      .not("bmr_id", "is", null);

    if (mappedError) throw mappedError;

    // 3. Batches (unmapped) - count of batches without BMR
    const { count: unmappedCount, error: unmappedError } = await supabase
      .from("batch_plan_batches")
      .select("id", { count: "exact" })
      .eq("header_id", headerId)
      .is("bmr_id", null);

    if (unmappedError) throw unmappedError;

    // 4. Products (no batch ref) - products without batch size reference
    const productsNoBatchRef = lines.filter(
      (line) =>
        line.preferred_batch_size === null &&
        line.min_batch_size === null &&
        line.max_batch_size === null,
    ).length;

    // 5. Products (with residuals) - products with non-zero residual
    const productsWithResiduals = lines.filter(
      (line) => line.residual_qty !== null && line.residual_qty !== 0,
    ).length;

    const productsTotal = lines.length;
    const batchesMapped = mappedCount || 0;
    const batchesUnmapped = unmappedCount || 0;

    // Update plan statistics display
    q("bpStatTotals").textContent =
      `Products (total): ${productsTotal} · Batches (mapped): ${batchesMapped} · Batches (unmapped): ${batchesUnmapped} · Products (no batch ref): ${productsNoBatchRef} · Products (with residuals): ${productsWithResiduals}`;

    // Update header bar metrics
    updateHeaderMetrics({
      products_total: productsTotal,
      batches_mapped: batchesMapped,
      batches_unmapped: batchesUnmapped,
      products_no_batch_ref: productsNoBatchRef,
      products_residual: productsWithResiduals,
    });
  } catch (error) {
    console.error("Error loading rollup statistics:", error);
    q("bpStatTotals").textContent = "Error loading statistics";
    updateHeaderMetrics({
      products_total: 0,
      batches_mapped: 0,
      batches_unmapped: 0,
      products_no_batch_ref: 0,
      products_residual: 0,
    });
  }
}

async function loadLines() {
  const headerId = Number(q("bpHeaderSel").value);
  const tbody = q("bpLinesBody");
  tbody.innerHTML = "";

  // Ensure products cache is loaded
  await loadProductsCache();

  const { data, error } = await supabase
    .from("v_batch_plan_lines_with_impact")
    .select(
      "product_id,month_start,final_make_qty,batch_count,residual_qty,preferred_batch_size,overrides_delta,effective_total",
    )
    .eq("header_id", headerId)
    .order("product_id")
    .order("month_start");

  if (error) {
    console.error(error);
    return;
  }
  (data || []).forEach((r) => {
    const tr = document.createElement("tr");

    // Make preferred batch size clickable if it exists
    // pass month_start to quick edit so effective_from can default to that month
    const monthIso = r.month_start; // expected YYYY-MM-DD
    const preferredBatchSizeCell = r.preferred_batch_size
      ? `<td><button class="preferred-batch-size-btn" onclick="openBatchSizeQuickEdit(${r.product_id}, '${monthIso}')" title="Click to edit batch size for this product">${r.preferred_batch_size}</button></td>`
      : `<td><button class="preferred-batch-size-btn no-value" onclick="openBatchSizeQuickEdit(${r.product_id}, '${monthIso}')" title="Click to set batch size for this product">Set</button></td>`;

    tr.innerHTML = `
      <td>${getProductDisplay(r.product_id)}</td>
      <td>${getProductMalayalam(r.product_id) || ""}</td>
      <td>${formatMonthDisplay(r.month_start)}</td>
      <td>${formatExact(r.final_make_qty)}</td>
      <td>${r.batch_count}</td>
      ${preferredBatchSizeCell}
      <td>${formatExact(r.residual_qty)}</td>
      <td>${formatExact(r.overrides_delta ?? 0)}</td>
      <td>${formatExact(r.effective_total ?? r.final_make_qty)}</td>`;
    tbody.appendChild(tr);
  });
}

// Lines table search functionality
function initializeProductSearch() {
  const searchInput = q("productSearchInput");
  const clearBtn = q("clearSearchBtn");

  // New filter controls
  const filterPreferredMode = q("filterPreferredMode"); // any | set | not set
  const filterResidualMode = q("filterResidualMode");
  const filterOverridesMode = q("filterOverridesMode");
  const clearLinesFiltersBtn = q("clearLinesFiltersBtn");

  if (!searchInput || !clearBtn) return;

  // Search functionality
  searchInput.addEventListener("input", filterLinesTable);
  searchInput.addEventListener("keyup", (e) => {
    if (e.key === "Escape") {
      clearSearch();
    }
  });

  // Wire new filters to the same filter function so combinations apply
  if (filterPreferredMode)
    filterPreferredMode.addEventListener("change", filterLinesTable);
  if (filterResidualMode)
    filterResidualMode.addEventListener("change", filterLinesTable);
  if (filterOverridesMode)
    filterOverridesMode.addEventListener("change", filterLinesTable);

  if (clearLinesFiltersBtn) {
    clearLinesFiltersBtn.addEventListener("click", () => {
      if (filterPreferredMode) filterPreferredMode.value = "any";
      if (filterResidualMode) filterResidualMode.value = "any";
      if (filterOverridesMode) filterOverridesMode.value = "any";
      filterLinesTable();
    });
  }

  // Clear functionality
  clearBtn.addEventListener("click", clearSearch);
}

function filterLinesTable() {
  const searchTerm = q("productSearchInput").value.toLowerCase().trim();
  const tbody = q("bpLinesBody");

  if (!tbody) return;

  const rows = Array.from(tbody.querySelectorAll("tr"));

  // Read filter settings
  const preferredMode = q("filterPreferredMode")?.value || "any"; // any | set | not set
  const residualMode = q("filterResidualMode")?.value || "any"; // any | zero | present
  const overridesMode = q("filterOverridesMode")?.value || "any"; // any | zero | present

  rows.forEach((row) => {
    const productCell = row.querySelector("td:first-child");
    const malCell = row.querySelectorAll("td")[1];
    if (!productCell) return;
    const productText = (
      (productCell.textContent || "") +
      " " +
      (malCell?.textContent || "")
    ).toLowerCase();
    const matchesSearch = productText.includes(searchTerm);

    // Extract numeric values from the relevant columns. Column order now:
    // 0: Product, 1: Malayalam, 2: Month, 3: Final Make Qty, 4: Batch Count,
    // 5: Preferred Batch Size, 6: Residual Qty, 7: Overrides Delta, 8: Effective Total
    const cells = row.querySelectorAll("td");
    const preferredCell = cells[5];
    const residualCell = cells[6];
    const overridesCell = cells[7];

    // Determine whether preferred batch size is present (button text 'Set' indicates not set)
    let preferredPresent = false;
    if (preferredCell) {
      const btn = preferredCell.querySelector("button");
      if (btn) {
        const txt = btn.textContent.trim();
        preferredPresent = txt !== "Set" && txt !== "";
      } else {
        const txt = preferredCell.textContent.trim();
        preferredPresent = txt !== "" && txt !== "Set";
      }
    }

    // Parse residual and overrides as numbers (tolerate empty)
    const residualVal = residualCell
      ? Number((residualCell.textContent || "").replace(/,/g, ""))
      : NaN;
    const overridesVal = overridesCell
      ? Number((overridesCell.textContent || "").replace(/,/g, ""))
      : NaN;

    // Apply filters
    let show = true;

    // search term
    if (searchTerm && !matchesSearch) show = false;

    // preferred batch mode filter
    if (preferredMode === "set") {
      if (!preferredPresent) show = false;
    } else if (preferredMode === "notset") {
      if (preferredPresent) show = false;
    }

    // residual mode
    if (residualMode === "zero") {
      if (!Number.isFinite(residualVal) || residualVal !== 0) show = false;
    } else if (residualMode === "present") {
      if (!Number.isFinite(residualVal) || residualVal === 0) show = false;
    }

    // overrides mode
    if (overridesMode === "zero") {
      if (!Number.isFinite(overridesVal) || overridesVal !== 0) show = false;
    } else if (overridesMode === "present") {
      if (!Number.isFinite(overridesVal) || overridesVal === 0) show = false;
    }

    row.style.display = show ? "" : "none";
  });

  // Update search results info
  updateSearchInfo();
}

function clearSearch() {
  const searchInput = q("productSearchInput");
  if (searchInput) {
    searchInput.value = "";
    filterLinesTable(); // This will show all rows
  }
}

function updateSearchInfo() {
  const tbody = q("bpLinesBody");
  if (!tbody) return;

  // Update the clear button visibility based on search input
  const clearBtn = q("clearSearchBtn");
  const searchInput = q("productSearchInput");

  if (clearBtn && searchInput) {
    clearBtn.style.display = searchInput.value.trim() ? "inline-block" : "none";
  }
}

async function loadBatches() {
  const headerId = Number(q("bpHeaderSel").value);
  const tbody = q("bpBatchesBody");
  tbody.innerHTML = "";
  _batchesCache = [];

  // Ensure products cache is loaded
  await loadProductsCache();

  // Pull view with status (UNMAPPED/MAPPED/WIP). If you prefer raw table, join client-side.
  const { data, error } = await supabase
    .from("v_batch_plan_batches_status")
    .select(
      "batch_id,product_id,product_name,month_start,batch_no_seq,batch_size,source_rule,map_status,mapped_bn,mapped_size,bmr_id",
    )
    .eq("header_id", headerId)
    .order("product_id")
    .order("month_start")
    .order("batch_no_seq");

  if (error) {
    console.error(error);
    return;
  }
  _batchesCache = data || [];
  renderBatches();
}

// (renderBatches moved further down; keep single renderer)

// --- Mapping helpers
async function loadMapRollup() {
  const headerId = Number(q("bpHeaderSel").value);
  if (!headerId) return;
  const { data, error } = await supabase
    .from("v_batch_plan_mapping_rollup")
    .select("*")
    .eq("header_id", headerId)
    .single();
  if (error) {
    console.error(error);
    const mapRollupEl = q("mapRollup");
    if (mapRollupEl) mapRollupEl.textContent = "";
    return;
  }
  const mapRollupEl = q("mapRollup");
  if (mapRollupEl) {
    mapRollupEl.textContent =
      `batches=${data.batches_total} · mapped=${data.batches_mapped} ` +
      `· unmapped=${data.batches_unmapped} · ${data.mapped_pct}`;
  }
}

async function loadUnmappedBatches() {
  const sel = q("mapBatchSel");
  if (!sel) return; // Element doesn't exist, exit early
  sel.innerHTML = "";
  const headerId = Number(q("bpHeaderSel").value);

  // Ensure products cache is loaded
  await loadProductsCache();

  const { data, error } = await supabase
    .from("v_batch_plan_mapping")
    .select(
      "batch_id,product_id,month_start,batch_no_seq,batch_size,source_rule",
    )
    .eq("header_id", headerId)
    .is("bmr_id", null)
    .order("product_id")
    .order("month_start")
    .order("batch_no_seq");
  if (error) {
    console.error(error);
    return;
  }
  (data || []).forEach((r) => {
    const productName = getProductDisplay(r.product_id);
    const opt = document.createElement("option");
    opt.value = r.batch_id;
    opt.textContent =
      `#${r.batch_id} · ${productName} ${r.month_start} · #${r.batch_no_seq} ` +
      `(${formatExact(r.batch_size)} via ${r.source_rule})`;
    opt.dataset.productId = r.product_id;
    opt.dataset.batchSize = r.batch_size;
    sel.appendChild(opt);
  });
  await loadBmrCandidates(); // load for the first batch preselected
}

async function loadBmrCandidates() {
  const mapBatchSel = q("mapBatchSel");
  if (!mapBatchSel) return; // Element doesn't exist, exit early
  const batchOpt = mapBatchSel.selectedOptions[0];
  const sel = q("mapBmrSel");
  if (!sel) return; // Element doesn't exist, exit early
  sel.innerHTML = "";
  if (!batchOpt) return;

  const productId = Number(batchOpt.dataset.productId);
  const size = Number(batchOpt.dataset.batchSize);
  const eps = 1e-6;

  // Pull only not-initiated BMR cards for product created in header month
  let query = supabase
    .from("bmr_card_not_initiated")
    .select("bmr_id,bn,batch_size,uom,created_at,product_id")
    .eq("product_id", productId);

  // Apply month window filter if available
  // Apply month window filter if available — include a one-day margin
  if (window._headerFrom) {
    try {
      const fromDt = new Date(window._headerFrom + "T00:00:00");
      fromDt.setDate(fromDt.getDate() - BMR_CANDIDATE_WINDOW_MARGIN_DAYS);
      const fromStr = fromDt.toISOString().slice(0, 19).replace("T", " ");
      query = query.gte("created_at", fromStr);
    } catch {
      query = query.gte("created_at", window._headerFrom + " 00:00:00");
    }
  }

  if (window._headerTo) {
    try {
      const toDt = new Date(window._headerTo + "T23:59:59");
      toDt.setDate(toDt.getDate() + BMR_CANDIDATE_WINDOW_MARGIN_DAYS);
      const toStr = toDt.toISOString().slice(0, 19).replace("T", " ");
      query = query.lte("created_at", toStr);
    } catch {
      query = query.lte("created_at", window._headerTo + " 23:59:59");
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    return;
  }

  (data || [])
    .filter((r) => Math.abs(Number(r.batch_size) - size) <= eps)
    .forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.bn; // NOTE: pass BN, not ID, to the RPC
      opt.textContent = `${r.bn} · ${formatExact(r.batch_size)} ${r.uom}`;
      sel.appendChild(opt);
    });

  const mapHintEl = q("mapHint");
  if (mapHintEl) {
    mapHintEl.textContent = sel.options.length
      ? "Pick a BN and click Link."
      : "No exact-size candidates this month; create BN in Add BMR, then come back.";
  }
}

// onLinkBmr removed (mapping panel moved inline). Use onPickBmrForBatch/onMapByBN for inline mapping flows.

// Opens the shared Administrative Correction workflow preselected to UNLINK_BMR.
// Authenticated clients must not call the retired plan-batch unlink RPC.
async function onUnlinkBmr(evt) {
  const batchId =
    Number(evt?.currentTarget?.dataset?.batch) ||
    Number(q("mapBatchSel")?.value);
  if (!batchId) return toast("Pick a batch");

  if (!_canAdminCorrect) {
    return toast(
      "Administrative correction permission is required to unlink a mapped BMR.",
    );
  }

  const isWip = evt?.currentTarget?.dataset?.wip === "true";
  if (isWip) return toast("Cannot unlink WIP");

  try {
    await openBmrAdminCorrectionModal({
      batchPlanBatchId: batchId,
      initialOperation: OPERATION_TYPES.UNLINK_BMR,
      monthFrom: window._headerFrom || null,
      monthTo: window._headerTo || null,
      onSuccess: async () => {
        toast("Administrative correction completed ✔");
        await loadBatches();
        await loadMapRollup();
        await loadUnmappedBatches();
      },
    });
  } catch (err) {
    console.error(err);
    toast(`Administrative correction failed: ${err.message || "unknown error"}`);
  }
}

async function onPickBmrForBatch(evt) {
  const batchId = Number(evt.currentTarget.dataset.batch);
  // Pre-flight: ensure this batch is still unmapped before prompting/RPC
  const ok = await assertUnmappedBatchOrToast(batchId);
  if (!ok) return;
  // read batch context (product_id)
  const { data: b, error: e1 } = await supabase
    .from("batch_plan_batches")
    .select("product_id,batch_size")
    .eq("id", batchId)
    .single();
  if (e1) {
    console.error(e1);
    return toast("Read batch failed");
  }

  // pull candidates for the product from not-initiated view with month filter
  let query = supabase
    .from("bmr_card_not_initiated")
    .select("bmr_id,bn,batch_size,uom,created_at")
    .eq("product_id", b.product_id)
    .order("bn");

  // Apply month window filter if available
  if (window._headerFrom) {
    try {
      const fromDate = new Date(window._headerFrom + "T00:00:00");
      fromDate.setDate(fromDate.getDate() - BMR_CANDIDATE_WINDOW_MARGIN_DAYS);
      const fromStr = fromDate.toISOString().slice(0, 10) + " 00:00:00";
      query = query.gte("created_at", fromStr);
    } catch {
      query = query.gte("created_at", window._headerFrom + " 00:00:00");
    }
  }

  if (window._headerTo) {
    try {
      const toDate = new Date(window._headerTo + "T00:00:00");
      toDate.setDate(toDate.getDate() + BMR_CANDIDATE_WINDOW_MARGIN_DAYS);
      const toStr = toDate.toISOString().slice(0, 10) + " 23:59:59";
      query = query.lte("created_at", toStr);
    } catch {
      query = query.lte("created_at", window._headerTo + " 23:59:59");
    }
  }

  const { data: rows, error: e2 } = await query;
  if (e2) {
    console.error(e2);
    return toast("Load candidates failed");
  }

  // Filter by size and build choices
  const eps = 1e-6;
  const choices = (rows || [])
    .filter((r) => Math.abs(Number(r.batch_size) - Number(b.batch_size)) <= eps)
    .map((r) => `${r.bn} :: ${r.bn} × ${r.batch_size} ${r.uom}`);

  if (!choices.length)
    return toast("No eligible BMR cards for this product this month.");

  // Show interactive BN picker modal instead of text prompt
  const chosenBn = await showBnPickerModal(choices, b.product_id, batchId);
  if (!chosenBn) return;

  // map using the new RPC that takes BN
  const { error: e3 } = await supabase.rpc("map_batch_to_bmr_by_bn", {
    p_batch_id: batchId,
    p_bn: chosenBn,
  });
  if (e3) {
    console.error(e3);
    const msg = normalizeMapError(e3);
    toast(msg);
    // Refresh to reflect any mapping that may have occurred elsewhere
    await loadBatches();
    return;
  }
  toast("Mapped ✔");
  await loadBatches();
}

function normalizeMapError(err) {
  const raw = (err && (err.message || err.error_description)) || "";
  const code = err && (err.code || err.hint || "");
  if (code === "PGRST203") {
    return "Mapping service misconfigured: duplicate RPC overloads (integer vs bigint). Please consolidate to one function signature.";
  }
  if (/unrecognized exception condition/i.test(raw)) {
    // Backend raised an unknown condition name (e.g., CHECK_VIOLATION spelled/quoted wrong)
    return "Mapping failed due to a validation error. Please ensure the BN is valid, not already mapped, and meets constraints.";
  }
  if (code === "23514" || /check constraint/i.test(raw)) {
    return raw || "Mapping violates a database check constraint.";
  }
  // Avoid dumping very large SQL or HTML into toast
  if (raw && raw.length > 280)
    return "Mapping failed (see console for details).";
  return raw || "Map failed";
}

async function onMapByBN(evt) {
  const batchId = Number(evt.currentTarget.dataset.batch);
  // Pre-flight: ensure this batch is still unmapped before prompting/RPC
  const ok = await assertUnmappedBatchOrToast(batchId);
  if (!ok) return;
  const bn = await showPrompt("Enter BN to map this planned batch:");
  if (!bn) return;
  const { error } = await supabase.rpc("map_batch_to_bmr_by_bn", {
    p_batch_id: batchId,
    p_bn: bn.trim(),
  });
  if (error) {
    console.error(error);
    const msg = normalizeMapError(error);
    toast(msg);
    await loadBatches();
    return;
  }
  toast("Mapped by BN ✔");
  await loadBatches();
}

// Guard: verify batch is still unmapped before attempting to map
async function assertUnmappedBatchOrToast(batchId) {
  try {
    const { data, error } = await supabase
      .from("batch_plan_batches")
      .select("bmr_id")
      .eq("id", batchId)
      .single();
    if (error) {
      console.error("Failed to check batch mapping state", error);
      // If check fails, allow flow to continue to server-side validation
      return true;
    }
    if (data && data.bmr_id) {
      toast(`Batch #${batchId} is already mapped to a BMR.`);
      await loadBatches();
      return false;
    }
    return true;
  } catch (e) {
    console.error("assertUnmappedBatchOrToast exception", e);
    return true;
  }
}

// Inline BN picker for table cells - ERP style dropdown
window.showInlineBnPicker = async function (button) {
  const batchId = Number(button.dataset.batch);
  const productId = Number(button.dataset.product);
  const batchSize = Number(button.dataset.size);
  // Toggle: if already open for this button, close it
  if (button.getAttribute("aria-expanded") === "true") {
    closeAllInlineBnPickers();
    return;
  }

  const ok = await assertUnmappedBatchOrToast(batchId);
  if (!ok) return;

  closeAllInlineBnPickers();

  const candidates = await getBnCandidates(productId, batchSize);
  if (!candidates.length) {
    return toast("No eligible BMR cards for this product this month.");
  }

  const dropdown = document.createElement("div");
  dropdown.className = "bn-picker-dropdown";
  // force fixed positioning so top/left are viewport coordinates
  dropdown.style.position = "fixed";
  // Narrower min width so dropdown stays compact (bn only).
  // Cap the dropdown width so it doesn't expand to the whole table column.
  const suggestedWidth = Math.max(120, button.offsetWidth + 8);
  const capped = Math.min(suggestedWidth, 300); // never wider than 300px
  dropdown.style.minWidth = capped + "px";
  dropdown.style.maxWidth = "320px";
  dropdown.style.boxSizing = "border-box";

  // Tooltip element (singleton) for option descriptions (keyboard accessible)
  let tooltip = document.getElementById("bn-picker-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "bn-picker-tooltip";
    tooltip.className = "bn-tooltip";
    document.body.appendChild(tooltip);
  }

  candidates.forEach((candidate) => {
    const option = document.createElement("button");
    option.className = "bn-picker-option";

    const [bn, description] = candidate.split(" :: ");
    // Show BN on the left and a small badge with size on the right
    option.dataset.description = description || "";
    const leftSpan = document.createElement("span");
    leftSpan.className = "bn-picker-text";
    leftSpan.textContent = bn.trim();
    option.appendChild(leftSpan);

    // No inline badge: rely on tooltip for size/details to keep UI compact

    // Tooltip handlers (delayed show for hover/focus, keyboard accessible)
    let _bnTooltipTimer = null;
    const showTooltip = () => {
      const desc = option.dataset.description;
      if (!desc) return;
      tooltip.textContent = desc;
      tooltip.classList.add("show");
      // Position tooltip near the option
      const oRect = option.getBoundingClientRect();
      const tRect = tooltip.getBoundingClientRect();
      let left = Math.min(window.innerWidth - tRect.width - 8, oRect.right + 8);
      left = Math.max(8, left);
      let top = oRect.top + (oRect.height - tRect.height) / 2;
      top = Math.max(8, Math.min(window.innerHeight - tRect.height - 8, top));
      tooltip.style.left = left + "px";
      tooltip.style.top = top + "px";
    };
    const hideTooltip = () => {
      clearTimeout(_bnTooltipTimer);
      tooltip.classList.remove("show");
    };
    const scheduleShow = () => {
      clearTimeout(_bnTooltipTimer);
      _bnTooltipTimer = setTimeout(showTooltip, 250);
    };
    option.addEventListener("mouseenter", scheduleShow);
    option.addEventListener("focus", scheduleShow);
    option.addEventListener("mouseleave", hideTooltip);
    option.addEventListener("blur", hideTooltip);

    option.addEventListener("click", async (e) => {
      e.stopPropagation();
      closeAllInlineBnPickers();

      // show overlay to block edits while mapping
      showProcessingOverlay(`Mapping batch ${batchId} → ${bn.trim()}...`);
      try {
        const { error } = await supabase.rpc("map_batch_to_bmr_by_bn", {
          p_batch_id: batchId,
          p_bn: bn.trim(),
        });

        if (error) {
          console.error(error);
          const msg = normalizeMapError(error);
          hideProcessingOverlay();
          toast(msg);
          await loadBatches();
          return;
        }

        // success
        await loadBatches();
        hideProcessingOverlay();
        toast("Mapped");
      } catch (ex) {
        console.error(ex);
        hideProcessingOverlay();
        toast("Mapping failed (see console)");
        await loadBatches();
      }
    });

    dropdown.appendChild(option);
  });

  dropdown.style.visibility = "hidden";
  document.body.appendChild(dropdown);

  const spacing = 6;
  const positionDropdown = () => {
    if (!dropdown.isConnected) return;
    const rect = button.getBoundingClientRect();
    const dropdownRect = dropdown.getBoundingClientRect();

    let top = rect.bottom + spacing;
    let openAbove = false;
    const spaceBelow = window.innerHeight - rect.bottom;
    if (
      spaceBelow < dropdownRect.height + spacing &&
      rect.top > dropdownRect.height + spacing
    ) {
      top = Math.max(8, rect.top - dropdownRect.height - spacing);
      openAbove = true;
    } else {
      top = Math.min(
        window.innerHeight - dropdownRect.height - 8,
        rect.bottom + spacing,
      );
    }

    let left = rect.left;
    const maxLeft = window.innerWidth - dropdownRect.width - 8;
    left = Math.min(Math.max(8, left), Math.max(8, maxLeft));

    dropdown.style.top = `${top}px`;
    dropdown.style.left = `${left}px`;
    dropdown.classList.toggle("bn-picker-dropdown--above", openAbove);
  };

  // Position and show immediately on next frame for snappy UX
  positionDropdown();
  dropdown.style.visibility = "visible";
  dropdown.classList.add("show");
  // Focus the first option so keyboard users can navigate immediately
  const firstOption = dropdown.querySelector(".bn-picker-option");
  if (firstOption) firstOption.focus();

  // Keyboard navigation inside the dropdown: ArrowUp/ArrowDown, Enter to select,
  // Escape handled globally. Also implement quick type-ahead (buffered).
  let typeBuffer = "";
  let typeTimer = null;
  const optionList = () =>
    Array.from(dropdown.querySelectorAll(".bn-picker-option"));
  const handleDropdownKeydown = (e) => {
    const opts = optionList();
    if (!opts.length) return;

    const active = document.activeElement;
    const idx = opts.indexOf(active);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = idx < opts.length - 1 ? opts[idx + 1] : opts[0];
      next.focus();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = idx > 0 ? opts[idx - 1] : opts[opts.length - 1];
      prev.focus();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (
        document.activeElement &&
        document.activeElement.classList.contains("bn-picker-option")
      ) {
        document.activeElement.click();
      }
      return;
    }

    // Type-ahead: accumulate printable characters to jump to matching BN
    if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      typeBuffer += e.key.toLowerCase();
      clearTimeout(typeTimer);
      typeTimer = setTimeout(() => (typeBuffer = ""), 800);
      const match = opts.find((o) =>
        o.textContent.trim().toLowerCase().startsWith(typeBuffer),
      );
      if (match) {
        match.focus();
      }
    }
  };
  dropdown.addEventListener("keydown", handleDropdownKeydown);
  button.style.borderColor = "var(--sasv-action-primary)";
  button.style.background = "#eff6ff";
  button.setAttribute("aria-expanded", "true");

  const handleOutsideClick = (e) => {
    if (e.target === button || button.contains(e.target)) return;
    if (dropdown.contains(e.target)) return;
    closeAllInlineBnPickers();
  };

  // Only close on scroll if the scroll event did NOT originate from the dropdown itself.
  // This prevents dragging the dropdown's scrollbar from closing it.
  const handleScroll = (e) => {
    try {
      if (e && dropdown && dropdown.contains(e.target)) return;
    } catch {
      // defensive
    }
    closeAllInlineBnPickers();
  };
  const handleResize = () => closeAllInlineBnPickers();
  const handleKeydown = (e) => {
    if (e.key === "Escape" || e.key === "Esc") {
      e.preventDefault();
      closeAllInlineBnPickers();
    }
  };

  // Attach listeners immediately
  document.addEventListener("click", handleOutsideClick, true);
  document.addEventListener("scroll", handleScroll, true);
  window.addEventListener("resize", handleResize);
  document.addEventListener("keydown", handleKeydown, true);

  _bnPickerCleanup = () => {
    document.removeEventListener("click", handleOutsideClick, true);
    document.removeEventListener("scroll", handleScroll, true);
    window.removeEventListener("resize", handleResize);
    document.removeEventListener("keydown", handleKeydown, true);
    // remove dropdown-specific keyboard handler
    try {
      dropdown.removeEventListener("keydown", handleDropdownKeydown);
    } catch {
      /* ignore */
    }
    // Hide tooltip if visible
    const _tt = document.getElementById("bn-picker-tooltip");
    if (_tt) _tt.classList.remove("show");
  };
};
// Helper function to close all inline BN pickers
function closeAllInlineBnPickers() {
  document.querySelectorAll(".bn-picker-dropdown").forEach((dropdown) => {
    dropdown.remove();
  });

  document.querySelectorAll(".bn-picker-btn").forEach((btn) => {
    btn.style.borderColor = "#d1d5db";
    btn.style.background = "#f9fafb";
    btn.setAttribute("aria-expanded", "false");
  });

  if (_bnPickerCleanup) {
    _bnPickerCleanup();
    _bnPickerCleanup = null;
  }
}

// Keyboard helper: when a `.bn-picker-btn` has focus, pressing ArrowDown opens the picker
document.addEventListener(
  "keydown",
  (e) => {
    try {
      const el = document.activeElement;
      if (!el || !el.classList) return;
      if (!el.classList.contains("bn-picker-btn")) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (typeof window.showInlineBnPicker === "function") {
          if (el.getAttribute("aria-expanded") !== "true")
            window.showInlineBnPicker(el);
        } else {
          el.click();
        }
      }
    } catch {
      // defensive: do nothing
    }
  },
  true,
);

// Helper function to get BN candidates for a product
async function getBnCandidates(productId, batchSize) {
  let query = supabase
    .from("bmr_card_not_initiated")
    .select("bmr_id,bn,batch_size,uom,created_at")
    .eq("product_id", productId)
    .order("bn");

  // Apply month window filter if available
  // Include a one-day margin around the header window to avoid off-by-one
  // exclusions for BNs created on boundary dates.
  if (window._headerFrom) {
    try {
      const fromDate = new Date(window._headerFrom + "T00:00:00");
      fromDate.setDate(fromDate.getDate() - BMR_CANDIDATE_WINDOW_MARGIN_DAYS);
      const fromStr = fromDate.toISOString().slice(0, 10) + " 00:00:00";
      query = query.gte("created_at", fromStr);
    } catch {
      query = query.gte("created_at", window._headerFrom + " 00:00:00");
    }
  }

  if (window._headerTo) {
    try {
      const toDate = new Date(window._headerTo + "T00:00:00");
      toDate.setDate(toDate.getDate() + BMR_CANDIDATE_WINDOW_MARGIN_DAYS);
      const toStr = toDate.toISOString().slice(0, 10) + " 23:59:59";
      query = query.lte("created_at", toStr);
    } catch {
      query = query.lte("created_at", window._headerTo + " 23:59:59");
    }
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error(error);
    return [];
  }

  // Filter by size and build choices
  const eps = 1e-6;
  return (rows || [])
    .filter((r) => Math.abs(Number(r.batch_size) - Number(batchSize)) <= eps)
    .map((r) => `${r.bn} :: ${r.bn} × ${r.batch_size} ${r.uom}`);
}

// Interactive BN picker modal for better UX
function showBnPickerModal(choices, productId, batchId) {
  return new Promise((resolve) => {
    // Create modal backdrop
    const backdrop = document.createElement("div");
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    `;

    // Create modal content
    const modal = document.createElement("div");
    modal.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    `;

    // Modal header
    const header = document.createElement("h3");
    header.textContent = `Select BN for Batch #${batchId}`;
    header.style.cssText =
      "margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #1f2937;";
    modal.appendChild(header);

    // Instructions
    const instructions = document.createElement("p");
    instructions.textContent =
      "Click on a BN below to map it to this planned batch:";
    instructions.style.cssText =
      "margin: 0 0 16px 0; color: #6b7280; font-size: 14px;";
    modal.appendChild(instructions);

    // BN options container
    const optionsContainer = document.createElement("div");
    optionsContainer.style.cssText =
      "margin-bottom: 20px; max-height: 300px; overflow-y: auto;";

    // Create clickable BN options
    choices.forEach((choice) => {
      const [bn, description] = choice.split(" :: ");

      const option = document.createElement("button");
      option.style.cssText = `
        width: 100%;
        text-align: left;
        padding: 12px 16px;
        margin: 4px 0;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        background: #f9fafb;
        cursor: pointer;
        transition: all 0.15s ease;
        font-family: inherit;
        font-size: 14px;
      `;

      const bnSpan = document.createElement("div");
      bnSpan.textContent = bn.trim();
      bnSpan.style.cssText =
        "font-weight: 600; color: #1f2937; margin-bottom: 4px;";

      const descSpan = document.createElement("div");
      descSpan.textContent = description;
      descSpan.style.cssText = "font-size: 13px; color: #6b7280;";

      option.appendChild(bnSpan);
      option.appendChild(descSpan);

      // Hover effects
      option.addEventListener("mouseenter", () => {
        option.style.borderColor = "var(--sasv-action-primary)";
        option.style.background = "#eff6ff";
        option.style.transform = "translateY(-1px)";
        option.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1)";
      });

      option.addEventListener("mouseleave", () => {
        option.style.borderColor = "#e5e7eb";
        option.style.background = "#f9fafb";
        option.style.transform = "none";
        option.style.boxShadow = "none";
      });

      // Click handler
      option.addEventListener("click", () => {
        document.body.removeChild(backdrop);
        resolve(bn.trim());
      });

      optionsContainer.appendChild(option);
    });

    modal.appendChild(optionsContainer);

    // Cancel button
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = `
      padding: 8px 16px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: white;
      color: #374151;
      cursor: pointer;
      font-family: inherit;
      margin-top: 8px;
    `;

    cancelBtn.addEventListener("click", () => {
      document.body.removeChild(backdrop);
      resolve(null);
    });

    modal.appendChild(cancelBtn);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    // Close on backdrop click
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        document.body.removeChild(backdrop);
        resolve(null);
      }
    });

    // Focus first option for keyboard navigation
    if (optionsContainer.firstChild) {
      optionsContainer.firstChild.focus();
    }
  });
}

// ========= METRIC MODAL FUNCTIONALITY =========
function setupMetricModals() {
  // Add click handlers to metric badges
  const metricBadges = document.querySelectorAll(".metric-badge.clickable");
  metricBadges.forEach((badge) => {
    badge.addEventListener("click", () => {
      const metricType = badge.dataset.metric;
      showMetricModal(metricType);
    });
  });

  // Modal close handlers
  const modal = q("metricModal");
  const closeBtn = q("modalClose");

  closeBtn?.addEventListener("click", hideMetricModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) hideMetricModal();
  });

  // Copy button handler
  q("copyListBtn")?.addEventListener("click", copyMetricList);
}

async function showMetricModal(metricType) {
  const modal = q("metricModal");
  const title = q("modalTitle");
  const description = q("modalDescription");
  const count = q("modalCount");
  const list = q("modalList");

  if (!modal) return;

  // Show loading state
  modal.classList.add("show");
  list.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const data = await fetchMetricDetails(metricType);

    // Update modal content
    title.textContent = data.title;
    description.textContent = data.description;
    count.textContent = `${data.items.length} items`;
    list.innerHTML = data.items.map((item) => `<div>${item}</div>`).join("");

    // Store current data for copying
    window._currentMetricData = data.items;
  } catch (error) {
    console.error("Error loading metric details:", error);
    list.innerHTML =
      '<div class="error">Error loading data. Please try again.</div>';
  }
}

function hideMetricModal() {
  const modal = q("metricModal");
  if (modal) modal.classList.remove("show");
}

async function copyMetricList() {
  if (!window._currentMetricData) return;

  try {
    const text = window._currentMetricData.join("\n");
    await navigator.clipboard.writeText(text);

    // Visual feedback - preserve SVG by only changing the text node
    const btn = q("copyListBtn");
    const originalHTML = btn.innerHTML;

    // Store original for restoration
    const originalBg = btn.style.background;
    const originalBorder = btn.style.borderColor;

    // Update with success state
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20,6 9,17 4,12"/>
      </svg>
      Copied!
    `;
    btn.style.background = "#dcfce7";
    btn.style.borderColor = "#86efac";
    btn.style.color = "#166534";

    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.style.background = originalBg;
      btn.style.borderColor = originalBorder;
      btn.style.color = "";
    }, 2000);
  } catch (error) {
    console.error("Failed to copy:", error);
    showAlert("Failed to copy to clipboard");
  }
}

async function fetchMetricDetails(metricType) {
  const headerId = Number(q("bpHeaderSel").value);
  if (!headerId) throw new Error("No plan selected");

  switch (metricType) {
    case "products_total":
      return fetchProductsTotal(headerId);
    case "batches_mapped":
      return fetchBatchesMapped(headerId);
    case "batches_unmapped":
      return fetchBatchesUnmapped(headerId);
    case "products_no_batch_ref":
      return fetchProductsNoBatchRef(headerId);
    case "products_residual":
      return fetchProductsResidual(headerId);
    default:
      throw new Error("Unknown metric type");
  }
}

async function fetchProductsTotal(headerId) {
  const { data, error } = await supabase
    .from("batch_plan_lines")
    .select("product_id")
    .eq("header_id", headerId)
    .order("product_id");

  if (error) throw error;

  // Ensure product cache is loaded
  if (_productsCache.size === 0) {
    await loadProductsCache();
  }

  return {
    title: "Products (Total)",
    description: "All products included in this batch plan",
    items: await Promise.all(
      data.map(async (item) => {
        const productName = await getProductName(item.product_id);
        return `${productName} (ID: ${item.product_id})`;
      }),
    ),
  };
}

async function fetchBatchesMapped(headerId) {
  const { data, error } = await supabase
    .from("batch_plan_batches")
    .select("id, bmr_id, batch_size, product_id")
    .eq("header_id", headerId)
    .not("bmr_id", "is", null)
    .order("id");

  if (error) throw error;

  // Ensure product cache is loaded
  if (_productsCache.size === 0) {
    await loadProductsCache();
  }

  return {
    title: "Batches (Mapped)",
    description: "Batches that have been assigned to BMR recipes",
    items: await Promise.all(
      data.map(async (item) => {
        const productName = await getProductName(item.product_id);
        return `Batch ${item.id}: ${productName} (ID: ${item.product_id})`;
      }),
    ),
  };
}

async function fetchBatchesUnmapped(headerId) {
  const { data, error } = await supabase
    .from("batch_plan_batches")
    .select("id, batch_size, product_id")
    .eq("header_id", headerId)
    .is("bmr_id", null)
    .order("id");

  if (error) throw error;

  // Ensure product cache is loaded
  if (_productsCache.size === 0) {
    await loadProductsCache();
  }

  return {
    title: "Batches (Unmapped)",
    description: "Batches that still need BMR recipe assignment",
    items: await Promise.all(
      data.map(async (item) => {
        const productName = await getProductName(item.product_id);
        return `Batch ${item.id}: ${productName} (ID: ${item.product_id})`;
      }),
    ),
  };
}

async function fetchProductsNoBatchRef(headerId) {
  const { data, error } = await supabase
    .from("batch_plan_lines")
    .select("product_id, preferred_batch_size, min_batch_size, max_batch_size")
    .eq("header_id", headerId)
    .order("product_id");

  if (error) throw error;

  const filtered = data.filter(
    (item) =>
      item.preferred_batch_size === null &&
      item.min_batch_size === null &&
      item.max_batch_size === null,
  );

  // Ensure product cache is loaded
  if (_productsCache.size === 0) {
    await loadProductsCache();
  }

  return {
    title: "Products (No Batch Reference)",
    description:
      "Products missing batch size configuration (preferred, min, and max all null)",
    items: await Promise.all(
      filtered.map(async (item) => {
        const productName = await getProductName(item.product_id);
        return `${productName} (ID: ${item.product_id})`;
      }),
    ),
  };
}

async function fetchProductsResidual(headerId) {
  const { data, error } = await supabase
    .from("batch_plan_lines")
    .select("product_id, residual_qty")
    .eq("header_id", headerId)
    .order("product_id");

  if (error) throw error;

  const filtered = data.filter(
    (item) => item.residual_qty !== null && item.residual_qty !== 0,
  );

  // Ensure product cache is loaded
  if (_productsCache.size === 0) {
    await loadProductsCache();
  }

  return {
    title: "Products (With Residuals)",
    description:
      "Products that have leftover quantities after batch assignment",
    items: await Promise.all(
      filtered.map(async (item) => {
        const productName = await getProductName(item.product_id);
        return `${productName} (ID: ${item.product_id}): ${item.residual_qty} units residual`;
      }),
    ),
  };
}

// -------- wire
document.addEventListener("DOMContentLoaded", () => {
  // Platform-aware HOME button
  q("homeBtn")?.addEventListener("click", () => Platform.goHome());

  // Exceptional admin-correction permission (UX only; server is final)
  hasPermission(ADMIN_CORRECTION_ROLE, "edit")
    .then(async (allowed) => {
      _canAdminCorrect = !!allowed;
      // Re-render batches so kebab actions reflect permission once known.
      if (typeof loadBatches === "function" && q("bpHeaderSel")?.value) {
        try {
          await loadBatches();
        } catch (e) {
          console.warn("[supply-batch-plan] reload after permission check failed", e);
        }
      }
    })
    .catch((err) => {
      console.warn(
        "[supply-batch-plan] admin-correction permission check failed",
        err,
      );
      _canAdminCorrect = false;
    });

  // Preferred batch-size register — module:supply-batch-plan (fail closed)
  Promise.all([
    hasPermission(SUPPLY_BATCH_PLAN_PERMISSION_TARGET, "view"),
    hasPermission(SUPPLY_BATCH_PLAN_PERMISSION_TARGET, "edit"),
  ])
    .then(async ([viewAllowed, editAllowed]) => {
      _canViewBatchSizes = !!viewAllowed;
      _canEditBatchSizes = !!editAllowed && !!viewAllowed;
      applyBatchSizePermissionUi();
      try {
        await applySupplyBatchPlanDeepLink();
      } catch (e) {
        console.warn("[supply-batch-plan] deep-link apply failed", e);
      }
      if (
        document.getElementById("tab-batch-sizes")?.classList.contains("active")
      ) {
        await loadBatchSizeReferences();
      }
    })
    .catch((err) => {
      console.warn(
        "[supply-batch-plan] batch-size permission check failed",
        err,
      );
      _canViewBatchSizes = false;
      _canEditBatchSizes = false;
      applyBatchSizePermissionUi();
    });

  // Initialize products cache
  loadProductsCache();

  // Initialize product search functionality
  initializeProductSearch();

  // Initialize batch size management
  initializeBatchSizeManagement();

  // Initialize quick edit batch size functionality
  initializeQuickEditBatchSize();

  // Header management
  q("btnReloadHeaders").addEventListener("click", loadHeaders);

  // Remove any existing listener before adding new one to prevent duplicates
  const headerSel = q("bpHeaderSel");
  headerSel.removeEventListener("change", onHeaderChanged);
  headerSel.addEventListener("change", onHeaderChanged);

  q("btnRenameHeader")?.addEventListener("click", onRenameHeader);
  q("btnDeleteHeader")?.addEventListener("click", onDeleteHeader);
  q("btnArchiveHeader")?.addEventListener("click", onArchiveHeader);

  // Kebab menu actions
  const kebabBtn = q("kebabBtn");
  const kebabMenu = q("kebabMenu");
  const kebabContent = kebabMenu?.querySelector(".kebab-menu-content");

  if (kebabBtn && kebabMenu && kebabContent) {
    kebabBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      kebabMenu.classList.toggle("open");
    });

    // Close kebab menu when clicking outside
    document.addEventListener("click", () => {
      kebabMenu.classList.remove("open");
    });

    // Individual kebab action handlers
    q("btnNewPlanKebab")?.addEventListener("click", (e) => {
      e.stopPropagation();
      kebabMenu.classList.remove("open");
      // Scroll to Build tab and focus on the form
      document.querySelector('[aria-controls="tab-build"]')?.click();
      setTimeout(() => {
        q("newPlanMonth")?.focus();
      }, 100);
    });
  }

  // Download menu initialization - Restored with full functionality
  const downloadMainBtn = q("btnDownloadPlan");
  const downloadSubmenu = q("downloadSubmenu");

  if (downloadMainBtn && downloadSubmenu) {
    // Function to position submenu within viewport bounds
    function positionSubmenu() {
      const rect = downloadMainBtn.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Reset positioning
      downloadSubmenu.style.right = "";
      downloadSubmenu.style.left = "";
      downloadSubmenu.style.top = "";
      downloadSubmenu.style.bottom = "";

      // Check if submenu would go out of right edge
      if (rect.right + 320 > viewportWidth) {
        // Position from right edge of button
        downloadSubmenu.style.right = "0";
      } else {
        // Position from left edge of button
        downloadSubmenu.style.left = "0";
      }

      // Check if submenu would go out of bottom edge
      if (rect.bottom + 300 > viewportHeight) {
        // Position above the button
        downloadSubmenu.style.bottom = "100%";
        downloadSubmenu.style.top = "";
        downloadSubmenu.style.marginTop = "";
        downloadSubmenu.style.marginBottom = "4px";
      } else {
        // Position below the button (default)
        downloadSubmenu.style.top = "100%";
        downloadSubmenu.style.bottom = "";
        downloadSubmenu.style.marginTop = "4px";
        downloadSubmenu.style.marginBottom = "";
      }
    }

    // Close download submenu when clicking outside
    document.addEventListener("click", (e) => {
      const downloadContainer = downloadMainBtn.parentElement;
      if (!downloadContainer.contains(e.target)) {
        downloadSubmenu.style.display = "none";
      }
    });

    // Handle download menu click to show/hide submenu
    downloadMainBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = downloadSubmenu.style.display === "block";
      if (isVisible) {
        downloadSubmenu.style.display = "none";
      } else {
        positionSubmenu();
        downloadSubmenu.style.display = "block";
      }
    });

    // Close submenu when any download option is clicked
    downloadSubmenu.addEventListener("click", () => {
      setTimeout(() => {
        downloadSubmenu.style.display = "none";
      }, 100);
    });

    // Reposition on window resize
    window.addEventListener("resize", () => {
      if (downloadSubmenu.style.display === "block") {
        positionSubmenu();
      }
    });
  }

  // Batch filters wiring
  q("bpBatchFilter")?.addEventListener("change", renderBatches);
  q("bpBatchProductFilter")?.addEventListener("input", renderBatches);
  q("bpResetBatchFilters")?.addEventListener("click", () => {
    if (q("bpBatchProductFilter")) q("bpBatchProductFilter").value = "";
    if (q("bpBatchFilter")) q("bpBatchFilter").value = "";
    renderBatches();
  });
  // when header changes, also refresh mapping area
  const hdr = q("bpHeaderSel");
  if (hdr)
    hdr.addEventListener("change", async () => {
      await loadMapRollup();
      await loadUnmappedBatches();
    });
  q("btnCreateHeader").addEventListener("click", onCreateHeader);
  q("btnRebuildAll").addEventListener("click", onRebuildAll);
  q("btnRebuildUnmapped").addEventListener("click", async () => {
    const headerId = Number(q("bpHeaderSel").value);
    if (!headerId) return toast("Pick a header");
    const ok = await showConfirm(
      "Rebuild only unmapped products?",
      "Rebuild Unmapped",
    );
    if (!ok) return;
    const { error } = await supabase.rpc("rebuild_batch_plan_unmapped", {
      p_header_id: headerId,
    });
    if (error) {
      console.error(error);
      return toast("Rebuild (unmapped) failed");
    }
    toast("Rebuilt unmapped ✔");
    await loadRollup();
    await loadLines();
    await loadBatches();
    await loadMapRollup();
    await loadUnmappedBatches();
  });
  q("btnNudgeResiduals")?.addEventListener("click", onNudgeResiduals);
  q("btnRefreshSelected").addEventListener("click", onRebuildSelected);
  q("btnSubmitHeaderKebab")?.addEventListener("click", () =>
    setHeaderStatus("submitted"),
  );
  q("btnReopenHeaderKebab")?.addEventListener("click", () =>
    setHeaderStatus("draft"),
  );
  q("btnApplyHeaderKebab")?.addEventListener("click", () =>
    setHeaderStatus("applied"),
  );

  // Health checks refresh button
  q("btnRefreshHealthChecks")?.addEventListener("click", () => {
    updateHealthChecks();
    toast("Health checks refreshed");
  });

  // Note: Archive button removed from Review tab since it's redundant with persistent header Archive button

  // Initialize the application
  loadHeaders();
  updateHeaderBar();

  // Auto-generate template names for new plan titles
  const planMonthInput = q("newPlanMonth");
  const newHeaderTitleInput = q("newHeaderTitle");

  if (planMonthInput && newHeaderTitleInput) {
    // Function to generate template name
    const generateTemplateName = (monthValue) => {
      if (!monthValue) return "";

      const date = new Date(monthValue + "-01"); // Add day to make valid date
      const monthName = date.toLocaleDateString("en-US", { month: "long" });
      const year = date.getFullYear();

      return `Batch Production Plan ${monthName} ${year}`;
    };

    // Set initial template if month is already selected
    if (planMonthInput.value) {
      newHeaderTitleInput.placeholder = generateTemplateName(
        planMonthInput.value,
      );
    }

    // Update template when month changes
    planMonthInput.addEventListener("change", () => {
      const templateName = generateTemplateName(planMonthInput.value);
      newHeaderTitleInput.placeholder = templateName;

      // If the input is empty or contains a previous template, update it
      if (
        !newHeaderTitleInput.value ||
        newHeaderTitleInput.value.startsWith("Batch Production Plan")
      ) {
        newHeaderTitleInput.value = templateName;
      }
    });

    // On focus, if empty, populate with template
    newHeaderTitleInput.addEventListener("focus", () => {
      if (!newHeaderTitleInput.value && planMonthInput.value) {
        newHeaderTitleInput.value = generateTemplateName(planMonthInput.value);
        newHeaderTitleInput.select(); // Select all for easy editing
      }
    });
  }
});

// ===== Batch Overrides (CSV → staging → apply) =====
function renderBatches() {
  const tbody = q("bpBatchesBody");
  tbody.innerHTML = "";

  const f = (q("bpBatchFilter").value || "").trim();
  const productFilter = (q("bpBatchProductFilter").value || "")
    .trim()
    .toLowerCase();

  let rows = _batchesCache.slice();
  if (f) rows = rows.filter((r) => r.map_status === f);

  // Apply explicit product filter (name or id)
  if (productFilter) {
    rows = rows.filter((r) => {
      const productName = (
        r.product_name ||
        getProductDisplay(r.product_id) ||
        ""
      ).toLowerCase();
      const productMalayalam = (
        r.malayalam_name ||
        getProductMalayalam(r.product_id) ||
        ""
      ).toLowerCase();
      return (
        String(r.product_id).toLowerCase().includes(productFilter) ||
        productName.includes(productFilter) ||
        productMalayalam.includes(productFilter)
      );
    });
  }

  // No BN filter configured (removed)

  // No general quick search: filters are product/BN/status only

  rows.forEach((r) => {
    const editable = _headerStatus !== "applied" && r.map_status === "UNMAPPED";

    // Get product display name - prefer product_name from view, fallback to cache
    const productDisplay = r.product_name || getProductDisplay(r.product_id);

    // build kebab menu with conditional actions
    const isWip = r.map_status === "WIP";
    let menuItems = [];

    if (r.map_status === "UNMAPPED") {
      menuItems = [
        `<button class="kebab-item" data-batch="${r.batch_id}" onclick="onPickBmrForBatch(event)">Pick BN</button>`,
        `<button class="kebab-item" data-batch="${r.batch_id}" onclick="onMapByBN(event)">Map by BN</button>`,
        `<button class="kebab-item" onclick="window.open('public/shared/manage-bmr.html?item=${encodeURIComponent(
          productDisplay,
        )}&size=${encodeURIComponent(
          String(formatExact(r.batch_size ?? 0)),
        )}', '_blank')">Create BN</button>`,
      ];
    } else {
      // mapped or WIP — administrative unlink only via governed correction workflow
      const menu = [
        `<button class="kebab-item" onclick="window.location.href='public/shared/manage-bmr.html?item=${encodeURIComponent(
          productDisplay,
        )}&bn=${encodeURIComponent(r.mapped_bn || "")}'">View BMR</button>`,
      ];
      if (_canAdminCorrect) {
        const unlinkTitle = isWip
          ? "Cannot unlink WIP"
          : "Administrative Correction — remove mapping (governed)";
        menu.push(
          `<button class="kebab-item" data-batch="${
            r.batch_id
          }" data-wip="${isWip ? "true" : "false"}" onclick="onUnlinkBmr(event)" ${
            isWip ? "disabled" : ""
          } title="${unlinkTitle}">Administrative Correction…</button>`,
        );
      }
      menuItems = menu;
    }

    const actionHtml = `
      <div class="kebab-menu">
        <button class="kebab-btn" onclick="toggleKebabMenu(this)">⋮</button>
        <div class="kebab-content">
          ${menuItems.join("")}
        </div>
      </div>
    `;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${productDisplay} <span class="muted">(#${r.product_id})</span></td>
      <td>${getProductMalayalam(r.product_id) || ""}</td>
      <td>${formatMonthDisplay(r.month_start)}</td>
      <td>${r.batch_no_seq}</td>
      <td>${
        editable
          ? `<input type="number" step="0.001" min="0" value="${Number(
              r.batch_size,
            )}"
             data-pid="${r.product_id}" data-ms="${r.month_start}"
             data-seq="${
               r.batch_no_seq
             }" class="bpEditSize" style="width:100px" />`
          : formatExact(r.batch_size)
      }</td>
      <td>${getProductUom(r.product_id) || ""}</td>
      <td>${r.source_rule || ""}</td>
      <td>${r.map_status === "UNMAPPED" ? "Unmapped" : "Mapped"}</td>
      <td>${
        r.map_status === "UNMAPPED" && _headerStatus !== "applied"
          ? `<div class="bn-picker-container">
             <button class="bn-picker-btn" 
                     data-batch="${r.batch_id}" 
                     data-product="${r.product_id}"
                     data-size="${r.batch_size}"
                     onclick="showInlineBnPicker(this)">
               <span class="bn-picker-text">Pick BN</span>
               <svg class="bn-picker-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                 <polyline points="6,9 12,15 18,9"></polyline>
               </svg>
             </button>
           </div>`
          : r.mapped_bn || ""
      }</td>
      <td>${actionHtml}</td>`;
    tbody.appendChild(tr);
  });

  // Wire inline editors
  tbody.querySelectorAll(".bpEditSize").forEach((inp) => {
    inp.addEventListener("change", onEditBatchSize);
  });

  // BN pickers are wired via onclick in HTML
}

// Map rows that have exactly one eligible BN (manual, on-demand)
window.mapSingleBnRows = async function () {
  const headerId = Number(q("bpHeaderSel").value);
  if (!headerId) return toast("Pick a header");
  if (_headerStatus === "applied")
    return toast("Header is applied (read-only)");

  // Find currently visible UNMAPPED rows from the rendered table
  const tbody = q("bpBatchesBody");
  if (!tbody) return toast("No batches table");

  const candidatesToMap = [];

  // iterate rows to respect current filters/visibility
  const rows = Array.from(tbody.querySelectorAll("tr"));
  for (const tr of rows) {
    if (tr.style.display === "none") continue; // filtered out
    const pickBtn = tr.querySelector(".bn-picker-btn");
    if (!pickBtn) continue; // not an unmapped/editable row

    const batchId = Number(pickBtn.dataset.batch);
    const productId = Number(pickBtn.dataset.product);
    const batchSize = Number(pickBtn.dataset.size);

    // get candidates for this product/size
    try {
      const cands = await getBnCandidates(productId, batchSize);
      if (cands && cands.length === 1) {
        const [bn] = cands[0].split(" :: ");
        candidatesToMap.push({ batchId, bn: bn.trim(), productId });
      }
    } catch (e) {
      console.error("Candidate lookup failed", e);
    }
  }

  if (!candidatesToMap.length) return toast("No single-candidate rows found");

  // Confirm with user (list count and example)
  const example = candidatesToMap
    .slice(0, 5)
    .map((c) => `#${c.batchId} → ${c.bn}`)
    .join("\n");
  const ok = await showConfirm(
    `Map ${candidatesToMap.length} rows that each have exactly one eligible BN?\n\nExamples:\n${example}\n\nProceed?`,
    "Map Single BN Rows",
  );
  if (!ok) return;

  // Sequentially map each candidate to avoid overload and provide progress feedback
  let successCount = 0;
  const errors = [];

  showProcessingOverlay(`Mapping 0 / ${candidatesToMap.length}...`);
  for (let i = 0; i < candidatesToMap.length; i++) {
    const item = candidatesToMap[i];
    updateProcessingOverlay(
      `Mapping ${i + 1} / ${candidatesToMap.length}: #${item.batchId} → ${
        item.bn
      }`,
    );
    try {
      const { error } = await supabase.rpc("map_batch_to_bmr_by_bn", {
        p_batch_id: item.batchId,
        p_bn: item.bn,
      });
      if (error) {
        errors.push({ batchId: item.batchId, error });
        console.error("Map error", item, error);
      } else {
        successCount++;
      }
    } catch (e) {
      errors.push({ batchId: item.batchId, error: e });
      console.error("Map exception", item, e);
    }
  }

  await loadBatches();
  hideProcessingOverlay();
  if (successCount) toast(`Mapped ${successCount} rows`);
  if (errors.length) {
    console.error(errors);
    toast(`${errors.length} rows failed to map (see console)`);
  }
};

// Wire the new button after DOM ready
document.addEventListener("DOMContentLoaded", () => {
  const btn = q("bpMapSinglesBtn");
  if (btn) btn.addEventListener("click", () => window.mapSingleBnRows());
});

// Handle kebab menu toggle
window.toggleKebabMenu = function (button) {
  const menu = button.nextElementSibling;
  const isOpen = menu.classList.contains("show");

  // Close all other kebab menus
  document.querySelectorAll(".kebab-content.show").forEach((content) => {
    content.classList.remove("show");
  });

  // Toggle current menu
  if (!isOpen) {
    // Calculate position relative to button
    const buttonRect = button.getBoundingClientRect();
    menu.style.top = buttonRect.bottom + 2 + "px";
    menu.style.left = buttonRect.right - 140 + "px"; // 140px is min-width of menu

    // Ensure menu doesn't go off-screen
    if (buttonRect.right - 140 < 0) {
      menu.style.left = buttonRect.left + "px";
    }

    menu.classList.add("show");
  }
};

// Close kebab menus when clicking outside
document.addEventListener("click", (e) => {
  if (!e.target.closest(".kebab-menu")) {
    document.querySelectorAll(".kebab-content.show").forEach((content) => {
      content.classList.remove("show");
    });
  }
});

// inline editor handler: update batch_size for a planned batch
async function onEditBatchSize(evt) {
  const el = evt.currentTarget;
  const headerId = Number(q("bpHeaderSel").value);
  if (_headerStatus === "applied")
    return toast("Header is applied (read-only)");

  const product_id = Number(el.dataset.pid);
  const month_start = el.dataset.ms;
  const batch_no_seq = Number(el.dataset.seq);
  const val = Number(el.value);

  if (!(val > 0)) {
    toast("Batch size must be > 0");
    el.value = "";
    return;
  }

  // Optional: simple clamp to avoid accidental huge numbers (comment out if not wanted)
  if (val > 1e9) {
    toast("Unrealistic batch size");
    return;
  }

  // Ensure we're only editing UNMAPPED batches
  const hitCheck = _batchesCache.find(
    (b) =>
      b.product_id === product_id &&
      b.month_start === month_start &&
      b.batch_no_seq === batch_no_seq,
  );
  if (!hitCheck) return toast("Batch context not found");
  if (hitCheck.map_status !== "UNMAPPED")
    return toast("Only UNMAPPED batches can be edited");

  const { error } = await supabase
    .from("batch_plan_batches")
    .update({ batch_size: val, updated_at: new Date().toISOString() })
    .eq("header_id", headerId)
    .eq("product_id", product_id)
    .eq("month_start", month_start)
    .eq("batch_no_seq", batch_no_seq);

  if (error) {
    console.error(error);
    toast("Save failed");
    return;
  }
  toast("Batch size saved");
  // update local cache then re-render
  const hit = _batchesCache.find(
    (b) =>
      b.product_id === product_id &&
      b.month_start === month_start &&
      b.batch_no_seq === batch_no_seq,
  );
  if (hit) hit.batch_size = val;
  renderBatches();
}

// Override management functions
let _overridesCache = []; // cache for current overrides

async function loadOverrides() {
  const headerId = Number(q("bpHeaderSel").value);
  if (!headerId) {
    _overridesCache = [];
    renderOverrides();
    return;
  }

  try {
    const { data, error } = await supabase.rpc("list_overrides_for_header", {
      p_header_id: headerId,
    });

    if (error) {
      console.error("Failed to load overrides:", error);
      toast("Failed to load overrides");
      return;
    }

    _overridesCache = data || [];
    renderOverrides();
  } catch (e) {
    console.error("Override load exception:", e);
    toast("Error loading overrides");
  }
}

async function renderOverrides() {
  const tbody = document.getElementById("overridesGridBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (_overridesCache.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="10" class="muted" style="text-align: center; padding: 20px;">No active overrides</td></tr>';
    return;
  }

  for (const override of _overridesCache) {
    const productName = await getProductName(override.product_id);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${override.product_id}</td>
      <td>${productName}</td>
      <td>${override.month_start}</td>
      <td>${override.bn}</td>
      <td>${override.batch_size}</td>
      <td>${override.uom}</td>
      <td><span class="op-type-badge op-type-${override.op_type.toLowerCase()}">${
        override.op_type
      }</span></td>
      <td>${override.override_qty ?? ""}</td>
      <td>${override.note || ""}</td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="deactivateOverride(${
          override.product_id
        }, '${override.month_start}', '${override.bn}', ${
          override.batch_size
        }, '${override.uom}', '${override.op_type}')">
          Deactivate
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  // Update summary
  const summary = document.getElementById("overridesSummary");
  if (summary) {
    const counts = _overridesCache.reduce((acc, o) => {
      acc[o.op_type] = (acc[o.op_type] || 0) + 1;
      return acc;
    }, {});

    summary.textContent = `Active overrides: ${
      _overridesCache.length
    } · Added: ${counts.ADD || 0} · Resized: ${
      counts.RESIZE || 0
    } · Cancelled: ${counts.CANCEL || 0}`;
  }
}

async function applyOverrideImmediate() {
  const headerId = Number(q("bpHeaderSel").value);
  if (!headerId) return toast("Pick a header");

  const form = document.getElementById("overrideForm");
  const formData = new FormData(form);

  const override = {
    product_id: Number(formData.get("product_id")) || null,
    month_start: formData.get("month_start") || null,
    bn: formData.get("bn") || null,
    batch_size: Number(formData.get("batch_size")) || null,
    uom: formData.get("uom") || null,
    op_type: formData.get("op_type") || null,
    override_qty:
      formData.get("override_qty") === ""
        ? null
        : Number(formData.get("override_qty")),
    note: formData.get("note") || null,
  };

  // Client-side validation
  if (
    !override.product_id ||
    !override.month_start ||
    !override.bn ||
    !override.batch_size ||
    !override.uom ||
    !override.op_type
  ) {
    return toast("Please fill all required fields");
  }

  if (override.op_type === "CANCEL" && override.override_qty !== null) {
    return toast("Cancel operations must have empty override quantity");
  }

  if (
    (override.op_type === "ADD" || override.op_type === "RESIZE") &&
    (!override.override_qty || override.override_qty <= 0)
  ) {
    return toast("Add/Resize operations require a positive override quantity");
  }

  try {
    const { error } = await supabase.rpc(
      "apply_production_batch_override_immediate",
      {
        p_header_id: headerId,
        p_product_id: override.product_id,
        p_month_start: override.month_start,
        p_bn: override.bn,
        p_batch_size: override.batch_size,
        p_uom: override.uom,
        p_op_type: override.op_type,
        p_override_qty: override.override_qty,
        p_note: override.note,
      },
    );

    if (error) {
      console.error("Override apply failed:", error);
      return toast(`Failed to apply override: ${error.message}`);
    }

    toast("Override applied successfully ✔");

    // Reset form
    form.reset();

    // Refresh data
    await loadOverrides();
    await loadRollup();
    await loadLines();
  } catch (e) {
    console.error("Override apply exception:", e);
    toast("Error applying override");
  }
}

async function deactivateOverride(
  productId,
  monthStart,
  bn,
  batchSize,
  uom,
  opType,
) {
  const ok = await showConfirm(
    `Deactivate ${opType} override for BN ${bn}?`,
    "Deactivate Override",
  );
  if (!ok) return;

  try {
    const { error } = await supabase.rpc(
      "deactivate_production_batch_override",
      {
        p_product_id: productId,
        p_month_start: monthStart,
        p_bn: bn,
        p_batch_size: batchSize,
        p_uom: uom,
        p_op_type: opType,
      },
    );

    if (error) {
      console.error("Override deactivate failed:", error);
      return toast(`Failed to deactivate override: ${error.message}`);
    }

    toast("Override deactivated ✔");

    // Refresh data
    await loadOverrides();
    await loadRollup();
    await loadLines();
  } catch (e) {
    console.error("Override deactivate exception:", e);
    toast("Error deactivating override");
  }
}

// Helper function to update overrides tab content based on header status
function updateOverridesTabContent() {
  const disabledMessage = document.getElementById("overrides-disabled-message");
  const enabledContent = document.getElementById("overrides-enabled-content");

  if (!disabledMessage || !enabledContent) return;

  if (_headerStatus === "applied") {
    disabledMessage.style.display = "none";
    enabledContent.style.display = "block";
    loadOverrides();
  } else {
    disabledMessage.style.display = "block";
    enabledContent.style.display = "none";
  }
}

// Expose functions for inline handlers
window.deactivateOverride = deactivateOverride;
window.toggleOverrideQty = toggleOverrideQty;

// Helper function to toggle override quantity field based on operation type
function toggleOverrideQty() {
  const opTypeSelect = document.querySelector('[name="op_type"]');
  const overrideQtyInput = document.querySelector('[name="override_qty"]');

  if (!opTypeSelect || !overrideQtyInput) return;

  const opType = opTypeSelect.value;

  if (opType === "CANCEL") {
    overrideQtyInput.value = "";
    overrideQtyInput.disabled = true;
    overrideQtyInput.placeholder = "Not required for CANCEL";
  } else {
    overrideQtyInput.disabled = false;
    overrideQtyInput.placeholder = "Required for ADD/RESIZE";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const byId = (id) => document.getElementById(id);
  byId("btnApplyOverride")?.addEventListener("click", applyOverrideImmediate);
});

// Expose handlers that may be invoked from other modules/templates or used in inline markup
window.onPickBmrForBatch = onPickBmrForBatch;
window.onMapByBN = onMapByBN;
window.onUnlinkBmr = onUnlinkBmr; // opens shared Administrative Correction (UNLINK_BMR)

// --- Enhanced tab switcher with status indicators ---
(function initTabs() {
  const workflowTabs = Array.from(
    document.querySelectorAll('.tabs [role="tab"]'),
  );
  const configTabs = Array.from(
    document.querySelectorAll('.config-tabs [role="tab"]'),
  );
  const allTabs = [...workflowTabs, ...configTabs];
  const panels = Array.from(document.querySelectorAll(".tabpanel"));
  const key = "supply-batch-plan.activeTab";

  function activate(id) {
    // Update aria-selected for all tabs
    allTabs.forEach((btn) =>
      btn.setAttribute(
        "aria-selected",
        btn.getAttribute("aria-controls") === id ? "true" : "false",
      ),
    );

    // Update panel visibility
    panels.forEach((p) => p.classList.toggle("active", p.id === id));
    localStorage.setItem(key, id);

    // Only update workflow status indicators for workflow tabs
    const isWorkflowTab = workflowTabs.some(
      (tab) => tab.getAttribute("aria-controls") === id,
    );
    if (isWorkflowTab) {
      updateTabStatuses(); // Update indicators when switching tabs
    }

    // Load tab-specific data
    if (id === "tab-batch-sizes") {
      loadBatchSizeReferences();
    } else if (id === "tab-overrides") {
      updateOverridesTabContent();
    }
  }

  // Auto-update status indicators when data changes
  window.updateTabStatuses = updateTabStatuses; // Use our global function
  window.activateSupplyBatchPlanTab = activate;

  allTabs.forEach((btn) => {
    btn.addEventListener("click", () =>
      activate(btn.getAttribute("aria-controls")),
    );
  });

  const deepLink = parseSupplyBatchPlanDeepLink(window.location.search || "");
  if (deepLink.openBatchSizesTab) {
    activate("tab-batch-sizes");
  } else {
    const saved = localStorage.getItem(key);
    if (saved && document.getElementById(saved)) activate(saved);
    else activate("tab-build"); // Start with Build tab
  }

  // Initial status update (only for workflow tabs)
  updateTabStatuses();
})();

// ---- Health Checks for Review & Apply Tab ----
async function updateHealthChecks() {
  const headerId = Number(q("bpHeaderSel").value);
  if (!headerId) {
    resetHealthChecks();
    return;
  }

  // Update plan summary metrics
  await updatePlanSummary();

  // Run individual health checks
  const checks = await runAllHealthChecks(headerId);

  // Update UI with results
  updateHealthCheckUI(checks);

  // Update action buttons based on check results
  updateActionButtons(checks);
}

function resetHealthChecks() {
  // Reset summary metrics
  const summaryElements = [
    "reviewProductsTotal",
    "reviewTotalBatches",
    "reviewBatchesMapped",
    "reviewBatchesUnmapped",
    "reviewProductsResidual",
  ];
  summaryElements.forEach((id) => {
    const el = q(id);
    if (el) el.textContent = "0";
  });

  // Reset check items to loading state
  const checkItems = [
    "checkMappingComplete",
    "checkResidualLow",
    "checkNoMismatches",
    "checkNoWipConflicts",
    "checkOverridesApplied",
    "checkUniqueMonth",
  ];
  checkItems.forEach((id) => {
    const el = q(id);
    if (el) {
      el.className = "check-item";
      const icon = el.querySelector(".check-icon");
      if (icon) icon.textContent = "⏳";
    }
  });

  // Disable apply button
  const applyBtn = q("btnApplyHeader");
  if (applyBtn) applyBtn.disabled = true;
}

async function updatePlanSummary() {
  const headerId = Number(q("bpHeaderSel").value);
  if (!headerId) return;

  try {
    // Use the same logic as loadRollup() function for consistent metrics

    // 1. Products (total) - count of lines (products in plan)
    const { data: lines, error: linesError } = await supabase
      .from("batch_plan_lines")
      .select("product_id, residual_qty")
      .eq("header_id", headerId);

    if (linesError) throw linesError;

    // 2. Total Batches - count of all batches in the plan
    const { count: totalBatches, error: totalBatchesError } = await supabase
      .from("batch_plan_batches")
      .select("id", { count: "exact" })
      .eq("header_id", headerId);

    if (totalBatchesError) throw totalBatchesError;

    // 3. Batches (mapped) - count of batches with BMR assigned
    const { count: mappedCount, error: mappedError } = await supabase
      .from("batch_plan_batches")
      .select("id", { count: "exact" })
      .eq("header_id", headerId)
      .not("bmr_id", "is", null);

    if (mappedError) throw mappedError;

    // 4. Batches (unmapped) - count of batches without BMR
    const { count: unmappedCount, error: unmappedError } = await supabase
      .from("batch_plan_batches")
      .select("id", { count: "exact" })
      .eq("header_id", headerId)
      .is("bmr_id", null);

    if (unmappedError) throw unmappedError;

    // 5. Products (with residuals) - products with non-zero residual
    const productsWithResiduals = lines.filter(
      (line) => line.residual_qty !== null && line.residual_qty !== 0,
    ).length;

    // Update the Review & Apply tab summary elements
    const reviewProductsTotal = q("reviewProductsTotal");
    const reviewTotalBatches = q("reviewTotalBatches");
    const reviewBatchesMapped = q("reviewBatchesMapped");
    const reviewBatchesUnmapped = q("reviewBatchesUnmapped");
    const reviewProductsResidual = q("reviewProductsResidual");

    if (reviewProductsTotal) reviewProductsTotal.textContent = lines.length;
    if (reviewTotalBatches) reviewTotalBatches.textContent = totalBatches || 0;
    if (reviewBatchesMapped) reviewBatchesMapped.textContent = mappedCount || 0;
    if (reviewBatchesUnmapped)
      reviewBatchesUnmapped.textContent = unmappedCount || 0;
    if (reviewProductsResidual)
      reviewProductsResidual.textContent = productsWithResiduals;
  } catch (error) {
    console.error("Error updating plan summary:", error);
  }
}

async function runAllHealthChecks(headerId) {
  const checks = {
    mappingComplete: false,
    residualLow: false,
    noMismatches: false,
    noWipConflicts: false,
    overridesApplied: false,
    uniqueMonth: false,
    details: {},
  };

  try {
    // 1. Check mapping completeness
    const { data: mapping } = await supabase
      .from("v_batch_plan_mapping_rollup")
      .select("*")
      .eq("header_id", headerId)
      .single();

    if (mapping) {
      checks.mappingComplete =
        mapping.batches_unmapped === 0 && mapping.batches_total > 0;
      checks.details.unmappedCount = mapping.batches_unmapped;
    }

    // 2. Check residual levels
    const { data: rollup } = await supabase
      .from("v_batch_plan_rollup")
      .select("*")
      .eq("header_id", headerId)
      .single();

    if (rollup) {
      const residualThreshold = 100; // Configurable threshold
      checks.residualLow =
        Math.abs(rollup.total_residual || 0) <= residualThreshold;
      checks.details.totalResidual = rollup.total_residual || 0;
    }

    // 3. Check for size mismatches and WIP conflicts
    const { data: batches } = await supabase
      .from("v_batch_plan_batches_status")
      .select("*")
      .eq("header_id", headerId);

    if (batches) {
      const mismatches = batches.filter(
        (b) => b.mismatch_text && b.mismatch_text.trim() !== "",
      );
      const wipConflicts = batches.filter((b) => b.is_wip === true);

      checks.noMismatches = mismatches.length === 0;
      checks.noWipConflicts = wipConflicts.length === 0;
      checks.details.mismatchCount = mismatches.length;
      checks.details.wipConflictCount = wipConflicts.length;
    }

    // 4. Check overrides applied (staging empty)
    // This would check a staging table if it exists
    checks.overridesApplied = true; // Assume no staging issues for now
    checks.details.stagingOverrides = 0;

    // 5. Check unique month (no other active headers for same period)
    const { data: selectedHeader } = await supabase
      .from("batch_plan_headers")
      .select("window_from")
      .eq("id", headerId)
      .single();

    if (selectedHeader) {
      const { data: conflictingHeaders } = await supabase
        .from("batch_plan_headers")
        .select("id")
        .neq("id", headerId)
        .eq("window_from", selectedHeader.window_from)
        .neq("status", "archived");

      checks.uniqueMonth = (conflictingHeaders || []).length === 0;
      checks.details.conflictingHeaders = (conflictingHeaders || []).length;
    }
  } catch (error) {
    console.error("Error running health checks:", error);
  }

  return checks;
}

function updateHealthCheckUI(checks) {
  // Update individual check items
  updateCheckItem(
    "checkMappingComplete",
    checks.mappingComplete,
    `${checks.details.unmappedCount || 0} batches unmapped`,
  );

  updateCheckItem(
    "checkResidualLow",
    checks.residualLow,
    `Total residual: ${(checks.details.totalResidual || 0).toLocaleString()}`,
  );

  updateCheckItem(
    "checkNoMismatches",
    checks.noMismatches,
    `${checks.details.mismatchCount || 0} size mismatches found`,
  );

  updateCheckItem(
    "checkNoWipConflicts",
    checks.noWipConflicts,
    `${checks.details.wipConflictCount || 0} WIP conflicts found`,
  );

  updateCheckItem(
    "checkOverridesApplied",
    checks.overridesApplied,
    `${checks.details.stagingOverrides || 0} pending overrides`,
  );

  updateCheckItem(
    "checkUniqueMonth",
    checks.uniqueMonth,
    `${checks.details.conflictingHeaders || 0} conflicting active plans`,
  );
}

function updateCheckItem(itemId, passed, description) {
  const item = q(itemId);
  if (!item) return;

  const icon = item.querySelector(".check-icon");
  const desc = item.querySelector(".check-description");

  if (passed) {
    item.className = "check-item passed";
    if (icon) icon.textContent = "✅";
  } else {
    item.className = "check-item failed";
    if (icon) icon.textContent = "❌";
  }

  if (desc && description) {
    desc.textContent = description;
  }
}

function updateActionButtons(checks) {
  const statusEl = q("reviewActionsStatus");
  const descEl = q("actionDescription");

  // Get status from the current header status variable that's already tracked
  const status = _headerStatus || "draft";

  // Update workflow progress tracker
  updateWorkflowProgress(status, checks);

  // Update kebab menu buttons
  updateKebabMenuButtons(status, checks);

  const allPassed =
    checks.mappingComplete &&
    checks.residualLow &&
    checks.noMismatches &&
    checks.noWipConflicts &&
    checks.overridesApplied &&
    checks.uniqueMonth;

  // Update Review tab status display
  switch (status) {
    case "draft":
      if (statusEl)
        statusEl.textContent = allPassed
          ? "Ready to submit"
          : "Issues need resolution";
      if (descEl)
        descEl.textContent = allPassed
          ? "All health checks passed. Ready to submit for review."
          : "Resolve the failing health checks before submitting.";
      break;

    case "submitted":
      if (statusEl)
        statusEl.textContent = allPassed
          ? "Ready to apply"
          : "Issues found during review";
      if (descEl)
        descEl.textContent = allPassed
          ? "Plan has been reviewed and is ready to apply."
          : "Issues found during review. Reopen to make changes.";
      break;

    case "applied":
      if (statusEl) statusEl.textContent = "Plan is active";
      if (descEl)
        descEl.textContent =
          "This plan is now the official production plan for the month.";
      break;

    case "archived":
      if (statusEl) statusEl.textContent = "Plan is archived";
      if (descEl)
        descEl.textContent = "This plan has been archived and is read-only.";
      break;
  }
}

// Update kebab menu button visibility and state
function updateKebabMenuButtons(status, checks) {
  const submitBtn = q("btnSubmitHeaderKebab");
  const reopenBtn = q("btnReopenHeaderKebab");
  const applyBtn = q("btnApplyHeaderKebab");

  const allPassed =
    checks.mappingComplete &&
    checks.residualLow &&
    checks.noMismatches &&
    checks.noWipConflicts &&
    checks.overridesApplied &&
    checks.uniqueMonth;

  // Reset button visibility
  if (submitBtn) {
    submitBtn.style.display = "block";
    submitBtn.disabled = false;
  }
  if (reopenBtn) reopenBtn.style.display = "none";
  if (applyBtn) {
    applyBtn.style.display = "block";
    applyBtn.disabled = !allPassed;
  }

  switch (status) {
    case "draft":
      // Submit enabled, Apply disabled if checks fail
      break;

    case "submitted":
      if (reopenBtn) reopenBtn.style.display = "block";
      // Apply enabled only if all checks pass
      break;

    case "applied":
      if (submitBtn) submitBtn.style.display = "none";
      if (applyBtn) applyBtn.disabled = true;
      break;

    case "archived":
      if (submitBtn) submitBtn.style.display = "none";
      if (applyBtn) applyBtn.disabled = true;
      break;
  }
}

// Legacy function name for compatibility
function updateReadinessChecklist() {
  updateHealthChecks();
}

// Update workflow progress tracker visual state
function updateWorkflowProgress(status, checks) {
  const stepDraft = q("stepDraft");
  const stepSubmitted = q("stepSubmitted");
  const stepApplied = q("stepApplied");
  const stepArchived = q("stepArchived");

  const stepDraftMeta = q("stepDraftMeta");
  const stepSubmittedMeta = q("stepSubmittedMeta");
  const stepAppliedMeta = q("stepAppliedMeta");
  const stepArchivedMeta = q("stepArchivedMeta");

  // Reset all step states
  [stepDraft, stepSubmitted, stepApplied, stepArchived].forEach((step) => {
    if (step) {
      step.classList.remove("completed", "active", "pending");
    }
  });

  // Get current date for display
  const currentDate = new Date().toLocaleDateString();

  // Set step states based on current status
  switch (status) {
    case "draft":
      if (stepDraft) stepDraft.classList.add("active");
      if (stepDraftMeta) stepDraftMeta.textContent = "Plan in development";
      break;

    case "submitted":
      if (stepDraft) stepDraft.classList.add("completed");
      if (stepSubmitted) stepSubmitted.classList.add("active");
      if (stepDraftMeta) stepDraftMeta.textContent = `Created ${currentDate}`;
      if (stepSubmittedMeta) {
        const allPassed =
          checks.mappingComplete &&
          checks.residualLow &&
          checks.noMismatches &&
          checks.noWipConflicts &&
          checks.overridesApplied &&
          checks.uniqueMonth;
        stepSubmittedMeta.textContent = allPassed
          ? "Ready for approval"
          : "Issues need resolution";
      }
      break;

    case "applied":
      if (stepDraft) stepDraft.classList.add("completed");
      if (stepSubmitted) stepSubmitted.classList.add("completed");
      if (stepApplied) stepApplied.classList.add("active");
      if (stepDraftMeta) stepDraftMeta.textContent = `Created ${currentDate}`;
      if (stepSubmittedMeta)
        stepSubmittedMeta.textContent = `Submitted ${currentDate}`;
      if (stepAppliedMeta)
        stepAppliedMeta.textContent = `Applied ${currentDate}`;
      break;

    case "archived":
      if (stepDraft) stepDraft.classList.add("completed");
      if (stepSubmitted) stepSubmitted.classList.add("completed");
      if (stepApplied) stepApplied.classList.add("completed");
      if (stepArchived) stepArchived.classList.add("active");
      if (stepDraftMeta) stepDraftMeta.textContent = `Created ${currentDate}`;
      if (stepSubmittedMeta)
        stepSubmittedMeta.textContent = `Submitted ${currentDate}`;
      if (stepAppliedMeta)
        stepAppliedMeta.textContent = `Applied ${currentDate}`;
      if (stepArchivedMeta)
        stepArchivedMeta.textContent = `Archived ${currentDate}`;
      break;
  }
}

// Make functions available globally for other functions to call
window.updateReadinessChecklist = updateReadinessChecklist;
window.updateHealthChecks = updateHealthChecks;

// Quick-start tooltips for better user guidance
(function attachQuickTips() {
  const TIPS = {
    // Plan Setup
    bpHeaderSel: "Select an existing plan header (one per month).",
    btnReloadHeaders: "Reload the latest headers.",
    btnRenameHeader:
      "Rename the selected header. Writes: batch_plan_headers.plan_title.",
    btnDeleteHeader:
      "Delete the header (if not applied). Also removes its lines & batches.",
    btnArchiveHeader:
      "Archive header: hides from unique-per-month rule; becomes read-only.",
    newHeaderTitle:
      "Title for this plan header (e.g., Batch Production Plan Oct 2025). Auto-generates from selected month.",
    newPlanMonth:
      "Plan month. Window is auto-set to first→last day of the month.",
    btnCreateHeader:
      "Create a new plan header for the chosen month. Writes header only.",

    // Build / Refresh
    btnRebuildAll:
      "Rebuild lines & batches from consolidated plan for this month. Overwrites UNMAPPED & MAPPED (mapping may be re-evaluated).",
    btnRebuildUnmapped:
      "Rebuild only products with no mapped BMR. Safer for in-progress mapping.",
    btnNudgeResiduals:
      "Absorb small residuals into UNMAPPED batches (≤ threshold).",
    bpProductIds: "Comma-separated product_ids to rebuild.",
    btnRefreshSelected:
      "Rebuild only these products under this header. Allowed in draft/submitted.",
    bpStatTotals: "Live totals: planned target, batched, residual.",

    // Lines
    // (table itself is self-explanatory; optional tips on headers if you want)

    // Batches
    bpBatchFilter: "Filter by mapping status (UNMAPPED / MAPPED / WIP).",
    bpBatchProductFilter:
      "Filter by product name or product id (partial match).",

    // Mapping
    mapBatchSel: "Pick an UNMAPPED planned batch to map.",
    mapBmrSel: "Candidate BMR cards for the selected product/size.",
    btnLinkBmr: "Link the UNMAPPED batch to the selected BMR (BN).",
    btnUnlinkBmr:
      "Administrative Correction (UNLINK_BMR). Requires role:manager-bmr-admin-correction. Opens the governed correction workflow.",
    btnReloadMap: "Rebuild mapping rollup and candidates.",

    // Overrides
    ovFile: "Choose your overrides CSV to preview.",
    btnPreviewOverrides: "Preview parsed overrides (valid rows only).",
    btnApplyOverrides:
      "Apply overrides to active window via RPC. WIP BNs are rejected.",

    // Kebab Menu Actions
    btnSubmitHeaderKebab:
      "Move plan to Submitted for review. Edits still allowed.",
    btnReopenHeaderKebab: "Reopen a Submitted plan back to Draft.",
    btnApplyHeaderKebab:
      "Apply (finalize) the plan. Plan becomes read-only (except Archive).",
  };

  Object.entries(TIPS).forEach(([id, tip]) => {
    const el = document.getElementById(id);
    if (el && !el.title) el.title = tip;
  });
});

// ============================================================================

// BATCH SIZE REFERENCE MANAGEMENT (Gate 11Y.4E.4 — governed RPCs only)

// ============================================================================



const BATCH_SIZE_PAGE_LIMIT = 50;



/** Register UI state — no full-table authoritative cache. */

const _batchSizeRegister = {

  rows: [],

  total_count: 0,

  status_counts: {},

  invalid_range_count: 0,

  search: "",

  state: "ALL",

  limit: BATCH_SIZE_PAGE_LIMIT,

  offset: 0,

  loading: false,

  error: null,

  generation: 0,

};



/** Product-scoped cache built only from register RPC. */

const _productBatchSizeCache = new Map();



let _batchSizeModalMode = "create"; // create | revise

let _currentRevisingReference = null;

let _currentHistoryProductId = null;

let _batchSizeHistoryRows = [];

let _pendingDeepLink = null;

let _quickEditActiveReference = null;

let _currentQuickEditProductId = null;

let _currentQuickEditMonth = null;



function canEditBatchSizes() {

  return !!_canEditBatchSizes;

}



function canViewBatchSizes() {

  return !!_canViewBatchSizes;

}



function applyBatchSizePermissionUi() {

  const edit = canEditBatchSizes();

  const view = canViewBatchSizes();

  const addBtn = q("addNewBatchSizeBtn");

  if (addBtn) addBtn.style.display = edit ? "" : "none";

  const saveBtn = q("batchSizeSave");

  if (saveBtn) saveBtn.style.display = edit ? "" : "none";

  const saveRecalcBtn = q("batchSizeSaveRecalc");

  if (saveRecalcBtn) saveRecalcBtn.style.display = edit ? "" : "none";

  const inactivateBtn = q("batchSizeInactivate");

  if (inactivateBtn) {

    inactivateBtn.style.display =

      edit && _batchSizeModalMode === "revise" ? "" : "none";

  }

  const qeSave = q("quickEditSave");

  if (qeSave) qeSave.style.display = edit ? "" : "none";

  const qeRebuild = q("quickEditRebuild");

  if (qeRebuild) qeRebuild.style.display = edit ? "" : "none";

  const form = q("batchSizeForm");

  if (form) {

    form.querySelectorAll("input, select, textarea").forEach((el) => {

      if (el.id === "batchSizeProductSelect") return;

      if (

        el.id === "batchSizeUomDisplay" ||

        el.id === "batchSizeCurrentReadonly"

      )

        return;

      if (!edit) el.setAttribute("readonly", "readonly");

      else el.removeAttribute("readonly");

      if (el.tagName === "SELECT" || el.type === "checkbox" || el.type === "date") {

        el.disabled = !edit && el.id !== "batchSizeProductSelect";

      }

    });

  }

  const qeForm = q("quickEditBatchSizeForm");

  if (qeForm) {

    qeForm.querySelectorAll("input, textarea").forEach((el) => {

      el.disabled = !edit;

      if (!edit) el.setAttribute("readonly", "readonly");

      else el.removeAttribute("readonly");

    });

  }

  if (!view) {

    const tbody = q("batchSizeRefsBody");

    if (tbody) {

      tbody.innerHTML =

        '<tr><td colspan="12" style="text-align:center;padding:20px;color:#666;">View permission required for Batch Size References.</td></tr>';

    }

  }

}



function invalidateProductBatchSizeCache(productId = null) {

  if (productId == null) {

    _productBatchSizeCache.clear();

    return;

  }

  const pid = normalizeSupplyBatchSizeIntegerId(productId);

  if (pid != null) _productBatchSizeCache.delete(pid);

}



function escapeBatchSizeHtml(value) {

  return String(value ?? "")

    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;");

}



function formatBatchSizeNumber(value) {

  if (value == null || value === "") return "—";

  const n = Number(value);

  if (!Number.isFinite(n)) return "—";

  return n.toLocaleString("en-IN");

}



function formatBatchSizeDate(value) {

  if (!value) return "—";

  try {

    return new Date(String(value).slice(0, 10) + "T00:00:00").toLocaleDateString();

  } catch {

    return String(value).slice(0, 10);

  }

}



function batchSizeStateChip(row) {

  const state = String(row.state || (row.is_active ? "ACTIVE" : "INACTIVE")).toUpperCase();

  if (state === "ACTIVE") {

    return '<span class="bs-chip bs-chip-active">Active</span>';

  }

  if (state === "MISSING") {

    return '<span class="bs-chip bs-chip-missing">Missing</span>';

  }

  return '<span class="bs-chip bs-chip-inactive">Inactive</span>';

}



function batchSizeRangeChip(row) {

  if (row.state === "MISSING" || row.reference_id == null) return "—";

  if (row.invalid_range) {

    return '<span class="bs-chip bs-chip-invalid">Invalid range</span>';

  }

  return '<span class="bs-chip bs-chip-ok">Valid</span>';

}



async function invokeSupplyBatchSizeRpc(rpcName, built, fallbackMessage) {

  if (!built?.ok) {

    const msg = (built?.errors || []).join("; ") || fallbackMessage;

    return { ok: false, error: { message: msg }, data: null };

  }

  try {

    const { data, error } = await supabase.rpc(rpcName, built.params);

    if (error) {

      console.error(`[supply-batch-plan] ${rpcName} failed`, error);

      return { ok: false, error, data: null };

    }

    return { ok: true, error: null, data };

  } catch (err) {

    console.error(`[supply-batch-plan] ${rpcName} threw`, err);

    return {

      ok: false,

      error: { message: err?.message || fallbackMessage },

      data: null,

    };

  }

}



function isActiveReferenceConflict(error) {

  const msg = String(error?.message || error?.details || "").toLowerCase();

  const code = String(error?.code || "");

  return (

    code === "23505" ||

    msg.includes("active") &&

      (msg.includes("already") || msg.includes("exist") || msg.includes("conflict"))

  );

}



async function fetchProductActiveBatchSizeReference(productId) {

  const pid = normalizeSupplyBatchSizeIntegerId(productId);

  if (pid == null) return null;

  if (_productBatchSizeCache.has(pid)) {

    return _productBatchSizeCache.get(pid)?.active || null;

  }

  const built = buildGetSupplyBatchSizeReferencesArgs({

    product_id: pid,

    state: "ACTIVE",

    limit: 20,

    offset: 0,

  });

  const res = await invokeSupplyBatchSizeRpc(

    SUPPLY_BATCH_SIZE_RPC_NAMES.register,

    built,

    "Unable to load batch size references.",

  );

  if (!res.ok) return null;

  const unwrapped = unwrapSupplyBatchSizeReferencesPayload(res.data);

  const active =

    unwrapped.rows.find((r) => r.state === "ACTIVE" && r.reference_id != null) ||

    null;

  _productBatchSizeCache.set(pid, { active, rows: unwrapped.rows });

  return active;

}



async function loadProductBatchSizeHistory(productId) {

  const pid = normalizeSupplyBatchSizeIntegerId(productId);

  _currentHistoryProductId = pid;

  const host = q("batchSizeHistoryBody");

  if (!pid) {

    _batchSizeHistoryRows = [];

    if (host) host.innerHTML = "";

    return [];

  }

  if (host) {

    host.innerHTML =

      '<tr><td colspan="8" style="text-align:center;padding:8px;color:#666;">Loading history…</td></tr>';

  }

  const built = buildGetSupplyBatchSizeReferencesArgs({

    product_id: pid,

    state: "ALL",

    limit: 100,

    offset: 0,

  });

  const res = await invokeSupplyBatchSizeRpc(

    SUPPLY_BATCH_SIZE_RPC_NAMES.register,

    built,

    "Unable to load Product batch-size history.",

  );

  if (!res.ok) {

    if (host) {

      host.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:8px;color:#b91c1c;">${escapeBatchSizeHtml(

        res.error?.message || "Failed to load history",

      )}</td></tr>`;

    }

    return [];

  }

  const unwrapped = unwrapSupplyBatchSizeReferencesPayload(res.data);

  _batchSizeHistoryRows = unwrapped.rows.filter((r) => r.reference_id != null);

  _productBatchSizeCache.set(pid, {

    active: _batchSizeHistoryRows.find((r) => r.state === "ACTIVE") || null,

    rows: _batchSizeHistoryRows,

  });

  renderBatchSizeHistory();

  return _batchSizeHistoryRows;

}



function renderBatchSizeHistory() {

  const host = q("batchSizeHistoryBody");

  const section = q("batchSizeHistorySection");

  if (section) section.style.display = _currentHistoryProductId ? "" : "none";

  if (!host) return;

  if (!_batchSizeHistoryRows.length) {

    host.innerHTML =

      '<tr><td colspan="8" style="text-align:center;padding:8px;color:#666;">No history rows.</td></tr>';

    return;

  }

  host.innerHTML = _batchSizeHistoryRows

    .map((r) => {

      return `<tr>

        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;">${escapeBatchSizeHtml(r.reference_id)}</td>

        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;text-align:center;">${formatBatchSizeNumber(r.preferred_batch_size)} / ${formatBatchSizeNumber(r.min_batch_size)} / ${formatBatchSizeNumber(r.max_batch_size)}</td>

        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;text-align:center;">${escapeBatchSizeHtml(formatBatchSizeDate(r.effective_from))}</td>

        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;text-align:center;">${escapeBatchSizeHtml(formatBatchSizeDate(r.effective_to))}</td>

        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;text-align:center;">${batchSizeStateChip(r)}</td>

        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeBatchSizeHtml(r.change_reason || "")}">${escapeBatchSizeHtml(r.change_reason || "—")}</td>

        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;text-align:center;">${escapeBatchSizeHtml(r.supersedes_reference_id ?? "—")}</td>

        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:11px;">

          <div>c: ${escapeBatchSizeHtml(r.created_at ? String(r.created_at).slice(0, 19) : "—")}</div>

          <div>u: ${escapeBatchSizeHtml(r.updated_at ? String(r.updated_at).slice(0, 19) : "—")}</div>

          <div>i: ${escapeBatchSizeHtml(r.inactivated_at ? String(r.inactivated_at).slice(0, 19) : "—")}</div>

        </td>

      </tr>`;

    })

    .join("");

}



async function loadBatchSizeReferencesData(options = {}) {

  if (!canViewBatchSizes()) {

    _batchSizeRegister.rows = [];

    _batchSizeRegister.total_count = 0;

    _batchSizeRegister.error = "View permission required.";

    return { ok: false, reason: "permission" };

  }



  const search =

    options.search != null

      ? String(options.search)

      : q("batchSizeSearchInput")?.value?.trim() || _batchSizeRegister.search;

  const state =

    options.state != null

      ? String(options.state).toUpperCase()

      : q("batchSizeFilterState")?.value || _batchSizeRegister.state || "ALL";

  let offset =

    options.offset != null ? Number(options.offset) : _batchSizeRegister.offset;

  if (options.resetOffset) offset = 0;

  const limit = options.limit != null ? Number(options.limit) : _batchSizeRegister.limit;

  const productId =

    options.product_id != null

      ? normalizeSupplyBatchSizeIntegerId(options.product_id)

      : normalizeSupplyBatchSizeIntegerId(

          q("batchSizeProductIdFilter")?.value || null,

        );



  _batchSizeRegister.search = search;

  _batchSizeRegister.state = state;

  _batchSizeRegister.offset = Math.max(0, offset || 0);

  _batchSizeRegister.limit = Math.max(1, limit || BATCH_SIZE_PAGE_LIMIT);

  _batchSizeRegister.loading = true;

  _batchSizeRegister.error = null;

  const generation = ++_batchSizeRegister.generation;



  const built = buildGetSupplyBatchSizeReferencesArgs({

    product_id: productId,

    search,

    state,

    limit: _batchSizeRegister.limit,

    offset: _batchSizeRegister.offset,

  });

  const res = await invokeSupplyBatchSizeRpc(

    SUPPLY_BATCH_SIZE_RPC_NAMES.register,

    built,

    "Unable to load batch size references.",

  );



  if (generation !== _batchSizeRegister.generation) {

    return { ok: false, reason: "stale" };

  }



  _batchSizeRegister.loading = false;

  if (!res.ok) {

    _batchSizeRegister.rows = [];

    _batchSizeRegister.total_count = 0;

    _batchSizeRegister.error = res.error?.message || "Load failed";

    return { ok: false, error: res.error };

  }



  const unwrapped = unwrapSupplyBatchSizeReferencesPayload(res.data);

  _batchSizeRegister.rows = unwrapped.rows;

  _batchSizeRegister.total_count = unwrapped.total_count;

  _batchSizeRegister.status_counts = unwrapped.status_counts || {};

  _batchSizeRegister.invalid_range_count = unwrapped.invalid_range_count || 0;



  if (productId != null) {

    _productBatchSizeCache.set(productId, {

      active: unwrapped.rows.find((r) => r.state === "ACTIVE") || null,

      rows: unwrapped.rows,

    });

  }



  return { ok: true, generation };

}



async function loadBatchSizeReferences(options = {}) {

  const tbody = q("batchSizeRefsBody");

  if (!tbody) return;

  if (!canViewBatchSizes()) {

    applyBatchSizePermissionUi();

    return;

  }

  tbody.innerHTML =

    '<tr><td colspan="12" style="text-align:center;padding:20px;color:#666;">Loading batch size references...</td></tr>';

  await loadProductsCache();

  const result = await loadBatchSizeReferencesData(options);

  if (result?.reason === "stale") return;

  renderBatchSizeReferences();

  updateBatchSizePager();

}



function updateBatchSizePager() {

  const info = q("batchSizePagerInfo");

  const prev = q("batchSizePrevPage");

  const next = q("batchSizeNextPage");

  const total = Number(_batchSizeRegister.total_count) || 0;

  const limit = Number(_batchSizeRegister.limit) || BATCH_SIZE_PAGE_LIMIT;

  const offset = Number(_batchSizeRegister.offset) || 0;

  const page = Math.floor(offset / limit) + 1;

  const pages = Math.max(1, Math.ceil(total / limit) || 1);

  if (info) {

    info.textContent = total

      ? `Page ${page} of ${pages} · ${total.toLocaleString("en-IN")} row(s)`

      : "No rows";

    if (_batchSizeRegister.invalid_range_count > 0) {

      info.textContent += ` · ${_batchSizeRegister.invalid_range_count} invalid range`;

    }

  }

  if (prev) prev.disabled = offset <= 0 || _batchSizeRegister.loading;

  if (next) next.disabled = offset + limit >= total || _batchSizeRegister.loading;

}



function renderBatchSizeReferences() {

  const tbody = q("batchSizeRefsBody");

  if (!tbody) return;

  applyBatchSizePermissionUi();



  if (_batchSizeRegister.error) {

    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:20px;color:#b91c1c;">${escapeBatchSizeHtml(

      _batchSizeRegister.error,

    )}</td></tr>`;

    return;

  }



  if (!_batchSizeRegister.rows.length) {

    tbody.innerHTML =

      '<tr><td colspan="12" style="text-align:center;padding:20px;color:#666;">No batch size references found for the current filters.</td></tr>';

    return;

  }



  const edit = canEditBatchSizes();

  tbody.innerHTML = _batchSizeRegister.rows

    .map((ref) => {

      const productLabel =

        ref.product_name ||

        getProductDisplay(ref.product_id) ||

        `Product ${ref.product_id}`;

      const group = ref.product_group_name || "—";

      const uom = ref.uom || _productsCache.get(ref.product_id)?.uom_base || "—";

      const updated = ref.updated_at

        ? String(ref.updated_at).slice(0, 19).replace("T", " ")

        : "—";

      let actions = "";

      if (edit && ref.state === "ACTIVE" && ref.reference_id != null) {

        actions += `<button type="button" class="btn" style="padding:4px 8px;margin-right:4px;font-size:12px;" data-bs-revise="${ref.reference_id}">Revise</button>`;

        actions += `<button type="button" class="btn" style="padding:4px 8px;margin-right:4px;font-size:12px;" data-bs-inactivate="${ref.reference_id}">Inactivate</button>`;

      }

      if (ref.product_id != null) {

        actions += `<button type="button" class="btn" style="padding:4px 8px;font-size:12px;" data-bs-history="${ref.product_id}">History</button>`;

      }

      return `<tr data-product-id="${escapeBatchSizeHtml(ref.product_id ?? "")}" data-reference-id="${escapeBatchSizeHtml(ref.reference_id ?? "")}">

        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeBatchSizeHtml(productLabel)} <span class="muted">#${escapeBatchSizeHtml(ref.product_id ?? "")}</span></td>

        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeBatchSizeHtml(group)}</td>

        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${formatBatchSizeNumber(ref.preferred_batch_size)}</td>

        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${formatBatchSizeNumber(ref.min_batch_size)}</td>

        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${formatBatchSizeNumber(ref.max_batch_size)}</td>

        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${escapeBatchSizeHtml(uom)}</td>

        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${escapeBatchSizeHtml(formatBatchSizeDate(ref.effective_from))}</td>

        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${escapeBatchSizeHtml(formatBatchSizeDate(ref.effective_to))}</td>

        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${batchSizeStateChip(ref)}</td>

        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${batchSizeRangeChip(ref)}</td>

        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;">${escapeBatchSizeHtml(updated)}</td>

        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;white-space:nowrap;">${actions || "—"}</td>

      </tr>`;

    })

    .join("");

}



function initializeBatchSizeSearch() {

  const searchInput = q("batchSizeSearchInput");

  const clearBtn = q("clearBatchSizeSearchBtn");

  let debounce = null;



  const reload = (resetOffset = true) => {

    loadBatchSizeReferences({ resetOffset });

  };



  if (searchInput) {

    searchInput.addEventListener("input", () => {

      if (clearBtn) {

        clearBtn.style.display = searchInput.value.trim()

          ? "inline-block"

          : "none";

      }

      clearTimeout(debounce);

      debounce = setTimeout(() => reload(true), 300);

    });

    searchInput.addEventListener("keyup", (e) => {

      if (e.key === "Escape") {

        searchInput.value = "";

        if (clearBtn) clearBtn.style.display = "none";

        reload(true);

      }

    });

  }

  clearBtn?.addEventListener("click", () => {

    if (searchInput) searchInput.value = "";

    clearBtn.style.display = "none";

    reload(true);

  });



  q("batchSizeFilterState")?.addEventListener("change", () => reload(true));

  q("batchSizeProductIdFilter")?.addEventListener("change", () => reload(true));

  q("batchSizePrevPage")?.addEventListener("click", () => {

    const nextOffset = Math.max(

      0,

      _batchSizeRegister.offset - _batchSizeRegister.limit,

    );

    loadBatchSizeReferences({ offset: nextOffset, resetOffset: false });

  });

  q("batchSizeNextPage")?.addEventListener("click", () => {

    const nextOffset = _batchSizeRegister.offset + _batchSizeRegister.limit;

    loadBatchSizeReferences({ offset: nextOffset, resetOffset: false });

  });



  q("batchSizeRefsBody")?.addEventListener("click", async (e) => {

    const reviseBtn = e.target.closest?.("[data-bs-revise]");

    const inactivateBtn = e.target.closest?.("[data-bs-inactivate]");

    const historyBtn = e.target.closest?.("[data-bs-history]");

    if (reviseBtn) {

      const id = Number(reviseBtn.getAttribute("data-bs-revise"));

      await reviseBatchSizeRef(id);

    } else if (inactivateBtn) {

      const id = Number(inactivateBtn.getAttribute("data-bs-inactivate"));

      await openInactivateBatchSizeFlow(id);

    } else if (historyBtn) {

      const pid = Number(historyBtn.getAttribute("data-bs-history"));

      await openBatchSizeHistoryForProduct(pid);

    }

  });

}



async function loadProductsForBatchSize() {

  const select = q("batchSizeProductSelect");

  if (!select) return;

  await loadProductsCache();

  select.innerHTML = '<option value="">Select a product...</option>';

  const availableProducts = Array.from(_productsCache.values())

    .filter((p) => p.status === "Active")

    .sort((a, b) => a.item.localeCompare(b.item));

  availableProducts.forEach((product) => {

    const option = document.createElement("option");

    option.value = product.id;

    option.textContent = getProductDisplay(product.id);

    select.appendChild(option);

  });

}



function setBatchSizeUomDisplay(productId) {

  const el = q("batchSizeUomDisplay");

  if (!el) return;

  const product = _productsCache.get(Number(productId));

  el.textContent = product?.uom_base || "—";

}



function setQuickEditUomDisplay(productId) {

  const el = q("quickEditUomDisplay");

  if (!el) return;

  const product = _productsCache.get(Number(productId));

  el.textContent = product?.uom_base || "—";

}



function fillBatchSizeCurrentReadonly(ref) {

  const host = q("batchSizeCurrentReadonly");

  if (!host) return;

  if (!ref) {

    host.style.display = "none";

    host.innerHTML = "";

    return;

  }

  host.style.display = "";

  host.innerHTML = `

    <div class="form-group" style="margin-bottom:12px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">

      <div style="font-weight:600;margin-bottom:6px;">Current reference (read-only)</div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;font-size:13px;">

        <div>Reference ID: <strong>${escapeBatchSizeHtml(ref.reference_id)}</strong></div>

        <div>State: ${batchSizeStateChip(ref)}</div>

        <div>Product: ${escapeBatchSizeHtml(getProductDisplay(ref.product_id))}</div>

        <div>UOM: ${escapeBatchSizeHtml(ref.uom || _productsCache.get(ref.product_id)?.uom_base || "—")}</div>

        <div>Preferred / Min / Max: ${formatBatchSizeNumber(ref.preferred_batch_size)} / ${formatBatchSizeNumber(ref.min_batch_size)} / ${formatBatchSizeNumber(ref.max_batch_size)}</div>

        <div>Effective from: ${escapeBatchSizeHtml(formatBatchSizeDate(ref.effective_from))}</div>

        <div>Range: ${batchSizeRangeChip(ref)}</div>

      </div>

    </div>`;

}



async function showBatchSizeModal(mode = "create", batchSizeRef = null) {

  if (!canViewBatchSizes()) {

    showAlert("View permission required.");

    return;

  }

  if ((mode === "create" || mode === "revise") && !canEditBatchSizes()) {

    showAlert("Edit permission required to create or revise batch-size references.");

    return;

  }



  const modal = q("batchSizeModal");

  const title = q("batchSizeModalTitle");

  const form = q("batchSizeForm");

  if (!modal || !title || !form) return;



  _batchSizeModalMode = mode;

  _currentRevisingReference = batchSizeRef

    ? normalizeSupplyBatchSizeReferenceRow(batchSizeRef)

    : null;



  const productSelect = q("batchSizeProductSelect");

  const reasonInput = q("batchSizeChangeReason");

  const notesInput = q("batchSizeNotes");



  if (mode === "revise" && _currentRevisingReference) {

    title.textContent = "Revise Batch Size Reference";

    fillBatchSizeCurrentReadonly(_currentRevisingReference);

    await loadProductsForBatchSize();

    if (productSelect) {

      productSelect.value = String(_currentRevisingReference.product_id);

      productSelect.disabled = true;

    }

    setBatchSizeUomDisplay(_currentRevisingReference.product_id);

    q("batchSizePreferred").value =

      _currentRevisingReference.preferred_batch_size ?? "";

    q("batchSizeMin").value = _currentRevisingReference.min_batch_size ?? "";

    q("batchSizeMax").value = _currentRevisingReference.max_batch_size ?? "";

    q("batchSizeEffectiveFrom").value = supplyBatchSizeTodayIsoDate();

    if (reasonInput) reasonInput.value = "";

    if (notesInput) notesInput.value = "";

    await loadProductBatchSizeHistory(_currentRevisingReference.product_id);

  } else {

    title.textContent = "Add Product Batch Size Reference";

    fillBatchSizeCurrentReadonly(null);

    _currentRevisingReference = null;

    await loadProductsForBatchSize();

    form.reset();

    if (productSelect) productSelect.disabled = false;

    q("batchSizeEffectiveFrom").value = supplyBatchSizeTodayIsoDate();

    setBatchSizeUomDisplay(null);

    if (reasonInput) reasonInput.value = "";

    const hist = q("batchSizeHistorySection");

    if (hist) hist.style.display = "none";

  }



  applyBatchSizePermissionUi();

  modal.style.display = "flex";

}



function hideBatchSizeModal() {

  const modal = q("batchSizeModal");

  if (modal) modal.style.display = "none";

  _batchSizeModalMode = "create";

  _currentRevisingReference = null;

}



function collectBatchSizeFormPayload() {

  const preferred = q("batchSizePreferred")?.value;

  const min = q("batchSizeMin")?.value;

  const max = q("batchSizeMax")?.value;

  const effective_from = q("batchSizeEffectiveFrom")?.value;

  const change_reason = q("batchSizeChangeReason")?.value;

  const notes = q("batchSizeNotes")?.value;

  const product_id = Number(q("batchSizeProductSelect")?.value);

  return {

    product_id,

    preferred_batch_size: preferred,

    min_batch_size: min === "" ? null : min,

    max_batch_size: max === "" ? null : max,

    effective_from,

    change_reason,

    notes,

  };

}



async function saveBatchSizeRef({ recalculate = false } = {}) {

  if (!canEditBatchSizes()) {

    showAlert("Edit permission required.");

    return;

  }

  const form = q("batchSizeForm");

  if (!form) return;

  if (!form.checkValidity()) {

    form.reportValidity();

    return;

  }



  const payload = collectBatchSizeFormPayload();

  const range = validateSupplyBatchSizeRange(payload);

  if (!range.ok) {

    showAlert(range.errors.join("\n"));

    return;

  }

  if (!isMeaningfulSupplyBatchSizeChangeReason(payload.change_reason)) {

    showAlert("A meaningful change reason is required.");

    q("batchSizeChangeReason")?.focus();

    return;

  }



  let built;

  if (_batchSizeModalMode === "revise" && _currentRevisingReference?.reference_id) {

    built = buildReviseSupplyBatchSizeReferenceArgs({

      reference_id: _currentRevisingReference.reference_id,

      ...payload,

    });

  } else {

    const existing = await fetchProductActiveBatchSizeReference(payload.product_id);

    if (existing) {

      const openRevise = await showConfirm(

        "This product already has an active batch size reference. Create is not allowed.\n\nOpen the active reference for Revise?",

      );

      if (openRevise) await showBatchSizeModal("revise", existing);

      return;

    }

    built = buildCreateSupplyBatchSizeReferenceArgs(payload);

  }



  const rpcName =

    _batchSizeModalMode === "revise"

      ? SUPPLY_BATCH_SIZE_RPC_NAMES.revise

      : SUPPLY_BATCH_SIZE_RPC_NAMES.create;

  const res = await invokeSupplyBatchSizeRpc(

    rpcName,

    built,

    "Failed to save batch size reference.",

  );

  if (!res.ok) {

    if (

      _batchSizeModalMode === "create" &&

      isActiveReferenceConflict(res.error)

    ) {

      const active = await fetchProductActiveBatchSizeReference(payload.product_id);

      const openRevise = await showConfirm(

        "An active batch size reference already exists for this Product. Create was rejected.\n\nOpen the active reference for Revise?",

      );

      if (openRevise && active) await showBatchSizeModal("revise", active);

      else showAlert(res.error?.message || "Create rejected.");

      return;

    }

    showAlert(res.error?.message || "Failed to save batch size reference.");

    return;

  }



  const savedProductId = payload.product_id;

  invalidateProductBatchSizeCache(savedProductId);



  let successMsg =

    _batchSizeModalMode === "revise"

      ? "Batch size reference revised successfully."

      : "Batch size reference created successfully.";

  const resultRow =

    res.data && typeof res.data === "object" && !Array.isArray(res.data)

      ? res.data

      : Array.isArray(res.data)

        ? res.data[0]

        : null;

  if (resultRow) {

    const newId =

      resultRow.reference_id ?? resultRow.new_reference_id ?? resultRow.id;

    const oldId =

      resultRow.superseded_reference_id ??

      resultRow.supersedes_reference_id ??

      resultRow.old_reference_id;

    if (newId != null) successMsg += ` New reference ID: ${newId}.`;

    if (oldId != null) successMsg += ` Superseded reference ID: ${oldId}.`;

  }



  hideBatchSizeModal();

  await loadBatchSizeReferences();

  if (savedProductId) await loadProductBatchSizeHistory(savedProductId);

  try {

    if (typeof loadLines === "function" && q("bpHeaderSel")?.value) {

      await loadLines();

    }

  } catch (e) {

    console.warn("[supply-batch-plan] line refresh after batch-size save failed", e);

  }



  if (!recalculate) {

    showAlert(successMsg);

    return;

  }



  const headerId = Number(q("bpHeaderSel")?.value);

  if (!headerId) {

    showAlert(

      `${successMsg} Product recalculation was skipped because no plan header is selected.`,

    );

    return;

  }

  try {

    const { error } = await rpcRecalcForProduct(headerId, savedProductId);

    if (error) {

      console.error("recalc_batch_plan_for_product failed", error);

      showAlert(

        "Batch-size reference saved successfully, but Product recalculation failed." +

          (error.message ? `\n${error.message}` : ""),

      );

      return;

    }

    showAlert(`${successMsg} Product recalculation completed.`);

    await loadLines();

    await loadBatches();

    await loadMapRollup();

  } catch (err) {

    console.error("recalc threw", err);

    showAlert(

      "Batch-size reference saved successfully, but Product recalculation failed.",

    );

  }

}



async function reviseBatchSizeRef(id) {

  if (!canEditBatchSizes()) {

    showAlert("Edit permission required.");

    return;

  }

  let ref = _batchSizeRegister.rows.find(

    (r) => Number(r.reference_id) === Number(id),

  );

  if (!ref) {

    showAlert("Batch size reference not found on the current page.");

    return;

  }

  if (ref.state !== "ACTIVE") {

    showAlert("Revise is only available for an active reference.");

    return;

  }

  await showBatchSizeModal("revise", ref);

}



async function openInactivateBatchSizeFlow(id) {

  if (!canEditBatchSizes()) {

    showAlert("Edit permission required.");

    return;

  }

  const ref =

    _batchSizeRegister.rows.find((r) => Number(r.reference_id) === Number(id)) ||

    _currentRevisingReference;

  if (!ref || ref.state !== "ACTIVE") {

    showAlert("Inactivate requires an active reference.");

    return;

  }



  const modal = q("batchSizeInactivateModal");

  if (modal) {

    q("inactivateBatchSizeRefId").value = String(ref.reference_id);

    q("inactivateBatchSizeProduct").textContent = getProductDisplay(ref.product_id);

    q("inactivateBatchSizeEffectiveTo").value = supplyBatchSizeTodayIsoDate();

    q("inactivateBatchSizeReason").value = "";

    modal.style.display = "flex";

    return;

  }



  // Fallback confirm path if modal markup is missing

  const reason = window.prompt("Change reason for inactivate (required):");

  if (!isMeaningfulSupplyBatchSizeChangeReason(reason)) {

    showAlert("A meaningful change reason is required.");

    return;

  }

  const confirmed = await showConfirm(

    [

      `Inactivate batch size reference ${ref.reference_id} for ${getProductDisplay(ref.product_id)}?`,

      "",

      SUPPLY_BATCH_SIZE_INACTIVATE_COPY.historyRetained,

      SUPPLY_BATCH_SIZE_INACTIVATE_COPY.noActiveUntilCreate,

      SUPPLY_BATCH_SIZE_INACTIVATE_COPY.noPlanRecalcUnlessRequested,

      SUPPLY_BATCH_SIZE_INACTIVATE_COPY.noCostingOrStage03,

    ].join("\n"),

  );

  if (!confirmed) return;

  await executeInactivateBatchSize(ref.reference_id, supplyBatchSizeTodayIsoDate(), reason);

}



function hideInactivateBatchSizeModal() {

  const modal = q("batchSizeInactivateModal");

  if (modal) modal.style.display = "none";

}



async function confirmInactivateBatchSize() {

  if (!canEditBatchSizes()) {

    showAlert("Edit permission required.");

    return;

  }

  const referenceId = Number(q("inactivateBatchSizeRefId")?.value);

  const effectiveTo = q("inactivateBatchSizeEffectiveTo")?.value;

  const reason = q("inactivateBatchSizeReason")?.value;

  if (!isMeaningfulSupplyBatchSizeChangeReason(reason)) {

    showAlert("A meaningful change reason is required.");

    return;

  }

  const confirmed = await showConfirm(

    [

      "Confirm inactivate?",

      "",

      SUPPLY_BATCH_SIZE_INACTIVATE_COPY.historyRetained,

      SUPPLY_BATCH_SIZE_INACTIVATE_COPY.noActiveUntilCreate,

      SUPPLY_BATCH_SIZE_INACTIVATE_COPY.noPlanRecalcUnlessRequested,

      SUPPLY_BATCH_SIZE_INACTIVATE_COPY.noCostingOrStage03,

    ].join("\n"),

  );

  if (!confirmed) return;

  await executeInactivateBatchSize(referenceId, effectiveTo, reason);

  hideInactivateBatchSizeModal();

  hideBatchSizeModal();

}



async function executeInactivateBatchSize(referenceId, effectiveTo, reason) {

  const built = buildInactivateSupplyBatchSizeReferenceArgs({

    reference_id: referenceId,

    effective_to: effectiveTo,

    change_reason: reason,

  });

  const res = await invokeSupplyBatchSizeRpc(

    SUPPLY_BATCH_SIZE_RPC_NAMES.inactivate,

    built,

    "Failed to inactivate batch size reference.",

  );

  if (!res.ok) {

    showAlert(res.error?.message || "Failed to inactivate.");

    return;

  }

  const row =

    _batchSizeRegister.rows.find((r) => Number(r.reference_id) === Number(referenceId)) ||

    null;

  invalidateProductBatchSizeCache(row?.product_id);

  showAlert("Batch size reference inactivated. History retained.");

  await loadBatchSizeReferences();

  if (row?.product_id) await loadProductBatchSizeHistory(row.product_id);

}



async function openBatchSizeHistoryForProduct(productId) {

  if (!canViewBatchSizes()) return;

  await loadProductBatchSizeHistory(productId);

  const modal = q("batchSizeHistoryModal");

  if (modal) {

    q("batchSizeHistoryModalTitle").textContent = `Batch size history — ${getProductDisplay(productId)}`;

    const body = q("batchSizeHistoryModalBody");

    if (body && q("batchSizeHistoryBody")) {

      body.innerHTML = q("batchSizeHistorySection")?.querySelector("table")?.outerHTML || "";

    }

    modal.style.display = "flex";

    return;

  }

  // If no secondary modal, open create/revise shell with history section

  const active = await fetchProductActiveBatchSizeReference(productId);

  if (active && canEditBatchSizes()) await showBatchSizeModal("revise", active);

  else {

    showAlert(`Loaded ${ _batchSizeHistoryRows.length } history row(s) for this Product. Open Revise on an active row to inspect in the modal.`);

  }

}



function hideBatchSizeHistoryModal() {

  const modal = q("batchSizeHistoryModal");

  if (modal) modal.style.display = "none";

}



function initializeBatchSizeManagement() {

  initializeBatchSizeSearch();

  q("addNewBatchSizeBtn")?.addEventListener("click", () =>

    showBatchSizeModal("create"),

  );

  q("refreshBatchSizesBtn")?.addEventListener("click", () =>

    loadBatchSizeReferences(),

  );

  q("batchSizeModalClose")?.addEventListener("click", hideBatchSizeModal);

  q("batchSizeCancel")?.addEventListener("click", hideBatchSizeModal);

  q("batchSizeSave")?.addEventListener("click", () =>

    saveBatchSizeRef({ recalculate: false }),

  );

  q("batchSizeSaveRecalc")?.addEventListener("click", () =>

    saveBatchSizeRef({ recalculate: true }),

  );

  q("batchSizeInactivate")?.addEventListener("click", async () => {

    if (_currentRevisingReference?.reference_id) {

      await openInactivateBatchSizeFlow(_currentRevisingReference.reference_id);

    }

  });

  q("batchSizeModal")?.addEventListener("click", (e) => {

    if (e.target.id === "batchSizeModal") hideBatchSizeModal();

  });

  q("batchSizeProductSelect")?.addEventListener("change", (e) => {

    setBatchSizeUomDisplay(e.target.value);

  });

  q("batchSizePreferred")?.addEventListener("input", validateBatchSizes);

  q("batchSizeMin")?.addEventListener("input", validateBatchSizes);

  q("batchSizeMax")?.addEventListener("input", validateBatchSizes);



  q("batchSizeInactivateCancel")?.addEventListener(

    "click",

    hideInactivateBatchSizeModal,

  );

  q("batchSizeInactivateConfirm")?.addEventListener(

    "click",

    confirmInactivateBatchSize,

  );

  q("batchSizeInactivateModalClose")?.addEventListener(

    "click",

    hideInactivateBatchSizeModal,

  );

  q("batchSizeHistoryModalClose")?.addEventListener(

    "click",

    hideBatchSizeHistoryModal,

  );

}



function validateBatchSizes() {

  const preferred = Number(q("batchSizePreferred")?.value) || 0;

  const min = Number(q("batchSizeMin")?.value) || 0;

  const max = Number(q("batchSizeMax")?.value) || 0;

  const minInput = q("batchSizeMin");

  const maxInput = q("batchSizeMax");

  if (!minInput || !maxInput) return;

  minInput.style.borderColor = "#d1d5db";

  maxInput.style.borderColor = "#d1d5db";

  if (min > 0 && preferred > 0 && min > preferred) {

    minInput.style.borderColor = "#dc2626";

    minInput.title = "Minimum cannot be greater than preferred";

  } else minInput.title = "";

  if (max > 0 && preferred > 0 && max < preferred) {

    maxInput.style.borderColor = "#dc2626";

    maxInput.title = "Maximum cannot be less than preferred";

  } else maxInput.title = "";

}



// ============================================================================

// QUICK EDIT BATCH SIZE (FOR LINES TAB)

// ============================================================================



async function openBatchSizeQuickEdit(productId, monthStart = null) {

  if (!canViewBatchSizes()) {

    showAlert("View permission required.");

    return;

  }

  _currentQuickEditProductId = productId;

  _currentQuickEditMonth = monthStart || null;

  const existingRef = await fetchProductActiveBatchSizeReference(productId);

  _quickEditActiveReference = existingRef;

  showQuickEditModal(productId, existingRef);

}



function showQuickEditModal(productId, batchSizeRef = null) {

  const modal = q("quickEditBatchSizeModal");

  const title = q("quickEditModalTitle");

  const productDisplay = q("quickEditProductDisplay");

  const form = q("quickEditBatchSizeForm");

  if (!modal || !title || !productDisplay || !form) return;



  productDisplay.textContent = getProductDisplay(productId);

  setQuickEditUomDisplay(productId);

  const branch = resolveQuickEditSupplyBatchSizeBranch(batchSizeRef);

  title.textContent =

    branch === "revise"

      ? "Revise Batch Size Reference"

      : "Add Product Batch Size Reference";



  if (batchSizeRef) {

    q("quickEditPreferred").value = batchSizeRef.preferred_batch_size ?? "";

    q("quickEditMin").value = batchSizeRef.min_batch_size ?? "";

    q("quickEditMax").value = batchSizeRef.max_batch_size ?? "";

    q("quickEditEffectiveFrom").value = supplyBatchSizeTodayIsoDate();

    q("quickEditNotes").value = "";

  } else {

    form.reset();

    if (_currentQuickEditMonth) {

      q("quickEditEffectiveFrom").value = _currentQuickEditMonth;

    } else {

      q("quickEditEffectiveFrom").value = supplyBatchSizeTodayIsoDate();

    }

  }

  const reason = q("quickEditChangeReason");

  if (reason) reason.value = "";

  applyBatchSizePermissionUi();

  modal.style.display = "flex";

}



function hideQuickEditModal() {

  const modal = q("quickEditBatchSizeModal");

  if (modal) modal.style.display = "none";

  _currentQuickEditProductId = null;

  _quickEditActiveReference = null;

}



async function saveQuickEditBatchSize({ recalculate = false } = {}) {

  if (!canEditBatchSizes()) {

    showAlert("Edit permission required.");

    return;

  }

  const form = q("quickEditBatchSizeForm");

  if (!form) return;

  if (!form.checkValidity()) {

    form.reportValidity();

    return;

  }

  if (!_currentQuickEditProductId) {

    showAlert("No product selected for editing.");

    return;

  }



  const payload = {

    product_id: _currentQuickEditProductId,

    preferred_batch_size: q("quickEditPreferred")?.value,

    min_batch_size: q("quickEditMin")?.value

      ? q("quickEditMin").value

      : null,

    max_batch_size: q("quickEditMax")?.value

      ? q("quickEditMax").value

      : null,

    effective_from: q("quickEditEffectiveFrom")?.value,

    change_reason: q("quickEditChangeReason")?.value,

    notes: q("quickEditNotes")?.value?.trim() || null,

  };



  const range = validateSupplyBatchSizeRange(payload);

  if (!range.ok) {

    showAlert(range.errors.join("\n"));

    return;

  }

  if (!isMeaningfulSupplyBatchSizeChangeReason(payload.change_reason)) {

    showAlert("A meaningful change reason is required.");

    q("quickEditChangeReason")?.focus();

    return;

  }



  // Resolve active reference from governed register before submit.

  const active = await fetchProductActiveBatchSizeReference(

    _currentQuickEditProductId,

  );

  const branch = resolveQuickEditSupplyBatchSizeBranch(active);

  let built;

  let rpcName;

  if (branch === "revise") {

    built = buildReviseSupplyBatchSizeReferenceArgs({

      reference_id: active.reference_id,

      ...payload,

    });

    rpcName = SUPPLY_BATCH_SIZE_RPC_NAMES.revise;

  } else {

    built = buildCreateSupplyBatchSizeReferenceArgs(payload);

    rpcName = SUPPLY_BATCH_SIZE_RPC_NAMES.create;

  }



  const res = await invokeSupplyBatchSizeRpc(

    rpcName,

    built,

    "Failed to save batch size reference.",

  );

  if (!res.ok) {

    showAlert(res.error?.message || "Failed to save batch size reference.");

    return;

  }



  const pid = _currentQuickEditProductId;

  hideQuickEditModal();

  invalidateProductBatchSizeCache(pid);

  await loadBatchSizeReferencesData({ product_id: pid, state: "ALL", resetOffset: true });

  try {

    if (typeof loadLines === "function" && q("bpHeaderSel")?.value) {

      await loadLines();

    }

  } catch (e) {

    console.warn("[supply-batch-plan] line refresh after quick-edit failed", e);

  }



  if (!recalculate) {

    showAlert("Batch size reference saved successfully.");

    return;

  }



  const headerId = Number(q("bpHeaderSel")?.value);

  if (!headerId) {

    showAlert(

      "Batch size reference saved successfully. Product recalculation was skipped because no plan header is selected.",

    );

    return;

  }

  try {

    const { error } = await rpcRecalcForProduct(headerId, pid);

    if (error) {

      showAlert(

        "Batch-size reference saved successfully, but Product recalculation failed." +

          (error.message ? `\n${error.message}` : ""),

      );

      return;

    }

    showAlert("Batch size saved and Product recalculation completed.");

    await loadLines();

    await loadBatches();

    await loadMapRollup();

  } catch (err) {

    console.error(err);

    showAlert(

      "Batch-size reference saved successfully, but Product recalculation failed.",

    );

  }

}



async function rebuildPlanForProduct(productId) {

  const headerId = Number(q("bpHeaderSel").value);

  if (!headerId) {

    showAlert("No plan header selected.");

    return;

  }

  try {

    const { error } = await rpcRecalcForProduct(headerId, productId);

    if (error) {

      console.error("Error rebuilding plan for product:", error);

      showAlert("Failed to rebuild plan for product: " + error.message);

      return;

    }

    showAlert(

      "Plan rebuilt successfully for " + getProductDisplay(productId) + "!",

    );

    await loadLines();

    await loadBatches();

    await loadMapRollup();

  } catch (err) {

    console.error("Failed to rebuild plan for product:", err);

    showAlert("Failed to rebuild plan for product. Please try again.");

  }

}



function initializeQuickEditBatchSize() {

  q("quickEditModalClose")?.addEventListener("click", hideQuickEditModal);

  q("quickEditCancel")?.addEventListener("click", hideQuickEditModal);

  q("quickEditSave")?.addEventListener("click", () =>

    saveQuickEditBatchSize({ recalculate: false }),

  );

  q("quickEditRebuild")?.addEventListener("click", () =>

    saveQuickEditBatchSize({ recalculate: true }),

  );

  q("quickEditBatchSizeModal")?.addEventListener("click", (e) => {

    if (e.target.id === "quickEditBatchSizeModal") hideQuickEditModal();

  });

  q("quickEditPreferred")?.addEventListener("input", validateQuickEditBatchSizes);

  q("quickEditMin")?.addEventListener("input", validateQuickEditBatchSizes);

  q("quickEditMax")?.addEventListener("input", validateQuickEditBatchSizes);

}



function validateQuickEditBatchSizes() {

  const preferred = Number(q("quickEditPreferred")?.value) || 0;

  const min = Number(q("quickEditMin")?.value) || 0;

  const max = Number(q("quickEditMax")?.value) || 0;

  const minInput = q("quickEditMin");

  const maxInput = q("quickEditMax");

  if (!minInput || !maxInput) return;

  minInput.style.borderColor = "#d1d5db";

  maxInput.style.borderColor = "#d1d5db";

  if (min > 0 && preferred > 0 && min > preferred) {

    minInput.style.borderColor = "#dc2626";

    minInput.title = "Minimum cannot be greater than preferred";

  } else minInput.title = "";

  if (max > 0 && preferred > 0 && max < preferred) {

    maxInput.style.borderColor = "#dc2626";

    maxInput.title = "Maximum cannot be less than preferred";

  } else maxInput.title = "";

}



async function applySupplyBatchPlanDeepLink() {

  const link = parseSupplyBatchPlanDeepLink(window.location.search || "");

  _pendingDeepLink = link;

  if (!link.openBatchSizesTab) return;



  // Preserve browser Back: do not replaceHistory aggressively; only ensure tab opens.

  const tabBtn = document.querySelector('[aria-controls="tab-batch-sizes"]');

  if (tabBtn) tabBtn.click();

  else if (typeof window.activateSupplyBatchPlanTab === "function") {

    window.activateSupplyBatchPlanTab("tab-batch-sizes");

  }



  if (link.product_id) {

    const filter = q("batchSizeProductIdFilter");

    if (filter) filter.value = String(link.product_id);

    const search = q("batchSizeSearchInput");

    if (search && !search.value) {

      // Prefer product_id filter; also set search to product display when useful

      search.value = String(link.product_id);

    }

  }



  await loadBatchSizeReferences({

    product_id: link.product_id,

    resetOffset: true,

  });



  if (!link.action) return;

  // No automatic mutation — open modal only when action present + permission + lifecycle OK.

  if (!canEditBatchSizes()) {

    showAlert("Edit permission required for this deep-link action.");

    return;

  }

  if (link.action === "create-batch-size") {

    const active = link.product_id

      ? await fetchProductActiveBatchSizeReference(link.product_id)

      : null;

    if (active) {

      showAlert(

        "Create action is not available because an active preferred batch-size reference already exists. Use Revise instead.",

      );

      return;

    }

    await showBatchSizeModal("create");

    if (link.product_id && q("batchSizeProductSelect")) {

      q("batchSizeProductSelect").value = String(link.product_id);

      setBatchSizeUomDisplay(link.product_id);

    }

    return;

  }

  if (link.action === "revise-batch-size") {

    if (!link.product_id) {

      showAlert("Revise deep-link requires product_id.");

      return;

    }

    const active = await fetchProductActiveBatchSizeReference(link.product_id);

    if (!active) {

      showAlert(

        "Revise action is not available because no active preferred batch-size reference exists.",

      );

      return;

    }

    await showBatchSizeModal("revise", active);

  }

}



// Expose global functions (Delete / hard-delete intentionally absent)

window.reviseBatchSizeRef = reviseBatchSizeRef;

window.openBatchSizeQuickEdit = openBatchSizeQuickEdit;

window.downloadWorklist = downloadWorklist;


// ========= DOWNLOAD WORKLIST FUNCTIONALITY =========

async function downloadWorklist(format, category, language) {
  const headerId = Number(q("bpHeaderSel").value);
  if (!headerId) return toast("Please select a header first");

  try {
    // Get header info for window dates
    const { data: header, error: headerError } = await supabase
      .from("batch_plan_headers")
      .select("id,plan_title,window_from,window_to")
      .eq("id", headerId)
      .single();

    if (headerError || !header) {
      console.error("Header fetch error:", headerError);
      return toast("Failed to fetch header information");
    }

    // Get worklist data
    const { data: worklistData, error: worklistError } = await supabase.rpc(
      "get_plan_worklist",
      { p_header_id: headerId },
    );

    if (worklistError) {
      console.error("Worklist fetch error:", worklistError);
      return toast("Failed to fetch worklist data");
    }

    if (!worklistData || worklistData.length === 0) {
      return toast("No data available for the selected plan");
    }

    const planWindow = `${header.window_from} to ${header.window_to}`;

    if (format === "csv") {
      downloadCSV(worklistData, planWindow, category, language);
    } else if (format === "pdf") {
      // Use jsPDF for guaranteed header repetition (same as wip-stock.js)
      const pdfSuccess = await generatePdfWithJsPDF(
        worklistData,
        header,
        planWindow,
        category,
        language,
      );

      if (!pdfSuccess) {
        // PDF generation failed - show error message
        toast("PDF generation failed. Please try again.");
      }
    } else {
      toast("Unsupported download format: " + format);
    }
  } catch (error) {
    console.error("Download error:", error);
    toast("Failed to download worklist");
  }
}

// eslint-disable-next-line no-unused-vars
function downloadCSV(data, planWindow, category, language) {
  // CSV contains ALL data - no category filtering
  // Note: category and language parameters kept for API compatibility but not used
  const allData = data;

  // Define CSV headers as per specification
  const headers = [
    "Product",
    "Malayalam",
    "Month",
    "BN",
    "Batch Size",
    "UOM",
    "Status",
    "Category",
    "Sub-category",
    "Group",
    "Sub-group",
  ];

  // Convert data to CSV format with proper escaping
  const csvContent = [
    headers.join(","),
    ...allData.map((row) =>
      [
        `"${(row.product || "").replace(/"/g, '""')}"`,
        `"${(row.malayalam || "").replace(/"/g, '""')}"`,
        `"${planWindow}"`, // Using plan window as "Month"
        `"${(row.bn || "").replace(/"/g, '""')}"`,
        `"${row.batch_size || ""}"`,
        `"${(row.uom || "").replace(/"/g, '""')}"`,
        `"${(row.status || "").replace(/"/g, '""')}"`,
        `"${(row.category || "").replace(/"/g, '""')}"`,
        `"${(row.sub_category || "").replace(/"/g, '""')}"`,
        `"${(row.group || "").replace(/"/g, '""')}"`,
        `"${(row.sub_group || "").replace(/"/g, '""')}"`,
      ].join(","),
    ),
  ].join("\n");

  // Create and download file
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  }); // Add BOM for Excel compatibility
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().split("T")[0];
  const fileName = `batch_plan_worklist_complete_${timestamp}.csv`;

  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  toast(`CSV downloaded: ${fileName}`);
}

// jsPDF PDF Generation - Based on working wip-stock.js pattern
async function generatePdfWithJsPDF(
  data,
  header,
  planWindow,
  category,
  language,
) {
  try {
    // Check if jsPDF is available
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error("jsPDF library not loaded");
    }

    const { jsPDF } = window.jspdf;

    // Filter data based on category
    let filteredData = data;
    if (category === "ayurveda") {
      filteredData = data.filter((row) =>
        ["Ayurveda", "Food Products", "Other Products"].includes(row.category),
      );
    } else if (category === "siddha") {
      filteredData = data.filter((row) => row.category === "Siddha");
    }

    if (filteredData.length === 0) {
      toast("No data available for the selected category");
      return false;
    }

    toast("Generating PDF with guaranteed header repetition... Please wait.");

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const leftMargin = 40;
    const rightMargin = 40;
    const tableTopY = 130;

    // Document header
    doc
      .setFont("helvetica", "normal")
      .setFontSize(10)
      .text("Gurucharanam Saranam", pw / 2, 30, { align: "center" });

    doc
      .setFont("helvetica", "bold")
      .setFontSize(12)
      .text("Santhigiri Ayurveda Siddha Vaidyasala", pw / 2, 55, {
        align: "center",
      });

    doc
      .setFont("helvetica", "bold")
      .setFontSize(14)
      .text("BATCH PLAN WORKLIST - " + category.toUpperCase(), pw / 2, 85, {
        align: "center",
      });

    doc
      .setFont("helvetica", "normal")
      .setFontSize(10)
      .text("Plan Window: " + planWindow, pw / 2, 105, { align: "center" });

    // Remove row count display as requested
    // doc
    //   .setFont("helvetica", "bold")
    //   .setFontSize(10)
    //   .text(
    //     filteredData.length + " RECORDS",
    //     pw - rightMargin,
    //     tableTopY - 12,
    //     {
    //       align: "right",
    //     }
    //   );

    // Filter data by category based on download type
    let categoryFilteredData;
    if (category === "ayurveda") {
      categoryFilteredData = filteredData.filter((row) =>
        ["Ayurveda", "Food Products", "Other Products"].includes(row.category),
      );
    } else if (category === "siddha") {
      categoryFilteredData = filteredData.filter(
        (row) => row.category === "Siddha",
      );
    } else {
      categoryFilteredData = filteredData; // fallback to all data
    }

    // 5-column layout as requested: Product, Batch Size, UOM, BN, Status
    // Headers always in English as requested
    const tableHeaders = ["Product", "Batch Size", "UOM", "BN", "Status"];

    // Generate table data with sub-headings (data already sorted by DB function)
    const tableData = [];
    let currentCategory = "";
    let currentGroup = "";

    categoryFilteredData.forEach((row) => {
      // Add category sub-heading when category changes
      if (row.category !== currentCategory) {
        currentCategory = row.category;
        currentGroup = ""; // Reset group when category changes

        // Add category header row
        tableData.push([
          {
            content: `${row.category.toUpperCase()}`,
            colSpan: 5,
            styles: {
              fillColor: [220, 220, 220],
              textColor: [0, 0, 0],
              fontStyle: "bold",
              halign: "left",
              fontSize: 10,
            },
          },
        ]);
      }

      // Add group sub-heading when group changes (if group exists)
      if (row.group && row.group !== currentGroup) {
        currentGroup = row.group;

        // Add group header row
        tableData.push([
          {
            content: `${row.group}`,
            colSpan: 5,
            styles: {
              fillColor: [240, 240, 240],
              textColor: [0, 0, 0],
              fontStyle: "bold",
              halign: "left",
              fontSize: 9,
            },
          },
        ]);
      }

      // Add regular data row
      const productName =
        language === "malayalam" && row.malayalam ? row.malayalam : row.product;

      tableData.push([
        productName || "",
        Number(row.batch_size || 0).toLocaleString(),
        row.uom || "",
        row.bn || "",
        row.status || "PLANNED",
      ]);
    });

    // Column styles for 5-column layout - Proportional widths to fill page
    const columnStyles = {
      0: { halign: "left", valign: "middle" }, // Product - left aligned, vertically centered
      1: { halign: "center", valign: "middle" }, // Batch Size - horizontally & vertically centered
      2: { halign: "center", valign: "middle" }, // UOM - horizontally & vertically centered
      3: { halign: "center", valign: "middle" }, // BN - horizontally & vertically centered
      4: { halign: "center", valign: "middle" }, // Status - horizontally & vertically centered
    };

    // Create table with autoTable - this handles header repetition automatically!
    doc.autoTable({
      startY: tableTopY,
      head: [tableHeaders],
      body: tableData,
      theme: "grid",
      tableWidth: "auto", // Fill available width like "fit to width"
      margin: { left: leftMargin, right: rightMargin, top: 40, bottom: 40 },
      rowPageBreak: "avoid",
      showHead: "everyPage", // Ensure headers repeat on every page
      styles: {
        font: "helvetica",
        fontStyle: "normal",
        fontSize: 9,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.5,
        halign: "left",
        valign: "middle",
        overflow: "linebreak",
        cellPadding: 4,
      },
      headStyles: {
        font: "helvetica",
        fontStyle: "bold",
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.5,
        halign: "center", // All headers horizontally centered (including product)
        valign: "middle", // All headers vertically centered
      },
      columnStyles: columnStyles,
      willDrawCell: (data) => {
        // Handle sub-heading rows with special formatting
        if (
          data.section === "body" &&
          data.cell.raw &&
          typeof data.cell.raw === "object" &&
          data.cell.raw.content
        ) {
          // This is a sub-heading row - apply custom styles
          doc.setFont("helvetica", data.cell.raw.styles.fontStyle || "bold");
        } else {
          // Regular rows
          doc.setFont("helvetica", data.section === "head" ? "bold" : "normal");
        }
      },
      didDrawPage: () => {
        // Add page numbers
        doc
          .setFont("helvetica", "normal")
          .setFontSize(10)
          .text(
            "Page " + doc.internal.getNumberOfPages(),
            pw - rightMargin,
            ph - 15,
            { align: "right" },
          );
      },
    });

    // Generate filename and save
    const dateStamp = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const filename =
      "BatchPlan_" + category + "_" + language + "_" + dateStamp + ".pdf";
    doc.save(filename);

    toast("PDF report generated successfully.");
    return true;
  } catch (error) {
    console.error("jsPDF generation failed:", error);
    toast("PDF generation failed: " + error.message);
    return false;
  }
}
