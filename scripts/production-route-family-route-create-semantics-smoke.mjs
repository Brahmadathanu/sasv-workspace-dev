/**
 * Gate 11Y.10I.2C.3F.2B.2B — Family Route create semantics & form rhythm.
 * Client-only source/contract smoke. No mutation, no refresh, no server writes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPrmFamilyRouteValidationSummary,
  classifyPrmFamilyRouteValidationPresentation,
  PRM_FAMILY_ROUTE_CREATE_EVIDENCE_HELPER,
  PRM_FAMILY_ROUTE_CREATE_SOURCE_HELPER,
  PRM_FAMILY_ROUTE_VALIDATION_PRESENTATION,
  resolvePrmFamilyRouteCreateProvenanceContext,
  validatePrmFamilyRouteCreateProvenance,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const editorSrc = read(
  "public/shared/js/costing-suite-production-route-editor.js",
);
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const htmlSrc = read("public/shared/production-route-manager.html");
const swSrc = read("public/sw.js");
const handoffSmokeSrc = read(
  "scripts/production-route-family-route-create-handoff-smoke.mjs",
);

const openCreateFn =
  mainSrc.match(
    /async function openCreateFamilyRouteDraftModal\([\s\S]*?\n  async function openCloneFamilyRouteModal/,
  )?.[0] || "";
const cloneFn =
  mainSrc.match(
    /async function openCloneFamilyRouteModal\([\s\S]*?\n  async function hydrateProductRouteCreateHandoff/,
  )?.[0] || "";
const familyHtmlFn =
  editorSrc.match(/function familyHtml\([\s\S]*?\n  function deltaRow/)?.[0] ||
  "";
const overviewFn =
  editorSrc.match(
    /function buildFamilyRouteOverviewHtml\([\s\S]*?\n  function clearFamilyEditorContext/,
  )?.[0] || "";

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const manualCtx = resolvePrmFamilyRouteCreateProvenanceContext({});
const successorCtx = resolvePrmFamilyRouteCreateProvenanceContext({
  supersedesRouteId: 99,
});
const historicalCtx = resolvePrmFamilyRouteCreateProvenanceContext({
  historicalHandoff: true,
});
const manualCheck = validatePrmFamilyRouteCreateProvenance(manualCtx, {
  source_type: "MANUAL",
  evidence_status: "MANUAL_COMPLETE",
});
const copiedCheck = validatePrmFamilyRouteCreateProvenance(manualCtx, {
  source_type: "COPIED_VERSION",
  evidence_status: "MANUAL_COMPLETE",
});
const historicalCheck = validatePrmFamilyRouteCreateProvenance(manualCtx, {
  source_type: "HISTORICAL_CANDIDATE",
  evidence_status: "HISTORICAL_COMPLETE",
});

const zeroStepPresentation = classifyPrmFamilyRouteValidationPresentation(
  {
    is_valid: false,
    step_count: 0,
    rm_boundary_count: 0,
    production_process_count: 0,
    fg_boundary_count: 0,
    issues: [],
  },
  [],
);
const zeroStepSummary = buildPrmFamilyRouteValidationSummary(
  {
    is_valid: false,
    step_count: 0,
    rm_boundary_count: 0,
    production_process_count: 0,
    fg_boundary_count: 0,
    issues: [],
  },
  [],
);
const invalidPresentation = classifyPrmFamilyRouteValidationPresentation(
  {
    is_valid: false,
    step_count: 2,
    issues: [{ code: "INVALID_COST_CENTRE", message: "Bad centre" }],
  },
  [],
);
const validPresentation = classifyPrmFamilyRouteValidationPresentation(
  { is_valid: true, step_count: 8, issues: [] },
  [],
);

assert(
  manualCtx.source_type === "MANUAL" &&
    manualCtx.evidence_status === "MANUAL_COMPLETE",
  "1 ordinary create resolves MANUAL",
);
assert(manualCtx.evidence_status === "MANUAL_COMPLETE", "2 ordinary MANUAL_COMPLETE");
assert(
  openCreateFn.includes("readonly: true") &&
    openCreateFn.includes("disabled: true") &&
    openCreateFn.includes("PRM_FAMILY_ROUTE_CREATE_SOURCE_HELPER"),
  "3 source readonly with governed helper",
);
assert(
  openCreateFn.includes("PRM_FAMILY_ROUTE_CREATE_EVIDENCE_HELPER") &&
    PRM_FAMILY_ROUTE_CREATE_EVIDENCE_HELPER.includes(
      "does not mean the route is approved",
    ),
  "4 evidence readonly with governed helper",
);
assert(
  !openCreateFn.includes('type: "select"') ||
    !openCreateFn.includes('id: "prmFamilyRouteSource"') ||
    !openCreateFn.match(/prmFamilyRouteSource[\s\S]{0,120}type: "select"/),
  "5 Historical Candidate absent from ordinary create UI",
);
assert(
  !openCreateFn.includes("HISTORICAL_CANDIDATE") &&
    !openCreateFn.includes("COPIED_VERSION"),
  "6 Copied Version and Historical Candidate absent from create modal",
);
assert(
  successorCtx.source_type === "MANUAL" &&
    successorCtx.evidence_status === "MANUAL_COMPLETE" &&
    successorCtx.mode === "manual_successor",
  "7 successor create stays MANUAL/MANUAL_COMPLETE",
);
assert(
  cloneFn.includes("rpc_clone_route_family_route_draft") ||
    cloneFn.includes("cloneFamilyDraft") &&
    !cloneFn.includes("prmFamilyRouteSource"),
  "8 clone path unchanged without source/evidence controls",
);
assert(!copiedCheck.ok && !historicalCheck.ok, "9 unsupported provenance blocked");
assert(
  openCreateFn.includes("validatePrmFamilyRouteCreateProvenance") &&
    openCreateFn.includes('showToast?.(provenanceCheck.error') &&
    !openCreateFn.includes('source_type: "COPIED_VERSION"'),
  "10 no silent fallback on provenance mismatch",
);
assert(
  rpcSrc.includes("p_source_type") && rpcSrc.includes("p_evidence_status"),
  "11 RPC arg names unchanged",
);

assert(
  zeroStepPresentation.mode === PRM_FAMILY_ROUTE_VALIDATION_PRESENTATION.INCOMPLETE,
  "12 zero-step Draft classified incomplete",
);
assert(
  zeroStepSummary.labels.valid === "Route incomplete — steps required",
  "13 incomplete primary copy correct",
);
assert(
  zeroStepSummary.labels.showErrors === false &&
    zeroStepSummary.labels.errors == null,
  "14 no misleading 0 errors metric",
);
assert(
  zeroStepSummary.labels.rm === "RM boundary missing" &&
    zeroStepSummary.labels.production === "Production steps missing" &&
    zeroStepSummary.labels.fg === "FG boundary missing",
  "15-17 boundary missing cues",
);
assert(
  invalidPresentation.mode === PRM_FAMILY_ROUTE_VALIDATION_PRESENTATION.INVALID,
  "18 real issues classify invalid",
);
assert(
  validPresentation.mode === PRM_FAMILY_ROUTE_VALIDATION_PRESENTATION.VALID,
  "19 valid behavior unchanged",
);
assert(
  familyHtmlFn.includes("Validation stale") &&
    !familyHtmlFn.includes("validationFresh") === false,
  "20 stale behavior referenced in editor cue chain",
);
assert(
  zeroStepPresentation.issues.length === 0 &&
    invalidPresentation.issues.length === 1,
  "21 no fabricated errors",
);
assert(
  familyHtmlFn.includes("Route incomplete — add required route steps"),
  "22 editor next-action cue present",
);

assert(
  htmlSrc.includes(".cp-prm-form-field") &&
    openCreateFn.includes("formField("),
  "23 shared field grouping used",
);
assert(
  htmlSrc.includes(".cp-prm-form .cp-detail-grid--2col") &&
    htmlSrc.includes("row-gap: var(--sasv-space-3"),
  "24 grid row-gap present",
);
assert(
  htmlSrc.includes("gap: var(--sasv-space-1") &&
    htmlSrc.includes(".cp-prm-field-hint"),
  "25 label/control/helper separation",
);
assert(
  htmlSrc.includes("gap: var(--sasv-space-1") &&
    htmlSrc.includes("row-gap: var(--sasv-space-3") &&
    !htmlSrc.includes(".cp-prm-form .cp-detail-grid--2col {\n        row-gap: 12px"),
  "26 semantic tokens only",
);
assert(
  htmlSrc.includes("@media") && htmlSrc.includes(".cp-prm-form-field--full"),
  "27 narrow behavior preserved via existing full-width fields",
);
assert(!htmlSrc.includes("2UX"), "28 no 2UX redesign");

assert(
  handoffSmokeSrc.includes("openCreateFamilyRouteDraftModal") &&
    mainSrc.includes("data-prm-create-family-route-draft"),
  "29 2B.2A create-handoff wiring still present",
);
assert(
  helpersSrc.includes("resolvePrmFamilyRouteCreateProvenanceContext") &&
    helpersSrc.includes("classifyPrmFamilyRouteValidationPresentation"),
  "30 helpers exports present",
);
assert(
  editorSrc.includes("buildFamilyRouteOverviewHtml") &&
    familyHtmlFn.includes("cp-prm-editor-toolbar-primary"),
  "31 route editor header/nav structure preserved",
);
assert(
  helpersSrc.includes("buildPrmRouteFamilyApprovalReference") &&
    mainSrc.includes("openApproveFamilyModal"),
  "32 family approval-summary path preserved",
);
assert(
  !mainSrc.includes("apply_migration") && !rpcSrc.includes("rpc_create_route_family_route_draft_v2"),
  "33 no server files",
);
assert(
  !mainSrc.includes("editor.createFamilyDraft(") ||
    openCreateFn.indexOf("await editor.createFamilyDraft") >
      openCreateFn.indexOf("validatePrmFamilyRouteCreateProvenance"),
  "34 no business mutation in smoke runner",
);
assert(
  !openCreateFn.includes("rpc_refresh") && !mainSrc.includes("costingRefresh"),
  "35 no costing refresh",
);

assert(
  historicalCtx.enabled === false &&
    helpersSrc.includes("HISTORICAL_HANDOFF") &&
    !mainSrc.includes("historicalHandoff: true"),
  "historical context reserved not enabled",
);
assert(
  overviewFn.includes("overviewErrorsBadge") &&
    overviewFn.includes("data-prm-validation-presentation"),
  "Route Details presentation wiring",
);
assert(
  PRM_FAMILY_ROUTE_CREATE_SOURCE_HELPER.includes("Manual —") &&
    PRM_FAMILY_ROUTE_CREATE_EVIDENCE_HELPER.includes("Manual complete —"),
  "governed helper copy exported",
);
assert(manualCheck.ok, "manual provenance validates");

assert(/CACHE_NAME = "hub-cache-v316"/.test(swSrc), "SW bumped exactly once to hub-cache-v316");

if (failed) {
  console.error(
    `\nproduction-route-family-route-create-semantics-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-family-route-create-semantics-smoke: all passed");
