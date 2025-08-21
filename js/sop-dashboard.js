// js/sop-dashboard.js
import { supabase } from "../public/shared/js/supabaseClient.js";

/* ──────────────────────────────────────────────────────────────────────────
   DOM refs
   ────────────────────────────────────────────────────────────────────────── */
const elSeries = document.getElementById("filterSeries");
const elActivity = document.getElementById("filterActivity");
const elStatus = document.getElementById("filterStatus");
const elSearch = document.getElementById("filterSearch");
const elRows = document.getElementById("rows");
const elCount = document.getElementById("resultCount");
const elPrev = document.getElementById("prevPage");
const elNext = document.getElementById("nextPage");
const elPageInfo = document.getElementById("pageInfo");
const elNew = document.getElementById("btnNew");
const homeBtn = document.getElementById("homeBtn");
const elToggleGroup = document.getElementById("toggleGroup");
const elIncludeObsolete = document.getElementById("includeObsolete");

/* ──────────────────────────────────────────────────────────────────────────
   State
   ────────────────────────────────────────────────────────────────────────── */
const PAGE_SIZE = 20;
const FETCH_LIMIT = 400; // how many rows to fetch (grouped mode) before client grouping
let page = 1;
let total = 0;
let groupBySop = true; // default to one row per SOP
let includeObsolete = false; // toggled by checkbox

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────────────── */
const debounce = (fn, ms = 400) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

// Date ONLY (no time) for Updated column
const fmtDate = (d) => {
  if (!d) return "—";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "—";
  return x.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const badge = (status) => {
  const s = (status || "").toLowerCase();
  const cls = [
    "draft",
    "under_review",
    "approved",
    "active",
    "superseded",
    "obsolete",
  ].includes(s)
    ? s
    : "draft";
  return `<span class="badge ${cls}">${s || "draft"}</span>`;
};

// --- status coloring for Activity dropdown ---
const STATUS_PRIORITY = Object.freeze({
  obsolete: 0,
  superseded: 1,
  draft: 2,
  under_review: 3,
  approved: 4,
  active: 5,
});

function statusColor(status) {
  switch ((status || "").toLowerCase()) {
    case "active":
      return "#2563eb"; // blue
    case "approved":
      return "#16a34a"; // green
    case "under_review":
      return "#ca8a04"; // yellow
    case "draft":
      return "#6b7280"; // gray
    case "superseded":
      return "#111827"; // near-black
    case "obsolete":
      return "#dc2626"; // red
    default:
      return "#111827";
  }
}

// Solid dot helper for the Activity dropdown (2D, not emoji)
function statusDot(status) {
  // We return a filled dot for any known status; caller colors the option
  switch ((status || "").toLowerCase()) {
    case "active":
    case "approved":
    case "under_review":
    case "draft":
    case "superseded":
    case "obsolete":
      return "●"; // DOT_FILLED
    default:
      return "○"; // DOT_EMPTY
  }
}

// Get series code from SOP number like "MF.013-020" → "MF"
const seriesFromNumber = (sopNumber) => {
  if (!sopNumber) return "";
  const dot = sopNumber.indexOf(".");
  return dot > -1 ? sopNumber.slice(0, dot) : sopNumber;
};
// Safe "has own" check (avoids no-prototype-builtins)
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/* ──────────────────────────────────────────────────────────────────────────
   Session guard
   ────────────────────────────────────────────────────────────────────────── */
async function ensureSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) window.location.href = "login.html";
}

/* ──────────────────────────────────────────────────────────────────────────
   Lookups
   ────────────────────────────────────────────────────────────────────────── */
async function loadSeries() {
  const { data, error } = await supabase
    .from("sop_series")
    .select("code,name")
    .eq("is_active", true)
    .order("code");
  if (error) {
    console.error("loadSeries", error);
    return;
  }
  if (!elSeries) return;
  elSeries.innerHTML = `<option value="">All Series</option>`;
  (data || []).forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.code;
    opt.textContent = `${s.code} — ${s.name}`;
    elSeries.appendChild(opt);
  });
}

