import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const {
  PLAN_CODE,
  buildOfflineCompositionExecutionPlan,
  canonicalizeQuantity,
  normalizeText,
} = require("../electron/eaushadhi-worker/composition-offline-plan.js");
const {
  COMPOSITION_LIVE_ARM_DEFAULT,
  compositionLiveArmEnabled,
} = require("../electron/eaushadhi-worker/composition-contract.js");

const governedLine = (id, ingredient, overrides = {}) => ({
  source_composition_line_id: id,
  review_status: "VERIFIED",
  ingredient_name: ingredient,
  scientific_name: `${ingredient} scientific`,
  ingredient_type: { portal_option_value: "21" },
  ingredient_form: { portal_option_value: "25" },
  part_used: { portal_option_value: "49" },
  quantity_value: "01.000",
  measurement: { portal_option_value: "9", label: "ML" },
  reference: {
    reference_ready: true,
    source_to_canonical_ready: true,
    canonical_to_portal_ready: true,
    alias_mapping_status: "VERIFIED",
    portal_mapping_status: "VERIFIED",
    portal_value: "28",
    portal_label: "Sahasrayoga",
  },
  ...overrides,
});

const portalRow = (id, ingredient, overrides = {}) => ({
  portalRowId: id,
  ingredientName: ingredient,
  scientificName: `${ingredient} scientific`,
  ingredientTypeValue: "21",
  ingredientFormValue: "25",
  partUsedValue: "49",
  quantity: "1.0",
  measurement: { representation: "VALUE", value: "9" },
  reference: { representation: "VALUE", value: "28" },
  ...overrides,
});

const governed = [
  governedLine(929, "Ingredient A"),
  governedLine(930, "Ingredient B"),
  governedLine(931, "Ingredient C"),
];
const portal = [
  portalRow("p-a", "Ingredient A"),
  portalRow("p-b", "Ingredient B"),
  portalRow("p-c", "Ingredient C"),
];

const baseInput = () => ({
  governedSnapshot: { content_hash: "server-hash-1", composition: structuredClone(governed) },
  expectedContentHash: "server-hash-1",
  pageIdentityEvidence: {
    actualRoute: "/admin/addcomposition",
    expectedRoute: "/admin/addcomposition",
    actualProductId: 262,
    expectedProductId: 262,
  },
  portalListEvidence: {
    settled: true,
    success: true,
    coverageComplete: true,
    rows: structuredClone(portal),
  },
});

const execute = (mutate = () => {}) => {
  const input = baseInput();
  mutate(input);
  const result = buildOfflineCompositionExecutionPlan(input);
  assert.equal(result.mutationAllowed, false);
  return result;
};

assert.equal(normalizeText("  Sahasrayōgam  "), "Sahasrayōgam");
assert.notEqual(normalizeText("Sahasrayōgam"), normalizeText("sahasrayogam"));
assert.equal(canonicalizeQuantity("1"), "1");
assert.equal(canonicalizeQuantity("1.0"), "1");
assert.equal(canonicalizeQuantity("001.000"), "1");
assert.equal(canonicalizeQuantity("+000.2500"), "0.25");
for (const invalid of ["-1", "1 ml", "1-2", "1e3", "1,000", "NaN", "Infinity", 1]) {
  assert.equal(canonicalizeQuantity(invalid), null);
}

assert.equal(execute().code, PLAN_CODE.ALREADY_COMPLETE);
assert.equal(execute((input) => input.portalListEvidence.rows.reverse()).code, PLAN_CODE.ALREADY_COMPLETE);

const missing = execute((input) => input.portalListEvidence.rows.splice(1, 1));
assert.equal(missing.code, PLAN_CODE.OFFLINE_MISSING);
assert.deepEqual(missing.missing.map((item) => item.sourceCompositionLineId), [930]);

assert.equal(execute((input) => {
  input.expectedContentHash = "server-hash-2";
}).code, PLAN_CODE.BLOCKED_HASH_AUTHORITY);
assert.equal(execute((input) => {
  delete input.governedSnapshot.content_hash;
}).code, PLAN_CODE.BLOCKED_HASH_AUTHORITY);
assert.equal(execute((input) => {
  input.governedSnapshot.composition[0].reference.alias_mapping_status = "DRAFT";
  input.governedSnapshot.composition[0].reference.reference_ready = false;
}).code, PLAN_CODE.BLOCKED_LINE_AUTHORITY);

assert.equal(execute((input) => {
  input.pageIdentityEvidence.actualRoute = "/admin/other";
}).code, PLAN_CODE.BLOCKED_PAGE_IDENTITY);
assert.equal(execute((input) => {
  input.pageIdentityEvidence.actualProductId = 263;
}).code, PLAN_CODE.BLOCKED_PAGE_IDENTITY);
assert.equal(execute((input) => {
  input.pageIdentityEvidence.actualPortalProductRef = "portal-1";
  input.pageIdentityEvidence.expectedPortalProductRef = "portal-2";
}).code, PLAN_CODE.BLOCKED_PAGE_IDENTITY);

for (const key of ["settled", "success", "coverageComplete"]) {
  assert.equal(execute((input) => {
    input.portalListEvidence[key] = false;
  }).code, PLAN_CODE.BLOCKED_LIST_COVERAGE);
}
assert.equal(execute((input) => {
  input.portalListEvidence.rows = null;
}).code, PLAN_CODE.BLOCKED_LIST_COVERAGE);

