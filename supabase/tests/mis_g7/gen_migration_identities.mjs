// Regenerates docs/executive-mis-g7-server/MIGRATION_IDENTITIES.json (file SHA-256 + git blob SHA-1 of every G7 migration).
// Run after ANY change to a G7 migration:  node supabase/tests/mis_g7/gen_migration_identities.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MIGRATIONS, PATCHED_CORE_MIGRATION, PATCHED_CORE_SHA } from './pg_harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const migDir = path.resolve(here, '../../migrations');
const out = path.resolve(here, '../../../docs/executive-mis-g7-server/MIGRATION_IDENTITIES.json');
const ORDER = [...MIGRATIONS, PATCHED_CORE_MIGRATION];
// Registered Supabase versions: S2 is LIVE (applied with the Supabase migration tool, name below). The others are assigned by the tool at apply time.
const REGISTERED = { 's2_signed_batch_stage_events': '20261124055734' };
const blob = (b) => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex');
const rows = ORDER.map((f, i) => {
  const b = fs.readFileSync(path.join(migDir, f)); const name = f.replace(/^\d{14}_mis_g7_/, '');
  return { seq: i + 1, repo_file: f, supabase_migration_name: `mis_g7_${name.replace(/\.sql$/, '')}`, registered_version: REGISTERED[name.replace(/\.sql$/, '')] ?? null,
    status: i === 0 ? 'LIVE (installed; never replay)' : 'HELD (not installed)', bytes: b.length, sha256: crypto.createHash('sha256').update(b).digest('hex'), git_blob_sha1: blob(b) };
});
fs.writeFileSync(out, JSON.stringify({ manifest_version: 'mis-g7-migration-identities/1', patched_core_sha256: PATCHED_CORE_SHA,
  note: 'S2 file blob must equal the blob installed in production (055b1cdfa1c8be970939f57e7e866f126ec55f03). Do not edit the S2 file. Registered versions for S3..S5b are assigned at apply time: record them here after each controlled apply.',
  migrations: rows }, null, 2) + '\n');
console.log(`wrote ${out}`); for (const r of rows) console.log(r.seq, r.repo_file, r.git_blob_sha1.slice(0, 10), r.sha256.slice(0, 12));
