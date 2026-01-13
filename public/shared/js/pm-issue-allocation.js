import { supabase } from "./supabaseClient.js";
import { showToast } from "./toast.js";
import { loadAccessContext, canEditPM } from "./mrpAccess.js";
import { ensureDetailModal } from "./detailModal.js";

// Simple PM Issue Allocation console
// - Summary sourced from RPC `mrp_pm_allocation_console` (LIST mode)
// - Detail via same RPC with p_stock_item_id (DETAIL mode)
// - Issue lines still read from `mrp_plm_issue_lines` for now (editable)
// TODO: add product/sku lookup dropdowns, bulk actions

let summaryRows = [];
let filteredSummary = [];
let selectedSummary = null; // object representing selected summary row
let issueLines = []; // all lines loaded for selected PM+month
let editedRows = new Map(); // id -> { ...modified fields }
let currentHorizonStart = null;
// pending PM id supplied via deep-link; applied after dropdown built
let pendingPmIdFromUrl = null;
// summary counts returned by DETAIL RPC (e.g., total_qty, unassigned_qty, approx_qty)
let issueSummary = null;
// lookups
let productsList = [];
let skusByProduct = new Map(); // product_id -> [{id, name}]
let skuById = new Map(); // sku_id -> { id, name, product_id }
// Pagination state for RPC-backed summary
let currentPage = 0; // 0-based
let pageSize = 200;
let totalCount = 0;
// current sort state for summary table (null = default sort by issued desc)
let currentSortKey = null;
let currentSortDir = null; // 'asc' | 'desc'

// Lookup cache flags
let productLookupLoaded = false;
let skuLookupLoaded = false;
let searchDebounceTimer = null;
// debug flag for lookup fallbacks
const DEBUG_LOOKUPS = false;
// debug flag for back-button diagnostics (removed in production)
// popover refs for allocation-status help
let allocPopover = null;
let allocPopoverBtn = null;
let allocPopoverOpen = false;

function formatNumber(n) {
  if (n === null || n === undefined) return "";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function firstDayFromMonthInput(val) {
  if (!val) return null;
  // val = YYYY-MM
  return `${val}-01`;
}

function monthDisplayFromHorizon(h) {
  try {
    const d = new Date(h);
    return d.toLocaleString(undefined, { month: "short", year: "numeric" });
  } catch {
    return h;
  }
}

function showLoading() {
  let el = document.getElementById("loadingOverlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "loadingOverlay";
    el.style.position = "fixed";
    el.style.left = 0;
    el.style.top = 0;
    el.style.right = 0;
    el.style.bottom = 0;
    el.style.background = "rgba(255,255,255,0.6)";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.zIndex = 9999;
    el.textContent = "Loading...";
    document.body.appendChild(el);
  }
  el.style.display = "flex";
}

function hideLoading() {
  const el = document.getElementById("loadingOverlay");
  if (el) el.style.display = "none";
}

async function fetchSummary(horizonStart) {
  // fetch paginated rows for this month via RPC
  showLoading();
  try {
    // Note: PM dropdown is client-side only and must NOT change RPC params
    const onlyUnassigned = document.getElementById("filterUnassigned")
      ? document.getElementById("filterUnassigned").checked
      : false;
    const onlyApprox = document.getElementById("filterApprox")
      ? document.getElementById("filterApprox").checked
      : false;
    const q = (document.getElementById("textSearch").value || "").trim();

    // RPC params
    const params = {
      p_horizon_start: horizonStart,
      // always null for LIST mode; PM dropdown is client-side filter only
      p_stock_item_id: null,
      p_only_unassigned: Boolean(onlyUnassigned),
      p_only_approx: Boolean(onlyApprox),
      p_q: q || null,
      p_offset: currentPage * pageSize,
      p_limit: pageSize,
    };

    // try primary RPC call
    let rpcName = "mrp_pm_allocation_console";
    let { data, error } = await supabase.rpc(rpcName, params);

    // If function not found but server provided a hint suggesting another function name/signature,
    // try to parse that hint and retry with the suggested function and parameter names.
    if (error && error.code === "PGRST202" && error.hint) {
      console.warn("RPC function not found; server hint:", error.hint);
      // attempt to extract function name and parameter list from hint text
      const m = error.hint.match(/call the function ([\w.]+)\(([^)]*)\)/i);
      if (m) {
        const suggestedFull = m[1]; // e.g. public.mrp_pm_allocation_console
        const suggestedName = suggestedFull.split(".").pop();
        const suggestedParamsText = m[2];
        const paramMatches = suggestedParamsText.match(/p_[a-z0-9_]+/gi) || [];
        const baseValues = {
          p_horizon_start: horizonStart,
          // LIST-mode always sends null; suggest null here too
          p_stock_item_id: null,
          p_only_unassigned: Boolean(onlyUnassigned),
          p_only_approx: Boolean(onlyApprox),
          p_q: q || null,
          p_offset: currentPage * pageSize,
          p_limit: pageSize,
        };
        const suggestedParams = {};
        paramMatches.forEach((pn) => {
          if (pn in baseValues) suggestedParams[pn] = baseValues[pn];
          else if (
            pn === "p_plm_stock_item_id" &&
            baseValues.p_stock_item_id != null
          )
            suggestedParams[pn] = baseValues.p_stock_item_id;
        });

        try {
          rpcName = suggestedName;
          const retry = await supabase.rpc(rpcName, suggestedParams);
          data = retry.data;
          error = retry.error;
          if (!error) {
            console.info(`RPC retried with suggested function ${rpcName}`);
          }
        } catch (err2) {
          console.error("RPC retry failed", err2);
          // fall through to handle below
        }
      }
    }

    if (error) {
      console.error("Failed loading PM summary (RPC)", error);
      showToast("Failed to load summary — check RPC name/params", {
        type: "error",
      });
      summaryRows = [];
      totalCount = 0;
      filteredSummary = [];
      hideLoading();
      return;
    }

    // RPC may return the object directly or as first element of array
    const payload = Array.isArray(data) && data.length === 1 ? data[0] : data;
    if (!payload) {
      summaryRows = [];
      totalCount = 0;
    } else {
      // expected shape: { total_count, rows }
      totalCount = payload.total_count || 0;
      summaryRows = payload.rows || [];
    }
  } catch (err) {
    console.error("Failed loading PM summary", err);
    showToast("Failed to load summary", { type: "error" });
    summaryRows = [];
    totalCount = 0;
  } finally {
    hideLoading();
  }
}

