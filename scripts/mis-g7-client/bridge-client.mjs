// Browser-side Supabase stand-in for the real-isolated-server tests: same surface the pages use (from().select().eq().in().order().range(),
// rpc(), auth.getSession()), every call forwarded to https://bridge.test/call (intercepted by Playwright and executed on PostgreSQL).
async function call(req) {
  const res = await fetch('https://bridge.test/call', { method: 'POST', body: JSON.stringify(req, (_, v) => (typeof v === 'bigint' ? v.toString() : v)) });
  return res.json();
}
export function createBridgeClient() {
  const client = {
    schema: () => client,
    auth: { getSession: async () => ({ data: { session: { user: { id: window.__uid } } } }) },
    rpc: async (name, args) => call({ kind: 'rpc', name, args: args || {} }),
    from(table) {
      const req = { kind: 'select', table, cols: '*', filters: [], order: [], range: null, limit: null, single: false };
      const lenient = (r) => (window.__lenient && r.error && ['42P01', '42703', '42883'].includes(r.error.code) ? { data: [], error: null } : r);   // legacy pages query many tables the fixture does not model
      const run = () => call(req).then(lenient).then((r) => (req.single ? (r.data?.length ? { data: r.data[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows' } }) : r));
      const q = new Proxy({
        select(c) { req.cols = c || '*'; return q; },
        eq(col, val) { req.filters.push({ op: 'eq', col, val }); return q; },
        in(col, val) { req.filters.push({ op: 'in', col, val }); return q; },
        order(col, o = {}) { req.order.push({ col, asc: o.ascending !== false }); return q; },
        range(a, b) { req.range = [a, b]; return q; },
        limit(n) { req.limit = n; return q; },
        single() { req.single = true; return q; },
        maybeSingle() { req.single = true; return q.then ? q : q; },
        then(res, rej) { return run().then(res, rej); },
      }, { get(t, k) { return k in t ? t[k] : (typeof k === 'string' ? (() => q) : undefined); } });   // unknown filter methods (ilike, gte, or, not, …) are accepted and ignored in the test client
      return q;
    },
  };
  return client;
}
