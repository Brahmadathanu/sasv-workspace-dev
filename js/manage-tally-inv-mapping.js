// The project places the shared Supabase client under `public/shared/js`.
// Import using the relative path from this file (root).
// Path from this file (in `js/`) to the shared client under `public/shared/js`.
import { supabase } from "../public/shared/js/supabaseClient.js";

// Tally Stock Item Mapping - client-side logic
// This module powers the UI defined in `manage-tally-mapping.html`.

/* State */
const state = {
  aliases: [],
  selectedAlias: null,
  filters: { sourceKind: "all", status: "all", search: "" },
  page: { index: 0, pageSize: 50, lastLoadedCount: 0, totalCount: null },
  coverage: [],
};

/* DOM refs */
const refs = {
  filterSource: document.getElementById("filter-source-kind"),
  filterStatus: document.getElementById("filter-status"),
  filterSearch: document.getElementById("filter-search"),
  coverageStats: document.getElementById("coverage-stats"),
  aliasesTbody: document.getElementById("aliases-tbody"),
  listLoading: document.getElementById("list-loading"),
  pFirst: document.getElementById("p-first"),
  pPrev: document.getElementById("p-prev"),
  pInfo: document.getElementById("p-info"),
  pCount: document.getElementById("p-count"),
  pNext: document.getElementById("p-next"),
  pLast: document.getElementById("p-last"),
  pSize: document.getElementById("p-size"),
  detailEmpty: document.getElementById("detail-empty"),
  detailContent: document.getElementById("detail-content"),
  detailTally: document.getElementById("detail-tally"),
  detailSourceKind: document.getElementById("detail-source-kind"),
  detailStatus: document.getElementById("detail-status"),
  detailFirstSeen: document.getElementById("detail-first-seen"),
  detailLastSeen: document.getElementById("detail-last-seen"),
  detailMappedTo: document.getElementById("detail-mapped-to"),
  masterSearch: document.getElementById("master-search"),
  masterResults: document.getElementById("master-results"),
  aliasNote: document.getElementById("alias-note"),
  detailLoading: document.getElementById("detail-loading"),
  aliasModal: document.getElementById("aliasModal"),
  modalClose: document.getElementById("modal-close"),

  saveMappingBtn: document.getElementById("save-mapping"),
  createAndMapBtn: document.getElementById("create-and-map"),
  ignoreBtn: document.getElementById("ignore"),
  markSuspectBtn: document.getElementById("mark-suspect"),
  clearMappingBtn: document.getElementById("clear-mapping"),

  createForm: document.getElementById("create-form"),
  createSubmit: document.getElementById("create-submit"),
  createCancel: document.getElementById("create-cancel"),
  newCode: document.getElementById("new-code"),
  newName: document.getElementById("new-name"),
  newUom: document.getElementById("new-uom"),
  newHsn: document.getElementById("new-hsn"),
};

/* Utility helpers */
function show(el) {
  if (el) el.style.display = "";
}
function hide(el) {
  if (el) el.style.display = "none";
}
// Toast and confirm helpers (in-page)
function showToast(message, opts = {}) {
  // Enqueue toast for queued display (see processToastQueue below)
  const { type = "info", timeout = 3500 } = opts;
  enqueueToast({ message: String(message), type, timeout });
}

/* Toast queue implementation */
const _toastState = {
  queue: [], // {id, message, type, timeout}
  active: new Map(), // id -> {el, timeoutId}
  maxActive: 3,
};

function enqueueToast(item) {
  try {
    const id = `${item.type}::${item.message}`;
    // Dedupe: if already active, extend its timeout; if queued, ignore duplicate
    if (_toastState.active.has(id)) {
      // extend active toast timeout
      const active = _toastState.active.get(id);
      if (active && active.timeoutId) {
        clearTimeout(active.timeoutId);
        active.timeoutId = scheduleToastRemoval(id, active.el, item.timeout);
        _toastState.active.set(id, active);
      }
      return;
    }
    const alreadyQueued = _toastState.queue.find((q) => q.id === id);
    if (alreadyQueued) return;
    const entry = {
      id,
      message: item.message,
      type: item.type,
      timeout: item.timeout,
    };
    _toastState.queue.push(entry);
    processToastQueue();
  } catch (err) {
    console.warn("enqueueToast failed", err?.message || err);
  }
}

function processToastQueue() {
  try {
    const container = document.getElementById("statusToastContainer");
    if (!container) return;
    while (
      _toastState.active.size < _toastState.maxActive &&
      _toastState.queue.length > 0
    ) {
      const entry = _toastState.queue.shift();
      // create element
      const t = document.createElement("div");
      t.className = `toast ${entry.type}`;
      t.textContent = entry.message;
      container.appendChild(t);
      // small appear animation
      requestAnimationFrame(() => {
        t.style.transition = "opacity 0.25s ease, transform 0.25s ease";
        t.style.opacity = "1";
        t.style.transform = "translateY(0)";
      });
      // schedule removal
      const timeoutId = scheduleToastRemoval(entry.id, t, entry.timeout);
      _toastState.active.set(entry.id, { el: t, timeoutId });
    }
  } catch (err) {
    console.warn("processToastQueue failed", err?.message || err);
  }
}

