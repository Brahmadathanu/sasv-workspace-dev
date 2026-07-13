import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

const MODULE_ID = "vendor-master";
const MODULE_TARGET = "module:vendor-master";
const TAB_KEYS = ["vendors", "vendor-mapping", "rate-book"];
const CANONICAL_VENDOR_TYPES = [
  "REGULAR_SUPPLIER",
  "LOCAL_VARIABLE_SUPPLIER",
  "UNCLASSIFIED",
];
const DEFAULT_VENDOR_TYPE = "REGULAR_SUPPLIER";
const LOCAL_VARIABLE_SUPPLIER_TYPE = "LOCAL_VARIABLE_SUPPLIER";

const accessState = {
  userId: null,
  canView: false,
  canEdit: false,
  loaded: false,
};

const state = {
  tab: "vendors",
  lookups: {
    uomCodeToId: new Map(),
    uomIdToCode: new Map(),
    ready: false,
  },
  loaded: {
    vendors: false,
    mapping: false,
    rates: false,
  },
  mapping: {
    q: "",
    page: 0,
    pageSize: 75,
    rows: [],
    totalCount: null,
    totalPages: 1,
    isLoading: false,
    reqToken: 0,
    debounceTimer: null,
    initialAutoSyncAttempted: false,
    selectedVendorId: null,
    selectedVendorName: "",
    selectedAlias: null,
    saving: false,
  },
  vendors: {
    q: "",
    page: 0,
    pageSize: 75,
    total: 0,
    rows: [],
    list: [],
    activeList: [],
    vendorIndex: new Map(),
  },
  rates: {
    vendorId: "",
    q: "",
    page: 0,
    pageSize: 75,
    total: 0,
    rows: [],
  },
  vendorEdit: {
    vendorId: null,
    displayName: "",
    storedIsActive: true,
    vendorType: "",
    row: null,
  },
  rateEdit: {
    rateId: null,
    meta: {},
    row: null,
  },
  pendingDuplicate: null,
  statusTransition: null,
  savingVendor: false,
  savingRate: false,
};

const modalFocusState = new Map();
let rateItemComboboxCtl = null;

function qs(id) {
  return document.getElementById(id);
}

function getFieldValue(id) {
  const el = qs(id);
  if (!el) return "";
  return String(el.value ?? "").trim();
}

function setFieldValue(id, value) {
  const el = qs(id);
  if (!el) return;
  el.value = value ?? "";
}

function setVendorTypeField(fieldId, value) {
  const el = qs(fieldId);
  if (!el) return;
  const canonical = String(value ?? "").trim();
  el.value = CANONICAL_VENDOR_TYPES.includes(canonical) ? canonical : "";
}

function nullIfEmpty(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function canAccessModule() {
  return Boolean(accessState.canView || accessState.canEdit);
}

function canWriteModule() {
  return Boolean(accessState.canEdit);
}

function canPerformEditAction(actionLabel = "This action") {
  if (canWriteModule()) return true;
  toast(`${actionLabel} is not available with read-only access.`, "error");
  return false;
}

function markEditAction(el, reason = "Read-only access") {
  if (!el) return;
  el.dataset.editAction = "true";
  if (!el.dataset.originalTitle) {
    el.dataset.originalTitle = el.getAttribute("title") || "";
  }
  if (!el.dataset.viewOnlyReason) {
    el.dataset.viewOnlyReason = reason;
  }
}

function applyPermissionUi() {
  const hasAccess = canAccessModule();
  const canEdit = canWriteModule();

  document.body.classList.toggle("view-only-mode", hasAccess && !canEdit);

  const banner = qs("viewOnlyBanner");
  if (banner) banner.hidden = !(hasAccess && !canEdit);

  document.querySelectorAll("[data-edit-action='true']").forEach((el) => {
    if (
      !(
        el instanceof HTMLButtonElement ||
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement
      )
    ) {
      return;
    }

    if (!el.dataset.permissionTracked) {
      el.dataset.permissionTracked = "true";
      el.dataset.originalDisabled = String(el.disabled);
      el.dataset.originalTitle = el.getAttribute("title") || "";
    }

    if (!canEdit) {
      el.disabled = true;
      el.setAttribute("aria-disabled", "true");
      el.setAttribute("title", el.dataset.viewOnlyReason || "Read-only access");
      return;
    }

    const originalDisabled = el.dataset.originalDisabled === "true";
    el.disabled = originalDisabled;
    el.setAttribute("aria-disabled", String(el.disabled));

    const originalTitle = el.dataset.originalTitle || "";
    if (originalTitle) {
      el.setAttribute("title", originalTitle);
    } else if (!el.disabled) {
      el.removeAttribute("title");
    }
  });
}

async function loadAccessState() {
  accessState.userId = null;
  accessState.canView = false;
  accessState.canEdit = false;
  accessState.loaded = false;

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.user?.id) {
    throw sessionError || new Error("No active session");
  }

  accessState.userId = session.user.id;
  const uid = accessState.userId;
  let found = null;

  try {
    const { data: perms, error } = await supabase.rpc("get_user_permissions", {
      p_user_id: uid,
    });
    if (!error && Array.isArray(perms)) {
      const hit = perms.find((r) => r?.target === MODULE_TARGET);
      if (hit) found = hit;
    }
  } catch {
    // fall through
  }

  if (!found) {
    try {
      const { data: canonicalRows } = await supabase
        .from("user_permissions_canonical")
        .select("can_view, can_edit")
        .eq("user_id", uid)
        .eq("target", MODULE_TARGET)
        .limit(1);
      if (Array.isArray(canonicalRows) && canonicalRows.length) {
        found = canonicalRows[0];
      }
    } catch {
      // fall through
    }
  }

  if (!found) {
    try {
      const { data: rows } = await supabase
        .from("user_permissions")
        .select("can_view, can_edit")
        .eq("user_id", uid)
        .eq("module_id", MODULE_ID)
        .limit(1);
      if (Array.isArray(rows) && rows.length) {
        found = rows[0];
      }
    } catch {
      // fail closed
    }
  }

  if (found) {
    accessState.canView = Boolean(found.can_view);
    accessState.canEdit = Boolean(found.can_edit);
  }

  accessState.loaded = true;
}

function setAccessDenied(message) {
  const status = qs("accessStatus");
  const panel = qs("mainPanel");
  if (status) {
    status.hidden = false;
    status.textContent = message;
  }
  if (panel) panel.hidden = true;
}

