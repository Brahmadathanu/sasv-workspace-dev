/**
 * Gate 11Y.10G.3B.1C — Material Cost Vendor Rate Read Contract Client Cutover.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const materialSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-material-cost.js"),
  "utf8",
);
const typesSrc = readFileSync(
  join(root, "public/shared/js/types/supabase.ts"),
  "utf8",
);
const swSrc = readFileSync(join(root, "public/sw.js"), "utf8");
const remediationSmokeSrc = readFileSync(
  join(root, "scripts/material-remediation-evidence-smoke.mjs"),
  "utf8",
);

assert(
  materialSrc.includes('rpc_get_material_vendor_rate_offers') &&
    materialSrc.includes("fetchVendorOffersForStockItem") &&
    /fetchVendorOffersForStockItem[\s\S]{0,500}rpc_get_material_vendor_rate_offers/.test(
      materialSrc,
    ),
  "Vendor Rate Book offers load via rpc_get_material_vendor_rate_offers",
);

assert(
  !materialSrc.includes("v_proc_vendor_item_rate_effective"),
  "MCM Set Costing Rate path does not use v_proc_vendor_item_rate_effective",
);

assert(
  !/from\(\s*["']proc_vendor["']\s*\)/.test(materialSrc) &&
    !materialSrc.includes('.from("proc_vendor")') &&
    !materialSrc.includes(".from('proc_vendor')"),
  "MCM does not query proc_vendor directly for vendor offers",
);

assert(
  materialSrc.includes('RATE_ORIGIN_MANUAL = "MANUAL_ENTRY"') &&
    materialSrc.includes('RATE_ORIGIN_VENDOR = "VENDOR_RATE_BOOK"') &&
    materialSrc.includes("setManualRateSourceMode"),
  "Manual Entry / Vendor Rate Book modes preserved",
);

assert(
  materialSrc.includes('rpc_set_material_manual_rate') &&
    /p_source_vendor_rate_id[\s\S]{0,200}manualRateSelectedOffer\?\.rate_id/.test(
      materialSrc,
    ) &&
    /p_source_vendor_id[\s\S]{0,200}manualRateSelectedOffer\?\.vendor_id/.test(
      materialSrc,
    ) &&
    /p_rate_origin:\s*manualRateSourceMode/.test(materialSrc),
  "Vendor Rate Book save still calls rpc_set_material_manual_rate with offer provenance",
);

assert(
  materialSrc.includes("isStage05MaterialRemediationMode") &&
    materialSrc.includes("v_costing_pricing_material_action_drilldown_snapshot") &&
    materialSrc.includes("HARD_BLOCKER_ISSUE_CODES"),
  "existing hard-blocker remediation flow unchanged",
);

assert(
  materialSrc.includes("rpc_get_material_rate_rm_cost_trace") &&
    materialSrc.includes("rpc_get_material_rate_pm_cost_trace") &&
    materialSrc.includes("pm-cost-trace") &&
    materialSrc.includes("rm-cost-trace"),
  "PM/RM Trace paths remain present",
);

assert(
  typesSrc.includes("rpc_get_material_vendor_rate_offers") &&
    typesSrc.includes("vendor_display_name") &&
    /rpc_get_material_vendor_rate_offers:[\s\S]{0,400}rate_id/.test(typesSrc),
  "supabase types include deployed vendor-rate offers RPC",
);

assert(
  remediationSmokeSrc.includes("material remediation evidence"),
  "prior remediation smoke retained",
);

assert(
  swSrc.includes('CACHE_NAME = "hub-cache-v242"'),
  "service worker bumped to hub-cache-v242",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll Gate 11Y.10G.3B.1C vendor-rate read-contract smokes passed");