function scheduleToastRemoval(id, el, timeout) {
  try {
    const to = setTimeout(() => {
      try {
        // fade out
        el.style.transition = "opacity 0.25s ease, transform 0.25s ease";
        el.style.opacity = "0";
        el.style.transform = "translateY(-6px)";
        setTimeout(() => {
          try {
            el.remove();
          } catch (err) {
            console.debug("toast remove failed", err?.message || err);
          }
          _toastState.active.delete(id);
          // process next in queue
          processToastQueue();
        }, 260);
      } catch (err) {
        console.warn("toast removal failed", err?.message || err);
      }
    }, timeout || 3500);
    return to;
  } catch (err) {
    console.warn("scheduleToastRemoval failed", err?.message || err);
    return null;
  }
}

function showConfirm(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirmModal");
    const text = document.getElementById("confirmText");
    const yes = document.getElementById("confirm-yes");
    const no = document.getElementById("confirm-no");
    const close = document.getElementById("confirm-close");
    if (!modal || !text || !yes || !no) return resolve(false);
    text.textContent = message;
    modal.style.display = "flex";
    function cleanup() {
      modal.style.display = "none";
      yes.removeEventListener("click", onYes);
      no.removeEventListener("click", onNo);
      if (close) close.removeEventListener("click", onNo);
    }
    function onYes() {
      cleanup();
      resolve(true);
    }
    function onNo() {
      cleanup();
      resolve(false);
    }
    yes.addEventListener("click", onYes);
    no.addEventListener("click", onNo);
    if (close) close.addEventListener("click", onNo);
  });
}
function formatDate(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return d;
  }
}
function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// track state for modal scroll-locking
let _modalState = { scrollY: 0 };