// best-effort product list loader
async function loadProductLookup() {
  if (productLookupLoaded) return;
  const pageSize = 1000;
  let from = 0;
  // Use a map to preserve uniqueness and order
  const map = new Map();
  try {
    // If we already have some products, seed the map
    if (productsList && productsList.length) {
      productsList.forEach((p) => map.set(String(p.id), p));
    }

    while (true) {
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from("products")
        .select("id,item,malayalam_name")
        .order("item")
        .range(from, to);
      if (error) {
        console.error("Product lookup page failed", { from, to, error });
        break;
      }
      if (!data || data.length === 0) break;
      data.forEach((p) => {
        const key = String(p.id);
        if (!map.has(key))
          map.set(key, { id: p.id, name: p.item || p.malayalam_name || null });
        else {
          const existing = map.get(key);
          if (!existing.name && (p.item || p.malayalam_name))
            existing.name = p.item || p.malayalam_name;
        }
      });
      if (data.length < pageSize) break;
      from += pageSize;
    }
    productsList = Array.from(map.values());
  } catch (err) {
    console.error("Product lookup failed", err);
    productsList = [];
  } finally {
    productLookupLoaded = true;
  }
}

// PM lookups removed — enriched view / RPC provides pm_code, pm_name and pm_uom_code

function buildPmDropdown() {
  const sel = document.getElementById("pmFilter");
  if (!sel) return;
  // Preserve empty/default option, rebuild unique options
  const first = sel.querySelector("option[value='']");
  sel.innerHTML = "";
  if (first) sel.appendChild(first);
  const seen = new Set();
  summaryRows.forEach((r) => {
    const rawId = r.pm_stock_item_id;
    if (!rawId) return;
    const id = String(rawId);
    if (seen.has(id)) return;
    seen.add(id);
    const label = getPmLabel(r);
    const o = document.createElement("option");
    o.value = id;
    o.textContent = label;
    sel.appendChild(o);
  });
}

// load SKUs and group by product (used for the editable dropdowns in detail)
async function loadAllSkus() {
  if (skuLookupLoaded) return;
  try {
    const { data, error } = await supabase
      .from("product_skus")
      .select("id,product_id,pack_size,uom")
      .order("pack_size");
    if (!error && data) {
      skusByProduct = new Map();
      skuById = new Map();
      data.forEach((s) => {
        const pid = String(s.product_id || "");
        if (!skusByProduct.has(pid)) skusByProduct.set(pid, []);
        // Build a human-friendly sku label from pack_size + uom if available
        const name = s.pack_size
          ? String(s.pack_size) + (s.uom ? ` ${s.uom}` : "")
          : null;
        const entry = {
          id: s.id,
          name: name || null,
          product_id: s.product_id,
        };
        skusByProduct.get(pid).push(entry);
        skuById.set(String(s.id), entry);
      });
      skuLookupLoaded = true;
    } else {
      skusByProduct = new Map();
      skuById = new Map();
    }
  } catch (err) {
    console.error("SKU lookup failed", err);
    skusByProduct = new Map();
    skuById = new Map();
  }
}

// Helper label functions (centralised)
function getPmLabel(row) {
  const code = row.pm_code || String(row.pm_stock_item_id || "");
  const name = row.pm_name || "";
  if (code && name) return `${code} — ${name}`;
  if (name) return name;
  return code || "";
}

function getProductLabel(row) {
  // Prefer enriched view product_name
  if (row.product_name) return row.product_name;
  // If view didn't provide a name, try client-side productsList lookup
  if (row.product_id != null) {
    const pid = Number(row.product_id);
    const found = productsList.find((p) => Number(p.id) === pid);
    if (found && found.name) return found.name;
    return `Product ${row.product_id}`;
  }
  return null;
}

function getSkuLabel(row) {
  // Prefer enriched view sku_name (sku_label)
  if (row.sku_name) return row.sku_name;
  // Fallback to client-side skuById lookup
  if (row.sku_id != null) {
    const sid = String(row.sku_id);
    const entry = skuById.get(sid);
    if (entry && entry.name) return entry.name;
    return `SKU ${row.sku_id}`;
  }
  return null;
}

function getCombinationLabel(row) {
  const parts = [];
  const productLabel = getProductLabel(row);
  const skuLabel = getSkuLabel(row);
  if (productLabel) parts.push(productLabel);
  if (skuLabel) parts.push(skuLabel);
  if (!productLabel && !skuLabel) parts.push("Unassigned");
  if (row.region_code) parts.push(`[${row.region_code}]`);
  return parts.join(" · ");
}

// View toggling helpers for Summary / Detail sections
function showSummaryView() {
  const summary = document.getElementById("summarySection");
  const detail = document.getElementById("detailSection");
  const tabSummary = document.getElementById("tabSummary");
  const tabDetail = document.getElementById("tabDetail");
  if (!summary || !detail) return;
  summary.style.display = "";
  detail.style.display = "none";
  if (tabSummary && tabDetail) {
    tabSummary.classList.add("active");
    tabDetail.classList.remove("active");
  }
}

function showDetailView() {
  const summary = document.getElementById("summarySection");
  const detail = document.getElementById("detailSection");
  const tabSummary = document.getElementById("tabSummary");
  const tabDetail = document.getElementById("tabDetail");
  if (!summary || !detail) return;
  summary.style.display = "none";
  detail.style.display = "";
  if (tabSummary && tabDetail) {
    tabSummary.classList.remove("active");
    tabDetail.classList.add("active");
    tabDetail.disabled = false;
  }
}

