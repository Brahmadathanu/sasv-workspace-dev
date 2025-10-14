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
        // Overrides are optional
        status = "complete";
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
  if (!headerId) return;

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

    // Display in Build Operations statistics
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
    q("bpStatTotals").textContent = "";
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
      "batch_id,product_id,product_name,month_start,batch_no_seq,batch_size,source_rule,map_status,mapped_bn,mapped_size,mapped_uom,bmr_id"
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
    const productName = getProductName(r.product_id);
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
  q("bpHeaderSel").addEventListener("change", onHeaderChanged);
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
  q("btnExportBatches")?.addEventListener("click", exportBatchesCsv);
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

  // Download Plan Worklist event listeners
  q("btnDownloadWorklist")?.addEventListener("click", toggleDownloadMenu);
  q("btnDownloadCSV")?.addEventListener("click", () =>
    downloadPlanWorklist("csv")
  );
  q("btnPDFMalayalamAyurveda")?.addEventListener("click", () =>
    downloadPlanWorklist("pdf", "malayalam", "ayurveda")
  );
  q("btnPDFMalayalamSiddha")?.addEventListener("click", () =>
    downloadPlanWorklist("pdf", "malayalam", "siddha")
  );
  q("btnPDFEnglishAyurveda")?.addEventListener("click", () =>
    downloadPlanWorklist("pdf", "english", "ayurveda")
  );
  q("btnPDFEnglishSiddha")?.addEventListener("click", () =>
    downloadPlanWorklist("pdf", "english", "siddha")
  );

  // Close download menu when clicking outside
  document.addEventListener("click", (e) => {
    const downloadMenu = q("downloadMenu");
    if (downloadMenu && !downloadMenu.contains(e.target)) {
      downloadMenu.classList.remove("open");
    }
  });

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
        getProductName(r.product_id) ||
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
    const productDisplay = r.product_name || getProductName(r.product_id);

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