/* Modal helpers */
function showModal() {
  const m = refs.aliasModal;
  if (!m) return;
  // lock background scroll without causing layout shift by fixing body position
  try {
    _modalState.scrollY =
      window.scrollY || document.documentElement.scrollTop || 0;
    document.body.style.position = "fixed";
    document.body.style.top = `-${_modalState.scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  } catch (err) {
    console.warn("showModal: failed to lock body scroll", err);
  }
  // show as flex so CSS centering works
  m.style.display = "flex";
  // ensure the create form is hidden when opening the modal and
  // interactive controls inside modal are enabled
  try {
    hideCreateForm();
  } catch {
    /* ignore */
  }
  try {
    restoreInteractiveState();
  } catch {
    /* ignore */
  }
}
function hideModal() {
  const m = refs.aliasModal;
  if (!m) return;
  // Ensure create form is hidden when closing the modal to avoid
  // it persisting open across modal lifecycle events
  try {
    hideCreateForm();
  } catch {
    /* ignore */
  }
  m.style.display = "none";
  // restore body position and scroll
  try {
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    window.scrollTo(0, _modalState.scrollY || 0);
  } catch (err) {
    console.warn("hideModal: failed to restore body scroll", err);
  }
}

/* --- Supabase data functions --- */
async function loadCoverageStats() {
  try {
    const { data, error } = await supabase
      .from("v_inv_stock_item_alias_coverage")
      .select("*");
    if (error) throw error;
    state.coverage = data || [];
    renderCoverage();
  } catch (err) {
    console.error("coverage", err);
    showToast("Failed to load coverage stats: " + (err.message || err), {
      type: "error",
    });
  }
}

async function loadUoms() {
  try {
    const { data, error } = await supabase
      .from("inv_uom")
      .select("id,code")
      .order("code", { ascending: true });
    if (error) throw error;
    const uoms = data || [];
    // populate select if present
    const sel = refs.newUom;
    if (sel) {
      // keep the first placeholder option
      sel.innerHTML = "<option value=''>(choose UOM)</option>";
      uoms.forEach((u) => {
        const opt = document.createElement("option");
        opt.value = u.id;
        opt.textContent = `${u.code || u.id}`;
        sel.appendChild(opt);
      });
    }
    return uoms;
  } catch (err) {
    console.error("loadUoms", err);
    showToast("Failed to load UOMs: " + (err.message || err), {
      type: "error",
    });
    return [];
  }
}

async function loadAliases(reset = false) {
  if (reset) {
    state.page.index = 0;
    state.page.totalCount = null;
  }
  const pageSize = state.page.pageSize;
  const offset = (state.page.index || 0) * pageSize;
  show(refs.listLoading);
  // merged may be populated in the client-side search fallback; declare here
  let merged;
  try {
    // Attempt to fetch total count for paginator (best-effort)
    const countTerm = (state.filters.search || "").trim();
    try {
      if (!countTerm) {
        // simple count from alias table using current filters
        let cntQ = supabase
          .from("inv_stock_item_alias")
          .select("id", { count: "exact", head: true })
          .eq("source_system", "tally");
        if (state.filters.sourceKind !== "all")
          cntQ = cntQ.eq("source_kind", state.filters.sourceKind);
        if (state.filters.status !== "all")
          cntQ = cntQ.eq("status", state.filters.status);
        const cntRes = await cntQ;
        if (!cntRes.error) state.page.totalCount = cntRes.count || 0;
      } else {
        // try to get count from flattened view when searching
        try {
          const esc = countTerm.replace(/%/g, "\\%");
          const like = `%${esc}%`;
          const cntRes = await supabase
            .from("v_inv_stock_item_alias_search")
            .select("id", { count: "exact", head: true })
            .or(
              `tally_item_name.ilike.${like},inv_name.ilike.${like},inv_code.ilike.${like}`
            );
          if (!cntRes.error) state.page.totalCount = cntRes.count || 0;
        } catch (errCnt) {
          console.warn("count via view failed", errCnt?.message || errCnt);
          state.page.totalCount = null; // fallback to later approximation
        }
      }
    } catch (cntErr) {
      console.warn("count query failed", cntErr?.message || cntErr);
      state.page.totalCount = null;
    }
    let q = supabase
      .from("inv_stock_item_alias")
      .select(
        "id,tally_item_name,source_kind,status,last_seen,first_seen,inv_stock_item:inv_stock_item_id(id,code,name)"
      )
      .eq("source_system", "tally")
      .order("tally_item_name", { ascending: true });

    if (state.filters.sourceKind !== "all")
      q = q.eq("source_kind", state.filters.sourceKind);
    if (state.filters.status !== "all")
      q = q.eq("status", state.filters.status);

    const term = (state.filters.search || "").trim();
    let data, error;
    if (term) {
      // Prefer a flattened server-side view for searching/paging: v_inv_stock_item_alias_search
      // If the view is not present (or the query fails) we fall back to the
      // client-side merge approach.
      const esc = term.replace(/%/g, "\\%");
      const like = `%${esc}%`;

      try {
        ({ data, error } = await supabase
          .from("v_inv_stock_item_alias_search")
          .select(
            "id,tally_item_name,source_kind,status,last_seen,first_seen,inv_stock_item_id,inv_code,inv_name,inv_default_uom_id"
          )
          .or(
            `tally_item_name.ilike.${like},inv_name.ilike.${like},inv_code.ilike.${like}`
          )
          .order("tally_item_name", { ascending: true })
          .range(offset, offset + pageSize - 1));

        if (error) throw error;
      } catch (viewErr) {
        console.warn(
          "v_inv_stock_item_alias_search query failed, falling back to client merge",
          viewErr.message || viewErr
        );

        // Fallback: client-merge method (search alias tally_name and master items)
        // helper to apply shared filters to a query builder
        const applyCommonFilters = (builder) => {
          builder.eq("source_system", "tally");
          if (state.filters.sourceKind !== "all")
            builder.eq("source_kind", state.filters.sourceKind);
          if (state.filters.status !== "all")
            builder.eq("status", state.filters.status);
          return builder;
        };

        const limitFetch = 1000; // safety cap for merged fetch

        // 1) aliases matching tally name
        const { data: byTally, error: errTally } = await applyCommonFilters(
          supabase
            .from("inv_stock_item_alias")
            .select(
              "id,tally_item_name,source_kind,status,last_seen,first_seen,inv_stock_item:inv_stock_item_id(id,code,name)"
            )
            .ilike("tally_item_name", like)
            .order("tally_item_name", { ascending: true })
            .limit(limitFetch)
        );
        if (errTally) throw errTally;

        // 2) find matching master items, then aliases mapped to them
        const { data: matchedItems, error: errMaster } = await supabase
          .from("inv_stock_item")
          .select("id")
          .or(`name.ilike.${like},code.ilike.${like}`)
          .limit(limitFetch);
        if (errMaster) throw errMaster;

        const ids = (matchedItems || []).map((r) => r.id).filter(Boolean);
        let byMaster = [];
        if (ids.length > 0) {
          const { data: d2, error: err2 } = await applyCommonFilters(
            supabase
              .from("inv_stock_item_alias")
              .select(
                "id,tally_item_name,source_kind,status,last_seen,first_seen,inv_stock_item:inv_stock_item_id(id,code,name)"
              )
              .in("inv_stock_item_id", ids)
              .order("tally_item_name", { ascending: true })
              .limit(limitFetch)
          );
          if (err2) throw err2;
          byMaster = d2 || [];
        }

        // merge unique aliases by id, preserving order by tally_item_name
        const map = new Map();
        (byTally || []).forEach((r) => map.set(r.id, r));
        (byMaster || []).forEach((r) => map.set(r.id, r));

        merged = Array.from(map.values()).sort((a, b) => {
          return (a.tally_item_name || "").localeCompare(
            b.tally_item_name || ""
          );
        });

        // apply paging client-side
        const slice = merged.slice(offset, offset + pageSize);
        data = slice;
        error = null;
      }
    } else {
      q = q.range(offset, offset + pageSize - 1);
      ({ data, error } = await q);
    }
    if (error) throw error;

    // If offset is 0 overwrite, otherwise append
    if (offset === 0) state.aliases = data || [];
    else state.aliases = state.aliases.concat(data || []);

    // track how many rows were loaded for paginator state
    state.page.lastLoadedCount = (data || []).length;

    // If we didn't obtain a reliable totalCount earlier (fallback path), and
    // we're in the client-merge search fallback, try to set totalCount to the
    // merged size we computed earlier (approximate if limit applied).
    if (
      term &&
      (state.page.totalCount === null || state.page.totalCount === undefined)
    ) {
      if (Array.isArray(merged)) {
        state.page.totalCount = merged.length;
      }
    }

    renderAliases();
    renderPaginator();
  } catch (err) {
    console.error("loadAliases", err);
    showToast("Failed to load aliases: " + (err.message || err), {
      type: "error",
    });
  } finally {
    hide(refs.listLoading);
  }
}

async function loadAliasDetail(id) {
  if (!id) return;
  show(refs.detailLoading);
  try {
    const { data, error } = await supabase
      .from("inv_stock_item_alias")
      .select(
        "*, inv_stock_item:inv_stock_item_id(id,code,name,default_uom_id)"
      )
      .eq("id", id)
      .single();
    if (error) throw error;
    state.selectedAlias = data;
    renderDetail();
    // Ensure create form is hidden when loading a new alias detail
    try {
      hideCreateForm();
    } catch {
      /* ignore */
    }
  } catch (err) {
    console.error("loadAliasDetail", err);
    showToast("Failed to load alias detail: " + (err.message || err), {
      type: "error",
    });
  } finally {
    hide(refs.detailLoading);
  }
}

async function searchStockItems(term) {
  try {
    if (!term || term.trim().length < 1) return [];
    const esc = term.replace(/%/g, "\\%");
    const like = `%${esc}%`;
    const { data, error } = await supabase
      .from("inv_stock_item")
      .select("id,code,name,default_uom_id,active")
      .or(`name.ilike.${like},code.ilike.${like}`)
      .order("name");
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("searchStockItems", err);
    showToast("Search failed: " + (err.message || err), { type: "error" });
    return [];
  }
}

async function updateAlias(aliasId, updates) {
  try {
    const payload = { ...updates, last_updated_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from("inv_stock_item_alias")
      .update(payload)
      .eq("id", aliasId);
    if (error) throw error;
    // update local state
    const idx = state.aliases.findIndex((a) => a.id === aliasId);
    if (idx !== -1) {
      // merge server response if present
      state.aliases[idx] = {
        ...state.aliases[idx],
        ...payload,
        ...(data && data[0] ? data[0] : {}),
      };
      renderAliases();
    }
    // refresh detail
    await loadAliasDetail(aliasId);
    await loadCoverageStats();
  } catch (err) {
    console.error("updateAlias", err);
    showToast("Failed to update alias: " + (err.message || err), {
      type: "error",
    });
  }
}

async function createStockItemAndMap(aliasId, item) {
  try {
    // create item
    const insert = {
      name: item.name,
      default_uom_id: item.default_uom_id || null,
      code: item.code || null,
      hsn_code: item.hsn_code || null,
      active: true,
    };
    const { data, error } = await supabase
      .from("inv_stock_item")
      .insert(insert)
      .select("id")
      .single();
    if (error) throw error;
    const newId = data.id;
    // map
    await updateAlias(aliasId, { inv_stock_item_id: newId, status: "mapped" });
    return newId;
  } catch (err) {
    console.error("createStockItemAndMap", err);
    showToast("Create & map failed: " + (err.message || err), {
      type: "error",
    });
  }
}

/* --- Rendering --- */
function renderCoverage() {
  refs.coverageStats.innerHTML = "";
  // Render coverage cards in a specific order for better UX:
  // RM, PLM, Fuel, Consumable (fallback to alphabetical)
  const preferred = ["rm", "plm", "fuel", "consumable"];
  const rows = (state.coverage || []).slice().sort((a, b) => {
    const ka = (a.source_kind || "").toString().toLowerCase();
    const kb = (b.source_kind || "").toString().toLowerCase();
    const ia = preferred.indexOf(ka);
    const ib = preferred.indexOf(kb);
    const va = ia === -1 ? Number.POSITIVE_INFINITY : ia;
    const vb = ib === -1 ? Number.POSITIVE_INFINITY : ib;
    if (va !== vb) return va - vb;
    return ka.localeCompare(kb);
  });

  rows.forEach((c) => {
    const el = document.createElement("div");
    const safe = (c.source_kind || "")
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-");
    el.className = `stat source-${safe}`;
    // Structured markup: title + icon + three stat items (total, mapped, unmapped)
    const icon = getSourceIcon(safe);
    el.innerHTML = `
      <div class="stat-title">${icon}<span class="stat-title-text">${(
      c.source_kind || ""
    ).toUpperCase()}</span></div>
      <div class="stat-grid">
        <div class="stat-item">
          <div class="stat-num">${Number(c.total_aliases || 0)}</div>
          <div class="stat-label">Total</div>
        </div>
        <div class="stat-item">
          <div class="stat-num">${Number(c.mapped_count || 0)}</div>
          <div class="stat-label">Mapped</div>
        </div>
        <div class="stat-item">
          <div class="stat-num">${Number(c.unmapped_count || 0)}</div>
          <div class="stat-label">Unmapped</div>
        </div>
      </div>`;
    refs.coverageStats.appendChild(el);
    // Make the icon clickable to quick-filter by source-kind (toggle)
    try {
      const iconEl = el.querySelector(".stat-icon");
      if (iconEl) {
        iconEl.style.cursor = "pointer";
        iconEl.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const current = state.filters.sourceKind;
          const newVal = current === safe ? "all" : safe;
          state.filters.sourceKind = newVal;
          if (refs.filterSource) refs.filterSource.value = newVal;
          // mark active card visually
          try {
            document
              .querySelectorAll("#coverage-stats .stat")
              .forEach((s) => s.classList.remove("active"));
            if (newVal !== "all") el.classList.add("active");
          } catch {
            /* ignore */
          }
          // reload list using existing debounced helper
          try {
            debouncedListReload();
          } catch {
            // fallback: immediate load
            loadAliases(true);
          }
        });
      }
    } catch {
      /* ignore */
    }
  });
}

// Return a small inline SVG string for a given source-kind key
function getSourceIcon(kind) {
  // simple geometric icons per kind
  switch ((kind || "").toLowerCase()) {
    case "rm":
      return `<svg class="stat-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="8" rx="1" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M5 13v4M9 13v4M13 13v4M17 13v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
    case "plm":
      return `<svg class="stat-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 10l-8 8a2 2 0 0 1-2 0L3 10V6a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="8" r="1.4" fill="currentColor"/></svg>`;
    case "consumable":
      return `<svg class="stat-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8l-1.5 6a4 4 0 0 1-7 0L8 3z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><path d="M7 14h10v5a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-5z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`;
    case "fuel":
      return `<svg class="stat-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3s4 3 4 7a4 4 0 0 1-8 0c0-4 4-7 4-7z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="17" width="16" height="3" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>`;
    default:
      return `<svg class="stat-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>`;
  }
}

