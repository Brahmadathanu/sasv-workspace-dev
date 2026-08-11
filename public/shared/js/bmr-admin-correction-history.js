/**
 * Manager BMR — Change History tab controller.
 * Full searchable register via rpc_search_bmr_admin_correction_history.
 * Server-backed infinite scroll (internal p_page increment).
 * Contextual modal history remains separate (scoped RPC).
 */
import {
  HISTORY_INFINITE_PAGE_SIZE,
  HISTORY_OPERATION_FILTER_OPTIONS,
  HISTORY_RESULT_FILTER_OPTIONS,
  HISTORY_SEARCH_DEBOUNCE_MS,
  formatExecutedByFull,
  formatExecutedByName,
  isRetiredOperationType,
  labelForOperationResult,
  labelForOperationType,
  parseSnapshotSync,
  parseValidationEvidence,
  searchAdminCorrectionHistory,
} from "./bmr-admin-correction.js";

const COMPLETION_EVENT = "bmr-admin-correction:completed";
const SEARCH_DEBOUNCE_MS = HISTORY_SEARCH_DEBOUNCE_MS;
const FIXED_PAGE_SIZE = HISTORY_INFINITE_PAGE_SIZE;

const defaultAdvancedFilters = () => ({
  dateFrom: "",
  dateTo: "",
  operationType: "",
  operationResult: "",
  productId: "",
});

let _ctx = null;
let _wired = false;
let _completionListening = false;
let _requestSeq = 0;
let _abort = null;
let _searchDebounceTimer = null;
let _documentClickBound = false;
let _sentinelObserver = null;

const state = {
  searchText: "",
  appliedSearch: "",
  filters: defaultAdvancedFilters(),
  page: 1,
  fixedPageSize: FIXED_PAGE_SIZE,
  totalCount: 0,
  totalPages: 0,
  rows: [],
  loadedIds: new Set(),
  initialLoading: false,
  loadingMore: false,
  appendError: null,
  hasMore: true,
  error: null,
  selectedRecord: null,
  historyStale: true,
  emptyKind: null, // "none" | "no-match" | null
  filterDrawerOpen: false,
  datePanelOpen: false,
  dateRangeInvalid: false,
};

function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dash(v) {
  return v == null || v === "" ? "—" : String(v);
}

function yesNo(v) {
  if (v == null) return "—";
  return v ? "Yes" : "No";
}

function $(id) {
  return document.getElementById(id);
}

function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle("hidden", !!hidden);
  if ("hidden" in el) el.hidden = !!hidden;
}

