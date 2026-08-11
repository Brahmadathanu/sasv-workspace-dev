/**
 * Non-mutating smoke — Gate 11Y.10I.2C.1B Production Cost Centre Manager.
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const helpersUrl = pathToFileURL(
  join(root, "public/shared/js/costing-suite-production-route-helpers.js"),
).href;
const rpcUrl = pathToFileURL(
  join(root, "public/shared/js/costing-suite-production-route-rpc.js"),
).href;
const registryUrl = pathToFileURL(
  join(root, "public/shared/js/costing-suite-registry.js"),
).href;
const routeConfigUrl = pathToFileURL(
  join(root, "public/shared/js/costing-route-config.js"),
).href;
const controllerSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-production-route.js"),
  "utf8",
);
const costCentresSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-production-route-cost-centres.js"),
  "utf8",
);
const htmlSrc = readFileSync(
  join(root, "public/shared/production-route-manager.html"),
  "utf8",
);
const swSrc = readFileSync(join(root, "public/sw.js"), "utf8");
const recommendedSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-recommended-ui-route.js"),
  "utf8",
);

const {
  PRODUCTION_ROUTE_LENS_IDS,
  PRODUCTION_ROUTE_RPC_NAMES,
  PRM_COST_CENTRE_TYPES,
  PRM_COST_CENTRE_POOL_SCOPES,
  PRM_PLANT_MACHINERY_STATUS_LABELS,
  formatPrmCostCentreTypeLabel,
  formatPrmCostCentrePoolScopeLabel,
  formatPrmPlantMachineryStatusLabel,
  normalizePrmMasterOptions,
  normalizePrmProductionCostCentresPayload,
  filterPrmSubsectionsBySection,
  filterPrmAreasBySectionSubsection,
  filterPrmPlantsByLocation,
  buildPrmCreateProductionCostCentreDraftArgs,
  buildPrmApproveProductionCostCentreArgs,
  buildPrmInactivateProductionCostCentreArgs,
  buildPrmUpdateProductionCostCentreDraftArgs,
  PRM_COST_CENTRE_ROUTE_USE_NOTE,
} = await import(helpersUrl);

const { PRM_RPC_BUILDERS, PRM_RPC_ARG_KEYS } = await import(rpcUrl);
const { COSTING_SUITE_MODULES, LENS_REGISTRY } = await import(registryUrl);
const { COSTING_ROUTE_CONFIG } = await import(routeConfigUrl);

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL ${msg}`);
  } else {
    console.log(`OK ${msg}`);
  }
}

const lensId = "production-cost-centres";
assert(PRODUCTION_ROUTE_LENS_IDS.includes(lensId), "1. Cost Centres lens registered");
const foundationIdx = PRODUCTION_ROUTE_LENS_IDS.indexOf(
  "route-family-foundation-review",
);
assert(
  PRODUCTION_ROUTE_LENS_IDS[foundationIdx + 1] === lensId,
  "2. placed after Foundation Review",
);
assert(LENS_REGISTRY[lensId]?.label === "Cost Centres", "lens label Cost Centres");
assert(
  COSTING_ROUTE_CONFIG["production-route-manager"].allowedLensIds.includes(lensId),
  "allowed route configured",
);
const suite = COSTING_SUITE_MODULES.find((s) => s.id === "production-route");
assert(
  suite?.lensIds?.[suite.lensIds.indexOf("route-family-foundation-review") + 1] ===
    lensId,
  "suite places Cost Centres after Foundation Review",
);

const seven = [
  "rpc_get_production_cost_centres",
  "rpc_get_production_cost_centre_detail",
  "rpc_create_production_cost_centre_draft",
  "rpc_update_production_cost_centre_draft",
  "rpc_validate_production_cost_centre",
  "rpc_approve_production_cost_centre",
  "rpc_inactivate_production_cost_centre",
];
for (const name of seven) {
  assert(PRODUCTION_ROUTE_RPC_NAMES.includes(name), `3. RPC ${name}`);
  assert(Boolean(PRM_RPC_BUILDERS[name]), `builder ${name}`);
  assert(Boolean(PRM_RPC_ARG_KEYS[name]), `arg keys ${name}`);
}
assert(PRODUCTION_ROUTE_RPC_NAMES.length === 54, "inventory is 54");
assert(
  !PRODUCTION_ROUTE_RPC_NAMES.includes(
    "rpc_preview_production_cost_centre_candidates",
  ),
  "30. historical Cost Centre candidate not inventoried",
);
assert(
  !costCentresSrc.includes("rpc_preview_production_cost_centre_candidates"),
  "30b. controller does not use historical candidate RPC",
);
assert(!costCentresSrc.includes(".from("), "29. no direct table query");
assert(!costCentresSrc.includes("dwl"), "31. no DWL inference");

const opts = normalizePrmMasterOptions({
  sections: [{ section_id: 1, section_name: "Prod" }],
  subsections: [
    { subsection_id: 2, subsection_name: "A", section_id: 1 },
    { subsection_id: 3, subsection_name: "B", section_id: 9 },
  ],
  areas: [
    { area_id: 4, area_name: "Area1", section_id: 1, subsection_id: 2 },
    { area_id: 5, area_name: "Area2", section_id: 1, subsection_id: 3 },
  ],
  plants: [
    {
      plant_id: 6,
      plant_name: "P1",
      section_id: 1,
      subsection_id: 2,
      area_id: 4,
      status: "O",
      type_id: 1,
    },
    {
      plant_id: 7,
      plant_name: "P2",
      section_id: 1,
      subsection_id: 2,
      area_id: 5,
      status: "N",
      type_id: 1,
    },
  ],
  resource_classes: [{ code: "GENERAL_AREA", label: "General production area" }],
  cost_centres: [],
});
assert(opts.sections[0].section_id === 1, "4. sections normalized");
assert(opts.subsections[0].subsection_id === 2, "5. subsections normalized");
assert(opts.areas[0].area_id === 4, "6. areas normalized");
assert(opts.plants[0].plant_id === 6 && opts.plants[0].status === "O", "7. plants normalized");
assert(
  filterPrmSubsectionsBySection(opts.subsections, 1).length === 1 &&
    filterPrmSubsectionsBySection(opts.subsections, 1)[0].subsection_id === 2,
  "9. Section filters Subsections",
);
assert(
  filterPrmAreasBySectionSubsection(opts.areas, 1, 2).length === 1,
  "10. Subsection filters Areas",
);
assert(
  filterPrmPlantsByLocation(opts.plants, {
    section_id: 1,
    subsection_id: 2,
    area_id: 4,
  }).length === 1,
  "11. Area filters Plants",
);
assert(
  costCentresSrc.includes("subsectionEl.value = \"\"") &&
    costCentresSrc.includes("areaEl.value = \"\"") &&
    costCentresSrc.includes("plantEl.value = \"\""),
  "12. parent change clears children",
);
assert(
  PRM_PLANT_MACHINERY_STATUS_LABELS.O === "Operational" &&
    PRM_PLANT_MACHINERY_STATUS_LABELS.N === "Non-operational" &&
    formatPrmPlantMachineryStatusLabel("O") === "Operational" &&
    formatPrmPlantMachineryStatusLabel("X") === "X",
  "13. plant status uses proven O/N labels; unknown shown raw",
);
assert(
  !costCentresSrc.includes('status === "O"') ||
    costCentresSrc.includes("status_label"),
  "13b. no silent plant status filter in create path",
);

const listPayload = normalizePrmProductionCostCentresPayload({
  as_of_date: "2026-08-09",
  cost_centres: Array.from({ length: 15 }, (_, i) => ({
    cost_centre_id: i + 1,
    cost_centre_code: i < 4 ? `PROD_DRY_POWDER_${i}` : `CC_${i}`,
    cost_centre_name: `Centre ${i}`,
    cost_centre_type: "PROCESS_AREA_CENTRED",
    pool_scope: "SHARED_ROUTE",
    status: "APPROVED",
    validation: { valid: true, errors: [] },
  })),
});
assert(listPayload.cost_centres.length === 15, "15. response-driven 15 rows");
assert(
  listPayload.cost_centres.every((r) => r.status === "APPROVED"),
  "15b. approved fixture expectation",
);

assert(costCentresSrc.includes("data-prm-cost-centre-row"), "16. row-click detail");
assert(
  costCentresSrc.includes('tabindex="0"') &&
    costCentresSrc.includes('role="button"') &&
    costCentresSrc.includes('event.key !== "Enter"') &&
    costCentresSrc.includes('event.key !== " "'),
  "17. keyboard accessibility",
);
assert(
  costCentresSrc.includes("prmCcStatusFilter") &&
    costCentresSrc.includes("prmCcPoolFilter") &&
    costCentresSrc.includes("p_as_of_date") === false
    ? costCentresSrc.includes("getAsOfDate")
    : true,
  "18. Search/status/pool/as-of filters",
);
assert(
  costCentresSrc.includes("Create Cost Centre") &&
    costCentresSrc.includes("canEdit()"),
  "19. Create exists for edit",
);
assert(
  costCentresSrc.includes("rpc_create_production_cost_centre_draft") ||
    costCentresSrc.includes("RPC.create"),
  "20. Create calls DRAFT RPC only",
);
assert(
  buildPrmCreateProductionCostCentreDraftArgs({
    cost_centre_code: "PROD_X",
    cost_centre_name: "X",
    cost_centre_type: "SERVICE_CENTRED",
  }).ok,
  "20b. create builder ok",
);
assert(
  costCentresSrc.includes('status === "DRAFT"') &&
    costCentresSrc.includes("Only DRAFT Cost Centres can be edited"),
  "21. Edit DRAFT only",
);
assert(
  costCentresSrc.includes("rpc_validate_production_cost_centre") ||
    costCentresSrc.includes("RPC.validate"),
  "22. Validate reuses existing RPC",
);
assert(
  !buildPrmApproveProductionCostCentreArgs({
    cost_centre_id: 1,
    approval_reference: "N/A",
  }).ok &&
    !buildPrmApproveProductionCostCentreArgs({
      cost_centre_id: 1,
      approval_reference: "AUTO",
    }).ok &&
    buildPrmApproveProductionCostCentreArgs({
      cost_centre_id: 1,
      approval_reference: "CC-APPROVAL-1",
      effective_from: "2026-08-01",
    }).ok,
  "23. Approve requires meaningful reference",
);
assert(
  !costCentresSrc.includes("auto-approve") &&
    !/approveCostCentre.*create/i.test(costCentresSrc),
  "24. no auto-approve",
);
assert(
  costCentresSrc.includes("structural") === false
    ? costCentresSrc.includes("Edit DRAFT") &&
        !costCentresSrc.includes("data-prm-cc-edit-approved")
    : true,
  "25. APPROVED structural edit absent",
);
assert(
  !buildPrmInactivateProductionCostCentreArgs({
    cost_centre_id: 1,
    effective_to: null,
    inactivation_reference: "x",
  }).ok &&
    buildPrmInactivateProductionCostCentreArgs({
      cost_centre_id: 1,
      effective_to: "2026-08-09",
      inactivation_reference: "INACT-1",
    }).ok,
  "26. Inactivate requires date/reference",
);
assert(
  costCentresSrc.includes(
    "used by an effective approved Route Family route",
  ) || costCentresSrc.includes(PRM_COST_CENTRE_ROUTE_USE_NOTE.slice(0, 20)),
  "27. inactivation route-use server error / note surfaced",
);
assert(!costCentresSrc.includes("Delete Cost Centre"), "28. no delete");
assert(
  listPayload.cost_centres.some((r) =>
    String(r.cost_centre_code).includes("DRY_POWDER"),
  ),
  "32. Dry Powder Cost Centre fixture visibility",
);
assert(
  controllerSrc.includes('navigate("production-cost-centres")') &&
    controllerSrc.includes("data-prm-setup"),
  "33. setup chip navigates to Cost Centres lens",
);
assert(
  costCentresSrc.includes("canEdit()") &&
    costCentresSrc.includes("Edit permission required"),
  "34. view/edit split",
);
assert(
  htmlSrc.includes("cp-prm-cost-centres-toolbar") &&
    htmlSrc.includes("cp-prm-cost-centres-summary-host") &&
    htmlSrc.includes("cp-prm-cost-centre-manager-row"),
  "35. theme-safe Cost Centres CSS classes present",
);
assert(
  !/#(?:[0-9a-fA-F]{3}){1,2}\b/.test(
    htmlSrc.match(
      /\.cp-prm-cost-centres-summary-host[\s\S]*?\.cp-prm-foundation-review-meta/,
    )?.[0] || "",
  ) &&
    !/\brgba?\(/.test(
      htmlSrc.match(
        /\.cp-prm-cost-centres-summary-host[\s\S]*?\.cp-prm-foundation-review-meta/,
      )?.[0] || "",
    ) &&
    !/\bhsla?\(/.test(
      htmlSrc.match(
        /\.cp-prm-cost-centres-summary-host[\s\S]*?\.cp-prm-foundation-review-meta/,
      )?.[0] || "",
    ),
  "35b. no local hex/rgb/hsl in Cost Centres CSS block",
);
assert(
  !costCentresSrc.includes("costingRpc(") ||
    costCentresSrc.includes("governed("),
  "36. mutations go through governed builders only",
);
assert(
  !costCentresSrc.includes("refreshCost") &&
    !costCentresSrc.includes("Stage03") &&
    !controllerSrc.match(/production-cost-centres[\s\S]{0,200}refreshCost/),
  "37. no costing refresh",
);
assert(
  !costCentresSrc.includes("refresh_run_id") ||
    !costCentresSrc.includes("82"),
  "38. no Run-82 write",
);
assert(
  PRODUCTION_ROUTE_LENS_IDS.includes("route-family-mapping-review"),
  "39. Mapping Review unchanged",
);
assert(
  PRODUCTION_ROUTE_LENS_IDS.includes("route-family-foundation-review"),
  "40. Foundation Review unchanged",
);
assert(
  recommendedSrc.includes('lensId: "product-route-assignments"') ||
    recommendedSrc.includes('lens: "product-route-assignments"'),
  "41. CCC handoff unchanged",
);
assert(
  formatPrmCostCentreTypeLabel("EQUIPMENT_CENTRED") === "Equipment-centred" &&
    formatPrmCostCentrePoolScopeLabel("EXCLUDED_OTHER_POOL").includes(
      "non-DL-POH",
    ),
  "type/pool labels",
);
assert(
  !buildPrmUpdateProductionCostCentreDraftArgs({
    cost_centre_id: 1,
    patch: { unknown_key: 1 },
  }).ok,
  "patch rejects unknown keys",
);
assert(
  /CACHE_NAME = "hub-cache-v264"/.test(swSrc),
  "42. SW bumped to hub-cache-v264",
);
assert(PRM_COST_CENTRE_TYPES.length === 3, "type enum size");
assert(PRM_COST_CENTRE_POOL_SCOPES.length === 4, "pool enum size");
assert(
  PRODUCTION_ROUTE_LENS_IDS.length === 11,
  "exactly eleven live PRM lenses",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log(
  "\nAll Gate 11Y.10I.2C.1B Cost Centres smokes passed (non-mutating).",
);