function renderAliases() {
  refs.aliasesTbody.innerHTML = "";
  for (const row of state.aliases) {
    const tr = document.createElement("tr");
    tr.className = "";
    tr.dataset.id = row.id;

    const mappedTo = row.inv_stock_item
      ? `${row.inv_stock_item.code} · ${row.inv_stock_item.name}`
      : "—";
    const pillClass = row.status || "unmapped";

    tr.innerHTML = `
      <td>${escapeHtml(row.tally_item_name)}</td>
      <td>${escapeHtml(row.source_kind)}</td>
      <td><span class="pill ${pillClass}">${escapeHtml(
      capitalize(row.status || "unmapped")
    )}</span></td>
      <td>${escapeHtml(mappedTo)}</td>
      <td>${escapeHtml(formatDate(row.last_seen))}</td>
      <td><button class="view-btn" data-id="${row.id}">View</button></td>
    `;

    // wire the view button for this row
    // we'll attach listener after adding to DOM to ensure element exists
    refs.aliasesTbody.appendChild(tr);
    const btn = tr.querySelector(".view-btn");
    if (btn) {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        await loadAliasDetail(Number(id));
        showModal();
      });
    }
  }
}

/* --- Paginator rendering & helpers --- */
function renderPaginator() {
  const idx = state.page.index || 0;
  const size = state.page.pageSize || 50;
  const loaded = state.page.lastLoadedCount || 0;
  const totalCount = state.page.totalCount;
  if (typeof totalCount === "number" && totalCount >= 0) {
    const totalPages = Math.max(1, Math.ceil(totalCount / size));
    const displayPage = Math.min(idx + 1, totalPages);
    if (refs.pInfo)
      refs.pInfo.textContent = `Page ${displayPage}/${totalPages}`;
    if (refs.pCount) refs.pCount.textContent = "";
    // ensure current index does not exceed last page
    if (state.page.index > totalPages - 1) state.page.index = totalPages - 1;
  } else {
    if (refs.pInfo) refs.pInfo.textContent = `Page ${idx + 1}`;
    if (refs.pCount) refs.pCount.textContent = "";
  }
  // disable previous/first when on first page
  if (refs.pFirst) refs.pFirst.disabled = idx === 0;
  if (refs.pPrev) refs.pPrev.disabled = idx === 0;
  // disable next/last when fewer rows than pageSize were returned
  const noMore = loaded < size;
  const hasTotal = typeof totalCount === "number" && totalCount >= 0;
  const totalPages = hasTotal
    ? Math.max(1, Math.ceil(totalCount / size))
    : null;
  const disableNext = hasTotal ? idx + 1 >= totalPages : noMore;
  if (refs.pNext) refs.pNext.disabled = disableNext;
  if (refs.pLast) refs.pLast.disabled = disableNext;
}

