// Local ephemeral PostgreSQL harness (no network, no Supabase). Returns null if unavailable.
import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const migDir = path.resolve(here, '../../migrations');
export const MIGRATIONS = [
  '20261123140000_mis_g7_s2_signed_batch_stage_events.sql',
  '20261123141000_mis_g7_s3_fg_ledger_shared_batch_lock.sql',
  '20261123142000_mis_g7_s4_atomic_pack_with_measured_excess.sql',
  '20261123143000_mis_g7_s3b_protected_stock_write_boundary.sql',
  '20261123144000_mis_g7_s4b_ticketed_pack_corrections_and_enforcement_control.sql',
  '20261123145000_mis_g7_s5_legacy_dwl_editor_chain_protection.sql',
];

function findBin() {
  if (process.env.PG_BIN && fs.existsSync(path.join(process.env.PG_BIN, 'initdb'))) return process.env.PG_BIN;
  for (const base of ['/usr/lib/postgresql']) {
    if (!fs.existsSync(base)) continue;
    for (const v of fs.readdirSync(base).sort().reverse()) {
      const b = path.join(base, v, 'bin');
      if (fs.existsSync(path.join(b, 'initdb'))) return b;
    }
  }
  return null;
}

export function startPg() {
  const bin = findBin();
  if (!bin) return null;
  let own = {};
  if (process.getuid && process.getuid() === 0) {
    const r = spawnSync('id', ['-u', 'postgres']);
    if (r.status !== 0) return null;
    own = { uid: Number(r.stdout), gid: Number(spawnSync('id', ['-g', 'postgres']).stdout) };
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mis-g7-pg-'));
  if (own.uid !== undefined) fs.chownSync(dir, own.uid, own.gid);
  fs.chmodSync(dir, 0o755);
  const data = path.join(dir, 'data');
  const sock = path.join(dir, 'sock'); fs.mkdirSync(sock); if (own.uid !== undefined) fs.chownSync(sock, own.uid, own.gid);
  const port = String(20000 + Math.floor(Math.random() * 20000));
  const run = (cmd, args) => spawnSync(path.join(bin, cmd), args, { ...own, encoding: 'utf8', env: { ...process.env, LANG: 'C' } });
  let r = run('initdb', ['-D', data, '-A', 'trust', '-U', 'postgres', '--no-sync']);
  if (r.status !== 0) { console.error(r.stderr); return null; }
  r = run('pg_ctl', ['-D', data, '-o', `-p ${port} -k ${sock} -c listen_addresses= -c fsync=off -c max_connections=50`, '-l', path.join(dir, 'log'), '-w', 'start']);
  if (r.status !== 0) { console.error(r.stderr, r.stdout); return null; }
  const psqlArgs = (db) => ['-h', sock, '-p', port, '-U', 'postgres', '-d', db, '-X', '-A', '-t', '-q'];
  const env = { ...process.env, PGOPTIONS: '' };
  const api = {
    bin, dir, serverVersion: spawnSync(path.join(bin, 'postgres'), ['--version'], { ...own, encoding: 'utf8' }).stdout.trim(),
    url(db) { return `postgresql://postgres@localhost/${db}?host=${encodeURIComponent(sock)}&port=${port}`; },
    stop() { run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']); fs.rmSync(dir, { recursive: true, force: true }); },
    // synchronous script execution; returns {out, err, status}
    psql(db, script, { uid, vc, noStop } = {}) {
      const pre = uid === undefined ? '' : (uid === null ? `SET ROLE authenticated;` : `SET ROLE authenticated; \\o /dev/null\nSELECT set_config('request.jwt.claim.sub','${uid}',false), set_config('request.jwt.claims', '{"sub":"${uid}","email":"${uid}@example.test","role":"authenticated"}', false);\n\\o`);
      const r = spawnSync(path.join(bin, 'psql'), [...psqlArgs(db), '-v', `ON_ERROR_STOP=${noStop ? 0 : 1}`], { ...own, input: pre + '\n' + script, encoding: 'utf8', env: vc ? { ...env, PGOPTIONS: '-c plpgsql.variable_conflict=use_column' } : env });
      return { out: (r.stdout || '').trim(), err: (r.stderr || '').trim(), status: r.status };
    },
    // async (for concurrent sessions); resolves with timing
    psqlAsync(db, script, { uid } = {}) {
      const pre = uid === undefined ? '' : (uid === null ? `SET ROLE authenticated;` : `SET ROLE authenticated; \\o /dev/null\nSELECT set_config('request.jwt.claim.sub','${uid}',false), set_config('request.jwt.claims', '{"sub":"${uid}","email":"${uid}@example.test","role":"authenticated"}', false);\n\\o`);
      return new Promise((resolve) => {
        const t0 = Date.now();
        const p = spawn(path.join(bin, 'psql'), [...psqlArgs(db), '-v', 'ON_ERROR_STOP=1'], { ...own, env });
        let out = '', err = '';
        p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d));
        p.on('close', (status) => resolve({ out: out.trim(), err: err.trim(), status, ms: Date.now() - t0 }));
        p.stdin.end(pre + '\n' + script);
      });
    },
    // Test databases use the server DEFAULT plpgsql.variable_conflict = error (as the live server does); no database/role override is applied.
    createDb(name) { run('createdb', ['-h', sock, '-p', port, '-U', 'postgres', name]); },
  };
  return api;
}

