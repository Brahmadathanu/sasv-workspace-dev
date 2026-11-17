#!/usr/bin/env node
// OFFLINE SYNTHETIC plan-shape evidence for the keyset-first candidate. NOT a production measurement and NOT a speed claim:
// throwaway local PostgreSQL, synthetic rows sized to the ~1.49M estimate, assumed index idx_cost_sheet_snapshot_period_sku
// (snapshot_period_start, sku_id) taken from the proposal document and NOT verified against any production catalogue, local hardware, warm cache,
// no concurrency, no network, no RLS/auth overhead. Reported figures: rows entering aggregation / buffers (shape) and local wall-clock (context only).
// Usage: node plan-evidence.mjs [--skus 3000] [--runs 1] [--limit 2000] [--out FILE.json]
// --runs N retains N-1 extra NON-governed runs per period (models a snapshot table that keeps old runs; the governed-run join excludes them).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildFixture, extractFromMigration, HERE } from "../../lib.mjs";

const args = process.argv.slice(2); const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const SKUS = Number(opt("--skus", "3000")); const RUNS = Number(opt("--runs", "1")); const LIM = Number(opt("--limit", "2000")); const OUT = opt("--out", null);
const CDIR = join(HERE, "candidates/keyset-first");
const c = buildFixture({ withData: false, candidateFunctionSql: join(CDIR, "candidate-function.sql") });
try {
  c.must("CREATE INDEX idx_cost_sheet_snapshot_period_sku ON costing.cost_sheet_line_monthly_snapshot (snapshot_period_start, sku_id);");
  c.must(`
    CREATE TABLE costing.fixture_labels (idx int PRIMARY KEY, label text NOT NULL, is_text boolean NOT NULL);
    INSERT INTO costing.fixture_labels VALUES (1,'Raw Material Cost (RM)',false),(2,'Packing & Labelling Material Cost (PM)',false),(3,'Total Material Cost',false),(4,'Direct Labour (DL)',false),(5,'Manufacturing COP',false),(6,'Internal Loaded Cost',false),(7,'MRP: Inside Kerala (MRP IK)',false),(8,'MRP: Outside Kerala (MRP OK)',false),(9,'Selling Price: IK',false),(10,'Selling Price: OK',false),(11,'Sales Realisation: IK',false),(12,'Sales Realisation: OK',false),(13,'Profit Value: IK',false),(14,'Profit Value: OK',false),(15,'Profit on Sales Realisation: IK (%)',false),(16,'Profit on Sales Realisation: OK (%)',false),(17,'COP Percentage on MRP IK',false),(18,'COP Percentage on MRP OK',false),(19,'Cost Sheet Status',true),(20,'Cost Sheet Note',true),(21,'Unrelated Line (ignored by pivot)',false);
    CREATE TABLE costing.fixture_periods AS SELECT d::date p, (row_number() OVER (ORDER BY d))::int i FROM generate_series('2025-01-01'::date,'2026-11-01'::date, interval '1 month') d;
    INSERT INTO costing.fixture_governed_run SELECT p, 1000+i, 'APPROVED' FROM costing.fixture_periods;
    INSERT INTO costing.cost_sheet_line_monthly_snapshot
    SELECT p.p, CASE WHEN r = 1 THEN 1000+p.i ELSE 100000 + p.i*100 + r END, s, 'Product '||lpad(((s+1)/2)::text,5,'0'), 'Cat '||(s%7), 'Sub '||(s%5), 'Grp '||(s%4), 'SG '||(s%2), s, 'SKU '||lpad(s::text,5,'0'), l.label,
      CASE WHEN l.is_text THEN NULL ELSE ((s*37+p.i*13+l.idx*101)%5000)/100.0 END, CASE WHEN l.is_text THEN 'OK' END, p.p + interval '20 days'
    FROM costing.fixture_periods p CROSS JOIN generate_series(1, ${SKUS}) s CROSS JOIN generate_series(1, ${RUNS}) r CROSS JOIN costing.fixture_labels l;
    ANALYZE costing.cost_sheet_line_monthly_snapshot;`);
  const rowsTotal = Number(c.must("SELECT count(*) FROM costing.cost_sheet_line_monthly_snapshot;"));
  const { returnQuery } = extractFromMigration();
  const kf = (await import("node:fs")).readFileSync(join(CDIR, "candidate-function.sql"), "utf8").replace(/\r\n/g, "\n").match(/RETURN QUERY\n([\s\S]*?);\nEND;\n\$csr\$/)[1];
  const bind = (sql, p, lim) => sql.replace(/\bp_period_start\b/g, `'${p}'::date`).replace(/\bp_limit\b/g, String(lim));
  const view = (p, lim) => `SELECT * FROM costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed WHERE snapshot_period_start='${p}'::date ORDER BY product_name ASC, sku_column_label ASC LIMIT ${lim}`;
  const shapes = { governed_view: view, installed_rpc_body: (p, l) => bind(returnQuery, p, l), keyset_first_body: (p, l) => bind(kf, p, l) };
  const walk = (n, acc) => { if (n["Relation Name"] === "cost_sheet_line_monthly_snapshot") { acc.scanRows += (n["Actual Rows"] ?? 0) * (n["Actual Loops"] ?? 1); acc.scanNodes.push(`${n["Node Type"]}${n["Index Name"] ? ":" + n["Index Name"] : ""}`); }
    if (n["Node Type"] === "Aggregate" || n["Node Type"] === "GroupAggregate" || n["Node Type"] === "HashAggregate") acc.aggInputRows += (n.Plans?.[0]?.["Actual Rows"] ?? 0) * (n.Plans?.[0]?.["Actual Loops"] ?? 1);
    (n.Plans ?? []).forEach((x) => walk(x, acc)); return acc; };
  const results = [];
  for (const period of ["2026-09-01", "2026-10-01", "2026-11-01"]) for (const [name, f] of Object.entries(shapes)) {
    const sql = f(period, LIM);
    const run = () => JSON.parse(c.must(`SET max_parallel_workers_per_gather = 0; EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`))[0];
    run(); // warm-up
    const samples = [run(), run(), run()];
    const acc = walk(samples[0].Plan, { scanRows: 0, aggInputRows: 0, scanNodes: [] });
    results.push({ period, shape: name, snapshotRowsRead: acc.scanRows, rowsEnteringAggregates: acc.aggInputRows, scanNodes: [...new Set(acc.scanNodes)],
      sharedBuffersHitPlusRead: (samples[0].Plan["Shared Hit Blocks"] ?? 0) + (samples[0].Plan["Shared Read Blocks"] ?? 0),
      resultRows: samples[0].Plan["Actual Rows"], localExecutionMs_threeRunsNOTAPERCENTILE: samples.map((s) => Math.round(s["Execution Time"])) });
  }
  const out = { kind: "LOCAL SYNTHETIC SHAPE EVIDENCE - NOT PRODUCTION, NOT A SPEED CLAIM", synthetic: { snapshotRows: rowsTotal, skusPerPeriod: SKUS, runsPerPeriod: RUNS, limit: LIM, periods: 23, assumedIndex: "idx_cost_sheet_snapshot_period_sku(snapshot_period_start, sku_id) - from proposal, unverified in production" }, pg: c.must("SHOW server_version;"), results };
  console.log(JSON.stringify(out, null, 1)); if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 1));
} finally { c.stop(); }