function goToPage(pageIndex) {
  if (pageIndex < 0) pageIndex = 0;
  state.page.index = pageIndex;
  loadAliases(false);
}

function renderDetail() {
  const a = state.selectedAlias;
  if (!a) {
    hide(refs.detailContent);
    show(refs.detailEmpty);
    return;
  }
  hide(refs.detailEmpty);
  show(refs.detailContent);
  if (refs.detailTally) refs.detailTally.textContent = a.tally_item_name || "";
  else console.warn("renderDetail: detailTally element not found");
  // show source and status as chips
  const src = (a.source_kind || "").toString();
  const status = (a.status || "unmapped").toString();
  if (refs.detailSourceKind) {
    refs.detailSourceKind.textContent = src ? src.toUpperCase() : "";
    const safeSrc = src.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
    refs.detailSourceKind.className = `chip source-${safeSrc}`;
  }
  if (refs.detailStatus) {
    refs.detailStatus.textContent = capitalize(status || "");
    const safeStatus = status.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
    refs.detailStatus.className = `chip status-${safeStatus}`;
  }
  if (refs.detailFirstSeen)
    refs.detailFirstSeen.textContent = formatDate(a.first_seen);
  if (refs.detailLastSeen)
    refs.detailLastSeen.textContent = formatDate(a.last_seen);
  if (refs.aliasNote) refs.aliasNote.value = a.note || "";

  if (a.inv_stock_item) {
    const mappingText = `${a.inv_stock_item.code || ""} · ${
      a.inv_stock_item.name || ""
    }`;
    if (refs.detailMappedTo) refs.detailMappedTo.textContent = mappingText;
  } else {
    if (refs.detailMappedTo) refs.detailMappedTo.textContent = "—";
  }
}