function toast(msg, type = "success") {
  if (typeof _ctx?.toast === "function") _ctx.toast(msg, type);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toIsoDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDisplayDate(iso) {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!m) return String(iso);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function describeDateRange(from, to) {
  if (!from && !to) return "Any date";
  if (from && to) {
    if (from === to) return formatDisplayDate(from);
    return `${formatDisplayDate(from)} – ${formatDisplayDate(to)}`;
  }
  if (from) return `From ${formatDisplayDate(from)}`;
  return `Up to ${formatDisplayDate(to)}`;
}

function countActiveAdvancedFilters(filters = state.filters) {
  let n = 0;
  if (filters.dateFrom || filters.dateTo) n += 1;
  if (filters.operationType) n += 1;
  if (filters.operationResult) n += 1;
  if (filters.productId) n += 1;
  return n;
}

function hasActiveQuery() {
  return !!(
    state.appliedSearch ||
    state.filters.dateFrom ||
    state.filters.dateTo ||
    state.filters.operationType ||
    state.filters.operationResult ||
    state.filters.productId
  );
}

function isDateRangeInvalid(
  from = state.filters.dateFrom,
  to = state.filters.dateTo,
) {
  if (!from || !to) return false;
  return from > to;
}

function clearSearchDebounce() {
  if (_searchDebounceTimer != null) {
    clearTimeout(_searchDebounceTimer);
    _searchDebounceTimer = null;
  }
}

function abortInFlight() {
  _requestSeq += 1;
  if (_abort) {
    try {
      _abort.abort();
    } catch {
      /* ignore */
    }
  }
  _abort = null;
}

function setLiveStatus(msg) {
  const el = $("histLiveStatus");
  if (el) el.textContent = msg || "";
}

function syncSearchClearVisibility() {
  const clearBtn = $("histSearchClear");
  const input = $("histFilterSearch");
  const hasText = !!(input?.value || state.searchText);
  setHidden(clearBtn, !hasText);
}

function updateFilterBadge() {
  const count = countActiveAdvancedFilters();
  const badge = $("histFilterBadge");
  const btn = $("histFiltersBtn");
  if (badge) {
    badge.textContent = String(count);
    setHidden(badge, count === 0);
  }
  if (btn) {
    btn.classList.toggle("hist-filters-btn--active", count > 0);
    btn.classList.toggle("hist-filters-btn--open", state.filterDrawerOpen);
    btn.setAttribute("aria-expanded", state.filterDrawerOpen ? "true" : "false");
  }
}

function updateDateTrigger() {
  const label = $("histDateLabel");
  if (label) {
    label.textContent = describeDateRange(
      state.filters.dateFrom,
      state.filters.dateTo,
    );
  }
  const trigger = $("histDateTrigger");
  if (trigger) {
    trigger.setAttribute(
      "aria-expanded",
      state.datePanelOpen ? "true" : "false",
    );
  }
  const panel = $("histDatePanel");
  if (panel) panel.classList.toggle("open", state.datePanelOpen);
}

function syncDateInputsFromState() {
  if ($("histFilterDateFrom"))
    $("histFilterDateFrom").value = state.filters.dateFrom || "";
  if ($("histFilterDateTo"))
    $("histFilterDateTo").value = state.filters.dateTo || "";
}

function showDateError(msg) {
  const el = $("histDateError");
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    setHidden(el, false);
  } else {
    el.textContent = "";
    setHidden(el, true);
  }
}

function renderOperationChips() {
  const host = $("histOperationChips");
  if (!host) return;
  host.innerHTML = HISTORY_OPERATION_FILTER_OPTIONS.map((o) => {
    const active = state.filters.operationType === o.value;
    return `<button type="button" class="hist-chip${
      active ? " active" : ""
    }" data-hist-operation="${esc(o.value)}">${esc(o.label)}</button>`;
  }).join("");
}

function renderResultChips() {
  const host = $("histResultChips");
  if (!host) return;
  host.innerHTML = HISTORY_RESULT_FILTER_OPTIONS.map((o) => {
    const active = state.filters.operationResult === o.value;
    return `<button type="button" class="hist-chip${
      active ? " active" : ""
    }" data-hist-result="${esc(o.value)}">${esc(o.label)}</button>`;
  }).join("");
}

function fillProductSelect(products) {
  const prodSel = $("histFilterProduct");
  if (!prodSel) return;
  const opts = Array.isArray(products) ? products : [];
  const current = state.filters.productId || "";
  prodSel.innerHTML =
    `<option value="">All products</option>` +
    opts
      .map(
        (p) =>
          `<option value="${esc(p.id)}">${esc(p.item || p.id)}</option>`,
      )
      .join("");
  prodSel.value = current;
}

function syncToolbarFromState() {
  if ($("histFilterSearch")) $("histFilterSearch").value = state.searchText || "";
  syncSearchClearVisibility();
  syncDateInputsFromState();
  updateDateTrigger();
  showDateError(
    state.dateRangeInvalid
      ? "Date from cannot be later than date to."
      : "",
  );
  renderOperationChips();
  renderResultChips();
  fillProductSelect(
    typeof _ctx?.getProducts === "function" ? _ctx.getProducts() : [],
  );
  updateFilterBadge();
}

function setFilterDrawerOpen(open) {
  state.filterDrawerOpen = !!open;
  if (!open) state.datePanelOpen = false;
  const drawer = $("histFilterDrawer");
  const scrim = $("histFilterScrim");
  if (drawer) drawer.classList.toggle("open", state.filterDrawerOpen);
  if (scrim) {
    scrim.classList.toggle("open", state.filterDrawerOpen);
    if (state.filterDrawerOpen) scrim.removeAttribute("hidden");
    else scrim.setAttribute("hidden", "");
  }
  updateDateTrigger();
  updateFilterBadge();
}

