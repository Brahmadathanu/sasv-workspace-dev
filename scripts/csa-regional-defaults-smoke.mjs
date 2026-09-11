/**
 * CSA regional sales-allocation defaults — focused contract / helper smoke.
 * Does not call live SET RPCs and does not mutate production policy values.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COMMERCIAL_SALES_ASSUMPTIONS_WORKSPACE_ID,
  CSA_DEFAULT_POLICY_FUTURE_REFRESH_MESSAGE,
  CSA_DEFAULT_SCENARIOS,
  CSA_REGIONAL_DEFAULT_REGIONS,
  CSA_REGIONAL_DEFAULT_SCENARIOS,
  CSA_REGION_BUSINESS_LABELS,
  CSA_SCENARIO_BUSINESS_LABELS,
  defaultPolicyRowId,
  isOpenDefaultPolicy,
  pickCurrentDefaultPolicy,
  pickCurrentRegionalDefaultPolicy,
  previousDefaultPolicyRevisions,
  regionBusinessLabel,
  scenarioBusinessLabel,
} from "../public/shared/js/costing-suite-commercial-sales-assumptions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log("OK", msg);
  else {
    failed += 1;
    console.error("FAIL", msg);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const csaSrc = read("public/shared/js/costing-suite-commercial-sales-assumptions.js");
const htmlSrc = read("public/shared/pricing-policy-manager.html");
const typesSrc = read("public/shared/js/types/supabase.ts");
const ppmSrc = read("public/shared/js/costing-suite-pricing-policy.js");

assert(
  csaSrc.includes("rpc_get_regional_sales_allocation_default_policies"),
  "regional GET RPC referenced in CSA module",
);
assert(
  csaSrc.includes("rpc_set_regional_sales_allocation_default_policy"),
  "regional SET RPC referenced in CSA module",
);
assert(
  (csaSrc.match(/COMMERCIAL_SALES_ASSUMPTIONS_WORKSPACE_ID/g) || []).length >= 1 &&
    !csaSrc.includes("regional-sales-defaults") &&
    !htmlSrc.includes('id="regionalSalesDefaults'),
  "no new workspace ID / standalone regional defaults page",
);
assert(
  COMMERCIAL_SALES_ASSUMPTIONS_WORKSPACE_ID === "commercial-sales-assumptions",
  "existing CSA workspace id unchanged",
);
assert(
  CSA_REGIONAL_DEFAULT_SCENARIOS.join(",") ===
    "NO_ELIGIBLE_REGIONAL_HISTORY,NO_POSITIVE_REGIONAL_HISTORY",
  "two regional scenarios catalogued",
);
assert(
  CSA_REGIONAL_DEFAULT_REGIONS.join(",") === "IK,OK",
  "IK / OK regional catalog",
);
assert(
  CSA_DEFAULT_SCENARIOS.join(",") ===
    "NEW_SKU_EXISTING_PRODUCT,NEW_PRODUCT_NO_HISTORY",
  "company-wide scenarios unchanged",
);
assert(
  CSA_SCENARIO_BUSINESS_LABELS.NO_ELIGIBLE_REGIONAL_HISTORY ===
    "No regional sales history" &&
    CSA_SCENARIO_BUSINESS_LABELS.NO_POSITIVE_REGIONAL_HISTORY ===
      "No positive regional sales quantity" &&
    CSA_REGION_BUSINESS_LABELS.IK === "Inside Kerala" &&
    CSA_REGION_BUSINESS_LABELS.OK === "Outside Kerala",
  "regional business labels",
);
assert(
  scenarioBusinessLabel("NO_ELIGIBLE_REGIONAL_HISTORY") ===
    "No regional sales history" &&
    regionBusinessLabel("OK") === "Outside Kerala",
  "label helpers",
);

const approvedOpen = {
  id: 4,
  scenario_code: "NO_ELIGIBLE_REGIONAL_HISTORY",
  region_code: "IK",
  status: "APPROVED",
  effective_from: "2026-09-10",
  effective_to: null,
  default_sales_units: 11,
};
const closedOlder = {
  policy_id: 1,
  scenario_code: "NO_ELIGIBLE_REGIONAL_HISTORY",
  region_code: "IK",
  status: "CLOSED",
  effective_from: "2026-07-01",
  effective_to: "2026-09-09",
  default_sales_units: 9,
};
const closedNewerThanFallback = {
  id: 3,
  scenario_code: "NO_ELIGIBLE_REGIONAL_HISTORY",
  region_code: "IK",
  status: "CLOSED",
  effective_from: "2026-08-01",
  effective_to: "2026-09-09",
  default_sales_units: 8,
};
const activeOpenOk = {
  id: 7,
  scenario_code: "NO_POSITIVE_REGIONAL_HISTORY",
  region_code: "OK",
  status: "ACTIVE",
  effective_from: "2026-01-01",
  effective_to: null,
  default_sales_units: 12,
};
const companyApproved = {
  policy_id: 2,
  scenario_code: "NEW_SKU_EXISTING_PRODUCT",
  status: "APPROVED",
  effective_from: "2026-07-01",
  effective_to: null,
  default_sales_units: 15,
};
const companyClosed = {
  policy_id: 1,
  scenario_code: "NEW_SKU_EXISTING_PRODUCT",
  status: "CLOSED",
  effective_from: "2026-01-01",
  effective_to: "2026-06-30",
  default_sales_units: 5,
};

assert(isOpenDefaultPolicy(approvedOpen) === true, "APPROVED + null effective_to is open");
assert(isOpenDefaultPolicy(activeOpenOk) === true, "ACTIVE + null effective_to remains open");
assert(isOpenDefaultPolicy(closedOlder) === false, "CLOSED is not open");
assert(
  pickCurrentRegionalDefaultPolicy(
    [closedOlder, closedNewerThanFallback, approvedOpen],
    "NO_ELIGIBLE_REGIONAL_HISTORY",
    "IK",
  ) === approvedOpen,
  "picker prefers open APPROVED over CLOSED history",
);
assert(
  pickCurrentRegionalDefaultPolicy(
    [closedOlder, activeOpenOk],
    "NO_POSITIVE_REGIONAL_HISTORY",
    "OK",
  ) === activeOpenOk,
  "picker still accepts ACTIVE open rows",
);
assert(
  pickCurrentDefaultPolicy(
    [companyClosed, companyApproved],
    "NEW_SKU_EXISTING_PRODUCT",
  ) === companyApproved,
  "company picker prefers APPROVED open over CLOSED",
);
assert(defaultPolicyRowId({ id: 4, policy_id: 99 }) === 4, "identity prefers id");
assert(defaultPolicyRowId({ policy_id: 99 }) === 99, "identity falls back to policy_id");
assert(
  previousDefaultPolicyRevisions(
    [approvedOpen, closedOlder, closedNewerThanFallback],
    approvedOpen,
    (row) =>
      row.scenario_code === "NO_ELIGIBLE_REGIONAL_HISTORY" &&
      row.region_code === "IK",
  ).map((row) => defaultPolicyRowId(row)).join(",") === "3,1",
  "history excludes current open revision and sorts newest first",
);

assert(
  (htmlSrc.match(/id="csaDefaultsHubModal"/g) || []).length === 1,
  "one defaults hub remains",
);
assert(
  (htmlSrc.match(/id="csaDefaultPolicyModal"/g) || []).length === 1,
  "one revision modal remains",
);
assert(
  htmlSrc.includes('id="csaDefaultPolicyRegionWrap"') &&
    htmlSrc.includes('id="csaDefaultPolicyRegion"') &&
    /id="csaDefaultPolicyRegionWrap"[^>]*hidden/.test(htmlSrc) &&
    htmlSrc.includes("readonly"),
  "readonly regional context exists in revision modal",
);
assert(
  CSA_DEFAULT_POLICY_FUTURE_REFRESH_MESSAGE ===
    "Default policy saved. It will apply to a future costing refresh whose governed valuation date falls within its effective period. Completed refresh runs are unchanged.",
  "future-refresh message unchanged",
);

const csaWithoutHistoricalToken = csaSrc.replaceAll("DEFAULT_10_UNITS", "");
assert(
  !/(?:default_sales_units|Default sales units)[^\n]{0,80}\b10\b/i.test(
    csaWithoutHistoricalToken,
  ) && !csaSrc.includes('placeholder="10'),
  "no literal policy quantity 10 in CSA UI implementation",
);

assert(
  typesSrc.includes("rpc_get_regional_sales_allocation_default_policies") &&
    typesSrc.includes("rpc_set_regional_sales_allocation_default_policy"),
  "generated supabase.ts includes both regional RPCs",
);
assert(
  /rpc_set_regional_sales_allocation_default_policy:\s*\{[\s\S]*?p_region_code:\s*string/.test(
    typesSrc,
  ),
  "generated SET args include p_region_code",
);

assert(
  !csaSrc.includes("rpc_request_costing_refresh") &&
    !csaSrc.includes("rpc_request_costing_refresh_run"),
  "default save does not invoke costing-refresh RPC",
);
assert(
  !csaSrc.includes('costingFrom("regional_sales_allocation_default_policy")') &&
    !csaSrc.includes(
      'costingFrom("sku_regional_marketing_allocation_basis_snapshot")',
    ) &&
    !csaSrc.includes(".insert(") &&
    !csaSrc.includes(".update(") &&
    !csaSrc.includes(".upsert("),
  "no direct write to costing tables from CSA client",
);
assert(
  !csaSrc.includes("rpc_set_sku_regional_sales_assumption") &&
    !csaSrc.includes("rpc_get_sku_regional_sales_assumptions"),
  "defaults hub does not create SKU regional assumptions",
);
assert(
  htmlSrc.includes('id="csaDefaultsHubBody"'),
  "hub body host remains",
);
assert(
  csaSrc.includes("Company-wide defaults") &&
    csaSrc.includes("Regional defaults") &&
    csaSrc.includes("Default sales units"),
  "hub sections and default-sales-units label present",
);
assert(
  !ppmSrc.includes("rpc_set_regional_sales_allocation_default_policy"),
  "pricing-policy.js not given a parallel regional-default write path",
);

assert(
  fs.existsSync(
    path.join(
      root,
      "supabase/migrations/20260910154540_regional_sales_default_policy_foundation.sql",
    ),
  ) &&
    fs.existsSync(
      path.join(
        root,
        "supabase/migrations/20260910154713_regional_sales_default_policy_snapshot_integration.sql",
      ),
    ),
  "live-versioned regional default parity migrations exist",
);

if (failed) {
  console.error(`\n${failed} CSA regional-defaults smoke assertion(s) failed`);
  process.exit(1);
}
console.log("\nCSA regional-defaults smoke passed");