/* --- UI events & handlers --- */
async function onSelectAlias(id) {
  // legacy helper (row-click behavior removed in favor of View button)
  await loadAliasDetail(id);
}

async function onSaveMapping() {
  if (!state.selectedAlias) {
    showToast("Select an alias first", { type: "info" });
    restoreInteractiveState();
    disableButtons(false);
    return;
  }
  const chosen = refs.masterResults.querySelector(".selected");
  let invId = null;
  if (chosen) invId = chosen.dataset.id;
  if (!invId) {
    showToast("Please pick a master item to map", { type: "info" });
    restoreInteractiveState();
    disableButtons(false);
    return;
  }
  disableButtons(true);
  try {
    await updateAlias(state.selectedAlias.id, {
      inv_stock_item_id: Number(invId),
      status: "mapped",
      note: refs.aliasNote.value,
    });
  } finally {
    disableButtons(false);
  }
}

async function onIgnore() {
  if (!state.selectedAlias) {
    showToast("Select an alias first", { type: "info" });
    return;
  }
  const okIgnore = await showConfirm(
    "Ignore this alias? This will clear mapping and mark as ignored."
  );
  if (!okIgnore) return;
  disableButtons(true);
  try {
    await updateAlias(state.selectedAlias.id, {
      status: "ignored",
      inv_stock_item_id: null,
      note: refs.aliasNote.value,
    });
  } finally {
    disableButtons(false);
  }
}

async function onMarkSuspect() {
  if (!state.selectedAlias) {
    showToast("Select an alias first", { type: "info" });
    return;
  }
  disableButtons(true);
  try {
    await updateAlias(state.selectedAlias.id, {
      status: "suspect",
      note: refs.aliasNote.value,
    });
  } finally {
    disableButtons(false);
  }
}

async function onClearMapping() {
  if (!state.selectedAlias) {
    showToast("Select an alias first", { type: "info" });
    return;
  }
  const okClear = await showConfirm("Clear mapping and mark as unmapped?");
  if (!okClear) return;
  disableButtons(true);
  try {
    await updateAlias(state.selectedAlias.id, {
      status: "unmapped",
      inv_stock_item_id: null,
      note: refs.aliasNote.value,
    });
  } finally {
    disableButtons(false);
  }
}

function disableButtons(disabled) {
  [
    refs.saveMappingBtn,
    refs.createAndMapBtn,
    refs.ignoreBtn,
    refs.markSuspectBtn,
    refs.clearMappingBtn,
  ].forEach((b) => (b.disabled = disabled));
}

