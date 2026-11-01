// Offline stand-in for https://esm.sh/@supabase/supabase-js@2 (screenshots only).
// Serves fixture rows from window.__UXF1_FIXTURES; never touches the network.
const F = () => window.__UXF1_FIXTURES || {};
function resolve(view, q) {
  const fx = F();
  let rows = typeof fx.views?.[view] === "function" ? fx.views[view](q) : fx.views?.[view] ?? [];
  if (!Array.isArray(rows)) rows = rows ? [rows] : [];
  for (const [k, v] of q.eq) rows = rows.filter((r) => !(k in r) || String(r[k]) === String(v));
  if (q.orderDesc && q.orderKey) rows = [...rows].sort((a, b) => (String(a[q.orderKey]) < String(b[q.orderKey]) ? 1 : -1));
  if (q.range) rows = rows.slice(q.range[0], q.range[1] + 1);
  if (q.limit != null) rows = rows.slice(0, q.limit);
  (window.__UXF1_READS ||= []).push({ view, eq: q.eq, select: q.select });
  if (q.mode === "single") return { data: rows[0] ?? null, error: null };
  return { data: rows, error: null, count: rows.length };
}
function builder(view) {
  const q = { eq: [], select: null, range: null, limit: null, mode: "many", orderKey: null, orderDesc: false };
  const b = {
    select(c) { q.select = c; return b; },
    eq(k, v) { q.eq.push([k, v]); return b; },
    order(k, o) { if (!q.orderKey) { q.orderKey = k; q.orderDesc = o?.ascending === false; } return b; },
    range(a, z) { q.range = [a, z]; return b; },
    limit(n) { q.limit = n; return b; },
    maybeSingle() { q.mode = "single"; return b; },
    single() { q.mode = "single"; return b; },
    then(onF, onR) { return Promise.resolve(resolve(view, q)).then(onF, onR); },
  };
  for (const m of ["neq", "in", "is", "gt", "gte", "lt", "lte", "ilike", "like", "or", "not", "filter", "match", "contains", "overlaps", "textSearch", "abortSignal", "csv", "returns"]) b[m] = () => b;
  return b;
}
const user = { id: "00000000-0000-0000-0000-000000000001", email: "owner@example.test" };
const client = {
  from: (view) => builder(view),
  rpc: async (name) => {
    (window.__UXF1_READS ||= []).push({ rpc: name });
    if (name === "get_user_permissions") return { data: F().permissions || [], error: null };
    return { data: null, error: null };
  },
  schema: () => client,
  channel: () => ({ on() { return this; }, subscribe() { return this; }, unsubscribe() {} }),
  removeChannel: () => {},
  storage: { from: () => ({ download: async () => ({ data: null, error: null }) }) },
  auth: {
    refreshSession: async () => ({ data: { session: { user } }, error: null }),
    getSession: async () => ({ data: { session: { user } }, error: null }),
    getUser: async () => ({ data: { user }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
  },
};
export function createClient() { return client; }
export default { createClient };
