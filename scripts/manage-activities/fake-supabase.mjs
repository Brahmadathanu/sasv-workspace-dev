// In-memory Supabase fake for Manage Activities tests (node + browser). No network, no real data, no writes anywhere.
export function makeData(n = 60) {
  const sections = [{ id: 1, section_name: "Sec A" }, { id: 2, section_name: "Sec B" }];
  const subsections = [{ id: 11, section_id: 1, subsection_name: "Sub A1" }, { id: 21, section_id: 2, subsection_name: "Sub B1" }];
  const areas = [{ id: 111, section_id: 1, subsection_id: 11, area_name: "Area A1a" }, { id: 211, section_id: 2, subsection_id: 21, area_name: "Area B1a" }];
  const activity_kinds = [{ id: "k-1", name: "Process", short_code: "P" }, { id: "k-2", name: "Quality", short_code: "Q" }];
  const activities = Array.from({ length: n }, (_, i) => {
    const b = i % 2 === 1;
    return { id: i + 1, activity_name: `Activity ${String(i + 1).padStart(3, "0")}`, duration_days: i % 5,
      section_id: b ? 2 : 1, sub_section_id: b ? 21 : 11, area_id: b ? 211 : 111, kind_id: i % 3 === 0 ? "k-2" : "k-1" };
  });
  return { sections, subsections, areas, activity_kinds, activities };
}

const likeRe = (p) => {
  let out = "";
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "\\" && i + 1 < p.length) { out += p[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); continue; }
    out += c === "%" ? ".*" : c === "_" ? "." : c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + out + "$", "i");
};

/** cfg: { data, perms, fail:{table:{op:error}}, silent:{op:true} (RLS-style zero-row writes), inUse:Set(ids), log:[] } */
export function createFake(cfg) {
  cfg.log ||= [];
  const lookups = { sections: "sections", subsections: "subsections", areas: "areas", activity_kinds: "activity_kinds" };
  function from(table) {
    const st = { op: "select", filters: [], like: null, order: [], range: null, count: false, payload: null, wantRows: false, single: false };
    const decorate = (rows) => rows.map((r) => {
      if (table !== "activities") return r;
      const d = cfg.data;
      return { ...r, sections: { section_name: d.sections.find((x) => x.id == r.section_id)?.section_name },
        subsections: { subsection_name: d.subsections.find((x) => x.id == r.sub_section_id)?.subsection_name },
        areas: { area_name: d.areas.find((x) => x.id == r.area_id)?.area_name },
        activity_kinds: d.activity_kinds.find((x) => x.id == r.kind_id) ? { name: d.activity_kinds.find((x) => x.id == r.kind_id).name, short_code: "" } : null };
    });
    async function run() {
      if (cfg.delayMs && st.op === "select" && table === "activities") await new Promise((r) => setTimeout(r, cfg.delayMs));
      cfg.log.push({ table, op: st.op, filters: st.filters.slice(), like: st.like, range: st.range, payload: st.payload });
      const failure = cfg.fail?.[table]?.[st.op];
      if (failure) return typeof failure === "function" ? failure(st) : { data: null, error: failure };
      const rows = cfg.data[table];
      let m = rows.filter((r) => st.filters.every(([c, v]) => String(r[c]) === String(v)));
      if (st.like) m = m.filter((r) => likeRe(st.like[1]).test(String(r[st.like[0]])));
      if (st.op === "insert") {
        const dup = cfg.data.activities.find((a) => a.activity_name.toLowerCase() === String(st.payload[0].activity_name).toLowerCase());
        if (dup) return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
        if (cfg.perms?.edit === false || cfg.denyWrites) return { data: null, error: { code: "42501", message: "new row violates row-level security policy" } };
        const row = { id: Math.max(0, ...rows.map((r) => r.id)) + 1, ...st.payload[0] };
        rows.push(row);
        return { data: st.single ? { id: row.id } : [{ id: row.id }], error: null };
      }
      if (st.op === "update" || st.op === "delete") {
        if (cfg.silent?.[st.op]) return { data: [], error: null };
        if (st.op === "delete") {
          if (m.some((r) => (cfg.inUse ? [...cfg.inUse] : []).includes(r.id))) return { data: null, error: { code: "23503", message: "violates foreign key constraint" } };
          cfg.data[table] = rows.filter((r) => !m.includes(r));
        } else m.forEach((r) => Object.assign(r, st.payload));
        return { data: m.map((r) => ({ id: r.id })), error: null };
      }
      for (const [c, asc] of [...st.order].reverse()) m = m.slice().sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1));
      const total = m.length;
      if (st.range) m = m.slice(st.range[0], st.range[1] + 1);
      return { data: decorate(m), error: null, count: st.count ? total : null };
    }
    const q = {
      select(_c, o) { if (st.op !== "select") st.wantRows = true; else if (o?.count) st.count = true; return q; },
      insert(p) { st.op = "insert"; st.payload = p; return q; },
      update(p) { st.op = "update"; st.payload = p; return q; },
      delete() { st.op = "delete"; return q; },
      eq(c, v) { st.filters.push([c, v]); return q; },
      ilike(c, p) { st.like = [c, p]; return q; },
      order(c, o) { st.order.push([c, o?.ascending !== false]); return q; },
      range(a, b) { st.range = [a, b]; return q; },
      maybeSingle() { st.single = true; return q; },
      then(res, rej) { return run().then(res, rej); },
    };
    return q;
  }
  return {
    from,
    rpc: async (name) => (name === "get_user_permissions" ? (cfg.rpcError ? { data: null, error: { message: "rpc down" } } : { data: cfg.perms.list, error: null }) : { data: [], error: null }),
    auth: { getSession: async () => ({ data: { session: { access_token: "x", user: { id: "u-1", email: "t@example.invalid" } } } }), getUser: async () => ({ data: { user: { id: "u-1" } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    schema() { return this; },
  };
}
export const permList = (view, edit) => (view ? [{ target: "module:manage-activities", can_view: true, can_edit: edit }] : []);