function setCreateFormControlsEnabled(enabled) {
  try {
    if (refs.newCode) refs.newCode.disabled = !enabled;
    if (refs.newName) refs.newName.disabled = !enabled;
    if (refs.newUom) refs.newUom.disabled = !enabled;
    if (refs.newHsn) refs.newHsn.disabled = !enabled;
    if (refs.createAndMapBtn) refs.createAndMapBtn.disabled = !enabled;
  } catch (err) {
    console.warn("setCreateFormControlsEnabled", err);
  }
}

function restoreInteractiveState() {
  try {
    // enable create form fields
    if (refs.createForm) {
      const controls = refs.createForm.querySelectorAll(
        "input,textarea,select,button"
      );
      controls.forEach((c) => {
        try {
          c.disabled = false;
          c.readOnly = false;
        } catch (err) {
          console.debug(
            "restoreInteractiveState: control enable failed",
            err?.message || err
          );
        }
      });
    }
    // ensure master search and results are interactive
    if (refs.masterSearch) {
      refs.masterSearch.disabled = false;
      refs.masterSearch.readOnly = false;
    }
    if (refs.masterResults) {
      refs.masterResults.style.pointerEvents = "auto";
    }
    if (refs.aliasNote) {
      refs.aliasNote.disabled = false;
      refs.aliasNote.readOnly = false;
    }
    // ensure create-submit is enabled
    if (refs.createSubmit) refs.createSubmit.disabled = false;
  } catch (e) {
    console.warn("restoreInteractiveState", e?.message || e);
  }
}

/* Master search UI */
const debouncedMasterSearch = debounce(async (val) => {
  refs.masterResults.innerHTML = "";
  if (!val || val.trim().length === 0) return;
  const items = await searchStockItems(val);
  for (const it of items) {
    const r = document.createElement("div");
    r.className = "result-row";
    r.dataset.id = it.id;
    r.innerHTML = `<div><strong>${escapeHtml(
      it.code || ""
    )}</strong> · ${escapeHtml(
      it.name
    )}</div><div style="font-size:12px;color:var(--muted)">UOM: ${escapeHtml(
      it.default_uom_id || "—"
    )} ${it.active ? "" : "(inactive)"}</div>`;
    r.addEventListener("click", () => {
      // mark selected visually
      const prev = refs.masterResults.querySelector(".selected");
      if (prev) prev.classList.remove("selected");
      r.classList.add("selected");
    });
    refs.masterResults.appendChild(r);
  }
}, 300);

/* create new item form */
function showCreateForm() {
  if (!refs.createForm) return;
  refs.createForm.style.display = "";
  refs.newName.value = state.selectedAlias
    ? state.selectedAlias.tally_item_name || ""
    : "";
  refs.newCode.value = "";
  // preselect UOM if alias is already mapped to a master with a default uom
  try {
    const pre =
      state.selectedAlias &&
      state.selectedAlias.inv_stock_item &&
      state.selectedAlias.inv_stock_item.default_uom_id;
    refs.newUom.value = pre ? String(pre) : "";
  } catch {
    refs.newUom.value = "";
  }
  refs.newHsn.value = "";
  // ensure inputs are enabled when showing the form
  setCreateFormControlsEnabled(true);
}

function hideCreateForm() {
  if (!refs.createForm) return;
  refs.createForm.style.display = "none";
  refs.newCode.value = "";
  refs.newName.value = "";
  refs.newUom.value = "";
  refs.newHsn.value = "";
  // ensure inputs are enabled when hiding the form to avoid stuck state
  try {
    restoreInteractiveState();
  } catch {
    /* ignore */
  }
}

async function onCreateSubmit() {
  if (!state.selectedAlias) {
    showToast("Select an alias first", { type: "info" });
    return;
  }
  const name = (refs.newName.value || "").trim();
  if (!name) {
    showToast("Name is required", { type: "info" });
    return;
  }
  const item = {
    code: refs.newCode.value?.trim() || null,
    name,
    default_uom_id:
      refs.newUom && refs.newUom.value ? Number(refs.newUom.value) : null,
    hsn_code: refs.newHsn.value?.trim() || null,
  };
  disableButtons(true);
  try {
    await createStockItemAndMap(state.selectedAlias.id, item);
    hideCreateForm();
  } catch (err) {
    console.error("onCreateSubmit", err);
    showToast("Create failed: " + (err.message || err), { type: "error" });
  } finally {
    disableButtons(false);
  }
}

/* Paging: replaced by ERP-styled paginator (goToPage + renderPaginator) */

/* Filters */
const debouncedListReload = debounce(() => {
  state.page.index = 0;
  loadAliases(true);
}, 300);

