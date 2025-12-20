import { supabase } from "./supabaseClient.js";
import { showToast } from "./toast.js";

// Simple PLM Issue Allocation console
// - Summary sourced from `v_mrp_plm_issue_monthly_allocated` (horizon_start)
// - Issue lines from `mrp_plm_issue_lines` (editable)
// TODO: add product/sku lookup dropdowns, bulk actions

let summaryRows = [];
let filteredSummary = [];
let selectedSummary = null; // object representing selected summary row
let issueLines = []; // all lines loaded for selected PLM+month
let editedRows = new Map(); // id -> { ...modified fields }
let currentHorizonStart = null;
// lookups
let productsList = [];
let skusByProduct = new Map(); // product_id -> [{id, name}]
let skuById = new Map(); // sku_id -> { id, name, product_id }

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

async function fetchSummary(horizonStart) {
  // fetch rows for this month
  const { data, error } = await supabase
    .from("v_mrp_plm_issue_monthly_enriched")
    .select("*")
    .eq("horizon_start", horizonStart);
  if (error) {
    console.error("Failed loading PLM summary", error);
    summaryRows = [];
    return;
  }
  summaryRows = data || [];

  // load lookup tables needed for editable dropdowns
  await loadProductLookup();
  await loadAllSkus();
}

// best-effort product list loader
async function loadProductLookup() {
  try {
    // products table uses 'item' or 'malayalam_name' for display — load both
    const { data, error } = await supabase
      .from("products")
      .select("id,item,malayalam_name")
      .order("item");
    if (!error && data) {
      // If SKU catalog already populated `productsList`, prefer those names (richer).
      if (!productsList || productsList.length === 0) {
        productsList = data.map((p) => ({
          id: p.id,
          name: p.item || p.malayalam_name || null,
        }));
      } else {
        // merge any missing names from products table
        data.forEach((p) => {
          const existing = productsList.find(
            (x) => Number(x.id) === Number(p.id)
          );
          if (!existing)
            productsList.push({
              id: p.id,
              name: p.item || p.malayalam_name || null,
            });
          else if (!existing.name && (p.item || p.malayalam_name))
            existing.name = p.item || p.malayalam_name;
        });
      }
    } else {
      productsList = [];
    }
  } catch (err) {
    console.error("Product lookup failed", err);
    productsList = [];
  }
}

// PLM lookups removed — enriched view provides plm_code, plm_name and plm_uom_code

function buildPlmDropdown() {
  const sel = document.getElementById("plmFilter");
  if (!sel) return;
  // Preserve the first "All" option
  const first = sel.querySelector("option[value='']");
  sel.innerHTML = "";
  if (first) sel.appendChild(first);

  const seen = new Set();
  summaryRows.forEach((r) => {
    const rawId = r.plm_stock_item_id;
    if (!rawId) return;
    const id = String(rawId);
    if (seen.has(id)) return;
    seen.add(id);

    const label = getPlmLabel(r);
    const o = document.createElement("option");
    o.value = id;
    o.textContent = label;
    sel.appendChild(o);
  });
}