function isDuplicateError(error) {
  return String(error?.code ?? "") === "23505";
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function deriveRatePresentationStatus(row) {
  if (row?.is_active === false) return "INACTIVE";
  const today = todayIsoDate();
  const validFrom = String(row?.valid_from ?? "").slice(0, 10);
  const validTo = String(row?.valid_to ?? "").slice(0, 10);
  if (validFrom && validFrom > today) return "FUTURE";
  if (validTo && validTo < today) return "EXPIRED";
  return "ACTIVE";
}

function rateStatusClass(status) {
  switch (status) {
    case "INACTIVE":
      return "rate-status-inactive";
    case "FUTURE":
      return "rate-status-future";
    case "EXPIRED":
      return "rate-status-expired";
    default:
      return "rate-status-active";
  }
}

function hasText(value) {
  return Boolean(String(value ?? "").trim());
}

function deriveProfileCompleteness(rowLike, storedIsActive, vendorType) {
  if (storedIsActive === false) return "INACTIVE_HISTORICAL";

  const isLocal = vendorType === LOCAL_VARIABLE_SUPPLIER_TYPE;
  const hasIdentity =
    hasText(rowLike.display_name) && hasText(rowLike.vendor_type);
  if (!hasIdentity) return "IDENTITY_ONLY";

  const contactFields = [
    rowLike.phone,
    rowLike.email,
    rowLike.address_line1,
    rowLike.city,
    rowLike.state,
    rowLike.pincode,
  ];
  const contactCount = contactFields.filter(hasText).length;

  if (contactCount === 0) return "IDENTITY_ONLY";
  if (contactCount < 3) return "CONTACT_PARTIAL";

  if (isLocal) {
    return contactCount >= 3 ? "OPERATIONAL_READY" : "CONTACT_PARTIAL";
  }

  const complianceFields = [rowLike.gstin, rowLike.pan, rowLike.payment_terms];
  const complianceCount = complianceFields.filter(hasText).length;
  const addressComplete =
    hasText(rowLike.address_line1) &&
    hasText(rowLike.city) &&
    hasText(rowLike.state) &&
    hasText(rowLike.pincode);

  if (!addressComplete || complianceCount === 0) return "COMPLIANCE_PARTIAL";
  if (complianceCount < 3) return "COMPLIANCE_PARTIAL";

  return "PROFILE_COMPLETE";
}

function profileBadgeMeta(stateKey) {
  switch (stateKey) {
    case "IDENTITY_ONLY":
      return { label: "Identity Only", className: "identity-only" };
    case "CONTACT_PARTIAL":
      return { label: "Contact Partial", className: "contact-partial" };
    case "OPERATIONAL_READY":
      return { label: "Operational Ready", className: "operational-ready" };
    case "COMPLIANCE_PARTIAL":
      return { label: "Compliance Partial", className: "compliance-partial" };
    case "PROFILE_COMPLETE":
      return { label: "Profile Complete", className: "profile-complete" };
    case "INACTIVE_HISTORICAL":
    default:
      return { label: "Inactive Historical", className: "inactive-historical" };
  }
}

function renderProfileBadgeFromForm() {
  const wrap = qs("vendorProfileBadgeWrap");
  const badge = qs("vendorProfileBadge");
  if (!wrap || !badge) return;

  const snapshot = {
    display_name: getFieldValue("vendorDisplayName"),
    vendor_type: getFieldValue("vendorType"),
    phone: getFieldValue("vendorPhone"),
    email: getFieldValue("vendorEmail"),
    address_line1: getFieldValue("vendorAddress1"),
    city: getFieldValue("vendorCity"),
    state: getFieldValue("vendorState"),
    pincode: getFieldValue("vendorPinCode"),
    gstin: getFieldValue("vendorGst"),
    pan: getFieldValue("vendorPan"),
    payment_terms: getFieldValue("vendorPaymentTerms"),
  };

  const completeness = deriveProfileCompleteness(
    snapshot,
    state.vendorEdit.storedIsActive,
    getFieldValue("vendorType"),
  );
  const meta = profileBadgeMeta(completeness);
  badge.textContent = meta.label;
  badge.className = `profile-badge ${meta.className}`;
  wrap.hidden = false;
}

function buildExtendedProfilePatch() {
  return {
    legal_name: nullIfEmpty(getFieldValue("vendorLegalName")),
    website: nullIfEmpty(getFieldValue("vendorWebsite")),
    district: nullIfEmpty(getFieldValue("vendorDistrict")),
    country: nullIfEmpty(getFieldValue("vendorCountry")),
    pan: nullIfEmpty(getFieldValue("vendorPan")),
    payment_terms: nullIfEmpty(getFieldValue("vendorPaymentTerms")),
  };
}

function readVendorIdentityFields() {
  return {
    displayName: getFieldValue("vendorDisplayName"),
    vendorType: getFieldValue("vendorType"),
    phone: nullIfEmpty(getFieldValue("vendorPhone")),
    email: nullIfEmpty(getFieldValue("vendorEmail")),
    address_line1: nullIfEmpty(getFieldValue("vendorAddress1")),
    address_line2: nullIfEmpty(getFieldValue("vendorAddress2")),
    city: nullIfEmpty(getFieldValue("vendorCity")),
    state: nullIfEmpty(getFieldValue("vendorState")),
    pincode: nullIfEmpty(getFieldValue("vendorPinCode")),
    gstin: nullIfEmpty(getFieldValue("vendorGst")),
    notes: nullIfEmpty(getFieldValue("vendorNotes")),
    extendedProfilePatch: buildExtendedProfilePatch(),
  };
}

function extractPagedTotal(rows) {
  if (!Array.isArray(rows) || !rows.length) return 0;
  const total = rows[0]?.total_count;
  return Number.isFinite(Number(total)) ? Number(total) : rows.length;
}

function setRateUomFromId(uomId, fallbackCode = "") {
  const id = toNum(uomId, 0);
  const code = id
    ? state.lookups.uomIdToCode.get(id) || fallbackCode || ""
    : "";

  setFieldValue("rateUomId", id ? String(id) : "");
  setFieldValue("rateUom", code);

  return Boolean(id && code);
}

function clearRateItemSelection({ keepSearchText = false } = {}) {
  setFieldValue("rateStockItemId", "");
  setFieldValue("rateMaterialClassId", "");
  setFieldValue("rateUomId", "");
  setFieldValue("rateUom", "");

  if (!keepSearchText) {
    setFieldValue("rateItemSearch", "");
    const input = qs("rateItemSearch");
    if (input) {
      input.dataset.selectedId = "";
      input.dataset.selectedName = "";
    }
  }

  const wrap = qs("rateItemResults");
  if (wrap) {
    wrap.hidden = true;
    wrap.innerHTML = "";
  }
  rateItemComboboxCtl?.resetState();
}

function setTabTableLoading(tabName, active, label = "Loading...") {
  const panel = qs(`tab-${tabName}`);
  if (!panel) return;

  const scrollAreas = panel.querySelectorAll(".card .table-scroll");
  if (!scrollAreas.length) return;

  scrollAreas.forEach((area) => {
    if (!(area instanceof HTMLElement)) return;

    if (active) {
      area.classList.add("loading");
      let mask = area.querySelector(":scope > .table-loading-mask");
      if (!mask) {
        mask = document.createElement("div");
        mask.className = "table-loading-mask";
        mask.innerHTML = `<span class="table-loading-spinner" aria-hidden="true"></span><span>${esc(label)}</span>`;
        area.appendChild(mask);
      }
      return;
    }

    area.classList.remove("loading");
    area.querySelector(":scope > .table-loading-mask")?.remove();
  });
}

function qsa(sel) {
  return Array.from(document.querySelectorAll(sel));
}

function setClearButtonState(inputEl, clearBtnEl) {
  if (!inputEl || !clearBtnEl) return;
  clearBtnEl.style.display = inputEl.value ? "" : "none";
}

function wireSearchInput({ inputId, clearId, onInput, debounceMs = 220 }) {
  const inputEl = qs(inputId);
  const clearBtnEl = qs(clearId);
  if (!inputEl) return;

  const wrap = inputEl.closest(".pec-search-wrap");
  let requestSeq = 0;

  const setSearching = (active) => {
    if (wrap) wrap.classList.toggle("is-searching", Boolean(active));
  };

  const runSearch = () => {
    const current = ++requestSeq;
    setSearching(true);
    return Promise.resolve(onInput?.((inputEl.value || "").trim()))
      .catch(() => {})
      .finally(() => {
        if (current === requestSeq) setSearching(false);
      });
  };

  const runSearchDebounced = debounce(runSearch, debounceMs);

  inputEl.addEventListener("input", () => {
    setClearButtonState(inputEl, clearBtnEl);
    runSearchDebounced();
  });

  inputEl.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    runSearch();
  });

  clearBtnEl?.addEventListener("click", () => {
    if (!inputEl.value) return;
    inputEl.value = "";
    setClearButtonState(inputEl, clearBtnEl);
    runSearch();
    inputEl.focus();
  });

  setClearButtonState(inputEl, clearBtnEl);
}

function debounce(fn, wait = 280) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function fmtRange(page, size, total) {
  if (!total) return "0-0 of 0";
  const start = page * size + 1;
  const end = Math.min(total, page * size + size);
  return `${start}-${end} of ${total.toLocaleString()}`;
}

function toast(msg, type = "info") {
  const c = qs("toastContainer");
  if (!c) return;
  const div = document.createElement("div");
  const bg =
    type === "error" ? "#c0392b" : type === "success" ? "#27ae60" : "#34495e";
  div.textContent = msg;
  div.style.cssText = `background:${bg};color:#fff;padding:10px 14px;border-radius:10px;font-size:13px;pointer-events:auto;box-shadow:0 2px 8px rgba(0,0,0,.2);opacity:1;transition:opacity .4s;`;
  c.appendChild(div);
  setTimeout(() => {
    div.style.opacity = "0";
  }, 3000);
  setTimeout(() => div.remove(), 3500);
}

async function requireSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) window.location.href = "../../login.html";
}

function getHashTab() {
  const raw = (window.location.hash || "").replace("#", "").trim();
  return TAB_KEYS.includes(raw) ? raw : "vendors";
}

function setHashTab(tab) {
  if (!TAB_KEYS.includes(tab)) return;
  if (window.location.hash !== `#${tab}`) {
    history.replaceState(null, "", `#${tab}`);
  }
}