assert.equal(execute((input) => {
  input.portalListEvidence.rows[0].portalRowId = "bad id";
}).code, PLAN_CODE.BLOCKED_PORTAL_ROW_UNPARSEABLE);
assert.equal(execute((input) => {
  input.portalListEvidence.rows[1].portalRowId = "p-a";
}).code, PLAN_CODE.BLOCKED_DUPLICATE);
assert.equal(execute((input) => {
  input.portalListEvidence.rows.push(portalRow("p-a-duplicate", "Ingredient A"));
}).code, PLAN_CODE.BLOCKED_DUPLICATE);

for (const [key, value] of [
  ["ingredientTypeValue", "22"],
  ["ingredientFormValue", "26"],
  ["partUsedValue", "50"],
  ["quantity", "2"],
]) {
  const result = execute((input) => {
    input.portalListEvidence.rows[0][key] = value;
  });
  assert.equal(result.code, PLAN_CODE.BLOCKED_CONFLICT);
  assert.ok(result.conflicts[0].fields.includes(key === "quantity" ? "quantity" : key));
}
assert.equal(execute((input) => {
  input.portalListEvidence.rows[0].measurement = { representation: "VALUE", value: "10" };
}).code, PLAN_CODE.BLOCKED_CONFLICT);
assert.equal(execute((input) => {
  input.portalListEvidence.rows[0].reference = { representation: "VALUE", value: "29" };
}).code, PLAN_CODE.BLOCKED_CONFLICT);

assert.equal(execute((input) => {
  input.portalListEvidence.rows.push(portalRow("p-extra", "Unknown Ingredient"));
}).code, PLAN_CODE.BLOCKED_UNEXPLAINED_EXTRA);

assert.equal(execute((input) => {
  const first = input.governedSnapshot.composition[0];
  input.governedSnapshot.composition.push(governedLine(940, first.ingredient_name, {
    scientific_name: first.scientific_name,
    ingredient_form: { portal_option_value: "77" },
  }));
  input.portalListEvidence.rows[0].ingredientFormValue = "88";
}).code, PLAN_CODE.BLOCKED_AMBIGUOUS);

assert.equal(execute((input) => {
  input.portalListEvidence.rows[0].quantity = "0001.0000";
}).code, PLAN_CODE.ALREADY_COMPLETE);
for (const quantity of ["1 ml", "1-2", "1e3"]) {
  assert.equal(execute((input) => {
    input.portalListEvidence.rows[0].quantity = quantity;
  }).code, PLAN_CODE.BLOCKED_PORTAL_ROW_UNPARSEABLE);
}

assert.equal(execute((input) => {
  input.portalListEvidence.rows[0].measurement = { representation: "VALUE", value: "9" };
}).code, PLAN_CODE.ALREADY_COMPLETE);
assert.equal(execute((input) => {
  input.portalListEvidence.rows[0].measurement = { representation: "PROVEN_LABEL", value: "ML" };
}).code, PLAN_CODE.ALREADY_COMPLETE);
assert.equal(execute((input) => {
  input.portalListEvidence.rows[0].measurement = { representation: "PROVEN_LABEL", value: "Millilitre" };
}).code, PLAN_CODE.BLOCKED_CONFLICT);

assert.equal(execute((input) => {
  input.portalListEvidence.rows[0].reference = { representation: "VALUE", value: "28" };
}).code, PLAN_CODE.ALREADY_COMPLETE);
assert.equal(execute((input) => {
  input.portalListEvidence.rows[0].reference = { representation: "PROVEN_LABEL", value: "Sahasrayoga" };
}).code, PLAN_CODE.BLOCKED_REFERENCE_REPRESENTATION);

assert.equal(execute((input) => {
  input.portalListEvidence.rows[0].sourceCompositionLineId = 929;
  input.portalListEvidence.rows[0].ingredientTypeValue = "999";
}).code, PLAN_CODE.BLOCKED_CONFLICT);
assert.equal(execute((input) => {
  const first = input.portalListEvidence.rows[0];
  const second = input.portalListEvidence.rows[1];
  [first.ingredientName, second.ingredientName] = [second.ingredientName, first.ingredientName];
}).code, PLAN_CODE.BLOCKED_UNEXPLAINED_EXTRA);

const emptyResult = execute((input) => {
  input.governedSnapshot.composition = [];
  input.portalListEvidence.rows = [];
});
assert.equal(emptyResult.code, PLAN_CODE.BLOCKED_EMPTY_GOVERNED_COMPOSITION);

const plannerSource = fs.readFileSync(
  path.join(root, "electron/eaushadhi-worker/composition-offline-plan.js"),
  "utf8",
);
assert.doesNotMatch(
  plannerSource,
  /SaveCompositionData|AddCompositionData|DeleteCompositionData|GetCompositionDataUpdate|\.rpc\(|supabase|createHash|node:crypto|page\.(?:click|fill|selectOption|evaluate)/i,
);
assert.doesNotMatch(plannerSource, /txtIng1|ddlType1|ddlForm1|ddlPart1|txtQty1|ddlUnit1|ddlRef1/);
assert.equal(COMPOSITION_LIVE_ARM_DEFAULT, false);
assert.equal(compositionLiveArmEnabled({ EAUSHADHI_COMPOSITION_LIVE_ARM: "true" }), false);

console.log("eaushadhi Composition offline semantic plan smoke: PASS");