function bmrCell(row) {
  const bn = row.new_bn ?? row.old_bn;
  const id = row.new_bmr_id ?? row.old_bmr_id;
  if (bn != null && bn !== "") {
    return `<span>${esc(bn)}</span>${
      id != null
        ? `<span class="hist-muted"> · #${esc(id)}</span>`
        : ""
    }`;
  }
  if (id != null) return `<span class="hist-muted">#${esc(id)}</span>`;
  return "—";
}

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

function rowHtml(row) {
  const retired = isRetiredOperationType(row.operation_type);
  const opLabel = labelForOperationType(row.operation_type);
  const resultLabel = labelForOperationResult(row.operation_result);
  const reason = String(row.reason || "");
  const reasonShort = reason.length > 80 ? `${reason.slice(0, 80)}…` : reason;
  return `
      <tr class="clickable-row hist-row${retired ? " hist-row-retired" : ""}"
          data-id="${esc(row.id)}">
        <td>${esc(row.correction_no)}</td>
        <td>${esc(formatWhen(row.executed_at))}</td>
        <td title="${esc(row.product_name || "")}">${esc(
          dash(row.product_name),
        )}</td>
        <td>${bmrCell(row)}</td>
        <td class="${retired ? "hist-retired-label" : ""}">${esc(opLabel)}</td>
        <td>${esc(dash(row.old_bmr_batch_size))}</td>
        <td>${esc(dash(row.new_bmr_batch_size))}</td>
        <td>${esc(dash(row.planned_batch_size))}</td>
        <td>${esc(resultLabel)}</td>
        <td title="${esc(reason)}">${esc(reasonShort || "—")}</td>
        <td>${esc(formatExecutedByName(row))}</td>
      </tr>`;
}

function recomputeHasMore() {
  const page = state.page;
  const totalPages = state.totalPages;
  const loaded = state.rows.length;
  const total = state.totalCount;
  state.hasMore =
    totalPages > 0 &&
    page < totalPages &&
    (total <= 0 || loaded < total);
}

function disconnectSentinel() {
  if (_sentinelObserver) {
    try {
      _sentinelObserver.disconnect();
    } catch {
      /* ignore */
    }
    _sentinelObserver = null;
  }
}

function attachSentinel() {
  disconnectSentinel();
  const sentinel = $("histSentinel");
  if (!sentinel || typeof IntersectionObserver === "undefined") return;
  // Page/viewport is the authoritative vertical scroll owner.
  _sentinelObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry?.isIntersecting) return;
      maybeLoadMore();
    },
    { root: null, rootMargin: "120px 0px", threshold: 0 },
  );
  _sentinelObserver.observe(sentinel);
}

function renderScrollStatus() {
  const el = $("histScrollStatus");
  if (!el) return;
  el.classList.remove("hist-scroll-status--error");

  if (state.appendError) {
    el.hidden = false;
    el.classList.add("hist-scroll-status--error");
    el.innerHTML = `Could not load more records. <button type="button" id="histAppendRetryBtn">Retry</button>`;
    $("histAppendRetryBtn")?.addEventListener("click", () => {
      state.appendError = null;
      loadMorePage().catch(console.error);
    });
    return;
  }

  if (state.loadingMore) {
    el.hidden = false;
    el.textContent = "Loading more…";
    return;
  }

  el.hidden = true;
  el.textContent = "";
}

function renderError() {
  const el = $("histError");
  if (!el) return;
  if (state.error) {
    el.textContent = state.error;
    setHidden(el, false);
  } else {
    el.textContent = "";
    setHidden(el, true);
  }
}