async function loadActivities() {
  // 1) Load all kinds (for the dropdown labels)
  const { data: kinds, error: eKinds } = await supabase
    .from("activity_kinds")
    .select("id,name,short_code")
    .order("name");
  if (eKinds) {
    console.error("loadActivities kinds", eKinds);
    return;
  }

  if (!elActivity) return;
  elActivity.innerHTML = `<option value="">All Activities</option>`;

  // Populate with base labels only; indicators are handled elsewhere
  (kinds || []).forEach((k) => {
    const label = k.short_code
      ? `${k.name} (${k.short_code})`
      : k.name || "Unnamed";

    const opt = document.createElement("option");
    opt.value = k.id;
    opt.dataset.label = label; // store the clean label
    opt.textContent = label; // show just the label for now
    elActivity.appendChild(opt);
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Activity indicators (small bulbs on the Activity filter)
// ──────────────────────────────────────────────────────────────────────────

// Build a map: kind_id → { hasAny: true, topStatus: "active" | ... }
function buildKindIndicatorMap(rows) {
  const map = Object.create(null);
  for (const r of rows || []) {
    const id = r?.kind_id;
    if (!id) continue;
    const st = String(r.status || "draft").toLowerCase();
    if (!hasOwn(map, id)) {
      map[id] = { hasAny: true, topStatus: st };
    } else {
      const a = STATUS_PRIORITY[st] ?? 0;
      const b = STATUS_PRIORITY[map[id].topStatus] ?? 0;
      if (a > b) map[id].topStatus = st;
    }
  }
  return map;
}

// Apply dots to <select id="filterActivity"> options
function applyActivityIndicators(kindMap) {
  if (!elActivity) return;

  // First option = "All Activities" → reset
  const first = elActivity.options[0];
  if (first) {
    first.textContent =
      first.dataset.label || first.textContent || "All Activities";
    first.style.color = "";
  }

  // Other options
  for (let i = 1; i < elActivity.options.length; i++) {
    const opt = elActivity.options[i];
    const base = opt.dataset.label || opt.textContent;
    const info = kindMap[opt.value];

    if (!info) {
      opt.textContent = base; // no bulb if no SOPs for this kind
      opt.style.color = "";
      opt.title = "No SOPs";
      continue;
    }

    const dot = statusDot(info.topStatus); // always '●' for known statuses
    opt.textContent = `${dot} ${base}`;
    opt.style.color = statusColor(info.topStatus); // color entire line
    opt.title = `Has SOPs (highest status: ${String(info.topStatus).replace(
      "_",
      " "
    )})`;
  }
}

/**
 * Recompute bulbs based on current filters (but ignore the activity filter
 * itself so we show bulbs for *all* kinds that would have matches given
 * the other filters).
 */
async function recomputeActivityIndicators(filters) {
  try {
    let q = supabase
      .from("v_sop_flat")
      .select("kind_id,status")
      .order("revision_updated_at", { ascending: false });

    // Copy filters but ignore the current activity_id
    const f = { ...filters, activity_id: null };
    q = buildFilterQuery(q, f);

    const { data, error } = await q;
    if (error) {
      console.error("recomputeActivityIndicators:", error);
      applyActivityIndicators({});
      return;
    }
    applyActivityIndicators(buildKindIndicatorMap(data || []));
  } catch (e) {
    console.error("recomputeActivityIndicators:", e);
    applyActivityIndicators({});
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   Group helpers
   (The view is already one row per SOP, so we just pass rows through
    and expose the same shape the renderer expects.)
   ────────────────────────────────────────────────────────────────────────── */
function groupRowsBySop(rows) {
  return (rows || [])
    .map((r) => ({
      sop_id: r.sop_id,
      sop_number: r.sop_number,
      title: r.title,
      version: r.version,
      status: r.status,
      updated_at: r.revision_updated_at,
      created_at: r.created_at,
      created_by_name: r.created_by_name,
      updated_by_name: r.updated_by_name,
      kind_id: r.kind_id, // ← keep this
      kind_name: r.kind_name,
      kind_code: r.kind_code,
      hasDraft: false,
      hasUnderReview: false,
      hasApproved: false,
      hasActive: (r.status || "").toLowerCase() === "active",
    }))
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

/* ──────────────────────────────────────────────────────────────────────────
   Query filter builder (works with v_sop_flat)
   ────────────────────────────────────────────────────────────────────────── */
function buildFilterQuery(base, filters) {
  let q = base;

  // Series: filter by SOP number prefix "SERIES.%"
  if (filters.series_code) {
    q = q.ilike("sop_number", `${filters.series_code}.%`);
  }

  // Activity kind
  if (filters.activity_id) q = q.eq("kind_id", filters.activity_id);

  // Status (or exclude obsolete if none selected and toggle is OFF)
  if (filters.status) {
    q = q.eq("status", filters.status);
  } else if (!filters.includeObsolete) {
    q = q.neq("status", "obsolete");
  }

  // Search: SOP No. or Title
  if (filters.search) {
    const s = `%${filters.search}%`;
    q = q.or(`sop_number.ilike.${s},title.ilike.${s}`);
  }

  return q;
}

/* ──────────────────────────────────────────────────────────────────────────
   Decide which revision to open (for actions)
   ────────────────────────────────────────────────────────────────────────── */
async function resolveRevisionId(
  sop_id,
  intent /* 'view' | 'edit' | 'review' */
) {
  // 1) review → prefer under_review
  if (intent === "review") {
    const { data: ur } = await supabase
      .from("sop_revisions")
      .select("id")
      .eq("sop_id", sop_id)
      .eq("status", "under_review")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ur?.id) return ur.id;
  }

  // 2) edit → prefer draft
  if (intent === "edit") {
    const { data: d } = await supabase
      .from("sop_revisions")
      .select("id")
      .eq("sop_id", sop_id)
      .eq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (d?.id) return d.id;
  }

  // 3) view (and edit fallback) → prefer active
  const { data: a } = await supabase
    .from("sop_revisions")
    .select("id")
    .eq("sop_id", sop_id)
    .eq("status", "active")
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (a?.id) return a.id;

  // 4) otherwise latest by updated_at
  const { data: latest } = await supabase
    .from("sop_revisions")
    .select("id")
    .eq("sop_id", sop_id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return latest?.id || null;
}

/* ──────────────────────────────────────────────────────────────────────────
   Rendering
   ────────────────────────────────────────────────────────────────────────── */
function renderEmpty(message = "No SOPs found.") {
  elRows.innerHTML = `<tr><td colspan="8" class="empty">${message}</td></tr>`;
}

/* ──────────────────────────────────────────────────────────────────────────
   Main refresh
   ────────────────────────────────────────────────────────────────────────── */
async function refresh() {
  includeObsolete = !!(elIncludeObsolete && elIncludeObsolete.checked);

  const filters = {
    series_code: elSeries?.value || null,
    activity_id: elActivity?.value || null,
    status: elStatus?.value || null,
    search: elSearch?.value?.trim() || null,
    includeObsolete,
  };
  recomputeActivityIndicators(filters);

  if (groupBySop) {
    // One row per SOP (view is already flattened to display-revision)
    let q = supabase
      .from("v_sop_flat")
      .select(
        "sop_id, sop_number, title, series_code, version, status, " +
          "revision_updated_at, kind_id, kind_name, kind_code, " +
          "created_at, created_by_name, updated_at, updated_by_name"
      )
      .order("revision_updated_at", { ascending: false })
      .range(0, FETCH_LIMIT - 1);

    q = buildFilterQuery(q, filters);

    const { data, error } = await q;
    if (error) {
      console.error("load (grouped) error", error);
      renderEmpty("Failed to load.");
      elCount.textContent = "Error";
      await recomputeActivityIndicators(filters);
      return;
    }

    const grouped = groupRowsBySop(data || []);
    total = grouped.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (page > pages) page = pages;

    const start = (page - 1) * PAGE_SIZE;
    const slice = grouped.slice(start, start + PAGE_SIZE);

    if (!slice.length) {
      elCount.textContent = `0 results`;
      renderEmpty();
    } else {
      elCount.textContent = `${total} result${
        total === 1 ? "" : "s"
      } • Page ${page}/${pages}`;

      elRows.innerHTML = slice
        .map((r) => {
          const seriesLabel = seriesFromNumber(r.sop_number);
          const kindLabel = r.kind_name
            ? `${r.kind_name}${r.kind_code ? ` (${r.kind_code})` : ""}`
            : r.kind_code || "";

          // No extra draft/approved chips here; the view is already per-SOP.
          return `
            <tr>
              <td>${r.sop_number || ""}</td>
              <td>${r.title || ""}</td>
              <td>${seriesLabel}</td>
              <td>${kindLabel}</td>
              <td>${r.version || ""}</td>
              <td>${badge(r.status)}</td>
              <td class="meta-sm">${fmtDate(r.created_at)}</td>
              <td class="meta-sm">${r.created_by_name || "—"}</td>
              <td class="meta-sm">${fmtDate(
                r.updated_at || r.revision_updated_at
              )}</td>
              <td class="meta-sm">${r.updated_by_name || "—"}</td>
              <td class="actions">
              <div class="kebab">
                <button class="kebab-btn" aria-haspopup="true" aria-expanded="false">⋯</button>
                <div class="kebab-menu" hidden>
                 <button class="menu-item" data-action="view" data-sop-id="${
                   r.sop_id
                 }">View</button>
                 ${
                   (r.status || "").toLowerCase() !== "obsolete"
                     ? `<button class="menu-item" data-action="edit" data-sop-id="${r.sop_id}">Edit</button>`
                     : ""
                 }
                  ${
                    (r.hasUnderReview ?? false) ||
                    (r.status || "").toLowerCase() === "under_review"
                      ? `<button class="menu-item" data-action="review" data-sop-id="${r.sop_id}">Review</button>`
                      : ""
                  }
                </div>
              </div>
            </td>
            </tr>
            `;
        })
        .join("");
    }

    const pagesNow = Math.max(1, Math.ceil(total / PAGE_SIZE));
    elPageInfo.textContent = `Page ${page}`;
    elPrev.disabled = page <= 1;
    elNext.disabled = page >= pagesNow;
    await recomputeActivityIndicators(filters);
  } else {
    // Per-revision view (server-side pagination) – still reads the same view
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // Count (HEAD)
    let qc = supabase
      .from("v_sop_flat")
      .select("*", { count: "exact", head: true });
    qc = buildFilterQuery(qc, filters);
    const { count, error: e1 } = await qc;
    if (e1) {
      console.error("countRows error", e1);
      elCount.textContent = "Error";
      total = 0;
    } else {
      total = count || 0;
    }

    // Page data
    let q = supabase
      .from("v_sop_flat")
      .select(
        "sop_id, sop_number, title, series_code, version, status, " +
          "revision_updated_at, kind_id, kind_name, kind_code, " +
          "created_at, created_by_name, updated_at, updated_by_name"
      )
      .order("revision_updated_at", { ascending: false })
      .range(from, to);
    q = buildFilterQuery(q, filters);

    const { data, error } = await q;
    if (error) {
      console.error("loadRows error", error);
      renderEmpty("Failed to load.");
      elCount.textContent = "Error";
      await recomputeActivityIndicators(filters);
      return;
    }

    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (!data?.length) {
      elCount.textContent = `0 results`;
      renderEmpty();
    } else {
      elCount.textContent = `${total} result${
        total === 1 ? "" : "s"
      } • Page ${page}/${pages}`;

      elRows.innerHTML = data
        .map((r) => {
          const seriesLabel = seriesFromNumber(r.sop_number);
          const kindLabel = r.kind_name
            ? `${r.kind_name}${r.kind_code ? ` (${r.kind_code})` : ""}`
            : r.kind_code || "";
          return `
            <tr>
              <td>${r.sop_number || ""}</td>
              <td>${r.title || ""}</td>
              <td>${seriesLabel}</td>
              <td>${kindLabel}</td>
              <td>${r.version || ""}</td>
              <td>${badge(r.status)}</td>
              <td class="meta-sm">${fmtDate(r.created_at)}</td>
              <td class="meta-sm">${r.created_by_name || "—"}</td>
              <td class="meta-sm">${fmtDate(
                r.updated_at || r.revision_updated_at
              )}</td>
              <td class="meta-sm">${r.updated_by_name || "—"}</td>
              <td class="actions">
                <button class="sop-btn" data-action="view" data-sop-id="${
                  r.sop_id
                }">View</button>
                ${
                  (r.status || "").toLowerCase() !== "obsolete"
                    ? `<button class="sop-btn" data-action="edit" data-sop-id="${r.sop_id}">Edit</button>`
                    : ""
                }
              </td>
            </tr>
          `;
        })
        .join("");
    }

    const pagesNow = Math.max(1, Math.ceil(total / PAGE_SIZE));
    elPageInfo.textContent = `Page ${page}`;
    elPrev.disabled = page <= 1;
    elNext.disabled = page >= pagesNow;
    await recomputeActivityIndicators(filters);
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   Events
   ────────────────────────────────────────────────────────────────────────── */
homeBtn?.addEventListener("click", () => (window.location.href = "index.html"));

elPrev.addEventListener("click", () => {
  if (page > 1) {
    page--;
    refresh();
  }
});
elNext.addEventListener("click", () => {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page < pages) {
    page++;
    refresh();
  }
});

// ——— KEBAB MENU: portal + auto-flip (fixed open/close state) ———
const MENU_ORIGIN = new WeakMap();

function closeAllMenus() {
  document.querySelectorAll(".kebab-menu").forEach((menu) => {
    // reattach to original cell if we portaled it
    if (MENU_ORIGIN.has(menu)) {
      const wrap = MENU_ORIGIN.get(menu);
      if (wrap && wrap.isConnected) wrap.appendChild(menu);
      MENU_ORIGIN.delete(menu);
    }
    // fully reset state
    menu.hidden = true;
    menu.removeAttribute("data-open");
    menu.classList.remove("kebab-menu--floating", "open-up");
    menu.style.cssText = "";
  });

  document
    .querySelectorAll(".kebab-btn[aria-expanded='true']")
    .forEach((b) => b.setAttribute("aria-expanded", "false"));
}

function openKebabMenu(kebabBtn, menu) {
  // close others first
  closeAllMenus();

  // portal the menu to <body> so panel/table scrollbars never appear
  const wrap = kebabBtn.closest(".kebab");
  if (wrap && menu.parentElement !== document.body) {
    MENU_ORIGIN.set(menu, wrap);
    document.body.appendChild(menu);
  }

  // measure natural size safely
  const prevVis = menu.style.visibility;

  menu.hidden = false;
  menu.style.visibility = "hidden";
  menu.style.maxHeight = "";
  menu.classList.add("kebab-menu--floating");

  const menuH = Math.max(menu.offsetHeight || 0, 160);
  const menuW = Math.max(menu.offsetWidth || 0, 160);
  const rect = kebabBtn.getBoundingClientRect();
  const pad = 4;
  const vpH = window.innerHeight;
  const vpW = window.innerWidth;

  const spaceBelow = vpH - rect.bottom - pad;
  const spaceAbove = rect.top - pad;
  const openUp = spaceBelow < menuH && spaceAbove > spaceBelow;

  // horizontal placement (right-edge aligned by default; clamp to viewport)
  let left = Math.min(vpW - menuW - 8, Math.max(8, rect.right - menuW));
  if (left + menuW > vpW - 8) left = vpW - menuW - 8;
  if (left < 8) left = 8;

  // vertical placement
  let top = openUp ? rect.top - menuH - pad : rect.bottom + pad;
  if (!openUp && top + menuH > vpH - 8) top = vpH - menuH - 8;
  if (openUp && top < 8) top = 8;

  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
  menu.style.maxHeight = `${Math.floor(
    openUp ? spaceAbove - 8 : spaceBelow - 8
  )}px`;
  menu.style.overflow = "auto";
  if (openUp) menu.classList.add("open-up");
  else menu.classList.remove("open-up");

  menu.style.visibility = prevVis || "";
  menu.dataset.open = "1";
  kebabBtn.setAttribute("aria-expanded", "true");
}

elRows.addEventListener("click", (ev) => {
  // Toggle kebab
  const kebabBtn = ev.target.closest(".kebab-btn");
  if (!kebabBtn) return;

  ev.stopPropagation();
  const wrap = kebabBtn.closest(".kebab");
  const menu = wrap?.querySelector(".kebab-menu");
  if (!menu) return;

  const isOpen = menu.dataset.open === "1" && !menu.hidden;
  if (isOpen) {
    // close THIS menu cleanly
    if (MENU_ORIGIN.has(menu)) {
      const origin = MENU_ORIGIN.get(menu);
      if (origin && origin.isConnected) origin.appendChild(menu);
      MENU_ORIGIN.delete(menu);
    }
    menu.hidden = true;
    menu.removeAttribute("data-open");
    menu.classList.remove("kebab-menu--floating", "open-up");
    menu.style.cssText = "";
    kebabBtn.setAttribute("aria-expanded", "false");
  } else {
    openKebabMenu(kebabBtn, menu);
  }
});

// Actions from kebab menus (work even when menus are portaled to <body>)
document.addEventListener("click", async (ev) => {
  const item = ev.target.closest(
    ".menu-item[data-action], .sop-btn[data-action]"
  );
  if (!item) return;

  ev.stopPropagation();
  const action = item.dataset.action;
  const sopId = item.dataset.sopId;

  closeAllMenus();

  const revId = await resolveRevisionId(sopId, action);
  if (!revId) {
    alert("Could not locate a revision to open.");
    return;
  }

  const url =
    action === "view"
      ? `sop-viewer.html?rev=${encodeURIComponent(revId)}`
      : `sop-editor.html?rev=${encodeURIComponent(revId)}`;
  window.location.href = url;
});

// global close
document.addEventListener("click", (e) => {
  if (!e.target.closest(".kebab, .kebab-menu")) closeAllMenus();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAllMenus();
});
window.addEventListener("resize", closeAllMenus, { passive: true });
window.addEventListener("scroll", closeAllMenus, { passive: true });

elNew.addEventListener("click", () => {
  window.location.href = "sop-editor.html";
});

elSeries?.addEventListener("change", () => {
  page = 1;
  refresh();
});
elActivity.addEventListener("change", () => {
  page = 1;
  refresh();
});
elStatus.addEventListener("change", () => {
  page = 1;
  refresh();
});
elSearch.addEventListener(
  "input",
  debounce(() => {
    page = 1;
    refresh();
  }, 400)
);

/* Grouped view toggle + Include Obsolete toggle (null-safe) */
if (elToggleGroup) {
  elToggleGroup.addEventListener("change", () => {
    groupBySop = !!elToggleGroup.checked;
    page = 1;
    refresh();
  });
}
if (elIncludeObsolete) {
  elIncludeObsolete.addEventListener("change", () => {
    includeObsolete = !!elIncludeObsolete.checked;
    page = 1;
    refresh();
    loadActivities();
  });
}

/* ──────────────────────────────────────────────────────────────────────────
   Init
   ────────────────────────────────────────────────────────────────────────── */
(async function init() {
  await ensureSession();
  await Promise.all([loadSeries(), loadActivities()]);
  await refresh();
})();
