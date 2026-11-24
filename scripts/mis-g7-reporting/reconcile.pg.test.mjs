// Validates docs/executive-mis-g7-server/MIS_REPORTING_LIVE_RECONCILIATION_READONLY.sql against the REAL S2–S7c server code in the isolated PG fixture:
// the independent SQL must reproduce the figures of mis_get_governance_exception_summary_v1, and must not write. Skips honestly without PostgreSQL.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { startPg } from "../../supabase/tests/mis_g7/pg_harness.mjs";
import { buildS7Databases, EXECV, SIGNER, SIGNV, asTx, S7A, S7B, S7C, mig } from "../../supabase/tests/mis_g7/s7/build_db.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const packet = fs.readFileSync(path.join(root, "docs/executive-mis-g7-server/MIS_REPORTING_LIVE_RECONCILIATION_READONLY.sql"), "utf8");
let pg = null, blocked = null; const D = "recon";
before(() => { pg = startPg(); if (!pg) { blocked = "BLOCKED: local PostgreSQL unavailable"; return; } buildS7Databases(pg, [D]); });
after(() => { pg?.stop(); });
const T = (n, fn) => test(n, async (t) => { if (blocked) return t.skip(blocked); await fn(); });
const sql = (s, o = {}) => { const r = pg.psql(D, s, o); assert.equal(r.status, 0, r.err + " :: " + s); return r.out; };
const val = (s, o) => sql(s, o).trim().split("\n").pop();
const json = (out) => JSON.parse(out.split("\n").filter((l) => l.startsWith("{") || l.startsWith("[")).pop());
const queries = () => Object.fromEntries(packet.split(/^-- @/m).slice(1).map((b) => [b.slice(0, 2), b.slice(b.indexOf("\n") + 1).replace(/^rollback;\s*$/m, "").trim().replace(/;\s*$/, "")]));
const win = (q, from, to) => q.replace("date '2026-10-26'", `date '${from}'`).replace("date '2026-11-24'", `date '${to}'`);
const asJson = (q) => `SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (${q}) t`;

T("the packet is read-only text and its three queries reproduce the exception-summary figures on a mixed fixture", () => {
  assert.match(packet, /begin read only;/); assert.doesNotMatch(packet.replace(/^\s*--.*$/gm, ""), /\b(insert|update|delete|truncate|drop|alter|create)\b/i);
  sql(`UPDATE app_private.mis_g7_governance_cutover SET effective_from='2026-11-15'`);
  const mk = (item, b, date) => val(`SELECT public.s7_batch('${item}','${b}','${date}')`);
  mk("Inherited", "H-OLD", "2026-11-05"); mk("Inherited", "N-NEW", "2026-11-20"); mk("NoRoute", "R-GAP", "2026-11-20"); mk("Inherited", "X-RCPT", "2026-11-20");
  sql(`DELETE FROM public.fg_bulk_stock_ledger WHERE batch_number='X-RCPT'`);
  const pw = val(`SELECT public.s7_log('Inherited','H-OLD','Bottling','2026-11-06')`); const pe = val(`SELECT public.s7_event(${pw})`);
  sql(`INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${pe},10,3)`); sql(`DELETE FROM public.fg_bulk_stock_ledger WHERE source_table='event_skus'`);
  const before = { ev: val(`SELECT count(*) FROM app_private.mis_batch_stage_event`), led: val(`SELECT count(*) FROM public.fg_bulk_stock_ledger`), dwl: val(`SELECT count(*) FROM public.daily_work_log`) };

  const rpc = json(sql(`SELECT public.mis_get_governance_exception_summary_v1('2026-11-01','2026-11-30',50,0)`, { uid: EXECV }));
  const q = queries();
  const q1 = json(sql(asJson(win(q.Q1, "2026-11-01", "2026-11-30"))))[0];
  assert.equal(Number(q1.total_batches), rpc.total_batches); assert.equal(Number(q1.packing_lines), rpc.line_counts.PACKING_LINES); assert.equal(Number(q1.packing_lines_without_depletion), rpc.line_counts.PACKING_LINES_WITHOUT_DEPLETION);
  assert.ok(rpc.total_batches >= 4 && rpc.line_counts.PACKING_LINES_WITHOUT_DEPLETION === 1);

  const q2 = Object.fromEntries(json(sql(asJson(q.Q2))).map((r) => [r.receipt_code, Number(r.logs)]));
  assert.ok(q2.NO_SOURCE_LEDGER >= 1, "the X-RCPT log has no ledger receipt"); assert.ok(q2.OK >= 1);
  assert.equal(Object.values(q2).reduce((a, b) => a + b, 0), Number(val(`SELECT count(*) FROM public.daily_work_log WHERE activity='FG bulk storage' AND storage_qty>0`)));
  assert.ok(rpc.items.some((i) => i.batch_number === "X-RCPT" && i.state === "MISSING_RECEIPT" && i.detail === "NO_SOURCE_LEDGER"), "dashboard finding matches Q2 classification");

  sql(`CREATE VIEW public.user_permissions_canonical AS SELECT uid AS user_id, target, can_view, can_edit FROM public.test_perm`);   // the shim names the live table test_perm
  const q3 = json(sql(asJson(q.Q3)))[0]; assert.equal(Number(q3.operational_assignments), Number(val(`SELECT count(*) FROM public.test_perm WHERE target LIKE 'module:mis-%'`)));   // the fixture assigns test users; production is expected to show 0
   assert.equal(Number(q3.stage_events), 0);
  assert.deepEqual({ ev: val(`SELECT count(*) FROM app_private.mis_batch_stage_event`), led: val(`SELECT count(*) FROM public.fg_bulk_stock_ledger`), dwl: val(`SELECT count(*) FROM public.daily_work_log`) }, before, "running the packet changed nothing");
  const rw = pg.psql(D, `BEGIN READ ONLY; INSERT INTO public.sections VALUES (999); ROLLBACK;`); assert.notEqual(rw.status, 0, "the read-only transaction mode really blocks writes");
});
