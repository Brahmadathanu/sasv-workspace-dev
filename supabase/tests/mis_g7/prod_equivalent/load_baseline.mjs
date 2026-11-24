// Loads a captured production baseline packet (catalog.json + 10_schema.sql) into a FRESH ephemeral database so S3..S5b can be exercised against the
// ACTUAL captured schema/functions (no shim). Nothing here touches production. The packet itself is local-only and never committed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const KNOWN_EXT = ['citext', 'pg_trgm', 'pgcrypto', 'uuid-ossp', 'btree_gin', 'btree_gist', 'unaccent', 'hstore', 'ltree'];
const sha = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');

export function readPacket(dir) {
  const cat = JSON.parse(fs.readFileSync(path.join(dir, 'catalog.json'), 'utf8'));
  const schema = fs.readFileSync(path.join(dir, '10_schema.sql'), 'utf8');
  return { cat, schema };
}

// Roles named anywhere in the dump (owners, grants, policies, default privileges) + the packet's function owners/ACLs: created NOLOGIN, names only.
export function rolesIn({ cat, schema }) {
  const found = new Set(['postgres', 'anon', 'authenticated', 'service_role']);
  for (const m of schema.matchAll(/OWNER TO ("?[\w.-]+"?);/g)) found.add(m[1].replace(/"/g, ''));
  for (const m of schema.matchAll(/ TO ("?[\w.-]+"?)(?: WITH GRANT OPTION)?;/g)) found.add(m[1].replace(/"/g, ''));
  for (const m of schema.matchAll(/FOR ROLE ("?[\w.-]+"?)/g)) found.add(m[1].replace(/"/g, ''));
  for (const m of schema.matchAll(/CREATE POLICY [^;]*? TO ([^;]*?)(?: USING| WITH CHECK|;)/gs)) for (const r of m[1].split(',')) found.add(r.trim().replace(/"/g, ''));
  for (const f of cat.functions) { found.add(f.owner); for (const a of f.acl ?? []) { const [g, rest] = a.split('='); if (g) found.add(g); const o = rest?.split('/')[1]; if (o) found.add(o); } }
  for (const r of ['PUBLIC', 'CURRENT_USER', 'SESSION_USER', 'CURRENT_ROLE', '']) found.delete(r);
  return [...found].filter((r) => /^[\w.-]+$/.test(r) && r !== 'postgres');
}

// Applies the packet. Returns { errors: [...], applied: n }. Any error not matching an explicit allow pattern is reported to the caller to fail the run.
export function loadBaseline(pg, db, dir) {
  const packet = readPacket(dir); const { cat, schema } = packet;
  const ex = (sql, label) => { const r = pg.psql(db, sql); if (r.status !== 0) throw new Error(`${label}: ${r.err}`); return r; };
  ex(rolesIn(packet).map((r) => `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${r}') THEN CREATE ROLE "${r}" NOLOGIN; END IF; END $$;`).join('\n'), 'roles');
  ex('CREATE SCHEMA IF NOT EXISTS auth; CREATE SCHEMA IF NOT EXISTS costing; CREATE SCHEMA IF NOT EXISTS app_private;', 'schemas');
  for (const e of KNOWN_EXT) if (new RegExp(`\\b${e.replace('-', '[-_]')}\\b`, 'i').test(schema)) ex(`CREATE EXTENSION IF NOT EXISTS "${e}" WITH SCHEMA public;`, `extension ${e}`);
  // auth.* functions come from the catalog JSON (exact captured definitions)
  for (const f of cat.functions.filter((x) => x.schema === 'auth')) ex(f.def, `auth function ${f.identity}`);
  // schema dump (tables, types, sequences, functions, triggers, policies, ACLs, owners). Apply tolerant of ordering noise, then report remaining errors.
  const r = pg.psql(db, schema.replace(/^SET (transaction_timeout|idle_in_transaction_session_timeout)[^\n]*\n/gm, '').replace(/^SELECT pg_catalog\.set_config\('search_path', '', false\);\n/m, ''), { noStop: true });
  const errors = (r.err.match(/^ERROR:[^\n]*/gm) ?? []).filter((e) => !/already exists/i.test(e));
  return { errors, packet };
}

// Compare loaded vs captured (function identity -> SHA-256 of pg_get_functiondef, owner, ACL, secdef, config).
export function verifyFunctions(pg, db, packet) {
  const diffs = [];
  for (const f of packet.cat.functions) {
    const r = pg.psql(db, `SELECT encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')||'|'||pg_get_userbyid(p.proowner)||'|'||p.prosecdef||'|'||coalesce(p.proconfig::text,'')||'|'||
      coalesce((SELECT string_agg(x::text, ',' ORDER BY x::text) FROM unnest(coalesce(p.proacl, acldefault('f', p.proowner))) x), '') FROM pg_proc p WHERE p.oid = to_regprocedure('${f.identity.replace(/'/g, "''")}')`);
    const want = [f.sha256, f.owner, String(f.secdef), f.config ? `{${f.config.join(',')}}` : '', null];
    const got = (r.out || '').split('|');
    if (got[0] !== f.sha256) diffs.push(`${f.identity}: definition SHA differs (live ${f.sha256.slice(0, 12)} vs loaded ${String(got[0]).slice(0, 12)})`);
    else if (got[1] !== f.owner) diffs.push(`${f.identity}: owner ${got[1]} != ${f.owner}`);
    else if (got[2] !== String(f.secdef)) diffs.push(`${f.identity}: security attribute differs`);
    void want; void sha;
  }
  return diffs;
}
