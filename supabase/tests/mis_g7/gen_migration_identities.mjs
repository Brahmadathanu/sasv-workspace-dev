// Regenerates docs/executive-mis-g7-server/MIGRATION_IDENTITIES.json (file SHA-256 + git blob SHA-1 of every G7 migration).
// Run after ANY change to a G7 migration:  node supabase/tests/mis_g7/gen_migration_identities.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MIGRATIONS, PATCHED_CORE_MIGRATION, FINGERPRINT_MIGRATION, PATCHED_CORE_SHA } from './pg_harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const migDir = path.resolve(here, '../../migrations');
const out = path.resolve(here, '../../../docs/executive-mis-g7-server/MIGRATION_IDENTITIES.json');
const ORDER = [...MIGRATIONS, PATCHED_CORE_MIGRATION, FINGERPRINT_MIGRATION];
// Registered production versions (all eight LIVE, verified 2026-11-24). Never replay; never regenerate these as HELD/null.
const REGISTERED = {
  's2_signed_batch_stage_events': '20261124055734',
  's3_fg_ledger_shared_batch_lock': '20261124080858',
  's4_atomic_pack_with_measured_excess': '20261124080913',
  's3b_protected_stock_write_boundary': '20261124080932',
  's4b_ticketed_pack_corrections_and_enforcement_control': '20261124080952',
  's5_legacy_dwl_editor_chain_protection': '20261124081009',
  's5b_legacy_dwl_editor_core_integration': '20261124081022',
  's6_fg_stage_fingerprint_excludes_inventory_status': '20261124081034',
};
const blob = (b) => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex');
const rows = ORDER.map((f, i) => {
  const b = fs.readFileSync(path.join(migDir, f)); const name = f.replace(/^\d{14}_mis_g7_/, '');
  return { seq: i + 1, repo_file: f, supabase_migration_name: `mis_g7_${name.replace(/\.sql$/, '')}`, registered_version: REGISTERED[name.replace(/\.sql$/, '')] ?? null,
    status: i === 0 ? 'LIVE (installed; never replay)' : 'LIVE (installed; AUDIT; never replay)', bytes: b.length, sha256: crypto.createHash('sha256').update(b).digest('hex'), git_blob_sha1: blob(b) };
});
fs.writeFileSync(out, JSON.stringify({ manifest_version: 'mis-g7-migration-identities/1', patched_core_sha256: PATCHED_CORE_SHA,
  note: 'All eight identities registered in production, verified 2026-11-24. S2 preserved. S3–S6 applied once from 74ed6c49c8655d22eedc6dc32ed09c0f238f5126 under explicit owner authorization accepting the isolated PG17.4 test limitation. No ENFORCE or core sign-off. Do not replay or db push from mismatched filename prefixes.',
  migrations: rows }, null, 2) + '\n');
console.log(`wrote ${out}`); for (const r of rows) console.log(r.seq, r.repo_file, r.git_blob_sha1.slice(0, 10), r.sha256.slice(0, 12));