function applySummaryFiltersAndRender() {
  // Server-side RPC provides filtering and pagination. Render current page.
  const pmId = document.getElementById("pmFilter")?.value || "";
  const needsOnly =
    document.getElementById("filterNeedsAttention")?.checked || false;
  const ageBucket = document.getElementById("ageBucket")?.value || "";
  // client-side filters applied to currently-loaded page of rows
  filteredSummary = summaryRows.filter((r) => {
    if (needsOnly && !r.needs_attention) return false;
    if (pmId && String(r.pm_stock_item_id) !== String(pmId)) return false;
    if (ageBucket) {
      const v = r.max_age_days;
      if (v == null) return false;
      const n = Number(v);
      if (ageBucket === "0-7" && (n < 0 || n > 7)) return false;
      if (ageBucket === "8-14" && (n < 8 || n > 14)) return false;
      if (ageBucket === "15-30" && (n < 15 || n > 30)) return false;
      if (ageBucket === "31+" && n < 31) return false;
    }
    return true;
  });

  // Sorting: use header-driven sort state when present, otherwise default to issued_pm_qty desc
  if (currentSortKey) {
    const key = currentSortKey;
    const dir = currentSortDir === "asc" ? 1 : -1;
    filteredSummary.sort((a, b) => {
      if (key === "issued_pm_qty")
        return (
          dir * (Number(a.issued_pm_qty || 0) - Number(b.issued_pm_qty || 0))
        );
      if (key === "max_age_days") {
        const aVal =
          a.max_age_days == null
            ? currentSortDir === "asc"
              ? Number.POSITIVE_INFINITY
              : Number.NEGATIVE_INFINITY
            : Number(a.max_age_days);
        const bVal =
          b.max_age_days == null
            ? currentSortDir === "asc"
              ? Number.POSITIVE_INFINITY
              : Number.NEGATIVE_INFINITY
            : Number(b.max_age_days);
        return dir * (aVal - bVal);
      }
      if (key === "pm_display") {
        const sa = getPmLabel(a).toLowerCase();
        const sb = getPmLabel(b).toLowerCase();
        return dir * sa.localeCompare(sb);
      }
      if (key === "combination") {
        const sa = getCombinationLabel(a).toLowerCase();
        const sb = getCombinationLabel(b).toLowerCase();
        return dir * sa.localeCompare(sb);
      }
      const sa = String(a[key] || "").toLowerCase();
      const sb = String(b[key] || "").toLowerCase();
      return dir * sa.localeCompare(sb);
    });
  } else {
    filteredSummary.sort(
      (a, b) => Number(b.issued_pm_qty || 0) - Number(a.issued_pm_qty || 0)
    );
  }

  renderSummaryTable();
  renderPaginator();
}

function renderSummaryTable() {
  const tbody = document.getElementById("summaryBody");
  tbody.innerHTML = "";
  document.getElementById("rowCount").textContent = totalCount;

  filteredSummary.forEach((r, idx) => {
    const tr = document.createElement("tr");
    tr.tabIndex = 0;
    const pmDisplay = getPmLabel(r);
    const combo = getCombinationLabel(r);
    const rowUom = r.pm_uom_code || "";

    // Build Flags column: show existing badges when attention required, otherwise show Clean
    let flagsHtml = "";
    if (r.needs_attention) {
      if (r.has_unassigned_issues)
        flagsHtml += '<span class="badge-warning">Unassigned</span>';
      if (r.allocation_approx)
        flagsHtml +=
          (flagsHtml ? " " : "") + '<span class="badge-info">Approx</span>';
    } else {
      flagsHtml = '<span class="badge-success">Clean</span>';
    }

    // Aging column: show — when not applicable; otherwise show oldest date and qty breakdown
    let agingHtml = "—";
    if (r.needs_attention && r.oldest_issue_date) {
      const unassigned = formatNumber(r.unassigned_qty ?? 0);
      const approx = formatNumber(r.approx_qty ?? 0);
      agingHtml = `
        <div>Oldest: ${escapeHtml(r.oldest_issue_date)} (${String(
        r.max_age_days ?? ""
      )}d)</div>
        <div>Unassigned: ${escapeHtml(unassigned)} • Approx: ${escapeHtml(
        approx
      )}</div>`;
    }

    tr.innerHTML = `
      <td>${escapeHtml(pmDisplay)}</td>
      <td>${escapeHtml(combo)}</td>
      <td style="text-align:right">${formatNumber(
        r.issued_pm_qty
      )} ${escapeHtml(rowUom)}</td>
      <td>${agingHtml}</td>
      <td>${flagsHtml}</td>
      <td><button class="link-btn view-lines">View issue lines</button></td>
    `;

    tr.addEventListener("click", () => selectSummaryRow(idx));
    tr.querySelector(".view-lines").addEventListener("click", (e) => {
      e.stopPropagation();
      selectSummaryRow(idx);
      // switch to detail view when user explicitly clicks the button
      showDetailView();
    });
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter") selectSummaryRow(idx);
    });

    tbody.appendChild(tr);
  });
}

