/**
 * Portal contract incomplete + allowed-origin protection.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const {
  requireContract,
  assertAllowedUrl,
  loadPortalContract,
  getContractCompleteness,
} = require(join(root, "electron/eaushadhi-worker/contracts/portal-contract.js"));

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

const contract = loadPortalContract();
let incomplete = null;
try {
  requireContract("productDetails", contract);
} catch (error) {
  incomplete = error;
}
assert(incomplete?.kind === "CONTRACT_INCOMPLETE", "populated productDetails remains CONTRACT_INCOMPLETE");

const authProbe = requireContract("authProbe", contract);
assert(authProbe.logoutSelector === "#logoutForm", "authProbe contract is complete");

let lookupIncomplete = null;
try {
  requireContract("productLookup", contract);
} catch (error) {
  lookupIncomplete = error;
}
assert(lookupIncomplete?.kind === "CONTRACT_INCOMPLETE", "productLookup remains CONTRACT_INCOMPLETE");

let pharmIncomplete = null;
try {
  requireContract("pharmacologicalActions", contract);
} catch (error) {
  pharmIncomplete = error;
}
assert(pharmIncomplete?.kind === "CONTRACT_INCOMPLETE", "pharmacologicalActions remains CONTRACT_INCOMPLETE");

const completeness = getContractCompleteness(contract);
assert(completeness.origins === true, "origin contract is known");
assert(completeness.authProbe === true, "authProbe completeness is true");
assert(completeness.productLookup === false, "productLookup remains incomplete");
assert(completeness.productDetails === false, "productDetails completeness is false");
assert(completeness.pharmacologicalActions === false, "pharmacologicalActions completeness is false");
assert(completeness.saveUpdate === false, "saveUpdate remains incomplete");
assert(completeness.reread === false, "reread remains incomplete");

assertAllowedUrl("https://www.e-aushadhi.gov.in/login", contract);
let blocked = null;
try {
  assertAllowedUrl("https://example.com/", contract);
} catch (error) {
  blocked = error;
}
assert(blocked?.kind === "DISALLOWED_ORIGIN", "foreign origin is DISALLOWED_ORIGIN");
assert(blocked?.kind !== "CONTRACT_INCOMPLETE", "origin escape is not CONTRACT_INCOMPLETE");

if (failed) {
  console.error(`\n${failed} contract assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-worker-contract-smoke: all assertions passed");
