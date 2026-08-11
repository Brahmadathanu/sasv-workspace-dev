/**
 * Stage-05 recommended_ui_route resolver for Costing Control remediation.
 * Gate 11Y.10G.2 — verified destination mappings only.
 */

export const PRODUCTION_ROUTE_MANAGER_ROUTE = "PRODUCTION_ROUTE_MANAGER";
export const MATERIAL_RATE_MANAGER_ROUTE = "MATERIAL_RATE_MANAGER";
export const MATERIAL_RATE_REVIEW_ROUTE = "MATERIAL_RATE_REVIEW";
export const SELLING_PRICE_POLICY_REVIEW_ROUTE = "SELLING_PRICE_POLICY_REVIEW";
export const PRICING_POLICY_REVIEW_ROUTE = "PRICING_POLICY_REVIEW";
export const COST_APPROVAL_WORKBENCH_ROUTE = "COST_APPROVAL_WORKBENCH";

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
export function resolveRecommendedUiRouteTarget(routeCode, ctx = {}) {
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
