import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  COMPOSITION_LIVE_ARM_DEFAULT,
  assessCompositionLineAuthority,
  assessFirstLineBootstrap,
  classifyCompositionUnitname,
  compositionLiveArmEnabled,
  parseCompositionRowId,
} = require("../electron/eaushadhi-worker/composition-contract.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260923115648_eaushadhi_reference_mapping_composition_bootstrap.sql"), "utf8");
const api = fs.readFileSync(path.join(root, "public/shared/js/eaushadhi-review-api.js"), "utf8");
const control = fs.readFileSync(path.join(root, "public/shared/js/eaushadhi-review-control.js"), "utf8");

assert.match(migration, /'REFERENCE'/);
assert.match(migration, /\('28','Sahasrayoga'\)/);
assert.doesNotMatch(migration, /\('-1',/);
assert.match(migration, /'REFERENCE_WORK',\s*'SAHASRAYOGAM'/);
assert.match(migration, /source_composition_line_id in \(929, 930, 931\)/);
assert.match(migration, /PARENT_WORK_TRANSLITERATION_MATCH/);
assert.match(migration, /mapping_status = 'VERIFIED'/);
assert.match(migration, /rpc_eaushadhi_require_permission\(true\)/);
assert.match(migration, /from public, anon/);
assert.match(migration, /REFERENCE option/);
assert.match(migration, /Only a DRAFT reference mapping may transition to VERIFIED/);
assert.match(migration, /trg_one_verified_reference_mapping/);
assert.match(migration, /case when m\.mapping_status = 'VERIFIED' and po\.is_active then po\.external_id end/);
assert.match(migration, /jsonb_build_object\('portal_value'/);

assert.match(api, /fetchPortalOptions\("REFERENCE"\)/);
assert.match(api, /rpc_eaushadhi_reference_mapping_verify/);
assert.match(control, /Source Reference/);
assert.match(control, /Canonical Reference Work/);
assert.match(control, /Review Reference Mapping/);
assert.match(control, /referenceMatchLabel/);
assert.equal((control.match(/data-reference-review=/g) || []).length, 1);

assert.deepEqual(assessCompositionLineAuthority({
  review_status: "VERIFIED",
  reference: { mapping_status: "DRAFT", portal_value: null },
}).ready, false);
assert.deepEqual(assessCompositionLineAuthority({
  review_status: "VERIFIED",
  reference: { mapping_status: "VERIFIED", portal_value: "28" },
}).ready, true);

assert.equal(parseCompositionRowId("<a onclick=\"GetCompositionDataUpdate('abc_12')\">Edit</a>").rowId, "abc_12");
assert.equal(parseCompositionRowId("<a onclick=\"unknown('12')\">Edit</a>").code, "ROW_ID_CONTRACT_UNPROVEN");
assert.equal(parseCompositionRowId("GetCompositionDataUpdate('1'); GetCompositionDataUpdate('2')").ok, false);
assert.equal(classifyCompositionUnitname("9", "9", "ML").code, "UNITNAME_PORTAL_VALUE");
assert.equal(classifyCompositionUnitname("ML", "9", "ML").code, "UNITNAME_PORTAL_LABEL");
assert.equal(classifyCompositionUnitname("millilitre", "9", "ML").code, "UNITNAME_CONTRACT_UNPROVEN");
assert.equal(assessFirstLineBootstrap({ editMarkup: "bad", reread: {}, expectedUnitValue: "9", expectedUnitLabel: "ML" }).retrySave, false);
assert.equal(assessFirstLineBootstrap({ editMarkup: "GetCompositionDataUpdate('7')", reread: { id: "8", unitname: "9" }, expectedUnitValue: "9", expectedUnitLabel: "ML" }).code, "REREAD_ID_MISMATCH");
assert.equal(COMPOSITION_LIVE_ARM_DEFAULT, false);
assert.equal(compositionLiveArmEnabled({ EAUSHADHI_COMPOSITION_LIVE_ARM: "true" }), false);
assert.doesNotMatch(`${migration}\n${api}\n${control}`, /DeleteCompositionData/);

console.log("eaushadhi reference mapping + composition bootstrap smoke: PASS");