async function setActiveTab(tab, updateHash = true) {
  if (!TAB_KEYS.includes(tab)) tab = "vendors";
  state.tab = tab;

  qsa(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  qsa(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tab}`);
  });

  const select = qs("tabSelect");
  if (select) select.value = tab;
  if (updateHash) setHashTab(tab);

  if (tab === "vendors" && !state.loaded.vendors) {
    state.loaded.vendors = await loadVendorsPaged();
  }
  if (tab === "vendor-mapping") {
    const isFirstOpen = !state.loaded.mapping;
    await loadUnmappedAliasCount();
    state.mapping.q = "";
    state.mapping.page = 0;
    let loaded = await loadVendorMappingPage();

    if (
      isFirstOpen &&
      !state.mapping.initialAutoSyncAttempted &&
      !state.mapping.q &&
      state.mapping.page === 0 &&
      state.mapping.rows.length === 0
    ) {
      state.mapping.initialAutoSyncAttempted = true;
      const synced = await runVendorAliasSync({
        loadingLabel: "Refreshing aliases…",
        showErrorToast: true,
      });
      if (synced) {
        await loadUnmappedAliasCount();
        loaded = await loadVendorMappingPage();
      }
    }

    state.loaded.mapping = loaded || state.loaded.mapping;
  }
  if (tab === "rate-book" && !state.loaded.rates) {
    state.loaded.rates = await loadRateBook();
  }
}

function focusElementIfPossible(el) {
  if (!(el instanceof HTMLElement)) return false;
  if (!document.contains(el)) return false;
  if (el.matches(":disabled") || el.getAttribute("aria-disabled") === "true") {
    return false;
  }
  try {
    el.focus();
    return document.activeElement === el;
  } catch {
    return false;
  }
}

function moveFocusOutsideModal(backdrop, preferredTargets = []) {
  if (!backdrop) return;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return;
  if (!backdrop.contains(active)) return;

  const fallbackTargets = [
    ...preferredTargets,
    qs("btnRefresh"),
    qs("homeBtn"),
    qs("mapSearch"),
    qs("vendorSearch"),
    qs("rateSearch"),
  ];

  for (const target of fallbackTargets) {
    if (target === active) continue;
    if (
      focusElementIfPossible(target) &&
      !backdrop.contains(document.activeElement)
    ) {
      return;
    }
  }

  active.blur();
  if (!backdrop.contains(document.activeElement)) return;

  const body = document.body;
  const hadTabIndex = body.hasAttribute("tabindex");
  if (!hadTabIndex) body.setAttribute("tabindex", "-1");
  body.focus();
  if (!hadTabIndex) body.removeAttribute("tabindex");
}

function initModalAccessibility() {
  qsa(".modal-backdrop").forEach((backdrop) => {
    const isOpen = backdrop.classList.contains("show");
    backdrop.setAttribute("aria-hidden", isOpen ? "false" : "true");
    backdrop.inert = !isOpen;
  });
}

function openModal(id) {
  const backdrop = qs(id);
  if (!backdrop) return;
  const active = document.activeElement;
  modalFocusState.set(
    id,
    active instanceof HTMLElement && document.contains(active) ? active : null,
  );

  backdrop.inert = false;
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
}

function closeModal(id) {
  const backdrop = qs(id);
  if (!backdrop) return;
  const lastFocused = modalFocusState.get(id);
  moveFocusOutsideModal(backdrop, [lastFocused]);

  backdrop.classList.remove("show");
  backdrop.setAttribute("aria-hidden", "true");
  backdrop.inert = true;

  if (lastFocused instanceof HTMLElement && !backdrop.contains(lastFocused)) {
    requestAnimationFrame(() => {
      focusElementIfPossible(lastFocused);
    });
  }
}

function wireModalEscapeClose() {
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (e.defaultPrevented) return;

    const openBackdrops = qsa(".modal-backdrop.show");
    if (!openBackdrops.length) return;

    const topMost = openBackdrops[openBackdrops.length - 1];
    if (!topMost?.id) return;

    e.preventDefault();
    closeModal(topMost.id);
  });
}

async function loadUnmappedAliasCount() {
  return fetchUnmappedAliasCount(qs("unmappedCountBadge"));
}

async function fetchUnmappedAliasCount(badge = null) {
  if (badge === null) badge = qs("unmappedCountBadge");
  if (!badge) return null;
  try {
    const { data, error } = await supabase.rpc(
      "proc_vendor_unmapped_alias_count",
    );
    if (error) throw error;

    let count = 0;
    if (typeof data === "number") count = data;
    else if (Array.isArray(data) && data.length) {
      count = toNum(
        data[0]?.count ?? data[0]?.unmapped_count ?? data[0]?.total_count,
        0,
      );
    } else if (data && typeof data === "object") {
      count = toNum(data.count ?? data.unmapped_count ?? data.total_count, 0);
    }
    if (badge)
      badge.textContent = `Unmapped aliases: ${count.toLocaleString()}`;
    return count;
  } catch (e) {
    console.error(e);
    if (badge) badge.textContent = "Unmapped aliases: ?";
    return null;
  }
}

async function loadVendorMappingPage() {
  const token = ++state.mapping.reqToken;
  state.mapping.isLoading = true;
  setTabTableLoading("vendor-mapping", true, "Loading vendor aliases…");
  try {
    const { q, page, pageSize } = state.mapping;
    const offset = page * pageSize;

    const { data, error } = await supabase.rpc(
      "proc_vendor_unmapped_alias_queue_paged",
      {
        p_q: q || null,
        p_limit: pageSize,
        p_offset: offset,
      },
    );

    if (token !== state.mapping.reqToken) return false;
    if (error) {
      toast(`Failed to load alias queue: ${error.message}`, "error");
      return false;
    }

    const rows = Array.isArray(data) ? data : [];
    state.mapping.rows = rows;

    let totalCount = null;
    if (q && q.trim()) {
      totalCount =
        rows.length && rows[0]?.total_count != null
          ? Number(rows[0].total_count)
          : 0;
    }

    state.mapping.totalCount = Number.isFinite(totalCount) ? totalCount : null;
    state.mapping.totalPages =
      state.mapping.totalCount !== null
        ? Math.max(1, Math.ceil(state.mapping.totalCount / pageSize))
        : 1;
    renderVendorMappingTable(rows);
    renderVendorMappingPager();
    return true;
  } catch (error) {
    if (token !== state.mapping.reqToken) return false;
    console.error(error);
    toast("Failed to load alias queue.", "error");
    return false;
  } finally {
    if (token === state.mapping.reqToken) {
      state.mapping.isLoading = false;
      setTabTableLoading("vendor-mapping", false);
    }
  }
}

function renderVendorMappingTable(rows) {
  const body = qs("mapTbody");
  if (!body) return;

  if (!rows.length) {
    body.innerHTML =
      '<tr><td colspan="2" class="empty-row">No unmapped aliases found.</td></tr>';
    return;
  }

  body.innerHTML = rows
    .map((r, idx) => {
      const alias = esc(r.alias_text ?? "");
      return `
        <tr class="clickable" data-idx="${idx}">
          <td class="alias-cell">${alias}</td>
          <td><span class="muted">-</span></td>
        </tr>
      `;
    })
    .join("");

  body.querySelectorAll("tr.clickable").forEach((tr) => {
    tr.addEventListener("click", () => {
      const idx = Number(tr.dataset.idx);
      openMapModal(rows[idx]);
    });
  });
}

function renderVendorMappingPager() {
  const { page, pageSize, totalCount, rows } = state.mapping;
  const paging = qs("mapPaging");
  const prev = qs("mapPrev");
  const next = qs("mapNext");
  if (!paging || !prev || !next) return;
  if (totalCount !== null) {
    const pages = Math.max(1, Math.ceil(totalCount / pageSize));
    paging.textContent = `Page ${page + 1}/${pages}`;
    prev.disabled = page <= 0;
    next.disabled = page >= pages - 1;
  } else {
    paging.textContent = `Page ${page + 1}`;
    prev.disabled = page <= 0;
    next.disabled = rows.length !== pageSize;
  }
}

async function syncVendorAliasesAndReload() {
  if (!canPerformEditAction("Refresh aliases")) return;
  try {
    const synced = await runVendorAliasSync({
      loadingLabel: "Refreshing aliases…",
      showErrorToast: true,
    });
    if (!synced) return;

    state.mapping.q = "";
    state.mapping.page = 0;
    const mapSearch = qs("mapSearch");
    const mapSearchClear = qs("mapSearchClear");
    if (mapSearch) mapSearch.value = "";
    setClearButtonState(mapSearch, mapSearchClear);

    await loadUnmappedAliasCount();
    await loadVendorMappingPage();
    toast("Alias queue refreshed.", "success");
  } catch (error) {
    console.error(error);
    toast("Alias refresh failed.", "error");
  } finally {
    setTabTableLoading("vendor-mapping", false);
  }
}

async function runVendorAliasSync({
  loadingLabel = "Refreshing aliases…",
  showErrorToast = true,
} = {}) {
  try {
    setTabTableLoading("vendor-mapping", true, loadingLabel);
    const { error } = await supabase.rpc("proc_vendor_alias_sync_from_sources");
    if (error) {
      if (showErrorToast) {
        toast(`Alias refresh failed: ${error.message}`, "error");
      }
      return false;
    }
    return true;
  } catch (error) {
    console.error(error);
    if (showErrorToast) {
      toast("Alias refresh failed.", "error");
    }
    return false;
  } finally {
    setTabTableLoading("vendor-mapping", false);
  }
}

function selectExistingVendor(vendorId, displayName) {
  state.mapping.selectedVendorId = Number(vendorId);
  state.mapping.selectedVendorName = displayName || "";
  qs("mapExistingSelected").textContent = state.mapping.selectedVendorId
    ? `Selected: ${displayName} (#${vendorId})`
    : "No vendor selected";
}

function renderMapExistingResults(rows) {
  const wrap = qs("mapExistingResults");
  if (!wrap) return;

  if (!rows.length) {
    wrap.hidden = false;
    wrap.innerHTML = '<div class="lookup-item muted">No matching vendors</div>';
    return;
  }

  wrap.hidden = false;
  wrap.innerHTML = rows
    .map(
      (v) =>
        `<div class="lookup-item" data-id="${v.vendor_id}" data-name="${esc(v.display_name || "")}" title="${esc(v.display_name || "")}">` +
        `${esc(v.display_name || "Unnamed")} <span class="muted">#${esc(v.vendor_id)}</span></div>`,
    )
    .join("");

  wrap.querySelectorAll(".lookup-item[data-id]").forEach((el) => {
    el.addEventListener("click", () => {
      selectExistingVendor(el.dataset.id, el.dataset.name || "");
      wrap.hidden = true;
    });
  });
}

async function searchVendorsForMapping(q) {
  const { data, error } = await supabase.rpc("proc_vendor_lookup", {
    p_q: q || null,
    p_active_only: false,
    p_vendor_type: null,
    p_limit: 20,
  });
  if (error) {
    toast(`Vendor search failed: ${error.message}`, "error");
    return;
  }
  renderMapExistingResults(Array.isArray(data) ? data : []);
}

function openMapModal(row) {
  if (!row) return;
  state.mapping.selectedAlias = row;
  state.mapping.selectedVendorId = null;
  state.mapping.selectedVendorName = "";

  const alias = row.alias_text ?? row.vendor_alias ?? "";
  qs("mapAliasText").value = alias;
  qs("mapDisplayName").value = alias;
  setFieldValue("mapVendorType", "");
  qs("mapExistingSearch").value = "";
  qs("mapExistingSelected").textContent = "No vendor selected";
  qs("mapExistingResults").hidden = true;
  qs("mapExistingResults").innerHTML = "";

  openModal("mapModalBackdrop");
  requestAnimationFrame(() => qs("mapDisplayName")?.focus());
}

function buildCreateMapRpcArgs({
  displayName,
  aliasText,
  vendorType,
  allowDuplicate = false,
  duplicateReason = null,
}) {
  return {
    p_display_name: displayName,
    p_alias_text: aliasText,
    p_vendor_type: vendorType,
    p_allow_duplicate: allowDuplicate,
    p_duplicate_reason: duplicateReason,
    p_allow_alias_reassignment: false,
    p_alias_reassignment_reason: null,
  };
}

async function invokeCreateVendorAndMap(args) {
  return supabase.rpc("proc_vendor_create_and_map_tally_alias", args);
}

async function createVendorAndMap(allowDuplicate = false, duplicateReason = null) {
  if (!canPerformEditAction("Create vendor and map alias")) return;
  if (state.mapping.saving) return;

  const aliasText = (qs("mapAliasText").value || "").trim();
  const displayName = (qs("mapDisplayName").value || "").trim();
  const vendorType = getFieldValue("mapVendorType");

  if (!aliasText || !displayName) {
    toast("Alias and display name are required.", "error");
    return;
  }
  if (!vendorType) {
    toast("Vendor type is required.", "error");
    return;
  }

  state.mapping.saving = true;
  const btn = qs("btnCreateMap");
  if (btn) btn.disabled = true;

  try {
    const args = buildCreateMapRpcArgs({
      displayName,
      aliasText,
      vendorType,
      allowDuplicate,
      duplicateReason,
    });
    const { error } = await invokeCreateVendorAndMap(args);

    if (error) {
      if (!allowDuplicate && isDuplicateError(error)) {
        openDuplicateModal({
          kind: "create-map",
          attemptedName: displayName,
          detail: error.message,
          retry: (reason) => createVendorAndMap(true, reason),
        });
        return;
      }
      toast(`Create + map failed: ${error.message}`, "error");
      return;
    }

    toast("Vendor created and alias mapped.", "success");
    closeModal("mapModalBackdrop");
    await Promise.all([
      loadUnmappedAliasCount(),
      loadVendorMappingPage(),
      loadVendorsList({ activeOnly: false }),
      loadVendorsList({ activeOnly: true }),
    ]);
    state.loaded.vendors = false;
    if (state.tab === "vendors") {
      state.loaded.vendors = await loadVendorsPaged();
    }
  } finally {
    state.mapping.saving = false;
    if (btn) btn.disabled = false;
    applyPermissionUi();
  }
}

async function mapAliasToExisting() {
  if (!canPerformEditAction("Map alias to existing vendor")) return;
  if (state.mapping.saving) return;

  const aliasText = (qs("mapAliasText").value || "").trim();
  const vendorId = Number(state.mapping.selectedVendorId);
  if (!aliasText) {
    toast("Alias is missing.", "error");
    return;
  }
  if (!vendorId) {
    toast("Select an existing vendor first.", "error");
    return;
  }

  state.mapping.saving = true;
  const btn = qs("btnMapExisting");
  if (btn) btn.disabled = true;

  try {
    const { error } = await supabase.rpc("proc_vendor_map_tally_alias", {
      p_alias_text: aliasText,
      p_vendor_id: vendorId,
    });

    if (error) {
      toast(`Map existing failed: ${error.message}`, "error");
      return;
    }

    toast("Alias mapped to existing vendor.", "success");
    closeModal("mapModalBackdrop");
    await Promise.all([loadUnmappedAliasCount(), loadVendorMappingPage()]);
  } finally {
    state.mapping.saving = false;
    if (btn) btn.disabled = false;
    applyPermissionUi();
  }
}

async function loadVendorsPaged() {
  setTabTableLoading("vendors", true, "Loading...");
  try {
    const { q, page, pageSize } = state.vendors;
    const offset = page * pageSize;

    const { data, error } = await supabase.rpc("proc_vendor_directory_paged", {
      p_q: q || null,
      p_vendor_type: null,
      p_is_active: null,
      p_limit: pageSize,
      p_offset: offset,
    });

    if (error) {
      toast(`Failed to load vendors: ${error.message}`, "error");
      return false;
    }

    const rows = Array.isArray(data) ? data : [];
    state.vendors.rows = rows;
    state.vendors.total = extractPagedTotal(rows);
    renderVendorTable();
    renderVendorPager();
    return true;
  } catch (error) {
    console.error(error);
    toast("Failed to load vendors.", "error");
    return false;
  } finally {
    setTabTableLoading("vendors", false);
  }
}

function renderVendorLookupOptions(selectEl, rows, firstOptionHtml) {
  if (!selectEl) return;
  const opt = rows
    .map(
      (v) =>
        `<option value="${v.vendor_id}">${esc(v.display_name || "Unnamed")} (#${v.vendor_id})</option>`,
    )
    .join("");
  selectEl.innerHTML = firstOptionHtml + opt;
}

async function loadVendorsList({ activeOnly = false } = {}) {
  try {
    const { data, error } = await supabase.rpc("proc_vendor_lookup", {
      p_q: null,
      p_active_only: activeOnly,
      p_vendor_type: null,
      p_limit: 5000,
    });

    if (error) {
      toast(`Failed to load vendors list: ${error.message}`, "error");
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    if (activeOnly) {
      state.vendors.activeList = rows;
    } else {
      state.vendors.list = rows;
      state.vendors.vendorIndex = new Map(
        rows.map((v) => [Number(v.vendor_id), v.display_name || ""]),
      );
      renderVendorLookupOptions(
        qs("rateVendorFilter"),
        rows,
        '<option value="">All vendors</option>',
      );
    }
  } catch (error) {
    console.error(error);
    toast("Failed to load vendor lookup.", "error");
  }
}

function populateRateVendorSelect({ isNew, selectedVendorId = null } = {}) {
  const sel = qs("rateVendorId");
  if (!sel) return;

  const rows = [...state.vendors.activeList];
  if (!isNew && selectedVendorId) {
    const currentId = Number(selectedVendorId);
    const inActive = rows.some((v) => Number(v.vendor_id) === currentId);
    if (!inActive) {
      const fromAll = state.vendors.list.find(
        (v) => Number(v.vendor_id) === currentId,
      );
      if (fromAll) rows.unshift(fromAll);
      else {
        rows.unshift({
          vendor_id: currentId,
          display_name: `Vendor #${currentId}`,
        });
      }
    }
  }

  renderVendorLookupOptions(
    sel,
    rows,
    '<option value="">Select vendor</option>',
  );
  if (selectedVendorId) sel.value = String(selectedVendorId);
}

async function loadUomLookup() {
  try {
    const { data, error } = await supabase
      .from("inv_uom")
      .select("id, code")
      .limit(2000);

    if (error) {
      toast(`Failed to load UOM lookup: ${error.message}`, "error");
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    const codeToId = new Map();
    const idToCode = new Map();

    rows.forEach((r) => {
      const id = toNum(r?.id, 0);
      const code = String(r?.code ?? "").trim();
      if (!id || !code) return;
      codeToId.set(code.toLowerCase(), id);
      idToCode.set(id, code);
    });

    state.lookups.uomCodeToId = codeToId;
    state.lookups.uomIdToCode = idToCode;
    state.lookups.ready = true;
  } catch (error) {
    console.error(error);
    toast("Failed to load UOM lookup.", "error");
  }
}

function renderVendorTable() {
  const body = qs("vendorTbody");
  if (!body) return;

  const rows = state.vendors.rows;
  if (!rows.length) {
    body.innerHTML =
      '<tr><td colspan="3" class="empty-row">No vendors found.</td></tr>';
    return;
  }

  body.innerHTML = rows
    .map((v, idx) => {
      const isActive = v.is_active !== false;
      return `
        <tr class="clickable" data-idx="${idx}">
          <td class="mono">${esc(v.vendor_id)}</td>
          <td>${esc(v.display_name || "")}</td>
          <td><span class="pill ${isActive ? "ok" : "no"}">${isActive ? "Yes" : "No"}</span></td>
        </tr>
      `;
    })
    .join("");

  body.querySelectorAll("tr.clickable").forEach((tr) => {
    tr.addEventListener("click", () => {
      const row = state.vendors.rows[Number(tr.dataset.idx)];
      openVendorModal(row);
    });
  });
}

function renderVendorPager() {
  const { page, pageSize, total } = state.vendors;
  qs("vendorPaging").textContent = fmtRange(page, pageSize, total);
  qs("vendorPrev").disabled = page <= 0;
  qs("vendorNext").disabled = (page + 1) * pageSize >= total;
}

function updateVendorStatusUi() {
  const badge = qs("vendorStatusBadge");
  const badgeWrap = qs("vendorStatusBadgeWrap");
  const activeWrap = qs("vendorIsActiveWrap");
  const toggle = qs("btnVendorToggle");
  const active = state.vendorEdit.storedIsActive !== false;

  if (badgeWrap) badgeWrap.hidden = !state.vendorEdit.vendorId;
  if (activeWrap) activeWrap.hidden = Boolean(state.vendorEdit.vendorId);

  if (badge) {
    badge.textContent = active ? "Active" : "Inactive";
    badge.className = `vendor-status-badge ${active ? "active" : "inactive"}`;
  }

  if (toggle) {
    toggle.textContent = active ? "Deactivate" : "Reactivate";
    toggle.disabled = !state.vendorEdit.vendorId;
  }
}

function populateVendorFormFromRow(row, { isNew = !row } = {}) {
  setFieldValue("vendorId", row?.vendor_id ?? "");
  setFieldValue("vendorDisplayName", row?.display_name ?? "");
  setFieldValue("vendorLegalName", row?.legal_name ?? "");
  setVendorTypeField(
    "vendorType",
    isNew ? DEFAULT_VENDOR_TYPE : row?.vendor_type,
  );
  setFieldValue("vendorPhone", row?.phone ?? "");
  setFieldValue("vendorEmail", row?.email ?? "");
  setFieldValue("vendorWebsite", row?.website ?? "");
  setFieldValue("vendorAddress1", row?.address_line1 ?? "");
  setFieldValue("vendorAddress2", row?.address_line2 ?? "");
  setFieldValue("vendorCity", row?.city ?? "");
  setFieldValue("vendorDistrict", row?.district ?? "");
  setFieldValue("vendorState", row?.state ?? "");
  setFieldValue("vendorPinCode", row?.pincode ?? "");
  setFieldValue("vendorCountry", row?.country ?? "");
  setFieldValue("vendorGst", row?.gstin ?? "");
  setFieldValue("vendorPan", row?.pan ?? "");
  setFieldValue("vendorPaymentTerms", row?.payment_terms ?? "");
  setFieldValue("vendorNotes", row?.notes ?? "");
  setFieldValue("vendorIsActive", "true");
}

async function loadVendorAudit(vendorId) {
  const section = qs("vendorAuditSection");
  const list = qs("vendorAuditList");
  if (!section || !list || !vendorId) {
    if (section) section.hidden = true;
    return;
  }

  section.hidden = false;
  list.innerHTML = '<li class="muted">Loading audit…</li>';

  try {
    const { data, error } = await supabase.rpc(
      "proc_vendor_identity_action_paged",
      {
        p_vendor_id: Number(vendorId),
        p_limit: 20,
        p_offset: 0,
      },
    );

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) {
      list.innerHTML = '<li class="muted">No identity actions recorded.</li>';
      return;
    }

    list.innerHTML = rows
      .map((row) => {
        const action = esc(
          row.action_type ?? row.action ?? row.event_type ?? "Action",
        );
        const when = esc(
          row.action_at ?? row.created_at ?? row.performed_at ?? "",
        );
        const reason = row.reason
          ? `<div class="muted">Reason: ${esc(row.reason)}</div>`
          : "";
        const summary = row.changed_fields_summary
          ? `<div>${esc(row.changed_fields_summary)}</div>`
          : row.changed_summary
            ? `<div>${esc(row.changed_summary)}</div>`
            : "";
        return `<li><strong>${action}</strong> <span class="muted">${when}</span>${reason}${summary}</li>`;
      })
      .join("");
  } catch (error) {
    console.error(error);
    list.innerHTML = '<li class="muted">Unable to load identity audit.</li>';
  }
}

async function openVendorModal(row = null) {
  const isNew = !row;
  qs("vendorModalTitle").textContent = isNew ? "New Vendor" : "Edit Vendor";

  state.vendorEdit = {
    vendorId: isNew ? null : Number(row.vendor_id),
    displayName: row?.display_name ?? "",
    storedIsActive: isNew ? true : row?.is_active !== false,
    vendorType: row?.vendor_type ?? "",
    row: row ? { ...row } : null,
  };

  populateVendorFormFromRow(row, { isNew });
  updateVendorStatusUi();
  renderProfileBadgeFromForm();

  const auditSection = qs("vendorAuditSection");
  if (isNew) {
    if (auditSection) auditSection.hidden = true;
  } else {
    await loadVendorAudit(state.vendorEdit.vendorId);
  }

  openModal("vendorModalBackdrop");
  requestAnimationFrame(() => qs("vendorDisplayName")?.focus());
}

function buildVendorCreateArgs(fields, allowDuplicate, duplicateReason) {
  return {
    p_display_name: fields.displayName,
    p_vendor_type: fields.vendorType,
    p_is_active: getFieldValue("vendorIsActive") === "true",
    p_phone: fields.phone,
    p_email: fields.email,
    p_address_line1: fields.address_line1,
    p_address_line2: fields.address_line2,
    p_city: fields.city,
    p_state: fields.state,
    p_pincode: fields.pincode,
    p_gstin: fields.gstin,
    p_notes: fields.notes,
    p_extended_profile_patch: fields.extendedProfilePatch,
    p_allow_duplicate: allowDuplicate,
    p_duplicate_reason: duplicateReason,
  };
}

function buildVendorUpdateArgs(vendorId, fields, allowDuplicate, duplicateReason) {
  return {
    p_vendor_id: vendorId,
    p_display_name: fields.displayName,
    p_vendor_type: fields.vendorType,
    p_is_active: state.vendorEdit.storedIsActive,
    p_phone: fields.phone,
    p_email: fields.email,
    p_address_line1: fields.address_line1,
    p_address_line2: fields.address_line2,
    p_city: fields.city,
    p_state: fields.state,
    p_pincode: fields.pincode,
    p_gstin: fields.gstin,
    p_notes: fields.notes,
    p_extended_profile_patch: fields.extendedProfilePatch,
    p_allow_duplicate: allowDuplicate,
    p_duplicate_reason: duplicateReason,
  };
}

async function saveVendor(allowDuplicate = false, duplicateReason = null) {
  if (!canPerformEditAction("Save vendor")) return;
  if (state.savingVendor) return;

  const vendorId = toNum(qs("vendorId").value, 0);
  const fields = readVendorIdentityFields();

  if (!fields.displayName) {
    toast("Display name is required.", "error");
    return;
  }
  if (!fields.vendorType) {
    toast("Vendor type is required.", "error");
    return;
  }

  state.savingVendor = true;
  const saveBtn = qs("btnVendorSave");
  if (saveBtn) saveBtn.disabled = true;

  try {
    let error = null;

    if (vendorId) {
      ({ error } = await supabase.rpc(
        "proc_vendor_update",
        buildVendorUpdateArgs(vendorId, fields, allowDuplicate, duplicateReason),
      ));
    } else {
      ({ error } = await supabase.rpc(
        "proc_vendor_create",
        buildVendorCreateArgs(fields, allowDuplicate, duplicateReason),
      ));
    }

    if (error) {
      if (!allowDuplicate && isDuplicateError(error)) {
        openDuplicateModal({
          kind: vendorId ? "update" : "create",
          attemptedName: fields.displayName,
          detail: error.message,
          retry: (reason) => saveVendor(true, reason),
        });
        return;
      }
      toast(`Vendor save failed: ${error.message}`, "error");
      return;
    }

    toast("Vendor saved.", "success");
    closeModal("vendorModalBackdrop");
    state.loaded.vendors = false;
    await Promise.all([
      loadVendorsPaged(),
      loadVendorsList({ activeOnly: false }),
      loadVendorsList({ activeOnly: true }),
    ]);
  } finally {
    state.savingVendor = false;
    if (saveBtn) saveBtn.disabled = false;
    applyPermissionUi();
  }
}

function openDuplicateModal({ kind, attemptedName, detail, retry }) {
  state.pendingDuplicate = { kind, retry };
  qs("vendorDuplicateMessage").textContent = `A vendor named "${attemptedName}" already exists or conflicts with an existing record.`;
  qs("vendorDuplicateDetail").textContent = detail || "";
  setFieldValue("vendorDuplicateReason", "");
  qs("btnVendorDuplicateConfirm").textContent =
    kind === "update" ? "Save Anyway" : "Create Anyway";
  openModal("vendorDuplicateModalBackdrop");
  requestAnimationFrame(() => qs("vendorDuplicateReason")?.focus());
}

async function confirmDuplicateOverride() {
  if (!canPerformEditAction("Override duplicate vendor name")) return;
  const reason = getFieldValue("vendorDuplicateReason");
  if (!reason) {
    toast("Override reason is required.", "error");
    return;
  }
  const pending = state.pendingDuplicate;
  if (!pending?.retry) {
    closeModal("vendorDuplicateModalBackdrop");
    return;
  }
  closeModal("vendorDuplicateModalBackdrop");
  state.pendingDuplicate = null;
  await pending.retry(reason);
}

function openVendorStatusModal() {
  if (!canPerformEditAction("Change vendor status")) return;
  if (!state.vendorEdit.vendorId) return;

  const targetStatus = !state.vendorEdit.storedIsActive;
  state.statusTransition = {
    vendorId: state.vendorEdit.vendorId,
    targetStatus,
  };

  const currentLabel = state.vendorEdit.storedIsActive ? "Active" : "Inactive";
  const targetLabel = targetStatus ? "Active" : "Inactive";

  qs("vendorStatusModalTitle").textContent = targetStatus
    ? "Confirm Reactivation"
    : "Confirm Deactivation";
  qs("vendorStatusSummary").textContent = `${state.vendorEdit.displayName || getFieldValue("vendorDisplayName")} — current status: ${currentLabel}. Target status: ${targetLabel}.`;
  qs("btnVendorStatusConfirm").textContent = targetStatus
    ? "Confirm Reactivation"
    : "Confirm Deactivation";
  setFieldValue("vendorStatusReason", "");
  openModal("vendorStatusModalBackdrop");
  requestAnimationFrame(() => qs("vendorStatusReason")?.focus());
}

async function confirmVendorStatusChange() {
  if (!canPerformEditAction("Confirm vendor status change")) return;
  const transition = state.statusTransition;
  if (!transition?.vendorId) return;

  const reason = getFieldValue("vendorStatusReason");
  if (!reason) {
    toast("Reason is required for status change.", "error");
    return;
  }

  const btn = qs("btnVendorStatusConfirm");
  if (btn) btn.disabled = true;

  try {
    const { error } = await supabase.rpc("proc_vendor_set_active", {
      p_vendor_id: transition.vendorId,
      p_is_active: transition.targetStatus,
      p_reason: reason,
    });

    if (error) {
      toast(`Status update failed: ${error.message}`, "error");
      return;
    }

    state.vendorEdit.storedIsActive = transition.targetStatus;
    if (state.vendorEdit.row) {
      state.vendorEdit.row.is_active = transition.targetStatus;
    }
    updateVendorStatusUi();
    renderProfileBadgeFromForm();

    toast(
      transition.targetStatus ? "Vendor reactivated." : "Vendor deactivated.",
      "success",
    );
    closeModal("vendorStatusModalBackdrop");

    state.loaded.vendors = false;
    await Promise.all([
      loadVendorsPaged(),
      loadVendorsList({ activeOnly: false }),
      loadVendorsList({ activeOnly: true }),
    ]);
    await loadVendorAudit(state.vendorEdit.vendorId);
  } finally {
    if (btn) btn.disabled = false;
    applyPermissionUi();
  }
}

async function loadRateBook() {
  setTabTableLoading("rate-book", true, "Loading...");
  try {
    const { vendorId, q, page, pageSize } = state.rates;
    const offset = page * pageSize;

    const { data, error } = await supabase.rpc("proc_vendor_item_rate_paged", {
      p_q: q || null,
      p_vendor_id: vendorId ? Number(vendorId) : null,
      p_is_active: null,
      p_limit: pageSize,
      p_offset: offset,
    });

    if (error) {
      toast(`Failed to load rates: ${error.message}`, "error");
      return false;
    }

    const rows = Array.isArray(data) ? data : [];
    state.rates.rows = rows;
    state.rates.total = extractPagedTotal(rows);
    renderRateTable();
    renderRatePager();
    return true;
  } catch (error) {
    console.error(error);
    toast("Failed to load rates.", "error");
    return false;
  } finally {
    setTabTableLoading("rate-book", false);
  }
}

function renderRateTable() {
  const body = qs("rateTbody");
  if (!body) return;

  const rows = state.rates.rows;
  if (!rows.length) {
    body.innerHTML =
      '<tr><td colspan="8" class="empty-row">No rate rows found.</td></tr>';
    return;
  }

  body.innerHTML = rows
    .map((r, idx) => {
      const status = deriveRatePresentationStatus(r);
      return `
        <tr class="clickable" data-idx="${idx}">
          <td>${esc(r.vendor_display_name || "")}</td>
          <td>${esc(r.stock_item_name || "")}</td>
          <td>${esc(r.uom_code || "")}</td>
          <td class="num">${esc(toNum(r.rate_value, 0).toFixed(2))}</td>
          <td>${esc(r.valid_from || "")}</td>
          <td>${esc(r.valid_to || "")}</td>
          <td><span class="${rateStatusClass(status)}">${status}</span></td>
          <td>${esc(r.remarks || r.notes || "")}</td>
        </tr>
      `;
    })
    .join("");

  body.querySelectorAll("tr.clickable").forEach((tr) => {
    tr.addEventListener("click", () => {
      const row = state.rates.rows[Number(tr.dataset.idx)];
      void openRateModal(row);
    });
  });
}

function renderRatePager() {
  const { page, pageSize, total } = state.rates;
  qs("ratePaging").textContent = fmtRange(page, pageSize, total);
  qs("ratePrev").disabled = page <= 0;
  qs("rateNext").disabled = (page + 1) * pageSize >= total;
}

async function openRateModal(row = null) {
  if (!state.lookups.ready || state.lookups.uomIdToCode.size === 0) {
    await loadUomLookup();
  }
  if (!state.vendors.activeList.length) {
    await loadVendorsList({ activeOnly: true });
  }

  const isNew = !row;
  qs("rateModalTitle").textContent = isNew
    ? "Add Rate Entry"
    : "Edit Rate Entry";

  state.rateEdit = {
    rateId: isNew ? null : toNum(row?.rate_id, 0) || null,
    meta:
      !isNew && row?.meta && typeof row.meta === "object" ? row.meta : {},
    row: row ? { ...row } : null,
  };

  setFieldValue("rateId", state.rateEdit.rateId ?? "");
  populateRateVendorSelect({
    isNew,
    selectedVendorId: isNew ? null : row?.vendor_id,
  });

  const itemInput = qs("rateItemSearch");

  if (isNew) {
    clearRateItemSelection();
    qs("rateValue").value = "";
    qs("rateValidFrom").value = "";
    qs("rateValidTo").value = "";
    qs("rateNotes").value = "";
    qs("rateMinOrderQty").value = "";
    qs("rateLeadTimeDays").value = "";
    qs("rateIsActive").checked = true;
  } else {
    setFieldValue("rateStockItemId", row?.stock_item_id);
    setFieldValue("rateMaterialClassId", row?.material_class_id);
    setFieldValue("rateItemSearch", row?.stock_item_name || "");
    if (itemInput) {
      itemInput.dataset.selectedId = row?.stock_item_id
        ? String(row.stock_item_id)
        : "";
      itemInput.dataset.selectedName = row?.stock_item_name || "";
    }
    setRateUomFromId(row?.uom_id, row?.uom_code || "");
    qs("rateValue").value = row?.rate_value ?? "";
    qs("rateValidFrom").value = row?.valid_from || "";
    qs("rateValidTo").value = row?.valid_to || "";
    qs("rateNotes").value = row?.remarks ?? row?.notes ?? "";
    qs("rateMinOrderQty").value =
      row?.min_order_qty != null ? String(row.min_order_qty) : "";
    qs("rateLeadTimeDays").value =
      row?.lead_time_days != null ? String(row.lead_time_days) : "";
    qs("rateIsActive").checked = row?.is_active !== false;
  }

  rateItemComboboxCtl?.resetState();
  openModal("rateModalBackdrop");
  requestAnimationFrame(() => qs("rateVendorId")?.focus());
}

function wireRateItemCombobox() {
  const input = qs("rateItemSearch");
  const results = qs("rateItemResults");
  if (!input || !results) return;

  let currentItems = [];
  let highlightedIndex = -1;
  let searchTimer = null;

  function getOptionEls() {
    return Array.from(results.querySelectorAll(".lookup-item[data-id]"));
  }

  function resetState() {
    currentItems = [];
    highlightedIndex = -1;
    input.setAttribute("aria-expanded", "false");
    getOptionEls().forEach((el) => {
      el.classList.remove("active");
      el.setAttribute("aria-selected", "false");
    });
  }

  function closeRateItemDropdown() {
    results.hidden = true;
    resetState();
  }

  function openRateItemDropdown() {
    results.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function setRateItemHighlight(index) {
    const els = getOptionEls();
    if (!els.length) return;
    highlightedIndex = Math.max(0, Math.min(index, els.length - 1));
    els.forEach((el, i) => {
      const active = i === highlightedIndex;
      el.classList.toggle("active", active);
      el.setAttribute("aria-selected", active ? "true" : "false");
      if (active) el.scrollIntoView({ block: "nearest" });
    });
  }

  function selectRateItem(row) {
    setFieldValue("rateStockItemId", String(row.stock_item_id));
    setFieldValue(
      "rateMaterialClassId",
      row.material_class_id != null ? String(row.material_class_id) : "",
    );
    setFieldValue("rateItemSearch", row.name || row.stock_item_name || "");
    input.dataset.selectedId = String(row.stock_item_id);
    input.dataset.selectedName = row.name || row.stock_item_name || "";

    const uomId = row.default_uom_id ?? row.uom_id;
    const ok = setRateUomFromId(uomId, row.uom_code || "");
    if (!ok) {
      toast("Selected item has no resolvable default UOM.", "error");
    }

    results.innerHTML = "";
    closeRateItemDropdown();
  }

  function renderRateItemResults(rows) {
    currentItems = rows;
    highlightedIndex = -1;
    results.innerHTML = "";

    if (!rows.length) {
      results.innerHTML =
        '<div class="lookup-item no-match muted" role="option" aria-selected="false">No matching items</div>';
      openRateItemDropdown();
      return;
    }

    rows.forEach((r, idx) => {
      const div = document.createElement("div");
      div.className = "lookup-item";
      div.setAttribute("role", "option");
      div.setAttribute("aria-selected", "false");
      div.dataset.id = String(r.stock_item_id);
      div.dataset.name = r.name || r.stock_item_name || "";
      div.dataset.uomId = String(r.default_uom_id ?? r.uom_id ?? "");
      div.dataset.idx = String(idx);
      div.innerHTML = `${esc(r.name || r.stock_item_name || "")} <span class="muted">${esc(r.code || r.stock_item_code || "")}</span>`;
      div.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectRateItem(r);
      });
      results.appendChild(div);
    });
    openRateItemDropdown();
  }

  async function searchRateItems(term) {
    const q = (term || "").trim();
    if (!q) {
      results.innerHTML = "";
      closeRateItemDropdown();
      return;
    }

    const searchTerm = q.replace(/,/g, " ").trim();
    const { data, error } = await supabase.rpc("proc_vendor_rate_item_lookup", {
      p_q: searchTerm || null,
      p_limit: 20,
    });

    if (error) {
      toast(`Item search failed: ${error.message}`, "error");
      closeRateItemDropdown();
      return;
    }

    renderRateItemResults(Array.isArray(data) ? data : []);
  }

  function scheduleSearch(term) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => searchRateItems(term), 220);
  }

  input.addEventListener("input", () => {
    const currentText = String(input.value || "").trim();
    const selectedName = String(input.dataset.selectedName || "").trim();

    if (!currentText) {
      input.dataset.selectedId = "";
      input.dataset.selectedName = "";
      clearRateItemSelection({ keepSearchText: true });
      results.innerHTML = "";
      closeRateItemDropdown();
      return;
    }

    if (selectedName && currentText !== selectedName) {
      input.dataset.selectedId = "";
      input.dataset.selectedName = "";
      clearRateItemSelection({ keepSearchText: true });
    }

    scheduleSearch(currentText);
  });

  input.addEventListener("blur", () => {
    setTimeout(() => {
      if (document.activeElement === input) return;
      closeRateItemDropdown();
    }, 150);
  });

  input.addEventListener("keydown", (e) => {
    const open = !results.hidden && results.innerHTML.length > 0;
    const els = getOptionEls();

    if (e.key === "ArrowDown") {
      if (!open || !els.length) return;
      e.preventDefault();
      setRateItemHighlight(highlightedIndex < 0 ? 0 : highlightedIndex + 1);
    } else if (e.key === "ArrowUp") {
      if (!open || !els.length) return;
      e.preventDefault();
      setRateItemHighlight(
        highlightedIndex <= 0 ? els.length - 1 : highlightedIndex - 1,
      );
    } else if (e.key === "Enter") {
      if (open && highlightedIndex >= 0 && currentItems[highlightedIndex]) {
        e.preventDefault();
        selectRateItem(currentItems[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        results.innerHTML = "";
        closeRateItemDropdown();
      }
    }
  });

  rateItemComboboxCtl = {
    resetState() {
      results.innerHTML = "";
      closeRateItemDropdown();
    },
  };
}

function readRateForm() {
  const uomId = toNum(getFieldValue("rateUomId"), 0) || null;
  const materialClassId =
    toNum(getFieldValue("rateMaterialClassId"), 0) || null;
  const minOrderQtyRaw = getFieldValue("rateMinOrderQty");
  const leadTimeRaw = getFieldValue("rateLeadTimeDays");

  return {
    vendor_id: toNum(qs("rateVendorId").value, 0) || null,
    stock_item_id: toNum(qs("rateStockItemId").value, 0) || null,
    material_class_id: materialClassId,
    uom_id: uomId,
    rate_value: toNum(qs("rateValue").value, NaN),
    valid_from: getFieldValue("rateValidFrom") || null,
    valid_to: getFieldValue("rateValidTo") || null,
    min_order_qty: minOrderQtyRaw === "" ? null : toNum(minOrderQtyRaw, NaN),
    lead_time_days: leadTimeRaw === "" ? null : toNum(leadTimeRaw, NaN),
    remarks: getFieldValue("rateNotes") || null,
    is_active: qs("rateIsActive").checked,
    meta: state.rateEdit.meta ?? {},
  };
}

function validateRateForm(payload) {
  if (!payload.vendor_id) {
    toast("Vendor is required.", "error");
    return false;
  }
  if (!payload.stock_item_id) {
    toast("Select a stock item from the item lookup.", "error");
    return false;
  }
  if (!payload.uom_id) {
    toast("UOM could not be resolved for the selected item.", "error");
    return false;
  }
  if (Number.isNaN(payload.rate_value) || payload.rate_value < 0) {
    toast("Rate must be zero or greater.", "error");
    return false;
  }
  if (
    payload.min_order_qty != null &&
    (Number.isNaN(payload.min_order_qty) || payload.min_order_qty < 0)
  ) {
    toast("Minimum order quantity must be zero or greater.", "error");
    return false;
  }
  if (payload.lead_time_days != null) {
    if (
      Number.isNaN(payload.lead_time_days) ||
      payload.lead_time_days < 0 ||
      !Number.isInteger(payload.lead_time_days)
    ) {
      toast("Lead time must be a whole number zero or greater.", "error");
      return false;
    }
  }
  if (payload.valid_from && payload.valid_to && payload.valid_to < payload.valid_from) {
    toast("Valid To cannot be earlier than Valid From.", "error");
    return false;
  }
  return true;
}

async function saveRateEntry() {
  if (!canPerformEditAction("Save rate entry")) return;
  if (state.savingRate) return;

  const payload = readRateForm();
  if (!validateRateForm(payload)) return;

  state.savingRate = true;
  const saveBtn = qs("btnRateSave");
  if (saveBtn) saveBtn.disabled = true;

  const rateId = toNum(getFieldValue("rateId"), 0);
  let error = null;

  try {
    if (rateId) {
      ({ error } = await supabase.rpc("proc_vendor_item_rate_update", {
        p_rate_id: rateId,
        p_vendor_id: payload.vendor_id,
        p_stock_item_id: payload.stock_item_id,
        p_rate_value: payload.rate_value,
        p_uom_id: payload.uom_id,
        p_material_class_id: payload.material_class_id,
        p_valid_from: payload.valid_from,
        p_valid_to: payload.valid_to,
        p_min_order_qty: payload.min_order_qty,
        p_lead_time_days: payload.lead_time_days,
        p_remarks: payload.remarks,
        p_is_active: payload.is_active,
        p_meta: payload.meta,
      }));
    } else {
      ({ error } = await supabase.rpc("proc_vendor_item_rate_create", {
        p_vendor_id: payload.vendor_id,
        p_stock_item_id: payload.stock_item_id,
        p_rate_value: payload.rate_value,
        p_uom_id: payload.uom_id,
        p_material_class_id: payload.material_class_id,
        p_valid_from: payload.valid_from,
        p_valid_to: payload.valid_to,
        p_min_order_qty: payload.min_order_qty,
        p_lead_time_days: payload.lead_time_days,
        p_remarks: payload.remarks,
        p_is_active: payload.is_active,
        p_meta: payload.meta,
      }));
    }

    if (error) {
      toast(`Save rate failed: ${error.message}`, "error");
      return;
    }

    toast("Rate saved.", "success");
    closeModal("rateModalBackdrop");
    await loadRateBook();
  } finally {
    state.savingRate = false;
    if (saveBtn) saveBtn.disabled = false;
    applyPermissionUi();
  }
}

function wireTabRouting() {
  qsa(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await setActiveTab(btn.dataset.tab || "vendors", true);
    });
  });

  qs("tabSelect")?.addEventListener("change", async (e) => {
    await setActiveTab(e.target.value || "vendors", true);
  });

  window.addEventListener("hashchange", async () => {
    await setActiveTab(getHashTab(), false);
  });
}

