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
      const req = { kind: 'select', table, cols: '*', filters: [], order: [], range: null };
      const q = {
        select(c) { req.cols = c || '*'; return q; },
        eq(col, val) { req.filters.push({ op: 'eq', col, val }); return q; },
        in(col, val) { req.filters.push({ op: 'in', col, val }); return q; },
        order(col, o = {}) { req.order.push({ col, asc: o.ascending !== false }); return q; },
        range(a, b) { req.range = [a, b]; return q; },
        then(res, rej) { return call(req).then(res, rej); },
      };
      return q;
    },
  };
  return client;
}
