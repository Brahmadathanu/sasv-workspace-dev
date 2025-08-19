// js/sop-dashboard.js
import { supabase } from "../public/shared/js/supabaseClient.js";

// DOM refs
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

// paging
const PAGE_SIZE = 20;
let page = 1;
let total = 0;

// helpers
const debounce = (fn, ms = 400) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};
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
const fmtDT = (d) => {
  if (!d) return "—";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "—";
  return x.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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

// session guard
async function ensureSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) window.location.href = "login.html";
}

// lookups
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
  elSeries.innerHTML = `<option value="">All Series</option>`;
  (data || []).forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.code;
    opt.textContent = `${s.code} — ${s.name}`;
    elSeries.appendChild(opt);
  });
}
async function loadActivities() {
  const { data, error } = await supabase
    .from("activity_kinds")
    .select("id,name,short_code")
    .order("name");
  if (error) {
    console.error("loadActivities", error);
    return;
  }
  elActivity.innerHTML = `<option value="">All Activities</option>`;
  (data || []).forEach((k) => {
    const opt = document.createElement("option");
    opt.value = k.id;
    opt.textContent = k.short_code ? `${k.name} (${k.short_code})` : k.name;
    elActivity.appendChild(opt);
  });
}

// fetch a page of sop_master (filters w/o status) + count
async function fetchMasters({ series_code, activity_kind_id, search }) {
  // COUNT
  let qc = supabase
    .from("sop_master")
    .select("id", { count: "exact", head: true });
  if (series_code) qc = qc.eq("series_code", series_code);
  if (activity_kind_id) qc = qc.eq("activity_kind_id", activity_kind_id);
  if (search) {
    const s = `%${search}%`;
    qc = qc.or(`sop_code.ilike.${s},title.ilike.${s}`);
  }
  const { count, error: countErr } = await qc;
  if (countErr) {
    console.error("count masters", countErr);
  }

  // PAGE
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let q = supabase
    .from("sop_master")
    .select(
      "id, sop_code, title, series_code, activity_kind_id, review_policy_code, updated_at"
    )
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (series_code) q = q.eq("series_code", series_code);
  if (activity_kind_id) q = q.eq("activity_kind_id", activity_kind_id);
  if (search) {
    const s = `%${search}%`;
    q = q.or(`sop_code.ilike.${s},title.ilike.${s}`);
  }

  const { data, error } = await q;
  if (error) {
    console.error("load masters", error);
    return { rows: [], count: 0 };
  }
  return { rows: data || [], count: count || 0 };
}

// fetch all revisions for a set of sop_ids; pick a display revision per SOP:
// prefer ACTIVE; else the most recently updated one
async function fetchDisplayRevisions(sopIds) {
  if (!sopIds.length) return new Map();

  const { data, error } = await supabase
    .from("sop_revisions")
    .select("id, sop_id, status, version_text, effective_date, updated_at")
    .in("sop_id", sopIds);

  if (error) {
    console.error("load revisions", error);
    return new Map();
  }

  const bySop = new Map(); // sop_id -> { active?, latest? }
  (data || []).forEach((r) => {
    const key = r.sop_id;
    if (!bySop.has(key)) bySop.set(key, { active: null, latest: null });
    const entry = bySop.get(key);

    // choose active if present
    if (r.status === "active") entry.active = r;

    // track latest by updated_at
    if (
      !entry.latest ||
      new Date(r.updated_at) > new Date(entry.latest.updated_at)
    ) {
      entry.latest = r;
    }
  });

  // choose display = active || latest
  const display = new Map();
  bySop.forEach((v, k) => {
    display.set(k, v.active || v.latest || null);
  });
  return display;
}

// optional: map activity_kind_id -> "Name (Code)"
async function fetchActivityMap(kindIds) {
  if (!kindIds.length) return new Map();
  const { data, error } = await supabase
    .from("activity_kinds")
    .select("id,name,short_code")
    .in("id", kindIds);
  if (error) {
    console.error("activity map", error);
    return new Map();
  }
  const m = new Map();
  (data || []).forEach((k) =>
    m.set(k.id, k.short_code ? `${k.name} (${k.short_code})` : k.name)
  );
  return m;
}

function renderEmpty(message = "No SOPs found.") {
  elRows.innerHTML = `<tr><td colspan="8" class="empty">${message}</td></tr>`;
}

async function refresh() {
  const filters = {
    series_code: elSeries.value || null,
    activity_kind_id: elActivity.value || null,
    status: elStatus.value || null,
    search: elSearch.value.trim() || null,
  };

  // 1) masters + count (server)
  const { rows: masters, count } = await fetchMasters(filters);
  total = count;

  // 2) revisions (server) -> choose display revision per sop
  const sopIds = masters.map((m) => m.id);
  const chosen = await fetchDisplayRevisions(sopIds);

  // 3) optional activity labels
  const kindIds = [
    ...new Set(masters.map((m) => m.activity_kind_id).filter(Boolean)),
  ];
  const actMap = await fetchActivityMap(kindIds);

  // 4) stitch rows; apply STATUS filter *client-side* to chosen revision
  let stitched = masters.map((m) => {
    const rev = chosen.get(m.id) || null;
    return {
      sop_id: m.id,
      sop_code: m.sop_code,
      title: m.title,
      activity_label: m.activity_kind_id
        ? actMap.get(m.activity_kind_id) || m.activity_kind_id
        : "",
      version_text: rev?.version_text || "",
      status: rev?.status || "—",
      effective_date: rev?.effective_date || null,
      updated_at: rev?.updated_at || m.updated_at || null,
      active_revision_id: rev && rev.status === "active" ? rev.id : null,
      display_revision_id: rev?.id || null,
    };
  });

  if (filters.status) {
    stitched = stitched.filter(
      (r) => (r.status || "").toLowerCase() === filters.status
    );
  }

  // 5) render
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (!stitched.length) {
    elCount.textContent = `0 results`;
    renderEmpty();
  } else {
    elCount.textContent = `${total} result${
      total === 1 ? "" : "s"
    } • Page ${page}/${pages}`;
    elRows.innerHTML = stitched
      .map((r) => {
        const openUrl = r.display_revision_id
          ? `sop-editor.html?rev=${encodeURIComponent(r.display_revision_id)}`
          : `sop-editor.html`; // fallback to create mode
        const openActive = r.active_revision_id
          ? `<a href="sop-editor.html?rev=${encodeURIComponent(
              r.active_revision_id
            )}">Open active</a>`
          : "";
        return `
        <tr>
          <td class="mono">${r.sop_code || ""}</td>
          <td>${r.title || ""}</td>
          <td>${r.activity_label || ""}</td>
          <td>${r.version_text || ""}</td>
          <td>${badge(r.status)}</td>
          <td>${fmtDate(r.effective_date)}</td>
          <td>${fmtDT(r.updated_at)}</td>
          <td class="actions">
            <a href="${openUrl}">Open</a>
            ${openActive}
          </td>
        </tr>
      `;
      })
      .join("");
  }

  // 6) pagination controls
  elPageInfo.textContent = `Page ${page}`;
  elPrev.disabled = page <= 1;
  elNext.disabled = page >= pages;
}

// events
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
elNew.addEventListener("click", () => {
  window.location.href = "sop-editor.html";
});

elSeries.addEventListener("change", () => {
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

// init
(async function init() {
  await ensureSession();
  await Promise.all([loadSeries(), loadActivities()]);
  await refresh();
})();