function wireMappingTab() {
  qs("mapSyncBtn")?.addEventListener("click", syncVendorAliasesAndReload);

  qs("mapPrev")?.addEventListener("click", async () => {
    state.mapping.page = Math.max(0, state.mapping.page - 1);
    await loadVendorMappingPage();
  });
  qs("mapNext")?.addEventListener("click", async () => {
    if (state.mapping.totalCount !== null) {
      if (state.mapping.page >= state.mapping.totalPages - 1) return;
    } else if (state.mapping.rows.length < state.mapping.pageSize) {
      return;
    }
    state.mapping.page += 1;
    await loadVendorMappingPage();
  });

  const mapSearch = qs("mapSearch");
  const mapSearchClear = qs("mapSearchClear");
  const runSearch = () => {
    state.mapping.page = 0;
    if (state.mapping.debounceTimer) clearTimeout(state.mapping.debounceTimer);
    state.mapping.debounceTimer = setTimeout(() => {
      loadVendorMappingPage();
    }, 300);
  };

  mapSearch?.addEventListener("input", () => {
    state.mapping.q = (mapSearch.value || "").trim();
    setClearButtonState(mapSearch, mapSearchClear);
    runSearch();
  });
  mapSearch?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    state.mapping.q = (mapSearch.value || "").trim();
    runSearch();
  });
  mapSearchClear?.addEventListener("click", () => {
    if (!mapSearch?.value) return;
    mapSearch.value = "";
    state.mapping.q = "";
    setClearButtonState(mapSearch, mapSearchClear);
    runSearch();
    mapSearch.focus();
  });
  setClearButtonState(mapSearch, mapSearchClear);

  qs("mapModalClose")?.addEventListener("click", () =>
    closeModal("mapModalBackdrop"),
  );
  qs("btnMapClose")?.addEventListener("click", () =>
    closeModal("mapModalBackdrop"),
  );
  qs("btnCreateMap")?.addEventListener("click", () => createVendorAndMap());
  qs("btnMapExisting")?.addEventListener("click", mapAliasToExisting);

  const onExistingSearch = debounce(async () => {
    await searchVendorsForMapping((qs("mapExistingSearch").value || "").trim());
  }, 220);
  qs("mapExistingSearch")?.addEventListener("input", onExistingSearch);

  qs("mapModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target?.id === "mapModalBackdrop") closeModal("mapModalBackdrop");
  });
}

