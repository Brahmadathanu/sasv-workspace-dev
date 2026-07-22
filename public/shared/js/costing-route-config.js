import { COSTING_SUITE_MODULES, LENS_REGISTRY } from "./costing-suite-registry.js";

export const ALL_COSTING_LENS_IDS = COSTING_SUITE_MODULES.flatMap(
  (suite) => suite.lensIds,
);

export const DEFAULT_COSTING_ROUTE_MODULE_KEY = "costing-control-center";

export const COSTING_ROUTE_CONFIG = {
  "costing-control-center": {
    moduleKey: "costing-control-center",
    permissionTarget: "module:costing-control-center",
    suiteId: "control-center",
    defaultLens: "dashboard",
    title: "Costing Control Center",
    subtitle:
      "Dashboard, costing control workbench, blockers, review queue, and integrity checks",
    routePath: "public/shared/costing-control-center.html",
    allowedLensIds: ["dashboard", "costing-review-workbench"],
  },
  "material-cost-manager": {
    moduleKey: "material-cost-manager",
    permissionTarget: "module:material-cost-manager",
    suiteId: "material-cost",
    defaultLens: "manual-rate-manager",
    title: "Material Cost Manager",
    subtitle:
      "RM/PM manual rates, material action queue, review acceptance, and costing material blockers",
    routePath: "public/shared/material-cost-manager.html",
    allowedLensIds: ["manual-rate-manager", "rm-cost-trace"],
  },
  "cost-build-manager": {
    moduleKey: "cost-build-manager",
    permissionTarget: "module:cost-build-manager",
    suiteId: "cost-build",
    defaultLens: "cost-governance",
    title: "Cost Build Manager",
    subtitle:
      "Expense mapping, staff classification, overhead allocation, and manual provisions",
    routePath: "public/shared/cost-build-manager.html",
    allowedLensIds: ["cost-governance", "staff-governance", "manual-provisions"],
  },
  "pricing-policy-manager": {
    moduleKey: "pricing-policy-manager",
    permissionTarget: "module:pricing-policy-manager",
    suiteId: "pricing-policy",
    // Internal legacy default for CURRENT_LENS / loaders. F4/F5 canonical URLs
    // use workspace only; the business landing remains workspace=sku-overview.
    defaultLens: "policy-manager",
    title: "Pricing Policy Manager",
    subtitle:
      "Selling price policy, scheme policy, and scheme viability review",
    routePath: "public/shared/pricing-policy-manager.html",
    // SC1/SC4: scheme-comparison is not a PPM allowed lens. SC5 redirects
    // legacy PPM Scheme Comparison URLs to cost-sheet-review before first load.
    allowedLensIds: ["mrp-governance", "policy-manager"],
  },
  "cost-sheet-review": {
    moduleKey: "cost-sheet-review",
    permissionTarget: "module:cost-sheet-review",
    suiteId: "cost-sheet-review",
    defaultLens: "sku-cost-sheet",
    title: "Cost Sheet Review & Approval",
    subtitle:
      "SKU cost details, printable cost sheets, snapshot comparison, and scheme viability",
    routePath: "public/shared/cost-sheet-review.html",
    allowedLensIds: [
      "sku-cost-sheet",
      "printable-cost-sheet",
      "cost-comparison",
      "scheme-comparison",
    ],
  },
};

export function normalizeCostingRouteModuleKey(moduleKey) {
  const key = String(moduleKey || "").trim();
  if (!key || key === "costing-pricing") {
    return DEFAULT_COSTING_ROUTE_MODULE_KEY;
  }
  return COSTING_ROUTE_CONFIG[key]
    ? key
    : DEFAULT_COSTING_ROUTE_MODULE_KEY;
}

export function resolveActiveRouteConfig() {
  const bodyKey = document.body?.dataset?.costingModuleKey?.trim();
  if (bodyKey) {
    const moduleKey = normalizeCostingRouteModuleKey(bodyKey);
    return COSTING_ROUTE_CONFIG[moduleKey];
  }

  const routeModule = new URLSearchParams(window.location.search)
    .get("routeModule")
    ?.trim();
  if (routeModule) {
    const moduleKey = normalizeCostingRouteModuleKey(routeModule);
    return COSTING_ROUTE_CONFIG[moduleKey];
  }

  return COSTING_ROUTE_CONFIG[DEFAULT_COSTING_ROUTE_MODULE_KEY];
}

export function getAllowedLensIdsForRoute(config) {
  if (!config?.allowedLensIds?.length) {
    return [...ALL_COSTING_LENS_IDS];
  }
  return config.allowedLensIds.filter((lensId) => LENS_REGISTRY[lensId]);
}

export function getModuleKeyForLens(lensId) {
  const id = String(lensId || "").trim();
  // Pricing Policy compatibility areas / legacy lenses still map to PPM.
  // SC1: scheme-comparison is owned by cost-sheet-review (resolved via allowedLensIds).
  if (
    id === "mrp-policies" ||
    id === "mrp-workflow" ||
    id === "selling-schemes" ||
    id === "mrp-governance" ||
    id === "policy-manager"
  ) {
    return "pricing-policy-manager";
  }
  for (const [moduleKey, config] of Object.entries(COSTING_ROUTE_CONFIG)) {
    if (config.allowedLensIds?.includes(lensId)) return moduleKey;
  }
  return null;
}

/**
 * SC5: detect legacy Pricing Policy Manager Scheme Comparison targets that
 * must redirect to Cost Sheet Review. Does not treat unknown tokens as relocated.
 */
export function resolveRelocatedPricingPolicyTarget({
  lens = null,
  workspace = null,
  mrpTab = null,
  policyTab = null,
} = {}) {
  const tokens = [lens, workspace, mrpTab, policyTab]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);

  if (!tokens.includes("scheme-comparison")) {
    return { relocated: false };
  }

  return {
    relocated: true,
    moduleKey: "cost-sheet-review",
    lens: "scheme-comparison",
  };
}

/**
 * SC5: build CSR Scheme Comparison redirect query params from a PPM URLSearchParams.
 * Preserves status + period_start only. Drops Issue/Source and obsolete PPM nav keys.
 */
export function buildSchemeComparisonRedirectParams(qp) {
  const params = { lens: "scheme-comparison" };
  if (!qp || typeof qp.get !== "function") return params;

  const statusRaw = String(qp.get("status") || "").trim();
  if (statusRaw) {
    const status = statusRaw
      .split(",")
      .map((value) => String(value || "").trim().toUpperCase())
      .filter(Boolean);
    if (status.length) params.status = status;
  }

  const periodStart = String(qp.get("period_start") || "").trim();
  if (periodStart) params.period_start = periodStart;

  return params;
}