function renderTable() {
  const body = $("histTableBody");
  if (!body) return;

  if (state.initialLoading && !state.rows.length) {
    body.innerHTML = `<tr><td colspan="11" class="empty-state">Loading…</td></tr>`;
    renderScrollStatus();
    return;
  }

  if (!state.rows.length) {
    const msg =
      state.emptyKind === "no-match"
        ? "No records match the selected filters."
        : "No correction records exist. Completed governed administrative corrections will appear here.";
    body.innerHTML = `<tr><td colspan="11" class="empty-state">${esc(msg)}</td></tr>`;
    renderScrollStatus();
    return;
  }

  body.innerHTML = state.rows.map(rowHtml).join("");
  renderScrollStatus();
}

function acceptRows(incoming, { replace }) {
  const accepted = [];
  for (const row of incoming) {
    const id = row?.id;
    if (id == null) continue;
    const key = String(id);
    if (state.loadedIds.has(key)) continue;
    accepted.push(row);
  }
  if (replace) {
    state.rows = accepted;
    state.loadedIds = new Set(accepted.map((r) => String(r.id)));
  } else if (accepted.length) {
    state.rows = state.rows.concat(accepted);
    for (const row of accepted) state.loadedIds.add(String(row.id));
  }
  return accepted;
}

async function fetchHistoryPage(page) {
  if (isDateRangeInvalid()) {
    state.dateRangeInvalid = true;
    showDateError("Date from cannot be later than date to.");
    return null;
  }
  state.dateRangeInvalid = false;
  showDateError("");

  const seq = ++_requestSeq;
  if (_abort) {
    try {
      _abort.abort();
    } catch {
      /* ignore */
    }
  }
  _abort = typeof AbortController !== "undefined" ? new AbortController() : null;

  try {
    const result = await searchAdminCorrectionHistory({
      p_search: state.appliedSearch,
      p_date_from: state.filters.dateFrom,
      p_date_to: state.filters.dateTo,
      p_operation_type: state.filters.operationType,
      p_operation_result: state.filters.operationResult,
      p_product_id: state.filters.productId,
      p_executed_by: null,
      p_page: page,
      p_page_size: state.fixedPageSize,
    });
    if (seq !== _requestSeq) return null;
    return result;
  } catch (err) {
    if (seq !== _requestSeq) return null;
    throw err;
  }
}

async function resetAndFetchPage1({ announce = true } = {}) {
  disconnectSentinel();
  clearSearchDebounce();
  abortInFlight();

  state.page = 1;
  state.rows = [];
  state.loadedIds = new Set();
  state.appendError = null;
  state.hasMore = true;
  state.error = null;
  state.emptyKind = null;
  state.initialLoading = true;
  state.loadingMore = false;
  renderError();
  renderTable();
  if (announce) setLiveStatus("Loading change history");

  try {
    const result = await fetchHistoryPage(1);
    if (!result) {
      state.initialLoading = false;
      renderTable();
      return;
    }

    acceptRows(result.rows, { replace: true });
    state.totalCount = result.total_count;
    state.totalPages = result.total_pages;
    state.page = result.page || 1;
    recomputeHasMore();
    state.emptyKind =
      result.total_count === 0
        ? hasActiveQuery()
          ? "no-match"
          : "none"
        : null;
    state.historyStale = false;
    state.initialLoading = false;
    renderTable();
    attachSentinel();
    if (state.rows.length === 0) {
      setLiveStatus(
        state.emptyKind === "no-match"
          ? "No records match the selected filters."
          : "No correction records exist.",
      );
    } else {
      setLiveStatus(`Loaded ${state.rows.length} records`);
    }
    maybeLoadMore();
  } catch (err) {
    console.error("[bmr-change-history] initial fetch failed", err);
    state.initialLoading = false;
    state.error =
      err?.message ||
      "Failed to load change history. Prior results are retained where available.";
    renderError();
    renderTable();
    toast(state.error, "error");
    setLiveStatus("Failed to load change history");
  }
}

