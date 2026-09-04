import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const {
  isWorkerStartEligible,
  startableEntryStatusReason,
} = require(join(root, "electron/eaushadhi-worker/preflight-eligibility.js"));

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

assert(
  isWorkerStartEligible({ isReadyForEntry: true, entryStatus: "NOT_STARTED" }) === true,
  "NOT_STARTED + ready can be eligible",
);
assert(
  isWorkerStartEligible({ isReadyForEntry: false, entryStatus: "NOT_STARTED" }) === false,
  "NOT_STARTED without readiness is ineligible",
);
assert(
  isWorkerStartEligible({ isReadyForEntry: true, entryStatus: "PORTAL_VERIFIED" }) === false,
  "PORTAL_VERIFIED is not startable",
);
assert(
  startableEntryStatusReason("PORTAL_VERIFIED") === "ENTRY_STATUS_NOT_STARTABLE: PORTAL_VERIFIED",
  "PORTAL_VERIFIED reason is explicit",
);
assert(
  isWorkerStartEligible({ isReadyForEntry: true, entryStatus: "SUBMITTED" }) === false,
  "SUBMITTED is not startable",
);
assert(
  startableEntryStatusReason("SUBMITTED") === "ENTRY_STATUS_NOT_STARTABLE: SUBMITTED",
  "SUBMITTED reason is explicit",
);
assert(
  isWorkerStartEligible({ isReadyForEntry: true, entryStatus: "IN_PROGRESS" }) === false,
  "IN_PROGRESS stays ineligible until a governed resume path exists",
);
assert(
  isWorkerStartEligible({ isReadyForEntry: true, entryStatus: "ENTERED" }) === false,
  "ENTERED stays ineligible until a governed recovery path exists",
);

const sql = readFileSync(
  join(root, "supabase/migrations/20260904092744_eaushadhi_worker_foundation_hardening.sql"),
  "utf8",
);
assert(sql.includes("ENTRY_STATUS_NOT_STARTABLE"), "hardening SQL names ENTRY_STATUS_NOT_STARTABLE");
assert(sql.includes("= 'NOT_STARTED'"), "hardening SQL requires NOT_STARTED for eligibility");
assert(sql.includes("'portal_product_name', d.portal_product_name"), "payload uses d.portal_product_name");
assert(!sql.includes("'portal_product_name', null"), "payload no longer hard-codes null portal name");
assert(sql.includes("revoke all on function public.rpc_eaushadhi_worker_preflight(integer) from anon"), "anon execute revoked");
assert(!/rpc_eaushadhi_worker_run_begin/.test(sql), "no run_begin RPC");

function hashCanonical(payload) {
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}
const base = {
  product: { product_id: 1, canonical_product_name: "Internal", portal_product_name: "Portal A" },
};
const same = hashCanonical(base);
const sameAgain = hashCanonical({
  product: { product_id: 1, canonical_product_name: "Internal", portal_product_name: "Portal A" },
});
assert(same === sameAgain, "unchanged portal_product_name keeps a deterministic hash");
const changed = hashCanonical({
  product: { product_id: 1, canonical_product_name: "Internal", portal_product_name: "Portal B" },
});
assert(same !== changed, "changing portal_product_name changes the canonical hash");

if (failed) {
  console.error(`\n${failed} preflight/payload hardening assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-worker-preflight-payload-hardening-smoke: all assertions passed");
