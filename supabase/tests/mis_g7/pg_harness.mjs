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
    bin, dir,
    stop() { run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']); fs.rmSync(dir, { recursive: true, force: true }); },
    // synchronous script execution; returns {out, err, status}
    psql(db, script, { uid } = {}) {
      const pre = uid === undefined ? '' : (uid === null ? `SET ROLE authenticated;` : `SET ROLE authenticated; \\o /dev/null\nSELECT set_config('request.jwt.claim.sub','${uid}',false);\n\\o`);
      const r = spawnSync(path.join(bin, 'psql'), [...psqlArgs(db), '-v', 'ON_ERROR_STOP=1'], { ...own, input: pre + '\n' + script, encoding: 'utf8', env });
      return { out: (r.stdout || '').trim(), err: (r.stderr || '').trim(), status: r.status };
    },
    // async (for concurrent sessions); resolves with timing
    psqlAsync(db, script, { uid } = {}) {
      const pre = uid === undefined ? '' : (uid === null ? `SET ROLE authenticated;` : `SET ROLE authenticated; \\o /dev/null\nSELECT set_config('request.jwt.claim.sub','${uid}',false);\n\\o`);
      return new Promise((resolve) => {
        const t0 = Date.now();
        const p = spawn(path.join(bin, 'psql'), [...psqlArgs(db), '-v', 'ON_ERROR_STOP=1'], { ...own, env });
        let out = '', err = '';
        p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d));
        p.on('close', (status) => resolve({ out: out.trim(), err: err.trim(), status, ms: Date.now() - t0 }));
        p.stdin.end(pre + '\n' + script);
      });
    },
    createDb(name) { run('createdb', ['-h', sock, '-p', port, '-U', 'postgres', name]); },
  };
  return api;
}

// Shim bodies are reconstructions, so they cannot hash to the live SHAs pinned in the S3b migration. Tests therefore
// pre-seed app_private.mis_g7_s3b_expected_sha (the migration's INSERT is ON CONFLICT DO NOTHING) with the SHAs of the
// shim functions, keeping the verification mechanism itself live. Separate tests prove the literal live SHAs refuse the shim.
export const SHIM_CHAIN = ['fn_fg_auto_zero(integer,text,numeric)', 'fn_fg_force_close(integer,text,numeric)',
  'fn_fg_ledger_add(integer,text,numeric,text,integer,text,date)', 'trg_fg_bulk_internal_transfer_to_ledger()', 'trg_fg_ledger_from_dwl()',
  'trg_fg_ledger_from_es()', 'trg_fg_ledger_reconcile_ins_stmt()', 'trg_fg_ledger_reconcile_upd_stmt()', 'trg_fg_ledger_reconcile_del_stmt()'];
export const seedShimFingerprintsSql = () => `CREATE SCHEMA IF NOT EXISTS app_private;
CREATE TABLE IF NOT EXISTS app_private.mis_g7_s3b_expected_sha (obj text PRIMARY KEY, sha text NOT NULL CHECK (sha ~ '^[0-9a-f]{64}$'));
INSERT INTO app_private.mis_g7_s3b_expected_sha SELECT o, encode(sha256(convert_to(pg_get_functiondef(to_regprocedure('public.' || o)), 'UTF8')), 'hex')
  FROM unnest(ARRAY[${SHIM_CHAIN.map((o) => `'${o}'`).join(',')}]) o ON CONFLICT DO NOTHING;`;
export function installBaseAndMigrations(pg, db) {
  const files = [path.join(here, '00_base_schema_shim.sql'), ...MIGRATIONS.map((m) => path.join(migDir, m))];
  for (const f of files) {
    if (f.endsWith('s3b_protected_stock_write_boundary.sql')) { const q = pg.psql(db, seedShimFingerprintsSql()); if (q.status !== 0) throw new Error(q.err); }
    const r = pg.psql(db, fs.readFileSync(f, 'utf8'));
    if (r.status !== 0) throw new Error(`install failed ${path.basename(f)}: ${r.err}`);
  }
}
