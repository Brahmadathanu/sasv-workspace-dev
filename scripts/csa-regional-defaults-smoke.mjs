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
  CSA_DEFAULT_POLICY_SCOPE_LABELS,
  CSA_DEFAULT_POLICY_SCOPES_COMPANY,
  CSA_DEFAULT_POLICY_SCOPES_REGIONAL,
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
    "NO_ELIGIBLE_REGIONAL_HISTORY,NO_POSITIVE_REGIONAL_HISTORY,NON_POSITIVE_NET_ACTUAL_HISTORY",
  "three regional scenarios catalogued including NON_POSITIVE",
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
    CSA_SCENARIO_BUSINESS_LABELS.NON_POSITIVE_NET_ACTUAL_HISTORY ===
      "Non-positive net actual history" &&
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
    typesSrc.includes("rpc_set_regional_sales_allocation_default_policy") &&
    typesSrc.includes("rpc_preview_sales_allocation_default_policy_scope") &&
    typesSrc.includes("rpc_set_sales_allocation_default_policies_scoped"),
  "generated supabase.ts includes regional + scoped preview/commit RPCs",
);
assert(
  /rpc_set_regional_sales_allocation_default_policy:\s*\{[\s\S]*?p_region_code:\s*string/.test(
    typesSrc,
  ),
  "generated SET args include p_region_code",
);

assert(
  csaSrc.includes("rpc_preview_sales_allocation_default_policy_scope") &&
    csaSrc.includes("rpc_set_sales_allocation_default_policies_scoped"),
  "CSA revise uses preview + scoped commit RPCs",
);
assert(
  csaSrc.includes("THIS_POLICY") &&
    csaSrc.includes("SAME_REGION_LINKED") &&
    csaSrc.includes("ALL_REGIONAL") &&
    csaSrc.includes("ALL_COMPANY") &&
    csaSrc.includes("ALL_LINKED"),
  "all required scope codes present in CSA client",
);
assert(
  csaSrc.includes("All linked fallback policies") &&
    htmlSrc.includes("csaDefaultPolicyImpactPreview") &&
    htmlSrc.includes("csaDefaultPolicyScopeOptions"),
  "scope UX + impact preview hosts present",
);
assert(
  !csaSrc.includes("const CSA_ALL_LINKED_TARGET_COUNT = 8") &&
    !csaSrc.includes("ALL_LINKED_TARGETS = ["),
  "client does not hard-code authoritative ALL_LINKED target list",
);
assert(
  csaSrc.includes("REGIONAL_DEFAULT_POLICY_UNITS") &&
    csaSrc.includes("GOVERNED_REGIONAL_DEFAULT") &&
    csaSrc.includes("NON_POSITIVE_NET_ACTUAL_HISTORY"),
  "default source token set includes regional governed tokens",
);
assert(
  csaSrc.includes("rpc_get_sku_sales_assumptions") &&
    csaSrc.includes("rpc_set_sku_sales_assumption") &&
    csaSrc.includes("rpc_close_sku_sales_assumption"),
  "explicit SKU assumption RPCs remain",
);
assert(
  ppmSrc.includes('commercial-sales-assumptions') ||
    ppmSrc.includes("COMMERCIAL_SALES_ASSUMPTIONS_WORKSPACE_ID"),
  "PPM routing still references CSA workspace",
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
  /#csaDefaultsHubModal\s+\.cost-sheet-sign-panel\s*\{[\s\S]*?width:\s*min\(1080px,\s*92vw\)/.test(
    htmlSrc,
  ) &&
    /#csaDefaultsHubModal\s+\.cost-sheet-sign-panel\s*\{[\s\S]*?max-height:\s*min\(90vh,\s*920px\)/.test(
      htmlSrc,
    ) &&
    /#csaDefaultsHubModal\s+\.cost-sheet-sign-body\s*\{[\s\S]*?overflow-y:\s*auto/.test(
      htmlSrc,
    ),
  "scoped Defaults hub width/height and body scroll exist",
);
assert(
  !/id="csaDefaultsHubModal"[\s\S]*?style="max-width:\s*800px"/.test(htmlSrc),
  "ineffective inline max-width:800px removed from Defaults hub",
);
assert(
  htmlSrc.includes(".cp-csa-hub-company-grid") &&
    csaSrc.includes("cp-csa-hub-company-grid"),
  "company grid class exists in CSS and render",
);
assert(
  htmlSrc.includes(".cp-csa-hub-region-pair") &&
    csaSrc.includes("cp-csa-hub-region-pair"),
  "regional pair structure retained",
);
assert(
  csaSrc.includes('class="cp-csa-hub-reason"') &&
    csaSrc.includes("<summary>Reason</summary>"),
  "Reason disclosure exists",
);
assert(
  csaSrc.includes('class="cp-csa-hub-history"') &&
    csaSrc.includes("Previous revisions ("),
  "history disclosure exists",
);
assert(
  csaSrc.includes("data-csa-revise-kind=") &&
    csaSrc.includes("data-csa-revise-scenario=") &&
    csaSrc.includes("data-csa-revise-region=") &&
    csaSrc.includes("wireDefaultsHubReviseButtons"),
  "existing Revise wiring remains present",
);
assert(
  !csaSrc.includes("loadSkuStatusDiagnosis") &&
    !csaSrc.includes("v_costing_pricing_sku_status_diagnosis"),
  "CSA module does not touch diagnosis loader",
);
assert(
  csaSrc.includes("Company-wide defaults") &&
    csaSrc.includes("Regional defaults") &&
    csaSrc.includes("Default sales units"),
  "hub sections and default-sales-units label present",
);
assert(
  /higher-precedence[\s\S]*positive\s+forward costing basis/i.test(csaSrc) &&
    /non-positive net actual history/i.test(csaSrc) &&
    !/region has no positive\s+actual sales evidence/i.test(csaSrc),
  "regional defaults copy covers NON_POSITIVE without implying absent actuals",
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
assert(
  !fs.existsSync(
    path.join(
      root,
      "supabase/migrations/20260915100000_sales_allocation_default_policy_foundation_parity.sql",
    ),
  ),
  "invented company foundation parity migration removed",
);
assert(
  fs.existsSync(
    path.join(
      root,
      "supabase/migrations/20260915162212_csa_scoped_rpc_acl_hardening.sql",
    ),
  ),
  "live-versioned CSA scoped RPC ACL parity migration exists",
);
assert(
  fs.existsSync(
    path.join(
      root,
      "supabase/migrations/20260915103000_csa_scenario_owned_fallback_units_scoped_set.sql",
    ),
  ),
  "prospective CSA scenario-owned scoped-set migration exists",
);

const prospectiveSql = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260915103000_csa_scenario_owned_fallback_units_scoped_set.sql",
  ),
  "utf8",
);
assert(
  prospectiveSql.includes("fn_expand_sales_allocation_default_policy_scope") &&
    prospectiveSql.includes("rpc_preview_sales_allocation_default_policy_scope") &&
    prospectiveSql.includes("rpc_set_sales_allocation_default_policies_scoped") &&
    prospectiveSql.includes("NON_POSITIVE_NET_ACTUAL_HISTORY") &&
    prospectiveSql.includes("create table if not exists costing.sales_allocation_default_policy") &&
    prospectiveSql.includes("rpc_get_sales_allocation_default_policies") &&
    !/from costing\.fn_resolve_sales_planning_fallback_units_as_of/i.test(
      prospectiveSql.replace(
        /comment on function costing\.fn_resolve_sales_planning_fallback_units_as_of[\s\S]*?;/gi,
        "",
      ),
    ),
  "prospective migration restores scenario ownership, company GET, and scoped RPCs",
);
assert(
  /to_regprocedure\(\s*'costing\.rpc_create_sales_planning_fallback_unit_policy\(numeric,date,text,text\)'/i.test(
    prospectiveSql,
  ) &&
    /revoke all on function costing\.rpc_create_sales_planning_fallback_unit_policy/i.test(
      prospectiveSql,
    ),
  "temporary shared fallback create RPC revoked conditionally for fresh bootstrap",
);
assert(
  /revoke all on function costing\.fn_revise_sales_allocation_default_policy[\s\S]*from public, anon, authenticated/i.test(
    prospectiveSql,
  ) &&
    /revoke all on function costing\.fn_revise_regional_sales_allocation_default_policy[\s\S]*from public, anon, authenticated/i.test(
      prospectiveSql,
    ) &&
    !/grant execute on function costing\.fn_revise_sales_allocation_default_policy/i.test(
      prospectiveSql,
    ) &&
    !/grant execute on function costing\.fn_revise_regional_sales_allocation_default_policy/i.test(
      prospectiveSql,
    ),
  "internal SECURITY DEFINER mutation helpers revoked from PUBLIC/anon/authenticated",
);

const sourceConstraintsSql = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260912105216_regional_sales_default_policy_source_constraints.sql",
  ),
  "utf8",
);
assert(
  sourceConstraintsSql.includes("SOURCE-CONTROL PARITY") &&
    sourceConstraintsSql.includes("DO NOT reapply to production") &&
    sourceConstraintsSql.includes(
      "20260912105216_regional_sales_default_policy_source_constraints",
    ),
  "source-constraints parity header present",
);
assert(
  sourceConstraintsSql.includes("sku_regional_marketing_basis_source_chk") &&
    sourceConstraintsSql.includes(
      "sku_regional_marketing_allocation_value_source_chk",
    ) &&
    sourceConstraintsSql.includes("REGIONAL_DEFAULT_POLICY_UNITS") &&
    sourceConstraintsSql.includes("GOVERNED_REGIONAL_DEFAULT") &&
    sourceConstraintsSql.includes(
      "sku_regional_marketing_allocation_basis_snapshot",
    ) &&
    sourceConstraintsSql.includes(
      "sku_regional_marketing_expense_allocation_snapshot",
    ),
  "source-constraints parity SQL covers live check targets",
);
assert(
  !/\b(insert|update|delete|truncate)\b/i.test(
    sourceConstraintsSql.replace(/--[^\n]*/g, ""),
  ),
  "source-constraints parity SQL has no DML",
);

