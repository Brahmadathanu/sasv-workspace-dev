// #282 offline Cost Comparison regression verifier: throwaway local PostgreSQL cluster + fixture + bag-parity comparator.
// Fail-closed: if PostgreSQL binaries/cluster are unavailable every caller gets a thrown error (never a silent skip/pass).
// By construction there is NO network target: the cluster listens on a private unix socket only. Nothing here can reach
// Supabase, production, or any remote database.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { COMPARISON_COLUMNS } from "../../public/shared/js/costing-cost-comparison-read.js";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, "..", "..");
export const MIGRATION = join(REPO, "supabase/migrations/20261111133505_csr_scoped_comparison_rpc_additive_20261111.sql");
export const UID = "00000000-0000-0000-0000-000000000001";
export const rd = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");

export function findPgBin() {
  // An explicit CSR_VERIFIER_PG_BIN is authoritative (no silent fallback to some other installation).
  const cands = process.env.CSR_VERIFIER_PG_BIN ? [process.env.CSR_VERIFIER_PG_BIN]
    : ["/usr/lib/postgresql/17/bin", "/usr/lib/postgresql/16/bin", "/usr/lib/postgresql/15/bin", "/usr/lib/postgresql/14/bin", "/usr/bin"];
  for (const d of cands) if (existsSync(join(d, "initdb")) && existsSync(join(d, "pg_ctl")) && existsSync(join(d, "psql"))) return d;
  throw new Error("DB unavailable (fail closed): no PostgreSQL initdb/pg_ctl/psql found; set CSR_VERIFIER_PG_BIN");
}

const isRoot = () => typeof process.getuid === "function" && process.getuid() === 0;

