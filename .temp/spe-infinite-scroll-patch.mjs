import fs from "fs";

const path = "public/shared/js/stock-purchase-explorer.js";
let s = fs.readFileSync(path, "utf8");
const start = s.indexOf("function renderOverviewTable(rows) {");
const end = s.indexOf(
  "// Adjust the table card height so it fits within the viewport",
);
if (start < 0 || end < 0) {
  console.error("markers not found", start, end);
  process.exit(1);
}

const replacement = `function overviewRowHtml(row) {
  return \`<tr data-id="\${row.inv_stock_item_id}"\${
    row.inv_stock_item_id === state.selectedItemId ? " class='selected'" : ""
  }>
      <td style="vertical-align:middle; text-align:center">\${row.code}</td>
      <td style="vertical-align:middle; text-align:left">\${row.name}</td>
      <td style="vertical-align:middle; text-align:center">\${getRowUOM(row)}</td>
      <td style="vertical-align:middle; text-align:center">\${formatClassification(row)}</td>
      <td style="vertical-align:middle; text-align:right">\${formatIndianNumber(row.current_stock_qty)}</td>
      <td style="vertical-align:middle; text-align:right">\${formatCurrencyINR(row.current_stock_rate)}</td>
      <td style="vertical-align:middle; text-align:right">\${formatIndianNumber(row.total_purchased_qty)}</td>
      <td style="vertical-align:middle; text-align:right">\${formatCurrencyINR(row.avg_purchase_rate)}</td>
      <td style="vertical-align:middle; text-align:right">\${formatIndianNumber(row.total_consumed_qty)}</td>
      <td style="vertical-align:middle; text-align:center">\${row.months_with_usage ?? "–"}</td>
      <td style="vertical-align:middle; text-align:center">\${row.last_purchase_date ?? "–"}</td>
    </tr>\`;
}

function bindOverviewRowClicks() {
  tableArea.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.onclick = () => {
      state.selectedItemId = tr.getAttribute("data-id");
      selectTableRow(tr);
    };
  });
}

function renderOverviewTable(rows, totalCount = 0, opts = {}) {
  const append = !!opts.append;
  if (!append) {
    if (!rows || !rows.length) return renderNoData();
    tableArea.innerHTML = \`<table><thead><tr>
    <th style="vertical-align:middle; text-align:center">Code</th>
    <th style="vertical-align:middle; text-align:center">Name</th>
    <th style="vertical-align:middle; text-align:center">UOM</th>
    <th style="vertical-align:middle; text-align:center">Classification</th>
    <th style="vertical-align:middle; text-align:center">Current Stock Qty</th>
    <th style="vertical-align:middle; text-align:center">Current Stock Rate</th>
    <th style="vertical-align:middle; text-align:center">Total Purchased Qty</th>
    <th style="vertical-align:middle; text-align:center">Avg Purchase Rate</th>
    <th style="vertical-align:middle; text-align:center">Total Consumed Qty</th>
    <th style="vertical-align:middle; text-align:center">Usage Months</th>
    <th style="vertical-align:middle; text-align:center">Last Purchase Date</th>
  </tr></thead><tbody>\${rows.map(overviewRowHtml).join("")}</tbody></table>\`;
    LAST_ACTIVE_ROWS = [...rows];
  } else {
    if (!rows || !rows.length) {
      state.hasMore = false;
      updateScrollSentinel();
      return;
    }
    const tbody = tableArea.querySelector("tbody");
    if (!tbody) return renderOverviewTable(rows, totalCount, { append: false });
    tbody.insertAdjacentHTML("beforeend", rows.map(overviewRowHtml).join(""));
    LAST_ACTIVE_ROWS = LAST_ACTIVE_ROWS.concat(rows);
  }
  setHasMoreFromBatch(rows.length, totalCount, LAST_ACTIVE_ROWS.length);
  ensureScrollSentinel();
  updateScrollSentinel();
  setBusy(false);
  bindOverviewRowClicks();
}

function stockRowHtml(row) {
  return \`<tr>
      <td style="vertical-align:middle; text-align:center">\${row.code}</td>
      <td style="vertical-align:middle; text-align:left">\${row.name}</td>
      <td style="vertical-align:middle; text-align:center">\${getRowUOM(row)}</td>
      <td style="vertical-align:middle; text-align:center">\${formatClassification(row)}</td>
      <td style="vertical-align:middle; text-align:right">\${formatIndianNumber(row.qty_value)}</td>
      <td style="vertical-align:middle; text-align:right">\${formatCurrencyINR(row.avg_rate_value)}</td>
    </tr>\`;
}

function renderStockTable(rows, totalCount = 0, opts = {}) {
  const append = !!opts.append;
  if (!append) {
    if (!rows || !rows.length) return renderNoData();
    tableArea.innerHTML = \`<table><thead><tr>
    <th style="vertical-align:middle; text-align:center">Code</th>
    <th style="vertical-align:middle; text-align:center">Name</th>
    <th style="vertical-align:middle; text-align:center">UOM</th>
    <th style="vertical-align:middle; text-align:center">Classification</th>
    <th style="vertical-align:middle; text-align:center">Current Stock</th>
    <th style="vertical-align:middle; text-align:center">Valuation Rate</th>
  </tr></thead><tbody>\${rows.map(stockRowHtml).join("")}</tbody></table>\`;
    LAST_ACTIVE_ROWS = [...rows];
  } else {
    if (!rows || !rows.length) {
      state.hasMore = false;
      updateScrollSentinel();
      return;
    }
    const tbody = tableArea.querySelector("tbody");
    if (!tbody) return renderStockTable(rows, totalCount, { append: false });
    tbody.insertAdjacentHTML("beforeend", rows.map(stockRowHtml).join(""));
    LAST_ACTIVE_ROWS = LAST_ACTIVE_ROWS.concat(rows);
  }
  setHasMoreFromBatch(rows.length, totalCount, LAST_ACTIVE_ROWS.length);
  ensureScrollSentinel();
  updateScrollSentinel();
  setBusy(false);
}

function purchaseRowHtml(row) {
  return \`<tr data-id="\${row.inv_stock_item_id}"\${
    row.inv_stock_item_id === state.selectedItemId ? " class='selected'" : ""
  }>
      <td style="vertical-align:middle; text-align:center">\${row.code}</td>
      <td style="vertical-align:middle; text-align:left">\${row.name}</td>
      <td style="vertical-align:middle; text-align:center">\${getRowUOM(row)}</td>
      <td style="vertical-align:middle; text-align:center">\${formatClassification(row)}</td>
      <td style="vertical-align:middle; text-align:right">\${formatIndianNumber(row.total_purchased_qty)}</td>
      <td style="vertical-align:middle; text-align:right">\${formatCurrencyINR(row.avg_purchase_rate)}</td>
      <td style="vertical-align:middle; text-align:center">\${row.last_purchase_date ?? "–"}</td>
      <td style="vertical-align:middle; text-align:center">\${row.purchase_lines ?? "–"}</td>
    </tr>\`;
}

function bindPurchaseRowClicks() {
  tableArea.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.onclick = () => {
      state.selectedItemId = tr.getAttribute("data-id");
      selectTableRow(tr);
      loadAndRenderPurchaseDetail(state.selectedItemId);
    };
  });
}

function renderPurchaseSummaryTable(rows, totalCount = 0, opts = {}) {
  const append = !!opts.append;
  if (!append) {
    if (!rows || !rows.length) return renderNoData();
    tableArea.innerHTML = \`<table><thead><tr>
    <th style="vertical-align:middle; text-align:center">Code</th>
    <th style="vertical-align:middle; text-align:center">Name</th>
    <th style="vertical-align:middle; text-align:center">UOM</th>
    <th style="vertical-align:middle; text-align:center">Classification</th>
    <th style="vertical-align:middle; text-align:center">Total Purchased Qty</th>
    <th style="vertical-align:middle; text-align:center">Avg Purchase Rate</th>
    <th style="vertical-align:middle; text-align:center">Last Purchase Date</th>
    <th style="vertical-align:middle; text-align:center">Transactions</th>
  </tr></thead><tbody>\${rows.map(purchaseRowHtml).join("")}</tbody></table>\`;
    LAST_ACTIVE_ROWS = [...rows];
  } else {
    if (!rows || !rows.length) {
      state.hasMore = false;
      updateScrollSentinel();
      return;
    }
    const tbody = tableArea.querySelector("tbody");
    if (!tbody)
      return renderPurchaseSummaryTable(rows, totalCount, { append: false });
    tbody.insertAdjacentHTML("beforeend", rows.map(purchaseRowHtml).join(""));
    LAST_ACTIVE_ROWS = LAST_ACTIVE_ROWS.concat(rows);
  }
  setHasMoreFromBatch(rows.length, totalCount, LAST_ACTIVE_ROWS.length);
  ensureScrollSentinel();
  updateScrollSentinel();
  setBusy(false);
  bindPurchaseRowClicks();
  if (!append && state.selectedItemId) {
    loadAndRenderPurchaseDetail(state.selectedItemId);
  } else if (!append && sidePanel) {
    sidePanel.classList.remove("active");
  }
}

function consumptionRowHtml(row) {
  return \`<tr data-id="\${row.inv_stock_item_id}"\${
    row.inv_stock_item_id === state.selectedItemId ? " class='selected'" : ""
  }>
      <td style="vertical-align:middle; text-align:center">\${row.code}</td>
      <td style="vertical-align:middle; text-align:left">\${row.name}</td>
      <td style="vertical-align:middle; text-align:center">\${getRowUOM(row)}</td>
      <td style="vertical-align:middle; text-align:center">\${formatClassification(row)}</td>
      <td style="vertical-align:middle; text-align:right">\${formatIndianNumber(row.total_consumed_qty)}</td>
      <td style="vertical-align:middle; text-align:right">\${formatIndianNumber(row.rm_pm_issue_qty)}</td>
      <td style="vertical-align:middle; text-align:right">\${formatIndianNumber(row.consumable_out_qty)}</td>
      <td style="vertical-align:middle; text-align:center">\${row.months_with_usage ?? "–"}</td>
      <td style="vertical-align:middle; text-align:center">\${row.first_month ?? "–"}</td>
      <td style="vertical-align:middle; text-align:center">\${row.last_month ?? "–"}</td>
    </tr>\`;
}

function bindConsumptionRowClicks() {
  tableArea.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.onclick = () => {
      state.selectedItemId = tr.getAttribute("data-id");
      selectTableRow(tr);
      loadAndRenderConsumptionMonthly(state.selectedItemId);
    };
  });
}

function renderConsumptionTable(rows, totalCount = 0, opts = {}) {
  const append = !!opts.append;
  if (!append) {
    if (!rows || !rows.length) return renderNoData();
    tableArea.innerHTML = \`<table><thead><tr>
    <th style="vertical-align:middle; text-align:center">Code</th>
    <th style="vertical-align:middle; text-align:center">Name</th>
    <th style="vertical-align:middle; text-align:center">UOM</th>
    <th style="vertical-align:middle; text-align:center">Classification</th>
    <th style="vertical-align:middle; text-align:center">Total Consumed Qty</th>
    <th style="vertical-align:middle; text-align:center">RM/PLM Issues</th>
    <th style="vertical-align:middle; text-align:center">Consumables Out</th>
    <th style="vertical-align:middle; text-align:center">Usage Months</th>
    <th style="vertical-align:middle; text-align:center">First Month</th>
    <th style="vertical-align:middle; text-align:center">Last Month</th>
  </tr></thead><tbody>\${rows.map(consumptionRowHtml).join("")}</tbody></table>\`;
    LAST_ACTIVE_ROWS = [...rows];
  } else {
    if (!rows || !rows.length) {
      state.hasMore = false;
      updateScrollSentinel();
      return;
    }
    const tbody = tableArea.querySelector("tbody");
    if (!tbody) return renderConsumptionTable(rows, totalCount, { append: false });
    tbody.insertAdjacentHTML(
      "beforeend",
      rows.map(consumptionRowHtml).join(""),
    );
    LAST_ACTIVE_ROWS = LAST_ACTIVE_ROWS.concat(rows);
  }
  setHasMoreFromBatch(rows.length, totalCount, LAST_ACTIVE_ROWS.length);
  ensureScrollSentinel();
  updateScrollSentinel();
  setBusy(false);
  bindConsumptionRowClicks();
}

// NEW: open modal and render monthly consumption for an item
async function loadAndRenderConsumptionMonthly(invStockItemId) {
  openDetailModal('<div class="loading">Loading…</div>');
  const { data, error } = await loadConsumptionMonthly({
    invStockItemId,
    fromDate: state.currentFromDate,
    toDate: state.currentToDate,
  });
  if (error) {
    const errMsg =
      error.userMessage ||
      error.message ||
      "Failed to load consumption history";
    showStatusToast(errMsg, "error", 4000);
    modalContent.innerHTML = \`<div class="error">\${errMsg}</div>\`;
    return;
  }
  if (!data || !data.length) {
    modalContent.innerHTML =
      '<div class="no-data">No consumption history found.</div>';
    return;
  }

  let html = \`<h3 class="spe-modal-title">Monthly Consumption</h3>
    <div class="modal-table-wrap">
      <table class="erp-table">
        <thead><tr>
          <th class="col-date">Month</th>
          <th class="numeric">RM/PLM Issues</th>
          <th class="numeric">Consumables Out</th>
          <th class="numeric">Total Consumed</th>
        </tr></thead>
        <tbody>\`;

  data.forEach((row) => {
    html += \`<tr>
      <td class="col-date">\${row.month_label ?? row.month_start_date ?? "–"}</td>
      <td class="numeric">\${formatIndianNumber(row.rm_pm_issue_qty)}</td>
      <td class="numeric">\${formatIndianNumber(row.consumable_out_qty)}</td>
      <td class="numeric">\${formatIndianNumber(row.total_consumed_qty)}</td>
    </tr>\`;
  });

  html += \`</tbody></table></div>\`;
  modalContent.innerHTML = html;
}

// ── RM Receiving Stock tab ─────────────────────────────────────────────────
async function loadRmReceivingStock({
  searchText,
  categoryCode,
  subcategoryCode,
  groupCode,
  subgroupCode,
  page = 1,
  pageSize = 30,
  mappingStatus = "mapped",
}) {
  const limit = pageSize;
  const offset = (page - 1) * pageSize;
  const baseParams = {
    p_as_of_date: null,
    p_search: searchText || null,
    p_category_code: categoryCode || "all",
    p_subcategory_code: subcategoryCode || "all",
    p_group_code: groupCode || "all",
    p_subgroup_code: subgroupCode || "all",
    p_mapping_status: mappingStatus || "mapped",
  };

  const [dataRes, countRes] = await Promise.all([
    supabase.rpc("fn_rm_rms_stock_filtered", {
      ...baseParams,
      p_limit: limit,
      p_offset: offset,
    }),
    supabase.rpc("fn_rm_rms_stock_filtered_count", baseParams),
  ]);

  if (dataRes.error) return { error: handleSupabaseError(dataRes.error) };
  if (countRes.error) return { error: handleSupabaseError(countRes.error) };

  let count = 0;
  const cd = countRes.data;
  if (typeof cd === "number") {
    count = cd;
  } else if (Array.isArray(cd) && cd.length && cd[0].count !== undefined) {
    count = Number(cd[0].count) || 0;
  } else if (Array.isArray(cd) && cd.length && typeof cd[0] === "number") {
    count = Number(cd[0]) || 0;
  }

  return { data: dataRes.data || [], count };
}

function rmReceivingRowHtml(row) {
  const classLabel = formatClassification(row);
  return \`<tr>
      <td style="vertical-align:middle;text-align:center;white-space:nowrap">\${row.as_of_date ?? "–"}</td>
      <td style="vertical-align:middle;text-align:left">\${row.tally_item_name ?? "–"}</td>
      <td style="vertical-align:middle;text-align:center">\${row.code ?? "–"}</td>
      <td style="vertical-align:middle;text-align:left">\${row.name ?? "–"}</td>
      <td style="vertical-align:middle;text-align:center">\${classLabel}</td>
      <td style="vertical-align:middle;text-align:right">\${formatIndianNumber(row.qty_value)}</td>
      <td style="vertical-align:middle;text-align:right">\${formatCurrencyINR(row.rate_value)}</td>
      <td style="vertical-align:middle;text-align:right">\${formatCurrencyINR(row.stock_value)}</td>
    </tr>\`;
}

function mountRmReceivingCopyAction() {
  try {
    const existing = document.getElementById("rmHeaderActions");
    if (existing) existing.remove();
    const host = document.getElementById("tableHeaderActions");
    if (!host) return;
    host.innerHTML = "";
    const actionsDiv = document.createElement("div");
    actionsDiv.id = "rmHeaderActions";
    const btn = document.createElement("button");
    btn.id = "copyRmReceivingRowsBtn";
    btn.type = "button";
    btn.className = "rm-copy-btn";
    btn.title = "Copy RM Receiving Stock";
    btn.setAttribute("aria-label", "Copy RM Receiving Stock");
    btn.innerHTML = iconHtml("document", 16);
    actionsDiv.appendChild(btn);
    host.appendChild(actionsDiv);
    btn.addEventListener("click", copyRmReceivingRows);
    syncTableHeaderBarVisibility();
  } catch (err) {
    console.debug(err);
  }
}

function clearTableHeaderActions() {
  const host = document.getElementById("tableHeaderActions");
  if (host) host.innerHTML = "";
  const existing = document.getElementById("rmHeaderActions");
  if (existing) existing.remove();
  syncTableHeaderBarVisibility();
}

function renderRmReceivingStockTable(rows, totalCount = 0, opts = {}) {
  const append = !!opts.append;
  if (!append) {
    if (!rows || !rows.length) {
      LAST_RM_RECEIVING_ROWS = [];
      LAST_ACTIVE_ROWS = [];
      LAST_RM_RECEIVING_TOTAL = 0;
      LAST_RM_RECEIVING_AS_OF_DATE = null;
      LAST_RM_RECEIVING_INSERTED_AT = null;
      updateTableContextMeta(
        "Stock Stage: Receiving · Godown: Warehouse No.2 (RMS)",
      );
      clearTableHeaderActions();
      return renderNoData();
    }
    LAST_RM_RECEIVING_AS_OF_DATE = rows[0]?.as_of_date || null;
    LAST_RM_RECEIVING_INSERTED_AT = rows[0]?.inserted_at || null;
    updateTableContextMeta(
      "Stock Stage: Receiving · Godown: Warehouse No.2 (RMS)",
    );
    tableArea.innerHTML = \`<table><thead><tr>
    <th style="vertical-align:middle;text-align:center">Date</th>
    <th style="vertical-align:middle;text-align:left">Tally Item Name</th>
    <th style="vertical-align:middle;text-align:center">Code</th>
    <th style="vertical-align:middle;text-align:left">Name</th>
    <th style="vertical-align:middle;text-align:center">Classification</th>
    <th style="vertical-align:middle;text-align:right">Qty</th>
    <th style="vertical-align:middle;text-align:right">Rate</th>
    <th style="vertical-align:middle;text-align:right">Stock Value</th>
  </tr></thead><tbody>\${rows.map(rmReceivingRowHtml).join("")}</tbody></table>\`;
    LAST_RM_RECEIVING_ROWS = [...rows];
    LAST_ACTIVE_ROWS = [...rows];
    mountRmReceivingCopyAction();
  } else {
    if (!rows || !rows.length) {
      state.hasMore = false;
      updateScrollSentinel();
      return;
    }
    const tbody = tableArea.querySelector("tbody");
    if (!tbody)
      return renderRmReceivingStockTable(rows, totalCount, { append: false });
    tbody.insertAdjacentHTML(
      "beforeend",
      rows.map(rmReceivingRowHtml).join(""),
    );
    LAST_RM_RECEIVING_ROWS = LAST_RM_RECEIVING_ROWS.concat(rows);
    LAST_ACTIVE_ROWS = LAST_ACTIVE_ROWS.concat(rows);
  }
  LAST_RM_RECEIVING_TOTAL = totalCount || 0;
  setHasMoreFromBatch(rows.length, totalCount, LAST_ACTIVE_ROWS.length);
  ensureScrollSentinel();
  updateScrollSentinel();
  setBusy(false);
}

async function loadMoreActiveTab() {
  if (state.loadingMore || !state.hasMore) return;
  const tab = state.currentTab;
  const nextPage = getTabPage(tab) + 1;
  state.loadingMore = true;
  updateScrollSentinel("Loading more…");
  const mySeq = _requestSeq;
  try {
    setTabPage(tab, nextPage);
    let res;
    if (tab === "overview") {
      res = await loadOverviewItems({
        sourceKind: state.currentSourceKind,
        searchText: state.currentSearchText,
        page: nextPage,
        pageSize: state.pageSize,
      });
      if (mySeq !== _requestSeq) return;
      if (res.error) throw res.error;
      renderOverviewTable(res.data || [], res.count || 0, { append: true });
    } else if (tab === "stock") {
      res = await loadStockSnapshot({
        sourceKind: state.currentSourceKind,
        searchText: state.currentSearchText,
        page: nextPage,
        pageSize: state.pageSize,
      });
      if (mySeq !== _requestSeq) return;
      if (res.error) throw res.error;
      renderStockTable(res.data || [], res.count || 0, { append: true });
    } else if (tab === "purchase") {
      res = await loadPurchaseSummary({
        sourceKind: state.currentSourceKind,
        searchText: state.currentSearchText,
        fromDate: state.currentFromDate,
        toDate: state.currentToDate,
        page: nextPage,
        pageSize: state.pageSize,
      });
      if (mySeq !== _requestSeq) return;
      if (res.error) throw res.error;
      renderPurchaseSummaryTable(res.data || [], res.count || 0, {
        append: true,
      });
    } else if (tab === "consumption") {
      res = await loadConsumptionSummary({
        sourceKind: state.currentSourceKind,
        searchText: state.currentSearchText,
        fromDate: state.currentFromDate,
        toDate: state.currentToDate,
        page: nextPage,
        pageSize: state.pageSize,
      });
      if (mySeq !== _requestSeq) return;
      if (res.error) throw res.error;
      renderConsumptionTable(res.data || [], res.count || 0, { append: true });
    } else if (tab === "rm-receiving-stock") {
      res = await loadRmReceivingStock({
        searchText: state.currentSearchText,
        categoryCode: state.currentCategoryCode,
        subcategoryCode: state.currentSubcategoryCode,
        groupCode: state.currentGroupCode,
        subgroupCode: state.currentSubgroupCode,
        page: nextPage,
        pageSize: state.pageSize,
        mappingStatus: "mapped",
      });
      if (mySeq !== _requestSeq) return;
      if (res.error) throw res.error;
      renderRmReceivingStockTable(res.data || [], res.count || 0, {
        append: true,
      });
    }
  } catch (err) {
    setTabPage(tab, Math.max(1, nextPage - 1));
    showStatusToast(
      err?.userMessage || err?.message || "Failed to load more rows",
      "error",
      4000,
    );
    updateScrollSentinel();
  } finally {
    state.loadingMore = false;
    updateScrollSentinel();
  }
}

let __speInfiniteScrollWired = false;
function wireInfiniteScroll() {
  if (__speInfiniteScrollWired || !tableArea) return;
  __speInfiniteScrollWired = true;
  tableArea.addEventListener(
    "scroll",
    () => {
      if (state.loadingMore || !state.hasMore) return;
      const nearBottom =
        tableArea.scrollTop + tableArea.clientHeight >=
        tableArea.scrollHeight - 120;
      if (nearBottom) void loadMoreActiveTab();
    },
    { passive: true },
  );
}

`;

s = s.slice(0, start) + replacement + s.slice(end);
fs.writeFileSync(path, s);
console.log("patched", path, "bytes", s.length);