function wireVendorsTab() {
  qs("vendorPrev")?.addEventListener("click", async () => {
    state.vendors.page = Math.max(0, state.vendors.page - 1);
    await loadVendorsPaged();
  });
  qs("vendorNext")?.addEventListener("click", async () => {
    state.vendors.page += 1;
    await loadVendorsPaged();
  });

  const onVendorSearch = async () => {
    state.vendors.q = (qs("vendorSearch").value || "").trim();
    state.vendors.page = 0;
    await loadVendorsPaged();
  };
  wireSearchInput({
    inputId: "vendorSearch",
    clearId: "vendorSearchClear",
    onInput: onVendorSearch,
  });

  qs("btnVendorNew")?.addEventListener("click", () => {
    if (!canPerformEditAction("Create vendor")) return;
    openVendorModal(null);
  });
  qs("vendorModalClose")?.addEventListener("click", () =>
    closeModal("vendorModalBackdrop"),
  );
  qs("btnVendorClose")?.addEventListener("click", () =>
    closeModal("vendorModalBackdrop"),
  );
  qs("btnVendorSave")?.addEventListener("click", () => saveVendor());
  qs("btnVendorToggle")?.addEventListener("click", openVendorStatusModal);

  [
    "vendorDisplayName",
    "vendorLegalName",
    "vendorType",
    "vendorPhone",
    "vendorEmail",
    "vendorWebsite",
    "vendorAddress1",
    "vendorAddress2",
    "vendorCity",
    "vendorDistrict",
    "vendorState",
    "vendorPinCode",
    "vendorCountry",
    "vendorGst",
    "vendorPan",
    "vendorPaymentTerms",
    "vendorNotes",
  ].forEach((id) => {
    qs(id)?.addEventListener("input", renderProfileBadgeFromForm);
    qs(id)?.addEventListener("change", renderProfileBadgeFromForm);
  });

  qs("vendorModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target?.id === "vendorModalBackdrop")
      closeModal("vendorModalBackdrop");
  });
}