function renderPaginator() {
  let container = document.getElementById("paginator");
  const rowCountEl = document.getElementById("rowCount");
  if (!container) {
    container = document.createElement("div");
    container.id = "paginator";
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.gap = "8px";
    if (rowCountEl && rowCountEl.parentNode)
      rowCountEl.parentNode.insertBefore(container, rowCountEl.nextSibling);
    else document.body.appendChild(container);
  }
  container.innerHTML = "";

  const start = totalCount === 0 ? 0 : currentPage * pageSize + 1;
  const end = Math.min(totalCount, (currentPage + 1) * pageSize);

  const prev = document.createElement("button");
  prev.textContent = "Prev";
  prev.disabled = currentPage === 0;
  prev.addEventListener("click", () => {
    if (currentPage === 0) return;
    currentPage -= 1;
    loadAndRenderSummary();
  });

  const next = document.createElement("button");
  next.textContent = "Next";
  next.disabled = (currentPage + 1) * pageSize >= totalCount;
  next.addEventListener("click", () => {
    if ((currentPage + 1) * pageSize >= totalCount) return;
    currentPage += 1;
    loadAndRenderSummary();
  });

  const info = document.createElement("span");
  // compute page-level attention stats
  const pageCount = filteredSummary.length;
  const attentionCount = filteredSummary.reduce(
    (acc, r) => acc + (r?.needs_attention ? 1 : 0),
    0
  );
  info.textContent = `Showing ${start}-${end} of ${totalCount} • Page Attention: ${attentionCount} / ${pageCount}`;

  const sizeSel = document.createElement("select");
  [25, 50, 100, 200].forEach((s) => {
    const o = document.createElement("option");
    o.value = String(s);
    o.textContent = String(s);
    if (s === pageSize) o.selected = true;
    sizeSel.appendChild(o);
  });
  sizeSel.addEventListener("change", () => {
    pageSize = Number(sizeSel.value);
    currentPage = 0;
    loadAndRenderSummary();
  });

  container.appendChild(prev);
  container.appendChild(info);
  container.appendChild(next);
  container.appendChild(sizeSel);
}

function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );
}

async function selectSummaryRow(idx) {
  selectedSummary = filteredSummary[idx];
  if (!selectedSummary) return;
  // highlight
  document
    .querySelectorAll("#summaryBody tr")
    .forEach((tr, i) => tr.classList.toggle("selected", i === idx));
  // enable detail tab when a selection exists
  const tabDetail = document.getElementById("tabDetail");
  if (tabDetail) tabDetail.disabled = false;
  // populate detail header and load issue lines
  const header = document.getElementById("detailHeader");
  const pmLabel = getPmLabel(selectedSummary);
  const comboLabel = getCombinationLabel(selectedSummary);
  header.textContent = `PM: ${pmLabel} • ${comboLabel} • ${monthDisplayFromHorizon(
    selectedSummary.horizon_start
  )}`;
  // Ensure lookups are available, then load DETAIL payload (which provides issue lines)
  await loadProductLookup();
  await loadAllSkus();
  await loadIssueLinesForSelected();
}

async function loadIssueLinesForSelected() {
  if (!selectedSummary) return;
  // ensure lookups for editable dropdowns are loaded
  await loadProductLookup();
  await loadAllSkus();

  // Call DETAIL RPC for this PM
  showLoading();
  try {
    const params = {
      p_horizon_start: selectedSummary.horizon_start,
      p_stock_item_id:
        selectedSummary.pm_stock_item_id || selectedSummary.plm_stock_item_id,
      p_q: null,
      p_only_unassigned: false,
      p_only_approx: false,
      p_offset: 0,
      p_limit: 200,
    };

    const { data, error } = await supabase.rpc(
      "mrp_pm_allocation_console",
      params
    );
    if (error) {
      console.error("Failed loading PM detail (RPC)", error);
      showToast("Failed to load issue lines (detail)", { type: "error" });
      issueLines = [];
      issueSummary = null;
      renderIssueLines();
      return;
    }
    if (!data || data.mode !== "detail") {
      console.error("RPC did not return detail mode", data);
      showToast("Unexpected RPC response (not detail mode)", {
        type: "error",
      });
      return;
    }

    // Use DETAIL payload
    issueLines = data.issued || [];
    issueSummary = data.issues || {};

    // reset edited state
    editedRows.clear();
    renderIssueLines();
  } catch (err) {
    console.error("Failed loading PM detail", err);
    showToast("Failed to load issue lines", { type: "error" });
    issueLines = [];
    issueSummary = null;
    renderIssueLines();
  } finally {
    hideLoading();
  }
}

// Fetch DETAIL mode from RPC for a single PM
// `fetchDetail` removed — DETAIL behavior handled by `loadIssueLinesForSelected()`