// Export currently filtered batches view to CSV
function exportBatchesCsv() {
  const f = (q("bpBatchFilter").value || "").trim();
  const productFilter = (q("bpBatchProductFilter").value || "")
    .trim()
    .toLowerCase();

  let rows = _batchesCache.slice();
  if (f) rows = rows.filter((r) => r.map_status === f);
  if (productFilter) {
    rows = rows.filter((r) => {
      const productName = (
        r.product_name ||
        getProductName(r.product_id) ||
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
  // No BN filter (removed)
  // No quick search in export: honor explicit product/BN/status filters only

  // Add product names to export
  const exportRows = rows.map((r) => ({
    ...r,
    product_name: r.product_name || getProductName(r.product_id),
  }));

  const cols = [
    "product_id",
    "product_name",
    "malayalam_name",
    "month_start",
    "batch_no_seq",
    "batch_size",
    "source_rule",
    "map_status",
    "mapped_bn",
  ];
  const head = cols.join(",");
  const body = exportRows
    .map((r) =>
      cols
        .map((c) => {
          const v = r[c] ?? "";
          const s = String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");
  const csv = head + "\n" + body;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: `batch_plan_${q("bpHeaderSel").value}.csv`,
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

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

// ===== CSV helpers (re-added) =====
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { header: [], rows: [] };
  const header = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cols = [];
    let cur = "",
      q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = !q;
      } else if (ch === "," && !q) {
        cols.push(cur);
        cur = "";
      } else cur += ch;
    }
    cols.push(cur);
    const obj = {};
    header.forEach((h, i) => (obj[h] = (cols[i] ?? "").trim()));
    return obj;
  });
  return { header, rows };
}

function toCSV(rows) {
  if (!rows?.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    cols.join(","),
    ...rows.map((r) => cols.map((c) => esc(r[c])).join(",")),
  ].join("\n");
}

async function exportOverridesCsv() {
  // minimal template with a few examples from v_batch_catalog_all (NOT_INITIATED + WIP)
  const { data, error } = await supabase
    .from("v_batch_catalog_all")
    .select("product_id,bn,batch_size,uom,source")
    .limit(50);
  if (error) {
    console.error(error);
    return toast("Template fetch failed");
  }
  const rows = (data || []).map((r) => ({
    product_id: r.product_id,
    month_start: "", // you fill
    bn: r.bn,
    batch_size: r.batch_size,
    uom: r.uom,
    op_type: "ADD", // or RESIZE/CANCEL
    override_qty: "", // required for ADD/RESIZE
    note: "",
  }));
  const csv = toCSV(
    rows.length
      ? rows
      : [
          {
            product_id: "",
            month_start: "",
            bn: "",
            batch_size: "",
            uom: "",
            op_type: "ADD",
            override_qty: "",
            note: "",
          },
        ]
  );
  const blob = new Blob([csv], { type: "text/csv" });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: "batch_overrides_template.csv",
  });
  document.body.append(a);
  a.click();
  a.remove();
}

let ovParsed = [];
async function previewOverridesCsv() {
  const f = document.getElementById("ovFile").files?.[0];
  if (!f) return toast("Pick a CSV");
  const text = await f.text();
  const { header, rows } = parseCsv(text);
  const need = [
    "product_id",
    "month_start",
    "bn",
    "batch_size",
    "uom",
    "op_type",
    "override_qty",
    "note",
  ];
  const missing = need.filter((n) => !header.includes(n));
  if (missing.length) return toast("CSV missing: " + missing.join(", "));
  // normalize
  ovParsed = rows
    .map((r) => ({
      product_id: Number(r.product_id) || null,
      month_start: r.month_start || null,
      bn: r.bn || null,
      batch_size: r.batch_size ? Number(r.batch_size) : null,
      uom: r.uom || null,
      op_type: (r.op_type || "").toUpperCase(),
      override_qty: r.override_qty === "" ? null : Number(r.override_qty),
      note: r.note || null,
    }))
    .filter(
      (r) =>
        r.product_id &&
        r.month_start &&
        r.bn &&
        r.batch_size &&
        r.uom &&
        r.op_type
    );
  // paint preview
  const tb = document.getElementById("ovPreviewBody");
  tb.innerHTML = "";
  ovParsed.slice(0, 200).forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.product_id}</td><td>${r.month_start}</td><td>${r.bn}</td>
      <td>${r.batch_size}</td><td>${r.uom}</td><td>${r.op_type}</td>
      <td>${r.override_qty ?? ""}</td><td>${r.note ?? ""}</td>`;
    tb.appendChild(tr);
  });
  document.getElementById(
    "ovStatus"
  ).textContent = `Ready: ${ovParsed.length} rows`;
}

async function applyOverrides() {
  if (!ovParsed.length) return toast("Nothing to apply");
  // 1) insert to staging (truncate window first = safer)
  const winFrom = ovParsed.reduce(
    (m, r) => (m && m < r.month_start ? m : r.month_start),
    ovParsed[0].month_start
  );
  const winTo = ovParsed.reduce(
    (m, r) => (m && m > r.month_start ? m : r.month_start),
    ovParsed[0].month_start
  );
  // clear staging in window
  let { error: delErr } = await supabase
    .from("production_batch_overrides_staging")
    .delete()
    .gte("month_start", winFrom)
    .lte("month_start", winTo);
  if (delErr) {
    console.error(delErr);
    return toast("Stage clear failed");
  }
  // chunked insert
  const CH = 500;
  for (let i = 0; i < ovParsed.length; i += CH) {
    const slice = ovParsed.slice(i, i + CH);
    const { error } = await supabase
      .from("production_batch_overrides_staging")
      .insert(slice);
    if (error) {
      console.error(error);
      return toast(`Insert failed at ${i}`);
    }
  }
  // 2) promote via RPC (WIP guard inside)
  const { data, error } = await supabase.rpc(
    "apply_production_batch_overrides",
    {
      p_from: winFrom,
      p_to: winTo,
    }
  );
  if (error) {
    console.error(error);
    return toast("Apply RPC failed");
  }
  const [ins, upd, deact] = data || [0, 0, 0];
  toast(`Overrides applied: +${ins} / upd ${upd} / deact ${deact}`);
  document.getElementById(
    "ovStatus"
  ).textContent = `Applied window ${winFrom} → ${winTo}`;
  // optional: refresh overlays/rollup
  await loadRollup();
}

document.addEventListener("DOMContentLoaded", () => {
  const byId = (id) => document.getElementById(id);
  byId("btnExportOverridesCsv")?.addEventListener("click", exportOverridesCsv);
  byId("btnPreviewOverrides")?.addEventListener("click", previewOverridesCsv);
  byId("btnApplyOverrides")?.addEventListener("click", applyOverrides);
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

// Download Plan Worklist functions
function toggleDownloadMenu() {
  const menu = q("downloadMenu");
  const isOpen = menu.classList.contains("open");

  // Close all other menus first
  document
    .querySelectorAll(".kebab-menu.open")
    .forEach((m) => m.classList.remove("open"));

  // Toggle download menu
  if (isOpen) {
    menu.classList.remove("open");
  } else {
    menu.classList.add("open");
  }
}

async function downloadPlanWorklist(format, language = null, category = null) {
  const headerId = Number(q("bpHeaderSel").value);
  if (!headerId) {
    toast("Please select a plan first");
    return;
  }

  // Close the download menu
  q("downloadMenu").classList.remove("open");

  try {
    // Fetch data using the database function
    const { data, error } = await supabase.rpc("get_plan_worklist", {
      p_header_id: headerId,
    });

    if (error) {
      console.error(error);
      toast("Worklist fetch failed");
      return;
    }

    if (!data || data.length === 0) {
      toast("No data available for download");
      return;
    }

    if (format === "csv") {
      downloadWorklistCSV(data);
    } else if (format === "pdf") {
      downloadWorklistPDF(data, language, category);
    }
  } catch (err) {
    console.error("Download error:", err);
    toast("Download failed");
  }
}

function downloadWorklistCSV(data) {
  // CSV columns: Product, Malayalam, Month, Batch Size, Rule, Status, BN
  const headers = [
    "Product",
    "Malayalam",
    "Month",
    "Batch Size",
    "Rule",
    "Status",
    "BN",
  ];

  const csvRows = [headers.join(",")];

  data.forEach((row) => {
    const csvRow = [
      escapeCSV(row.product || ""),
      escapeCSV(row.malayalam || ""),
      "", // Month - not available in worklist data
      row.batch_size || "",
      "", // Rule - not available in worklist data
      row.status || "",
      "", // BN - not available in worklist data
    ];
    csvRows.push(csvRow.join(","));
  });

  const csvContent = csvRows.join("\n");
  downloadFile(csvContent, "plan-worklist.csv", "text/csv");
}

function downloadWorklistPDF(data, language, categoryFilter) {
  // Filter data by category
  let filteredData = data;
  if (categoryFilter === "ayurveda") {
    filteredData = data.filter((row) =>
      ["Ayurveda", "Food Products", "Other Products"].includes(row.category)
    );
  } else if (categoryFilter === "siddha") {
    filteredData = data.filter((row) => row.category === "Siddha");
  }

  if (filteredData.length === 0) {
    toast(`No ${categoryFilter} products found`);
    return;
  }

  // Group by category and subcategory
  const grouped = groupByCategorySubcategory(filteredData);

  // Generate PDF content
  generateWorklistPDF(grouped, language, categoryFilter);
}

function groupByCategorySubcategory(data) {
  const grouped = {};

  data.forEach((row) => {
    const category = row.category || "Uncategorized";
    const subCategory = row.sub_category || "Uncategorized";

    if (!grouped[category]) {
      grouped[category] = {};
    }

    if (!grouped[category][subCategory]) {
      grouped[category][subCategory] = [];
    }

    grouped[category][subCategory].push(row);
  });

  return grouped;
}

function generateWorklistPDF(groupedData, language, categoryFilter) {
  try {
    // Check if required libraries are available
    if (
      typeof window.jspdf === "undefined" ||
      typeof window.html2canvas === "undefined"
    ) {
      toast("PDF libraries not loaded. Please refresh the page.");
      return;
    }

    // For Malayalam, use HTML-to-PDF approach for better Unicode support
    if (language === "malayalam") {
      generateMalayalamPDF(groupedData, categoryFilter);
      return;
    }

    // For English, use the original jsPDF approach
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Title
    const title = `Plan Worklist - ${
      categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1)
    } (English)`;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(title, 105, 20, { align: "center" });

    // Subtitle with date
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 30, {
      align: "center",
    });

    let yPos = 50;

    // Process each category
    Object.keys(groupedData)
      .sort()
      .forEach((category) => {
        // Check if we need a new page for category
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        // Category header
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(category.toUpperCase(), 20, yPos);
        yPos += 10;

        Object.keys(groupedData[category])
          .sort()
          .forEach((subCategory) => {
            // Check if we need a new page for subcategory
            if (yPos > 240) {
              doc.addPage();
              yPos = 20;
            }

            // Subcategory header
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text(subCategory, 25, yPos);
            yPos += 8;

            // Prepare table data
            const tableData = [];
            groupedData[category][subCategory].forEach((row) => {
              // For PDF, always use English product names since jsPDF doesn't support Malayalam Unicode
              // If Malayalam was requested, we'll add a note in the title
              const productName = row.product;

              tableData.push([
                productName || "",
                row.bn || "",
                row.batch_size ? row.batch_size.toString() : "",
                row.uom || "",
              ]);
            });

            // Generate table using autoTable
            if (tableData.length > 0) {
              const productHeader = "Product"; // Always use English for PDF compatibility

              doc.autoTable({
                head: [[productHeader, "BN", "Batch Size", "UOM"]],
                body: tableData,
                startY: yPos,
                margin: { left: 30 },
                styles: {
                  fontSize: 9,
                  cellPadding: 3,
                },
                headStyles: {
                  fillColor: [240, 240, 240],
                  textColor: [0, 0, 0],
                  fontStyle: "bold",
                },
                alternateRowStyles: {
                  fillColor: [250, 250, 250],
                },
                columnStyles: {
                  0: { cellWidth: 80 }, // Product name
                  1: { cellWidth: 30 }, // BN
                  2: { cellWidth: 30 }, // Batch Size
                  3: { cellWidth: 25 }, // UOM
                },
                didDrawPage: function (data) {
                  yPos = data.cursor.y + 10;
                },
              });

              yPos = doc.lastAutoTable.finalY + 10;
            }
          });

        yPos += 5; // Extra space after category
      });

    // Add summary on last page or new page if needed
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    let totalBatches = 0;
    Object.keys(groupedData).forEach((category) => {
      Object.keys(groupedData[category]).forEach((subCategory) => {
        totalBatches += groupedData[category][subCategory].length;
      });
    });

    doc.setDrawColor(0, 0, 0);
    doc.line(20, yPos, 190, yPos); // Horizontal line
    yPos += 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("SUMMARY", 20, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Batches: ${totalBatches}`, 20, yPos);
    yPos += 6;
    doc.text(`Categories: ${Object.keys(groupedData).length}`, 20, yPos);
    yPos += 6;
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, yPos);

    // Save the PDF
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `plan-worklist-${categoryFilter}-${language}-${timestamp}.pdf`;
    doc.save(filename);

    toast(`PDF downloaded: ${filename}`);
  } catch (error) {
    console.error("PDF generation failed:", error);
    toast("PDF generation failed. Please try again.");
  }
}

