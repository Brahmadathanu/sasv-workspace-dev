import { supabase } from "./supabaseClient.js";
import { showToast } from "./toast.js";

// Toggle debug traces for this module
const DEBUG = false;

// Simple RM Issue Allocation console (parity of PM implementation)
// - Summary sourced from RPC `mrp_rm_allocation_console` (LIST mode)
// - Detail via same RPC with p_stock_item_id (DETAIL mode)
// - Issue lines editable and saved via `mrp_rm_issue_lines_save`

let summaryRows = [];
let filteredSummary = [];
let selectedSummary = null;
let issueLines = [];
let editedRows = new Map();
let currentHorizonStart = null;
let pendingRmIdFromUrl = null;
let issueSummary = null;
let productsList = [];
let skusByProduct = new Map();
let skuById = new Map();
let currentPage = 0;
let pageSize = 200;
let totalCount = 0;
let currentSortKey = null;
let currentSortDir = null;
let productLookupLoaded = false;
let skuLookupLoaded = false;
let searchDebounceTimer = null;
const DEBUG_LOOKUPS = false;
let allocPopover = null;
let allocPopoverBtn = null;
let allocPopoverOpen = false;

function formatNumber(n) {
  if (n === null || n === undefined) return "";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function firstDayFromMonthInput(val) {
  if (!val) return null;
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

// Robust converters
function toBool(v) {
  if (v === true || v === false) return v;
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (s === "true" || s === "t" || s === "1") return true;
  if (s === "false" || s === "f" || s === "0") return false;
  // fallback for numeric-ish values
  const n = Number(s);
  if (!Number.isNaN(n)) return Boolean(n);
  return null;
}

function toNum(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Normalize RPC payloads that may be wrapped in a single-element array
function normalizeRpcPayload(data) {
  return Array.isArray(data) && data.length === 1 ? data[0] : data;
}

function validateListPayload(payload, rawRows) {
  if (!payload) return false;
  if (payload.mode && payload.mode !== "list") {
    if (DEBUG)
      console.warn(
        "[rm-issue-allocation] expected list mode but got:",
        payload.mode
      );
  }
  if (!Array.isArray(rawRows)) {
    if (DEBUG)
      console.warn("[rm-issue-allocation] payload.rows is not an array");
    return false;
  }
  return true;
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
  showLoading();
  try {
    const onlyUnassigned = document.getElementById("filterUnassigned")
      ? document.getElementById("filterUnassigned").checked
      : false;
    const onlyApprox = document.getElementById("filterApprox")
      ? document.getElementById("filterApprox").checked
      : false;
    const q = (document.getElementById("textSearch").value || "").trim();

    const params = {
      p_horizon_start: horizonStart,
      p_stock_item_id: null,
      p_only_unassigned: Boolean(onlyUnassigned),
      p_only_approx: Boolean(onlyApprox),
      p_q: q || null,
      p_offset: currentPage * pageSize,
      p_limit: pageSize,
    };

    let rpcName = "mrp_rm_allocation_console";
    let { data, error } = await supabase.rpc(rpcName, params);

    if (error && error.code === "PGRST202" && error.hint) {
      console.warn("RPC function not found; server hint:", error.hint);
      const m = error.hint.match(/call the function ([\w.]+)\(([^)]*)\)/i);
      if (m) {
        const suggestedFull = m[1];
        const suggestedName = suggestedFull.split(".").pop();
        const suggestedParamsText = m[2];
        const paramMatches = suggestedParamsText.match(/p_[a-z0-9_]+/gi) || [];
        const baseValues = {
          p_horizon_start: horizonStart,
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
        }
      }
    }

    if (error) {
      console.error("Failed loading RM summary (RPC)", error);
      showToast("Failed to load summary — check RPC name/params", {
        type: "error",
      });
      summaryRows = [];
      totalCount = 0;
      filteredSummary = [];
      hideLoading();
      return;
    }

    // Normalize payload: RPC may return [{ total_count, rows }] or direct { total_count, rows }
    const payload = normalizeRpcPayload(data);
    if (!payload) {
      summaryRows = [];
      totalCount = 0;
    } else {
      // rows may be present, or payload itself may be an array of rows
      let rawRows = [];
      if (Array.isArray(payload.rows)) rawRows = payload.rows;
      else if (Array.isArray(payload)) rawRows = payload;
      else if (
        Array.isArray(data) &&
        data.length > 0 &&
        Array.isArray(data[0].rows)
      )
        rawRows = data[0].rows;
      else rawRows = [];

      totalCount = toNum(payload.total_count) || rawRows.length || 0;
      // clamp if server returned inconsistent total_count
      if (totalCount < rawRows.length) {
        if (DEBUG)
          console.warn(
            "[rm-issue-allocation] total_count < rows.length, clamping",
            { totalCount, rows: rawRows.length }
          );
        totalCount = rawRows.length;
      }

      // Instrumentation: log a small sample and keys in DEBUG mode
      if (DEBUG) {
        const sample = rawRows.slice(0, 2);
        console.debug("[rm-issue-allocation] RPC sample rows:", sample);
        if (sample[0])
          console.debug(
            "[rm-issue-allocation] row keys:",
            Object.keys(sample[0])
          );
      }

      // Required fields to validate presence
      const required = [
        "needs_attention",
        "has_unassigned_issues",
        "allocation_approx",
        "oldest_issue_date",
        "max_age_days",
        "unassigned_qty",
        "approx_qty",
        "issued_rm_qty",
        "rm_stock_item_id",
        "rm_code",
        "rm_name",
      ];

      // Validate payload shape (DEBUG-only warnings)
      validateListPayload(payload, rawRows);

      // Warn once per-load if fields missing in sample
      (function warnMissing() {
        if (!rawRows || rawRows.length === 0) return;
        const first = rawRows[0];
        const missing = required.filter((k) => first[k] === undefined);
        if (missing.length)
          console.warn("[rm-issue-allocation] RPC missing fields:", missing);
      })();

      // Normalize rows into consistent typed fields
      summaryRows = rawRows.map((r) => {
        const needs = toBool(r.needs_attention);
        const hasUnassigned = toBool(r.has_unassigned_issues);
        const approx = toBool(r.allocation_approx);
        const unassigned_qty = toNum(r.unassigned_qty);
        const approx_qty = toNum(r.approx_qty);
        const issued_rm_qty = toNum(r.issued_rm_qty);
        const max_age_days = toNum(r.max_age_days);

        // derive needs_attention if server didn't provide it
        const needs_attention =
          needs == null
            ? !!(
                hasUnassigned ||
                approx ||
                unassigned_qty > 0 ||
                approx_qty > 0
              )
            : !!needs;

        return Object.assign({}, r, {
          needs_attention,
          has_unassigned_issues: hasUnassigned == null ? false : hasUnassigned,
          allocation_approx: approx == null ? false : approx,
          unassigned_qty,
          approx_qty,
          issued_rm_qty,
          max_age_days,
        });
      });
    }
  } catch (err) {
    console.error("Failed loading RM summary", err);
    showToast("Failed to load summary", { type: "error" });
    summaryRows = [];
    totalCount = 0;
  } finally {
    hideLoading();
  }
}

async function loadProductLookup() {
  if (productLookupLoaded) return;
  const pageSize = 1000;
  let from = 0;
  const map = new Map();
  try {
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

function buildRmDropdown() {
  const sel = document.getElementById("rmFilter");
  if (!sel) return;
  const first = sel.querySelector("option[value='']");
  sel.innerHTML = "";
  if (first) sel.appendChild(first);
  const seen = new Set();
  summaryRows.forEach((r) => {
    const rawId = r.rm_stock_item_id;
    if (!rawId) return;
    const id = String(rawId);
    if (seen.has(id)) return;
    seen.add(id);
    const label = getRmLabel(r);
    const o = document.createElement("option");
    o.value = id;
    o.textContent = label;
    sel.appendChild(o);
  });
}

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

function getRmLabel(row) {
  const code = row.rm_code || String(row.rm_stock_item_id || "");
  const name = row.rm_name || "";
  if (code && name) return `${code} — ${name}`;
  if (name) return name;
  return code || "";
}

function getProductLabel(row) {
  if (row.product_name) return row.product_name;
  if (row.product_id != null) {
    const pid = Number(row.product_id);
    const found = productsList.find((p) => Number(p.id) === pid);
    if (found && found.name) return found.name;
    return `Product ${row.product_id}`;
  }
  return null;
}

function getSkuLabel(row) {
  if (row.sku_name) return row.sku_name;
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
  const rmId = document.getElementById("rmFilter")?.value || "";
  const needsOnly =
    document.getElementById("filterNeedsAttention")?.checked || false;
  const ageBucket = document.getElementById("ageBucket")?.value || "";
  filteredSummary = summaryRows.filter((r) => {
    if (needsOnly && !r.needs_attention) return false;
    if (rmId && String(r.rm_stock_item_id) !== String(rmId)) return false;
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

  if (currentSortKey) {
    const key = currentSortKey;
    const dir = currentSortDir === "asc" ? 1 : -1;
    filteredSummary.sort((a, b) => {
      if (key === "issued_rm_qty")
        return (
          dir * (Number(a.issued_rm_qty || 0) - Number(b.issued_rm_qty || 0))
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
      if (key === "pm_display" || key === "rm_display") {
        const sa = getRmLabel(a).toLowerCase();
        const sb = getRmLabel(b).toLowerCase();
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
      (a, b) => Number(b.issued_rm_qty || 0) - Number(a.issued_rm_qty || 0)
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
    const rmDisplay = getRmLabel(r);
    const combo = getCombinationLabel(r);
    const rowUom = r.rm_uom_code || "";

    let flagsHtml = "";
    const hasOldest = !!r.oldest_issue_date;
    const hasMaxAge = r.max_age_days != null;
    const hasAnyMetrics =
      r.has_unassigned_issues !== undefined ||
      r.unassigned_qty != null ||
      r.approx_qty != null ||
      r.issued_rm_qty != null ||
      hasOldest ||
      hasMaxAge;

    if (r.needs_attention) {
      if (r.has_unassigned_issues)
        flagsHtml += '<span class="badge-warning">Unassigned</span>';
      if (r.allocation_approx)
        flagsHtml +=
          (flagsHtml ? " " : "") + '<span class="badge-info">Approx</span>';
    } else if (!hasAnyMetrics) {
      // Server didn't provide any relevant fields — surface a warning badge
      flagsHtml = '<span class="badge-warning">RPC missing fields</span>';
    } else {
      flagsHtml = '<span class="badge-success">Clean</span>';
    }

    let agingHtml = "—";
    if (r.needs_attention && hasOldest) {
      const unassigned = formatNumber(r.unassigned_qty ?? 0);
      const approx = formatNumber(r.approx_qty ?? 0);
      agingHtml = `
        <div>Oldest: ${escapeHtml(r.oldest_issue_date)} (${String(
        r.max_age_days ?? ""
      )}d)</div>
        <div>Unassigned: ${escapeHtml(unassigned)} • Approx: ${escapeHtml(
        approx
      )}</div>`;
    } else if (hasMaxAge) {
      agingHtml = `Age: ${String(r.max_age_days)}d`;
    }

    tr.innerHTML = `
      <td>${escapeHtml(rmDisplay)}</td>
      <td>${escapeHtml(combo)}</td>
      <td style="text-align:right">${formatNumber(
        r.issued_rm_qty
      )} ${escapeHtml(rowUom)}</td>
      <td>${agingHtml}</td>
      <td>${flagsHtml}</td>
      <td><button class="link-btn view-lines">View issue lines</button></td>
    `;

    tr.addEventListener("click", () => selectSummaryRow(idx));
    tr.querySelector(".view-lines").addEventListener("click", (e) => {
      e.stopPropagation();
      selectSummaryRow(idx);
      showDetailView();
    });
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter") selectSummaryRow(idx);
    });

    tbody.appendChild(tr);
  });

  // Post-render sanity check
  try {
    const domCount = document.querySelectorAll("#summaryBody tr").length;
    if (domCount !== filteredSummary.length) {
      if (DEBUG)
        console.warn(
          "[rm-issue-allocation] renderSummaryTable: DOM rows mismatch",
          { domCount, filtered: filteredSummary.length }
        );
    }
  } catch {
    void 0;
  }
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
  document
    .querySelectorAll("#summaryBody tr")
    .forEach((tr, i) => tr.classList.toggle("selected", i === idx));
  const tabDetail = document.getElementById("tabDetail");
  if (tabDetail) tabDetail.disabled = false;
  const header = document.getElementById("detailHeader");
  const rmLabel = getRmLabel(selectedSummary);
  const comboLabel = getCombinationLabel(selectedSummary);
  header.textContent = `RM: ${rmLabel} • ${comboLabel} • ${monthDisplayFromHorizon(
    selectedSummary.horizon_start
  )}`;
  await loadProductLookup();
  await loadAllSkus();
  await loadIssueLinesForSelected();
}

async function loadIssueLinesForSelected() {
  if (!selectedSummary) return;
  await loadProductLookup();
  await loadAllSkus();
  showLoading();
  try {
    const params = {
      p_horizon_start: selectedSummary.horizon_start,
      p_stock_item_id:
        selectedSummary.rm_stock_item_id || selectedSummary.plm_stock_item_id,
      p_q: null,
      p_only_unassigned: false,
      p_only_approx: false,
      p_offset: 0,
      p_limit: 200,
    };

    const { data, error } = await supabase.rpc(
      "mrp_rm_allocation_console",
      params
    );
    if (error) {
      console.error("Failed loading RM detail (RPC)", error);
      showToast("Failed to load issue lines (detail)", { type: "error" });
      issueLines = [];
      issueSummary = null;
      renderIssueLines();
      return;
    }

    const payload = normalizeRpcPayload(data);
    if (!payload) {
      console.error("Empty RPC detail payload", data);
      showToast("Unexpected RPC response (empty)", { type: "error" });
      return;
    }
    if (payload.mode && payload.mode !== "detail") {
      console.error("RPC did not return detail mode", payload);
      showToast("Unexpected RPC response (not detail mode)", { type: "error" });
      return;
    }

    // Accept `issued` array or fallback to `rows` if server returned rows
    issueLines = Array.isArray(payload.issued)
      ? payload.issued
      : Array.isArray(payload.rows)
      ? payload.rows
      : [];
    issueSummary = payload.issues || payload.issue_summary || {};
    editedRows.clear();
    renderIssueLines();
  } catch (err) {
    console.error("Failed loading RM detail", err);
    showToast("Failed to load issue lines", { type: "error" });
    issueLines = [];
    issueSummary = null;
    renderIssueLines();
  } finally {
    hideLoading();
  }
}

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
  const uom = selectedSummary.rm_uom_code || "";
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
    const lineUom = selectedSummary?.rm_uom_code || "";

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
      const rmSel = document.getElementById("rmFilter");
      if (rmSel) rmSel.value = "";
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
      pendingRmIdFromUrl = null;
      loadAndRenderSummary({ preserveSelection: false });
    });
    // Optional: refresh immediately while picking (better UX)
    horizonMonthEl.addEventListener("input", () => {
      currentPage = 0;
      loadAndRenderSummary({ preserveSelection: false });
    });
  }

  const rmSel = document.getElementById("rmFilter");
  if (rmSel) rmSel.addEventListener("change", applySummaryFiltersAndRender);

  const fna = document.getElementById("filterNeedsAttention");
  if (fna) fna.addEventListener("change", applySummaryFiltersAndRender);

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

  const tabSummary = document.getElementById("tabSummary");
  const tabDetail = document.getElementById("tabDetail");
  if (tabSummary)
    tabSummary.addEventListener("click", (e) => {
      e.preventDefault();
      showSummaryView();
    });
  if (tabDetail)
    tabDetail.addEventListener("click", (e) => {
      e.preventDefault();
      if (!selectedSummary) return;
      showDetailView();
    });

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

  document
    .querySelectorAll("#summaryTable thead th[data-key]")
    .forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.key;
        if (currentSortKey === key) {
          currentSortDir = currentSortDir === "asc" ? "desc" : "asc";
        } else {
          currentSortKey = key;
          currentSortDir =
            key === "max_age_days" || key === "issued_rm_qty" ? "desc" : "asc";
        }
        applySummaryFiltersAndRender();
      });
    });

  const ageSel = document.getElementById("ageBucket");
  if (ageSel)
    ageSel.addEventListener("change", () => {
      currentPage = 0;
      applySummaryFiltersAndRender();
    });

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
  await Promise.all([loadProductLookup(), loadAllSkus()]);
  buildRmDropdown();
  if (pendingRmIdFromUrl) {
    const sel = document.getElementById("rmFilter");
    if (sel) {
      const opt = Array.from(sel.options).find(
        (o) => o.value === String(pendingRmIdFromUrl)
      );
      if (opt) sel.value = String(pendingRmIdFromUrl);
    }
    pendingRmIdFromUrl = null;
  }
  applySummaryFiltersAndRender();
}