async function loadMorePage() {
  if (state.initialLoading || state.loadingMore) return;
  if (!state.hasMore) return;
  if (state.appendError) return;

  const nextPage = state.page + 1;
  state.loadingMore = true;
  renderScrollStatus();
  setLiveStatus("Loading more records");

  try {
    const result = await fetchHistoryPage(nextPage);
    if (!result) {
      state.loadingMore = false;
      renderScrollStatus();
      return;
    }

    const accepted = acceptRows(result.rows, { replace: false });
    state.totalCount = result.total_count;
    state.totalPages = result.total_pages;
    state.page = result.page || nextPage;
    recomputeHasMore();
    state.loadingMore = false;
    state.appendError = null;

    if (accepted.length) {
      const body = $("histTableBody");
      if (body && state.rows.length > accepted.length) {
        body.insertAdjacentHTML(
          "beforeend",
          accepted.map(rowHtml).join(""),
        );
      } else {
        renderTable();
      }
    }
    renderScrollStatus();
    setLiveStatus(`Loaded ${state.rows.length} records`);
    attachSentinel();
  } catch (err) {
    console.error("[bmr-change-history] load more failed", err);
    state.loadingMore = false;
    state.appendError =
      err?.message || "Could not load more records.";
    renderScrollStatus();
    setLiveStatus("Could not load more records");
    toast("Could not load more change-history records.", "error");
  }
}

function maybeLoadMore() {
  if (state.initialLoading || state.loadingMore) return;
  if (!state.hasMore) return;
  if (state.appendError) return;
  loadMorePage().catch(console.error);
}

/**
 * Apply general search immediately when value differs from appliedSearch.
 */
function applySearchNow(rawValue) {
  clearSearchDebounce();
  const next = String(rawValue ?? "").trim();
  state.searchText = next;
  syncSearchClearVisibility();
  if (next === state.appliedSearch) return false;
  state.appliedSearch = next;
  resetAndFetchPage1().catch(console.error);
  return true;
}

function scheduleSearchApply() {
  clearSearchDebounce();
  const next = String($("histFilterSearch")?.value ?? "").trim();
  state.searchText = next;
  syncSearchClearVisibility();
  if (next === state.appliedSearch) return;
  _searchDebounceTimer = setTimeout(() => {
    _searchDebounceTimer = null;
    applySearchNow(next);
  }, SEARCH_DEBOUNCE_MS);
}

function applyAdvancedFilters() {
  if (isDateRangeInvalid()) {
    state.dateRangeInvalid = true;
    showDateError("Date from cannot be later than date to.");
    updateDateTrigger();
    updateFilterBadge();
    return;
  }
  state.dateRangeInvalid = false;
  showDateError("");
  updateDateTrigger();
  updateFilterBadge();
  resetAndFetchPage1().catch(console.error);
}

function setDateRange(from, to, { apply = true } = {}) {
  state.filters = {
    ...state.filters,
    dateFrom: from || "",
    dateTo: to || "",
  };
  syncDateInputsFromState();
  updateDateTrigger();
  if (!apply) {
    if (isDateRangeInvalid()) {
      state.dateRangeInvalid = true;
      showDateError("Date from cannot be later than date to.");
    }
    return;
  }
  applyAdvancedFilters();
}

function applyDatePreset(preset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (preset === "clear") {
    setDateRange("", "", { apply: true });
    state.datePanelOpen = false;
    updateDateTrigger();
    return;
  }
  if (preset === "today") {
    const iso = toIsoDate(today);
    setDateRange(iso, iso, { apply: true });
    return;
  }
  if (preset === "last7") {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    setDateRange(toIsoDate(from), toIsoDate(today), { apply: true });
    return;
  }
  if (preset === "last30") {
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    setDateRange(toIsoDate(from), toIsoDate(today), { apply: true });
    return;
  }
  if (preset === "month") {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    setDateRange(toIsoDate(from), toIsoDate(today), { apply: true });
  }
}

function resetAdvancedFilters() {
  state.filters = defaultAdvancedFilters();
  state.dateRangeInvalid = false;
  syncDateInputsFromState();
  renderOperationChips();
  renderResultChips();
  fillProductSelect(
    typeof _ctx?.getProducts === "function" ? _ctx.getProducts() : [],
  );
  showDateError("");
  updateDateTrigger();
  updateFilterBadge();
  resetAndFetchPage1().catch(console.error);
}

