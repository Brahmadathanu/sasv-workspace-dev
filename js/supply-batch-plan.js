import { supabase } from "../public/shared/js/supabaseClient.js";
import { Platform } from "../public/shared/js/platform.js";

const q = (id) => document.getElementById(id);
const toast = (m) => {
  const t = q("toast");
  if (!t) return showAlert(m);
  t.textContent = m;
  t.style.display = "block";
  setTimeout(() => (t.style.display = "none"), 3000);
};

// track some local state
let _batchesCache = []; // last loadBatches() result
let _headerStatus = "draft"; // track current header status
let _productsCache = new Map(); // product_id -> product info cache

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
      `Loaded ${_productsCache.size} products into cache (${page} pages)`
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
      { once: true }
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
      { once: true }
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
            }`
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
      "id,plan_title,status,created_at,updated_at,created_by,window_from,window_to"
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
async function rpcBuildBatchPlan(headerId, fromISO, toISO) {
  return supabase.rpc("build_batch_plan", {
    p_header_id: headerId,
    p_from: fromISO,
    p_to: toISO,
  });
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
      first.getMonth() + 1
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
  toast(`Created header #${data.id}`);
  q("newHeaderTitle").value = "";
  await loadHeaders();
  q("bpHeaderSel").value = data.id;
  await onHeaderChanged();
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
    "Delete Plan"
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
    "Archive Plan"
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
          (b) => b.bmr_id === null
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
    "Rebuild All"
  );
  if (!ok) return;

  const { error } = await rpcBuildBatchPlan(
    headerId,
    hdr.window_from,
    hdr.window_to
  );
  if (error) {
    console.error(error);
    return toast("Rebuild failed");
  }
  toast("Rebuilt ✔");
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
        "product_id, residual_qty, preferred_batch_size, min_batch_size, max_batch_size"
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
        line.max_batch_size === null
    ).length;

    // 5. Products (with residuals) - products with non-zero residual
    const productsWithResiduals = lines.filter(
      (line) => line.residual_qty !== null && line.residual_qty !== 0
    ).length;

    const productsTotal = lines.length;
    const batchesMapped = mappedCount || 0;
    const batchesUnmapped = unmappedCount || 0;

    // Update plan statistics display
    q(
      "bpStatTotals"
    ).textContent = `Products (total): ${productsTotal} · Batches (mapped): ${batchesMapped} · Batches (unmapped): ${batchesUnmapped} · Products (no batch ref): ${productsNoBatchRef} · Products (with residuals): ${productsWithResiduals}`;

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
      "product_id,month_start,final_make_qty,batch_count,residual_qty,preferred_batch_size,overrides_delta,effective_total"
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
      <td>${Number(r.final_make_qty).toFixed(0)}</td>
      <td>${r.batch_count}</td>
      ${preferredBatchSizeCell}
      <td>${Number(r.residual_qty).toFixed(0)}</td>
      <td>${Number(r.overrides_delta || 0).toFixed(0)}</td>
      <td>${Number(r.effective_total || r.final_make_qty).toFixed(0)}</td>`;
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
      "batch_id,product_id,product_name,month_start,batch_no_seq,batch_size,source_rule,map_status,mapped_bn,mapped_size,bmr_id"
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
      "batch_id,product_id,month_start,batch_no_seq,batch_size,source_rule"
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
      `(${Number(r.batch_size).toFixed(0)} via ${r.source_rule})`;
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
  if (window._headerFrom) {
    query = query.gte("created_at", window._headerFrom + " 00:00:00");
  }
  if (window._headerTo) {
    query = query.lte("created_at", window._headerTo + " 23:59:59");
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
      opt.textContent = `${r.bn} · ${Number(r.batch_size).toFixed(0)} ${r.uom}`;
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

async function onUnlinkBmr(evt) {
  const batchId =
    Number(evt?.currentTarget?.dataset?.batch) ||
    Number(q("mapBatchSel").value);
  if (!batchId) return toast("Pick a batch");
  const ok = await showConfirm(
    "Unlink the mapped BMR from this planned batch?",
    "Unlink BMR"
  );
  if (!ok) return;
  const { error } = await supabase
    .from("batch_plan_batches")
    .update({ bmr_id: null, updated_at: new Date().toISOString() })
    .eq("id", batchId);
  if (error) {
    console.error(error);
    return toast("Unlink failed");
  }
  toast("Unlinked ✔");
  await loadBatches();
  await loadMapRollup();
  await loadUnmappedBatches();
}

async function onPickBmrForBatch(evt) {
  const batchId = Number(evt.currentTarget.dataset.batch);
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
    query = query.gte("created_at", window._headerFrom + " 00:00:00");
  }
  if (window._headerTo) {
    query = query.lte("created_at", window._headerTo + " 23:59:59");
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

  const sel = await showPrompt(
    "Pick BN (enter the BN):\n" + choices.join("\n")
  );
  const chosenBn = sel?.split("::")[0].trim();
  if (!chosenBn) return;

  // map using the new RPC that takes BN
  const { error: e3 } = await supabase.rpc("map_batch_to_bmr_by_bn", {
    p_batch_id: batchId,
    p_bn: chosenBn,
  });
  if (e3) {
    console.error(e3);
    return toast(e3.message || "Map failed");
  }
  toast("Mapped ✔");
  await loadBatches();
}

async function onMapByBN(evt) {
  const batchId = Number(evt.currentTarget.dataset.batch);
  const bn = await showPrompt("Enter BN to map this planned batch:");
  if (!bn) return;
  const { error } = await supabase.rpc("map_batch_to_bmr_by_bn", {
    p_batch_id: batchId,
    p_bn: bn.trim(),
  });
  if (error) {
    console.error(error);
    return toast(error.message || "Map by BN failed");
  }
  toast("Mapped by BN ✔");
  await loadBatches();
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
      })
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
      })
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
      })
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
      item.max_batch_size === null
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
      })
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
    (item) => item.residual_qty !== null && item.residual_qty !== 0
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
      })
    ),
  };
}

// -------- wire
document.addEventListener("DOMContentLoaded", () => {
  // Platform-aware HOME button
  q("homeBtn")?.addEventListener("click", () => Platform.goHome());

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
      "Rebuild Unmapped"
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
    setHeaderStatus("submitted")
  );
  q("btnReopenHeaderKebab")?.addEventListener("click", () =>
    setHeaderStatus("draft")
  );
  q("btnApplyHeaderKebab")?.addEventListener("click", () =>
    setHeaderStatus("applied")
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
        planMonthInput.value
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
        `<button class="kebab-item" onclick="window.open('add-bmr-entry.html?item=${encodeURIComponent(
          productDisplay
        )}&size=${encodeURIComponent(
          Number(r.batch_size || 0).toFixed(0)
        )}', '_blank')">Create BN</button>`,
      ];
    } else {
      // mapped or WIP
      menuItems = [
        `<button class="kebab-item" onclick="window.location.href='view-bmr-entry.html?item=${encodeURIComponent(
          productDisplay
        )}&bn=${encodeURIComponent(r.mapped_bn || "")}'">View BMR</button>`,
        `<button class="kebab-item" data-batch="${
          r.batch_id
        }" onclick="onUnlinkBmr(event)" ${
          isWip ? 'disabled title="Cannot unlink WIP"' : ""
        }>Unlink</button>`,
      ];
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
              r.batch_size
            )}"
             data-pid="${r.product_id}" data-ms="${r.month_start}"
             data-seq="${
               r.batch_no_seq
             }" class="bpEditSize" style="width:100px" />`
          : Number(r.batch_size).toFixed(0)
      }</td>
      <td>${getProductUom(r.product_id) || ""}</td>
      <td>${r.source_rule || ""}</td>
      <td>${r.map_status === "UNMAPPED" ? "Unmapped" : "Mapped"}</td>
      <td>${r.mapped_bn || ""}</td>
      <td>${actionHtml}</td>`;
    tbody.appendChild(tr);
  });

  // Wire inline editors
  tbody.querySelectorAll(".bpEditSize").forEach((inp) => {
    inp.addEventListener("change", onEditBatchSize);
  });
}

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
      b.batch_no_seq === batch_no_seq
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
      b.batch_no_seq === batch_no_seq
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
      }
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
  opType
) {
  const ok = await showConfirm(
    `Deactivate ${opType} override for BN ${bn}?`,
    "Deactivate Override"
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
      }
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
window.onUnlinkBmr = onUnlinkBmr; // exposed for inline Unlink buttons

// --- Enhanced tab switcher with status indicators ---
(function initTabs() {
  const workflowTabs = Array.from(
    document.querySelectorAll('.tabs [role="tab"]')
  );
  const configTabs = Array.from(
    document.querySelectorAll('.config-tabs [role="tab"]')
  );
  const allTabs = [...workflowTabs, ...configTabs];
  const panels = Array.from(document.querySelectorAll(".tabpanel"));
  const key = "supply-batch-plan.activeTab";

  function activate(id) {
    // Update aria-selected for all tabs
    allTabs.forEach((btn) =>
      btn.setAttribute(
        "aria-selected",
        btn.getAttribute("aria-controls") === id ? "true" : "false"
      )
    );

    // Update panel visibility
    panels.forEach((p) => p.classList.toggle("active", p.id === id));
    localStorage.setItem(key, id);

    // Only update workflow status indicators for workflow tabs
    const isWorkflowTab = workflowTabs.some(
      (tab) => tab.getAttribute("aria-controls") === id
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

  allTabs.forEach((btn) => {
    btn.addEventListener("click", () =>
      activate(btn.getAttribute("aria-controls"))
    );
  });

  const saved = localStorage.getItem(key);
  if (saved && document.getElementById(saved)) activate(saved);
  else activate("tab-build"); // Start with Build tab

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
      (line) => line.residual_qty !== null && line.residual_qty !== 0
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
        (b) => b.mismatch_text && b.mismatch_text.trim() !== ""
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
    `${checks.details.unmappedCount || 0} batches unmapped`
  );

  updateCheckItem(
    "checkResidualLow",
    checks.residualLow,
    `Total residual: ${(checks.details.totalResidual || 0).toLocaleString()}`
  );

  updateCheckItem(
    "checkNoMismatches",
    checks.noMismatches,
    `${checks.details.mismatchCount || 0} size mismatches found`
  );

  updateCheckItem(
    "checkNoWipConflicts",
    checks.noWipConflicts,
    `${checks.details.wipConflictCount || 0} WIP conflicts found`
  );

  updateCheckItem(
    "checkOverridesApplied",
    checks.overridesApplied,
    `${checks.details.stagingOverrides || 0} pending overrides`
  );

  updateCheckItem(
    "checkUniqueMonth",
    checks.uniqueMonth,
    `${checks.details.conflictingHeaders || 0} conflicting active plans`
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
    btnUnlinkBmr: "Unlink a mapped BMR from this planned batch (if allowed).",
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
// BATCH SIZE REFERENCE MANAGEMENT
// ============================================================================

let _batchSizeRefsCache = [];
let _currentEditingBatchSizeId = null;

// Load batch size reference data (without UI updates)
async function loadBatchSizeReferencesData() {
  try {
    const { data, error } = await supabase
      .from("production_batch_size_ref")
      .select("*")
      .order("product_id")
      .order("effective_from", { ascending: false });

    if (error) {
      console.error("Error loading batch size references data:", error);
      return;
    }

    _batchSizeRefsCache = data || [];
  } catch (err) {
    console.error("Failed to load batch size references data:", err);
  }
}

// Load batch size references
async function loadBatchSizeReferences() {
  const tbody = q("batchSizeRefsBody");
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #666;">Loading batch size references...</td></tr>';

  // Ensure products cache is loaded
  await loadProductsCache();

  // Load batch size reference data
  await loadBatchSizeReferencesData();

  // Render the UI
  renderBatchSizeReferences();
}

// Render batch size references table
function renderBatchSizeReferences() {
  const tbody = q("batchSizeRefsBody");
  if (!tbody) return;

  const searchTerm =
    q("batchSizeSearchInput")?.value?.toLowerCase().trim() || "";

  if (_batchSizeRefsCache.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #666;">No batch size references found. Click "Add New Product" to create one.</td></tr>';
    return;
  }

  let filteredRefs = _batchSizeRefsCache;

  // Apply text search filter
  if (searchTerm) {
    filteredRefs = filteredRefs.filter((ref) => {
      const productDisplay = getProductDisplay(ref.product_id).toLowerCase();
      return productDisplay.includes(searchTerm);
    });
  }

  // Apply boolean presence filters from the Controls card
  const preferredMode = q("batchSizeFilterPreferredMode")?.value || "any";
  const minMode = q("batchSizeFilterMinMode")?.value || "any";
  const maxMode = q("batchSizeFilterMaxMode")?.value || "any";

  if (preferredMode !== "any" || minMode !== "any" || maxMode !== "any") {
    filteredRefs = filteredRefs.filter((ref) => {
      // presence checks (treat null/undefined/"" as not set)
      const hasPreferred =
        ref.preferred_batch_size != null && ref.preferred_batch_size !== "";
      const hasMin = ref.min_batch_size != null && ref.min_batch_size !== "";
      const hasMax = ref.max_batch_size != null && ref.max_batch_size !== "";

      if (preferredMode === "set" && !hasPreferred) return false;
      if (preferredMode === "notset" && hasPreferred) return false;

      if (minMode === "set" && !hasMin) return false;
      if (minMode === "notset" && hasMin) return false;

      if (maxMode === "set" && !hasMax) return false;
      if (maxMode === "notset" && hasMax) return false;

      return true;
    });
  }

  if (filteredRefs.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #666;">No matching products found.</td></tr>';
    return;
  }

  tbody.innerHTML = filteredRefs
    .map((ref) => {
      const statusBadge = ref.is_active
        ? '<span style="background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-size: 11px;">ACTIVE</span>'
        : '<span style="background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-size: 11px;">INACTIVE</span>';

      const effectiveDate = new Date(ref.effective_from).toLocaleDateString();

      return `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${getProductDisplay(
          ref.product_id
        )}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${Number(
          ref.preferred_batch_size
        ).toLocaleString()}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${
          ref.min_batch_size ? Number(ref.min_batch_size).toLocaleString() : "-"
        }</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${
          ref.max_batch_size ? Number(ref.max_batch_size).toLocaleString() : "-"
        }</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${effectiveDate}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${statusBadge}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${
          ref.notes || ""
        }">${ref.notes || "-"}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          <button class="btn" style="padding: 4px 8px; margin-right: 4px; font-size: 12px;" onclick="editBatchSizeRef(${
            ref.id
          })">Edit</button>
          <button class="btn" style="padding: 4px 8px; font-size: 12px; background: #fef2f2; color: #dc2626; border-color: #fecaca;" onclick="deleteBatchSizeRef(${
            ref.id
          })">Delete</button>
        </td>
      </tr>
    `;
    })
    .join("");
}

// Initialize batch size search
function initializeBatchSizeSearch() {
  const searchInput = q("batchSizeSearchInput");
  const clearBtn = q("clearBatchSizeSearchBtn");

  if (!searchInput || !clearBtn) return;

  searchInput.addEventListener("input", () => {
    renderBatchSizeReferences();
    clearBtn.style.display = searchInput.value.trim() ? "inline-block" : "none";
  });

  searchInput.addEventListener("keyup", (e) => {
    if (e.key === "Escape") {
      searchInput.value = "";
      renderBatchSizeReferences();
      clearBtn.style.display = "none";
    }
  });

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    renderBatchSizeReferences();
    clearBtn.style.display = "none";
  });

  // Wire boolean filter selects to re-render on change
  const prefSel = q("batchSizeFilterPreferredMode");
  const minSel = q("batchSizeFilterMinMode");
  const maxSel = q("batchSizeFilterMaxMode");

  [prefSel, minSel, maxSel].forEach((sel) => {
    if (!sel) return;
    sel.addEventListener("change", () => {
      renderBatchSizeReferences();
    });
  });
}

// Load products for batch size modal
async function loadProductsForBatchSize() {
  const select = q("batchSizeProductSelect");
  if (!select) return;

  // Ensure products cache is loaded
  await loadProductsCache();

  // Clear existing options except the first one
  select.innerHTML = '<option value="">Select a product...</option>';

  // Get products that already have batch size references
  const existingProductIds = new Set(
    _batchSizeRefsCache
      .filter((ref) => ref.is_active) // Only consider active references
      .map((ref) => ref.product_id)
  );

  // Convert cache to array, filter out products with existing batch size refs, and sort
  const availableProducts = Array.from(_productsCache.values())
    .filter((p) => p.status === "Active" && !existingProductIds.has(p.id))
    .sort((a, b) => a.item.localeCompare(b.item));

  if (availableProducts.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent =
      "No products available (all active products already have batch size references)";
    option.disabled = true;
    select.appendChild(option);
    return;
  }

  availableProducts.forEach((product) => {
    const option = document.createElement("option");
    option.value = product.id;
    option.textContent = getProductDisplay(product.id);
    select.appendChild(option);
  });
}

// Load all products for editing (including the currently selected one)
async function loadAllProductsForEdit() {
  const select = q("batchSizeProductSelect");
  if (!select) return;

  // Ensure products cache is loaded
  await loadProductsCache();

  // Clear existing options
  select.innerHTML = "";

  // Convert cache to array and sort
  const allProducts = Array.from(_productsCache.values())
    .filter((p) => p.status === "Active")
    .sort((a, b) => a.item.localeCompare(b.item));

  allProducts.forEach((product) => {
    const option = document.createElement("option");
    option.value = product.id;
    option.textContent = getProductDisplay(product.id);
    select.appendChild(option);
  });
}

// Show batch size modal
async function showBatchSizeModal(batchSizeRef = null) {
  const modal = q("batchSizeModal");
  const title = q("batchSizeModalTitle");
  const form = q("batchSizeForm");

  if (!modal || !title || !form) return;

  // Ensure batch size references are loaded first (needed for filtering available products)
  if (_batchSizeRefsCache.length === 0) {
    await loadBatchSizeReferencesData();
  }

  // Set title and current editing ID
  if (batchSizeRef) {
    title.textContent = "Edit Product Batch Size Reference";
    _currentEditingBatchSizeId = batchSizeRef.id;

    // For editing, load all products and allow the current product to be selected
    await loadAllProductsForEdit();

    // Populate form
    q("batchSizeProductSelect").value = batchSizeRef.product_id;
    q("batchSizePreferred").value = batchSizeRef.preferred_batch_size;
    q("batchSizeMin").value = batchSizeRef.min_batch_size || "";
    q("batchSizeMax").value = batchSizeRef.max_batch_size || "";
    q("batchSizeEffectiveFrom").value = batchSizeRef.effective_from;
    q("batchSizeIsActive").checked = batchSizeRef.is_active;
    q("batchSizeNotes").value = batchSizeRef.notes || "";

    // Disable product selection when editing
    q("batchSizeProductSelect").disabled = true;
  } else {
    title.textContent = "Add Product Batch Size Reference";
    _currentEditingBatchSizeId = null;

    // For adding, load only available products
    await loadProductsForBatchSize();

    // Reset form
    form.reset();
    q("batchSizeIsActive").checked = true;
    q("batchSizeEffectiveFrom").value = new Date().toISOString().split("T")[0];

    // Enable product selection when adding
    q("batchSizeProductSelect").disabled = false;
  }

  modal.style.display = "flex";
}

// Hide batch size modal
function hideBatchSizeModal() {
  const modal = q("batchSizeModal");
  if (modal) {
    modal.style.display = "none";
    _currentEditingBatchSizeId = null;
  }
}

// Save batch size reference
async function saveBatchSizeRef() {
  const form = q("batchSizeForm");
  if (!form) return;

  // Validate form
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const formData = {
    product_id: Number(q("batchSizeProductSelect").value),
    preferred_batch_size: Number(q("batchSizePreferred").value),
    min_batch_size: q("batchSizeMin").value
      ? Number(q("batchSizeMin").value)
      : null,
    max_batch_size: q("batchSizeMax").value
      ? Number(q("batchSizeMax").value)
      : null,
    effective_from: q("batchSizeEffectiveFrom").value,
    is_active: q("batchSizeIsActive").checked,
    notes: q("batchSizeNotes").value.trim() || null,
  };

  // Validate min <= preferred <= max
  if (
    formData.min_batch_size &&
    formData.min_batch_size > formData.preferred_batch_size
  ) {
    showAlert(
      "Minimum batch size cannot be greater than preferred batch size."
    );
    return;
  }

  if (
    formData.max_batch_size &&
    formData.max_batch_size < formData.preferred_batch_size
  ) {
    showAlert("Maximum batch size cannot be less than preferred batch size.");
    return;
  }

  try {
    let result;

    if (_currentEditingBatchSizeId) {
      // Update existing
      result = await supabase
        .from("production_batch_size_ref")
        .update(formData)
        .eq("id", _currentEditingBatchSizeId);
    } else {
      // Insert new
      result = await supabase
        .from("production_batch_size_ref")
        .insert(formData);
    }

    if (result.error) {
      console.error("Error saving batch size reference:", result.error);

      if (result.error.code === "23505") {
        showAlert(
          "This product already has an active batch size reference. Please deactivate the existing one first or edit it instead."
        );
      } else {
        showAlert(
          "Failed to save batch size reference: " + result.error.message
        );
      }
      return;
    }

    showAlert(
      _currentEditingBatchSizeId
        ? "Batch size reference updated successfully!"
        : "Batch size reference added successfully!"
    );
    hideBatchSizeModal();
    await loadBatchSizeReferences();
  } catch (err) {
    console.error("Failed to save batch size reference:", err);
    showAlert("Failed to save batch size reference. Please try again.");
  }
}

// Edit batch size reference
async function editBatchSizeRef(id) {
  const ref = _batchSizeRefsCache.find((r) => r.id === id);
  if (!ref) {
    showAlert("Batch size reference not found.");
    return;
  }

  await showBatchSizeModal(ref);
}

// Delete batch size reference
async function deleteBatchSizeRef(id) {
  const ref = _batchSizeRefsCache.find((r) => r.id === id);
  if (!ref) {
    showAlert("Batch size reference not found.");
    return;
  }

  const productDisplay = getProductDisplay(ref.product_id);
  const confirmed = await showConfirm(
    `Delete batch size reference for ${productDisplay}?\n\nThis action cannot be undone.`
  );

  if (!confirmed) return;

  try {
    const { error } = await supabase
      .from("production_batch_size_ref")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting batch size reference:", error);
      showAlert("Failed to delete batch size reference: " + error.message);
      return;
    }

    showAlert("Batch size reference deleted successfully!");
    await loadBatchSizeReferences();
  } catch (err) {
    console.error("Failed to delete batch size reference:", err);
    showAlert("Failed to delete batch size reference. Please try again.");
  }
}

// Initialize batch size management
function initializeBatchSizeManagement() {
  // Search functionality
  initializeBatchSizeSearch();

  // Control buttons
  q("addNewBatchSizeBtn")?.addEventListener("click", () =>
    showBatchSizeModal()
  );
  q("refreshBatchSizesBtn")?.addEventListener("click", loadBatchSizeReferences);

  // Modal controls
  q("batchSizeModalClose")?.addEventListener("click", hideBatchSizeModal);
  q("batchSizeCancel")?.addEventListener("click", hideBatchSizeModal);
  q("batchSizeSave")?.addEventListener("click", saveBatchSizeRef);

  // Close modal on outside click
  q("batchSizeModal")?.addEventListener("click", (e) => {
    if (e.target.id === "batchSizeModal") {
      hideBatchSizeModal();
    }
  });

  // Form validation
  q("batchSizePreferred")?.addEventListener("input", validateBatchSizes);
  q("batchSizeMin")?.addEventListener("input", validateBatchSizes);
  q("batchSizeMax")?.addEventListener("input", validateBatchSizes);
}

// Validate batch size relationships
function validateBatchSizes() {
  const preferred = Number(q("batchSizePreferred").value) || 0;
  const min = Number(q("batchSizeMin").value) || 0;
  const max = Number(q("batchSizeMax").value) || 0;

  const minInput = q("batchSizeMin");
  const maxInput = q("batchSizeMax");

  // Reset styles
  minInput.style.borderColor = "#d1d5db";
  maxInput.style.borderColor = "#d1d5db";

  // Validate min vs preferred
  if (min > 0 && preferred > 0 && min > preferred) {
    minInput.style.borderColor = "#dc2626";
    minInput.title = "Minimum cannot be greater than preferred";
  } else {
    minInput.title = "";
  }

  // Validate max vs preferred
  if (max > 0 && preferred > 0 && max < preferred) {
    maxInput.style.borderColor = "#dc2626";
    maxInput.title = "Maximum cannot be less than preferred";
  } else {
    maxInput.title = "";
  }
}

// ============================================================================
// QUICK EDIT BATCH SIZE (FOR LINES TAB)
// ============================================================================

let _currentQuickEditProductId = null;
let _currentQuickEditMonth = null; // YYYY-MM-DD string representing the month_start user clicked

// Open quick edit modal for batch size from Lines tab
async function openBatchSizeQuickEdit(productId, monthStart = null) {
  _currentQuickEditProductId = productId;
  _currentQuickEditMonth = monthStart || null;

  // Ensure batch size references are loaded
  if (_batchSizeRefsCache.length === 0) {
    await loadBatchSizeReferencesData();
  }

  // Find the active batch size ref that is applicable for the given month
  // i.e., the ref with is_active = true and effective_from <= monthStart,
  // choosing the one with the latest effective_from.
  let existingRef = null;
  if (monthStart) {
    const candidates = _batchSizeRefsCache
      .filter((ref) => ref.product_id === productId && ref.is_active)
      .filter((ref) => ref.effective_from <= monthStart)
      .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1));
    if (candidates.length) existingRef = candidates[0];
  }

  // Fallback: if no applicable by month, pick any active ref for the product
  if (!existingRef) {
    existingRef = _batchSizeRefsCache.find(
      (ref) => ref.product_id === productId && ref.is_active
    );
  }

  // Show modal and populate data
  showQuickEditModal(productId, existingRef);
}

// Show the quick edit modal
function showQuickEditModal(productId, batchSizeRef = null) {
  const modal = q("quickEditBatchSizeModal");
  const title = q("quickEditModalTitle");
  const productDisplay = q("quickEditProductDisplay");
  const form = q("quickEditBatchSizeForm");

  if (!modal || !title || !productDisplay || !form) return;

  // Set product display
  productDisplay.textContent = getProductDisplay(productId);

  // Set title
  title.textContent = batchSizeRef ? "Edit Batch Size" : "Set Batch Size";

  if (batchSizeRef) {
    // Populate existing data
    q("quickEditPreferred").value = batchSizeRef.preferred_batch_size;
    q("quickEditMin").value = batchSizeRef.min_batch_size || "";
    q("quickEditMax").value = batchSizeRef.max_batch_size || "";
    q("quickEditEffectiveFrom").value = batchSizeRef.effective_from;
    q("quickEditIsActive").checked = batchSizeRef.is_active;
    q("quickEditNotes").value = batchSizeRef.notes || "";
  } else {
    // Reset form for new entry
    form.reset();
    q("quickEditIsActive").checked = true;
    // If the user clicked a specific month, default effective_from to that month
    if (_currentQuickEditMonth) {
      q("quickEditEffectiveFrom").value = _currentQuickEditMonth;
    } else {
      q("quickEditEffectiveFrom").value = new Date()
        .toISOString()
        .split("T")[0];
    }
  }

  modal.style.display = "flex";
}

// Hide quick edit modal
function hideQuickEditModal() {
  const modal = q("quickEditBatchSizeModal");
  if (modal) {
    modal.style.display = "none";
    _currentQuickEditProductId = null;
  }
}

// Save batch size and rebuild plan for specific product
async function saveAndRebuildBatchSize() {
  const form = q("quickEditBatchSizeForm");
  if (!form) return;

  // Validate form
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  if (!_currentQuickEditProductId) {
    showAlert("No product selected for editing.");
    return;
  }

  const formData = {
    product_id: _currentQuickEditProductId,
    preferred_batch_size: Number(q("quickEditPreferred").value),
    min_batch_size: q("quickEditMin").value
      ? Number(q("quickEditMin").value)
      : null,
    max_batch_size: q("quickEditMax").value
      ? Number(q("quickEditMax").value)
      : null,
    effective_from: q("quickEditEffectiveFrom").value,
    is_active: q("quickEditIsActive").checked,
    notes: q("quickEditNotes").value.trim() || null,
  };

  // Validate min <= preferred <= max
  if (
    formData.min_batch_size &&
    formData.min_batch_size > formData.preferred_batch_size
  ) {
    showAlert(
      "Minimum batch size cannot be greater than preferred batch size."
    );
    return;
  }

  if (
    formData.max_batch_size &&
    formData.max_batch_size < formData.preferred_batch_size
  ) {
    showAlert("Maximum batch size cannot be less than preferred batch size.");
    return;
  }

  try {
    // Find existing record that would be effective for this effective_from date
    // i.e., same product_id, is_active = true and effective_from = formData.effective_from
    const existingRef = _batchSizeRefsCache.find(
      (ref) =>
        ref.product_id === _currentQuickEditProductId &&
        ref.is_active &&
        ref.effective_from === formData.effective_from
    );

    let result;

    if (existingRef) {
      // Update the exact existing record for that effective_from
      result = await supabase
        .from("production_batch_size_ref")
        .update(formData)
        .eq("id", existingRef.id);
    } else {
      // Insert new record
      result = await supabase
        .from("production_batch_size_ref")
        .insert(formData);
    }

    if (result.error) {
      console.error("Error saving batch size reference:", result.error);

      if (result.error.code === "23505") {
        // If there's already an active batch size reference we want to surface
        // the alert immediately and ensure the quick-edit modal is closed so
        // it doesn't stay on top of the alert.
        hideQuickEditModal();
        showAlert(
          "This product already has an active batch size reference. Please deactivate the existing one first."
        );
      } else {
        showAlert(
          "Failed to save batch size reference: " + result.error.message
        );
      }
      return;
    }

    // Capture product id now (hideQuickEditModal resets _currentQuickEditProductId)
    const pid = _currentQuickEditProductId;

    // Close modal
    hideQuickEditModal();

    // Show success message
    showAlert(
      "Batch size updated successfully! Rebuilding plan for this product..."
    );

    // Refresh batch size references cache so the rebuild sees the new values
    await loadBatchSizeReferencesData();

    // Rebuild plan for this specific product (use captured id)
    await rebuildPlanForProduct(pid);
  } catch (err) {
    console.error("Failed to save batch size reference:", err);
    showAlert("Failed to save batch size reference. Please try again.");
  }
}

// Rebuild plan for specific product (similar to Rebuild Selected but for one product)
async function rebuildPlanForProduct(productId) {
  const headerId = Number(q("bpHeaderSel").value);
  if (!headerId) {
    showAlert("No plan header selected.");
    return;
  }

  try {
    // Use the existing recalc function for specific product
    const { error } = await rpcRecalcForProduct(headerId, productId);

    if (error) {
      console.error("Error rebuilding plan for product:", error);
      showAlert("Failed to rebuild plan for product: " + error.message);
      return;
    }

    showAlert(
      "Plan rebuilt successfully for " + getProductDisplay(productId) + "!"
    );

    // Refresh all tabs to show updated data
    await loadLines();
    await loadBatches();
    await loadMapRollup();
  } catch (err) {
    console.error("Failed to rebuild plan for product:", err);
    showAlert("Failed to rebuild plan for product. Please try again.");
  }
}

// Initialize quick edit functionality
function initializeQuickEditBatchSize() {
  // Modal controls
  q("quickEditModalClose")?.addEventListener("click", hideQuickEditModal);
  q("quickEditCancel")?.addEventListener("click", hideQuickEditModal);
  q("quickEditRebuild")?.addEventListener("click", saveAndRebuildBatchSize);

  // Close modal on outside click
  q("quickEditBatchSizeModal")?.addEventListener("click", (e) => {
    if (e.target.id === "quickEditBatchSizeModal") {
      hideQuickEditModal();
    }
  });

  // Form validation
  q("quickEditPreferred")?.addEventListener(
    "input",
    validateQuickEditBatchSizes
  );
  q("quickEditMin")?.addEventListener("input", validateQuickEditBatchSizes);
  q("quickEditMax")?.addEventListener("input", validateQuickEditBatchSizes);
}

// Validate batch size relationships in quick edit
function validateQuickEditBatchSizes() {
  const preferred = Number(q("quickEditPreferred").value) || 0;
  const min = Number(q("quickEditMin").value) || 0;
  const max = Number(q("quickEditMax").value) || 0;

  const minInput = q("quickEditMin");
  const maxInput = q("quickEditMax");

  // Reset styles
  minInput.style.borderColor = "#d1d5db";
  maxInput.style.borderColor = "#d1d5db";

  // Validate min vs preferred
  if (min > 0 && preferred > 0 && min > preferred) {
    minInput.style.borderColor = "#dc2626";
    minInput.title = "Minimum cannot be greater than preferred";
  } else {
    minInput.title = "";
  }

  // Validate max vs preferred
  if (max > 0 && preferred > 0 && max < preferred) {
    maxInput.style.borderColor = "#dc2626";
    maxInput.title = "Maximum cannot be less than preferred";
  } else {
    maxInput.title = "";
  }
}

// Expose global functions
window.editBatchSizeRef = editBatchSizeRef;
window.deleteBatchSizeRef = deleteBatchSizeRef;
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
      { p_header_id: headerId }
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
        language
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
      ].join(",")
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
  language
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
        ["Ayurveda", "Food Products", "Other Products"].includes(row.category)
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
        ["Ayurveda", "Food Products", "Other Products"].includes(row.category)
      );
    } else if (category === "siddha") {
      categoryFilteredData = filteredData.filter(
        (row) => row.category === "Siddha"
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
            { align: "right" }
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
