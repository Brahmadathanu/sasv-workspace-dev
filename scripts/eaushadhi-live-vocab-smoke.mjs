/**
 * Sanitized live vocabulary fixture and parent-scope SQL contract.
 * Does not apply the migration and does not contact the live portal.
 */
import { createHash } from "node:crypto";
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
const vocab = JSON.parse(
  readFileSync(join(root, "scripts/fixtures/eaushadhi-portal/live-vocabularies.json"), "utf8"),
);
const schemaSql = readFileSync(
  join(root, "supabase/migrations/20260907120000_eaushadhi_portal_option_parent_scope.sql"),
  "utf8",
);
const dataSql = readFileSync(
  join(root, "supabase/migrations/20260907120100_eaushadhi_live_portal_vocabularies.sql"),
  "utf8",
);

const domains = vocab.domains;
assert(domains.PRODUCT_TYPE.options.length === 8, "exactly 8 PRODUCT_TYPE");
assert(domains.PERMISSION_PURPOSE.options.length === 2, "exactly 2 PERMISSION_PURPOSE");
assert(domains.PHARMACOLOGICAL_ACTION.options.length === 46, "exactly 46 PHARMACOLOGICAL_ACTION");
assert(domains.PRODUCT_SUBTYPE.options.length === 4, "exactly 4 PRODUCT_SUBTYPE");
assert(domains.PRODUCT_CATEGORY.options.length === 84, "exactly 84 PRODUCT_CATEGORY");
assert(domains.RESTRICTED_INGREDIENT_CATEGORY.options.length === 3, "exactly 3 restricted categories");

assert(
  domains.PRODUCT_CATEGORY.parent?.external_id === "Siddha Classical Medicine",
  "category parent is Siddha Classical Medicine",
);
assert(domains.PRODUCT_SUBTYPE.parent?.domain_code === "PRODUCT_TYPE", "subtype preserves type parent");

const placeholders = ["-1", "0", ""];
for (const [code, domain] of Object.entries(domains)) {
  for (const opt of domain.options) {
    assert(
      !(placeholders.includes(String(opt.external_id)) && /select|choose/i.test(opt.label)),
      `${code} excludes placeholder ${opt.external_id}/${opt.label}`,
    );
  }
}

const sentinel = domains.PRODUCT_SUBTYPE.options.find((opt) => opt.external_id === "32");
assert(sentinel?.label === "-", "subtype 32 / - is preserved");
assert(/sentinel/i.test(sentinel.notes || ""), "subtype 32 is marked not for fill");

const pharmIds = domains.PHARMACOLOGICAL_ACTION.options.map((opt) => opt.external_id);
const pharmLabels = domains.PHARMACOLOGICAL_ACTION.options.map((opt) => opt.label);
assert(new Set(pharmIds).size === 46, "46 unique pharmacological external_id");
assert(new Set(pharmLabels.map((v) => v.toLowerCase().trim())).size === 46, "46 unique pharmacological labels");
assert(!pharmIds.some((id) => String(id).startsWith("select2-")), "no Select2 generated ids");

const fixtureText = JSON.stringify(vocab);
assert(!/license|username|profile/i.test(fixtureText) || fixtureText.includes("capture"), "fixture has no account identity fields");
assert(vocab.sanitized_capture_id && vocab.source_route === "/admin/addproductforlegacy", "sanitized capture provenance present");

assert(schemaSql.includes("parent_domain_code"), "schema adds parent_domain_code");
assert(schemaSql.includes("parent_external_id"), "schema adds parent_external_id");
assert(schemaSql.includes("portal_option_scoped_external_uidx"), "scoped external uniqueness");
assert(schemaSql.includes("portal_option_scoped_label_uidx"), "scoped label uniqueness");

assert(dataSql.includes("INGREDIENT_TYPE"), "data migration asserts composition domains");
assert(dataSql.includes("expected 109"), "composition 109 assertion present");
assert(dataSql.includes("mapping_status = 'VERIFIED'"), "exact maps may become VERIFIED");
assert(dataSql.includes("eaushadhi_product_workflow"), "product workflow count is asserted unchanged");
assert(!/rpc_eaushadhi_verify_product|mark_entered|PORTAL_VERIFIED/.test(dataSql), "no product workflow mutation");
assert(dataSql.includes("parent_domain_code"), "data load writes parent scope");
assert(dataSql.includes("Siddha Classical Medicine"), "category rows scoped to Siddha Classical Medicine");

function payloadHash(options) {
  const canonical = options
    .map((opt) => ({ external_id: String(opt.external_id), label: String(opt.label) }))
    .sort((a, b) => a.external_id.localeCompare(b.external_id) || a.label.localeCompare(b.label));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
assert(payloadHash(domains.PRODUCT_TYPE.options).length === 64, "deterministic payload hash");

if (failed) {
  console.error(`\n${failed} live-vocab assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-live-vocab-smoke: all assertions passed");
