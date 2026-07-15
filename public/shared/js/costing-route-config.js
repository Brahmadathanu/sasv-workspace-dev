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
    defaultLens: "policy-manager",
    title: "Pricing Policy Manager",
    subtitle:
      "Selling price policy, scheme policy, and scheme viability review",
    routePath: "public/shared/pricing-policy-manager.html",
    allowedLensIds: ["policy-manager", "scheme-comparison"],
  },
  "cost-sheet-review": {
    moduleKey: "cost-sheet-review",
    permissionTarget: "module:cost-sheet-review",
    suiteId: "cost-sheet-review",
    defaultLens: "sku-cost-sheet",
    title: "Cost Sheet Review & Approval",
    subtitle:
      "SKU cost details, printable cost sheets, monthly comparison, and approval support",
    routePath: "public/shared/cost-sheet-review.html",
    allowedLensIds: [
      "sku-cost-sheet",
      "printable-cost-sheet",
      "cost-comparison",
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
  for (const [moduleKey, config] of Object.entries(COSTING_ROUTE_CONFIG)) {
    if (config.allowedLensIds?.includes(lensId)) return moduleKey;
  }
  return null;
}