function renderIssueLines() {
  const tbody = document.getElementById("issueLinesBody");
  tbody.innerHTML = "";
  if (!selectedSummary) return;

  const onlyUnassigned = document.getElementById(
    "detailShowUnassignedOnly"
  ).checked;
  const onlyThis = document.getElementById("detailShowAllocatedOnly").checked;
  const q = (document.getElementById("detailTextSearch").value || "")
    .trim()
    .toLowerCase();

  let totalIssued = 0,
    allocatedToThis = 0,
    allocatedOthers = 0,
    unassignedSum = 0;
  // Prefer server-provided summary totals when available
  if (issueSummary && issueSummary.total_qty != null) {
    totalIssued = Number(issueSummary.total_qty || 0);
    unassignedSum = Number(issueSummary.unassigned_qty || 0);
  } else {
    issueLines.forEach((l) => {
      totalIssued += Number(l.qty_issued || 0);
      if (l.allocation_status === "unassigned")
        unassignedSum += Number(l.qty_issued || 0);
    });
  }

  const linesToShow = issueLines.filter((l) => {
    const matches =
      (selectedSummary.product_id == null
        ? l.product_id == null
        : Number(l.product_id) === Number(selectedSummary.product_id)) &&
      (selectedSummary.sku_id == null
        ? l.sku_id == null
        : Number(l.sku_id) === Number(selectedSummary.sku_id)) &&
      (selectedSummary.region_code == null
        ? l.region_code == null
        : String(l.region_code) === String(selectedSummary.region_code));
    if (onlyUnassigned && l.allocation_status !== "unassigned") return false;
    if (onlyThis && !matches) return false;
    if (q) {
      const voucher = String(
        (l.voucher_number || "") + " " + (l.voucher_ref || "")
      ).toLowerCase();
      const batch = String(
        l.batch_number || l.raw_batch_number || ""
      ).toLowerCase();
      if (!voucher.includes(q) && !batch.includes(q)) return false;
    }
    return true;
  });

  // metrics: compute allocated totals from issueLines, prefer issueSummary for totals
  issueLines.forEach((l) => {
    const matches =
      (selectedSummary.product_id == null
        ? l.product_id == null
        : Number(l.product_id) === Number(selectedSummary.product_id)) &&
      (selectedSummary.sku_id == null
        ? l.sku_id == null
        : Number(l.sku_id) === Number(selectedSummary.sku_id)) &&
      (selectedSummary.region_code == null
        ? l.region_code == null
        : String(l.region_code) === String(selectedSummary.region_code));
    if (matches) allocatedToThis += Number(l.qty_issued || 0);
    else if (l.allocation_status !== "unassigned")
      allocatedOthers += Number(l.qty_issued || 0);
  });

  const metrics = document.getElementById("detailMetrics");
  const uom = selectedSummary.pm_uom_code || "";
  const totalDisplay = formatNumber(totalIssued);
  const unassignedDisplay = formatNumber(unassignedSum);
  metrics.textContent = `Month: ${monthDisplayFromHorizon(
    selectedSummary.horizon_start
  )} • Total issued: ${totalDisplay} ${uom} • Allocated to this: ${formatNumber(
    allocatedToThis
  )} • Allocated to others: ${formatNumber(
    allocatedOthers
  )} • Unassigned: ${unassignedDisplay}`;

  linesToShow.forEach((l) => {
    const tr = document.createElement("tr");
    tr.dataset.id = l.id;

    const lineUom = selectedSummary?.pm_uom_code || "";

    tr.innerHTML = `
      <td>${escapeHtml(l.issue_date)}</td>
      <td>${escapeHtml(
        (l.voucher_type || "") + " " + (l.voucher_number || "")
      )}</td>
      <td style="text-align:right">${formatNumber(l.qty_issued)} ${escapeHtml(
      lineUom
    )}</td>
      <td>${escapeHtml(l.raw_batch_number || "")}</td>
      <td>${escapeHtml(l.batch_number || "")}</td>
      <td><select data-field="product_id" class="product-select"></select></td>
      <td><select data-field="sku_id" class="sku-select"></select></td>
      <td><input data-field="region_code" type="text" value="${escapeHtml(
        l.region_code ?? ""
      )}" /></td>
      <td>
        <select data-field="allocation_status">
          <option value="unassigned" ${
            l.allocation_status === "unassigned" ? "selected" : ""
          }>unassigned</option>
          <option value="exact" ${
            l.allocation_status === "exact" ? "selected" : ""
          }>exact</option>
          <option value="by_batch" ${
            l.allocation_status === "by_batch" ? "selected" : ""
          }>by_batch</option>
          <option value="by_product" ${
            l.allocation_status === "by_product" ? "selected" : ""
          }>by_product</option>
          <option value="by_sku" ${
            l.allocation_status === "by_sku" ? "selected" : ""
          }>by_sku</option>
        </select>
      </td>
      <td><input data-field="allocation_note" type="text" value="${escapeHtml(
        l.allocation_note || ""
      )}" /></td>
    `;

    const prodSel = tr.querySelector(".product-select");
    const skuSel = tr.querySelector(".sku-select");

    // populate product options (and inject fallback option when server value
    // isn't present in the client lookup)
    prodSel.innerHTML = "";
    const emptyP = document.createElement("option");
    emptyP.value = "";
    emptyP.textContent = "";
    prodSel.appendChild(emptyP);
    if (productsList && productsList.length) {
      productsList.forEach((p) => {
        const o = document.createElement("option");
        o.value = String(p.id);
        o.textContent = p.name ? `${p.id} - ${p.name}` : String(p.id);
        prodSel.appendChild(o);
      });
    }
    // If the current line's product_id isn't present in the lookup, add a
    // fallback option so the select shows the DB value and remains editable.
    if (l.product_id != null) {
      const val = String(l.product_id);
      if (!prodSel.querySelector(`option[value="${val}"]`)) {
        const o = document.createElement("option");
        o.value = val;
        const label =
          l.product_name || l.product_label || `Product ${val} (unlisted)`;
        o.textContent = `${val} - ${label}`;
        prodSel.appendChild(o);
        if (DEBUG_LOOKUPS)
          console.warn("Injected missing product option:", val, label);
      }
    }
    prodSel.value = l.product_id == null ? "" : String(l.product_id);

    function populateSkuFor(productId) {
      skuSel.innerHTML = "";
      const emptyS = document.createElement("option");
      emptyS.value = "";
      emptyS.textContent = "";
      skuSel.appendChild(emptyS);
      const list = skusByProduct.get(String(productId)) || [];
      if (list.length) {
        list.forEach((s) => {
          const o = document.createElement("option");
          o.value = String(s.id);
          o.textContent = s.name ? `${s.id} - ${s.name}` : String(s.id);
          skuSel.appendChild(o);
        });
      }
      // If the current line's sku_id isn't present in the lookup for this
      // product, append a fallback option so the value is selectable.
      if (l.sku_id != null) {
        const sval = String(l.sku_id);
        if (!skuSel.querySelector(`option[value="${sval}"]`)) {
          const o = document.createElement("option");
          o.value = sval;
          const slabel = l.sku_name || l.sku_label || `SKU ${sval} (unlisted)`;
          o.textContent = `${sval} - ${slabel}`;
          skuSel.appendChild(o);
          if (DEBUG_LOOKUPS)
            console.warn(
              "Injected missing SKU option:",
              sval,
              slabel,
              "for product",
              productId
            );
        }
      }
      skuSel.value = l.sku_id == null ? "" : String(l.sku_id);
    }

    populateSkuFor(l.product_id);

    // wire editing
    tr.querySelectorAll("[data-field]").forEach((inp) => {
      inp.addEventListener("change", () => {
        const field = inp.dataset.field;
        const rawVal = inp.value;
        const val = rawVal === "" ? null : rawVal;
        const id = l.id;
        const existing = editedRows.get(id) || {};
        existing[field] = val;
        editedRows.set(id, existing);
        tr.classList.add("dirty");
        if (field === "product_id") populateSkuFor(val);

        // Optional UX: when SKU selected and product empty, auto-fill product from skuById
        if (field === "sku_id" && val) {
          const sku = skuById.get(String(val));
          if (sku && prodSel && (!prodSel.value || prodSel.value === "")) {
            prodSel.value = String(sku.product_id);
            const existing2 = editedRows.get(id) || {};
            existing2.product_id = String(sku.product_id);
            editedRows.set(id, existing2);
            populateSkuFor(sku.product_id);
            tr.classList.add("dirty");
          }
        }
      });
    });

    tbody.appendChild(tr);
  });
}