function wireRateBookTab() {
  qs("ratePrev")?.addEventListener("click", async () => {
    state.rates.page = Math.max(0, state.rates.page - 1);
    await loadRateBook();
  });
  qs("rateNext")?.addEventListener("click", async () => {
    state.rates.page += 1;
    await loadRateBook();
  });

  qs("rbFilterBtn")?.addEventListener("click", () => {
    const panel = qs("rbVendorFilterPanel");
    if (!panel) return;
    panel.classList.toggle("open");
  });

  qs("rateVendorFilter")?.addEventListener("change", async (e) => {
    state.rates.vendorId = e.target.value || "";
    state.rates.page = 0;
    await loadRateBook();
  });

  const onRateSearch = async () => {
    state.rates.q = (qs("rateSearch").value || "").trim();
    state.rates.page = 0;
    await loadRateBook();
  };
  wireSearchInput({
    inputId: "rateSearch",
    clearId: "rateSearchClear",
    onInput: onRateSearch,
    debounceMs: 250,
  });

  qs("btnRateNew")?.addEventListener("click", () => {
    if (!canPerformEditAction("Add rate entry")) return;
    void openRateModal(null);
  });
  qs("rateModalClose")?.addEventListener("click", () =>
    closeModal("rateModalBackdrop"),
  );
  qs("btnRateClose")?.addEventListener("click", () =>
    closeModal("rateModalBackdrop"),
  );
  qs("btnRateSave")?.addEventListener("click", saveRateEntry);

  wireRateItemCombobox();

  qs("rateModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target?.id === "rateModalBackdrop") closeModal("rateModalBackdrop");
  });
}

