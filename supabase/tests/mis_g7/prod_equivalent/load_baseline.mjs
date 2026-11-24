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
  // Owners and ACLs of EVERY captured function are restored from the packet (auth.* functions are created from their captured definition and
  // would otherwise keep default owner/ACL). ACL items are 'grantee=privs/grantor'; function privilege is EXECUTE ('X', '*' = grant option).
  const idq = (f) => f.identity.replace(/'/g, "''");
  const stmts = [];
  for (const f of cat.functions) {
    stmts.push(`ALTER FUNCTION ${f.identity} OWNER TO "${f.owner}";`);
    if (f.acl && f.acl.length) {
      stmts.push(`REVOKE ALL ON FUNCTION ${f.identity} FROM PUBLIC;`);
      stmts.push(`DO $$ DECLARE r text; BEGIN FOR r IN SELECT rolname FROM pg_roles WHERE rolname NOT LIKE 'pg\\_%' AND rolname <> '${f.owner}' LOOP EXECUTE format('REVOKE ALL ON FUNCTION ${idq(f)} FROM %I', r); END LOOP; END $$;`);
      for (const item of f.acl) {
        const [grantee, rest] = item.split('='); const privs = rest.split('/')[0];
        if (!privs.includes('X')) continue;
        stmts.push(`GRANT EXECUTE ON FUNCTION ${f.identity} TO ${grantee === '' ? 'PUBLIC' : `"${grantee}"`}${privs.includes('X*') ? ' WITH GRANT OPTION' : ''};`);
      }
    }
  }
  const ar = pg.psql(db, stmts.join('\n'), { noStop: true }); errors.push(...(ar.err.match(/^ERROR:[^\n]*/gm) ?? []));
  return { errors, packet };
}

// Compare loaded vs captured, for EVERY captured function: existence, SHA-256 of pg_get_functiondef (exact source), owner, SECURITY attribute,
// configuration (proconfig, order-preserving) and the ACL (normalized: sorted aclitems, NULL == acldefault). Returns a list of differences.
const sortAcl = (items) => [...items].sort().join(',');
const defaultAcl = (owner) => sortAcl([`=X/${owner}`, `${owner}=X/${owner}`]);
export function verifyFunctions(pg, db, packet) {
  const diffs = [];
  for (const f of packet.cat.functions) {
    const r = pg.psql(db, `SELECT encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') || E'\\t' || pg_get_userbyid(p.proowner) || E'\\t' || p.prosecdef || E'\\t' || coalesce(array_to_string(p.proconfig, '|'), '') || E'\\t' ||
      coalesce((SELECT string_agg(x::text, ',' ORDER BY x::text) FROM unnest(coalesce(p.proacl, acldefault('f', p.proowner))) x), '')
      FROM pg_proc p WHERE p.oid = to_regprocedure('${f.identity.replace(/'/g, "''")}')`);
    if (r.status !== 0 || !r.out) { diffs.push(`${f.identity}: MISSING in the loaded database`); continue; }
    const [sha, owner, secdef, config, acl] = r.out.split('\t');
    if (sha !== f.sha256) { diffs.push(`${f.identity}: definition SHA differs (captured ${f.sha256.slice(0, 12)} vs loaded ${sha.slice(0, 12)})`); continue; }
    if (owner !== f.owner) diffs.push(`${f.identity}: owner ${owner} != captured ${f.owner}`);
    if (secdef !== (f.secdef ? 'true' : 'false')) diffs.push(`${f.identity}: SECURITY DEFINER ${secdef} != captured ${f.secdef}`);
    if (config !== (f.config ?? []).join('|')) diffs.push(`${f.identity}: configuration '${config}' != captured '${(f.config ?? []).join('|')}'`);
    const wantAcl = f.acl && f.acl.length ? sortAcl(f.acl) : defaultAcl(f.owner);
    if (acl !== wantAcl) diffs.push(`${f.identity}: ACL '${acl}' != captured '${wantAcl}'`);
  }
  return diffs;
}