function wireUp() {
  const homeBtn = document.getElementById("homeBtn");
  if (homeBtn)
    homeBtn.addEventListener(
      "click",
      () => (window.location.href = "../../index.html")
    );

  const clearBtn = document.getElementById("clearFilters");
  if (clearBtn)
    clearBtn.addEventListener("click", () => {
      const pmSel = document.getElementById("pmFilter");
      if (pmSel) pmSel.value = "";
      const fu = document.getElementById("filterUnassigned");
      if (fu) fu.checked = false;
      const fa = document.getElementById("filterApprox");
      if (fa) fa.checked = false;
      const fn = document.getElementById("filterNeedsAttention");
      if (fn) fn.checked = false;
      const ab = document.getElementById("ageBucket");
      if (ab) ab.value = "";
      const ts = document.getElementById("textSearch");
      if (ts) ts.value = "";
      currentPage = 0;
      loadAndRenderSummary();
    });

  // Re-fetch when Month changes (reset selection and pending URL selection)
  const horizonMonthEl = document.getElementById("horizonMonth");
  if (horizonMonthEl) {
    horizonMonthEl.addEventListener("change", () => {
      currentPage = 0;
      selectedSummary = null;
      pendingPmIdFromUrl = null;
      loadAndRenderSummary({ preserveSelection: false });
    });
    // Optional: refresh immediately while picking (better UX)
    horizonMonthEl.addEventListener("input", () => {
      currentPage = 0;
      loadAndRenderSummary({ preserveSelection: false });
    });
  }

  // PM dropdown is client-side filter only
  const pmSel = document.getElementById("pmFilter");
  if (pmSel) pmSel.addEventListener("change", applySummaryFiltersAndRender);

  const fna = document.getElementById("filterNeedsAttention");
  if (fna) fna.addEventListener("change", applySummaryFiltersAndRender);

  // these controls require server reload
  ["filterUnassigned", "filterApprox"].forEach((id) => {
    const el = document.getElementById(id);
    if (el)
      el.addEventListener("change", () => {
        currentPage = 0;
        loadAndRenderSummary();
      });
  });

  const textSearchEl = document.getElementById("textSearch");
  if (textSearchEl)
    textSearchEl.addEventListener("input", () => {
      currentPage = 0;
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        loadAndRenderSummary();
      }, 300);
    });

  // Tab buttons
  const tabSummary = document.getElementById("tabSummary");
  const tabDetail = document.getElementById("tabDetail");
  if (tabSummary) {
    tabSummary.addEventListener("click", (e) => {
      e.preventDefault();
      showSummaryView();
    });
  }
  if (tabDetail) {
    tabDetail.addEventListener("click", (e) => {
      e.preventDefault();
      if (!selectedSummary) return; // only allow if selection exists
      showDetailView();
    });
  }

  const detailUnassigned = document.getElementById("detailShowUnassignedOnly");
  if (detailUnassigned)
    detailUnassigned.addEventListener("change", renderIssueLines);
  const detailAllocated = document.getElementById("detailShowAllocatedOnly");
  if (detailAllocated)
    detailAllocated.addEventListener("change", renderIssueLines);
  const detailText = document.getElementById("detailTextSearch");
  if (detailText) detailText.addEventListener("input", renderIssueLines);

  const saveBtn = document.getElementById("saveChangesBtn");
  if (saveBtn) saveBtn.addEventListener("click", saveChanges);
  const reloadBtn = document.getElementById("reloadDetailBtn");
  if (reloadBtn)
    reloadBtn.addEventListener("click", () => loadIssueLinesForSelected());

  // header sort: allow sorting summary by clicking header (toggle asc/desc)
  document
    .querySelectorAll("#summaryTable thead th[data-key]")
    .forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.key;
        if (currentSortKey === key) {
          currentSortDir = currentSortDir === "asc" ? "desc" : "asc";
        } else {
          currentSortKey = key;
          // sensible defaults: numeric fields sort desc by default
          currentSortDir =
            key === "max_age_days" || key === "issued_pm_qty" ? "desc" : "asc";
        }
        applySummaryFiltersAndRender();
      });
    });

  // ageBucket control triggers client-side re-render
  const ageSel = document.getElementById("ageBucket");
  if (ageSel)
    ageSel.addEventListener("change", () => {
      currentPage = 0;
      applySummaryFiltersAndRender();
    });

  // Allocation status help popover (create once)
  const allocBtn = document.getElementById("allocHelpBtn");
  if (allocBtn && !allocPopover) {
    allocPopoverBtn = allocBtn;
    const pop = document.createElement("div");
    pop.id = "allocHelpPopover";
    pop.className = "help-popover";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-modal", "false");
    const titleId = "allocHelpTitle";
    pop.innerHTML = `
      <button id="allocHelpCloseBtn" class="help-close" type="button" aria-label="Close allocation help">×</button>
      <div id="${titleId}" style="font-weight:600;margin-bottom:6px">Allocation status — quick guide</div>
      <ul style="margin:0 0 8px 18px;padding:0">
        <li><strong>unassigned</strong> — Nothing confirmed yet. Product/SKU/Region missing or not decided.</li>
        <li><strong>exact</strong> — Confident allocation to the exact Product + SKU (+ optional Region).</li>
        <li><strong>by_batch</strong> — Allocation inferred based on Batch; SKU/Region may be refined later.</li>
        <li><strong>by_product</strong> — Product is known, but SKU/Region not final.</li>
        <li><strong>by_sku</strong> — SKU is known, but context like Region is not final or inferred.</li>
      </ul>
      <hr style="border:none;border-top:1px solid rgba(0,0,0,0.08);margin:8px 0">
      <div style="font-weight:600;margin-bottom:6px">Rule of thumb</div>
      <ul style="margin:0 0 0 18px;padding:0">
        <li>If you know product + sku confidently → exact</li>
        <li>If you only know product → by_product</li>
        <li>If you only know batch ties it → by_batch</li>
        <li>If you know sku but not full context → by_sku</li>
        <li>If nothing is confirmed → unassigned</li>
      </ul>
    `;
    pop.tabIndex = -1;
    pop.style.display = "none";
    document.body.appendChild(pop);
    allocPopover = pop;

    function positionPopover(btn, panel) {
      const rect = btn.getBoundingClientRect();
      // ensure panel has width measured
      panel.style.width = "auto";
      panel.style.maxWidth = "340px";
      panel.style.display = "block";
      panel.style.visibility = "hidden";
      const panelW = Math.min(panel.offsetWidth || 300, 340);
      panel.style.width = panelW + "px";
      panel.style.visibility = "visible";
      const panelH = panel.offsetHeight;
      let top = rect.bottom + 8;
      let left = rect.right - panelW;
      if (left < 8) left = 8;
      if (left + panelW > window.innerWidth - 8)
        left = Math.max(8, window.innerWidth - panelW - 8);
      if (top + panelH > window.innerHeight - 8) {
        top = rect.top - panelH - 8;
        if (top < 8) top = 8;
      }
      panel.style.top = `${top}px`;
      panel.style.left = `${left}px`;
      panel.style.position = "fixed";
    }

    function openAllocPopover() {
      if (!allocPopover) return;
      allocPopover.style.display = "block";
      allocPopoverBtn.setAttribute("aria-expanded", "true");
      positionPopover(allocPopoverBtn, allocPopover);
      allocPopover.focus();
      allocPopoverOpen = true;
    }

    function closeAllocPopover() {
      if (!allocPopover) return;
      allocPopover.style.display = "none";
      allocPopoverBtn.setAttribute("aria-expanded", "false");
      allocPopoverOpen = false;
    }

    allocBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (allocPopoverOpen) closeAllocPopover();
      else openAllocPopover();
    });

    document.addEventListener("click", (ev) => {
      if (!allocPopoverOpen) return;
      if (!allocPopover.contains(ev.target) && ev.target !== allocPopoverBtn)
        closeAllocPopover();
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && allocPopoverOpen) {
        ev.preventDefault();
        closeAllocPopover();
        allocPopoverBtn.focus();
      }
    });

    // Wire popover close button
    const allocCloseBtn = allocPopover.querySelector("#allocHelpCloseBtn");
    if (allocCloseBtn)
      allocCloseBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        closeAllocPopover();
        allocPopoverBtn.focus();
      });
  }
}

