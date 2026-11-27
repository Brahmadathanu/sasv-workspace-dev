#!/usr/bin/env node
// S3S: FK-preserving restore of the run-87 direct-FK archive into REAL tables of
// an ISOLATED PostgreSQL database whose schema was loaded from production
// (pg_dump --schema-only) or the migrations. Never run against production.
//
// Proves: (a) every archived row is restored into the real typed table with
// identical row JSON (order-independent digest); (b) every FK constraint whose
// child is an archived table is evaluated: parents inside the archive must have
// zero orphans, parents outside the archive are listed as EXTERNAL dependencies
// (count only, no key values) and keep the receipt in HOLD until accounted for.
// It does not prove cross-run isolation in production (see S3Q) or consumers.
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { verifyDirectArchive } from './verify-run87-direct-fks.mjs';
import { readJsonLines, assertStageConnection } from './restore-verify-run87.mjs';

const ident = x => { if (!/^[a-z_][a-z0-9_]*$/.test(x)) throw Error('Unsafe identifier: ' + x); return '"' + x + '"'; };
const rowDigest = line => createHash('sha256').update(line).digest('hex');
const setDigest = digests => createHash('sha256').update(digests.sort().join('\n')).digest('hex');

export async function restoreFullDirect(client, dir, opts = {}) {
  const expected = opts.expectedRelations ?? 64;
  const batchSize = opts.batchSize ?? 200;
  await verifyDirectArchive(dir);
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
  if (manifest.relationCount !== expected) throw Error('Direct relation count drift');
  const names = new Set(manifest.tables.map(t => t.table));
  let tx = false;
  try {
    await client.query('BEGIN'); tx = true;
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    // Superuser-only: lets archived rows load before parents; FKs are checked
    // explicitly below instead of being silently skipped.
    await client.query("SET LOCAL session_replication_role='replica'");
    let total = 0; const perTable = [];
    for (const t of manifest.tables) {
      const [schema, table] = t.table.split('.');
      if (schema !== 'costing') throw Error('Unexpected schema');
      const full = ident(schema) + '.' + ident(table);
      const exists = (await client.query('SELECT to_regclass($1) AS r', [full])).rows[0].r;
      if (!exists) throw Error('Target table missing in isolated schema: ' + t.table);
      const nonEmpty = (await client.query(`SELECT EXISTS(SELECT 1 FROM ${full}) AS x`)).rows[0].x;
      if (nonEmpty) throw Error('Target table not empty; refuse merge: ' + t.table);
      const cols = (await client.query(
        `SELECT attname FROM pg_attribute WHERE attrelid=$1::regclass AND attnum>0
           AND NOT attisdropped AND attgenerated='' ORDER BY attnum`, [full])).rows.map(r => ident(r.attname));
      const list = cols.join(',');
      const sel = cols.map(c => 'r.' + c).join(',');
      let inserted = 0, batch = [];
      const flush = async () => {
        if (!batch.length) return;
        const { rowCount } = await client.query(
          `INSERT INTO ${full} (${list}) OVERRIDING SYSTEM VALUE
           SELECT ${sel} FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY AS j(doc,ord),
           LATERAL jsonb_populate_record(NULL::${full}, j.doc) r ORDER BY j.ord`, ['[' + batch.join(',') + ']']);
        inserted += rowCount; batch = [];
      };
      const archiveDigests = [];
      for await (const line of readJsonLines(join(dir, t.filename))) {
        archiveDigests.push(rowDigest(line)); batch.push(line);
        if (batch.length >= batchSize) await flush();
      }
      await flush();
      if (inserted !== t.count || archiveDigests.length !== t.count) throw Error('Restore count mismatch: ' + t.table);
      // Re-serialize from the real table (incl. regenerated columns) and compare as a set.
      const restoredDigests = [];
      const { rows } = await client.query(`SELECT row_to_json(z)::text AS j FROM ${full} z`);
      for (const r of rows) restoredDigests.push(rowDigest(r.j));
      if (restoredDigests.length !== t.count || setDigest(restoredDigests) !== setDigest(archiveDigests))
        throw Error('Row-level digest mismatch: ' + t.table);
      total += inserted; perTable.push({ table: t.table, rows: inserted });
    }
    const fks = (await client.query(
      `SELECT f.conname, cn.nspname||'.'||c.relname AS child, pn.nspname||'.'||p.relname AS parent,
         (SELECT array_agg(a.attname::text ORDER BY u.n) FROM unnest(f.conkey) WITH ORDINALITY u(k,n)
            JOIN pg_attribute a ON a.attrelid=f.conrelid AND a.attnum=u.k) AS ccols,
         (SELECT array_agg(a.attname::text ORDER BY u.n) FROM unnest(f.confkey) WITH ORDINALITY u(k,n)
            JOIN pg_attribute a ON a.attrelid=f.confrelid AND a.attnum=u.k) AS pcols
       FROM pg_constraint f JOIN pg_class c ON c.oid=f.conrelid JOIN pg_namespace cn ON cn.oid=c.relnamespace
       JOIN pg_class p ON p.oid=f.confrelid JOIN pg_namespace pn ON pn.oid=p.relnamespace
       WHERE f.contype='f' AND cn.nspname='costing' AND c.relispartition IS NOT TRUE ORDER BY 2,1`)).rows;
    const internal = [], external = []; let internalOrphans = 0;
    for (const f of fks) {
      if (!names.has(f.child)) continue;
      const [cs, ct] = f.child.split('.'), [ps, pt] = f.parent.split('.');
      const on = f.ccols.map((c, i) => `p.${ident(f.pcols[i])}=c.${ident(c)}`).join(' AND ');
      const nn = f.ccols.map(c => `c.${ident(c)} IS NOT NULL`).join(' AND ');
      const n = Number((await client.query(
        `SELECT count(*)::text AS n FROM ${ident(cs)}.${ident(ct)} c WHERE ${nn}
         AND NOT EXISTS (SELECT 1 FROM ${ident(ps)}.${ident(pt)} p WHERE ${on})`)).rows[0].n);
      const rec = { fk: f.conname, child: f.child, parent: f.parent, orphanRows: n };
      if (names.has(f.parent)) { internal.push(rec); internalOrphans += n; } else external.push(rec);
    }
    const externalWithOrphans = external.filter(e => e.orphanRows > 0);
    const receipt = {
      receiptType: 'SASV_S3S_FK_PRESERVING_ISOLATED_RESTORE',
      relationCount: manifest.relationCount, restoredRows: total,
      rowLevelDigestsVerified: true,
      internalFkChecked: internal.length, internalFkOrphanRows: internalOrphans,
      externalFkEdges: external.length,
      externalDependenciesMissingFromArchive: externalWithOrphans.map(e => ({ fk: e.fk, child: e.child, parent: e.parent, rowsNeedingExternalParent: e.orphanRows })),
      decision: internalOrphans === 0 && externalWithOrphans.length === 0 ? 'RESTORE_FK_COMPLETE' : internalOrphans === 0 ? 'HOLD_EXTERNAL_PARENTS_NOT_IN_ARCHIVE' : 'FAIL_INTERNAL_ORPHANS',
      productionDataChanged: false, productionDeletionAuthorised: false
    };
    if (internalOrphans > 0) throw Object.assign(Error('Internal FK orphans after restore'), { receipt });
    if (opts.commit === false) { await client.query('ROLLBACK'); tx = false; } else { await client.query('COMMIT'); tx = false; }
    return receipt;
  } finally { if (tx) await client.query('ROLLBACK'); }
}

async function main() {
  const dir = process.argv[2];
  if (!dir || process.argv.length > 4 || (process.argv[3] && process.argv[3] !== '--rollback')) throw Error('Usage: node restore-full-run87-direct-fks.mjs <archive> [--rollback]');
  const conn = process.env.SASV_ISOLATED_STAGE_DATABASE_URL;
  if (!conn) throw Error('Missing isolated stage DSN');
  assertStageConnection(conn, process.env.SASV_STAGE_RESTORE_ATTESTATION);
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: conn });
  try {
    await client.connect();
    const r = await restoreFullDirect(client, resolve(dir), { commit: process.argv[3] !== '--rollback' });
    console.log(JSON.stringify(r));
  } finally { await client.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch(e => { console.error('S3S:', e.message, e.receipt ? JSON.stringify(e.receipt) : ''); process.exitCode = 1; });