function openDetail(row) {
  state.selectedRecord = row;
  const modal = $("historyDetailModal");
  if (!modal) return;

  const evidence = parseValidationEvidence(row);
  const sync = parseSnapshotSync(row);
  const actor = formatExecutedByFull(row);
  const retired = isRetiredOperationType(row.operation_type);

  $("histDtTitle").textContent = row.correction_no || "Correction detail";
  $("histDtBody").innerHTML = `
    <div class="hist-dl-group">Correction identity</div>
    <table class="hist-dl">
      <tr><th>Correction no.</th><td>${esc(dash(row.correction_no))}</td></tr>
      <tr><th>Status</th><td>${esc(dash(row.status))}</td></tr>
      <tr><th>Operation</th><td class="${
        retired ? "hist-retired-label" : ""
      }">${esc(labelForOperationType(row.operation_type))}</td></tr>
      <tr><th>Result</th><td>${esc(
        labelForOperationResult(row.operation_result),
      )}</td></tr>
      <tr><th>Record id</th><td>${esc(dash(row.id))}</td></tr>
    </table>

    <div class="hist-dl-group">Product and BMR</div>
    <table class="hist-dl">
      <tr><th>Product</th><td>${esc(dash(row.product_name))}</td></tr>
      <tr><th>Product id</th><td>${esc(dash(row.product_id))}</td></tr>
      <tr><th>Old BN</th><td>${esc(dash(row.old_bn))}</td></tr>
      <tr><th>New BN</th><td>${esc(dash(row.new_bn))}</td></tr>
      <tr><th>Old BMR id</th><td>${esc(dash(row.old_bmr_id))}</td></tr>
      <tr><th>New BMR id</th><td>${esc(dash(row.new_bmr_id))}</td></tr>
      <tr><th>UOM</th><td>${esc(dash(row.uom))}</td></tr>
    </table>

    <div class="hist-dl-group">Plan context</div>
    <table class="hist-dl">
      <tr><th>Plan batch id</th><td>${esc(dash(row.batch_plan_batch_id))}</td></tr>
      <tr><th>Plan header id</th><td>${esc(dash(row.batch_plan_header_id))}</td></tr>
      <tr><th>Planned batch size</th><td>${esc(dash(row.planned_batch_size))}</td></tr>
    </table>

    <div class="hist-dl-group">Before and after values</div>
    <table class="hist-dl">
      <tr><th>Old size</th><td>${esc(dash(row.old_bmr_batch_size))}</td></tr>
      <tr><th>New size</th><td>${esc(dash(row.new_bmr_batch_size))}</td></tr>
      <tr><th>Planned size</th><td>${esc(dash(row.planned_batch_size))}${
        row.planned_batch_size != null &&
        row.old_bmr_batch_size != null &&
        Number(row.planned_batch_size) === Number(row.old_bmr_batch_size)
          ? ' <span class="hist-muted">(unchanged from prior planned snapshot)</span>'
          : ""
      }</td></tr>
    </table>

    <div class="hist-dl-group">Reason and reference</div>
    <table class="hist-dl">
      <tr><th>Reason</th><td>${esc(dash(row.reason))}</td></tr>
      <tr><th>Supporting reference</th><td>${esc(
        dash(row.supporting_reference),
      )}</td></tr>
      <tr><th>Impact acknowledged</th><td>${esc(
        yesNo(row.impact_acknowledged),
      )}</td></tr>
    </table>

    <div class="hist-dl-group">Execution details</div>
    <table class="hist-dl">
      <tr><th>Executed at</th><td>${esc(dash(row.executed_at))}</td></tr>
      <tr><th>Executed by</th><td>${esc(actor.display)}</td></tr>
      <tr><th>Executed by UUID</th><td>${esc(dash(actor.uuid))}</td></tr>
      <tr><th>Requested by</th><td>${esc(dash(row.requested_by))}</td></tr>
      <tr><th>Requested at</th><td>${esc(dash(row.requested_at))}</td></tr>
    </table>

    <div class="hist-dl-group">Operational evidence</div>
    <table class="hist-dl">
      <tr><th>Work-log count</th><td>${esc(dash(evidence.work_log_count))}</td></tr>
      <tr><th>Laboratory-analysis count</th><td>${esc(
        dash(evidence.lab_analysis_count),
      )}</td></tr>
      <tr><th>Control-sample count</th><td>${esc(
        dash(evidence.control_sample_count),
      )}</td></tr>
      <tr><th>Operationally used</th><td>${esc(
        yesNo(evidence.operationally_used),
      )}</td></tr>
      <tr><th>Snapshot sync required</th><td>${esc(
        yesNo(evidence.snapshot_sync_required),
      )}</td></tr>
    </table>

    <div class="hist-dl-group">Snapshot synchronisation</div>
    <table class="hist-dl">
      <tr><th>Work logs updated</th><td>${esc(
        dash(sync.work_logs_updated),
      )}</td></tr>
      <tr><th>Laboratory analyses updated</th><td>${esc(
        dash(sync.lab_analyses_updated),
      )}</td></tr>
      <tr><th>Control samples updated</th><td>${esc(
        dash(sync.control_samples_updated),
      )}</td></tr>
      <tr><th>Process-output quantities changed</th><td>${esc(
        yesNo(sync.process_output_quantities_changed),
      )}</td></tr>
    </table>

    <details class="hist-tech">
      <summary>Technical Audit Payload</summary>
      <pre class="hist-json">${esc(
        JSON.stringify(
          {
            before_snapshot: row.before_snapshot ?? null,
            after_snapshot: row.after_snapshot ?? null,
            validation_snapshot: row.validation_snapshot ?? null,
          },
          null,
          2,
        ),
      )}</pre>
    </details>
  `;

  const tech = $("histDtBody")?.querySelector("details.hist-tech");
  if (tech) tech.open = false;

  modal.classList.remove("hidden");
}