// Shim bodies are reconstructions, so they cannot hash to the live SHAs pinned in the S3b migration. Tests therefore
// pre-seed app_private.mis_g7_s3b_expected_sha (the migration's INSERT is ON CONFLICT DO NOTHING) with the SHAs of the
// shim functions, keeping the verification mechanism itself live. Separate tests prove the literal live SHAs refuse the shim.
export const SHIM_CHAIN = ['fn_fg_auto_zero(integer,text,numeric)', 'fn_fg_force_close(integer,text,numeric)',
  'fn_fg_ledger_add(integer,text,numeric,text,integer,text,date)', 'trg_fg_bulk_internal_transfer_to_ledger()', 'trg_fg_ledger_from_dwl()',
  'trg_fg_ledger_from_es()', 'trg_fg_ledger_reconcile_ins_stmt()', 'trg_fg_ledger_reconcile_upd_stmt()', 'trg_fg_ledger_reconcile_del_stmt()', 'fn_fg_reconcile_batch(integer,text,numeric)', 'fn_fg_mark_done_if_zero(integer,text,numeric)'];
export const seedShimFingerprintsSql = () => `CREATE SCHEMA IF NOT EXISTS app_private;
CREATE TABLE IF NOT EXISTS app_private.mis_g7_s3b_expected_sha (obj text PRIMARY KEY, sha text NOT NULL CHECK (sha ~ '^[0-9a-f]{64}$'));
INSERT INTO app_private.mis_g7_s3b_expected_sha SELECT o, encode(sha256(convert_to(pg_get_functiondef(to_regprocedure('public.' || o)), 'UTF8')), 'hex')
  FROM unnest(ARRAY[${SHIM_CHAIN.map((o) => `'${o}'`).join(',')}]) o ON CONFLICT DO NOTHING;`;
