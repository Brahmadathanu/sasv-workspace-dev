/**
 * Stage-05 recommended_ui_route resolver for Costing Control remediation.
 * Gate 11Y.10G.2 — verified destination mappings only.
 */

import { COSTING_ROUTE_CONFIG } from "./costing-route-config.js";
import {
  DESTINATION_ACCESS,
  getDestinationViewAccess,
  isDestinationAccessGateArmed,
} from "./costing-destination-access.js";
import { COMMERCIAL_SALES_ASSUMPTIONS_WORKSPACE_ID } from "./costing-suite-commercial-sales-assumptions.js";

export const PRODUCTION_ROUTE_MANAGER_ROUTE = "PRODUCTION_ROUTE_MANAGER";
export const MATERIAL_RATE_MANAGER_ROUTE = "MATERIAL_RATE_MANAGER";
export const MATERIAL_RATE_REVIEW_ROUTE = "MATERIAL_RATE_REVIEW";
export const SELLING_PRICE_POLICY_REVIEW_ROUTE = "SELLING_PRICE_POLICY_REVIEW";
export const PRICING_POLICY_REVIEW_ROUTE = "PRICING_POLICY_REVIEW";
export const COST_APPROVAL_WORKBENCH_ROUTE = "COST_APPROVAL_WORKBENCH";
// WP08 G2-1: server WP01 readiness codes whose destination is a single,
// existing, exactly-configured Costing route (selection by lens/workspace only).
export const DRIVER_GOVERNANCE_ROUTE = "DRIVER_GOVERNANCE";
export const QC_ACTION_QUEUE_ROUTE = "QC_ACTION_QUEUE";
export const MATERIALS_STORES_ACTION_QUEUE_ROUTE =
  "MATERIALS_STORES_ACTION_QUEUE";
export const COMMERCIAL_SALES_ASSUMPTIONS_ROUTE =
  "COMMERCIAL_SALES_ASSUMPTIONS";

/**
 * Server codes that are deliberately NOT navigable. Kept as data so tests can
 * prove they are never guessed. See WP08 G2-1 report (§ route-code matrix).
 * - MRP_GOVERNANCE / SELLING_SCHEME_POLICIES: several plausible PPM
 *   workspaces and PPM does not consume product_id/sku_id (owner decision).
 * - BATCH_SIZES / REGIONAL_MARKETING_REVIEW: no proven destination.
 * - MANAGE_PRODUCTS / PM_BOM_MANAGER: cross-module Master Data entry is
 *   handled by the Manage Products selection contract, not this resolver.
 */
export const UNMAPPED_RECOMMENDED_ROUTE_CODES = Object.freeze({
  MRP_GOVERNANCE: "ambiguous-workspace",
  SELLING_SCHEME_POLICIES: "ambiguous-workspace",
  BATCH_SIZES: "unmapped",
  REGIONAL_MARKETING_REVIEW: "unmapped",
});

export const DIRECT_LABOUR_ROUTE_BLOCKED_STATUS = "DIRECT_LABOUR_ROUTE_BLOCKED";

export const DIRECT_LABOUR_ROUTE_BLOCKED_MESSAGE =
  "No valid effective Production Route is available for this Product.";

export const MATERIAL_REVIEW_SECONDARY_MESSAGE =
  "Material costing also requires review.";

export const NO_VERIFIED_RATE_MANAGER_REMEDIATION =
  "no-verified-rate-manager-remediation";

const ROUTE_LABELS = Object.freeze({
  PRODUCTION_ROUTE_MANAGER: "Production Route Manager",
  MATERIAL_RATE_MANAGER: "Material Rate Manager",
  MATERIAL_RATE_REVIEW: "Material Rate Review",
  SELLING_PRICE_POLICY_REVIEW: "Selling Price Policy Review",
  PRICING_POLICY_REVIEW: "Pricing Policy Review",
  COST_APPROVAL_WORKBENCH: "Cost Approval Workbench",
  DRIVER_GOVERNANCE: "Driver Governance",
  QC_ACTION_QUEUE: "QC Action Queue",
  MATERIALS_STORES_ACTION_QUEUE: "Materials / Stores Action Queue",
  COMMERCIAL_SALES_ASSUMPTIONS: "Commercial Sales Assumptions",
});