function closeDetail() {
  state.selectedRecord = null;
  const modal = $("historyDetailModal");
  if (modal) modal.classList.add("hidden");
}

function onDocumentPointerDown(e) {
  if (!state.filterDrawerOpen) return;
  const wrap = document.querySelector("#panel-history .hist-filter-wrap");
  const scrim = $("histFilterScrim");
  if (scrim && e.target === scrim) {
    setFilterDrawerOpen(false);
    return;
  }
  if (wrap && !wrap.contains(e.target)) {
    setFilterDrawerOpen(false);
  }
}

function wireOnce() {
  if (_wired) return;
  _wired = true;

  $("histFilterSearch")?.addEventListener("input", () => {
    scheduleSearchApply();
  });
  $("histFilterSearch")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applySearchNow($("histFilterSearch").value);
    }
  });
  $("histSearchClear")?.addEventListener("click", () => {
    if ($("histFilterSearch")) $("histFilterSearch").value = "";
    applySearchNow("");
  });

  $("histFiltersBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    setFilterDrawerOpen(!state.filterDrawerOpen);
  });
  $("histFiltersBtn")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setFilterDrawerOpen(!state.filterDrawerOpen);
    }
  });
  $("histFilterScrim")?.addEventListener("click", () => {
    setFilterDrawerOpen(false);
  });
  $("histResetFiltersBtn")?.addEventListener("click", () => {
    resetAdvancedFilters();
  });

  $("histDateTrigger")?.addEventListener("click", (e) => {
    e.stopPropagation();
    state.datePanelOpen = !state.datePanelOpen;
    updateDateTrigger();
  });

  $("histFilterDateFrom")?.addEventListener("change", () => {
    const from = $("histFilterDateFrom")?.value || "";
    const to = $("histFilterDateTo")?.value || "";
    state.filters = { ...state.filters, dateFrom: from, dateTo: to };
    if (from && to && from > to) {
      state.dateRangeInvalid = true;
      showDateError("Date from cannot be later than date to.");
      updateDateTrigger();
      updateFilterBadge();
      return;
    }
    applyAdvancedFilters();
  });
  $("histFilterDateTo")?.addEventListener("change", () => {
    const from = $("histFilterDateFrom")?.value || "";
    const to = $("histFilterDateTo")?.value || "";
    state.filters = { ...state.filters, dateFrom: from, dateTo: to };
    if (from && to && from > to) {
      state.dateRangeInvalid = true;
      showDateError("Date from cannot be later than date to.");
      updateDateTrigger();
      updateFilterBadge();
      return;
    }
    applyAdvancedFilters();
  });

  $("histDatePanel")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-hist-date-preset]");
    if (!btn) return;
    applyDatePreset(btn.getAttribute("data-hist-date-preset"));
  });

  $("histOperationChips")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-hist-operation]");
    if (!btn) return;
    const value = btn.getAttribute("data-hist-operation") || "";
    state.filters = {
      ...state.filters,
      operationType: state.filters.operationType === value ? "" : value,
    };
    renderOperationChips();
    applyAdvancedFilters();
  });

  $("histResultChips")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-hist-result]");
    if (!btn) return;
    const value = btn.getAttribute("data-hist-result") || "";
    state.filters = {
      ...state.filters,
      operationResult: state.filters.operationResult === value ? "" : value,
    };
    renderResultChips();
    applyAdvancedFilters();
  });

  $("histFilterProduct")?.addEventListener("change", () => {
    state.filters = {
      ...state.filters,
      productId: $("histFilterProduct")?.value || "",
    };
    applyAdvancedFilters();
  });

  $("histTableBody")?.addEventListener("click", (e) => {
    const tr = e.target.closest("tr.hist-row");
    if (!tr) return;
    const id = tr.dataset.id;
    const row = state.rows.find((r) => String(r.id) === String(id));
    if (row) openDetail(row);
  });
  $("histDetailClose")?.addEventListener("click", closeDetail);
  $("histDetailCloseBtn")?.addEventListener("click", closeDetail);
  $("historyDetailModal")?.addEventListener("click", (e) => {
    if (e.target === $("historyDetailModal")) closeDetail();
  });

  if (!_documentClickBound) {
    _documentClickBound = true;
    document.addEventListener("pointerdown", onDocumentPointerDown);
  }
}

