/**
 * Offline smoke for governed worker classification payload binding.
 * Does not call live portal, SaveData, run_begin, or mutating lifecycle RPCs.
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = join(
  root,
  "supabase/migrations/20260909112939_eaushadhi_worker_payload_classification.sql",
);
const contractPath = join(root, "electron/eaushadhi-worker/contracts/portal-contract.json");
const dryRunPath = join(root, "electron/eaushadhi-worker/dry-run.js");
const productLockPath = join(root, "electron/eaushadhi-worker/product-lock.js");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

assert(existsSync(migrationPath), "classification payload migration exists");
const sql = readFileSync(migrationPath, "utf8");

assert(sql.includes("'classification', v_classification"), "payload emits classification object");
assert(sql.includes("'classification_row_version', v_class.row_version"), "versions expose classification_row_version");
assert(sql.includes("selected_product_type_option_id"), "uses selected product type");
assert(sql.includes("selected_product_category_option_id"), "uses selected product category");
assert(sql.includes("selected_product_subtype_option_id"), "uses selected product subtype");
assert(!/suggested_product_type_option_id/.test(sql), "does not reference suggested product type");
assert(!/suggested_product_category_option_id/.test(sql), "does not reference suggested product category");
assert(!/suggested_product_subtype_option_id/.test(sql), "does not reference suggested product subtype");
assert(!/Kuzhambu/.test(sql), "does not hard-code Kuzhambu as portal subtype");
assert(
  sql.includes("Never emit suggested_* or dossier System/Class/Dosage/Subtype"),
  "documents selected-only classification rule",
);

assert(
  sql.includes("Verified classification is missing a resolvable Product Type option"),
  "fail-closed: VERIFIED missing type",
);
assert(
  sql.includes("Verified classification is missing a resolvable Product Category option"),
  "fail-closed: VERIFIED missing category",
);
assert(
  sql.includes("Verified classification cannot remain UNRESOLVED"),
  "fail-closed: VERIFIED + UNRESOLVED",
);
assert(
  sql.includes("Verified OPTION classification is missing a resolvable Product Sub Type option"),
  "fail-closed: VERIFIED OPTION without subtype",
);
assert(
  sql.includes("Verified BLANK classification must not select a Product Sub Type option"),
  "fail-closed: VERIFIED BLANK with subtype",
);
assert(
  sql.includes("Verified Product Category is not scoped to selected Product Type"),
  "fail-closed: category parent scope mismatch",
);
assert(
  sql.includes("Verified Product Sub Type is not scoped to selected Product Type"),
  "fail-closed: subtype parent scope mismatch",
);

assert(
  sql.includes("(p_payload->'classification') - array['review_status','is_verified','row_version']::text[]"),
  "content_hash strips classification review bookkeeping",
);
assert(sql.includes("'classification', classification_item.value"), "content_hash includes classification fill");
assert(!/rpc_eaushadhi_worker_run_begin/.test(sql), "migration does not introduce run_begin");
assert(!/SaveData\s*\(/.test(sql), "migration does not invoke SaveData");
assert(!/SUBMITTED/.test(sql), "migration does not introduce SUBMITTED lifecycle");

const expectedClassification = {
  review_status: "VERIFIED",
  is_verified: true,
  row_version: 2,
  subtype_mode: "OPTION",
  product_type: {
    sasv_option_id: 120,
    label: "Ayurvedic Proprietary Medicine",
    portal_option_value: "Ayurvedic Proprietary Medicine",
    portal_value_mapped: true,
    parent_domain_code: null,
    parent_external_id: null,
  },
  product_category: {
    sasv_option_id: 278,
    label: "Taila (Oil)",
    portal_option_value: "Taila (Oil)",
    portal_value_mapped: true,
    parent_domain_code: "PRODUCT_TYPE",
    parent_external_id: "Ayurvedic Proprietary Medicine",
  },
  product_subtype: {
    sasv_option_id: 274,
    label: "-",
    portal_option_value: "31",
    portal_value_mapped: true,
    parent_domain_code: "PRODUCT_TYPE",
    parent_external_id: "Ayurvedic Proprietary Medicine",
  },
};

assert(expectedClassification.product_subtype.portal_option_value === "31", "fixture subtype external id is 31");
assert(expectedClassification.product_subtype.label === "-", "fixture subtype label is '-'");
assert(
  expectedClassification.product_subtype.portal_option_value !== "Kuzhambu",
  "portal subtype is not Kuzhambu",
);

function sha(obj) {
  return createHash("sha256").update(JSON.stringify(obj), "utf8").digest("hex");
}

function contentProjection(payload) {
  const classification =
    payload.classification && typeof payload.classification === "object"
      ? {
          subtype_mode: payload.classification.subtype_mode,
          product_type: payload.classification.product_type,
          product_category: payload.classification.product_category,
          product_subtype: payload.classification.product_subtype,
        }
      : {};
  return {
    product: payload.product || {},
    details: Object.fromEntries(
      Object.entries(payload.details || {}).filter(
        ([k]) => !["review_status", "is_verified", "row_version"].includes(k),
      ),
    ),
    actions: payload.actions || [],
    composition: payload.composition || [],
    evidence: payload.evidence || {},
    classification,
  };
}

const basePayload = {
  product: {
    product_id: 262,
    canonical_product_name: "Karpooradi Thailam",
    portal_product_name: "Karpooradi Thailam",
    subtype: "Kuzhambu",
  },
  details: { review_status: "VERIFIED", is_verified: true, row_version: 9 },
  actions: [],
  composition: [],
  evidence: {},
  classification: { ...expectedClassification },
  versions: { classification_row_version: 2 },
};

assert(basePayload.product.subtype === "Kuzhambu", "dossier product.subtype remains Kuzhambu in fixture");
assert(
  basePayload.classification.product_subtype.portal_option_value === "31",
  "classification subtype remains portal 31",
);
assert(
  basePayload.product.subtype !== basePayload.classification.product_subtype.portal_option_value,
  "dossier subtype stays distinguishable from portal subtype",
);

const payloadHash1 = sha(basePayload);
const payloadHashSame = sha({
  ...basePayload,
  classification: { ...expectedClassification },
});
assert(payloadHash1 === payloadHashSame, "unchanged classification keeps payload-style hash");

const payloadHashClassChange = sha({
  ...basePayload,
  classification: {
    ...expectedClassification,
    product_subtype: {
      ...expectedClassification.product_subtype,
      portal_option_value: "99",
      label: "Other",
    },
  },
});
assert(payloadHash1 !== payloadHashClassChange, "changing portal subtype changes payload-style hash");

const payloadHashReviewOnly = sha({
  ...basePayload,
  classification: {
    ...expectedClassification,
    row_version: 3,
  },
});
assert(payloadHash1 !== payloadHashReviewOnly, "classification row_version change affects payload-style hash");

const contentHash1 = sha(contentProjection(basePayload));
const contentHashReviewOnly = sha(
  contentProjection({
    ...basePayload,
    classification: {
      ...expectedClassification,
      review_status: "VERIFIED",
      is_verified: true,
      row_version: 99,
    },
  }),
);
assert(
  contentHash1 === contentHashReviewOnly,
  "review/version-only classification change does not alter content-style hash",
);

const contentHashFillChange = sha(
  contentProjection({
    ...basePayload,
    classification: {
      ...expectedClassification,
      product_category: {
        ...expectedClassification.product_category,
        portal_option_value: "Different Category",
        label: "Different Category",
      },
    },
  }),
);
assert(contentHash1 !== contentHashFillChange, "changing category fill changes content-style hash");

const contentHashModeChange = sha(
  contentProjection({
    ...basePayload,
    classification: {
      ...expectedClassification,
      subtype_mode: "BLANK",
      product_subtype: null,
    },
  }),
);
assert(contentHash1 !== contentHashModeChange, "changing subtype_mode changes content-style hash");

const contract = JSON.parse(readFileSync(contractPath, "utf8"));
assert(contract.completeness.productLookup === false, "productLookup completeness remains false");
assert(contract.completeness.productDetails === false, "productDetails completeness remains false");
assert(contract.completeness.pharmacologicalActions === false, "pharmacologicalActions remains false");
assert(contract.completeness.composition === false, "composition completeness remains false");
assert(contract.completeness.evidence === false, "evidence completeness remains false");
assert(contract.completeness.saveUpdate === false, "saveUpdate completeness remains false");
assert(contract.completeness.reread === false, "reread completeness remains false");
assert(contract.productDetails.completeness === false, "nested productDetails.completeness remains false");
assert(contract.saveUpdate.completeness === false, "nested saveUpdate.completeness remains false");
assert(/Do not click/.test(contract.saveUpdate.evidence_note), "saveUpdate keeps Do not click");
assert(
  /Ayurvedic Proprietary Medicine/.test(contract.productDetails.evidence_note),
  "evidence note records Ayurvedic Proprietary Medicine",
);
assert(/Taila \(Oil\)/.test(contract.productDetails.evidence_note), "evidence note records Taila (Oil)");
assert(/external id 31/.test(contract.productDetails.evidence_note), "evidence note records subtype 31");
assert(/Kuzhambu/.test(contract.productDetails.evidence_note), "evidence note clarifies Kuzhambu is not portal subtype");
assert(/-1/.test(contract.productDetails.evidence_note), "evidence note records -1 rejection");
assert(!/Siddha Classical Medicine/.test(contract.productDetails.evidence_note), "stale Siddha-scope claim removed");

const dryRun = readFileSync(dryRunPath, "utf8");
assert(dryRun.includes("rpc_eaushadhi_worker_run_begin"), "dry-run still names run_begin only to prohibit it");
assert(dryRun.includes("CONTRACT_INCOMPLETE"), "dry-run still stops CONTRACT_INCOMPLETE");
assert(dryRun.includes("mutated: false"), "dry-run keeps mutated: false");
assert(!/\.click\(/.test(dryRun), "dry-run has no Playwright click");
assert(!/SaveData\s*\(/.test(dryRun), "dry-run does not invoke SaveData");
assert(dryRun.includes("rpc_eaushadhi_worker_mark_entered"), "dry-run still lists mark_entered as prohibited");
assert(dryRun.includes("rpc_eaushadhi_worker_mark_portal_verified"), "dry-run still lists mark_portal_verified as prohibited");
assert(!/await wrappedCall\(\s*["']rpc_eaushadhi_worker_run_begin["']/.test(dryRun), "dry-run does not invoke run_begin");

const productLock = readFileSync(productLockPath, "utf8");
assert(/262/.test(productLock), "first controlled product lock remains 262");

if (failed) {
  console.error(`\n${failed} classification-payload assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-worker-classification-payload-smoke: all assertions passed");