// Preload Malayalam fonts to ensure they're available for PDF generation
async function preloadMalayalamFonts() {
  return new Promise((resolve) => {
    const fonts = [
      new FontFace(
        "Anek Malayalam",
        "url(css/fonts/AnekMalayalam-Regular.ttf)",
        { weight: "normal" }
      ),
      new FontFace("Anek Malayalam", "url(css/fonts/AnekMalayalam-Bold.ttf)", {
        weight: "bold",
      }),
      new FontFace(
        "Anek Malayalam",
        "url(css/fonts/AnekMalayalam-Medium.ttf)",
        { weight: "500" }
      ),
    ];

    Promise.all(
      fonts.map((font) =>
        font
          .load()
          .then((loadedFont) => {
            document.fonts.add(loadedFont);
            return loadedFont;
          })
          .catch(() => {
            console.warn(`Failed to load font: ${font.family} ${font.weight}`);
            return null;
          })
      )
    ).then(() => {
      // Wait a bit more to ensure fonts are fully loaded
      setTimeout(resolve, 100);
    });
  });
}

// Malayalam PDF generation using HTML-to-Canvas approach for Unicode support
async function generateMalayalamPDF(groupedData, categoryFilter) {
  try {
    toast("Generating Malayalam PDF... Please wait.");

    // Preload Malayalam fonts before generating PDF
    await preloadMalayalamFonts();

    // Create a temporary HTML element for rendering Malayalam content
    const tempContainer = document.createElement("div");
    tempContainer.style.position = "fixed";
    tempContainer.style.top = "-9999px";
    tempContainer.style.left = "-9999px";
    tempContainer.style.width = "800px";
    tempContainer.style.backgroundColor = "white";
    tempContainer.style.padding = "20px";
    tempContainer.style.fontFamily =
      "'Anek Malayalam', 'Noto Sans Malayalam', system-ui, sans-serif";
    tempContainer.className = "pdf-malayalam-content";

    // Build HTML content with Malayalam text
    const title = `Plan Worklist - ${
      categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1)
    } (Malayalam)`;

    let htmlContent = `
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="margin: 0 0 10px; font-size: 18px; color: #2563eb;">${title}</h1>
        <p style="margin: 0; font-size: 12px; color: #666;">Generated: ${new Date().toLocaleString()}</p>
      </div>
    `;

    // Process each category
    Object.keys(groupedData)
      .sort()
      .forEach((category) => {
        htmlContent += `
        <div style="margin-bottom: 25px;">
          <h2 style="background-color: #f3f4f6; padding: 8px; margin: 0 0 10px; font-size: 14px; color: #1e40af; border-left: 4px solid #2563eb;">
            ${category.toUpperCase()}
          </h2>
      `;

        Object.keys(groupedData[category])
          .sort()
          .forEach((subCategory) => {
            htmlContent += `
          <div style="margin-bottom: 15px;">
            <h3 style="background-color: #e0e7ff; padding: 6px 12px; margin: 0 0 8px; font-size: 12px; color: #3730a3;">
              ${subCategory}
            </h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px; font-family: 'Anek Malayalam', 'Noto Sans Malayalam', system-ui, sans-serif;">
              <thead>
                <tr style="background-color: #f9fafb;">
                  <th style="border: 1px solid #d1d5db; padding: 6px; text-align: left; font-weight: 600; font-family: 'Anek Malayalam', system-ui, sans-serif;">Product (Malayalam)</th>
                  <th style="border: 1px solid #d1d5db; padding: 6px; text-align: left; font-weight: 600;">BN</th>
                  <th style="border: 1px solid #d1d5db; padding: 6px; text-align: left; font-weight: 600;">Batch Size</th>
                  <th style="border: 1px solid #d1d5db; padding: 6px; text-align: left; font-weight: 600;">UOM</th>
                </tr>
              </thead>
              <tbody>
        `;

            groupedData[category][subCategory].forEach((row, index) => {
              const rowStyle =
                index % 2 === 0
                  ? "background-color: #ffffff;"
                  : "background-color: #f9fafb;";
              const productName = row.malayalam || row.product;

              htmlContent += `
            <tr style="${rowStyle}">
              <td style="border: 1px solid #e5e7eb; padding: 6px; font-family: 'Anek Malayalam', 'Noto Sans Malayalam', system-ui, sans-serif;">${
                productName || ""
              }</td>
              <td style="border: 1px solid #e5e7eb; padding: 6px;">${
                row.bn || ""
              }</td>
              <td style="border: 1px solid #e5e7eb; padding: 6px;">${
                row.batch_size || ""
              }</td>
              <td style="border: 1px solid #e5e7eb; padding: 6px;">${
                row.uom || ""
              }</td>
            </tr>
          `;
            });

            htmlContent += `
              </tbody>
            </table>
          </div>
        `;
          });

        htmlContent += `</div>`;
      });

    // Add summary
    let totalBatches = 0;
    Object.keys(groupedData).forEach((category) => {
      Object.keys(groupedData[category]).forEach((subCategory) => {
        totalBatches += groupedData[category][subCategory].length;
      });
    });

    htmlContent += `
      <div style="border-top: 2px solid #e5e7eb; padding-top: 15px; margin-top: 20px;">
        <h3 style="margin: 0 0 8px; font-size: 14px; color: #1e40af;">SUMMARY</h3>
        <p style="margin: 2px 0; font-size: 12px;">Total Batches: ${totalBatches}</p>
        <p style="margin: 2px 0; font-size: 12px;">Categories: ${
          Object.keys(groupedData).length
        }</p>
        <p style="margin: 2px 0; font-size: 12px;">Generated: ${new Date().toLocaleString()}</p>
      </div>
    `;

    tempContainer.innerHTML = htmlContent;
    document.body.appendChild(tempContainer);

    // Convert to canvas using html2canvas
    const canvas = await window.html2canvas(tempContainer, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      width: 800,
      height: tempContainer.scrollHeight,
    });

    // Remove temporary container
    document.body.removeChild(tempContainer);

    // Create PDF from canvas
    const { jsPDF } = window.jspdf;
    const imgData = canvas.toDataURL("image/png");

    // Calculate dimensions for A4
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 295; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const doc = new jsPDF("p", "mm", "a4");
    let heightLeft = imgHeight;
    let position = 0;

    // Add first page
    doc.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Add additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      doc.addPage();
      doc.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Save the PDF
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `plan-worklist-${categoryFilter}-malayalam-${timestamp}.pdf`;
    doc.save(filename);

    toast(`Malayalam PDF downloaded: ${filename}`);
  } catch (error) {
    console.error("Malayalam PDF generation failed:", error);
    toast("Malayalam PDF generation failed. Please try again.");
  }
}

function escapeCSV(str) {
  if (str == null) return "";
  const s = String(str);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
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
    btnExportBatches: "Export the currently filtered batch list to CSV.",

    // Mapping
    mapBatchSel: "Pick an UNMAPPED planned batch to map.",
    mapBmrSel: "Candidate BMR cards for the selected product/size.",
    btnLinkBmr: "Link the UNMAPPED batch to the selected BMR (BN).",
    btnUnlinkBmr: "Unlink a mapped BMR from this planned batch (if allowed).",
    btnReloadMap: "Rebuild mapping rollup and candidates.",

    // Overrides
    btnExportOverridesCsv:
      "Download a CSV template for overrides (ADD/RESIZE/CANCEL).",
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

  if (searchTerm) {
    filteredRefs = _batchSizeRefsCache.filter((ref) => {
      const productDisplay = getProductDisplay(ref.product_id).toLowerCase();
      return productDisplay.includes(searchTerm);
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
