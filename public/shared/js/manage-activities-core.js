// Manage Activities — pure logic + data layer (no DOM). The UI (js/activities.js) is a thin shell over this.
// Client-side contract only: direct table access on public.activities / lookups. No RPCs are invented here.
// Server-side permission enforcement is a separate server-owner dependency; this client never works around a denial.

export const MODULE_ID = "manage-activities";
export const PAGE_SIZES = [25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;
export const BATCH_SIZE = 25;
export const BULK_MAX_ROWS = 25;
export const NAME_MAX = 200;
export const DURATION_MAX = 3650;

const LIST_SELECT =
  "id,activity_name,duration_days,section_id,sub_section_id,area_id,kind_id," +
  "sections(section_name),subsections(subsection_name),areas(area_name),activity_kinds(name,short_code)";

/** Normalised name key used for client-side duplicate detection (server constraint stays authoritative). */
export const nameKey = (s) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/** Escape LIKE wildcards so user text is matched literally. */
export function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Classify a Supabase/PostgREST error into a stable UI outcome.
 * kinds: permission | duplicate | in-use | invalid | network | unknown
 */
export function classifyError(err, action = "save") {
  const code = String(err?.code ?? "");
  const msg = String(err?.message ?? err ?? "");
  const low = msg.toLowerCase();
  if (code === "42501" || code === "401" || code === "403" || /row-level security|permission denied|not authorized|jwt/i.test(msg)) {
    return { kind: "permission", message: `You do not have permission to ${action} activities. No change was made.` };
  }
  if (code === "23505") {
    return { kind: "duplicate", message: "An activity with this name already exists in the system." };
  }
  if (code === "23503") {
    return action === "delete"
      ? { kind: "in-use", message: "This activity is in use (for example by production routes or capacity rules) and cannot be deleted." }
      : { kind: "invalid", message: "A selected section, sub-section, area or kind is no longer valid. Refresh and try again." };
  }
  if (code === "23502" || code === "23514" || code === "22P02") {
    return { kind: "invalid", message: `The server rejected the values (${msg || code}).` };
  }
  if (/failed to fetch|networkerror|network request failed|load failed|timeout|fetch/i.test(low) || err instanceof TypeError) {
    return { kind: "network", message: "Network problem — the server could not be reached. Nothing was changed; try again." };
  }
  return { kind: "unknown", message: `Could not ${action} (${msg || "unknown error"}).` };
}

/** Resolve module access from a get_user_permissions-style array. Fails closed. */
export function accessFromPermissions(perms, moduleId = MODULE_ID) {
  if (!Array.isArray(perms)) return { view: false, edit: false, reason: "verify-failed" };
  const p = perms.find((r) => r && r.target === `module:${moduleId}`);
  const view = !!(p && p.can_view);
  const edit = view && !!(p && p.can_edit);
  return { view, edit, reason: view ? "ok" : "denied" };
}

export async function loadAccess(client, userId, moduleId = MODULE_ID) {
  if (!userId) return { view: false, edit: false, reason: "verify-failed" };
  try {
    const { data, error } = await client.rpc("get_user_permissions", { p_user_id: userId });
    if (error) return { view: false, edit: false, reason: "verify-failed" };
    return accessFromPermissions(data, moduleId);
  } catch {
    return { view: false, edit: false, reason: "verify-failed" };
  }
}

/** Validate one activity draft. Returns { ok, errors:{field:msg}, value }. */
export function validateActivity(d) {
  const errors = {};
  const name = String(d?.name ?? "").trim().replace(/\s+/g, " ");
  if (!name) errors.name = "Activity name is required.";
  else if (name.length > NAME_MAX) errors.name = `Name must be ${NAME_MAX} characters or fewer.`;
  const toId = (v) => (v === "" || v == null ? null : v);
  const sec = toId(d?.section_id);
  const sub = toId(d?.sub_section_id);
  const area = toId(d?.area_id);
  const kind = toId(d?.kind_id);
  if (sec == null) errors.section_id = "Select a section.";
  if (sub == null) errors.sub_section_id = "Select a sub-section.";
  if (area == null) errors.area_id = "Select an area.";
  if (kind == null) errors.kind_id = "Select an activity kind.";
  const raw = String(d?.duration_days ?? "").trim();
  let dur = NaN;
  if (raw === "") errors.duration_days = "Duration is required.";
  else if (!/^\d+$/.test(raw)) errors.duration_days = "Duration must be a whole number of days (0 or more).";
  else {
    dur = Number(raw);
    if (dur > DURATION_MAX) errors.duration_days = `Duration must be ${DURATION_MAX} days or fewer.`;
  }
  const ok = Object.keys(errors).length === 0;
  return {
    ok,
    errors,
    value: ok
      ? { activity_name: name, section_id: Number(sec), sub_section_id: Number(sub), area_id: Number(area), kind_id: String(kind), duration_days: dur }
      : null,
  };
}

/** Validate bulk drafts: per-row field errors plus duplicate names within the batch. Returns array aligned to rows. */
export function validateBulk(rows) {
  const seen = new Map();
  rows.forEach((r, i) => {
    const k = nameKey(r?.name);
    if (k) seen.set(k, [...(seen.get(k) || []), i]);
  });
  return rows.map((r, i) => {
    const v = validateActivity(r);
    const errors = { ...v.errors };
    const k = nameKey(r?.name);
    if (k && (seen.get(k) || []).length > 1) errors.name = errors.name || "Duplicate name within this batch.";
    return { ok: Object.keys(errors).length === 0, errors, value: Object.keys(errors).length ? null : v.value };
  });
}

/** True when a draft row has no user input at all (ignored on submit). */
export const isBlankDraft = (r) => !String(r?.name ?? "").trim() && !String(r?.duration_days ?? "").trim() && !r?.area_id && !r?.sub_section_id && !r?.section_id;

export function createActivitiesService(client) {
  const cache = { sections: null, kinds: null, subs: new Map(), areas: new Map() };

  async function lookup(key, build) {
    const { data, error } = await build();
    if (error) throw Object.assign(new Error(error.message || "lookup failed"), { cause: error, code: error.code });
    return data || [];
  }

  return {
    async sections() {
      return (cache.sections ??= await lookup("sections", () => client.from("sections").select("id,section_name").order("section_name"))).slice();
    },
    async kinds() {
      return (cache.kinds ??= await lookup("kinds", () => client.from("activity_kinds").select("id,name,short_code").order("name"))).slice();
    },
    async subsections(sectionId) {
      if (!sectionId) return [];
      const k = String(sectionId);
      if (!cache.subs.has(k)) cache.subs.set(k, await lookup("subs", () => client.from("subsections").select("id,subsection_name").eq("section_id", sectionId).order("subsection_name")));
      return cache.subs.get(k).slice();
    },
    async areas(sectionId, subId) {
      if (!sectionId || !subId) return [];
      const k = `${sectionId}:${subId}`;
      if (!cache.areas.has(k)) cache.areas.set(k, await lookup("areas", () => client.from("areas").select("id,area_name").eq("section_id", sectionId).eq("subsection_id", subId).order("area_name")));
      return cache.areas.get(k).slice();
    },

    /** Paginated, filtered list. Returns { rows, total } or throws. */
    async list({ offset = null, page = 1, pageSize = DEFAULT_PAGE_SIZE, search = "", sectionId = "", subId = "", areaId = "", kindId = "" } = {}) {
      const size = PAGE_SIZES.includes(Number(pageSize)) ? Number(pageSize) : DEFAULT_PAGE_SIZE;
      const p = Math.max(1, Math.floor(Number(page)) || 1);
      const from = Number.isInteger(offset) && offset >= 0 ? offset : (p - 1) * size;
      let q = client.from("activities").select(LIST_SELECT, { count: "exact" });
      if (sectionId) q = q.eq("section_id", sectionId);
      if (subId) q = q.eq("sub_section_id", subId);
      if (areaId) q = q.eq("area_id", areaId);
      if (kindId) q = q.eq("kind_id", kindId);
      const s = String(search ?? "").trim();
      if (s) q = q.ilike("activity_name", `%${escapeLike(s)}%`);
      q = q.order("activity_name", { ascending: true }).order("id", { ascending: true }).range(from, from + size - 1);
      const { data, error, count } = await q;
      if (error) throw Object.assign(new Error(error.message || "list failed"), { cause: error, code: error.code });
      return { rows: data || [], total: typeof count === "number" ? count : from + (data || []).length, page: p, pageSize: size, offset: from };
    },

    /** Each write resolves to { ok:true, row } or { ok:false, kind, message }. Never throws. */
    async create(draft) {
      const v = validateActivity(draft);
      if (!v.ok) return { ok: false, kind: "invalid", message: "Please fix the highlighted fields.", errors: v.errors };
      try {
        const { data, error } = await client.from("activities").insert([v.value]).select("id").maybeSingle();
        if (error) return { ok: false, ...classifyError(error, "create") };
        return { ok: true, row: data };
      } catch (e) {
        return { ok: false, ...classifyError(e, "create") };
      }
    },

    async update(id, draft) {
      const v = validateActivity(draft);
      if (!v.ok) return { ok: false, kind: "invalid", message: "Please fix the highlighted fields.", errors: v.errors };
      try {
        const { data, error } = await client.from("activities").update(v.value).eq("id", id).select("id");
        if (error) return { ok: false, ...classifyError(error, "edit") };
        // RLS can silently filter a write to zero rows: treat as not saved, never as success.
        if (!Array.isArray(data) || data.length === 0) {
          return { ok: false, kind: "not-applied", message: "The change was not applied (the activity no longer exists or you lack permission). Refresh and try again." };
        }
        return { ok: true };
      } catch (e) {
        return { ok: false, ...classifyError(e, "edit") };
      }
    },

    async remove(id) {
      try {
        const { data, error } = await client.from("activities").delete().eq("id", id).select("id");
        if (error) return { ok: false, ...classifyError(error, "delete") };
        if (!Array.isArray(data) || data.length === 0) {
          return { ok: false, kind: "not-applied", message: "Nothing was deleted (the activity no longer exists or you lack permission). Refresh and try again." };
        }
        return { ok: true };
      } catch (e) {
        return { ok: false, ...classifyError(e, "delete") };
      }
    },

    /**
     * Bulk create. Validates all rows first (no writes if any invalid). Then inserts one by one so a single
     * failure never hides the others. A permission failure stops the batch (no further attempts).
     * Returns per-row results aligned to input: { index, status: 'created'|'failed'|'invalid'|'skipped', message, errors }.
     */
    async bulkCreate(rows) {
      const checks = validateBulk(rows);
      if (checks.some((c) => !c.ok)) {
        return { wrote: false, results: checks.map((c, index) => ({ index, status: c.ok ? "skipped" : "invalid", errors: c.errors, message: c.ok ? "Not submitted (other rows need fixing)." : "Fix this row." })) };
      }
      const results = [];
      let stopped = null;
      for (let index = 0; index < rows.length; index++) {
        if (stopped) { results.push({ index, status: "skipped", message: "Not attempted after a permission failure." }); continue; }
        const r = await this.create(rows[index]);
        if (r.ok) results.push({ index, status: "created" });
        else {
          results.push({ index, status: "failed", kind: r.kind, message: r.message });
          if (r.kind === "permission") stopped = r;
        }
      }
      return { wrote: true, results };
    },
  };
}

/** Compute pager display state. */
export function pagerState({ page, pageSize, total }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const cur = Math.min(Math.max(1, page), pages);
  const from = total === 0 ? 0 : (cur - 1) * pageSize + 1;
  const to = Math.min(total, cur * pageSize);
  return { page: cur, pages, from, to, hasPrev: cur > 1, hasNext: cur < pages };
}

/** "1 day" / "3 days" — duration always carries its unit. */
export const formatDuration = (n) => `${n ?? 0} ${Number(n) === 1 ? "day" : "days"}`;

/** Number of active catalogue filters (search text is not a drawer filter). */
export const activeFilterCount = (f) => ["sectionId", "subId", "areaId", "kindId"].filter((k) => f?.[k]).length;

/** Append a batch, dropping rows already loaded (offset paging can overlap after concurrent inserts). */
export function mergeById(existing, incoming) {
  const seen = new Set(existing.map((r) => String(r.id)));
  return existing.concat(incoming.filter((r) => !seen.has(String(r.id))));
}