async function loadAndRenderSummary(opts = {}) {
  const { preserveSelection = false } = opts || {};
  const monthVal = document.getElementById("horizonMonth").value;
  const horizonStart =
    firstDayFromMonthInput(monthVal) || currentHorizonStart || null;
  if (!horizonStart) return;
  currentHorizonStart = horizonStart;
  // Clear any selected detail when reloading list (prevent stale detail)
  if (!preserveSelection) {
    selectedSummary = null;
    const tabDetail = document.getElementById("tabDetail");
    if (tabDetail) tabDetail.disabled = true;
    issueLines = [];
    issueSummary = null;
    editedRows.clear();
    showSummaryView();
  }
  await fetchSummary(horizonStart);
  // Ensure lookups are available so product names resolve on first render
  await Promise.all([loadProductLookup(), loadAllSkus()]);
  buildPmDropdown();
  // If deep-link provided a PM id, apply it now (dropdown options are built)
  if (pendingPmIdFromUrl) {
    const sel = document.getElementById("pmFilter");
    if (sel) {
      // set only if option exists
      const opt = Array.from(sel.options).find(
        (o) => o.value === String(pendingPmIdFromUrl)
      );
      if (opt) sel.value = String(pendingPmIdFromUrl);
    }
    pendingPmIdFromUrl = null;
  }
  applySummaryFiltersAndRender();
}

async function initFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const horizon = params.get("horizon_start");
  const stock_item_id = params.get("stock_item_id");
  const openFlag = params.get("open") === "1";
  if (horizon) {
    // set month input to YYYY-MM
    const mm = horizon.slice(0, 7);
    document.getElementById("horizonMonth").value = mm;
    currentHorizonStart = horizon;
  } else {
    // default to current month
    const now = new Date();
    document.getElementById(
      "horizonMonth"
    ).value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
  }
  // If deep-linked with a PM stock_item_id, pre-set pmFilter so the RPC will be restricted.
  if (stock_item_id) {
    // store pending id until dropdown options are built
    pendingPmIdFromUrl = stock_item_id;
  }

  await loadAndRenderSummary();

  // After first load, if deep-linked and results contain the PM, auto-select first match.
  if (stock_item_id) {
    const idx = filteredSummary.findIndex(
      (r) => String(r.pm_stock_item_id) === String(stock_item_id)
    );
    if (idx >= 0) {
      selectSummaryRow(idx);
      if (openFlag) showDetailView();
    }
  }
}