// ---- exact live DWL editor source (read-only reference committed from production: wrapper, __core and parser) ----
export const PATCHED_CORE_MIGRATION = '20261123150000_mis_g7_s5b_legacy_dwl_editor_core_integration.sql';   // owner-gated; NOT in the default install list
export const FINGERPRINT_MIGRATION = '20261123151000_mis_g7_s6_fg_stage_fingerprint_excludes_inventory_status.sql';   // owner-review; NOT in the default install list
export const S2_FINGERPRINT_FN_SHA = '69445f9880dea3874b6d30ae04469fa18f5c0ac1fbfc5ed13e961bfd4d083434';
export const PATCHED_CORE_SHA = 'dfa5a5e9aa31b48cf41fe9d03800fff2e35e5a3825ca458b5ccb6ca6c4471bcc';
export const LIVE_EDITOR_MD = path.resolve(here, '../../../docs/executive-mis-g7-server/LIVE_DWL_EDITOR_REFERENCE_ONLY_20261124.md');
export const LIVE_EDITOR_SHA = {
  'fn_parse_sku_breakdown': 'ec5fe3ead3e839d4ccad6c9f7e37c5775e1299c0b46ad71cc9a6b9eb7c5b29db',
  'rpc_update_daily_work_log_with_packaging': '4c82b4a3263f3f868e8ac4dc696f5b68efd58e593fe4adb4d92a7ec7fb1bd7b4',
  'rpc_update_daily_work_log_with_packaging__core': 'df7290df4a17e4af9f0aed43cf564007a35b957d8899b98869d7d35531296aec' };
export function liveEditorBlocks() {
  const md = fs.readFileSync(LIVE_EDITOR_MD, 'utf8');
  const out = {};
  for (const m of md.matchAll(/```sql\n([\s\S]*?)\n```/g)) { const name = /CREATE OR REPLACE FUNCTION public\.(\w+)\(/.exec(m[1])?.[1]; if (name) out[name] = m[1] + '\n'; }
  return out;
}
export function installLiveEditor(pg, db) {
  const b = liveEditorBlocks();
  for (const name of ['fn_parse_sku_breakdown', 'rpc_update_daily_work_log_with_packaging__core', 'rpc_update_daily_work_log_with_packaging']) {
    const r = pg.psql(db, b[name]); if (r.status !== 0) throw new Error(`live editor ${name}: ${r.err}`);
  }
  // live ACLs (independent review): wrapper client-executable, core NOT client-executable (parser: internal helper, default ACL kept)
  const r = pg.psql(db, `REVOKE ALL ON FUNCTION public.rpc_update_daily_work_log_with_packaging__core(bigint,date,integer,integer,integer,integer,text,text,numeric,text,text,text,text,integer,text,text,text,date,date,text,date,numeric,text,text,text,text,numeric,text,numeric,text) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.rpc_update_daily_work_log_with_packaging(bigint,date,integer,integer,integer,integer,text,text,numeric,text,text,text,text,integer,text,text,text,date,date,text,date,numeric,text,text,text,text,numeric,text,numeric,text) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.rpc_update_daily_work_log_with_packaging(bigint,date,integer,integer,integer,integer,text,text,numeric,text,text,text,text,integer,text,text,text,date,date,text,date,numeric,text,text,text,text,numeric,text,numeric,text) TO authenticated;`);
  if (r.status !== 0) throw new Error(r.err);
  // tests-only helpers: real-flow batch fixture and an editor call that overlays a jsonb patch on the current row
  const sup = pg.psql(db, fs.readFileSync(path.join(here, '03_real_editor_support.sql'), 'utf8')); if (sup.status !== 0) throw new Error(sup.err);
}
export function installBaseAndMigrations(pg, db) {
  const files = [path.join(here, '00_base_schema_shim.sql'), ...MIGRATIONS.map((m) => path.join(migDir, m))];
  for (const f of files) {

    if (f.endsWith('s3b_protected_stock_write_boundary.sql')) { const q = pg.psql(db, seedShimFingerprintsSql()); if (q.status !== 0) throw new Error(q.err); }
    const r = pg.psql(db, fs.readFileSync(f, 'utf8'));
    if (r.status !== 0) throw new Error(`install failed ${path.basename(f)}: ${r.err}`);
    if (f.endsWith('00_base_schema_shim.sql')) installLiveEditor(pg, db);   // exact live wrapper/core/parser on top of the shim tables
  }
}