function ensureCompletionListener() {
  if (_completionListening) return;
  _completionListening = true;
  window.addEventListener(COMPLETION_EVENT, () => {
    if (typeof _ctx?.isHistoryActive === "function" && _ctx.isHistoryActive()) {
      resetAndFetchPage1().catch(console.error);
    } else {
      state.historyStale = true;
    }
  });
}

/**
 * Initialise Change History tab once.
 * @param {{ toast?: Function, isHistoryActive?: () => boolean, getProducts?: () => any[] }} ctx
 */
export function initBmrChangeHistoryTab(ctx = {}) {
  _ctx = ctx;
  wireOnce();
  ensureCompletionListener();
  syncToolbarFromState();
}

/** Call when Change History tab becomes active. */
export async function activateBmrChangeHistoryTab() {
  syncToolbarFromState();
  if (state.historyStale || !state.rows.length) {
    await resetAndFetchPage1();
  } else {
    renderTable();
    attachSentinel();
  }
}

/** Refresh if tab active or mark stale. */
export function notifyBmrChangeHistoryCorrectionCompleted() {
  if (typeof _ctx?.isHistoryActive === "function" && _ctx.isHistoryActive()) {
    resetAndFetchPage1().catch(console.error);
  } else {
    state.historyStale = true;
  }
}

export function refreshBmrChangeHistoryProducts(products) {
  fillProductSelect(products || []);
}

/** Exported for smoke tests / diagnostics. */
export const __historyTestHooks = {
  COMPLETION_EVENT,
  SEARCH_DEBOUNCE_MS,
  FIXED_PAGE_SIZE,
  defaultAdvancedFilters,
  countActiveAdvancedFilters,
  describeDateRange,
  isDateRangeInvalid,
  getState: () => state,
  hasCompletionListener: () => _completionListening,
  isWired: () => _wired,
  hasSentinelObserver: () => !!_sentinelObserver,
};
