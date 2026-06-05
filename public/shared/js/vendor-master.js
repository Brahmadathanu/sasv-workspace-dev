import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

const TAB_KEYS = ["vendors", "vendor-mapping", "rate-book"];

const state = {
  tab: "vendors",
  lookups: {
    uomCodeToId: new Map(),
    uomIdToCode: new Map(),
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
  },
  vendors: {
    q: "",
    page: 0,
    pageSize: 75,
    total: 0,
    rows: [],
    list: [],
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
};

const modalFocusState = new Map();

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
      .catch(() => {
        // Errors are surfaced by loader-specific logic.
      })
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

    // When searching, use total_count from RPC if present.
    // When not searching, keep total unknown for faster paging.
    let totalCount = null;

    if (q && q.trim()) {
      totalCount =
        rows.length && rows[0]?.total_count != null
          ? Number(rows[0].total_count)
          : 0;
    } else {
      totalCount = null;
    }

    state.mapping.rows = rows;
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
  try {
    const synced = await runVendorAliasSync({
      loadingLabel: "Refreshing aliases…",
      showErrorToast: true,
    });
    if (!synced) {
      return;
    }

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
  let req = supabase
    .from("proc_vendor")
    .select("vendor_id, display_name, is_active")
    .order("display_name", { ascending: true })
    .limit(20);

  if (q) req = req.ilike("display_name", `%${q}%`);

  const { data, error } = await req;
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
  qs("mapExistingSearch").value = "";
  qs("mapExistingSelected").textContent = "No vendor selected";
  qs("mapExistingResults").hidden = true;
  qs("mapExistingResults").innerHTML = "";

  openModal("mapModalBackdrop");
  requestAnimationFrame(() => qs("mapDisplayName")?.focus());
}

async function createVendorAndMap() {
  const aliasText = (qs("mapAliasText").value || "").trim();
  const displayName = (qs("mapDisplayName").value || "").trim();
  if (!aliasText || !displayName) {
    toast("Alias and display name are required.", "error");
    return;
  }

  const { error } = await supabase.rpc(
    "proc_vendor_create_and_map_tally_alias",
    {
      p_display_name: displayName,
      p_alias_text: aliasText,
    },
  );
  if (error) {
    toast(`Create + map failed: ${error.message}`, "error");
    return;
  }

  toast("Vendor created and alias mapped.", "success");
  closeModal("mapModalBackdrop");
  await Promise.all([
    loadUnmappedAliasCount(),
    loadVendorMappingPage(),
    loadVendorsList(),
  ]);
}

async function mapAliasToExisting() {
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
}

async function loadVendorsPaged() {
  setTabTableLoading("vendors", true, "Loading...");
  try {
    const { q, page, pageSize } = state.vendors;
    const offset = page * pageSize;

    let req = supabase
      .from("proc_vendor")
      .select("*", { count: "exact" })
      .order("display_name", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (q) req = req.ilike("display_name", `%${q}%`);

    const { data, error, count } = await req;
    if (error) {
      toast(`Failed to load vendors: ${error.message}`, "error");
      return false;
    }

    state.vendors.rows = Array.isArray(data) ? data : [];
    state.vendors.total = toNum(count, 0);
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

async function loadVendorsList() {
  try {
    const { data, error } = await supabase
      .from("proc_vendor")
      .select("vendor_id, display_name, is_active")
      .order("display_name", { ascending: true })
      .limit(5000);

    if (error) {
      toast(`Failed to load vendors list: ${error.message}`, "error");
      return;
    }

    state.vendors.list = Array.isArray(data) ? data : [];
    state.vendors.vendorIndex = new Map(
      state.vendors.list.map((v) => [
        Number(v.vendor_id),
        v.display_name || "",
      ]),
    );

    const opt = state.vendors.list
      .map(
        (v) =>
          `<option value="${v.vendor_id}">${esc(v.display_name || "Unnamed")} (#${v.vendor_id})</option>`,
      )
      .join("");

    const selects = [qs("rateVendorFilter"), qs("rateVendorId")];
    selects.forEach((sel, idx) => {
      if (!sel) return;
      const first =
        idx === 0
          ? '<option value="">All vendors</option>'
          : '<option value="">Select vendor</option>';
      sel.innerHTML = first + opt;
    });
  } catch (error) {
    console.error(error);
    toast("Failed to load vendor lookup.", "error");
  }
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

function openVendorModal(row = null) {
  const isNew = !row;
  qs("vendorModalTitle").textContent = isNew ? "New Vendor" : "Edit Vendor";

  setFieldValue("vendorId", row?.vendor_id);
  setFieldValue("vendorDisplayName", row?.display_name);
  setFieldValue("vendorLegalName", row?.legal_name);
  setFieldValue("vendorType", row?.vendor_type);
  setFieldValue("vendorIsActive", row?.is_active === false ? "false" : "true");
  setFieldValue("vendorPhone", row?.phone);
  setFieldValue("vendorEmail", row?.email);
  setFieldValue("vendorWebsite", row?.website);
  setFieldValue("vendorAddress1", row?.address_line1);
  setFieldValue("vendorAddress2", row?.address_line2);
  setFieldValue("vendorCity", row?.city);
  setFieldValue("vendorDistrict", row?.district);
  setFieldValue("vendorState", row?.state);
  setFieldValue("vendorPinCode", row?.pincode);
  setFieldValue("vendorCountry", row?.country);
  setFieldValue("vendorGst", row?.gstin);
  setFieldValue("vendorPan", row?.pan);
  setFieldValue("vendorPaymentTerms", row?.payment_terms);
  setFieldValue("vendorNotes", row?.notes);

  const toggle = qs("btnVendorToggle");
  const active = row?.is_active !== false;
  toggle.textContent = active ? "Deactivate" : "Activate";
  toggle.disabled = isNew;

  openModal("vendorModalBackdrop");
  requestAnimationFrame(() => qs("vendorDisplayName")?.focus());
}

function readVendorForm() {
  const displayName = getFieldValue("vendorDisplayName");
  return {
    display_name: displayName || null,
    legal_name: getFieldValue("vendorLegalName") || null,
    vendor_type: getFieldValue("vendorType") || null,
    is_active: getFieldValue("vendorIsActive") === "true",
    phone: getFieldValue("vendorPhone") || null,
    email: getFieldValue("vendorEmail") || null,
    website: getFieldValue("vendorWebsite") || null,
    address_line1: getFieldValue("vendorAddress1") || null,
    address_line2: getFieldValue("vendorAddress2") || null,
    city: getFieldValue("vendorCity") || null,
    district: getFieldValue("vendorDistrict") || null,
    state: getFieldValue("vendorState") || null,
    pincode: getFieldValue("vendorPinCode") || null,
    country: getFieldValue("vendorCountry") || null,
    gstin: getFieldValue("vendorGst") || null,
    pan: getFieldValue("vendorPan") || null,
    payment_terms: getFieldValue("vendorPaymentTerms") || null,
    notes: getFieldValue("vendorNotes") || null,
  };
}

async function saveVendor() {
  const vendorId = toNum(qs("vendorId").value, 0);
  const payload = readVendorForm();
  if (!payload.display_name) {
    toast("Display name is required.", "error");
    return;
  }

  if (vendorId) {
    const { error } = await supabase
      .from("proc_vendor")
      .update(payload)
      .eq("vendor_id", vendorId);
    if (error) {
      toast(`Vendor update failed: ${error.message}`, "error");
      return;
    }
  } else {
    const { error } = await supabase.from("proc_vendor").insert(payload);
    if (error) {
      toast(`Vendor create failed: ${error.message}`, "error");
      return;
    }
  }

  toast("Vendor saved.", "success");
  closeModal("vendorModalBackdrop");
  await Promise.all([loadVendorsPaged(), loadVendorsList()]);
}

async function toggleVendorStatus() {
  const vendorId = toNum(qs("vendorId").value, 0);
  if (!vendorId) return;

  const next = qs("vendorIsActive").value !== "true";
  const { error } = await supabase
    .from("proc_vendor")
    .update({ is_active: next })
    .eq("vendor_id", vendorId);

  if (error) {
    toast(`Status update failed: ${error.message}`, "error");
    return;
  }

  toast(next ? "Vendor activated." : "Vendor deactivated.", "success");
  closeModal("vendorModalBackdrop");
  await Promise.all([loadVendorsPaged(), loadVendorsList()]);
}

function resolveRatePk(row) {
  if (!row || typeof row !== "object") return { col: "", val: "" };
  const key = Object.keys(row).find((k) =>
    /rate.*id|id.*rate|vendor_item_rate_id/i.test(k),
  );
  if (!key) return { col: "", val: "" };
  return { col: key, val: row[key] };
}

async function loadRateBook() {
  setTabTableLoading("rate-book", true, "Loading...");
  try {
    const { vendorId, q, page, pageSize } = state.rates;
    const offset = page * pageSize;

    let req = supabase
      .from("v_proc_vendor_item_rate_effective")
      .select("*", { count: "exact" })
      .range(offset, offset + pageSize - 1)
      .order("vendor_display_name", { ascending: true })
      .order("stock_item_name", { ascending: true })
      .order("rate_id", { ascending: true });

    if (vendorId) req = req.eq("vendor_id", Number(vendorId));
    if (q) {
      const term = q.replace(/,/g, " ").trim();
      req = req.or(
        `stock_item_name.ilike.%${term}%,stock_item_code.ilike.%${term}%,vendor_display_name.ilike.%${term}%`,
      );
    }

    const { data, error, count } = await req;
    if (error) {
      toast(`Failed to load rates: ${error.message}`, "error");
      return false;
    }

    state.rates.rows = Array.isArray(data) ? data : [];
    state.rates.total = toNum(count, 0);
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
      '<tr><td colspan="7" class="empty-row">No rate rows found.</td></tr>';
    return;
  }

  body.innerHTML = rows
    .map((r, idx) => {
      return `
        <tr class="clickable" data-idx="${idx}">
          <td>${esc(r.vendor_display_name || "")}</td>
          <td>${esc(r.stock_item_name || "")}</td>
          <td>${esc(r.uom_code || "")}</td>
          <td class="num">${esc(toNum(r.rate_value, 0).toFixed(2))}</td>
          <td>${esc(r.valid_from || "")}</td>
          <td>${esc(r.valid_to || "")}</td>
          <td>${esc(r.remarks || "")}</td>
        </tr>
      `;
    })
    .join("");

  body.querySelectorAll("tr.clickable").forEach((tr) => {
    tr.addEventListener("click", () => {
      const row = state.rates.rows[Number(tr.dataset.idx)];
      openRateModal(row);
    });
  });
}

function renderRatePager() {
  const { page, pageSize, total } = state.rates;
  qs("ratePaging").textContent = fmtRange(page, pageSize, total);
  qs("ratePrev").disabled = page <= 0;
  qs("rateNext").disabled = (page + 1) * pageSize >= total;
}

function openRateModal(row = null) {
  const isNew = !row;
  qs("rateModalTitle").textContent = isNew
    ? "Add Rate Entry"
    : "Edit Rate Entry";

  const pk = resolveRatePk(row);
  qs("ratePkCol").value = pk.col || "";
  qs("ratePkVal").value = pk.val ?? "";

  qs("rateVendorId").value = row?.vendor_id ? String(row.vendor_id) : "";
  qs("rateStockItemId").value = row?.stock_item_id
    ? String(row.stock_item_id)
    : "";
  qs("rateItemSearch").value = row?.stock_item_name || "";
  const rowUomId = toNum(row?.uom_id, 0);
  const rowUomCode =
    row?.uom_code || state.lookups.uomIdToCode.get(rowUomId) || "";
  qs("rateUom").value = rowUomCode;
  qs("rateValue").value = row?.rate_value ?? "";
  qs("rateValidFrom").value = row?.valid_from || "";
  qs("rateValidTo").value = row?.valid_to || "";
  qs("rateNotes").value = row?.remarks ?? "";
  setFieldValue("rateMinOrderQty", row?.min_order_qty);
  setFieldValue("rateLeadTimeDays", row?.lead_time_days);
  setFieldValue("rateMaterialClassId", row?.material_class_id);
  qs("rateIsActive").checked = row?.is_active !== false;
  qs("rateItemResults").hidden = true;
  qs("rateItemResults").innerHTML = "";

  openModal("rateModalBackdrop");
  requestAnimationFrame(() => qs("rateVendorId")?.focus());
}

async function searchRateItems(term) {
  const q = (term || "").trim();
  if (!q) {
    qs("rateItemResults").hidden = true;
    qs("rateItemResults").innerHTML = "";
    return;
  }

  const { data, error } = await supabase
    .from("v_inv_stock_item_with_class")
    .select("stock_item_id, code, name, default_uom_id")
    .ilike("name", `%${q}%`)
    .order("name", { ascending: true })
    .limit(20);

  if (error) {
    toast(`Item search failed: ${error.message}`, "error");
    return;
  }

  const rows = Array.isArray(data) ? data : [];
  const wrap = qs("rateItemResults");

  if (!rows.length) {
    wrap.hidden = false;
    wrap.innerHTML = '<div class="lookup-item muted">No matching items</div>';
    return;
  }

  wrap.hidden = false;
  wrap.innerHTML = rows
    .map(
      (r) =>
        `<div class="lookup-item" data-id="${esc(r.stock_item_id)}" data-name="${esc(r.name || "")}" data-uom-id="${esc(r.default_uom_id || "")}">` +
        `${esc(r.name || "")} <span class="muted">${esc(r.code || "")}</span></div>`,
    )
    .join("");

  wrap.querySelectorAll(".lookup-item[data-id]").forEach((item) => {
    item.addEventListener("click", () => {
      qs("rateStockItemId").value = item.dataset.id || "";
      qs("rateItemSearch").value = item.dataset.name || "";
      const uomId = toNum(item.dataset.uomId, 0);
      const uomCode = state.lookups.uomIdToCode.get(uomId) || "";
      if (uomCode) qs("rateUom").value = uomCode;
      wrap.hidden = true;
    });
  });
}

function readRateForm() {
  const uomCode = getFieldValue("rateUom");
  const uomId = state.lookups.uomCodeToId.get(uomCode.toLowerCase()) || null;
  return {
    vendor_id: toNum(qs("rateVendorId").value, 0) || null,
    stock_item_id: toNum(qs("rateStockItemId").value, 0) || null,
    uom_id: uomId,
    material_class_id: toNum(getFieldValue("rateMaterialClassId"), 0) || null,
    rate_value: toNum(qs("rateValue").value, NaN),
    valid_from: getFieldValue("rateValidFrom") || null,
    valid_to: getFieldValue("rateValidTo") || null,
    min_order_qty: toNum(getFieldValue("rateMinOrderQty"), 0) || null,
    lead_time_days: toNum(getFieldValue("rateLeadTimeDays"), 0) || null,
    remarks: getFieldValue("rateNotes") || null,
    is_active: qs("rateIsActive").checked,
  };
}

async function saveRateEntry() {
  const payload = readRateForm();
  if (
    !payload.vendor_id ||
    !payload.stock_item_id ||
    Number.isNaN(payload.rate_value)
  ) {
    toast("Vendor, item, and rate are required.", "error");
    return;
  }

  const pkCol = (qs("ratePkCol").value || "").trim();
  const pkVal = (qs("ratePkVal").value || "").trim();

  let error = null;
  if (pkCol && pkVal) {
    ({ error } = await supabase
      .from("proc_vendor_item_rate")
      .update(payload)
      .eq(pkCol, pkVal));
  } else {
    ({ error } = await supabase.from("proc_vendor_item_rate").insert(payload));
  }

  if (error) {
    toast(`Save rate failed: ${error.message}`, "error");
    return;
  }

  toast("Rate saved.", "success");
  closeModal("rateModalBackdrop");
  await loadRateBook();
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
  qs("btnCreateMap")?.addEventListener("click", createVendorAndMap);
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

  qs("btnVendorNew")?.addEventListener("click", () => openVendorModal(null));
  qs("vendorModalClose")?.addEventListener("click", () =>
    closeModal("vendorModalBackdrop"),
  );
  qs("btnVendorClose")?.addEventListener("click", () =>
    closeModal("vendorModalBackdrop"),
  );
  qs("btnVendorSave")?.addEventListener("click", saveVendor);
  qs("btnVendorToggle")?.addEventListener("click", toggleVendorStatus);

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

  qs("btnRateNew")?.addEventListener("click", () => openRateModal(null));
  qs("rateModalClose")?.addEventListener("click", () =>
    closeModal("rateModalBackdrop"),
  );
  qs("btnRateClose")?.addEventListener("click", () =>
    closeModal("rateModalBackdrop"),
  );
  qs("btnRateSave")?.addEventListener("click", saveRateEntry);

  const onItemSearch = debounce(async () => {
    await searchRateItems(qs("rateItemSearch").value || "");
  }, 220);
  qs("rateItemSearch")?.addEventListener("input", onItemSearch);

  qs("rateModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target?.id === "rateModalBackdrop") closeModal("rateModalBackdrop");
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
    loadVendorsList(),
    loadUomLookup(),
  ]);
  if (rerenderRateBook && state.tab === "rate-book" && state.loaded.rates) {
    renderRateTable();
  }
}

(async function main() {
  await requireSession();
  initModalAccessibility();
  wireGlobalControls();
  wireTabRouting();
  wireMappingTab();
  wireVendorsTab();
  wireRateBookTab();
  wireModalEscapeClose();

  await setActiveTab(getHashTab(), false);
  refreshSupportLookups({ rerenderRateBook: true }).catch((error) => {
    console.error("Support lookups failed:", error);
  });
})();