async function saveChanges() {
  if (editedRows.size === 0) {
    showToast("No changes to save", { type: "info", duration: 2400 });
    return;
  }

  // Build bulk changes array for RPC
  const lineById = new Map(issueLines.map((l) => [String(l.id), l]));

  const changesArray = Array.from(editedRows.entries()).map(([id, changes]) => {
    const base = lineById.get(String(id)) || {};

    const product_id =
      changes.product_id !== undefined ? changes.product_id : base.product_id;

    const sku_id = changes.sku_id !== undefined ? changes.sku_id : base.sku_id;

    const region_code =
      changes.region_code !== undefined
        ? changes.region_code
        : base.region_code;

    const allocation_status =
      changes.allocation_status !== undefined
        ? changes.allocation_status
        : base.allocation_status;

    const allocation_note =
      changes.allocation_note !== undefined
        ? changes.allocation_note
        : base.allocation_note;

    // If product cleared, sku must also be cleared (avoid inconsistent state)
    const finalProduct = product_id === "" ? null : product_id;
    const finalSku =
      finalProduct == null ? null : sku_id === "" ? null : sku_id;

    return {
      id,
      product_id: finalProduct == null ? null : Number(finalProduct),
      sku_id: finalSku == null ? null : Number(finalSku),
      region_code: region_code === "" ? null : region_code,
      allocation_status: allocation_status === "" ? null : allocation_status,
      allocation_note: allocation_note === "" ? null : allocation_note,
    };
  });

  showLoading();
  try {
    const { data, error } = await supabase.rpc("mrp_pm_issue_lines_save", {
      p_changes: changesArray,
    });
    if (error) {
      console.error("Bulk save RPC failed", error);
      showToast("Save failed (server error)", { type: "error" });
      return;
    }

    const updatedCount = data?.updated_count ?? 0;
    const failed = data?.failed || [];
    if (updatedCount > 0)
      showToast(`Saved ${updatedCount} changes`, {
        type: "success",
        duration: 2600,
      });
    if (failed.length) {
      showToast(`Saved with ${failed.length} failures`, {
        type: "warning",
        duration: 4200,
      });
      console.table(failed);
    }

    editedRows.clear();
    // refresh summary first (preserve selection), then reload detail
    await loadAndRenderSummary({ preserveSelection: true });
    if (selectedSummary) await loadIssueLinesForSelected();
  } catch (err) {
    console.error("Bulk save failed", err);
    showToast("Save failed", { type: "error" });
  } finally {
    hideLoading();
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  // Insert conditional Back button when opened from another page (return_to)
  try {
    insertBackButtonFromUrl();
  } catch (err) {
    // Use the caught error to satisfy linters; nothing else to do here
    void err;
  }

  // initialize shared helpers (modal + access context)
  try {
    await loadAccessContext();
  } catch (e) {
    console.debug("loadAccessContext failed", e);
  }
  try {
    ensureDetailModal();
  } catch (e) {
    console.debug("ensureDetailModal failed", e);
  }

  wireUp();
  await initFromUrl();
  // start in Summary view
  showSummaryView();

  // client-side gating: disable Save when user cannot edit PM
  try {
    const canEdit = canEditPM();
    const saveBtn = document.getElementById("saveChangesBtn");
    if (saveBtn) saveBtn.disabled = !canEdit;
  } catch (e) {
    void e;
  }
});

// Insert a conditional Back button into the header when the URL contains
// a `return_to` parameter. Optional `return_label` parameter customises text.
function insertBackButtonFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get("return_to");
  if (!returnTo) return; // nothing to do
  // Avoid duplicating the button if already inserted
  if (document.getElementById("backToBtn")) {
    return;
  }

  const returnLabel = params.get("return_label") || "Back";
  const headerActions = document.querySelector(".header-actions");
  if (!headerActions) return;

  const homeBtn = document.getElementById("homeBtn");

  // Ensure a small stylesheet for the injected back button so it looks like
  // other ERP-style action buttons and has spacing from the HOME button.
  if (!document.getElementById("backBtnStyles")) {
    const s = document.createElement("style");
    s.id = "backBtnStyles";
    s.textContent = `
      .back-btn{
        display:inline-flex;
        align-items:center;
        gap:6px;
        padding:6px 10px;
        border-radius:6px;
        border:1px solid rgba(0,0,0,0.08);
        background:#f7fafc;
        color:#111827;
        font-weight:600;
        margin-right:8px;
        cursor:pointer;
      }
      .back-btn:hover{ background:#eef2f7; }
    `;
    document.head.appendChild(s);
  }

  const btn = document.createElement("button");
  btn.id = "backToBtn";
  btn.type = "button";
  // keep existing link-btn semantics but add back-btn for styling
  btn.className = "link-btn back-btn";
  btn.setAttribute("aria-label", `Back to ${returnLabel}`);
  btn.textContent = `← ${returnLabel}`;
  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    // Navigate to the provided return_to (URLSearchParams decodes percent-encoding)
    window.location.href = returnTo;
  });

  // Insert before the HOME button when possible; the .back-btn has right margin
  if (homeBtn && homeBtn.parentNode === headerActions) {
    headerActions.insertBefore(btn, homeBtn);
  } else {
    headerActions.insertBefore(btn, headerActions.firstChild);
  }
}

// Defensive: ensure `horizonMonth` change/input always triggers a reload
// even if `wireUp()` fails to attach listeners for some reason.
// This is idempotent and sets a small marker on the element to avoid dupe handlers.
(function ensureHorizonMonthListener() {
  try {
    const el = document.getElementById("horizonMonth");
    if (!el) return;
    if (el.dataset._pmMonthListener) return;
    el.addEventListener("change", () => {
      currentPage = 0;
      selectedSummary = null;
      pendingPmIdFromUrl = null;
      // preserveSelection false ensures detail is cleared
      void loadAndRenderSummary({ preserveSelection: false });
    });
    el.addEventListener("input", () => {
      currentPage = 0;
      void loadAndRenderSummary({ preserveSelection: false });
    });
    el.dataset._pmMonthListener = "1";
  } catch (err) {
    void err;
  }
})();