// load SKUs and group by product (used for the editable dropdowns in detail)
async function loadAllSkus() {
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
function getPlmLabel(row) {
  const code = row.plm_code || String(row.plm_stock_item_id || "");
  const name = row.plm_name || "";
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
  const plm = document.getElementById("plmFilter").value;
  const onlyUnassigned = document.getElementById("filterUnassigned").checked;
  const onlyApprox = document.getElementById("filterApprox").checked;
  const q = (document.getElementById("textSearch").value || "")
    .trim()
    .toLowerCase();

  filteredSummary = summaryRows.filter((r) => {
    if (plm && String(r.plm_stock_item_id) !== plm) return false;
    if (onlyUnassigned && !r.has_unassigned_issues) return false;
    if (onlyApprox && !r.allocation_approx) return false;
    if (q) {
      const prod = (getProductLabel(r) || "").toLowerCase();
      const sku = (getSkuLabel(r) || "").toLowerCase();
      const region = String(r.region_code || "").toLowerCase();
      const plm = getPlmLabel(r).toLowerCase();
      if (
        !prod.includes(q) &&
        !sku.includes(q) &&
        !region.includes(q) &&
        !plm.includes(q)
      )
        return false;
    }
    return true;
  });

  // default sort: issued_plm_qty desc
  filteredSummary.sort(
    (a, b) => Number(b.issued_plm_qty || 0) - Number(a.issued_plm_qty || 0)
  );
  renderSummaryTable();
}

function renderSummaryTable() {
  const tbody = document.getElementById("summaryBody");
  tbody.innerHTML = "";
  document.getElementById("rowCount").textContent = filteredSummary.length;

  filteredSummary.forEach((r, idx) => {
    const tr = document.createElement("tr");
    tr.tabIndex = 0;
    const plmDisplay = getPlmLabel(r);
    const combo = getCombinationLabel(r);
    const rowUom = r.plm_uom_code || "";

    tr.innerHTML = `
      <td>${escapeHtml(plmDisplay)}</td>
      <td>${escapeHtml(combo)}</td>
      <td style="text-align:right">${formatNumber(
        r.issued_plm_qty
      )} ${escapeHtml(rowUom)}</td>
      <td>${
        r.allocation_approx ? '<span class="badge-info">Approx</span>' : ""
      }${
      r.has_unassigned_issues
        ? '<span class="badge-warning"> Unassigned</span>'
        : ""
    }</td>
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
  const plmLabel = getPlmLabel(selectedSummary);
  const comboLabel = getCombinationLabel(selectedSummary);
  header.textContent = `PLM: ${plmLabel} • ${comboLabel} • ${monthDisplayFromHorizon(
    selectedSummary.horizon_start
  )}`;
  await loadIssueLinesForSelected();
}

async function loadIssueLinesForSelected() {
  if (!selectedSummary) return;
  // load all lines for this PLM + month
  const start = selectedSummary.horizon_start;
  const end = selectedSummary.horizon_end || start; // fallback
  const { data, error } = await supabase
    .from("mrp_plm_issue_lines")
    .select("*")
    .eq("plm_stock_item_id", selectedSummary.plm_stock_item_id)
    .gte("issue_date", start)
    .lte("issue_date", end)
    .order("issue_date", { ascending: true });

  if (error) {
    console.error("Failed to load issue lines", error);
    issueLines = [];
    renderIssueLines();
    return;
  }
  issueLines = data || [];
  // reset edited state
  editedRows.clear();
  renderIssueLines();
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
  issueLines.forEach((l) => {
    totalIssued += Number(l.qty_issued || 0);
    if (l.allocation_status === "unassigned")
      unassignedSum += Number(l.qty_issued || 0);
  });

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

  // metrics
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
  const uom = selectedSummary.plm_uom_code || "";
  metrics.textContent = `Month: ${monthDisplayFromHorizon(
    selectedSummary.horizon_start
  )} • Total issued: ${formatNumber(
    totalIssued
  )} ${uom} • Allocated to this: ${formatNumber(
    allocatedToThis
  )} • Allocated to others: ${formatNumber(
    allocatedOthers
  )} • Unassigned: ${formatNumber(unassignedSum)}`;

  linesToShow.forEach((l) => {
    const tr = document.createElement("tr");
    tr.dataset.id = l.id;

    const lineUom = selectedSummary?.plm_uom_code || "";

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

    // populate product options
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
    } else {
      const o = document.createElement("option");
      o.value = String(l.product_id ?? "");
      o.textContent = String(l.product_id ?? "");
      prodSel.appendChild(o);
    }
    prodSel.value = l.product_id == null ? "" : String(l.product_id);

    function populateSkuFor(productId) {
      skuSel.innerHTML = "";
      const emptyS = document.createElement("option");
      emptyS.value = "";
      emptyS.textContent = "";
      skuSel.appendChild(emptyS);
      const list = skusByProduct.get(String(productId)) || [];
      if (list.length)
        list.forEach((s) => {
          const o = document.createElement("option");
          o.value = String(s.id);
          o.textContent = s.name ? `${s.id} - ${s.name}` : String(s.id);
          skuSel.appendChild(o);
        });
      else {
        const o = document.createElement("option");
        o.value = String(l.sku_id ?? "");
        o.textContent = String(l.sku_id ?? "");
        skuSel.appendChild(o);
      }
      skuSel.value = l.sku_id == null ? "" : String(l.sku_id);
    }

    populateSkuFor(l.product_id);

    // wire editing
    tr.querySelectorAll("[data-field]").forEach((inp) => {
      inp.addEventListener("change", () => {
        const field = inp.dataset.field;
        const val = inp.value === "" ? null : inp.value;
        const id = l.id;
        const existing = editedRows.get(id) || {};
        existing[field] = val;
        editedRows.set(id, existing);
        tr.classList.add("dirty");
        if (field === "product_id") populateSkuFor(val);
      });
    });

    tbody.appendChild(tr);
  });
}

function wireUp() {
  document
    .getElementById("homeBtn")
    .addEventListener(
      "click",
      () => (window.location.href = "../../index.html")
    );
  document.getElementById("clearFilters").addEventListener("click", () => {
    document.getElementById("plmFilter").value = "";
    document.getElementById("filterUnassigned").checked = false;
    document.getElementById("filterApprox").checked = false;
    document.getElementById("textSearch").value = "";
    loadAndRenderSummary();
  });

  ["plmFilter", "filterUnassigned", "filterApprox"].forEach((id) =>
    document
      .getElementById(id)
      .addEventListener("change", applySummaryFiltersAndRender)
  );
  document
    .getElementById("textSearch")
    .addEventListener("input", applySummaryFiltersAndRender);

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

  document
    .getElementById("detailShowUnassignedOnly")
    .addEventListener("change", renderIssueLines);
  document
    .getElementById("detailShowAllocatedOnly")
    .addEventListener("change", renderIssueLines);
  document
    .getElementById("detailTextSearch")
    .addEventListener("input", renderIssueLines);

  document
    .getElementById("saveChangesBtn")
    .addEventListener("click", saveChanges);
  document
    .getElementById("reloadDetailBtn")
    .addEventListener("click", () => loadIssueLinesForSelected());

  // header sort: allow sorting summary by clicking header (simple implementation)
  document
    .querySelectorAll("#summaryTable thead th[data-key]")
    .forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.key;
        filteredSummary.sort((a, b) => {
          if (key === "issued_plm_qty")
            return (
              Number(b.issued_plm_qty || 0) - Number(a.issued_plm_qty || 0)
            );
          if (key === "plm_display") {
            const sa = getPlmLabel(a).toLowerCase();
            const sb = getPlmLabel(b).toLowerCase();
            return sa.localeCompare(sb);
          }
          if (key === "combination") {
            const sa = getCombinationLabel(a).toLowerCase();
            const sb = getCombinationLabel(b).toLowerCase();
            return sa.localeCompare(sb);
          }
          const sa = String(a[key] || "").toLowerCase();
          const sb = String(b[key] || "").toLowerCase();
          return sa.localeCompare(sb);
        });
        renderSummaryTable();
      });
    });
}

async function loadAndRenderSummary() {
  const monthVal = document.getElementById("horizonMonth").value;
  const horizonStart =
    firstDayFromMonthInput(monthVal) || currentHorizonStart || null;
  if (!horizonStart) return;
  currentHorizonStart = horizonStart;
  await fetchSummary(horizonStart);
  buildPlmDropdown();
  applySummaryFiltersAndRender();
}

async function initFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const horizon = params.get("horizon_start");
  const stock_item_id = params.get("stock_item_id");
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
  await loadAndRenderSummary();
  if (stock_item_id) {
    // try to preselect after dropdown built
    const sel = document.getElementById("plmFilter");
    sel.value = stock_item_id;
    applySummaryFiltersAndRender();
  }
}

async function saveChanges() {
  if (editedRows.size === 0) {
    showToast("No changes to save", { type: "info", duration: 2400 });
    return;
  }
  const promises = [];
  const failed = [];
  for (const [id, changes] of editedRows.entries()) {
    const payload = { ...changes };
    // normalize empty strings to null for numeric fields
    if (payload.product_id === "") payload.product_id = null;
    if (payload.sku_id === "") payload.sku_id = null;
    if (payload.region_code === "") payload.region_code = null;

    promises.push(
      supabase
        .from("mrp_plm_issue_lines")
        .update(payload)
        .eq("id", id)
        .then((res) => {
          if (res.error) failed.push({ id, error: res.error });
        })
        .catch((err) => {
          failed.push({ id, error: err });
        })
    );
  }

  await Promise.all(promises);
  if (failed.length === 0) {
    showToast(`Saved ${promises.length} changes`, {
      type: "success",
      duration: 2600,
    });
    editedRows.clear();
    // reload summary and detail
    await loadAndRenderSummary();
    if (selectedSummary) await loadIssueLinesForSelected();
  } else {
    console.error("Save failures", failed);
    showToast(
      `Saved with ${failed.length} failures. See console for details.`,
      { type: "error", duration: 4200 }
    );
    // reload what succeeded
    await loadAndRenderSummary();
    if (selectedSummary) await loadIssueLinesForSelected();
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  wireUp();
  await initFromUrl();
  // start in Summary view
  showSummaryView();
});