function wireAuxModals() {
  qs("vendorDuplicateModalClose")?.addEventListener("click", () =>
    closeModal("vendorDuplicateModalBackdrop"),
  );
  qs("btnVendorDuplicateCancel")?.addEventListener("click", () =>
    closeModal("vendorDuplicateModalBackdrop"),
  );
  qs("btnVendorDuplicateConfirm")?.addEventListener("click", confirmDuplicateOverride);
  qs("vendorDuplicateModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target?.id === "vendorDuplicateModalBackdrop") {
      closeModal("vendorDuplicateModalBackdrop");
    }
  });

  qs("vendorStatusModalClose")?.addEventListener("click", () =>
    closeModal("vendorStatusModalBackdrop"),
  );
  qs("btnVendorStatusCancel")?.addEventListener("click", () =>
    closeModal("vendorStatusModalBackdrop"),
  );
  qs("btnVendorStatusConfirm")?.addEventListener("click", confirmVendorStatusChange);
  qs("vendorStatusModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target?.id === "vendorStatusModalBackdrop") {
      closeModal("vendorStatusModalBackdrop");
    }
  });
}

function wireGlobalControls() {
  qs("homeBtn")?.addEventListener("click", () => Platform.goHome());
  qs("btnRefresh")?.addEventListener("click", async () => {
    state.loaded.vendors = false;
    state.loaded.mapping = false;
    state.loaded.rates = false;
    await setActiveTab(state.tab, false);
    await refreshSupportLookups({ rerenderRateBook: true });
    toast("Refreshed.", "success");
  });
}

