/**
 * Static migration-chain / privilege parity smoke for CSA scoped fallback.
 * Does NOT apply migrations. Does NOT touch live production / Run108 / refresh.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL: ${msg}`);
  } else {
    console.log(`PASS: ${msg}`);
  }
}

const migDir = path.join(root, "supabase/migrations");
const prospectiveName =
  "20260915103000_csa_scenario_owned_fallback_units_scoped_set.sql";
const fakeParityName =
  "20260915100000_sales_allocation_default_policy_foundation_parity.sql";
const fallbackParityName =
  "20260915085019_canonical_sales_planning_fallback_units.sql";
const nonposParityName =
  "20260915074731_marketing_policy_v2_nonpositive_net_actual_fallback_v2.sql";

const liveLedgerVersions = new Set([
  "20260915074731",
  "20260915085019",
  // Prospective is NOT live-applied; must remain only as repo prospective file.
]);

assert(!fs.existsSync(path.join(migDir, fakeParityName)), "no invented 20260915100000 parity migration");

const prospectivePath = path.join(migDir, prospectiveName);
assert(fs.existsSync(prospectivePath), "prospective migration exists");
const prospectiveSql = fs.readFileSync(prospectivePath, "utf8");

assert(
  /create table if not exists costing\.sales_allocation_default_policy/i.test(
    prospectiveSql,
  ),
  "prospective creates company default policy table (bootstrap-safe)",
);
assert(
  /create or replace function public\.rpc_get_sales_allocation_default_policies\s*\(/i.test(
    prospectiveSql,
  ),
  "company GET RPC exists in prospective migration",
);
assert(
  /create or replace function costing\.fn_resolve_sales_allocation_default_policy_as_of\s*\(/i.test(
    prospectiveSql,
  ),
  "company as-of resolver exists in prospective migration",
);
assert(
  /create or replace function public\.rpc_set_sales_allocation_default_policy\s*\(/i.test(
    prospectiveSql,
  ),
  "single company SET compatibility RPC exists in prospective migration",
);

assert(
  /to_regprocedure\(\s*'costing\.rpc_create_sales_planning_fallback_unit_policy\(numeric,date,text,text\)'/i.test(
    prospectiveSql,
  ),
  "fallback create deprecation is guarded with to_regprocedure",
);
assert(
  !/^revoke all on function costing\.rpc_create_sales_planning_fallback_unit_policy/im.test(
    prospectiveSql.split("$deprecate$")[0] || "",
  ),
  "unguarded top-level revoke of missing create RPC is absent before guarded block",
);

const reviseCompany =
  /revoke all on function costing\.fn_revise_sales_allocation_default_policy\(uuid,\s*text,\s*numeric,\s*date,\s*text,\s*text\)\s+from public,\s*anon,\s*authenticated/i.test(
    prospectiveSql,
  );
const reviseRegional =
  /revoke all on function costing\.fn_revise_regional_sales_allocation_default_policy\(uuid,\s*text,\s*text,\s*numeric,\s*date,\s*text,\s*text\)\s+from public,\s*anon,\s*authenticated/i.test(
    prospectiveSql,
  );
assert(reviseCompany, "company revise helper revoked from PUBLIC/anon/authenticated");
assert(reviseRegional, "regional revise helper revoked from PUBLIC/anon/authenticated");
assert(
  !/grant execute on function costing\.fn_revise_(sales_allocation_default_policy|regional_sales_allocation_default_policy)/i.test(
    prospectiveSql,
  ),
  "no EXECUTE grant on internal mutation helpers",
);

// Live-versioned parity files must match real ledger versions and contain required bodies.
for (const [file, version, mustInclude] of [
  [
    fallbackParityName,
    "20260915085019",
    [
      "SOURCE-CONTROL PARITY",
      "DO NOT reapply to production",
      "create table if not exists costing.sales_planning_fallback_unit_policy",
      "costing.rpc_create_sales_planning_fallback_unit_policy",
      "fn_resolve_sales_planning_fallback_units_as_of",
    ],
  ],
  [
    nonposParityName,
    "20260915074731",
    [
      "SOURCE-CONTROL PARITY",
      "DO NOT reapply to production",
      "NON_POSITIVE_NET_ACTUAL_HISTORY",
      "fn_apply_regional_default_to_basis_snapshot",
      "marketing_allocation_policy",
    ],
  ],
]) {
  const p = path.join(migDir, file);
  assert(fs.existsSync(p), `parity file exists: ${file}`);
  assert(liveLedgerVersions.has(version), `parity version ${version} is a known live ledger version`);
  assert(file.startsWith(version), `filename version matches ledger ${version}`);
  const sql = fs.readFileSync(p, "utf8");
  for (const needle of mustInclude) {
    assert(sql.includes(needle), `${file} includes ${needle}`);
  }
}

// Prospective must not invent a ledger claim of already-applied.
assert(
  !/DO NOT reapply to production \(already applied\)/i.test(prospectiveSql) &&
    /DO NOT apply to production until audited/i.test(prospectiveSql),
  "prospective remains clearly prospective (not fake already-applied)",
);

// Dependency chain: prospective may reference create RPC only inside guarded deprecation.
const unguardedCreateRef = prospectiveSql
  .replace(/do \$deprecate\$[\s\S]*?\$deprecate\$;/i, "")
  .replace(/comment on function costing\.rpc_create_sales_planning_fallback_unit_policy[\s\S]*?;/gi, "");
assert(
  !/costing\.rpc_create_sales_planning_fallback_unit_policy/i.test(unguardedCreateRef),
  "prospective does not hard-depend on create RPC outside guarded deprecation",
);

assert(
  prospectiveSql.includes("THIS_POLICY") &&
    prospectiveSql.includes("SAME_REGION_LINKED") &&
    prospectiveSql.includes("ALL_REGIONAL") &&
    prospectiveSql.includes("ALL_COMPANY") &&
    prospectiveSql.includes("ALL_LINKED"),
  "approved scope vocabulary preserved",
);

if (failed) {
  console.error(`\n${failed} CSA migration-chain parity smoke assertion(s) failed`);
  process.exit(1);
}
console.log("\nCSA migration-chain parity smoke passed");