function firstCssBlock(src, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = src.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  return match ? match[1] : "";
}

const revisionPanelDesktopCss = firstCssBlock(
  htmlSrc,
  "#csaDefaultPolicyModal .cost-sheet-sign-panel",
);
const revisionBodyCss = firstCssBlock(
  htmlSrc,
  "#csaDefaultPolicyModal .cost-sheet-sign-body",
);
const revisionChromeMatch = htmlSrc.match(
  /#csaDefaultPolicyModal\s+\.cost-sheet-sign-header,\s*#csaDefaultPolicyModal\s+\.cost-sheet-sign-actions\s*\{([\s\S]*?)\}/,
);
const revisionPreviewTableCss = firstCssBlock(
  htmlSrc,
  "#csaDefaultPolicyModal .cp-csa-impact-preview .table-scroll",
);
const scopeOptionsCss = firstCssBlock(htmlSrc, ".cp-csa-scope-options");
const scopeOptionCss = firstCssBlock(htmlSrc, ".sign-grid .cp-csa-scope-option");
const scopeRadioCss = firstCssBlock(
  htmlSrc,
  '.sign-grid .cp-csa-scope-option input[type="radio"]',
);
const overlayCss = firstCssBlock(htmlSrc, ".cost-sheet-sign-modal");
const sharedMobileWorkflowMatch = htmlSrc.match(
  /@media \(max-width: 620px\)\s*\{[\s\S]*?\.cp-policy-workflow-modal\s*\{([\s\S]*?)\}[\s\S]*?\.cp-policy-workflow-modal\s+\.cost-sheet-sign-panel\s*\{([\s\S]*?)\}/,
);
const csaMobilePanelMatch = htmlSrc.match(
  /@media \(max-width: 620px\)\s*\{\s*#csaDefaultPolicyModal\s+\.cost-sheet-sign-panel\s*\{([\s\S]*?)\}/,
);

assert(
  /display:\s*flex/.test(revisionPanelDesktopCss) &&
    /flex-direction:\s*column/.test(revisionPanelDesktopCss) &&
    /min-height:\s*0/.test(revisionPanelDesktopCss) &&
    /max-height:\s*calc\(100dvh\s*-\s*28px\)/.test(revisionPanelDesktopCss) &&
    !/min-height:\s*100dvh/.test(revisionPanelDesktopCss),
  "CSA revision panel is flex column with viewport-safe desktop max-height",
);
assert(
  /flex:\s*1 1 auto/.test(revisionBodyCss) &&
    /min-height:\s*0/.test(revisionBodyCss) &&
    /overflow-y:\s*auto/.test(revisionBodyCss) &&
    /overflow-x:\s*hidden/.test(revisionBodyCss),
  "CSA revision body owns vertical scrolling",
);
assert(
  revisionChromeMatch && /flex:\s*0 0 auto/.test(revisionChromeMatch[1]),
  "CSA revision header/footer are non-growing",
);
assert(
  /padding:\s*14px/.test(overlayCss) &&
    !/min-height:\s*100dvh/.test(revisionPanelDesktopCss),
  "desktop overlay padding is not paired with CSA panel min-height:100dvh",
);
assert(
  sharedMobileWorkflowMatch &&
    /padding:\s*0/.test(sharedMobileWorkflowMatch[1]) &&
    /min-height:\s*100dvh/.test(sharedMobileWorkflowMatch[2]) &&
    /max-height:\s*100dvh/.test(sharedMobileWorkflowMatch[2]),
  "shared <=620px workflow overlay padding 0 + panel 100dvh remains intact",
);
assert(
  csaMobilePanelMatch &&
    /max-height:\s*100dvh/.test(csaMobilePanelMatch[1]) &&
    /min-height:\s*100dvh/.test(csaMobilePanelMatch[1]),
  "<=620px CSA revision panel uses exact 100dvh after overlay padding 0",
);
assert(
  /flex:\s*0 0 auto/.test(revisionPreviewTableCss) &&
    /overflow-x:\s*auto/.test(revisionPreviewTableCss) &&
    /overflow-y:\s*visible/.test(revisionPreviewTableCss),
  "CSA impact preview table does not own vertical scrolling",
);
assert(
  /display:\s*flex/.test(scopeOptionsCss) &&
    /flex-direction:\s*column/.test(scopeOptionsCss) &&
    /align-items:\s*flex-start/.test(scopeOptionsCss) &&
    !/display:\s*grid/.test(scopeOptionsCss),
  "CSA scope options are a compact column, not a stretching grid",
);
assert(
  /display:\s*inline-flex/.test(scopeOptionCss) &&
    /flex-direction:\s*row/.test(scopeOptionCss) &&
    /width:\s*fit-content/.test(scopeOptionCss) &&
    /align-items:\s*center/.test(scopeOptionCss),
  "CSA scope labels are compact inline-flex rows",
);
assert(
  /width:\s*auto/.test(scopeRadioCss) &&
    /min-height:\s*0/.test(scopeRadioCss) &&
    /padding:\s*0/.test(scopeRadioCss) &&
    /flex:\s*0 0 auto/.test(scopeRadioCss),
  "CSA radios override .sign-grid input stretch sizing",
);
assert(
  csaSrc.includes(
    'return `<label class="cp-csa-scope-option" for="${id}"><input type="radio" name="csaDefaultPolicyScope" id="${id}" value="${scope}" ${checked} /> <span>${text(label)}</span></label>`;',
  ),
  "native radio name/id/value and span label text retained",
);
assert(
  CSA_DEFAULT_POLICY_SCOPES_COMPANY.join(",") ===
    "THIS_POLICY,ALL_COMPANY,ALL_LINKED",
  "company scope array unchanged",
);
assert(
  CSA_DEFAULT_POLICY_SCOPES_REGIONAL.join(",") ===
    "THIS_POLICY,SAME_REGION_LINKED,ALL_REGIONAL,ALL_LINKED",
  "regional scope array unchanged",
);
assert(
  CSA_DEFAULT_POLICY_SCOPE_LABELS.THIS_POLICY === "This policy only" &&
    CSA_DEFAULT_POLICY_SCOPE_LABELS.ALL_COMPANY ===
      "Both company fallback policies" &&
    CSA_DEFAULT_POLICY_SCOPE_LABELS.SAME_REGION_LINKED ===
      "All linked fallbacks in this region" &&
    CSA_DEFAULT_POLICY_SCOPE_LABELS.ALL_REGIONAL ===
      "All regional fallback policies" &&
    CSA_DEFAULT_POLICY_SCOPE_LABELS.ALL_LINKED ===
      "All linked fallback policies",
  "scope labels unchanged",
);

if (failed) {
  console.error(`\n${failed} CSA regional-defaults smoke assertion(s) failed`);
  process.exit(1);
}
console.log("\nCSA regional-defaults smoke passed");
