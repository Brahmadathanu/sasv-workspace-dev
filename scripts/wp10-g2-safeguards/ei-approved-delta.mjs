// Owner-approved EI delta, 26 Nov 2026. Exact Git blobs, exact branch, no dirty/untracked exemptions.
export const EI_BRANCH = "claude/upbeat-lovelace-tdc1jm";
export const EI_CLIENT_BLOBS = Object.freeze({
  "public/shared/js/mis-evidence-report.js": "96f58acccfa706c63ccc73cbc9838ff2cb44f41d",
  "public/shared/js/module-registry.js": "817b493389a8a0d1730cfe19b2952a5b65ea59fc",
  "public/shared/executive-mis-dashboard.html": "b3515e9ce71f3b0baa37675329c66fed230b15fb",
  "public/shared/js/executive-mis-dashboard.js": "4910e1dfb0d2570cb7966c9f8660f9da884312a7",
  "public/shared/js/executive-intelligence-model.js": "4ccc27d7dadb43fbe4aef08aafe5d891c45c947e"
});
// R5 owner-directed UX harmonisation; only three exact page-local client blobs.
export const EI_R5_BRANCH = "fix/executive-intelligence-r5-production-ux";
export const EI_R5_CLIENT_BLOBS = Object.freeze({
  "public/shared/executive-mis-dashboard.html": "9b79bb69676694195dfe9adb7cfcff19088be9d8",
  "public/shared/js/executive-mis-dashboard.js": "22a5f593ba09c986a539ee1dfa00d56265ae5140",
  "public/shared/js/executive-intelligence-model.js": "5528eebcdad9a546eb8fa4f639cca233f4324b47"
});
export const EI_REGISTRY_BASE = "f78f3ba6d1a403cf4b588afc5d285f48df962361";
export function eiClientApproved(path, branch, committedBlob, workingBlob) {
 const pins = branch === EI_BRANCH ? EI_CLIENT_BLOBS : branch === EI_R5_BRANCH ? EI_R5_CLIENT_BLOBS : null;
 return !!pins && Object.hasOwn(pins,path) && committedBlob === pins[path] && workingBlob === committedBlob;
}
export function eiRegistryApproved(path, branch, committedBlob, workingBlob, baseBlob) {
 return path === "public/shared/js/module-registry.js" && baseBlob === EI_REGISTRY_BASE && eiClientApproved(path,branch,committedBlob,workingBlob);
}

export const EI_SERVER_BLOBS = Object.freeze({
  "supabase/migrations/20261125152054_executive_intelligence_r1_sales_inventory_registry.sql": "5b7b88d1087e986659af76b4ce618dd6e600384b",
  "supabase/migrations/20261126102211_executive_intelligence_r3_r4_reporting_parity.sql": "35c1f2f38a79fef25db03a3238d25737c601b935",
  "supabase/migrations/20261126103241_executive_intelligence_product_rows_type_fix.sql": "f03b4b87dff7f0edf8314b5d2f584b6ab822dd19",
  "supabase/migrations/20261126103624_executive_intelligence_facility_latency_fix.sql": "4536897f5ba091aec39e6ee50c106038bae29fbd",
  "supabase/tests/mis_g7/ei_access_live_catalog_fixture.sql": "172aee12360990ac88d26b04d55b6b20e25cfb6f",
  "supabase/tests/mis_g7/ei_r3_r4_access_pg.test.mjs": "f35c094c2e9b8fbafeb15c37023250cd4303130c",
  "supabase/tests/mis_g7/ei_r3_r4_extended_pg.test.mjs": "93d6db88d14d28214ed619fac3123abbc74e75a4",
  "supabase/tests/mis_g7/ei_r3_r4_pg.test.mjs": "3f4cc4a84c38e048a3a59e7a2d6d7ae60234a64a",
  "supabase/tests/mis_g7/mis_r1_reporting_pg.test.mjs": "6928a12ebd84ded192343df4af68740083c09c9b"
});
export function eiServerApproved(path,branch,committedBlob,workingBlob) {
 return [EI_BRANCH,"fix/executive-intelligence-r1-server"].includes(branch) && Object.hasOwn(EI_SERVER_BLOBS,path) && committedBlob===EI_SERVER_BLOBS[path] && workingBlob===committedBlob;
}