/* Helpers */
function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}
function capitalize(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* Wire events */
refs.filterSource.addEventListener("change", (e) => {
  state.filters.sourceKind = e.target.value;
  debouncedListReload();
});
refs.filterStatus.addEventListener("change", (e) => {
  state.filters.status = e.target.value;
  debouncedListReload();
});
refs.filterSearch.addEventListener("input", (e) => {
  state.filters.search = e.target.value;
  debouncedListReload();
});

// Paginator wiring
if (refs.pFirst) refs.pFirst.addEventListener("click", () => goToPage(0));
if (refs.pPrev)
  refs.pPrev.addEventListener("click", () =>
    goToPage(Math.max(0, (state.page.index || 0) - 1))
  );
if (refs.pNext)
  refs.pNext.addEventListener("click", () =>
    goToPage((state.page.index || 0) + 1)
  );
// helper: try to fetch totalCount (best-effort) using similar logic as loadAliases
async function fetchTotalCount() {
  const term = (state.filters.search || "").trim();
  try {
    if (!term) {
      let cntQ = supabase
        .from("inv_stock_item_alias")
        .select("id", { count: "exact", head: true })
        .eq("source_system", "tally");
      if (state.filters.sourceKind !== "all")
        cntQ = cntQ.eq("source_kind", state.filters.sourceKind);
      if (state.filters.status !== "all")
        cntQ = cntQ.eq("status", state.filters.status);
      const cntRes = await cntQ;
      if (!cntRes.error) {
        state.page.totalCount = cntRes.count || 0;
        return state.page.totalCount;
      }
    } else {
      try {
        const esc = term.replace(/%/g, "\\%");
        const like = `%${esc}%`;
        const cntRes = await supabase
          .from("v_inv_stock_item_alias_search")
          .select("id", { count: "exact", head: true })
          .or(
            `tally_item_name.ilike.${like},inv_name.ilike.${like},inv_code.ilike.${like}`
          );
        if (!cntRes.error) {
          state.page.totalCount = cntRes.count || 0;
          return state.page.totalCount;
        }
      } catch (err) {
        console.warn("fetchTotalCount: view count failed", err?.message || err);
      }
    }
  } catch (err) {
    console.warn("fetchTotalCount failed", err?.message || err);
  }
  state.page.totalCount = null;
  return null;
}

if (refs.pLast)
  refs.pLast.addEventListener("click", async () => {
    // Ensure we have a totalCount and then go to the last page (best-effort)
    if (
      typeof state.page.totalCount !== "number" ||
      state.page.totalCount === null
    ) {
      await fetchTotalCount();
    }
    const total = state.page.totalCount;
    const size = state.page.pageSize || 50;
    if (typeof total === "number" && total > 0) {
      const lastIdx = Math.max(0, Math.ceil(total / size) - 1);
      goToPage(lastIdx);
    } else {
      showToast(
        "Cannot jump to last page: total count unavailable. Install the flattened search view for exact paging.",
        { type: "info" }
      );
    }
  });
if (refs.pSize)
  refs.pSize.addEventListener("change", (e) => {
    state.page.pageSize = Number(e.target.value) || 50;
    state.page.index = 0;
    loadAliases(true);
  });
// (Go-to removed) no jump handler required

refs.saveMappingBtn.addEventListener("click", onSaveMapping);
refs.ignoreBtn.addEventListener("click", onIgnore);
refs.markSuspectBtn.addEventListener("click", onMarkSuspect);
refs.clearMappingBtn.addEventListener("click", onClearMapping);

refs.createAndMapBtn.addEventListener("click", () => {
  showCreateForm();
});
refs.createCancel.addEventListener("click", hideCreateForm);
refs.createSubmit.addEventListener("click", onCreateSubmit);

refs.masterSearch.addEventListener("input", (e) =>
  debouncedMasterSearch(e.target.value)
);

/* Initialize */
async function init() {
  await loadCoverageStats();
  await loadUoms();
  await loadAliases(true);
}

init();

// Expose some helpers to window for debugging (optional)
window.tallyMapping = {
  state,
  loadAliases,
  loadAliasDetail,
  searchStockItems,
  onSelectAlias,
  showModal,
  hideModal,
};

// Home button behavior (match other modules)
document.addEventListener("DOMContentLoaded", () => {
  const home = document.getElementById("homeBtn");
  if (home) {
    home.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }
  // modal wiring
  const modalClose = refs.modalClose;
  const aliasModal = refs.aliasModal;
  if (modalClose) modalClose.addEventListener("click", hideModal);
  if (aliasModal)
    aliasModal.addEventListener("click", (ev) => {
      if (ev.target === aliasModal) hideModal();
    });
  // defensive recovery: if inputs become non-interactive unexpectedly,
  // re-enable them when user interacts with the modal again.
  if (aliasModal) {
    aliasModal.addEventListener("click", () => {
      try {
        restoreInteractiveState();
      } catch (err) {
        console.debug("modal click restore failed", err?.message || err);
      }
    });
    aliasModal.addEventListener("focusin", () => {
      try {
        restoreInteractiveState();
      } catch (err) {
        console.debug("modal focusin restore failed", err?.message || err);
      }
    });
  }
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") hideModal();
  });
});
