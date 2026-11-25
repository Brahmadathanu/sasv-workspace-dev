// Loader for the structured production catalog packet (format "mis-g7-targeted-catalog-v1"): functions, relations, trigger_functions, environment.
// It generates an ISOLATED schema from the captured records (exact function source bytes, owners, ACLs, column privileges, role attributes,
// memberships, RLS, constraints, indexes, triggers, policies, sequences, enums). Nothing here touches production; the packet is local-only and is
// never printed or committed. Anything that cannot be reproduced is returned in `report.unsupported` / `report.errors` -- never silently dropped.
import fs from 'node:fs';

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const id = (s) => `"${String(s).replace(/"/g, '""')}"`;
const qn = (schema, name) => `${id(schema)}.${id(name)}`;
const PRIV = {
  table: { r: 'SELECT', w: 'UPDATE', a: 'INSERT', d: 'DELETE', D: 'TRUNCATE', x: 'REFERENCES', t: 'TRIGGER', m: 'MAINTAIN' },
  sequence: { r: 'SELECT', w: 'UPDATE', U: 'USAGE' },
  schema: { U: 'USAGE', C: 'CREATE' },
  function: { X: 'EXECUTE' },
  column: { r: 'SELECT', a: 'INSERT', w: 'UPDATE', x: 'REFERENCES' },
};
const sortedAcl = (items) => [...(items ?? [])].sort().join(',');

