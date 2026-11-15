// WP10 G1 — mutation controls for the transition fixtures: each mutant disables ONE safeguard in the fixture text and the invariant
// suite below must report the matching violation. Proves the F-series negatives are meaningful and not mirror assertions.
// Run: node scripts/wp10-g1-safeguard-audit/fixture-mutation.test.mjs [resultsJson]
import fs from "node:fs";
import { startCluster, pgAvailable } from "../wp08-g2-0-shared-master-data/pg-harness.mjs";
import { fixtureSql, session } from "./fixture-sql.mjs";
import { makeResults } from "./lib.mjs";

const { results, check, classify, failed } = makeResults();
if (!pgAvailable()) {
  classify("M0", "SKIPPED", "PostgreSQL unavailable — mutation controls SKIPPED (not PASS)");
  process.exit(2);
}
const cluster = startCluster();
const T = (label, stmt) => `select public.fx_try('${label}', $q$${stmt}$q$);\n`;

/** Core invariants of the audited contract; returns the list of violated ones. */
function invariants(fix) {
  const db = cluster.newDb();
  const boot = cluster.script(db, fix + "\ninsert into public.products(item,status) values ('P1','Active'),('P2','Inactive'),('P3','Active');\n");
  if (boot.code) throw new Error(boot.err);
  cluster.script(
    db,
    session() +
      T("active_insert", "insert into public.product_skus(product_id, pack_size, uom, is_active) values (1, 50, 'mL', true)") +
      "alter sequence public.product_skus_id_seq restart with 1;\ndelete from public.product_skus;\n" +
      "insert into public.product_skus(product_id, pack_size, uom) values (1, 10, 'g'),(2, 10, 'g'),(3, 10, 'g');\n" +
      "select public.fx_complete(1, 1, 'MRP');\nselect public.fx_complete(2, 2);\nselect public.fx_complete(3, 3);\n" +
      T("act_missing_mrp", "select * from public.rpc_set_product_sku_active(1, true, 'x')") +
      T("act_inactive_parent", "select * from public.rpc_set_product_sku_active(2, true, 'x')") +
      T("act_ok", "select * from public.rpc_set_product_sku_active(3, true, 'x')") +
      "select costing.fx_build_now('2026-09-01');\ndelete from costing.sku_selling_price_policy where sku_id = 3;\n" +
      T("read_after_dep_change", "select costing.fx_read('2026-09-01')"),
    { stopOnError: false },
  );
  const log = Object.fromEntries(
    cluster
      .sql(db, "select label||'#'||ok||'#'||coalesce(msg,'') from public.fx_log order by id")
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        const [k, ok, msg] = l.split("#");
        return [k, { ok: ok === "true", msg }];
      }),
  );
  const asOf = cluster.sql(db, "select (costing.fn_sku_activation_missing_items(3, 3))->>'as_of_date'", session({ now: "2026-11-14 20:00:00+00" })).split("\n").pop();
  const bad = [];
  if (log.active_insert.ok) bad.push("active-insert-accepted");
  if (log.act_missing_mrp.ok) bad.push("activation-with-missing-essential-accepted");
  if (log.act_inactive_parent.ok) bad.push("activation-under-inactive-parent-accepted");
  if (!log.act_ok.ok) bad.push("complete-activation-rejected");
  if (log.read_after_dep_change.ok) bad.push("dependency-change-not-invalidated");
  if (asOf !== "2026-11-15") bad.push("asof-not-IST-today");
  return bad;
}

try {
  const base = fixtureSql();
  const clean = invariants(base);
  check("M0", "invariant suite is clean on the unmodified fixture", clean.length === 0, clean.join());
  const dropTrigger = (name) => (s) => s.replace(new RegExp(`CREATE TRIGGER ${name}[^;]*;`), "");
  const mutants = {
    "completeness trigger dropped": [dropTrigger("trg_sku_activation_completeness_guard"), "active-insert-accepted"],
    "parent-active trigger dropped": [dropTrigger("trg_active_sku_requires_active_product"), "activation-under-inactive-parent-accepted"],
    "pre-check neutralised in lifecycle RPC and completeness trigger dropped": [
      (s) => dropTrigger("trg_sku_activation_completeness_guard")(s).replace(/if p_is_active then\s+v_chk := costing\.fn_sku_activation_missing_items\(p_sku_id, v_old\.product_id\);/, "if false then v_chk := '{}'::jsonb;"),
      "activation-with-missing-essential-accepted",
    ],
    "CI-038a reverted (valuation-only as-of)": [
      (s) => s.replace("v_val := greatest(coalesce(v_val, current_date), (public.fixture_now() at time zone 'Asia/Kolkata')::date);", "v_val := coalesce(v_val, current_date);"),
      "asof-not-IST-today",
    ],
    "epoch hook on a dependency dropped": [(s) => s.replace(/CREATE TRIGGER wp04_readiness_epoch_[0-9a-f]+ AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON costing\.sku_selling_price_policy[^;]*;/, ""), "dependency-change-not-invalidated"],
    "MRP essential ignored by the helper (trigger dropped too)": [
      (s) => dropTrigger("trg_sku_activation_completeness_guard")(s).replace("fn_resolve_sku_mrp_as_of(p_sku_id, v_val) m limit 1), '') <> 'RESOLVED'", "fn_resolve_sku_mrp_as_of(p_sku_id, v_val) m limit 1), '') <> 'RESOLVED' and false"),
      "activation-with-missing-essential-accepted",
    ],
  };
  for (const [name, [fn, expected]] of Object.entries(mutants)) {
    const mutated = fn(base);
    if (mutated === base) {
      check(`MU ${name}`, "mutation applies", false, "no textual change");
      continue;
    }
    const bad = invariants(mutated);
    check(`MU ${Object.keys(mutants).indexOf(name) + 1}`, `${name} is DETECTED`, bad.includes(expected), `violations=${bad.join(",") || "none"}`);
  }
} finally {
  cluster.stop();
}
console.log(failed() ? `\n${failed()} FAILED` : "\nALL PASSED");
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ results }, null, 2) + "\n");
process.exit(failed() ? 1 : 0);