const CONTROL_STATUS_LABELS = Object.freeze({
  DIRECT_LABOUR_ROUTE_BLOCKED: "Production Route required",
});

export function normalizeRecommendedUiRouteCode(routeCode) {
  if (routeCode === null || routeCode === undefined || routeCode === "") {
    return "";
  }
  return String(routeCode).trim().toUpperCase();
}

function humanizeCode(code) {
  const raw = String(code || "").trim();
  if (!raw) return "";
  return raw
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function formatRecommendedUiRouteLabel(routeCode) {
  const normalized = normalizeRecommendedUiRouteCode(routeCode);
  if (!normalized) return "";
  if (Object.prototype.hasOwnProperty.call(ROUTE_LABELS, normalized)) {
    return ROUTE_LABELS[normalized];
  }
  return humanizeCode(normalized) || normalized;
}

export function formatFirstControlStatusLabel(statusCode) {
  const normalized = normalizeRecommendedUiRouteCode(statusCode);
  if (!normalized) return "";
  if (Object.prototype.hasOwnProperty.call(CONTROL_STATUS_LABELS, normalized)) {
    return CONTROL_STATUS_LABELS[normalized];
  }
  return humanizeCode(normalized) || normalized;
}

/**
 * Display copy for primary control. Prefer clear server control_note;
 * fall back to canonical route-blocker text for DIRECT_LABOUR_ROUTE_BLOCKED.
 */
export function resolveSkuControlPrimaryMessage({
  firstControlStatus,
  controlNote,
} = {}) {
  const note = String(controlNote ?? "").trim();
  if (note) return note;
  const status = normalizeRecommendedUiRouteCode(firstControlStatus);
  if (status === DIRECT_LABOUR_ROUTE_BLOCKED_STATUS) {
    return DIRECT_LABOUR_ROUTE_BLOCKED_MESSAGE;
  }
  return "";
}

export function resolveSkuControlSecondaryMaterialMessage(materialCostingStatus) {
  const status = normalizeRecommendedUiRouteCode(materialCostingStatus);
  if (status === "REVIEW_REQUIRED") {
    return MATERIAL_REVIEW_SECONDARY_MESSAGE;
  }
  return "";
}

/** Blocking line counts: null/undefined/invalid → 0. */
export function normalizeBlockingLineCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

function normalizeOptionalId(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeOptionalPeriodStart(value) {
  const raw = String(value ?? "").trim();
  return raw || null;
}

function normalizeOptionalStatus(value) {
  const raw = String(value ?? "").trim();
  return raw || null;
}

function appendIdContinuity(params, ctx) {
  const productId = normalizeOptionalId(ctx.productId ?? ctx.product_id);
  const skuId = normalizeOptionalId(ctx.skuId ?? ctx.sku_id);
  if (productId != null) params.productId = productId;
  if (skuId != null) params.skuId = skuId;
  return params;
}

function appendPeriodStart(params, ctx) {
  const periodStart = normalizeOptionalPeriodStart(
    ctx.periodStart ?? ctx.period_start,
  );
  if (periodStart) params.periodStart = periodStart;
  return params;
}

function resolveMaterialRateManagerTarget(ctx) {
  const rm = normalizeBlockingLineCount(
    ctx.rmBlockingLineCount ?? ctx.rm_blocking_line_count,
  );
  const pm = normalizeBlockingLineCount(
    ctx.pmBlockingLineCount ?? ctx.pm_blocking_line_count,
  );

  if (rm === 0 && pm === 0) {
    return {
      navigable: false,
      label: formatRecommendedUiRouteLabel(MATERIAL_RATE_MANAGER_ROUTE),
      reason: NO_VERIFIED_RATE_MANAGER_REMEDIATION,
    };
  }

  const issue = [];
  const source = [];
  if (rm > 0) {
    issue.push("MATERIAL_RATE_MANAGER_RM");
    source.push("RM");
  }
  if (pm > 0) {
    issue.push("MATERIAL_RATE_MANAGER_PM");
    source.push("PM");
  }

  const navigateParams = appendPeriodStart(
    appendIdContinuity(
      {
        lens: "manual-rate-manager",
        managerTab: "action-queue",
        issue,
        source,
      },
      ctx,
    ),
    ctx,
  );

  return {
    navigable: true,
    moduleKey: "material-cost-manager",
    lensId: "manual-rate-manager",
    newTab: true,
    label: "Open Material Rate Manager",
    navigateParams,
  };
}

function resolveMaterialRateReviewTarget(ctx) {
  const navigateParams = appendPeriodStart(
    appendIdContinuity(
      {
        lens: "costing-review-workbench",
        issue: ["MATERIAL_RATE_REVIEW"],
        status: ["REVIEW_REQUIRED"],
      },
      ctx,
    ),
    ctx,
  );

  return {
    navigable: true,
    moduleKey: "costing-control-center",
    lensId: "costing-review-workbench",
    newTab: true,
    label: "Open Costing Review Workbench",
    navigateParams,
  };
}

function resolvePricingPolicyWorkspaceTarget(ctx, statusValue) {
  const navigateParams = appendIdContinuity(
    {
      workspace: "sku-overview",
    },
    ctx,
  );
  const status = normalizeOptionalStatus(statusValue);
  if (status) {
    navigateParams.status = [status];
  }

  return {
    navigable: true,
    moduleKey: "pricing-policy-manager",
    workspaceId: "sku-overview",
    newTab: true,
    label: "Open Pricing Policy Manager",
    navigateParams,
  };
}

/**
 * @param {unknown} routeCode
 * @param {{
 *   productId?: number|string|null,
 *   skuId?: number|string|null,
 *   periodStart?: string|null,
 *   rmBlockingLineCount?: number|string|null,
 *   pmBlockingLineCount?: number|string|null,
 *   sellingPriceBridgeStatus?: string|null,
 *   pricingBridgeStatus?: string|null,
 * }} [ctx]
 * @returns {{
 *   navigable: boolean,
 *   moduleKey?: string,
 *   lensId?: string,
 *   workspaceId?: string,
 *   productId?: number|null,
 *   newTab?: boolean,
 *   label: string,
 *   navigateParams?: Record<string, unknown>,
 *   reason?: string,
 * }}
 */
function resolveRecommendedUiRouteTargetUngated(routeCode, ctx = {}) {
  const normalized = normalizeRecommendedUiRouteCode(routeCode);
  const label = formatRecommendedUiRouteLabel(normalized) || normalized || "—";

  if (!normalized) {
    return {
      navigable: false,
      label: "—",
      reason: "empty",
    };
  }

  if (normalized === PRODUCTION_ROUTE_MANAGER_ROUTE) {
    const rawProductId = ctx.productId ?? ctx.product_id;
    const productNum = Number(rawProductId);
    const hasProduct =
      rawProductId != null &&
      rawProductId !== "" &&
      Number.isFinite(productNum);

    if (hasProduct) {
      return {
        navigable: true,
        moduleKey: "production-route-manager",
        lensId: "product-route-assignments",
        productId: productNum,
        newTab: true,
        label: "Open Production Route Manager",
        navigateParams: {
          lens: "product-route-assignments",
          productId: productNum,
        },
      };
    }

    return {
      navigable: true,
      moduleKey: "production-route-manager",
      lensId: "route-readiness",
      productId: null,
      newTab: true,
      label: "Open Production Route Manager",
      navigateParams: {
        lens: "route-readiness",
      },
      reason: "missing-product",
    };
  }

  if (normalized === MATERIAL_RATE_MANAGER_ROUTE) {
    return resolveMaterialRateManagerTarget(ctx);
  }

  if (normalized === MATERIAL_RATE_REVIEW_ROUTE) {
    return resolveMaterialRateReviewTarget(ctx);
  }

  if (normalized === SELLING_PRICE_POLICY_REVIEW_ROUTE) {
    return resolvePricingPolicyWorkspaceTarget(
      ctx,
      ctx.sellingPriceBridgeStatus ?? ctx.selling_price_bridge_status,
    );
  }

  if (normalized === PRICING_POLICY_REVIEW_ROUTE) {
    return resolvePricingPolicyWorkspaceTarget(
      ctx,
      ctx.pricingBridgeStatus ?? ctx.pricing_bridge_status,
    );
  }

  if (normalized === DRIVER_GOVERNANCE_ROUTE) {
    // Global driver policy: no Product/SKU/period identity applies.
    return {
      navigable: true,
      moduleKey: "cost-build-manager",
      lensId: "driver-governance",
      newTab: true,
      label: "Open Driver Governance",
      navigateParams: { lens: "driver-governance" },
    };
  }

  if (
    normalized === QC_ACTION_QUEUE_ROUTE ||
    normalized === MATERIALS_STORES_ACTION_QUEUE_ROUTE
  ) {
    // Period-scoped queues. They do not read product_id/sku_id from the URL,
    // so identity is not advertised (truthful semantics); period only.
    const isQc = normalized === QC_ACTION_QUEUE_ROUTE;
    const lensId = isQc ? "qc-action-queue" : "materials-stores-action-queue";
    return {
      navigable: true,
      moduleKey: "cost-sheet-review",
      lensId,
      newTab: true,
      label: isQc
        ? "Open QC Action Queue"
        : "Open Materials / Stores Action Queue",
      navigateParams: appendPeriodStart({ lens: lensId }, ctx),
    };
  }

  if (normalized === COMMERCIAL_SALES_ASSUMPTIONS_ROUTE) {
    // Single exact PPM workspace; PPM ignores product_id/sku_id, so none sent.
    return {
      navigable: true,
      moduleKey: "pricing-policy-manager",
      workspaceId: COMMERCIAL_SALES_ASSUMPTIONS_WORKSPACE_ID,
      newTab: true,
      label: "Open Commercial Sales Assumptions",
      navigateParams: appendPeriodStart(
        { workspace: COMMERCIAL_SALES_ASSUMPTIONS_WORKSPACE_ID },
        ctx,
      ),
    };
  }

  if (normalized === COST_APPROVAL_WORKBENCH_ROUTE) {
    return {
      navigable: false,
      label,
      reason: "unmapped",
    };
  }

  // Unknown stays visible, non-navigable.
  return {
    navigable: false,
    label,
    reason: "unmapped",
  };
}

export const PERMISSION_DENIED_REASON = "permission-denied";
export const PERMISSION_UNKNOWN_REASON = "permission-unknown";

export const RECOMMENDED_ROUTE_UNAVAILABLE_TEXT = Object.freeze({
  [PERMISSION_DENIED_REASON]:
    "You do not have permission to open this destination.",
  [PERMISSION_UNKNOWN_REASON]:
    "Destination access could not be verified, so no link is offered.",
  unmapped: "No destination is configured for this item yet.",
  "ambiguous-workspace":
    "No single destination is configured for this item yet (owner decision pending).",
  default: "No destination is configured for this item yet.",
});

export function describeRecommendedRouteUnavailable(reason) {
  return (
    RECOMMENDED_ROUTE_UNAVAILABLE_TEXT[reason] ||
    RECOMMENDED_ROUTE_UNAVAILABLE_TEXT.default
  );
}

/**
 * Permission gate over a resolved target. Once the shell arms the access gate,
 * a navigable target survives only when the destination module's own
 * permission target is verified view-granted; denied, missing, unresolved or
 * failed permission resolution all degrade to non-navigable text. The
 * destination still enforces its own gate on arrival.
 */
export function gateRecommendedTargetByAccess(target) {
  if (!target || target.navigable !== true) return target;
  if (!isDestinationAccessGateArmed()) return target;
  const permissionTarget = COSTING_ROUTE_CONFIG[target.moduleKey]?.permissionTarget;
  const access = getDestinationViewAccess(permissionTarget);
  if (access === DESTINATION_ACCESS.GRANTED) return target;
  return {
    navigable: false,
    label: target.label,
    moduleKey: target.moduleKey,
    reason:
      access === DESTINATION_ACCESS.UNKNOWN
        ? PERMISSION_UNKNOWN_REASON
        : PERMISSION_DENIED_REASON,
  };
}

export function resolveRecommendedUiRouteTarget(routeCode, ctx = {}) {
  return gateRecommendedTargetByAccess(
    resolveRecommendedUiRouteTargetUngated(routeCode, ctx),
  );
}

/**
 * A resolver target is offerable only when it names a real, configured Costing destination (module route and, when
 * present, an allowed lens). Single authority shared by the Costing shell surfaces and Manage Products.
 */
export function isConfiguredRecommendedTarget(target) {
  if (!target || target.navigable !== true) return false;
  const config = COSTING_ROUTE_CONFIG[target.moduleKey];
  if (!config?.routePath) return false;
  if (target.lensId && Array.isArray(config.allowedLensIds)) {
    return config.allowedLensIds.includes(target.lensId);
  }
  return true;
}

/** Pricing Policy Manager ignores product_id/sku_id today: a PPM link never claims to carry identity. */
export function recommendedTargetCarriesIdentity(target) {
  return !!target && target.moduleKey !== "pricing-policy-manager";
}

function cssList(value) {
  return Array.isArray(value) ? value.join(",") : String(value);
}

/**
 * Same-folder (platform-neutral) href for a configured target, for hosts that run outside the Costing shell (Manage
 * Products). Costing pages and Master Data pages share public/shared/, which Electron serves at /public/shared/ and the
 * PWA at /shared/, so a sibling-relative URL is correct in both. Returns null for anything not configured.
 */
export function buildRecommendedRouteHref(target) {
  if (!isConfiguredRecommendedTarget(target)) return null;
  const config = COSTING_ROUTE_CONFIG[target.moduleKey];
  const file = /([^/]+\.html)$/i.exec(String(config.routePath || ""))?.[1];
  if (!file) return null;
  const p = target.navigateParams || {};
  const qs = new URLSearchParams();
  const isPpm = target.moduleKey === "pricing-policy-manager";
  if (isPpm) {
    if (p.workspace) qs.set("workspace", p.workspace);
    if (p.status?.length) qs.set("status", cssList(p.status));
    if (p.periodStart && p.workspace === COMMERCIAL_SALES_ASSUMPTIONS_WORKSPACE_ID) {
      qs.set("period_start", p.periodStart);
    }
  } else {
    if (p.lens) qs.set("lens", p.lens);
    if (p.status?.length) qs.set("status", cssList(p.status));
    if (p.issue?.length) qs.set("issue", cssList(p.issue));
    if (p.source?.length) qs.set("source", cssList(p.source));
    if (p.managerTab) qs.set("manager_tab", p.managerTab);
    if (p.periodStart) qs.set("period_start", p.periodStart);
    if (p.productId != null) qs.set("product_id", String(p.productId));
    if (p.skuId != null) qs.set("sku_id", String(p.skuId));
  }
  const query = qs.toString();
  return query ? `${file}?${query}` : file;
}