// canonical form for conflict detection between packets: object keys sorted, arrays of strings sorted
const canon = (v) => (Array.isArray(v) ? (v.every((x) => typeof x === 'string') ? [...v].sort() : v.map(canon)) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
// Merge a supplementary packet into the base (by identity). Identical duplicates collapse; a CONFLICTING duplicate is an error (never silently resolved).
function mergeSupplement(p, sup) {
  if (!/supplement/.test(sup.format ?? '')) throw new Error('not a supplement packet');
  const rk = (r) => `${r.schema}.${r.name}`;
  for (const r of sup.relations ?? []) for (const k of ['columns', 'constraints', 'indexes', 'triggers', 'policies']) r[k] = r[k] ?? [];
  p.relations = p.relations.map((r) => r);
  const byKey = new Map(p.relations.map((r) => [rk(r), r]));
  const dupRel = [];
  for (const r of sup.relations ?? []) {
    const prev = byKey.get(rk(r));
    if (!prev) { p.relations.push(r); byKey.set(rk(r), r); continue; }
    dupRel.push(rk(r));
    // a supplementary capture of an already captured relation may only ADD policies/triggers/etc. -- compare the shared structural fields
    for (const k of ['owner', 'acl', 'rls', 'force_rls', 'columns', 'constraints', 'indexes', 'triggers'])
      if (!same(prev[k], r[k])) throw new Error(`conflicting duplicate relation record ${rk(r)} (${k})`);
    const pol = new Set(prev.policies.map((x) => x.policyname));
    for (const x of r.policies) if (!pol.has(x.policyname)) prev.policies.push(x); else if (!same(prev.policies.find((y) => y.policyname === x.policyname), x)) throw new Error(`conflicting policy ${rk(r)}.${x.policyname}`);
  }
  p.functions = [...p.functions, ...(sup.functions ?? [])];
  p.trigger_functions = [...p.trigger_functions, ...(sup.trigger_functions ?? [])];
  const env = p.environment; const se = sup.environment ?? {};
  for (const r of se.roles ?? []) { const prev = env.roles.find((x) => x.rolname === r.rolname); if (!prev) env.roles.push(r); else if (!same(prev, r)) throw new Error(`conflicting role ${r.rolname}`); }
  env.memberships.push(...(se.memberships ?? []).filter((m) => !env.memberships.some((x) => same(x, m))));
  for (const s of se.sequences ?? []) { const prev = env.sequences.find((x) => x.schema === s.schema && x.name === s.name); if (!prev) env.sequences.push(s); else if (!same(prev, s)) throw new Error(`conflicting sequence ${s.schema}.${s.name}`); }
  p.views = [...(p.views ?? []), ...(sup.views ?? [])];
  p.live_state = [...(p.live_state ?? []), ...(sup.live_state ?? [])];
  p.mergeInfo = { duplicateRelations: dupRel };
}

export function readStructuredPacket(file, supplementFile) {
  const raw = fs.readFileSync(file, 'utf8');
  const p = JSON.parse(raw);
  for (const k of ['format', 'functions', 'relations', 'trigger_functions', 'environment']) if (!(k in p)) throw new Error(`packet missing ${k}`);
  for (const r of p.relations) for (const k of ['columns', 'constraints', 'indexes', 'triggers', 'policies']) r[k] = r[k] ?? [];
  if (supplementFile) mergeSupplement(p, JSON.parse(fs.readFileSync(supplementFile, 'utf8')));
  // deduplicate functions + trigger functions by identity; a conflicting duplicate (different fingerprint/owner/ACL/config) is an ERROR
  const fns = new Map();
  for (const f of [...p.functions, ...p.trigger_functions]) {
    const prev = fns.get(f.identity);
    if (!prev) { fns.set(f.identity, f); continue; }
    if (prev.sha256 !== f.sha256 || prev.owner !== f.owner || prev.secdef !== f.secdef || sortedAcl(prev.acl) !== sortedAcl(f.acl) || JSON.stringify(prev.config ?? null) !== JSON.stringify(f.config ?? null))
      throw new Error(`conflicting duplicate function record: ${f.identity}`);
  }
  return { raw, p, functions: [...fns.values()], duplicates: p.functions.length + p.trigger_functions.length - fns.size };
}

function aclGrantSql(kind, objSql, items, owner, known, serverMajor) {
  const out = []; const notes = [];
  out.push(`REVOKE ALL ON ${kind === 'function' ? 'FUNCTION' : kind.toUpperCase()} ${objSql} FROM PUBLIC;`);
  for (const r of known) out.push(`REVOKE ALL ON ${kind === 'function' ? 'FUNCTION' : kind.toUpperCase()} ${objSql} FROM ${id(r)};`);
  for (const it of items) {
    const m = /^([^=]*)=([^/]*)\/(.*)$/.exec(it); if (!m) { notes.push(`unparseable ACL item ${it}`); continue; }
    const [, grantee, letters, grantor] = m;
    if (grantor !== owner) notes.push(`ACL grantor ${grantor} != owner ${owner} on ${objSql} (grantor recorded as owner after replay)`);
    const privs = []; let grant = false;
    for (let i = 0; i < letters.length; i++) { const c = letters[i]; if (c === '*') { grant = true; continue; } const n = PRIV[kind][c]; if (n === 'MAINTAIN' && serverMajor < 17) { notes.push(`MAINTAIN privilege not available on PostgreSQL ${serverMajor}: omitted on ${objSql}`); continue; } if (n) privs.push(n); else notes.push(`unknown ${kind} privilege '${c}' on ${objSql}`); }
    if (!privs.length) continue;
    out.push(`GRANT ${privs.join(', ')} ON ${kind === 'function' ? 'FUNCTION' : kind.toUpperCase()} ${objSql} TO ${grantee === '' ? 'PUBLIC' : id(grantee)}${grant ? ' WITH GRANT OPTION' : ''};`);
  }
  return { sql: out, notes };
}

export function loadStructuredPacket(pg, db, file, { serverMajor = 16, supplement } = {}) {
  const { p, functions, duplicates } = readStructuredPacket(file, supplement);
  const env = p.environment;
  const report = { errors: [], unsupported: [], notes: [], counts: { functions: functions.length, duplicates, relations: p.relations.length } };
  const run = (sql, label, { strict = false } = {}) => {
    const r = pg.psql(db, `SET check_function_bodies = off;\nSET search_path = public, extensions;\n${sql}`, { noStop: true });
    const errs = (r.err.match(/^ERROR:[^\n]*(?:\n(?:DETAIL|HINT|CONTEXT|STATEMENT|QUERY)[^\n]*)*/gm) ?? []).map((e) => `${label}: ${e.split('\n')[0]}`);
    if (strict && errs.length) throw new Error(errs.join('; '));
    report.errors.push(...errs); return r;
  };
  const roleNames = env.roles.map((r) => r.rolname);
  const refRoles = new Set();
  const grab = (items) => { for (const it of items ?? []) { const m = /^([^=]*)=[^/]*\/(.*)$/.exec(it); if (m) { if (m[1]) refRoles.add(m[1]); refRoles.add(m[2]); } } };
  for (const f of functions) { grab(f.acl); refRoles.add(f.owner); }
  for (const r of p.relations) { grab(r.acl); refRoles.add(r.owner); for (const c of r.columns) grab(c.acl); for (const po of r.policies) for (const x of po.roles ?? []) refRoles.add(x); }
  for (const v of p.views ?? []) { grab(v.acl); refRoles.add(v.owner); }
  for (const s of env.schemas) { grab(s.acl); refRoles.add(s.owner); }
  for (const s of env.sequences) { grab(s.acl); refRoles.add(s.owner); }
  report.missingRoles = [...refRoles].filter((r) => r && r !== 'public' && !r.startsWith('pg_') && !roleNames.includes(r)).sort();
  for (const r of report.missingRoles) run(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=${q(r)}) THEN CREATE ROLE ${id(r)} NOLOGIN; END IF; END $$;`, `missing role ${r}`);

  const known = [...roleNames, ...(report.missingRoles ?? [])].filter((r) => r !== 'postgres');
  // ---- roles (attributes, no passwords) + memberships
  for (const r of env.roles) {
    if (r.rolname === 'postgres') continue;
    const attrs = [r.rolsuper ? 'SUPERUSER' : 'NOSUPERUSER', r.rolinherit ? 'INHERIT' : 'NOINHERIT', r.rolcreaterole ? 'CREATEROLE' : 'NOCREATEROLE', r.rolcreatedb ? 'CREATEDB' : 'NOCREATEDB',
      r.rolcanlogin ? 'LOGIN' : 'NOLOGIN', r.rolreplication ? 'REPLICATION' : 'NOREPLICATION', r.rolbypassrls ? 'BYPASSRLS' : 'NOBYPASSRLS'].join(' ');
    run(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=${q(r.rolname)}) THEN CREATE ROLE ${id(r.rolname)}; END IF; END $$; ALTER ROLE ${id(r.rolname)} ${attrs};`, `role ${r.rolname}`, { strict: true });
  }
  for (const m of env.memberships) {
    const opts = [`ADMIN ${m.admin_option ? 'TRUE' : 'FALSE'}`, `INHERIT ${m.inherit_option ? 'TRUE' : 'FALSE'}`, `SET ${m.set_option ? 'TRUE' : 'FALSE'}`].join(', ');
    if (m.member === 'postgres' || m.role === 'postgres') { report.notes.push(`membership ${m.member}->${m.role} on the local superuser: skipped`); continue; }
    run(serverMajor >= 16 ? `GRANT ${id(m.role)} TO ${id(m.member)} WITH ${opts};` : `GRANT ${id(m.role)} TO ${id(m.member)};`, `membership ${m.member}->${m.role}`);
  }
  // ---- extensions: reproduce what exists locally; list the rest (and whether any captured object text references them)
  const avail = new Set(pg.psql(db, 'SELECT name FROM pg_available_extensions').out.split('\n'));
  const allText = JSON.stringify([p.functions, p.trigger_functions, p.relations]);
  for (const s of env.schemas) if (s.nspname !== 'public') run(`CREATE SCHEMA IF NOT EXISTS ${id(s.nspname)};`, `schema ${s.nspname}`, { strict: true });
  for (const e of env.extensions) {
    if (e.extname === 'plpgsql') continue;
    if (avail.has(e.extname)) run(`CREATE EXTENSION IF NOT EXISTS ${id(e.extname)} WITH SCHEMA ${id(e.schema)};`, `extension ${e.extname}`);
    else {
      const token = { pg_cron: /\bcron\./, pg_net: /\bnet\./, supabase_vault: /\bvault\./, hypopg: /hypopg/i, index_advisor: /index_advisor/i }[e.extname];
      report.unsupported.push({ extension: e.extname, schema: e.schema, version: e.extversion, referencedByCapturedObjects: token ? token.test(allText) : 'unknown' });
    }
  }
  // ---- enums, non-identity sequences
  for (const e of env.enums) {
    const labels = Array.isArray(e.labels) ? e.labels : String(e.labels).replace(/^\{|\}$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''));
    run(`CREATE TYPE ${qn(e.schema, e.name)} AS ENUM (${labels.map(q).join(', ')});`, `enum ${e.name}`);
  }
  const identityCols = new Set();
  for (const r of p.relations) for (const c of r.columns) if (c.identity) identityCols.add(`${r.schema}.${r.name}.${c.name}`);
  // packet sequence record: owned_by = [schema.]table, owned_column = column
  const ownerOf = (s) => { if (!s.owned_by || !s.owned_column) return null; const t = s.owned_by.replace(/"/g, ''); const [a, b] = t.includes('.') ? t.split('.') : [s.schema, t]; return { schema: a, table: b, column: s.owned_column }; };
  for (const s of env.sequences) {
    const o = ownerOf(s); const key = o ? `${o.schema}.${o.table}.${o.column}` : '';
    if (key && identityCols.has(key)) continue;                                  // created by the identity column itself
    run(`CREATE SEQUENCE ${qn(s.schema, s.name)} AS ${s.type} START WITH ${s.seqstart} INCREMENT BY ${s.seqincrement} MINVALUE ${s.seqmin} MAXVALUE ${s.seqmax} CACHE ${s.seqcache} ${s.seqcycle ? '' : 'NO '}CYCLE;`, `sequence ${s.name}`);
  }
  // ---- tables: columns only (defaults/constraints later, after the functions they may call exist)
  const rels = p.relations;
  const seqOf = (schema, table, col) => env.sequences.find((s) => { const o = ownerOf(s); return o && o.schema === schema && o.table === table && o.column === col; });
  for (const r of rels) {
    const cols = r.columns.map((c) => {
      let d = `${id(c.name)} ${c.type}`;
      if (c.generated === 's') d += ` GENERATED ALWAYS AS (${c.default}) STORED`;
      else if (c.identity) {
        const s = seqOf(r.schema, r.name, c.name);
        d += ` GENERATED ${c.identity === 'a' ? 'ALWAYS' : 'BY DEFAULT'} AS IDENTITY` + (s ? ` (SEQUENCE NAME ${qn(s.schema, s.name)} START WITH ${s.seqstart} INCREMENT BY ${s.seqincrement} MINVALUE ${s.seqmin} MAXVALUE ${s.seqmax} CACHE ${s.seqcache} ${s.seqcycle ? '' : 'NO '}CYCLE)` : '');
      }
      if (c.not_null) d += ' NOT NULL';
      return d;
    });
    run(`CREATE TABLE ${qn(r.schema, r.name)} (\n  ${cols.join(',\n  ')}\n);`, `table ${r.schema}.${r.name}`);
  }
  // ---- functions: exact definition bytes, deduplicated; repeated passes until every one that can compile has
  let pending = [...functions]; let guard = 0;
  while (pending.length && guard++ < 6) {
    const next = [];
    for (const f of pending) {
      const r = pg.psql(db, `SET check_function_bodies = off;\nSET search_path = public, extensions;\n${f.def}`, { noStop: true });
      if (/^ERROR:/m.test(r.err)) next.push({ f, err: (r.err.match(/^ERROR:[^\n]*/m) ?? [''])[0] });
    }
    if (next.length === pending.length) { for (const n of next) report.errors.push(`function ${n.f.identity}: ${n.err}`); break; }
    pending = next.map((n) => n.f);
  }
  // ---- defaults, constraints (PK/UNIQUE/CHECK/EXCLUDE first, FK last), indexes
  for (const r of rels) for (const c of r.columns) if (c.default && c.generated !== 's' && !c.identity) run(`ALTER TABLE ${qn(r.schema, r.name)} ALTER COLUMN ${id(c.name)} SET DEFAULT ${c.default};`, `default ${r.name}.${c.name}`);
  const conOrder = (c) => (/^(PRIMARY KEY|UNIQUE)/.test(c.definition) ? 0 : /^FOREIGN KEY/.test(c.definition) ? 2 : 1);
  for (let pass = 0; pass <= 2; pass++) for (const r of rels) for (const c of r.constraints.filter((x) => conOrder(x) === pass))
    run(`ALTER TABLE ONLY ${qn(r.schema, r.name)} ADD CONSTRAINT ${id(c.name)} ${c.definition}${c.validated === false ? ' NOT VALID' : ''};`, `constraint ${r.name}.${c.name}`);
  for (const r of rels) for (const ix of r.indexes) {
    const m = /CREATE (?:UNIQUE )?INDEX (\S+) ON/.exec(ix); const nm = m ? m[1].replace(/"/g, '') : '';
    const ex = pg.psql(db, `SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=${q(r.schema)} AND c.relname=${q(nm)}`).out;
    if (!ex) run(`${ix};`, `index ${nm}`);
  }
  // ---- sequence ownership, triggers (+ enabled state), RLS, policies, reloptions
  for (const s of env.sequences) { const o = ownerOf(s); if (o && !identityCols.has(`${o.schema}.${o.table}.${o.column}`)) run(`ALTER SEQUENCE ${qn(s.schema, s.name)} OWNED BY ${qn(o.schema, o.table)}.${id(o.column)};`, `owned by ${s.name}`); }
  for (const r of rels) for (const t of r.triggers) {
    run(`${t.definition};`, `trigger ${r.name}.${t.name}`);
    const st = { O: null, D: 'DISABLE', R: 'ENABLE REPLICA', A: 'ENABLE ALWAYS' }[t.enabled];
    if (st) run(`ALTER TABLE ${qn(r.schema, r.name)} ${st} TRIGGER ${id(t.name)};`, `trigger state ${t.name}`);
  }
  for (const r of rels) {
    if (r.rls) run(`ALTER TABLE ${qn(r.schema, r.name)} ENABLE ROW LEVEL SECURITY;`, `rls ${r.name}`);
    if (r.force_rls) run(`ALTER TABLE ${qn(r.schema, r.name)} FORCE ROW LEVEL SECURITY;`, `force rls ${r.name}`);
    for (const po of r.policies ?? []) run(`CREATE POLICY ${id(po.policyname)} ON ${qn(r.schema, r.name)} AS ${po.permissive} FOR ${po.cmd} TO ${(po.roles ?? []).map((x) => (x === 'public' ? 'PUBLIC' : id(x))).join(', ') || 'PUBLIC'}${po.qual ? ` USING (${po.qual})` : ''}${po.with_check ? ` WITH CHECK (${po.with_check})` : ''};`, `policy ${po.policyname}`);
    if (r.reloptions) run(`ALTER TABLE ${qn(r.schema, r.name)} SET (${r.reloptions.join(', ')});`, `reloptions ${r.name}`);
  }
  // ---- views (supplement): created from the captured definition after tables/functions exist
  for (const v of p.views ?? []) { run(`CREATE VIEW ${qn(v.schema, v.name)}${v.reloptions ? ` WITH (${v.reloptions.join(', ')})` : ''} AS ${v.def.replace(/;\s*$/, '')};`, `view ${v.schema}.${v.name}`); }
  // ---- owners, then ACLs (table, column, sequence, schema, function) so that grants are recorded against the final owner
  for (const s of env.schemas) if (s.nspname !== 'public') run(`ALTER SCHEMA ${id(s.nspname)} OWNER TO ${id(s.owner)};`, `schema owner ${s.nspname}`);
  for (const r of rels) run(`ALTER TABLE ${qn(r.schema, r.name)} OWNER TO ${id(r.owner)};`, `owner ${r.name}`);
  for (const s of env.sequences) run(`ALTER SEQUENCE ${qn(s.schema, s.name)} OWNER TO ${id(s.owner)};`, `owner seq ${s.name}`);
  for (const f of functions) run(`ALTER FUNCTION ${f.identity} OWNER TO ${id(f.owner)};`, `function owner ${f.identity}`);
  const applyAcl = (kind, obj, items, owner) => { if (!items) return; const { sql, notes } = aclGrantSql(kind, obj, items, owner, known, serverMajor); report.notes.push(...notes); run(sql.join('\n'), `acl ${obj}`); };
  for (const s of env.schemas) applyAcl('schema', id(s.nspname), s.acl, s.owner);
  for (const r of rels) {
    applyAcl('table', qn(r.schema, r.name), r.acl, r.owner);
    for (const c of r.columns) if (c.acl) for (const it of c.acl) {
      const m = /^([^=]*)=([^/]*)\/(.*)$/.exec(it); if (!m) continue; const privs = [...m[2]].filter((ch) => PRIV.column[ch]).map((ch) => PRIV.column[ch]);
      if (m[1] !== r.owner && privs.length) run(`GRANT ${privs.map((x) => `${x} (${id(c.name)})`).join(', ')} ON ${qn(r.schema, r.name)} TO ${m[1] === '' ? 'PUBLIC' : id(m[1])};`, `column acl ${r.name}.${c.name}`);
    }
  }
  for (const v of p.views ?? []) { run(`ALTER VIEW ${qn(v.schema, v.name)} OWNER TO ${id(v.owner)};`, `view owner ${v.name}`); applyAcl('table', qn(v.schema, v.name), v.acl, v.owner); }
  for (const s of env.sequences) applyAcl('sequence', qn(s.schema, s.name), s.acl, s.owner);
  for (const f of functions) if (f.acl) applyAcl('function', f.identity, f.acl, f.owner);
  report.errors = report.errors.filter((e) => !/already exists/i.test(e));
  return { report, packet: p, functions };
}

// ---------------------------------------------------------------- verification of the replayed schema against the packet
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export function verifyRelations(pg, db, p, { serverMajor = 16 } = {}) {
  const diffs = []; const one = (sql) => pg.psql(db, sql).out;
  for (const r of p.relations) {
    const nm = `${r.schema}.${r.name}`; const reg = qn(r.schema, r.name);
    if (one(`SELECT to_regclass(${q(`${r.schema}.${r.name}`)}) IS NOT NULL`) !== 't') { diffs.push(`${nm}: MISSING`); continue; }
    const meta = one(`SELECT pg_get_userbyid(c.relowner)||'|'||c.relrowsecurity||'|'||c.relforcerowsecurity||'|'||coalesce((SELECT string_agg(x::text, ',' ORDER BY x::text) FROM unnest(coalesce(c.relacl, acldefault('r', c.relowner))) x),'') FROM pg_class c WHERE c.oid=${q(`${r.schema}.${r.name}`)}::regclass`).split('|');
    if (meta[0] !== r.owner) diffs.push(`${nm}: owner ${meta[0]} != ${r.owner}`);
    if (meta[1] !== String(!!r.rls)) diffs.push(`${nm}: rls ${meta[1]} != ${r.rls}`);
    if (meta[2] !== String(!!r.force_rls)) diffs.push(`${nm}: force_rls ${meta[2]} != ${r.force_rls}`);
    const wantAcl = r.acl ? sortedAcl(serverMajor < 17 ? r.acl.map((a) => a.replace(/m(?=\/)/, '')) : r.acl) : null;
    if (wantAcl !== null && meta[3] !== wantAcl) diffs.push(`${nm}: table ACL '${meta[3]}' != '${wantAcl}'`);
    const cols = one(`SELECT string_agg(a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull::text||':'||a.attidentity::text||':'||a.attgenerated::text, '|' ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=${q(`${r.schema}.${r.name}`)}::regclass AND a.attnum>0 AND NOT a.attisdropped`);
    const wantCols = r.columns.map((c) => `${c.name}:${c.type}:${!!c.not_null}:${c.identity || ''}:${c.generated || ''}`).join('|');
    if (norm(cols).replace(/extensions\./g, '').replace(/public\./g, '') !== norm(wantCols).replace(/extensions\./g, '').replace(/public\./g, '')) diffs.push(`${nm}: columns differ`);
    for (const c of r.columns) if (c.default && c.generated !== 's' && !c.identity) {
      const d = one(`SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum WHERE d.adrelid=${q(`${r.schema}.${r.name}`)}::regclass AND a.attname=${q(c.name)}`);
      if (norm(d) !== norm(c.default)) diffs.push(`${nm}.${c.name}: default '${norm(d)}' != '${norm(c.default)}'`);
    }
    const cons = one(`SELECT string_agg(conname||' '||pg_get_constraintdef(oid), E'\\x01' ORDER BY conname) FROM pg_constraint WHERE conrelid=${q(`${r.schema}.${r.name}`)}::regclass AND contype IN ('p','u','c','f','x')`).split('\x01').filter(Boolean);
    const wantCons = r.constraints.map((c) => `${c.name} ${c.definition}`).sort();
    if (norm(cons.sort().join('\n')) !== norm(wantCons.join('\n'))) diffs.push(`${nm}: constraints differ`);
    const idx = one(`SELECT string_agg(pg_get_indexdef(i.indexrelid), E'\\x01' ORDER BY pg_get_indexdef(i.indexrelid)) FROM pg_index i WHERE i.indrelid=${q(`${r.schema}.${r.name}`)}::regclass`).split('\x01').filter(Boolean);
    if (norm(idx.sort().join('\n')) !== norm([...r.indexes].sort().join('\n'))) diffs.push(`${nm}: indexes differ`);
    const trg = one(`SELECT string_agg(tgname::text||'/'||tgenabled::text||' '||pg_get_triggerdef(oid), E'\\x01' ORDER BY tgname) FROM pg_trigger WHERE tgrelid=${q(`${r.schema}.${r.name}`)}::regclass AND NOT tgisinternal`).split('\x01').filter(Boolean);
    const wantTrg = r.triggers.map((t) => `${t.name}/${t.enabled} ${t.definition}`).sort();
    if (norm(trg.sort().join('\n')) !== norm(wantTrg.join('\n'))) diffs.push(`${nm}: triggers differ`);
    const pol = one(`SELECT string_agg(polname::text||'|'||polcmd::text||'|'||polpermissive::text||'|'||coalesce(pg_get_expr(polqual,polrelid),'')||'|'||coalesce(pg_get_expr(polwithcheck,polrelid),''), E'\\x01' ORDER BY polname) FROM pg_policy WHERE polrelid=${q(`${r.schema}.${r.name}`)}::regclass`).split('\x01').filter(Boolean);
    if (pol.length !== (r.policies ?? []).length) diffs.push(`${nm}: policy count ${pol.length} != ${(r.policies ?? []).length}`);
    for (const po of r.policies ?? []) {
      const cmd = { ALL: '*', SELECT: 'r', INSERT: 'a', UPDATE: 'w', DELETE: 'd' }[po.cmd];
      const got = pol.find((x) => x.startsWith(`${po.policyname}|`)); if (!got) { diffs.push(`${nm}: policy ${po.policyname} missing`); continue; }
      const [, gcmd, gperm, gq, gc] = got.split('|');
      if (gcmd !== cmd || (gperm === 'true') !== (po.permissive === 'PERMISSIVE') || norm(gq) !== norm(po.qual) || norm(gc) !== norm(po.with_check)) diffs.push(`${nm}: policy ${po.policyname} differs`);
    }
    for (const c of r.columns) if (c.acl) {
      const got = one(`SELECT coalesce((SELECT string_agg(x::text, ',' ORDER BY x::text) FROM unnest(a.attacl) x),'') FROM pg_attribute a WHERE a.attrelid=${q(`${r.schema}.${r.name}`)}::regclass AND a.attname=${q(c.name)}`);
      if (got !== sortedAcl(c.acl)) diffs.push(`${nm}.${c.name}: column ACL '${got}' != '${sortedAcl(c.acl)}'`);
    }
  }
  return diffs;
}
export function verifyEnvironment(pg, db, p) {
  const diffs = []; const one = (sql) => pg.psql(db, sql).out; const env = p.environment;
  for (const r of env.roles) if (r.rolname !== 'postgres') {
    const got = one(`SELECT rolsuper||'|'||rolinherit||'|'||rolcreaterole||'|'||rolcreatedb||'|'||rolcanlogin||'|'||rolreplication||'|'||rolbypassrls FROM pg_roles WHERE rolname=${q(r.rolname)}`);
    const want = [r.rolsuper, r.rolinherit, r.rolcreaterole, r.rolcreatedb, r.rolcanlogin, r.rolreplication, r.rolbypassrls].join('|');
    if (got !== want) diffs.push(`role ${r.rolname}: ${got} != ${want}`);
  }
  for (const m of env.memberships) if (m.member !== 'postgres' && m.role !== 'postgres') {
    const got = one(`SELECT admin_option||'|'||inherit_option||'|'||set_option FROM pg_auth_members am JOIN pg_roles r ON r.oid=am.roleid JOIN pg_roles mm ON mm.oid=am.member WHERE r.rolname=${q(m.role)} AND mm.rolname=${q(m.member)}`);
    if (!got) diffs.push(`membership ${m.member}->${m.role} missing`);
  }
  for (const e of env.enums) {
    const got = one(`SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid=${q(`${e.schema}.${e.name}`)}::regtype`);
    const want = Array.isArray(e.labels) ? e.labels.join(',') : String(e.labels).replace(/^\{|\}$/g, '');
    if (got !== want) diffs.push(`enum ${e.name}: '${got}' != '${want}'`);
  }
  for (const s of env.schemas) { const got = one(`SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname=${q(s.nspname)}`); if (got !== s.owner && s.nspname !== 'public') diffs.push(`schema ${s.nspname}: owner ${got} != ${s.owner}`); }
  for (const s of env.sequences) { const got = one(`SELECT pg_get_userbyid(c.relowner) FROM pg_class c WHERE c.oid=${q(`${s.schema}.${s.name}`)}::regclass`); if (got !== s.owner) diffs.push(`sequence ${s.name}: owner ${got} != ${s.owner}`); }
  return diffs;
}

// Function-call tokens in captured definitions/policies/constraints/defaults that resolve to NOTHING in the loaded database (neither a captured nor a built-in
// function, relation or type). These are live catalog objects the packet does not contain and must be extracted -- reported, never stubbed or dropped.
const SQL_WORDS = ['select','exists','any','all','array','in','values','and','or','not','case','when','then','else','end','from','where','join','on','as','by','set','with','over','filter','group','order','limit','offset','having','union','insert','update','delete','into','returning','using','row','cast','between','like','ilike','is','null','true','false','distinct','current_date','coalesce','nullif','trim','gist','only','rows','n','batch','delta','flag','negative','if','elsif','loop','for','while','raise','perform','return','begin','declare','exception','notice','warning','create','replace','function','trigger','table','index','unique','primary','key','references','check','default','constraint','returns','language','security','definer','invoker','execute','procedure','each','statement','before','after','instead','of','or','and','new','old','tg_op','found'];
export function findMissingDependencies(pg, db, p, functions) {
  const text = JSON.stringify([p.relations.map((r) => [r.policies, r.constraints, r.columns.map((c) => c.default)]), functions.map((f) => f.def.replace(/\$[a-z_]*\$/g, ' '))]);
  const calls = [...new Set([...text.matchAll(/\b([a-z_][a-z0-9_]*)\s*\(/g)].map((m) => m[1]))].filter((c) => !SQL_WORDS.includes(c));
  const out = pg.psql(db, `SELECT n FROM unnest(ARRAY[${calls.map(q).join(',')}]::text[]) n WHERE NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = n) AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = n)
     AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = n) AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = n) ORDER BY n`).out;
  return out ? out.split('\n') : [];
}