async function initFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const horizon = params.get("horizon_start");
  const stock_item_id = params.get("stock_item_id");
  const openFlag = params.get("open") === "1";
  if (horizon) {
    const mm = horizon.slice(0, 7);
    document.getElementById("horizonMonth").value = mm;
    currentHorizonStart = horizon;
  } else {
    const now = new Date();
    document.getElementById(
      "horizonMonth"
    ).value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
  }
  if (stock_item_id) {
    pendingRmIdFromUrl = stock_item_id;
  }

  await loadAndRenderSummary();

  if (stock_item_id) {
    const idx = filteredSummary.findIndex(
      (r) => String(r.rm_stock_item_id) === String(stock_item_id)
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
    const { data, error } = await supabase.rpc("mrp_rm_issue_lines_save", {
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
  try {
    insertBackButtonFromUrl();
  } catch (err) {
    void err;
  }

  wireUp();
  await initFromUrl();
  showSummaryView();
});

function insertBackButtonFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get("return_to");
  if (!returnTo) return;
  if (document.getElementById("backToBtn")) return;
  const returnLabel = params.get("return_label") || "Back";
  const headerActions = document.querySelector(".header-actions");
  if (!headerActions) return;
  const homeBtn = document.getElementById("homeBtn");
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
  btn.className = "link-btn back-btn";
  btn.setAttribute("aria-label", `Back to ${returnLabel}`);
  btn.textContent = `← ${returnLabel}`;
  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    window.location.href = returnTo;
  });

  if (homeBtn && homeBtn.parentNode === headerActions) {
    headerActions.insertBefore(btn, homeBtn);
  } else {
    headerActions.insertBefore(btn, headerActions.firstChild);
  }
}
