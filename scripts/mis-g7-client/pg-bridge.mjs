// Node side of the "real isolated server" bridge: executes the client's RPC / table-select calls against the isolated PostgreSQL
// (S2–S6 + real Costing route engine + S7) as the `authenticated` role with the caller's JWT subject. Test fixture only.
const IDENT = /^[a-z_][a-z0-9_]*$/;
const TABLES = new Set(['products', 'bmr_details', 'fg_bulk_stock', 'product_skus', 'daily_work_log', 'packaging_events', 'event_type_lkp', 'event_skus']);
const lit = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string') return `$q$${v}$q$`;
  return `$q$${JSON.stringify(v)}$q$::jsonb`;
};
function parseError(err) {
  const m = /ERROR:\s+([0-9A-Z]{5}):\s+([\s\S]*?)(?:\n(?:LOCATION|CONTEXT|DETAIL|HINT):|$)/.exec(err) || [];
  return { code: m[1] || '', message: (m[2] || err).trim() };
}
export function createBridge(pg, db, getUid) {
  const calls = [];
  const run = (sql) => pg.psql(db, `\\set VERBOSITY verbose\n${sql}`, { uid: getUid() });
  return {
    calls,
    handle(req) {
      calls.push(req);
      if (req.kind === 'rpc') {
        if (req.name === 'app_has_permission') {   // stand-in for the canonical permission function (view/edit semantics of require_permission)
          const r = run(`SELECT EXISTS (SELECT 1 FROM public.test_perm WHERE uid = auth.uid() AND target = ${lit(req.args.p_target)} AND can_view AND (${req.args.p_mode === 'edit' ? 'can_edit' : 'true'}))`);
          return { data: r.out.split('\n').pop() === 't', error: null };
        }
        if (!IDENT.test(req.name)) return { data: null, error: { code: '42883', message: 'bad function name' } };
        const args = Object.entries(req.args || {}).map(([k, v]) => { if (!IDENT.test(k)) throw new Error('bad arg'); return `${k} := ${lit(v)}`; }).join(', ');
        const r = run(`SELECT public.${req.name}(${args})`);
        if (r.status !== 0) {
          const e = parseError(r.err);
          if (/does not exist/.test(e.message)) return { data: null, error: { code: '42883', message: e.message } };
          return { data: null, error: e };
        }
        const line = r.out.split('\n').filter(Boolean).pop();
        return { data: line === undefined || line === '' ? null : JSON.parse(line), error: null };
      }
      if (req.kind === 'select') {
        if (!TABLES.has(req.table)) return { data: null, error: { code: '42P01', message: `table ${req.table} not exposed` } };
        const cols = req.cols === '*' || !req.cols ? '*' : req.cols.split(',').map((c) => { if (!IDENT.test(c.trim())) throw new Error('bad column'); return c.trim(); }).join(',');
        const where = (req.filters || []).map((f) => { if (!IDENT.test(f.col)) throw new Error('bad col'); return f.op === 'in' ? `${f.col} IN (${f.val.map(lit).join(',') || 'NULL'})` : `${f.col} = ${lit(f.val)}`; });
        const order = (req.order || []).map((o) => `${o.col} ${o.asc ? 'ASC' : 'DESC'}`);
        const lim = req.range ? ` LIMIT ${req.range[1] - req.range[0] + 1} OFFSET ${req.range[0]}` : '';
        const r = run(`SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM (SELECT ${cols} FROM public.${req.table}${where.length ? ' WHERE ' + where.join(' AND ') : ''}${order.length ? ' ORDER BY ' + order.join(',') : ''}${lim}) t`);
        if (r.status !== 0) return { data: null, error: parseError(r.err) };
        return { data: JSON.parse(r.out.split('\n').pop()), error: null };
      }
      return { data: null, error: { code: 'XX000', message: 'unknown request' } };
    },
  };
}