async function refreshSupportLookups({ rerenderRateBook = false } = {}) {
  await Promise.allSettled([
    loadUnmappedAliasCount(),
    loadVendorsList({ activeOnly: false }),
    loadVendorsList({ activeOnly: true }),
    loadUomLookup(),
  ]);
  if (rerenderRateBook && state.tab === "rate-book" && state.loaded.rates) {
    renderRateTable();
  }
}

function markWriteControls() {
  [
    "btnVendorNew",
    "btnVendorSave",
    "btnVendorToggle",
    "btnCreateMap",
    "btnMapExisting",
    "mapSyncBtn",
    "btnRateNew",
    "btnRateSave",
    "btnVendorDuplicateConfirm",
    "btnVendorStatusConfirm",
  ].forEach((id) => markEditAction(qs(id)));
}

(async function main() {
  await requireSession();

  try {
    await loadAccessState();
  } catch (err) {
    console.error(err);
    setAccessDenied("Unable to verify Vendor Master access.");
    return;
  }

  if (!canAccessModule()) {
    setAccessDenied("You do not have permission to open Vendor Master.");
    return;
  }

  markWriteControls();
  initModalAccessibility();
  wireGlobalControls();
  wireTabRouting();
  wireMappingTab();
  wireVendorsTab();
  wireRateBookTab();
  wireAuxModals();
  wireModalEscapeClose();
  applyPermissionUi();

  await setActiveTab(getHashTab(), false);
  await refreshSupportLookups({ rerenderRateBook: true });
})();