function run(cmd, args, { input, asPg } = {}) {
  const [c, a] = asPg && isRoot() ? ["runuser", ["-u", "postgres", "--", cmd, ...args]] : [cmd, args];
  const r = spawnSync(c, a, { input, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (r.error) throw new Error(`DB unavailable (fail closed): ${r.error.message}`);
  return r;
}

/** Extract the installed function body pieces from the synchronised migration (fail closed if its shape changed). */
export function extractFromMigration(sql = rd(MIGRATION)) {
  const fn = sql.match(/CREATE FUNCTION public\.rpc_get_cost_sheet_sku_monthly_comparison_scoped\([\s\S]*?\$csr\$;/);
  if (!fn) throw new Error("migration shape changed: CREATE FUNCTION ... $csr$; block not found");
  const body = sql.match(/RETURN QUERY\n([\s\S]*?);\nEND;\n\$csr\$/);
  if (!body) throw new Error("migration shape changed: RETURN QUERY body not found");
  return { createFunction: fn[0], returnQuery: body[1] };
}

/** Reconstruct an UNSCOPED governed view from the installed body: drop the 3-period pre-filter, the final period filter, ORDER and LIMIT. */
export function buildGovernedViewSql(returnQuery) {
  const pre = /\(SELECT \*\s+FROM costing\.cost_sheet_line_monthly_snapshot\s+WHERE snapshot_period_start IN \([\s\S]*?\)\) cost_sheet_line_monthly_snapshot/;
  const post = /\n\s+WHERE snapshot_period_start = p_period_start\s+ORDER BY product_name, sku_column_label, sku_id\s+LIMIT p_limit\s*$/;
  if (!pre.test(returnQuery) || !post.test(returnQuery)) throw new Error("migration shape changed: cannot derive unscoped view (fail closed)");
  const q = returnQuery.replace(pre, "costing.cost_sheet_line_monthly_snapshot").replace(post, "");
  if (/p_period_start|p_limit/.test(q)) throw new Error("derived view still references parameters");
  return `CREATE VIEW costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed AS\n${q};`;
}

export class Cluster {
  constructor(bin, dir, sock) { this.bin = bin; this.dir = dir; this.sock = sock; }
  psql(sql, { db = "fixture", vars = {} } = {}) {
    const args = ["-h", this.sock, "-U", "postgres", "-d", db, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1"];
    for (const [k, v] of Object.entries(vars)) args.push("-v", `${k}=${v}`);
    const r = run(join(this.bin, "psql"), [...args, "-f", "-"], { input: sql });
    return { ok: r.status === 0, out: r.stdout.trim(), err: r.stderr.trim() };
  }
  must(sql, opts) { const r = this.psql(sql, opts); if (!r.ok) throw new Error(`psql failed: ${r.err}`); return r.out; }
  stop() {
    try { run(join(this.bin, "pg_ctl"), ["-D", join(this.dir, "data"), "-m", "immediate", "stop"], { asPg: true }); } catch { /* best effort */ }
    try { rmSync(this.dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

export function startCluster() {
  const bin = findPgBin();
  const dir = mkdtempSync(join(tmpdir(), "csrv-"));
  chmodSync(dir, 0o777);
  if (isRoot()) run("chown", ["postgres", dir]);
  const data = join(dir, "data"), sock = join(dir, "s");
  let r = run(join(bin, "initdb"), ["-D", data, "-U", "postgres", "-A", "trust", "--locale=C", "-E", "UTF8"], { asPg: true });
  if (r.status !== 0) throw new Error(`DB unavailable (fail closed): initdb: ${r.stderr}`);
  run("mkdir", ["-p", sock], { asPg: true });
  r = run(join(bin, "pg_ctl"), ["-D", data, "-w", "-t", "60", "-l", join(dir, "pg.log"), "-o", `-k ${sock} -c listen_addresses= -c fsync=off -c synchronous_commit=off -c max_connections=20`, "start"], { asPg: true });
  if (r.status !== 0) throw new Error(`DB unavailable (fail closed): pg_ctl: ${r.stderr}${r.stdout}`);
  const c = new Cluster(bin, dir, sock);
  c.must("CREATE DATABASE fixture;", { db: "postgres" });
  return c;
}

/** Cluster + fixture schema + data + reconstructed governed view + installed function (verbatim from migration). */
export function buildFixture({ withData = true } = {}) {
  const c = startCluster();
  try {
    const { createFunction, returnQuery } = extractFromMigration();
    c.must(rd(join(HERE, "sql/fixture-schema.sql")));
    c.must(buildGovernedViewSql(returnQuery));
    c.must(createFunction);
    if (withData) c.must(rd(join(HERE, "sql/fixture-data.sql")));
  } catch (e) { c.stop(); throw e; }
  return c;
}

const stripSql = (s) => rd(s).replace(/^\s*--.*$/gm, "").trim().replace(/;+\s*$/, "");
const GUCS = `SET fixture.uid='${UID}'; SET fixture.perm='allow';\n`;

/** Pipeline: materialise both paths into scratch tables, then compare schema / bag / strict-text bag / order / cap. */
export function compare(cluster, { baselineSql, candidateSql, period, lim = 2000, tag = "t" }) {
  const v = { period, lim: String(lim) };
  const mat = (name, file) => cluster.must(`${GUCS}DROP TABLE IF EXISTS scratch_${name}_${tag}; CREATE TABLE scratch_${name}_${tag} AS SELECT * FROM (\n${stripSql(file)}\n) q;
    DROP TABLE IF EXISTS scratch_${name}o_${tag}; CREATE TABLE scratch_${name}o_${tag} AS SELECT row_number() OVER () AS ord, * FROM scratch_${name}_${tag};`, { vars: v });
  mat("b", baselineSql); mat("c", candidateSql);
  const cols = (t) => cluster.must(`SELECT string_agg(attname || ':' || format_type(atttypid, atttypmod), ',' ORDER BY attnum) FROM pg_attribute WHERE attrelid='scratch_${t}_${tag}'::regclass AND attnum>0 AND NOT attisdropped;`);
  const bCols = cols("b"), cCols = cols("c");
  const names = (s) => s.split(",").map((x) => x.split(":")[0]);
  const out = {
    period, lim,
    contract63: names(bCols).length === COMPARISON_COLUMNS.length && names(bCols).every((n, i) => n === COMPARISON_COLUMNS[i]),
    candidateContract63: names(cCols).length === COMPARISON_COLUMNS.length && names(cCols).every((n, i) => n === COMPARISON_COLUMNS[i]),
    schemaIdentical: bCols === cCols,
    baselineRows: Number(cluster.must(`SELECT count(*) FROM scratch_b_${tag};`)),
    candidateRows: Number(cluster.must(`SELECT count(*) FROM scratch_c_${tag};`)),
  };
  if (out.schemaIdentical) {
    const n = (q) => Number(cluster.must(q));
    out.baselineMinusCandidate = n(`SELECT count(*) FROM (SELECT * FROM scratch_b_${tag} EXCEPT ALL SELECT * FROM scratch_c_${tag}) x;`);
    out.candidateMinusBaseline = n(`SELECT count(*) FROM (SELECT * FROM scratch_c_${tag} EXCEPT ALL SELECT * FROM scratch_b_${tag}) x;`);
    out.strictTextBaselineMinusCandidate = n(`SELECT count(*) FROM (SELECT t::text FROM scratch_b_${tag} t EXCEPT ALL SELECT t::text FROM scratch_c_${tag} t) x;`);
    out.strictTextCandidateMinusBaseline = n(`SELECT count(*) FROM (SELECT t::text FROM scratch_c_${tag} t EXCEPT ALL SELECT t::text FROM scratch_b_${tag} t) x;`);
    out.candidateOrderViolations = n(`SELECT count(*) FROM scratch_co_${tag} a JOIN (SELECT row_number() OVER (ORDER BY product_name, sku_column_label, sku_id) rn, product_name pn, sku_column_label sl, sku_id si FROM scratch_co_${tag}) s ON a.ord = s.rn WHERE (a.product_name, a.sku_column_label, a.sku_id) IS DISTINCT FROM (s.pn, s.sl, s.si);`);
    out.orderMismatchesVsBaseline = n(`SELECT count(*) FROM scratch_bo_${tag} b FULL JOIN scratch_co_${tag} c ON b.ord = c.ord WHERE (b.product_name, b.sku_column_label) IS DISTINCT FROM (c.product_name, c.sku_column_label);`);
    out.bagParity = out.baselineMinusCandidate === 0 && out.candidateMinusBaseline === 0;
    out.strictTextParity = out.strictTextBaselineMinusCandidate === 0 && out.strictTextCandidateMinusBaseline === 0;
  } else {
    out.bagParity = false; out.strictTextParity = false;
  }
  out.capRespected = out.candidateRows <= lim;
  for (const t of ["b", "c", "bo", "co"]) cluster.must(`DROP TABLE IF EXISTS scratch_${t}_${tag};`);
  out.pass = !!(out.contract63 && out.candidateContract63 && out.schemaIdentical && out.bagParity && out.strictTextParity &&
    out.candidateOrderViolations === 0 && out.orderMismatchesVsBaseline === 0 && out.capRespected && out.baselineRows === out.candidateRows);
  return out;
}
