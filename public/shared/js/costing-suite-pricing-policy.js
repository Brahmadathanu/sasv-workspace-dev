import {
  MRP_PROPOSAL_VIEWS,
  createMrpProposalHandlers,
} from "./costing-suite-mrp-proposals.js";
import {
  MRP_DECISION_VIEWS,
  createMrpDecisionHandlers,
} from "./costing-suite-mrp-decisions.js";
import {
  MRP_APPLICATION_VIEWS,
  createMrpApplicationHandlers,
} from "./costing-suite-mrp-application.js";
import {
  MRP_APPLIED_HISTORY_VIEWS,
  createMrpAppliedHistoryHandlers,
} from "./costing-suite-mrp-applied-history.js";
import {
  countActiveMrpFilterFields,
  renderMrpActiveFilterChip,
  renderMrpFilterDrawerPanel,
  humanizeMrpToken,
} from "./costing-suite-mrp-proposal-shared.js";

export {
  MRP_PROPOSAL_VIEWS,
  MRP_DECISION_VIEWS,
  MRP_APPLICATION_VIEWS,
  MRP_APPLIED_HISTORY_VIEWS,
};

/**
 * Legacy shell/route lens IDs implemented by the Pricing Policy controller.
 * Scheme Comparison lives on Cost Sheet Review (schemeComparisonCtrl).
 */
export const PRICING_POLICY_LENS_IDS = [
  "mrp-governance",
  "policy-manager",
];

/** Default landing workspace (business default unchanged). */
export const PRICING_POLICY_DEFAULT_WORKSPACE = "sku-overview";

/**
 * F5 inbound-only: former Area / group tokens → default workspace.
 * Not mutable navigation state.
 */
export const PRICING_POLICY_COMPAT_AREA_DEFAULT_WORKSPACE = {
  "mrp-policies": "sku-mrp-policies",
  "mrp-workflow": "mrp-proposals",
  "selling-schemes": "sku-overview",
};

/** @deprecated F5 — alias for inbound default-area token only. */
export const PRICING_POLICY_DEFAULT_AREA = "selling-schemes";

/**
 * Presentation-only navigation groups (desktop separators / narrow optgroups).
 * Not interactive state and carries no capabilities or workspace memory.
 */
export const PRICING_POLICY_NAV_GROUPS = [
  { id: "mrp-policy-setup", label: "MRP Policy Setup" },
  { id: "mrp-change-workflow", label: "MRP Change Workflow" },
  { id: "selling-schemes", label: "Selling & Schemes" },
];

/** Flat group → former Area id (derived labeling / inbound aliases only). */
const PRICING_POLICY_GROUP_TO_COMPAT_AREA_ID = {
  "mrp-policy-setup": "mrp-policies",
  "mrp-change-workflow": "mrp-workflow",
  "selling-schemes": "selling-schemes",
};

/**
 * Authoritative flat workspace metadata (PPM-C1H3.3-F1).
 * Array order is the sole display / strip order — do not re-sort by Object.keys.
 * SC4: nine operational workspaces (Scheme Comparison removed).
 */
export const PRICING_POLICY_WORKSPACES = [
  {
    id: "sku-mrp-policies",
    label: "SKU MRP Policies",
    groupId: "mrp-policy-setup",
    purpose: "Govern current and historical canonical SKU MRP policies.",
    supportsSearch: true,
    supportsPeq: false,
    supportsPeriod: false,
    legacyLensId: "mrp-governance",
    nestedViewType: "current-history",
  },
  {
    id: "product-derivation-policies",
    label: "Product Derivation Policies",
    groupId: "mrp-policy-setup",
    purpose:
      "Define reusable product rules that derive SKU MRPs from a governed Reference Pack.",
    supportsSearch: true,
    supportsPeq: false,
    supportsPeriod: false,
    legacyLensId: "mrp-governance",
    nestedViewType: "current-history",
  },
  {
    id: "mrp-proposals",
    label: "MRP Proposals",
    groupId: "mrp-change-workflow",
    purpose:
      "Generate and prepare dated product MRP proposals from confirmed derivation policies.",
    supportsSearch: true,
    supportsPeq: false,
    supportsPeriod: false,
    legacyLensId: "mrp-governance",
    nestedViewType: "register-workspace",
  },
  {
    id: "proposal-decisions",
    label: "Proposal Decisions",
    groupId: "mrp-change-workflow",
    purpose: "Approve or reject submitted proposal lines.",
    supportsSearch: true,
    supportsPeq: false,
    supportsPeriod: false,
    legacyLensId: "mrp-governance",
    nestedViewType: "register-workspace",
  },
  {
    id: "approved-for-application",
    label: "Approved for Application",
    groupId: "mrp-change-workflow",
    purpose:
      "Review approved proposals ready for atomic canonical MRP application.",
    supportsSearch: true,
    supportsPeq: false,
    supportsPeriod: false,
    legacyLensId: "mrp-governance",
    nestedViewType: "register-workspace",
  },
  {
    id: "applied-proposal-history",
    label: "Applied Proposal History",
    groupId: "mrp-change-workflow",
    purpose:
      "Trace applied proposal lines to canonical SKU MRP policy history.",
    supportsSearch: true,
    supportsPeq: false,
    supportsPeriod: false,
    legacyLensId: "mrp-governance",
    nestedViewType: "register-workspace",
  },
  {
    id: "sku-overview",
    label: "SKU Policy Overview",
    groupId: "selling-schemes",
    purpose: "Review and manage SKU-level selling and pricing policy status.",
    supportsSearch: true,
    supportsPeq: true,
    supportsPeriod: false,
    legacyLensId: "policy-manager",
    nestedViewType: null,
  },
  {
    id: "scheme-master",
    label: "Scheme Master",
    groupId: "selling-schemes",
    purpose: "Govern scheme definitions and lifecycle.",
    supportsSearch: true,
    supportsPeq: true,
    supportsPeriod: false,
    legacyLensId: "policy-manager",
    nestedViewType: null,
  },
  {
    id: "scheme-rule-register",
    label: "Scheme Rule Register",
    groupId: "selling-schemes",
    purpose: "Govern scheme hierarchy and rule applicability.",
    supportsSearch: true,
    supportsPeq: true,
    supportsPeriod: false,
    legacyLensId: "policy-manager",
    nestedViewType: "current-history",
  },
];

export const PRICING_POLICY_NAV_GROUP_IDS = PRICING_POLICY_NAV_GROUPS.map(
  (g) => g.id,
);

/** All flat workspace ids in display order (nine after SC4). */
export const PRICING_POLICY_WORKSPACE_IDS = PRICING_POLICY_WORKSPACES.map(
  (w) => w.id,
);

const PRICING_POLICY_WORKSPACE_BY_ID = new Map(
  PRICING_POLICY_WORKSPACES.map((w) => [w.id, w]),
);

/** Former Area ids accepted on inbound URLs (not mutable navigation). */
export const PRICING_POLICY_AREA_IDS = Object.keys(
  PRICING_POLICY_COMPAT_AREA_DEFAULT_WORKSPACE,
);

const PRICING_POLICY_WORKSPACE_TO_AREA = (() => {
  const map = new Map();
  for (const ws of PRICING_POLICY_WORKSPACES) {
    const areaId = PRICING_POLICY_GROUP_TO_COMPAT_AREA_ID[ws.groupId];
    if (areaId) map.set(ws.id, areaId);
  }
  return map;
})();

const PRICING_POLICY_WORKSPACE_TO_GROUP = (() => {
  const map = new Map();
  for (const ws of PRICING_POLICY_WORKSPACES) {
    map.set(ws.id, ws.groupId);
  }
  return map;
})();

/**
 * Human labels for former Area tokens (suite path chrome / inbound only).
 * Not navigation state.
 */
const PRICING_POLICY_COMPAT_AREA_LABELS = {
  "mrp-policies": "MRP Policies",
  "mrp-workflow": "MRP Workflow",
  "selling-schemes": "Selling & Schemes",
};

/** MRP workspaces in display order (Policies then Workflow) — H2 strip source. */
export const MRP_GOVERNANCE_DEFAULT_TAB = "sku-mrp-policies";

export const MRP_GOVERNANCE_TABS = PRICING_POLICY_WORKSPACES.filter(
  (w) =>
    w.groupId === "mrp-policy-setup" || w.groupId === "mrp-change-workflow",
).map((w) => ({
  id: w.id,
  label: w.label,
  purpose: w.purpose,
}));

export const MRP_GOVERNANCE_TAB_IDS = MRP_GOVERNANCE_TABS.map((tab) => tab.id);

const SELLING_SCHEME_WORKSPACE_IDS = PRICING_POLICY_WORKSPACES.filter(
  (w) => w.groupId === "selling-schemes",
).map((w) => w.id);

/** Sub-views inside SKU MRP Policies — shared by desktop tabs and narrow select. */
export const SKU_MRP_POLICY_VIEWS = [
  { id: "current", label: "Current Policies" },
  { id: "history", label: "Policy History" },
];

/** Sub-views inside Product Derivation Policies — shared by desktop tabs and narrow select. */
export const PRODUCT_DERIVATION_POLICY_VIEWS = [
  { id: "current", label: "Current Policies" },
  { id: "history", label: "Policy History" },
];

/**
 * Static validation for flat nav metadata (F1).
 * Returns error strings; callers (smoke) may fail-fast. Module load logs only.
 */
export function validatePricingPolicyNavMetadata() {
  const errors = [];
  const groupIds = new Set();
  for (const group of PRICING_POLICY_NAV_GROUPS) {
    if (!group?.id) errors.push("nav group missing id");
    else if (groupIds.has(group.id))
      errors.push(`duplicate group id: ${group.id}`);
    else groupIds.add(group.id);
  }
  for (const expected of [
    "mrp-policy-setup",
    "mrp-change-workflow",
    "selling-schemes",
  ]) {
    if (!groupIds.has(expected)) errors.push(`missing nav group: ${expected}`);
  }
  if (groupIds.has("analysis")) {
    errors.push("analysis nav group must be removed (SC4)");
  }

  const wsIds = new Set();
  for (const ws of PRICING_POLICY_WORKSPACES) {
    if (!ws?.id) {
      errors.push("workspace missing id");
      continue;
    }
    if (wsIds.has(ws.id)) errors.push(`duplicate workspace id: ${ws.id}`);
    else wsIds.add(ws.id);
    if (!groupIds.has(ws.groupId)) {
      errors.push(`workspace ${ws.id} has unknown groupId ${ws.groupId}`);
    }
    if (!ws.legacyLensId) {
      errors.push(`workspace ${ws.id} missing legacyLensId`);
    }
  }

  if (wsIds.has("scheme-comparison")) {
    errors.push("scheme-comparison must not remain a PPM workspace (SC4)");
  }

  const expectedOrder = [
    "sku-mrp-policies",
    "product-derivation-policies",
    "mrp-proposals",
    "proposal-decisions",
    "approved-for-application",
    "applied-proposal-history",
    "sku-overview",
    "scheme-master",
    "scheme-rule-register",
  ];
  if (PRICING_POLICY_WORKSPACE_IDS.length !== expectedOrder.length) {
    errors.push(
      `expected ${expectedOrder.length} workspaces, got ${PRICING_POLICY_WORKSPACE_IDS.length}`,
    );
  }
  expectedOrder.forEach((id, index) => {
    if (PRICING_POLICY_WORKSPACE_IDS[index] !== id) {
      errors.push(
        `workspace order mismatch at ${index}: expected ${id}, got ${PRICING_POLICY_WORKSPACE_IDS[index]}`,
      );
    }
  });

  if (!wsIds.has(PRICING_POLICY_DEFAULT_WORKSPACE)) {
    errors.push(`default workspace missing: ${PRICING_POLICY_DEFAULT_WORKSPACE}`);
  }

  const mrpIds = [
    "sku-mrp-policies",
    "product-derivation-policies",
    "mrp-proposals",
    "proposal-decisions",
    "approved-for-application",
    "applied-proposal-history",
  ];
  for (const id of mrpIds) {
    const ws = PRICING_POLICY_WORKSPACE_BY_ID.get(id);
    if (!ws) {
      errors.push(`missing MRP workspace ${id}`);
      continue;
    }
    if (ws.supportsPeq) errors.push(`${id} must have supportsPeq false`);
    if (ws.supportsPeriod) errors.push(`${id} must have supportsPeriod false`);
  }

  for (const id of ["sku-overview", "scheme-master", "scheme-rule-register"]) {
    const ws = PRICING_POLICY_WORKSPACE_BY_ID.get(id);
    if (!ws) {
      errors.push(`missing Selling workspace ${id}`);
      continue;
    }
    if (!ws.supportsPeq) errors.push(`${id} must have supportsPeq true`);
    if (ws.supportsPeriod) errors.push(`${id} must have supportsPeriod false`);
  }

  for (const ws of PRICING_POLICY_WORKSPACES) {
    if (ws.supportsPeriod) {
      errors.push(`${ws.id} must have supportsPeriod false (SC4: no PPM period)`);
    }
    if (!ws.supportsSearch) {
      errors.push(`${ws.id} must have supportsSearch true`);
    }
  }

  // F5: inbound-only Area default map (not mutable state / projection).
  if (PRICING_POLICY_AREA_IDS.includes("scheme-comparison")) {
    errors.push("compat Area scheme-comparison must be removed (SC4)");
  }
  for (const [areaId, defaultWs] of Object.entries(
    PRICING_POLICY_COMPAT_AREA_DEFAULT_WORKSPACE,
  )) {
    if (!PRICING_POLICY_WORKSPACE_BY_ID.has(defaultWs)) {
      errors.push(`compat Area ${areaId} default workspace missing: ${defaultWs}`);
    }
    if (getPricingPolicyCompatAreaForWorkspace(defaultWs) !== areaId) {
      errors.push(
        `compat Area ${areaId} default ${defaultWs} does not map back to area`,
      );
    }
  }

  return errors;
}

const _pricingPolicyNavMetadataErrors = validatePricingPolicyNavMetadata();
if (_pricingPolicyNavMetadataErrors.length) {
  console.error(
    "[pricing-policy] PPM-C1H3.3-F1 nav metadata invalid:",
    _pricingPolicyNavMetadataErrors,
  );
}

export function isPricingPolicyLens(lensId) {
  const id = String(lensId || "").trim();
  return (
    PRICING_POLICY_LENS_IDS.includes(id) || PRICING_POLICY_AREA_IDS.includes(id)
  );
}

export function getPricingPolicyNavGroupMeta(groupId) {
  const id = String(groupId || "").trim();
  return PRICING_POLICY_NAV_GROUPS.find((group) => group.id === id) || null;
}

/**
 * Inbound compatibility only: normalize former Area / legacy lens / group tokens.
 */
export function normalizePricingPolicyCompatArea(areaId) {
  const id = String(areaId || "").trim();
  if (PRICING_POLICY_AREA_IDS.includes(id)) return id;
  if (id === "policy-manager") return "selling-schemes";
  if (id === "mrp-governance") return "mrp-policies";
  const fromGroup = PRICING_POLICY_GROUP_TO_COMPAT_AREA_ID[id];
  if (fromGroup) return fromGroup;
  return PRICING_POLICY_DEFAULT_AREA;
}

/** @deprecated F5 — use normalizePricingPolicyCompatArea (inbound only). */
export function normalizePricingPolicyArea(areaId) {
  return normalizePricingPolicyCompatArea(areaId);
}

/**
 * Inbound / suite-path labeling only. Not navigation state.
 */
export function getPricingPolicyCompatAreaMeta(areaId) {
  const normalized = normalizePricingPolicyCompatArea(areaId);
  return {
    id: normalized,
    label: PRICING_POLICY_COMPAT_AREA_LABELS[normalized] || normalized,
    defaultWorkspace:
      PRICING_POLICY_COMPAT_AREA_DEFAULT_WORKSPACE[normalized] ||
      PRICING_POLICY_DEFAULT_WORKSPACE,
  };
}

/** @deprecated F5 — use getPricingPolicyCompatAreaMeta (inbound / labeling only). */
export function getPricingPolicyAreaMeta(areaId) {
  return getPricingPolicyCompatAreaMeta(areaId);
}

/**
 * Flat workspace meta (authoritative). Includes derived compat `areaId`.
 */
export function getPricingPolicyWorkspaceMeta(workspaceId) {
  const id = String(workspaceId || "").trim();
  const found = PRICING_POLICY_WORKSPACE_BY_ID.get(id);
  if (!found) return null;
  return {
    ...found,
    areaId: PRICING_POLICY_WORKSPACE_TO_AREA.get(id) || null,
  };
}

export function getPricingPolicyGroupForWorkspace(workspaceId) {
  const id = String(workspaceId || "").trim();
  if (!id) return null;
  return PRICING_POLICY_WORKSPACE_TO_GROUP.get(id) || null;
}

export function getPricingPolicyWorkspacesForGroup(groupId) {
  const id = String(groupId || "").trim();
  if (!id) return [];
  return PRICING_POLICY_WORKSPACES.filter((w) => w.groupId === id);
}

export function getPricingPolicyWorkspaceCapabilities(workspaceId) {
  const meta = getPricingPolicyWorkspaceMeta(workspaceId);
  if (!meta) {
    return {
      supportsSearch: false,
      supportsPeq: false,
      supportsPeriod: false,
    };
  }
  return {
    supportsSearch: !!meta.supportsSearch,
    supportsPeq: !!meta.supportsPeq,
    supportsPeriod: !!meta.supportsPeriod,
  };
}

export function workspaceSupportsSearch(workspaceId) {
  return !!getPricingPolicyWorkspaceCapabilities(workspaceId).supportsSearch;
}

export function workspaceSupportsPeq(workspaceId) {
  return !!getPricingPolicyWorkspaceCapabilities(workspaceId).supportsPeq;
}

export function workspaceSupportsPeriod(workspaceId) {
  return !!getPricingPolicyWorkspaceCapabilities(workspaceId).supportsPeriod;
}

export function getLegacyLensForPricingPolicyWorkspace(workspaceId) {
  const meta = getPricingPolicyWorkspaceMeta(workspaceId);
  if (meta?.legacyLensId) return meta.legacyLensId;
  return "policy-manager";
}

/**
 * F2/F5 UI identity: which direct workspace tab is active.
 */
export function resolveActivePricingPolicyDirectWorkspaceId(
  _areaIdOrWorkspaceId,
  workspaceId,
) {
  // F5: first arg ignored (was Area). Accept one-arg workspace calls.
  const id =
    workspaceId != null
      ? String(workspaceId || "").trim()
      : String(_areaIdOrWorkspaceId || "").trim();
  if (id && PRICING_POLICY_WORKSPACE_BY_ID.has(id)) return id;
  return PRICING_POLICY_DEFAULT_WORKSPACE;
}

/**
 * Derive former Area id from workspace (compat labeling / reports only).
 */
export function getPricingPolicyCompatAreaForWorkspace(workspaceId) {
  const id = String(workspaceId || "").trim();
  if (!id) return null;
  return PRICING_POLICY_WORKSPACE_TO_AREA.get(id) || null;
}

/** @deprecated F5 — alias for getPricingPolicyCompatAreaForWorkspace. */
export function getPricingPolicyAreaForWorkspace(workspaceId) {
  return getPricingPolicyCompatAreaForWorkspace(workspaceId);
}

/**
 * Default workspace.
 * - No args → flat default `sku-overview`.
 * - With former Area / lens token → inbound lens-only default (compat only).
 */
export function getDefaultPricingPolicyWorkspace(areaId) {
  if (arguments.length === 0 || areaId == null || areaId === "") {
    return PRICING_POLICY_DEFAULT_WORKSPACE;
  }
  const normalized = normalizePricingPolicyCompatArea(areaId);
  return (
    PRICING_POLICY_COMPAT_AREA_DEFAULT_WORKSPACE[normalized] ||
    PRICING_POLICY_DEFAULT_WORKSPACE
  );
}

/**
 * Normalize workspace id.
 * - One arg (flat / F4–F5): invalid/empty → `sku-overview`.
 * - Two args (legacy Area compat): valid workspace always wins; else Area default.
 */
export function normalizePricingPolicyWorkspace(areaIdOrWorkspaceId, workspaceId) {
  if (arguments.length < 2) {
    const id = String(areaIdOrWorkspaceId || "").trim();
    if (id && PRICING_POLICY_WORKSPACE_BY_ID.has(id)) return id;
    return PRICING_POLICY_DEFAULT_WORKSPACE;
  }

  const id = String(workspaceId || "").trim();
  if (id && PRICING_POLICY_WORKSPACE_BY_ID.has(id)) return id;
  return getDefaultPricingPolicyWorkspace(areaIdOrWorkspaceId);
}

/**
 * Inbound compatibility only: map legacy lens / former Area token → Area id.
 */
export function resolvePricingPolicyAreaFromLegacyLens(
  legacyLensId,
  workspaceId = null,
) {
  const owner = getPricingPolicyCompatAreaForWorkspace(workspaceId);
  if (owner) return owner;
  return normalizePricingPolicyCompatArea(legacyLensId);
}

/**
 * Legacy loader derivation only: former Area → loader lens.
 * Prefer getLegacyLensForPricingPolicyWorkspace for active navigation.
 */
export function getLegacyLensForPricingPolicyArea(areaId) {
  const workspaceId = getDefaultPricingPolicyWorkspace(areaId);
  return getLegacyLensForPricingPolicyWorkspace(workspaceId);
}

/**
 * F4 — resolve inbound PPM navigation with workspace as the canonical truth.
 * Legacy lens / Area / tab parameters remain accepted for inbound compatibility.
 * A supplied valid workspace always wins over a stale or foreign lens.
 */
export function resolvePricingPolicyLaunchNavigation({
  lens = null,
  workspace = null,
  mrpTab = null,
  policyTab = null,
} = {}) {
  const rawLens = String(lens || "").trim();
  const workspaceProvided = workspace !== null && workspace !== undefined;
  const rawWorkspace = String(workspace || "").trim();
  const rawMrpTab = String(mrpTab || "").trim() || null;
  const rawPolicyTab = String(policyTab || "").trim() || null;
  const isLegacyInput = !!(rawLens || rawMrpTab || rawPolicyTab);

  let workspaceId = PRICING_POLICY_DEFAULT_WORKSPACE;

  if (workspaceProvided) {
    // F4: even with a stale/foreign lens, a valid workspace owns navigation.
    workspaceId = normalizePricingPolicyWorkspace(rawWorkspace);
  } else if (
    rawLens === "mrp-governance" &&
    rawMrpTab &&
    getPricingPolicyWorkspaceMeta(rawMrpTab)?.legacyLensId === "mrp-governance"
  ) {
    workspaceId = rawMrpTab;
  } else if (
    rawLens === "policy-manager" &&
    rawPolicyTab &&
    getPricingPolicyWorkspaceMeta(rawPolicyTab)?.legacyLensId === "policy-manager"
  ) {
    workspaceId = rawPolicyTab;
  } else if (rawLens === "mrp-policies") {
    workspaceId = "sku-mrp-policies";
  } else if (rawLens === "mrp-workflow") {
    workspaceId = "mrp-proposals";
  } else if (rawLens === "selling-schemes") {
    workspaceId = "sku-overview";
  } else if (rawLens === "mrp-governance") {
    workspaceId = "sku-mrp-policies";
  } else if (rawLens === "policy-manager") {
    workspaceId = "sku-overview";
  }

  const areaId =
    getPricingPolicyCompatAreaForWorkspace(workspaceId) ||
    PRICING_POLICY_DEFAULT_AREA;
  const legacyLensId = getLegacyLensForPricingPolicyWorkspace(workspaceId);

  return {
    areaId,
    workspaceId,
    legacyLensId,
    isLegacyInput,
    shouldRewriteCanonicalUrl:
      isLegacyInput ||
      !workspaceProvided ||
      rawWorkspace !== workspaceId,
  };
}

/**
 * Normalize outgoing PPM query params to canonical workspace-only navigation.
 */
export function toCanonicalPricingPolicyRouteParams(params = {}) {
  const resolved = resolvePricingPolicyLaunchNavigation({
    lens: params.lens,
    workspace: params.workspace,
    mrpTab: params.mrpTab,
    policyTab: params.policyTab,
  });
  const next = { ...params };
  next.workspace = resolved.workspaceId;
  delete next.lens;
  delete next.policyTab;
  delete next.mrpTab;
  delete next.policy_tab;
  delete next.mrp_tab;
  delete next.area;
  delete next.group;
  return next;
}

export function normalizeMrpGovernanceTab(tabId) {
  const id = String(tabId || "").trim();
  return MRP_GOVERNANCE_TAB_IDS.includes(id) ? id : MRP_GOVERNANCE_DEFAULT_TAB;
}

export function getMrpGovernanceTabMeta(tabId) {
  const normalized = normalizeMrpGovernanceTab(tabId);
  return (
    MRP_GOVERNANCE_TABS.find((tab) => tab.id === normalized) ||
    MRP_GOVERNANCE_TABS[0]
  );
}

export function normalizePolicyManagerTab(tabId) {
  const id = String(tabId || "").trim();
  return SELLING_SCHEME_WORKSPACE_IDS.includes(id)
    ? id
    : PRICING_POLICY_DEFAULT_WORKSPACE;
}





function policyManagerHeaders(tab) {
  if (tab === "scheme-master") {
    return [
      "Scheme",
      "Paid Qty",
      "Free Qty",
      "Total Qty",
      "Effective Free Discount %",
      "Status",
      "Type",
      "Active Direct Policies",
      "Active Hierarchy Rules",
      "Viability Periods",
      "Updated At",
    ];
  }
  if (tab === "scheme-rule-register") {
    return [
      "Rule",
      "Scope",
      "Region",
      "Scheme",
      "Apply Mode",
      "Effective From",
      "Effective To",
      "Status",
      "Remarks",
    ];
  }
  return [
    "Product / SKU",
    "MRP IK",
    "MRP OK",
    "GST %",
    "Discount IK %",
    "Discount OK %",
    "Contingency %",
    "Scheme IK",
    "Scheme OK",
    "Pricing Status",
    "Selling Price Status",
  ];
}

function policyManagerAlignments(tab) {
  if (tab === "scheme-master") {
    return [
      "c-left",
      "c-right",
      "c-right",
      "c-right",
      "c-right",
      "c-left",
      "c-left",
      "c-right",
      "c-right",
      "c-right",
      "c-left",
    ];
  }
  if (tab === "scheme-rule-register") {
    return [
      "c-left",
      "c-left",
      "c-left",
      "c-left",
      "c-left",
      "c-left",
      "c-left",
      "c-left",
      "c-left",
    ];
  }
  return [
    "c-left",
    "c-right",
    "c-right",
    "c-right",
    "c-right",
    "c-right",
    "c-right",
    "c-left",
    "c-left",
    "c-left",
    "c-left",
  ];
}

export function createPricingPolicyController(deps) {
  const {
    dom,
    costingFrom,
    costingRpc,
    fetchAllRows,
    showToast,
    handleError,
    setLoadingMask,
    text,
    formatMoney,
    formatPercent,
    formatNumber,
    formatDate,
    formatDateTime,
    formatOptionalMoney,
    statusChip,
    compactStatusText,
    productSkuLabel,
    cpCellPrimary,
    cpCellPrimaryHtml,
    normalizeStatus,
    detailPanel,
    kvSection,
    simpleTable,
    activePeriodIso,
    numberOrNullFromInput,
    numberOrZeroFromInput,
    reloadRows,
    onPolicyDataChanged,
    getCurrentLens,
    getSelectedSkuId,
    canEditPricingPolicyActions,
    formatTodayIsoIst,
    closeDetails,
    refreshOpenDrawerIfNeeded,
  } = deps;

  function canEditPolicyActions() {
    return (
      typeof canEditPricingPolicyActions === "function" &&
      canEditPricingPolicyActions() === true
    );
  }

  const PLUS_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>`;

  function renderPricingPolicyPlusButton(title) {
    return `<button
      type="button"
      class="icon-btn icon-btn-primary"
      id="pricingPolicyMetaCreateBtn"
      title="${text(title)}"
      aria-label="${text(title)}"
    >${PLUS_ICON_SVG}</button>`;
  }

  function syncPricingPolicyMetaActions() {
    const el =
      deps.genericTableMetaActions ||
      document.getElementById("genericTableMetaActions");
    const setVis =
      typeof deps.setVisible === "function"
        ? deps.setVisible
        : (node, visible, displayValue = "inline-flex") => {
            if (!node) return;
            node.classList.toggle("hidden", !visible);
            if (visible) node.style.display = displayValue;
            else node.style.display = "";
          };
    if (!el) return;

    // Gate on the *active* workspace only — never sticky remembered tabs from
    // getPolicyManagerTab / getMrpGovernanceTab (those leak Create Scheme onto SKU MRP).
    const activeWorkspace = String(
      getActiveDirectWorkspaceId() || pricingPolicyWorkspace || "",
    ).trim();
    const canEdit = canEditPolicyActions();

    let title = "";
    let onClick = null;

    if (
      activeWorkspace === "product-derivation-policies" &&
      canEdit &&
      productDerivationPolicyView === "current"
    ) {
      title = "Create Policy";
      onClick = () => openDerivationCreateModalFromToolbar();
    } else if (
      activeWorkspace === "mrp-proposals" &&
      canEdit &&
      mrpProposals.getMrpProposalView?.() === "register"
    ) {
      title = "Generate Proposal";
      onClick = () => void mrpProposals.openGenerateModal?.();
    } else if (activeWorkspace === "scheme-master" && canEdit) {
      title = "Create Scheme";
      onClick = () => openSchemeMasterCreateModal();
    } else if (
      activeWorkspace === "scheme-rule-register" &&
      canEdit &&
      schemeRuleRegisterView === "current"
    ) {
      title = "Create Rule";
      onClick = () => openSchemeRuleEditModal();
    }

    if (!title || typeof onClick !== "function") {
      el.innerHTML = "";
      setVis(el, false);
      return;
    }

    el.innerHTML = renderPricingPolicyPlusButton(title);
    setVis(el, true, "inline-flex");
    el.querySelector("#pricingPolicyMetaCreateBtn")?.addEventListener(
      "click",
      onClick,
    );
  }

  function requireEditAccess(actionLabel = "this action") {
    if (canEditPolicyActions()) return true;
    showToast(`You do not have permission to ${actionLabel}.`, "error", 4200);
    return false;
  }

  function syncPricingPolicyWriteUi() {
    const editable = canEditPolicyActions();
    [
      dom.sellingPolicyEditSaveBtn,
      dom.schemePolicyEditSaveBtn,
      dom.schemeRuleEditSaveBtn,
      dom.schemeRuleCloseSaveBtn,
      dom.mrpPolicyEditSaveBtn,
      dom.derivationPolicyEditDraftBtn,
      dom.derivationPolicyEditConfirmBtn,
      dom.futurePolicyConfirmProceedBtn,
      dom.scheduledPolicyCancelProceedBtn,
      dom.schemeMasterCreateSaveBtn,
      dom.schemeMasterMetadataSaveBtn,
      dom.schemeMasterDeactivateSaveBtn,
      dom.schemeMasterReactivateSaveBtn,
    ].forEach((btn) => {
      if (btn) btn.disabled = !editable;
    });
    mrpProposals.syncWriteUi?.();
    mrpDecisions.syncWriteUi?.();
    mrpApplication.syncWriteUi?.();
  }

  /**
   * F5: sole mutable PPM navigation truth.
   * Legacy Area / lastWorkspaceByArea removed — derive Area and CURRENT_LENS.
   */
  let pricingPolicyWorkspace = PRICING_POLICY_DEFAULT_WORKSPACE;
  /** @type {"current"|"history"} */
  let skuMrpPolicyView = "current";
  let skuMrpRawRows = [];
  let skuMrpFilters = {
    calcMode: [],
    sourceType: [],
    sourceQuality: [],
    lifecycle: [],
    skuState: [],
  };
  /** @type {null|boolean} null = auto (open when active filters) */
  let skuMrpFiltersOpen = null;
  /** @type {"current"|"history"} */
  let productDerivationPolicyView = "current";
  /** @type {"current"|"history"} */
  let schemeRuleRegisterView = "current";
  let productDerivationRawRows = [];
  let productDerivationFilters = {
    status: [],
    selectionSource: [],
    sourceType: [],
    sourceQuality: [],
    readiness: [],
    lifecycle: [],
  };
  /** @type {null|boolean} null = auto (open when active filters) */
  let productDerivationFiltersOpen = null;
  /** @type {Map<string, object>} readiness rows keyed by product_id */
  let productDerivationReadinessByProductId = new Map();
  let derivationPolicyEditProductId = null;
  let derivationPolicyEditRow = null;
  let derivationPolicyEditMode = "create";
  let derivationPolicyReturnFocus = null;
  let derivationPolicySaving = false;
  let derivationPolicyConfirmResolver = null;
  let futurePolicySubmissionContext = null;
  let futurePolicySubmissionRunning = false;
  let scheduledPolicyCancellationContext = null;
  let scheduledPolicyCancellationReturnFocus = null;
  let scheduledPolicyCancellationSaving = false;
  let scheduledPolicyCancellationCompleted = false;
  let scheduledPolicyCancellationReasonTouched = false;
  let derivationProductSkus = [];
  /** @type {Map<string, object>} current SKU MRP keyed by sku_id (modal display) */
  let derivationSkuMrpBySkuId = new Map();

  /** Late-bound so proposals / decisions / application / history handoffs share APIs. */
  let mrpProposals = null;
  let mrpApplication = null;
  let mrpAppliedHistory = null;
  /** Shell meta-drawer filter notify callback (set in renderMrpGovernanceTabs). */
  let mrpFilterLocalChangeHandler = null;

  const mrpDecisions = createMrpDecisionHandlers({
    dom,
    costingFrom,
    costingRpc,
    fetchAllRows,
    showToast,
    handleError,
    setLoadingMask,
    text,
    formatPercent,
    formatDate,
    formatDateTime,
    formatOptionalMoney,
    statusChip,
    cpCellPrimary,
    detailPanel,
    kvSection,
    reloadRows,
    canEditPricingPolicyActions,
    getMrpGovernanceTab,
    setMrpGovernanceTab,
    renderNestedSubviewNav: (...args) => renderNestedSubviewNav(...args),
    openMrpProposals: async (proposalId, onTabChange) => {
      setMrpGovernanceTab("mrp-proposals");
      if (proposalId != null && mrpProposals?.openProposalWorkspace) {
        await mrpProposals.openProposalWorkspace(proposalId);
      }
      if (typeof onTabChange === "function") await onTabChange();
      else if (typeof reloadRows === "function") await reloadRows();
    },
    openApprovedForApplication: async (proposalId, onTabChange) => {
      setMrpGovernanceTab("approved-for-application");
      if (proposalId != null) mrpApplication?.activateProposal(proposalId);
      if (typeof onTabChange === "function") await onTabChange();
      else if (typeof reloadRows === "function") await reloadRows();
    },
  });

  mrpAppliedHistory = createMrpAppliedHistoryHandlers({
    costingFrom,
    fetchAllRows,
    showToast,
    handleError,
    setLoadingMask,
    text,
    formatPercent,
    formatDate,
    formatDateTime,
    formatOptionalMoney,
    formatNumber,
    statusChip,
    cpCellPrimary,
    detailPanel,
    kvSection,
    reloadRows,
    getMrpGovernanceTab,
    setMrpGovernanceTab,
    renderNestedSubviewNav: (...args) => renderNestedSubviewNav(...args),
  });

  mrpApplication = createMrpApplicationHandlers({
    dom,
    costingFrom,
    costingRpc,
    fetchAllRows,
    showToast,
    handleError,
    setLoadingMask,
    text,
    formatDate,
    formatDateTime,
    formatOptionalMoney,
    statusChip,
    cpCellPrimary,
    detailPanel,
    kvSection,
    reloadRows,
    canEditPricingPolicyActions,
    getMrpGovernanceTab,
    setMrpGovernanceTab,
    renderNestedSubviewNav: (...args) => renderNestedSubviewNav(...args),
    invalidateMrpPolicyCache,
    onPolicyDataChanged,
    openAppliedHistory: async (proposalId, onTabChange) => {
      setMrpGovernanceTab("applied-proposal-history");
      if (proposalId != null) mrpAppliedHistory?.activateProposal(proposalId);
      if (typeof onTabChange === "function") await onTabChange();
      else if (typeof reloadRows === "function") await reloadRows();
    },
  });

  mrpProposals = createMrpProposalHandlers({
    dom,
    costingFrom,
    costingRpc,
    fetchAllRows,
    showToast,
    handleError,
    setLoadingMask,
    text,
    formatMoney,
    formatPercent,
    formatDate,
    formatDateTime,
    formatOptionalMoney,
    statusChip,
    cpCellPrimary,
    detailPanel,
    kvSection,
    numberOrNullFromInput,
    reloadRows,
    canEditPricingPolicyActions,
    formatTodayIsoIst,
    getMrpGovernanceTab,
    setMrpGovernanceTab,
    renderNestedSubviewNav: (...args) => renderNestedSubviewNav(...args),
    openProposalDecisions: async (proposalId, onTabChange) => {
      setMrpGovernanceTab("proposal-decisions");
      if (proposalId != null) mrpDecisions.activateProposal(proposalId);
      if (typeof onTabChange === "function") await onTabChange();
      else if (typeof reloadRows === "function") await reloadRows();
    },
  });

  let schemeOptions = [];
  let schemeRuleScopeOptions = [];
  let sellingPolicyEditRow = null;
  let sellingPolicyReturnFocus = null;
  let sellingPolicyInitial = null;
  let schemePolicyEditRow = null;
  let schemePolicyReturnFocus = null;
  let schemePolicyInitial = { region: null, schemeId: null };
  let schemeRuleEditReturnFocus = null;
  let schemeRuleCloseRow = null;
  let schemeRuleCloseReturnFocus = null;
  let mrpPolicyEditRow = null;
  let mrpPolicyReturnFocus = null;
  let mrpPolicyHasCurrent = false;
  let mrpPolicySaving = false;
  let mrpInputDriver = null;
  let mrpFieldSyncing = false;
  let schemeMasterMetadataRow = null;
  let schemeMasterDeactivateRow = null;
  let schemeMasterReactivateRow = null;
  let schemeMasterHistoryRow = null;
  let schemeMasterReturnFocus = null;
  let schemeMasterSaving = false;
  const currentMrpPolicyCache = new Map();

  const MRP_CURRENT_SELECT = `
    policy_id,
    sku_id,
    product_id,
    product_name,
    pack_size,
    pack_uom,
    sku_is_active,
    mrp_ik,
    mrp_ok,
    ok_pct,
    calc_mode,
    effective_from,
    effective_to,
    reason,
    approval_reference,
    source_type,
    source_quality,
    previous_policy_id,
    created_at,
    created_by
  `;

  const SKU_MRP_CURRENT_HEADERS = [
    "Product",
    "Pack",
    "IK MRP",
    "OK MRP",
    "OK uplift",
    "Calculation mode",
    "Effective from",
    "Source",
    "Quality",
  ];

  const SKU_MRP_CURRENT_ALIGNMENTS = [
    "c-left",
    "c-left",
    "c-right",
    "c-right",
    "c-right",
    "c-left",
    "c-left",
    "c-left",
    "c-left",
  ];

  const SKU_MRP_HISTORY_HEADERS = [
    "Product",
    "Pack",
    "IK MRP",
    "OK MRP",
    "Mode",
    "Lifecycle",
    "Effective period",
    "Source",
    "Policy ID",
    "Previous policy ID",
  ];

  const SKU_MRP_HISTORY_ALIGNMENTS = [
    "c-left",
    "c-left",
    "c-right",
    "c-right",
    "c-left",
    "c-left",
    "c-left",
    "c-left",
    "c-right",
    "c-right",
  ];

  const PRODUCT_DERIVATION_SELECT = `
    derivation_policy_id,
    product_id,
    product_name,
    product_status,
    product_base_uom,
    reference_sku_id,
    reference_sku_is_active,
    reference_sku_is_sample,
    reference_pack_size,
    reference_pack_uom,
    reference_selection_source,
    reference_mrp_policy_id,
    reference_mrp_ik,
    reference_mrp_ok,
    reference_ok_pct,
    smaller_pack_adjustment_pct,
    larger_pack_adjustment_pct,
    ceiling_increment,
    status,
    effective_from,
    effective_to,
    reason,
    approval_reference,
    source_type,
    source_quality,
    source_snapshot,
    previous_policy_id,
    created_at,
    created_by,
    confirmed_at,
    confirmed_by,
    closed_at,
    closed_by,
    cancelled_at,
    cancelled_by
  `;

  const PRODUCT_DERIVATION_READINESS_SELECT = `
    product_id,
    product_name,
    product_status,
    product_base_uom,
    readiness_status,
    blocker_code,
    reference_selection_source,
    source_type,
    source_quality,
    derivation_policy_status,
    current_derivation_policy_id,
    current_reference_sku_id,
    current_reference_pack_size,
    current_reference_pack_uom,
    current_reference_mrp_ik,
    current_reference_mrp_ok,
    current_reference_ok_pct,
    system_reference_sku_id,
    system_reference_pack_size,
    system_reference_pack_uom,
    active_non_sample_sku_count,
    priced_active_non_sample_sku_count,
    smaller_pack_adjustment_pct,
    larger_pack_adjustment_pct,
    ceiling_increment
  `;

  const PRODUCT_DERIVATION_CURRENT_HEADERS = [
    "Product",
    "Reference Pack",
    "Ref IK",
    "Ref OK",
    "OK uplift",
    "Effective from",
    "Status",
    "Source",
    "Quality",
    "Readiness",
  ];

  const PRODUCT_DERIVATION_CURRENT_ALIGNMENTS = [
    "c-left",
    "c-left",
    "c-right",
    "c-right",
    "c-right",
    "c-left",
    "c-left",
    "c-left",
    "c-left",
    "c-left",
  ];

  const PRODUCT_DERIVATION_HISTORY_HEADERS = [
    "Product",
    "Reference Pack",
    "Reference MRP",
    "Lifecycle",
    "Status",
    "Effective period",
    "Source",
    "Quality",
    "Policy ID",
    "Previous policy ID",
  ];

  const PRODUCT_DERIVATION_HISTORY_ALIGNMENTS = [
    "c-left",
    "c-left",
    "c-right",
    "c-left",
    "c-left",
    "c-left",
    "c-left",
    "c-left",
    "c-right",
    "c-right",
  ];

  function todayIsoIst() {
    return typeof formatTodayIsoIst === "function"
      ? formatTodayIsoIst()
      : activePeriodIso();
  }

  function classifyEffectiveDate(value) {
    const dateValue = String(value || "").slice(0, 10);
    const today = todayIsoIst();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || dateValue < today) {
      return "INVALID_PAST";
    }
    return dateValue === today ? "EFFECTIVE_TODAY" : "SCHEDULED_FUTURE";
  }

  function addDaysIsoIst(isoDate, days) {
    const [y, m, d] = String(isoDate || todayIsoIst())
      .split("-")
      .map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
  }

  function invalidateMrpPolicyCache(skuId) {
    if (skuId == null || skuId === "") return;
    currentMrpPolicyCache.delete(String(skuId));
  }

  async function fetchCurrentMrpPolicy(skuId, { force = false } = {}) {
    if (skuId == null || skuId === "") {
      return { data: null, error: null };
    }

    const cacheKey = String(skuId);
    if (!force && currentMrpPolicyCache.has(cacheKey)) {
      return { data: currentMrpPolicyCache.get(cacheKey), error: null };
    }

    const { data, error } = await costingFrom("v_sku_mrp_current")
      .select(MRP_CURRENT_SELECT)
      .eq("sku_id", skuId)
      .maybeSingle();

    if (error) {
      return { data: null, error };
    }

    const normalized = data?.sku_id ? data : null;
    currentMrpPolicyCache.set(cacheKey, normalized);
    return { data: normalized, error: null };
  }

  async function fetchMrpPolicyHistory(row) {
    if (!row?.sku_id) return [];

    const { data, error } = await costingFrom("v_sku_mrp_policy_history")
      .select("*")
      .eq("sku_id", row.sku_id)
      .order("effective_from", { ascending: false })
      .order("policy_id", { ascending: false })
      .limit(200);

    if (error) throw error;
    return data || [];
  }

  function isSkuMrpPoliciesTabActive() {
    return getMrpGovernanceTab() === "sku-mrp-policies";
  }

  function getSkuMrpPolicyView() {
    return skuMrpPolicyView;
  }

  function setSkuMrpPolicyView(view) {
    skuMrpPolicyView = view === "history" ? "history" : "current";
  }

  function formatMrpSourceTypeLabel(sourceType) {
    const raw = String(sourceType || "").trim().toUpperCase();
    if (raw === "LEGACY_BASELINE") return "Legacy baseline";
    if (raw === "MANUAL_ENTRY") return "Manual revision";
    if (raw === "PROPOSAL_APPLICATION") return "Proposal application";
    if (!raw) return "--";
    return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function formatMrpSourceQualityShort(sourceQuality) {
    const raw = String(sourceQuality || "").trim().toUpperCase();
    if (raw === "LEGACY_UNVERIFIED_BASELINE" || raw === "LEGACY_BASELINE") {
      return "Legacy baseline — review status unverified";
    }
    if (raw === "GOVERNED") return "Governed";
    if (!raw) return "--";
    return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function formatMrpLifecycleLabel(lifecycle) {
    const raw = String(lifecycle || "").trim().toUpperCase();
    if (!raw) return "--";
    if (raw === "CURRENT" || raw === "SCHEDULED" || raw === "SUPERSEDED") {
      return raw;
    }
    return raw.replace(/_/g, " ");
  }

  function formatMrpPackLabel(row) {
    return [row.pack_size, row.pack_uom].filter(Boolean).join(" ") || "--";
  }

  function formatMrpEffectivePeriod(row) {
    const from = formatDate(row.effective_from);
    const to = row.effective_to ? formatDate(row.effective_to) : "Open";
    return `${from} → ${to}`;
  }

  function compareNullableNumber(a, b) {
    const an = Number(a);
    const bn = Number(b);
    const aOk = Number.isFinite(an);
    const bOk = Number.isFinite(bn);
    if (!aOk && !bOk) return 0;
    if (!aOk) return 1;
    if (!bOk) return -1;
    return an - bn;
  }

  function sortSkuMrpRows(rows) {
    const sorted = [...(rows || [])];
    if (skuMrpPolicyView === "history") {
      sorted.sort((a, b) => {
        const nameCmp = String(a.product_name || "").localeCompare(
          String(b.product_name || ""),
          undefined,
          { sensitivity: "base" },
        );
        if (nameCmp) return nameCmp;
        const skuCmp = compareNullableNumber(a.sku_id, b.sku_id);
        if (skuCmp) return skuCmp;
        const fromCmp = String(b.effective_from || "").localeCompare(
          String(a.effective_from || ""),
        );
        if (fromCmp) return fromCmp;
        return compareNullableNumber(b.policy_id, a.policy_id);
      });
      return sorted;
    }

    sorted.sort((a, b) => {
      const nameCmp = String(a.product_name || "").localeCompare(
        String(b.product_name || ""),
        undefined,
        { sensitivity: "base" },
      );
      if (nameCmp) return nameCmp;
      const packCmp = compareNullableNumber(a.pack_size, b.pack_size);
      if (packCmp) return packCmp;
      return compareNullableNumber(a.sku_id, b.sku_id);
    });
    return sorted;
  }

  function matchesSkuMrpFilters(row) {
    if (skuMrpFilters.calcMode.length) {
      const mode = normalizeMrpCalcMode(row.calc_mode);
      if (!skuMrpFilters.calcMode.includes(mode)) return false;
    }
    if (skuMrpFilters.sourceType.length) {
      const source = String(row.source_type || "").trim().toUpperCase();
      if (!skuMrpFilters.sourceType.includes(source)) return false;
    }
    if (skuMrpFilters.sourceQuality.length) {
      const quality = String(row.source_quality || "").trim().toUpperCase();
      if (!skuMrpFilters.sourceQuality.includes(quality)) return false;
    }
    if (skuMrpPolicyView === "history" && skuMrpFilters.lifecycle.length) {
      const life = String(row.lifecycle_label || "").trim().toUpperCase();
      if (!skuMrpFilters.lifecycle.includes(life)) return false;
    }
    if (skuMrpPolicyView === "current" && skuMrpFilters.skuState.length) {
      const active = row.sku_is_active !== false;
      const wanted = [];
      if (skuMrpFilters.skuState.includes("active") && active) wanted.push(true);
      if (skuMrpFilters.skuState.includes("inactive") && !active) wanted.push(true);
      if (!wanted.length) return false;
    }
    return true;
  }

  function getSkuMrpFilteredRows() {
    return sortSkuMrpRows(skuMrpRawRows.filter(matchesSkuMrpFilters));
  }

  async function loadSkuMrpPolicyRows() {
    if (skuMrpPolicyView === "history") {
      skuMrpRawRows = await fetchAllRows(
        () =>
          costingFrom("v_sku_mrp_policy_history")
            .select("*")
            .order("product_name", { ascending: true })
            .order("sku_id", { ascending: true })
            .order("effective_from", { ascending: false })
            .order("policy_id", { ascending: false }),
        1000,
      );
    } else {
      skuMrpRawRows = await fetchAllRows(
        () =>
          costingFrom("v_sku_mrp_current")
            .select(MRP_CURRENT_SELECT)
            .order("product_name", { ascending: true })
            .order("pack_size", { ascending: true })
            .order("sku_id", { ascending: true }),
        1000,
      );
    }
    return getSkuMrpFilteredRows();
  }

  function toggleSkuMrpFilter(group, value, checked) {
    if (!skuMrpFilters[group]) return getSkuMrpFilteredRows();
    const normalized = String(value || "").trim();
    if (!normalized) return getSkuMrpFilteredRows();
    const set = new Set(skuMrpFilters[group]);
    if (checked) set.add(normalized);
    else set.delete(normalized);
    skuMrpFilters[group] = [...set];
    return getSkuMrpFilteredRows();
  }

  function clearSkuMrpFilters() {
    skuMrpFilters = {
      calcMode: [],
      sourceType: [],
      sourceQuality: [],
      lifecycle: [],
      skuState: [],
    };
    return getSkuMrpFilteredRows();
  }

  function getSkuMrpApplicableFilterKeys() {
    const keys = ["calcMode", "sourceType", "sourceQuality"];
    if (skuMrpPolicyView === "history") keys.push("lifecycle");
    else keys.push("skuState");
    return keys;
  }

  function formatSkuMrpFilterValueLabel(group, value) {
    const raw = String(value || "").trim();
    if (group === "calcMode") {
      if (raw === "AUTO") return "Automatic";
      if (raw === "MANUAL") return "Manual";
    }
    if (group === "sourceType") return formatMrpSourceTypeLabel(raw);
    if (group === "sourceQuality") {
      if (raw === "LEGACY_UNVERIFIED_BASELINE") return "Legacy unverified";
      if (raw === "GOVERNED") return "Governed";
      return formatMrpSourceQualityShort(raw);
    }
    if (group === "lifecycle") return humanizeMrpToken(raw);
    if (group === "skuState") {
      if (raw === "active") return "Active";
      if (raw === "inactive") return "Inactive";
    }
    return humanizeMrpToken(raw) || raw;
  }

  function formatSkuMrpFilterFieldLabel(group) {
    if (group === "calcMode") return "Mode";
    if (group === "sourceType") return "Source";
    if (group === "sourceQuality") return "Quality";
    if (group === "lifecycle") return "Lifecycle";
    if (group === "skuState") return "SKU state";
    return humanizeMrpToken(group);
  }

  function buildSkuMrpActiveFilterChips() {
    const chips = [];
    for (const group of getSkuMrpApplicableFilterKeys()) {
      const values = skuMrpFilters[group] || [];
      for (const value of values) {
        const field = formatSkuMrpFilterFieldLabel(group);
        const valueLabel = formatSkuMrpFilterValueLabel(group, value);
        const label = `${field}: ${valueLabel}`;
        chips.push(
          renderMrpActiveFilterChip({
            label,
            groupAttr: "data-sku-mrp-filter-chip-group",
            group,
            valueAttr: "data-sku-mrp-filter-chip-value",
            value,
            ariaLabel: `Remove ${label} filter`,
          }),
        );
      }
    }
    return chips.join("");
  }

  function renderSkuMrpFilterCheckbox(group, value, label) {
    const checked = skuMrpFilters[group]?.includes(value) ? "checked" : "";
    return `<label class="cp-mrp-filter-item"><input type="checkbox" data-sku-mrp-filter-group="${group}" value="${String(value).replace(/"/g, "&quot;")}" ${checked}/> ${text(label)}</label>`;
  }

  function renderSkuMrpFilterPanel() {
    const lifecycleBlock =
      skuMrpPolicyView === "history"
        ? `<div class="cp-mrp-filter-group">
            <div class="cp-mrp-filter-title">Lifecycle</div>
            <div class="cp-mrp-filter-options">
              ${renderSkuMrpFilterCheckbox("lifecycle", "CURRENT", "CURRENT")}
              ${renderSkuMrpFilterCheckbox("lifecycle", "SCHEDULED", "SCHEDULED")}
              ${renderSkuMrpFilterCheckbox("lifecycle", "SUPERSEDED", "SUPERSEDED")}
            </div>
          </div>`
        : `<div class="cp-mrp-filter-group">
            <div class="cp-mrp-filter-title">SKU state</div>
            <div class="cp-mrp-filter-options">
              ${renderSkuMrpFilterCheckbox("skuState", "active", "Active")}
              ${renderSkuMrpFilterCheckbox("skuState", "inactive", "Inactive")}
            </div>
          </div>`;

    const bodyHtml = `
      <div class="cp-mrp-filter-panel" id="skuMrpFilterPanel">
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Calculation mode</div>
          <div class="cp-mrp-filter-options">
            ${renderSkuMrpFilterCheckbox("calcMode", "AUTO", "Automatic")}
            ${renderSkuMrpFilterCheckbox("calcMode", "MANUAL", "Manual")}
          </div>
        </div>
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Source type</div>
          <div class="cp-mrp-filter-options">
            ${renderSkuMrpFilterCheckbox("sourceType", "LEGACY_BASELINE", "Legacy baseline")}
            ${renderSkuMrpFilterCheckbox("sourceType", "MANUAL_ENTRY", "Manual revision")}
            ${renderSkuMrpFilterCheckbox("sourceType", "PROPOSAL_APPLICATION", "Proposal application")}
          </div>
        </div>
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Source quality</div>
          <div class="cp-mrp-filter-options">
            ${renderSkuMrpFilterCheckbox("sourceQuality", "LEGACY_UNVERIFIED_BASELINE", "Legacy unverified")}
            ${renderSkuMrpFilterCheckbox("sourceQuality", "GOVERNED", "Governed")}
          </div>
        </div>
        ${lifecycleBlock}
      </div>`;

    const activeCount = countActiveMrpFilterFields(
      skuMrpFilters,
      getSkuMrpApplicableFilterKeys(),
    );

    return renderMrpFilterDrawerPanel({
      activeCount,
      bodyHtml,
      clearAllAttr: "data-sku-mrp-filter-clear",
      clearAllLabel: "Clear all",
    });
  }

  function renderSkuMrpDrawerReviseAction(row) {
    if (skuMrpPolicyView !== "current") return "";
    if (!canEditPolicyActions()) return "";
    if (row.sku_is_active === false) return "";
    return `<div class="cp-drawer-action-bar">
      <button
        type="button"
        class="icon-btn icon-btn-primary"
        id="skuMrpDrawerReviseBtn"
        title="Revise MRP"
        aria-label="Revise MRP"
      >
        Revise MRP
      </button>
    </div>`;
  }

  function renderSkuMrpScheduledCancellationAction(row) {
    if (skuMrpPolicyView !== "history" || !isScheduledSkuMrpPolicy(row)) return "";
    return `<div class="cp-drawer-action-bar">
      <button
        type="button"
        class="icon-btn cp-danger-text-btn"
        id="skuMrpDrawerCancelScheduledBtn"
        title="Cancel Scheduled Policy"
        aria-label="Cancel Scheduled Policy"
      >
        Cancel Scheduled Policy
      </button>
    </div>`;
  }

  function renderSkuMrpCurrentRow(row, trAttrs) {
    return `<tr ${trAttrs}>
      <td>${cpCellPrimary(row.product_name)}<div class="cp-muted-text">SKU ${text(row.sku_id)}</div></td>
      <td>${text(formatMrpPackLabel(row))}${row.sku_is_active === false ? `<div class="cp-muted-text">Inactive</div>` : ""}</td>
      <td class="c-right">${formatOptionalMoney(row.mrp_ik)}</td>
      <td class="c-right">${formatOptionalMoney(row.mrp_ok)}</td>
      <td class="c-right">${formatOkPctFromDecimal(row.ok_pct)}</td>
      <td>${text(normalizeMrpCalcMode(row.calc_mode))}</td>
      <td>${formatDate(row.effective_from)}</td>
      <td>${text(formatMrpSourceTypeLabel(row.source_type))}</td>
      <td>${text(formatMrpSourceQualityShort(row.source_quality))}</td>
    </tr>`;
  }

  function renderSkuMrpHistoryRow(row, trAttrs) {
    return `<tr ${trAttrs}>
      <td>${cpCellPrimary(row.product_name)}<div class="cp-muted-text">SKU ${text(row.sku_id)}</div></td>
      <td>${text(formatMrpPackLabel(row))}</td>
      <td class="c-right">${formatOptionalMoney(row.mrp_ik)}</td>
      <td class="c-right">${formatOptionalMoney(row.mrp_ok)}</td>
      <td>${text(normalizeMrpCalcMode(row.calc_mode))}</td>
      <td>${statusChip(formatMrpLifecycleLabel(row.lifecycle_label))}</td>
      <td>${text(formatMrpEffectivePeriod(row))}</td>
      <td>${text(formatMrpSourceTypeLabel(row.source_type))}<div class="cp-muted-text">${text(formatMrpSourceQualityShort(row.source_quality))}</div></td>
      <td class="c-right">${text(row.policy_id)}</td>
      <td class="c-right">${text(row.previous_policy_id || "--")}</td>
    </tr>`;
  }

  function summarizeMrpSourceSnapshot(snapshot, sourceType) {
    const type = String(sourceType || "").trim().toUpperCase();
    if (type === "PROPOSAL_APPLICATION") {
      return {
        summary: "Applied through Product MRP Proposal",
        technical: null,
      };
    }
    if (snapshot == null || snapshot === "") {
      return { summary: "--", technical: null };
    }
    let parsed = snapshot;
    if (typeof snapshot === "string") {
      try {
        parsed = JSON.parse(snapshot);
      } catch {
        return {
          summary: "Technical evidence available",
          technical: String(snapshot).slice(0, 400),
        };
      }
    }
    if (!parsed || typeof parsed !== "object") {
      return { summary: "Technical evidence available", technical: String(parsed) };
    }
    const keys = Object.keys(parsed);
    if (!keys.length) return { summary: "--", technical: null };
    const interesting = [
      "proposal_id",
      "proposal_line_id",
      "application_id",
      "applied_at",
      "reference_pack_sku_id",
    ]
      .filter((k) => parsed[k] != null && parsed[k] !== "")
      .map((k) => `${k}: ${parsed[k]}`)
      .slice(0, 4);
    return {
      summary: interesting.length
        ? interesting.join(" · ")
        : `Evidence fields: ${keys.slice(0, 6).join(", ")}`,
      technical: JSON.stringify(parsed),
    };
  }

  function getSkuMrpDrawerConfig(row, preferredTab) {
    const pack = formatMrpPackLabel(row);
    return {
      title: row.product_name || `SKU ${row.sku_id}` || "SKU MRP Policy",
      subtitle: [pack, row.sku_id != null ? `SKU ${row.sku_id}` : ""]
        .filter(Boolean)
        .join(" · "),
      tabs: [
        { id: "policy-detail", label: "Policy Detail" },
        { id: "provenance", label: "Provenance" },
      ],
      activeTab: preferredTab || "policy-detail",
    };
  }

  function renderSkuMrpDrawerTab(tabId, row) {
    const pack = formatMrpPackLabel(row);
    const cancellationEvidence = formatCancellationEvidence(row);
    if (tabId === "provenance") {
      const snap = summarizeMrpSourceSnapshot(
        row.source_snapshot,
        row.source_type,
      );
      return detailPanel([
        kvSection("Governance", [
          ["Reason", text(row.reason)],
          ["Approval reference", text(row.approval_reference)],
          ["Source type", text(formatMrpSourceTypeLabel(row.source_type))],
          [
            "Source quality",
            text(formatMrpSourceQualityShort(row.source_quality)),
          ],
          ["Previous policy ID", text(row.previous_policy_id || "--")],
        ]),
        kvSection("Provenance summary", [
          ["Summary", text(snap.summary)],
        ]),
        snap.technical
          ? kvSection("Technical evidence", [
              ["source_snapshot", `<pre class="cp-mrp-snapshot-pre">${text(snap.technical)}</pre>`],
            ])
          : "",
      ]);
    }

    const lifecycleRows =
      skuMrpPolicyView === "history" || row.lifecycle_label
        ? [["Lifecycle", statusChip(formatMrpLifecycleLabel(row.lifecycle_label))]]
        : [];

    return (
      renderSkuMrpDrawerReviseAction(row) +
      renderSkuMrpScheduledCancellationAction(row) +
      detailPanel([
        kvSection("Identity", [
          ["Policy ID", text(row.policy_id)],
          ["SKU ID", text(row.sku_id)],
          ["Product", text(row.product_name)],
          ["Pack", text(pack)],
          [
            "SKU active state",
            text(row.sku_is_active === false ? "Inactive" : "Active"),
          ],
        ]),
        kvSection("MRP", [
          ["IK MRP", formatOptionalMoney(row.mrp_ik)],
          ["OK MRP", formatOptionalMoney(row.mrp_ok)],
          ["OK uplift", formatOkPctFromDecimal(row.ok_pct)],
          ["Calculation mode", text(normalizeMrpCalcMode(row.calc_mode))],
        ]),
        kvSection("Lifecycle", [
          ...lifecycleRows,
          ["Effective from", formatDate(row.effective_from)],
          ["Effective to", formatDate(row.effective_to)],
          ["Created at", formatDateTime(row.created_at)],
          ["Created by", text(row.created_by)],
          ["Closed at", formatDateTime(row.closed_at)],
          ["Closed by", text(row.closed_by)],
        ]),
        cancellationEvidence.length
          ? kvSection("Cancellation", cancellationEvidence)
          : "",
      ])
    );
  }

  function wireSkuMrpTableActions(_tableBody, _getViewRow) {
    // Revise MRP lives in the Policy Detail drawer (see wireSkuMrpDrawerActions).
  }

  function wireSkuMrpDrawerActions(tabId, row) {
    if (tabId !== "policy-detail" || !row) return;
    document.getElementById("skuMrpDrawerReviseBtn")?.addEventListener(
      "click",
      () => openMrpPolicyEditModal(row),
    );
    document
      .getElementById("skuMrpDrawerCancelScheduledBtn")
      ?.addEventListener("click", () => {
        openScheduledPolicyCancellationModal({
          type: "SKU_MRP",
          id: Number(row.policy_id),
          row,
        });
      });
  }

  function uiPctFromDecimal(ratio) {
    if (ratio === null || ratio === undefined || ratio === "") return null;
    const n = Number(ratio);
    if (!Number.isFinite(n)) return null;
    return n * 100;
  }

  function decimalFromUiPct(uiPct) {
    if (uiPct === null || uiPct === undefined || uiPct === "") return null;
    const n = Number(uiPct);
    if (!Number.isFinite(n)) return null;
    return n / 100;
  }

  function formatOkPctFromDecimal(ratio) {
    const ui = uiPctFromDecimal(ratio);
    if (ui === null) return "--";
    return formatPercent(ui);
  }

  function formatSignedRatioPercent(value) {
    const pct = uiPctFromDecimal(value);
    if (pct === null) return "--";
    const formatted = Math.abs(pct).toLocaleString("en-IN", {
      maximumFractionDigits: 4,
    });
    if (pct > 0) return `+${formatted}%`;
    if (pct < 0) return `-${formatted}%`;
    return "0%";
  }

  function renderPolicySummaryItems(items) {
    return items
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(
        ([label, value]) => `
          <div class="cp-policy-summary-item">
            <div class="cp-card-label">${text(label)}</div>
            <div class="cp-card-value">${text(value)}</div>
          </div>`,
      )
      .join("");
  }

  function setPolicyDateStateUi({
    value,
    chip,
    warning,
    error,
    onState,
  }) {
    const hasValue = /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
    const state = hasValue ? classifyEffectiveDate(value) : "INVALID_PAST";
    if (chip) {
      chip.className = "status-chip gray";
      chip.textContent = "--";
      if (hasValue && state === "EFFECTIVE_TODAY") {
        chip.className = "status-chip green";
        chip.textContent = "Effective Today";
      } else if (hasValue && state === "SCHEDULED_FUTURE") {
        chip.className = "status-chip amber";
        chip.textContent = "Scheduled Policy";
      } else if (hasValue) {
        chip.className = "status-chip red";
        chip.textContent = "Invalid Past Date";
      }
    }
    if (warning) {
      const showWarning = hasValue && state === "SCHEDULED_FUTURE";
      warning.hidden = !showWarning;
      warning.textContent = showWarning
        ? `This policy will not become current today. It is scheduled to take effect on ${formatDate(value)}.\n\nThe presently effective policy will remain current until the day before the scheduled date.`
        : "";
    }
    if (error) {
      const showError = hasValue && state === "INVALID_PAST";
      error.hidden = !showError;
      error.textContent = showError
        ? "Effective-from date cannot be before the current India business date."
        : "";
    }
    onState?.(state);
    return state;
  }

  function syncMrpEffectiveDateState() {
    return setPolicyDateStateUi({
      value: dom.mrpPolicyEditEffectiveFrom?.value,
      chip: dom.mrpPolicyEffectiveDateChip,
      warning: dom.mrpPolicyEffectiveDateWarning,
      error: dom.mrpPolicyEffectiveDateError,
      onState: (state) => {
        if (!dom.mrpPolicyEditSaveBtn) return;
        const scheduled = state === "SCHEDULED_FUTURE";
        const label = scheduled ? "Review Scheduled Policy" : "Save Policy";
        dom.mrpPolicyEditSaveBtn.textContent = label;
        dom.mrpPolicyEditSaveBtn.title = label;
        dom.mrpPolicyEditSaveBtn.setAttribute("aria-label", label);
      },
    });
  }

  function syncDerivationEffectiveDateState() {
    return setPolicyDateStateUi({
      value: dom.derivationPolicyEditEffectiveFrom?.value,
      chip: dom.derivationPolicyEffectiveDateChip,
      warning: dom.derivationPolicyEffectiveDateWarning,
      error: dom.derivationPolicyEffectiveDateError,
      onState: (state) => {
        const scheduled = state === "SCHEDULED_FUTURE";
        if (dom.derivationPolicyEditDraftBtn) {
          const draftLabel = scheduled
            ? "Review Scheduled Draft"
            : "Save as Draft";
          dom.derivationPolicyEditDraftBtn.textContent = draftLabel;
          dom.derivationPolicyEditDraftBtn.title = draftLabel;
          dom.derivationPolicyEditDraftBtn.setAttribute("aria-label", draftLabel);
        }
        if (dom.derivationPolicyEditConfirmBtn) {
          const confirmLabel = scheduled
            ? "Review Scheduled Policy"
            : "Confirm Policy";
          dom.derivationPolicyEditConfirmBtn.textContent = confirmLabel;
          dom.derivationPolicyEditConfirmBtn.title = confirmLabel;
          dom.derivationPolicyEditConfirmBtn.setAttribute(
            "aria-label",
            confirmLabel,
          );
        }
      },
    });
  }

  function isValidPolicyId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0;
  }

  function isScheduledSkuMrpPolicy(row) {
    return (
      canEditPolicyActions() &&
      isValidPolicyId(row?.policy_id) &&
      String(row?.status || "").trim().toUpperCase() === "APPROVED" &&
      String(row?.effective_from || "").slice(0, 10) > todayIsoIst()
    );
  }

  function isScheduledDerivationPolicy(row) {
    return (
      canEditPolicyActions() &&
      isValidPolicyId(row?.derivation_policy_id) &&
      String(row?.status || "").trim().toUpperCase() === "CONFIRMED" &&
      String(row?.effective_from || "").slice(0, 10) > todayIsoIst()
    );
  }

  function formatCancellationEvidence(row) {
    if (String(row?.status || "").trim().toUpperCase() !== "CANCELLED") {
      return [];
    }
    const evidence = [["Status", statusChip("Cancelled")]];
    if (row.cancelled_at) {
      evidence.push(["Cancelled at", formatDateTime(row.cancelled_at)]);
    }
    if (row.cancelled_by) {
      evidence.push(["Cancelled by", text(row.cancelled_by)]);
    }
    if (row.cancellation_reason) {
      evidence.push(["Cancellation reason", text(row.cancellation_reason)]);
    }
    if (row.cancellation_approval_reference) {
      evidence.push([
        "Cancellation approval reference",
        text(row.cancellation_approval_reference),
      ]);
    }
    return evidence;
  }

  function roundDerivedMrpOk(rawValue) {
    if (!Number.isFinite(rawValue)) return null;
    if (rawValue < 5) return rawValue;
    return Math.ceil(rawValue / 5) * 5;
  }

  function deriveExactOkPctDecimal(mrpIk, mrpOk) {
    const ik = Number(mrpIk);
    const ok = Number(mrpOk);
    if (!Number.isFinite(ik) || ik <= 0 || !Number.isFinite(ok)) return null;
    return ok / ik - 1;
  }

  function setMrpPolicyModalError(message) {
    if (!dom.mrpPolicyEditError) return;
    dom.mrpPolicyEditError.hidden = !message;
    dom.mrpPolicyEditError.textContent = message || "";
  }

  function readOkPctUiInput() {
    const raw = String(dom.mrpPolicyEditOkPct?.value ?? "").trim();
    if (raw === "") {
      return { isBlank: true, uiPct: null, invalid: false };
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      return { isBlank: false, uiPct: null, invalid: true };
    }
    return { isBlank: false, uiPct: n, invalid: false };
  }

  function normalizeMrpCalcMode(value) {
    const mode = String(value || "")
      .trim()
      .toUpperCase();
    return mode === "MANUAL" ? "MANUAL" : "AUTO";
  }

  function getSelectedMrpCalcMode() {
    return normalizeMrpCalcMode(dom.mrpPolicyEditCalcMode?.value);
  }

  function syncMrpCalcModeFieldVisibility() {
    const mode = getSelectedMrpCalcMode();
    const okWrap =
      document.getElementById("mrpPolicyEditMrpOkWrap") ||
      dom.mrpPolicyEditMrpOk?.closest("label");
    const pctWrap =
      document.getElementById("mrpPolicyEditOkPctWrap") ||
      dom.mrpPolicyEditOkPct?.closest("label");
    const hint = document.getElementById("mrpPolicyEditModeHint");

    if (okWrap) okWrap.hidden = mode === "AUTO";
    if (pctWrap) pctWrap.hidden = mode === "MANUAL";

    if (dom.mrpPolicyEditMrpOk) {
      dom.mrpPolicyEditMrpOk.disabled = mode === "AUTO";
      dom.mrpPolicyEditMrpOk.readOnly = mode === "AUTO";
    }
    if (dom.mrpPolicyEditOkPct) {
      dom.mrpPolicyEditOkPct.disabled = mode === "MANUAL";
      dom.mrpPolicyEditOkPct.readOnly = mode === "MANUAL";
    }

    if (hint) {
      hint.textContent =
        mode === "MANUAL"
          ? "Manual IK and OK values — OK uplift is derived for preview only."
          : "Automatic OK calculation uses IK MRP and OK uplift.";
    }

    if (mode === "AUTO") {
      mrpInputDriver = "OK_PCT";
    } else {
      mrpInputDriver = "OK_MRP";
    }
  }

  function resolveMrpRpcPayload(values) {
    if (values.calcMode === "MANUAL") {
      return {
        p_mrp_ok: values.mrpOk,
        p_ok_pct: null,
      };
    }
    if (values.driver === "OK_PCT") {
      return {
        p_mrp_ok: null,
        p_ok_pct: values.okPctUi / 100,
      };
    }
    return {
      p_mrp_ok: values.mrpOk,
      p_ok_pct: null,
    };
  }

  function readMrpPolicyFormValues() {
    const okPctInput = readOkPctUiInput();
    const calcMode = getSelectedMrpCalcMode();
    return {
      calcMode,
      driver: calcMode === "MANUAL" ? "OK_MRP" : mrpInputDriver || "OK_PCT",
      mrpIk: numberOrNullFromInput(dom.mrpPolicyEditMrpIk),
      mrpOk: numberOrNullFromInput(dom.mrpPolicyEditMrpOk),
      okPctUi: okPctInput.isBlank ? null : okPctInput.uiPct,
      okPctUiBlank: okPctInput.isBlank,
      okPctUiInvalid: okPctInput.invalid,
      effectiveFrom: dom.mrpPolicyEditEffectiveFrom?.value || "",
      reason: dom.mrpPolicyEditReason?.value?.trim() || "",
      approvalReference:
        dom.mrpPolicyEditApprovalReference?.value?.trim() || null,
    };
  }

  function computeMrpPreview(values = readMrpPolicyFormValues()) {
    const mrpIk = values.mrpIk;
    const calcMode = normalizeMrpCalcMode(values.calcMode);

    if (!Number.isFinite(mrpIk) || mrpIk <= 0) {
      return { valid: false, message: "Enter a valid MRP IK to preview." };
    }

    if (calcMode === "MANUAL") {
      const enteredOk = values.mrpOk;
      if (!Number.isFinite(enteredOk) || enteredOk <= 0) {
        return {
          valid: false,
          message: "Enter MRP OK greater than zero.",
        };
      }
      const exactPct = deriveExactOkPctDecimal(mrpIk, enteredOk);
      return {
        valid: true,
        calcMode: "MANUAL",
        driver: "OK_MRP",
        controllingInput: "Manual IK and OK values",
        mrpIk,
        mrpOk: enteredOk,
        okPctUi: uiPctFromDecimal(exactPct),
        okPctDecimal: exactPct,
        effectiveFrom: values.effectiveFrom,
        notes: ["OK uplift is derived for preview only; the server remains authoritative."],
      };
    }

    if (values.okPctUiInvalid) {
      return { valid: false, message: "Enter a valid OK uplift %." };
    }

    if (values.okPctUiBlank) {
      return {
        valid: false,
        message: "Enter an OK uplift %.",
      };
    }
    const okPctDecimal = decimalFromUiPct(values.okPctUi);
    if (okPctDecimal === null || okPctDecimal < 0) {
      return {
        valid: false,
        message: "OK uplift % must be zero or greater.",
      };
    }
    const raw = mrpIk * (1 + okPctDecimal);
    const previewOk = roundDerivedMrpOk(raw);
    const exactPct = deriveExactOkPctDecimal(mrpIk, previewOk);
    return {
      valid: true,
      calcMode: "AUTO",
      driver: "OK_PCT",
      controllingInput: "Automatic OK calculation",
      mrpIk,
      mrpOk: previewOk,
      okPctUi: uiPctFromDecimal(exactPct),
      okPctDecimal: exactPct,
      effectiveFrom: values.effectiveFrom,
      notes: ["Derived MRP OK is rounded upward to the next ₹5 when ≥ ₹5."],
    };
  }

  function renderMrpPreviewHtml(preview) {
    if (!preview?.valid) {
      return `<div class="cp-muted-text">${text(preview?.message || "Enter values to see a preview.")}</div>`;
    }

    const notes = (preview.notes || [])
      .map((note) => `<div class="cp-muted-text">${text(note)}</div>`)
      .join("");

    return `
      <div class="cp-preview-row"><span>MRP IK</span><span class="cp-preview-value">${formatMoney(preview.mrpIk)}</span></div>
      <div class="cp-preview-row"><span>MRP OK</span><span class="cp-preview-value">${formatMoney(preview.mrpOk)}</span></div>
      <div class="cp-preview-row"><span>OK Uplift %</span><span class="cp-preview-value">${formatPercent(preview.okPctUi)}</span></div>
      <div class="cp-preview-row"><span>Effective From</span><span class="cp-preview-value">${formatDate(preview.effectiveFrom)}</span></div>
      <div class="cp-preview-row"><span>Controlling Input</span><span class="cp-preview-value">${text(preview.controllingInput || "--")}</span></div>
      ${notes}
    `;
  }

  function setMrpFieldValue(input, value) {
    if (!input) return;
    mrpFieldSyncing = true;
    input.value = value;
    mrpFieldSyncing = false;
  }

  function recalcMrpDependentField() {
    const mrpIk = numberOrNullFromInput(dom.mrpPolicyEditMrpIk);
    const hasIk = Number.isFinite(mrpIk) && mrpIk > 0;

    if (mrpInputDriver === "OK_MRP") {
      const mrpOk = numberOrNullFromInput(dom.mrpPolicyEditMrpOk);
      if (hasIk && Number.isFinite(mrpOk) && mrpOk > 0) {
        const exactPct = deriveExactOkPctDecimal(mrpIk, mrpOk);
        const uiPct = uiPctFromDecimal(exactPct);
        setMrpFieldValue(
          dom.mrpPolicyEditOkPct,
          uiPct === null ? "" : roundTo(uiPct, 4),
        );
      } else {
        setMrpFieldValue(dom.mrpPolicyEditOkPct, "");
      }
      return;
    }

    if (mrpInputDriver === "OK_PCT") {
      const okPctInput = readOkPctUiInput();
      const okPctDecimal = okPctInput.isBlank
        ? null
        : decimalFromUiPct(okPctInput.uiPct);
      if (
        hasIk &&
        !okPctInput.isBlank &&
        !okPctInput.invalid &&
        okPctDecimal !== null &&
        okPctDecimal >= 0
      ) {
        const previewOk = roundDerivedMrpOk(mrpIk * (1 + okPctDecimal));
        setMrpFieldValue(
          dom.mrpPolicyEditMrpOk,
          previewOk === null ? "" : previewOk,
        );
      } else {
        setMrpFieldValue(dom.mrpPolicyEditMrpOk, "");
      }
    }
  }

  function roundTo(value, decimals) {
    if (!Number.isFinite(value)) return value;
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  function updateMrpPolicyPreview() {
    if (!dom.mrpPolicyEditPreview) return;
    syncMrpCalcModeFieldVisibility();
    if (getSelectedMrpCalcMode() === "AUTO") {
      recalcMrpDependentField();
    } else {
      // Keep OK as entered; derive uplift preview into the hidden OK % field.
      const mrpIk = numberOrNullFromInput(dom.mrpPolicyEditMrpIk);
      const mrpOk = numberOrNullFromInput(dom.mrpPolicyEditMrpOk);
      if (
        Number.isFinite(mrpIk) &&
        mrpIk > 0 &&
        Number.isFinite(mrpOk) &&
        mrpOk > 0
      ) {
        const exactPct = deriveExactOkPctDecimal(mrpIk, mrpOk);
        const uiPct = uiPctFromDecimal(exactPct);
        setMrpFieldValue(
          dom.mrpPolicyEditOkPct,
          uiPct === null ? "" : roundTo(uiPct, 4),
        );
      }
    }
    const preview = computeMrpPreview();
    dom.mrpPolicyEditPreview.innerHTML = `
      <div class="cp-card-label">Preview (advisory)</div>
      ${renderMrpPreviewHtml(preview)}
    `;
    setMrpPolicySaveState();
  }

  function validateMrpPolicyForm(values = readMrpPolicyFormValues()) {
    const preview = computeMrpPreview(values);
    if (!preview.valid) {
      return { ok: false, message: preview.message || "Preview is invalid." };
    }
    if (!values.effectiveFrom) {
      return { ok: false, message: "Effective-from date is required." };
    }
    if (classifyEffectiveDate(values.effectiveFrom) === "INVALID_PAST") {
      return {
        ok: false,
        message:
          "Effective-from date cannot be before the current India business date.",
      };
    }
    if (!values.reason) {
      return { ok: false, message: "Reason for revision is required." };
    }
    return { ok: true, preview, values };
  }

  function setMrpPolicySaveState() {
    if (!dom.mrpPolicyEditSaveBtn) return;
    syncMrpEffectiveDateState();

    if (!canEditPolicyActions() || mrpPolicySaving) {
      dom.mrpPolicyEditSaveBtn.disabled = true;
      return;
    }

    const validation = validateMrpPolicyForm();
    dom.mrpPolicyEditSaveBtn.disabled = !validation.ok;
  }

  async function openMrpPolicyEditModal(row) {
    if (!requireEditAccess("set or revise SKU MRP")) return;
    if (!row?.sku_id) {
      showToast("SKU ID missing for selected row.", "error");
      return;
    }
    if (!dom.mrpPolicyEditModal) return;

    setMrpPolicyModalError("");

    const { data: currentPolicy, error } = await fetchCurrentMrpPolicy(row.sku_id);
    if (error) {
      handleError("Failed to load current MRP policy", error);
      return;
    }

    if (currentPolicy?.sku_is_active === false || row.sku_is_active === false) {
      showToast("This SKU is inactive and cannot receive MRP policy.", "error");
      return;
    }

    mrpPolicyEditRow = row;
    mrpPolicyHasCurrent = !!currentPolicy?.policy_id;
    mrpPolicyReturnFocus = document.activeElement;

    const packLabel = [row.pack_size, row.pack_uom].filter(Boolean).join(" ");
    const skuLabel =
      [
        row.product_name,
        packLabel ||
          row.sku_display_name ||
          row.sku_column_label ||
          (row.sku_id != null ? `SKU ${row.sku_id}` : ""),
      ]
        .filter(Boolean)
        .join(" · ") || "--";

    if (dom.mrpPolicyEditTitle) {
      dom.mrpPolicyEditTitle.textContent = mrpPolicyHasCurrent
        ? "Revise MRP"
        : "Create Manual Revision";
    }
    if (dom.mrpPolicyEditSkuLabel) {
      dom.mrpPolicyEditSkuLabel.textContent = skuLabel;
    }

    const seededMode = normalizeMrpCalcMode(
      currentPolicy?.calc_mode || row.calc_mode || "AUTO",
    );
    if (dom.mrpPolicyEditCalcMode) {
      dom.mrpPolicyEditCalcMode.value = seededMode;
    }

    const seededIk = currentPolicy?.mrp_ik ?? row.mrp_ik ?? "";
    const seededOk = currentPolicy?.mrp_ok ?? row.mrp_ok ?? "";
    const seededOkPctUi = uiPctFromDecimal(
      currentPolicy?.ok_pct ?? row.ok_pct ?? null,
    );
    setMrpFieldValue(dom.mrpPolicyEditMrpIk, seededIk);
    setMrpFieldValue(dom.mrpPolicyEditMrpOk, seededOk);
    setMrpFieldValue(
      dom.mrpPolicyEditOkPct,
      seededOkPctUi === null ? "" : roundTo(seededOkPctUi, 4),
    );

    if (dom.mrpPolicyEditEffectiveFrom) {
      dom.mrpPolicyEditEffectiveFrom.value = todayIsoIst();
    }
    if (dom.mrpPolicyEditReason) dom.mrpPolicyEditReason.value = "";
    if (dom.mrpPolicyEditApprovalReference) {
      dom.mrpPolicyEditApprovalReference.value = "";
    }

    syncMrpCalcModeFieldVisibility();
    syncMrpEffectiveDateState();
    updateMrpPolicyPreview();

    dom.mrpPolicyEditModal.classList.remove("hidden");
    dom.mrpPolicyEditModal.setAttribute("aria-hidden", "false");

    setTimeout(() => dom.mrpPolicyEditMrpIk?.focus(), 0);
  }

  function closeMrpPolicyEditModal() {
    if (!dom.mrpPolicyEditModal) return;
    closeFuturePolicyConfirmation({ restoreFocus: false, force: true });

    const active = document.activeElement;
    if (active && dom.mrpPolicyEditModal.contains(active)) {
      active.blur();
    }

    dom.mrpPolicyEditModal.classList.add("hidden");
    dom.mrpPolicyEditModal.setAttribute("aria-hidden", "true");
    setMrpPolicyModalError("");

    const returnTarget =
      mrpPolicyReturnFocus &&
      mrpPolicyReturnFocus !== document.body &&
      document.contains(mrpPolicyReturnFocus)
        ? mrpPolicyReturnFocus
        : dom.drawerClose;

    mrpPolicyEditRow = null;
    mrpPolicyHasCurrent = false;
    mrpPolicyReturnFocus = null;
    mrpPolicySaving = false;
    mrpInputDriver = null;
    mrpFieldSyncing = false;

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  function setFuturePolicyConfirmationState() {
    [dom.futurePolicyConfirmCloseBtn, dom.futurePolicyConfirmReviewBtn].forEach(
      (btn) => {
        if (btn) btn.disabled = futurePolicySubmissionRunning;
      },
    );
    if (dom.futurePolicyConfirmProceedBtn) {
      dom.futurePolicyConfirmProceedBtn.disabled =
        futurePolicySubmissionRunning || !canEditPolicyActions();
    }
  }

  function openFuturePolicyConfirmation(context) {
    if (
      !dom.futurePolicyConfirmModal ||
      !dom.futurePolicyConfirmSummary ||
      !context?.execute
    ) {
      return false;
    }
    futurePolicySubmissionContext = context;
    futurePolicySubmissionRunning = false;
    dom.futurePolicyConfirmSummary.innerHTML = renderPolicySummaryItems(
      context.summary || [],
    );
    dom.futurePolicyConfirmModal.classList.remove("hidden");
    dom.futurePolicyConfirmModal.setAttribute("aria-hidden", "false");
    setFuturePolicyConfirmationState();
    setTimeout(() => dom.futurePolicyConfirmProceedBtn?.focus(), 0);
    return true;
  }

  function closeFuturePolicyConfirmation({
    restoreFocus = true,
    force = false,
  } = {}) {
    if (futurePolicySubmissionRunning && !force) return false;
    if (!dom.futurePolicyConfirmModal) return true;
    const returnFocus = futurePolicySubmissionContext?.returnFocus;
    futurePolicySubmissionContext = null;
    dom.futurePolicyConfirmModal.classList.add("hidden");
    dom.futurePolicyConfirmModal.setAttribute("aria-hidden", "true");
    if (restoreFocus && returnFocus && typeof returnFocus.focus === "function") {
      setTimeout(() => returnFocus.focus(), 0);
    }
    return true;
  }

  async function confirmFuturePolicySubmission() {
    if (!requireEditAccess("schedule this policy")) return;
    if (futurePolicySubmissionRunning) return;
    const context = futurePolicySubmissionContext;
    if (!context?.execute) return;
    futurePolicySubmissionRunning = true;
    setFuturePolicyConfirmationState();
    let succeeded = false;
    try {
      succeeded = (await context.execute()) === true;
    } finally {
      futurePolicySubmissionRunning = false;
      setFuturePolicyConfirmationState();
      if (!succeeded) closeFuturePolicyConfirmation({ restoreFocus: false });
    }
  }

  function buildMrpFuturePolicySummary(validation) {
    const row = mrpPolicyEditRow;
    const pack = formatMrpPackLabel(row);
    return [
      ["Policy type", "SKU MRP"],
      ["Product", row?.product_name || "--"],
      [
        "SKU / pack",
        [row?.sku_id != null ? `SKU ${row.sku_id}` : "", pack]
          .filter(Boolean)
          .join(" · ") || "--",
      ],
      ["Effective date", formatDate(validation.values.effectiveFrom)],
      [
        "Current policy remains effective through",
        formatDate(addDaysIsoIst(validation.values.effectiveFrom, -1)),
      ],
      [
        "Key MRP values",
        `IK ${formatOptionalMoney(validation.preview.mrpIk)} · OK ${formatOptionalMoney(validation.preview.mrpOk)}`,
      ],
      ["Submission outcome", "APPROVED policy"],
    ];
  }

  async function saveMrpPolicyEdit() {
    if (!requireEditAccess("save SKU MRP policy")) return;
    if (mrpPolicySaving || futurePolicySubmissionRunning) return;

    const row = mrpPolicyEditRow;
    if (!row?.sku_id) {
      showToast("SKU ID missing for selected row.", "error");
      return;
    }

    const validation = validateMrpPolicyForm();
    if (!validation.ok) {
      setMrpPolicyModalError(validation.message);
      setMrpPolicySaveState();
      return;
    }

    if (classifyEffectiveDate(validation.values.effectiveFrom) === "SCHEDULED_FUTURE") {
      openFuturePolicyConfirmation({
        type: "SKU_MRP",
        outcome: "APPROVED",
        summary: buildMrpFuturePolicySummary(validation),
        returnFocus: dom.mrpPolicyEditSaveBtn,
        execute: () => executeMrpPolicyEdit(validation),
      });
      return;
    }

    await executeMrpPolicyEdit(validation);
  }

  async function executeMrpPolicyEdit(validation) {
    if (!requireEditAccess("save SKU MRP policy")) return false;
    if (mrpPolicySaving) return false;
    const row = mrpPolicyEditRow;
    if (!row?.sku_id) {
      setMrpPolicyModalError("SKU ID missing for selected row.");
      return false;
    }
    const { preview, values } = validation;
    mrpPolicySaving = true;
    dom.mrpPolicyEditSaveBtn.disabled = true;
    setMrpPolicyModalError("");
    setLoadingMask(true, "Saving MRP policy...");

    try {
      const { p_mrp_ok, p_ok_pct } = resolveMrpRpcPayload(values);

      const { error } = await costingRpc("rpc_set_sku_mrp_policy", {
        p_sku_id: row.sku_id,
        p_mrp_ik: preview.mrpIk,
        p_mrp_ok,
        p_ok_pct,
        p_calc_mode: normalizeMrpCalcMode(values.calcMode),
        p_effective_from: values.effectiveFrom,
        p_reason: values.reason,
        p_approval_reference: values.approvalReference,
      });

      if (error) throw error;

      invalidateMrpPolicyCache(row.sku_id);
      closeMrpPolicyEditModal();
      showToast("MRP policy saved.", "success", 4200);

      await onPolicyDataChanged({ drawerTab: "mrp-policy", skuId: row.sku_id });
      return true;
    } catch (err) {
      const message = err?.message
        ? `Failed to save MRP policy: ${err.message}`
        : "Failed to save MRP policy.";
      setMrpPolicyModalError(message);
      handleError("Failed to save MRP policy", err);
      return false;
    } finally {
      mrpPolicySaving = false;
      setLoadingMask(false);
      setMrpPolicySaveState();
    }
  }

  function formatMrpSourceQualityLabel(sourceQuality, sourceType) {
    const quality = String(sourceQuality || "").trim();
    const type = String(sourceType || "").trim();
    if (
      /legacy/i.test(quality) ||
      /legacy/i.test(type) ||
      quality.toUpperCase() === "LEGACY_BASELINE"
    ) {
      return `${text(quality || type || "Legacy baseline")}<div class="cp-muted-text">Legacy baseline — not historically verified for audit purposes.</div>`;
    }
    return text(quality || type || "--");
  }

  function renderMrpPolicyTabContent(row, currentPolicy) {
    const hasCurrent = !!currentPolicy?.policy_id;
    const packLabel = [row.pack_size, row.pack_uom].filter(Boolean).join(" ");

    const statusBlock = hasCurrent
      ? `<div class="cp-card" style="margin-bottom:10px">
          <div class="cp-card-label">Current MRP Status</div>
          <div class="cp-card-value">${statusChip("CURRENT POLICY")}</div>
        </div>`
      : `<div class="cp-mrp-blocker-card">
          <div class="cp-card-label">Current MRP Status</div>
          <div class="cp-card-value">${statusChip("BLOCKER")}</div>
          <div class="cp-muted-text" style="margin-top:6px">
            Control: <strong>SKU_MRP_MISSING</strong> · Severity: <strong>BLOCKER</strong>
          </div>
        </div>`;

    const editAction = canEditPolicyActions()
      ? `<div class="cp-drawer-action-bar">
          <button
            type="button"
            class="icon-btn icon-btn-primary"
            id="editMrpPolicyBtn"
            title="${hasCurrent ? "Revise MRP" : "Set MRP"}"
            aria-label="${hasCurrent ? "Revise MRP" : "Set MRP"}"
          >
            ${hasCurrent ? "Revise MRP" : "Set MRP"}
          </button>
        </div>`
      : "";

    const policyValues = hasCurrent
      ? kvSection("Current Policy Values", [
          ["MRP IK", formatOptionalMoney(currentPolicy.mrp_ik)],
          ["MRP OK", formatOptionalMoney(currentPolicy.mrp_ok)],
          ["OK Uplift %", formatOkPctFromDecimal(currentPolicy.ok_pct)],
          ["Calculation Mode", text(currentPolicy.calc_mode)],
          ["Effective From", formatDate(currentPolicy.effective_from)],
          ["Effective To", formatDate(currentPolicy.effective_to)],
          ["Reason", text(currentPolicy.reason)],
          ["Approval Reference", text(currentPolicy.approval_reference)],
          ["Source Type", text(currentPolicy.source_type)],
          [
            "Source Quality",
            formatMrpSourceQualityLabel(
              currentPolicy.source_quality,
              currentPolicy.source_type,
            ),
          ],
          ["Policy ID", text(currentPolicy.policy_id)],
          ["Previous Policy ID", text(currentPolicy.previous_policy_id)],
          ["Created At", formatDateTime(currentPolicy.created_at)],
          ["Created By", text(currentPolicy.created_by)],
        ])
      : kvSection("Current Policy Values", [
          ["MRP IK", formatOptionalMoney(row.mrp_ik)],
          ["MRP OK", formatOptionalMoney(row.mrp_ok)],
          [
            "Status",
            "No governed current MRP policy. Overview values may be absent until a policy is set.",
          ],
        ]);

    return (
      statusBlock +
      editAction +
      detailPanel([
        kvSection("SKU Identity", [
          ["Product", text(row.product_name || row.product_id)],
          ["Pack", text(packLabel || "--")],
          ["SKU ID", text(row.sku_id)],
        ]),
        policyValues,
      ])
    );
  }

  // ---------------------------------------------------------------------------
  // PPM-C1D: Product Derivation Policies
  // ---------------------------------------------------------------------------

  function isProductDerivationPoliciesTabActive() {
    return getMrpGovernanceTab() === "product-derivation-policies";
  }

  function getProductDerivationPolicyView() {
    return productDerivationPolicyView;
  }

  function setProductDerivationPolicyView(view) {
    productDerivationPolicyView = view === "history" ? "history" : "current";
  }

  function humanizeToken(value) {
    const raw = String(value || "").trim();
    if (!raw) return "--";
    return raw
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function formatDerivationStatus(status) {
    const raw = String(status || "").trim().toUpperCase();
    if (!raw) return "--";
    if (raw === "DRAFT") return "Draft";
    if (raw === "CONFIRMED") return "Confirmed";
    if (raw === "CANCELLED") return "Cancelled";
    if (raw === "CLOSED") return "Closed";
    if (raw === "SUPERSEDED") return "Superseded";
    return humanizeToken(raw);
  }

  function formatReferenceSelectionSource(source) {
    const raw = String(source || "").trim().toUpperCase();
    if (!raw) return "--";
    if (raw === "SYSTEM_SELECTED") return "System selected";
    if (raw === "USER_SELECTED") return "User selected";
    return humanizeToken(raw);
  }

  function formatDerivationSourceType(sourceType) {
    const raw = String(sourceType || "").trim().toUpperCase();
    if (!raw) return "--";
    if (raw === "SYSTEM_INFERRED_BASELINE") return "System-inferred baseline";
    if (raw === "USER_CONFIGURED") return "User configured";
    return humanizeToken(raw);
  }

  function formatDerivationSourceQuality(sourceQuality) {
    const raw = String(sourceQuality || "").trim().toUpperCase();
    if (!raw) return "--";
    if (raw === "LEGACY_INFERRED_REVIEW_REQUIRED") {
      return "Legacy inferred — review required";
    }
    if (raw === "GOVERNED") return "Governed";
    return humanizeToken(raw);
  }

  function readinessForRow(row) {
    if (row?.product_id == null) return null;
    return (
      productDerivationReadinessByProductId.get(String(row.product_id)) || null
    );
  }

  function formatReadinessChip(readiness) {
    if (!readiness) return "--";
    const status = String(readiness.readiness_status || "").trim();
    const blocker = String(readiness.blocker_code || "").trim();
    if (!status && !blocker) return "--";
    const label = status ? humanizeToken(status) : humanizeToken(blocker);
    const chip = statusChip(label);
    if (blocker && status) {
      return `${chip}<div class="cp-muted-text">${text(humanizeToken(blocker))}</div>`;
    }
    return chip;
  }

  function derivationDateOnly(value) {
    return value ? String(value).slice(0, 10) : null;
  }

  /** Client-side presentation lifecycle for history rows only. */
  function formatDerivationLifecycle(row) {
    const status = String(row.status || "").trim().toUpperCase();
    const today = todayIsoIst();
    const from = derivationDateOnly(row.effective_from);
    const to = derivationDateOnly(row.effective_to);

    if (status === "CANCELLED") return "Cancelled";
    if (status === "CLOSED") return "Closed";
    if (status === "DRAFT" || status === "CONFIRMED") {
      if (from && from > today) return "Scheduled";
      const startedOk = !from || from <= today;
      const notEnded = !to || to >= today;
      if (startedOk && notEnded) return "Current";
    }
    if (to && to < today) return "Expired";
    return humanizeToken(status);
  }

  function formatDerivationPackLabel(row) {
    const size = row.reference_pack_size;
    const uom = row.reference_pack_uom;
    const label = [size, uom].filter((v) => v !== null && v !== "").join(" ");
    return label || "--";
  }

  function formatDerivationRefMrp(row) {
    const ik = formatOptionalMoney(row.reference_mrp_ik);
    const ok = formatOptionalMoney(row.reference_mrp_ok);
    return `IK ${ik} · OK ${ok}`;
  }

  function formatDerivationEffectivePeriod(row) {
    const from = formatDate(row.effective_from);
    const to = row.effective_to ? formatDate(row.effective_to) : "Open";
    return `${from} → ${to}`;
  }

  function sortProductDerivationRows(rows) {
    const sorted = [...(rows || [])];
    sorted.sort((a, b) => {
      const nameCmp = String(a.product_name || "").localeCompare(
        String(b.product_name || ""),
        undefined,
        { sensitivity: "base" },
      );
      if (nameCmp) return nameCmp;
      const productCmp = compareNullableNumber(a.product_id, b.product_id);
      if (productCmp) return productCmp;
      const fromCmp = String(b.effective_from || "").localeCompare(
        String(a.effective_from || ""),
      );
      if (fromCmp) return fromCmp;
      return compareNullableNumber(b.derivation_policy_id, a.derivation_policy_id);
    });
    return sorted;
  }

  function matchesProductDerivationFilters(row) {
    if (productDerivationFilters.status.length) {
      const status = String(row.status || "").trim().toUpperCase();
      if (!productDerivationFilters.status.includes(status)) return false;
    }
    if (productDerivationFilters.selectionSource.length) {
      const source = String(row.reference_selection_source || "")
        .trim()
        .toUpperCase();
      if (!productDerivationFilters.selectionSource.includes(source)) return false;
    }
    if (productDerivationFilters.sourceType.length) {
      const source = String(row.source_type || "").trim().toUpperCase();
      if (!productDerivationFilters.sourceType.includes(source)) return false;
    }
    if (productDerivationFilters.sourceQuality.length) {
      const quality = String(row.source_quality || "").trim().toUpperCase();
      if (!productDerivationFilters.sourceQuality.includes(quality)) return false;
    }
    if (productDerivationFilters.readiness.length) {
      const readiness = readinessForRow(row);
      const readinessStatus = String(readiness?.readiness_status || "")
        .trim()
        .toUpperCase();
      if (!productDerivationFilters.readiness.includes(readinessStatus)) {
        return false;
      }
    }
    if (
      productDerivationPolicyView === "history" &&
      productDerivationFilters.lifecycle.length
    ) {
      const life = formatDerivationLifecycle(row).toUpperCase();
      if (!productDerivationFilters.lifecycle.includes(life)) return false;
    }
    return true;
  }

  function getProductDerivationFilteredRows() {
    return sortProductDerivationRows(
      productDerivationRawRows.filter(matchesProductDerivationFilters),
    );
  }

  async function loadProductDerivationReadiness() {
    const rows = await fetchAllRows(
      () =>
        costingFrom("v_product_mrp_reference_readiness")
          .select(PRODUCT_DERIVATION_READINESS_SELECT)
          .order("product_name", { ascending: true }),
      1000,
    );
    const map = new Map();
    (rows || []).forEach((row) => {
      if (row?.product_id != null) map.set(String(row.product_id), row);
    });
    productDerivationReadinessByProductId = map;
    return map;
  }

  async function loadProductDerivationPolicyRows() {
    const isHistory = productDerivationPolicyView === "history";
    const viewName = isHistory
      ? "v_product_mrp_derivation_history"
      : "v_product_mrp_derivation_current";
    const selectFields = isHistory ? "*" : PRODUCT_DERIVATION_SELECT;

    // Fetch policy rows and readiness once (no N+1); merge readiness by product_id.
    const [rows] = await Promise.all([
      fetchAllRows(
        () =>
          costingFrom(viewName)
            .select(selectFields)
            .order("product_name", { ascending: true })
            .order("product_id", { ascending: true })
            .order("effective_from", { ascending: false })
            .order("derivation_policy_id", { ascending: false }),
        1000,
      ),
      loadProductDerivationReadiness(),
    ]);

    productDerivationRawRows = (rows || []).map((row) => {
      const readiness = readinessForRow(row);
      return readiness ? { ...row, __readiness: readiness } : row;
    });
    return getProductDerivationFilteredRows();
  }

  function toggleProductDerivationFilter(group, value, checked) {
    if (!productDerivationFilters[group]) {
      return getProductDerivationFilteredRows();
    }
    const normalized = String(value || "").trim();
    if (!normalized) return getProductDerivationFilteredRows();
    const set = new Set(productDerivationFilters[group]);
    if (checked) set.add(normalized);
    else set.delete(normalized);
    productDerivationFilters[group] = [...set];
    return getProductDerivationFilteredRows();
  }

  function clearProductDerivationFilters() {
    productDerivationFilters = {
      status: [],
      selectionSource: [],
      sourceType: [],
      sourceQuality: [],
      readiness: [],
      lifecycle: [],
    };
    return getProductDerivationFilteredRows();
  }

  function collectDerivationReadinessStatuses() {
    const seen = new Set();
    productDerivationReadinessByProductId.forEach((readiness) => {
      const status = String(readiness?.readiness_status || "").trim().toUpperCase();
      if (status) seen.add(status);
    });
    return [...seen].sort();
  }

  function getProductDerivationApplicableFilterKeys() {
    const keys = [
      "status",
      "selectionSource",
      "sourceType",
      "sourceQuality",
      "readiness",
    ];
    if (productDerivationPolicyView === "history") keys.push("lifecycle");
    return keys;
  }

  function formatProductDerivationFilterFieldLabel(group) {
    if (group === "status") {
      return productDerivationPolicyView === "history"
        ? "Persisted status"
        : "Status";
    }
    if (group === "selectionSource") return "Selection";
    if (group === "sourceType") return "Source";
    if (group === "sourceQuality") return "Quality";
    if (group === "readiness") return "Readiness";
    if (group === "lifecycle") return "Lifecycle";
    return humanizeMrpToken(group);
  }

  function formatProductDerivationFilterValueLabel(group, value) {
    const raw = String(value || "").trim();
    if (group === "status") return formatDerivationStatus(raw);
    if (group === "selectionSource") return formatReferenceSelectionSource(raw);
    if (group === "sourceType") return formatDerivationSourceType(raw);
    if (group === "sourceQuality") return formatDerivationSourceQuality(raw);
    if (group === "lifecycle") {
      if (raw === "CURRENT") return "Current";
      if (raw === "SCHEDULED") return "Scheduled";
      if (raw === "EXPIRED") return "Expired";
      if (raw === "CLOSED") return "Closed";
      if (raw === "CANCELLED") return "Cancelled";
      return humanizeMrpToken(raw);
    }
    if (group === "readiness") return humanizeToken(raw);
    return humanizeMrpToken(raw) || raw;
  }

  function buildProductDerivationActiveFilterChips() {
    const chips = [];
    for (const group of getProductDerivationApplicableFilterKeys()) {
      const values = productDerivationFilters[group] || [];
      for (const value of values) {
        const field = formatProductDerivationFilterFieldLabel(group);
        const valueLabel = formatProductDerivationFilterValueLabel(group, value);
        const label = `${field}: ${valueLabel}`;
        chips.push(
          renderMrpActiveFilterChip({
            label,
            groupAttr: "data-product-derivation-filter-chip-group",
            group,
            valueAttr: "data-product-derivation-filter-chip-value",
            value,
            ariaLabel: `Remove ${label} filter`,
          }),
        );
      }
    }
    return chips.join("");
  }

  function renderProductDerivationFilterCheckbox(group, value, label) {
    const checked = productDerivationFilters[group]?.includes(value)
      ? "checked"
      : "";
    return `<label class="cp-mrp-filter-item"><input type="checkbox" data-product-derivation-filter-group="${group}" value="${String(value).replace(/"/g, "&quot;")}" ${checked}/> ${text(label)}</label>`;
  }

  function renderProductDerivationFilterPanel() {
    const readinessOptions = collectDerivationReadinessStatuses()
      .map((status) =>
        renderProductDerivationFilterCheckbox(
          "readiness",
          status,
          humanizeToken(status),
        ),
      )
      .join("");

    const lifecycleBlock =
      productDerivationPolicyView === "history"
        ? `<div class="cp-mrp-filter-group">
            <div class="cp-mrp-filter-title">Lifecycle</div>
            <div class="cp-mrp-filter-options">
              ${renderProductDerivationFilterCheckbox("lifecycle", "CURRENT", "Current")}
              ${renderProductDerivationFilterCheckbox("lifecycle", "SCHEDULED", "Scheduled")}
              ${renderProductDerivationFilterCheckbox("lifecycle", "EXPIRED", "Expired")}
              ${renderProductDerivationFilterCheckbox("lifecycle", "CLOSED", "Closed")}
              ${renderProductDerivationFilterCheckbox("lifecycle", "CANCELLED", "Cancelled")}
            </div>
          </div>`
        : "";

    const statusBlock =
      productDerivationPolicyView === "history"
        ? `<div class="cp-mrp-filter-group">
            <div class="cp-mrp-filter-title">Persisted status</div>
            <div class="cp-mrp-filter-options">
              ${renderProductDerivationFilterCheckbox("status", "DRAFT", "Draft")}
              ${renderProductDerivationFilterCheckbox("status", "CONFIRMED", "Confirmed")}
              ${renderProductDerivationFilterCheckbox("status", "CLOSED", "Closed")}
              ${renderProductDerivationFilterCheckbox("status", "CANCELLED", "Cancelled")}
            </div>
          </div>`
        : `<div class="cp-mrp-filter-group">
            <div class="cp-mrp-filter-title">Policy status</div>
            <div class="cp-mrp-filter-options">
              ${renderProductDerivationFilterCheckbox("status", "DRAFT", "Draft")}
              ${renderProductDerivationFilterCheckbox("status", "CONFIRMED", "Confirmed")}
            </div>
          </div>`;

    const bodyHtml = `
      <div class="cp-mrp-filter-panel" id="productDerivationFilterPanel">
        ${statusBlock}
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Reference selection</div>
          <div class="cp-mrp-filter-options">
            ${renderProductDerivationFilterCheckbox("selectionSource", "SYSTEM_SELECTED", "System selected")}
            ${renderProductDerivationFilterCheckbox("selectionSource", "USER_SELECTED", "User selected")}
          </div>
        </div>
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Source type</div>
          <div class="cp-mrp-filter-options">
            ${renderProductDerivationFilterCheckbox("sourceType", "SYSTEM_INFERRED_BASELINE", "System-inferred baseline")}
            ${renderProductDerivationFilterCheckbox("sourceType", "USER_CONFIGURED", "User configured")}
          </div>
        </div>
        <div class="cp-mrp-filter-group">
          <div class="cp-mrp-filter-title">Source quality</div>
          <div class="cp-mrp-filter-options">
            ${renderProductDerivationFilterCheckbox("sourceQuality", "LEGACY_INFERRED_REVIEW_REQUIRED", "Legacy inferred — review required")}
            ${renderProductDerivationFilterCheckbox("sourceQuality", "GOVERNED", "Governed")}
          </div>
        </div>
        ${
          readinessOptions
            ? `<div class="cp-mrp-filter-group">
                <div class="cp-mrp-filter-title">Readiness</div>
                <div class="cp-mrp-filter-options">${readinessOptions}</div>
              </div>`
            : ""
        }
        ${lifecycleBlock}
      </div>`;

    const activeCount = countActiveMrpFilterFields(
      productDerivationFilters,
      getProductDerivationApplicableFilterKeys(),
    );

    return renderMrpFilterDrawerPanel({
      activeCount,
      bodyHtml,
      clearAllAttr: "data-product-derivation-filter-clear",
      clearAllLabel: "Clear all",
    });
  }

  function renderProductDerivationDrawerReviseAction(row) {
    if (productDerivationPolicyView !== "current") return "";
    if (!canEditPolicyActions()) return "";
    if (row.product_id == null) return "";
    return `<div class="cp-drawer-action-bar">
      <button
        type="button"
        class="icon-btn icon-btn-primary"
        id="productDerivationDrawerReviseBtn"
        title="Revise Policy"
        aria-label="Revise Policy"
      >
        Revise Policy
      </button>
    </div>`;
  }

  function renderProductDerivationScheduledCancellationAction(row) {
    if (
      productDerivationPolicyView !== "history" ||
      !isScheduledDerivationPolicy(row)
    ) {
      return "";
    }
    return `<div class="cp-drawer-action-bar">
      <button
        type="button"
        class="icon-btn cp-danger-text-btn"
        id="productDerivationDrawerCancelScheduledBtn"
        title="Cancel Scheduled Policy"
        aria-label="Cancel Scheduled Policy"
      >
        Cancel Scheduled Policy
      </button>
    </div>`;
  }

  function renderProductDerivationCurrentRow(row, trAttrs) {
    const readiness = readinessForRow(row);
    const inactiveRef =
      row.reference_sku_is_active === false
        ? `<div class="cp-muted-text">Inactive Reference Pack</div>`
        : "";
    return `<tr ${trAttrs}>
      <td>${cpCellPrimary(row.product_name)}<div class="cp-muted-text">Product ${text(row.product_id)}</div></td>
      <td>${text(formatDerivationPackLabel(row))}${row.reference_sku_id != null ? `<div class="cp-muted-text">SKU ${text(row.reference_sku_id)}</div>` : ""}${inactiveRef}</td>
      <td class="c-right">${formatOptionalMoney(row.reference_mrp_ik)}</td>
      <td class="c-right">${formatOptionalMoney(row.reference_mrp_ok)}</td>
      <td class="c-right">${formatOkPctFromDecimal(row.reference_ok_pct)}</td>
      <td>${formatDate(row.effective_from)}</td>
      <td>${statusChip(formatDerivationStatus(row.status))}</td>
      <td>${text(formatReferenceSelectionSource(row.reference_selection_source))}<div class="cp-muted-text">${text(formatDerivationSourceType(row.source_type))}</div></td>
      <td>${text(formatDerivationSourceQuality(row.source_quality))}</td>
      <td>${formatReadinessChip(readiness)}</td>
    </tr>`;
  }

  function renderProductDerivationHistoryRow(row, trAttrs) {
    return `<tr ${trAttrs}>
      <td>${cpCellPrimary(row.product_name)}<div class="cp-muted-text">Product ${text(row.product_id)}</div></td>
      <td>${text(formatDerivationPackLabel(row))}${row.reference_sku_id != null ? `<div class="cp-muted-text">SKU ${text(row.reference_sku_id)}</div>` : ""}</td>
      <td class="c-right">${text(formatDerivationRefMrp(row))}</td>
      <td>${statusChip(formatDerivationLifecycle(row))}</td>
      <td>${statusChip(formatDerivationStatus(row.status))}</td>
      <td>${text(formatDerivationEffectivePeriod(row))}</td>
      <td>${text(formatDerivationSourceType(row.source_type))}</td>
      <td>${text(formatDerivationSourceQuality(row.source_quality))}</td>
      <td class="c-right">${text(row.derivation_policy_id)}</td>
      <td class="c-right">${text(row.previous_policy_id || "--")}</td>
    </tr>`;
  }

  function getProductDerivationDrawerConfig(row, preferredTab) {
    const pack = formatDerivationPackLabel(row);
    return {
      title:
        row.product_name ||
        (row.product_id != null ? `Product ${row.product_id}` : "Derivation Policy"),
      subtitle: [
        pack !== "--" ? `Reference ${pack}` : "",
        row.derivation_policy_id != null
          ? `Policy ${row.derivation_policy_id}`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
      tabs: [
        { id: "policy-detail", label: "Policy Detail" },
        { id: "reference-pack", label: "Reference Pack" },
        { id: "configuration", label: "Configuration" },
        { id: "evidence", label: "Evidence" },
      ],
      activeTab: preferredTab || "policy-detail",
    };
  }

  function renderProductDerivationDrawerTab(tabId, row) {
    const readiness = readinessForRow(row);
    const cancellationEvidence = formatCancellationEvidence(row);

    if (tabId === "reference-pack") {
      const inactiveWarning =
        row.reference_sku_is_active === false
          ? `<div class="cp-mrp-blocker-card" style="margin-bottom:10px">
              <div class="cp-card-label">Reference Pack warning</div>
              <div class="cp-muted-text">The Reference Pack SKU is inactive. Future proposals may be affected until an active Reference Pack is established.</div>
            </div>`
          : "";
      return (
        inactiveWarning +
        detailPanel([
          kvSection("Reference Pack SKU", [
            ["Reference SKU ID", text(row.reference_sku_id)],
            ["Pack", text(formatDerivationPackLabel(row))],
            [
              "SKU state",
              text(row.reference_sku_is_active === false ? "Inactive" : "Active"),
            ],
            [
              "Sample pack",
              text(row.reference_sku_is_sample === true ? "Yes" : "No"),
            ],
            [
              "Selection source",
              text(formatReferenceSelectionSource(row.reference_selection_source)),
            ],
          ]),
          kvSection("Reference MRP (read-only, server-resolved)", [
            ["Reference IK MRP", formatOptionalMoney(row.reference_mrp_ik)],
            ["Reference OK MRP", formatOptionalMoney(row.reference_mrp_ok)],
            ["Reference OK uplift", formatOkPctFromDecimal(row.reference_ok_pct)],
            ["Reference MRP policy ID", text(row.reference_mrp_policy_id)],
          ]),
        ])
      );
    }

    if (tabId === "configuration") {
      return detailPanel([
        kvSection("Deployed derivation factors", [
          [
            "Smaller pack adjustment %",
            formatSignedRatioPercent(row.smaller_pack_adjustment_pct),
          ],
          [
            "Larger pack adjustment %",
            formatSignedRatioPercent(row.larger_pack_adjustment_pct),
          ],
          ["Ceiling increment", formatOptionalMoney(row.ceiling_increment)],
        ]),
        kvSection("Effective window", [
          ["Effective from", formatDate(row.effective_from)],
          ["Effective to", formatDate(row.effective_to)],
          ["Status", text(formatDerivationStatus(row.status))],
        ]),
      ]);
    }

    if (tabId === "evidence") {
      const snap = summarizeMrpSourceSnapshot(
        row.source_snapshot,
        row.source_type,
      );
      return detailPanel([
        kvSection("Governance", [
          ["Reason", text(row.reason)],
          ["Approval reference", text(row.approval_reference)],
          ["Source type", text(formatDerivationSourceType(row.source_type))],
          [
            "Source quality",
            text(formatDerivationSourceQuality(row.source_quality)),
          ],
          ["Previous policy ID", text(row.previous_policy_id || "--")],
        ]),
        kvSection("Audit", [
          ["Created at", formatDateTime(row.created_at)],
          ["Created by", text(row.created_by)],
          ["Confirmed at", formatDateTime(row.confirmed_at)],
          ["Confirmed by", text(row.confirmed_by)],
          ["Closed at", formatDateTime(row.closed_at)],
          ["Closed by", text(row.closed_by)],
        ]),
        cancellationEvidence.length
          ? kvSection("Cancellation", cancellationEvidence)
          : "",
        kvSection("Provenance summary", [["Summary", text(snap.summary)]]),
        snap.technical
          ? kvSection("Technical evidence", [
              [
                "source_snapshot",
                `<pre class="cp-mrp-snapshot-pre">${text(snap.technical)}</pre>`,
              ],
            ])
          : "",
      ]);
    }

    // policy-detail
    return (
      renderProductDerivationDrawerReviseAction(row) +
      renderProductDerivationScheduledCancellationAction(row) +
      detailPanel([
        kvSection("Identity", [
          ["Policy ID", text(row.derivation_policy_id)],
          ["Product", text(row.product_name)],
          ["Product ID", text(row.product_id)],
          ["Status", statusChip(formatDerivationStatus(row.status))],
          productDerivationPolicyView === "history"
            ? ["Lifecycle", statusChip(formatDerivationLifecycle(row))]
            : null,
        ].filter(Boolean)),
        kvSection("Reference Pack", [
          ["Reference SKU ID", text(row.reference_sku_id)],
          ["Reference Pack", text(formatDerivationPackLabel(row))],
          ["Reference IK MRP", formatOptionalMoney(row.reference_mrp_ik)],
          ["Reference OK MRP", formatOptionalMoney(row.reference_mrp_ok)],
          ["Reference OK uplift", formatOkPctFromDecimal(row.reference_ok_pct)],
          [
            "Selection source",
            text(formatReferenceSelectionSource(row.reference_selection_source)),
          ],
        ]),
        kvSection("Derivation factors", [
          [
            "Smaller pack adjustment %",
            formatSignedRatioPercent(row.smaller_pack_adjustment_pct),
          ],
          [
            "Larger pack adjustment %",
            formatSignedRatioPercent(row.larger_pack_adjustment_pct),
          ],
          ["Ceiling increment", formatOptionalMoney(row.ceiling_increment)],
        ]),
        kvSection("Effective window", [
          ["Effective from", formatDate(row.effective_from)],
          ["Effective to", formatDate(row.effective_to)],
        ]),
        readiness
          ? kvSection("Reference readiness", [
              [
                "Readiness status",
                text(humanizeToken(readiness.readiness_status)),
              ],
              [
                "Blocker code",
                text(
                  readiness.blocker_code
                    ? humanizeToken(readiness.blocker_code)
                    : "--",
                ),
              ],
            ])
          : "",
      ])
    );
  }

  function wireProductDerivationTableActions(_tableBody, _getViewRow) {
    // Revise Policy lives in the Policy Detail drawer (see wireProductDerivationDrawerActions).
  }

  function wireProductDerivationDrawerActions(tabId, row) {
    if (tabId !== "policy-detail" || !row) return;
    document
      .getElementById("productDerivationDrawerReviseBtn")
      ?.addEventListener("click", () => {
        void openDerivationPolicyEditModal({ row, mode: "revise" });
      });
    document
      .getElementById("productDerivationDrawerCancelScheduledBtn")
      ?.addEventListener("click", () => {
        openScheduledPolicyCancellationModal({
          type: "PRODUCT_DERIVATION",
          id: Number(row.derivation_policy_id),
          row,
        });
      });
  }

  // --- Derivation edit modal ------------------------------------------------

  function setDerivationModalError(message) {
    if (!dom.derivationPolicyEditError) return;
    dom.derivationPolicyEditError.hidden = !message;
    dom.derivationPolicyEditError.textContent = message || "";
  }

  function derivationSkuLabel(sku) {
    const pack = [sku.pack_size, sku.uom].filter((v) => v !== null && v !== "").join(" ");
    const flags = [];
    if (sku.is_active === false) flags.push("Inactive");
    if (sku.is_sample === true) flags.push("Sample");
    const suffix = flags.length ? ` — ${flags.join(", ")}` : "";
    return `${pack || `SKU ${sku.id}`}${suffix}`;
  }

  function sortDerivationSkusForSelect(skus) {
    return [...(skus || [])].sort((a, b) => {
      const aPreferred = a.is_active !== false && a.is_sample !== true;
      const bPreferred = b.is_active !== false && b.is_sample !== true;
      if (aPreferred !== bPreferred) return aPreferred ? -1 : 1;
      return compareNullableNumber(a.pack_size, b.pack_size);
    });
  }

  async function loadDerivationProductSkus(productId) {
    const { data, error } = await costingFrom("product_skus")
      .select("id,product_id,pack_size,uom,is_active,is_sample")
      .eq("product_id", productId)
      .order("pack_size", { ascending: true });
    if (error) throw error;
    const skus = sortDerivationSkusForSelect(data || []);
    derivationProductSkus = skus;

    derivationSkuMrpBySkuId = new Map();
    const skuIds = skus.map((s) => s.id).filter((id) => id != null);
    if (skuIds.length) {
      const { data: mrpRows, error: mrpError } = await costingFrom(
        "v_sku_mrp_current",
      )
        .select("sku_id,mrp_ik,mrp_ok,ok_pct")
        .in("sku_id", skuIds);
      if (mrpError) throw mrpError;
      (mrpRows || []).forEach((row) => {
        if (row?.sku_id != null) {
          derivationSkuMrpBySkuId.set(String(row.sku_id), row);
        }
      });
    }
    return skus;
  }

  function populateDerivationReferenceSkuOptions(selectedSkuId) {
    const select = dom.derivationPolicyEditReferenceSku;
    if (!select) return;
    const options = derivationProductSkus
      .map((sku) => {
        const selected =
          selectedSkuId != null && String(sku.id) === String(selectedSkuId)
            ? "selected"
            : "";
        return `<option value="${text(sku.id)}" ${selected}>${text(derivationSkuLabel(sku))}</option>`;
      })
      .join("");
    select.innerHTML =
      `<option value="">Select Reference Pack SKU</option>` + options;
    if (selectedSkuId != null) {
      select.value = String(selectedSkuId);
    }
  }

  function updateDerivationReferenceMrpDisplay() {
    const display = dom.derivationPolicyEditRefMrpDisplay;
    if (!display) return;
    const skuId = dom.derivationPolicyEditReferenceSku?.value || "";
    const sku = derivationProductSkus.find(
      (s) => String(s.id) === String(skuId),
    );
    const warning =
      sku && sku.is_active === false
        ? `<div class="cp-muted-text" style="color:var(--danger,#b91c1c)">Inactive Reference Pack SKU.</div>`
        : "";
    if (!skuId) {
      display.innerHTML = `<div class="cp-muted-text">Select a Reference Pack SKU to view its current MRP.</div>`;
      return;
    }
    const mrp = derivationSkuMrpBySkuId.get(String(skuId));
    if (!mrp) {
      display.innerHTML = `${warning}<div class="cp-muted-text">No current SKU MRP policy for this Reference Pack SKU.</div>`;
      return;
    }
    display.innerHTML = `
      ${warning}
      <div class="cp-preview-row"><span>Reference IK MRP</span><span class="cp-preview-value">${formatOptionalMoney(mrp.mrp_ik)}</span></div>
      <div class="cp-preview-row"><span>Reference OK MRP</span><span class="cp-preview-value">${formatOptionalMoney(mrp.mrp_ok)}</span></div>
      <div class="cp-preview-row"><span>Reference OK uplift</span><span class="cp-preview-value">${formatOkPctFromDecimal(mrp.ok_pct)}</span></div>
    `;
  }

  function populateDerivationProductSelect(selectedProductId) {
    const select = dom.derivationPolicyEditProduct;
    if (!select) return;
    const products = [...productDerivationReadinessByProductId.values()].sort(
      (a, b) =>
        String(a.product_name || "").localeCompare(
          String(b.product_name || ""),
          undefined,
          { sensitivity: "base" },
        ),
    );
    select.innerHTML =
      `<option value="">Select product</option>` +
      products
        .map((p) => {
          const selected =
            selectedProductId != null &&
            String(p.product_id) === String(selectedProductId)
              ? "selected"
              : "";
          return `<option value="${text(p.product_id)}" ${selected}>${text(p.product_name || `Product ${p.product_id}`)}</option>`;
        })
        .join("");
    if (selectedProductId != null) select.value = String(selectedProductId);
  }

  function setDerivationProductChrome(mode, row) {
    const isCreate = mode === "create";
    if (dom.derivationPolicyEditProductWrap) {
      dom.derivationPolicyEditProductWrap.hidden = !isCreate;
    }
    if (dom.derivationPolicyEditProductLabelWrap) {
      dom.derivationPolicyEditProductLabelWrap.hidden = isCreate;
    }
    if (dom.derivationPolicyEditProductLabel) {
      const readiness =
        row?.product_id != null
          ? productDerivationReadinessByProductId.get(String(row.product_id))
          : null;
      dom.derivationPolicyEditProductLabel.textContent =
        row?.product_name ||
        readiness?.product_name ||
        (row?.product_id != null ? `Product ${row.product_id}` : "--");
    }
    if (dom.derivationPolicyEditGovernanceNote) {
      dom.derivationPolicyEditGovernanceNote.textContent =
        mode === "basis"
          ? "This opens a new revision seeded from a historical policy. The historical policy is never modified; saving creates a NEW derivation policy revision."
          : "This creates a new governed Product MRP derivation policy revision. Existing draft proposals are not changed by this action.";
    }
  }

  function setDerivationSaveState() {
    syncDerivationEffectiveDateState();
    const validation = validateDerivationForm();
    const disabled = !canEditPolicyActions() || derivationPolicySaving || !validation.ok;
    if (dom.derivationPolicyEditDraftBtn) {
      dom.derivationPolicyEditDraftBtn.disabled = disabled;
    }
    if (dom.derivationPolicyEditConfirmBtn) {
      dom.derivationPolicyEditConfirmBtn.disabled = disabled;
    }
  }

  function readDerivationFormValues() {
    return {
      productId: derivationPolicyEditProductId,
      referenceSkuId: dom.derivationPolicyEditReferenceSku?.value || "",
      smallerPctUi: numberOrNullFromInput(dom.derivationPolicyEditSmallerPct),
      largerPctUi: numberOrNullFromInput(dom.derivationPolicyEditLargerPct),
      ceilingIncrement: numberOrNullFromInput(dom.derivationPolicyEditCeiling),
      effectiveFrom: dom.derivationPolicyEditEffectiveFrom?.value || "",
      reason: dom.derivationPolicyEditReason?.value?.trim() || "",
      approvalReference:
        dom.derivationPolicyEditApprovalReference?.value?.trim() || null,
    };
  }

  function validateDerivationForm(values = readDerivationFormValues()) {
    if (values.productId == null || values.productId === "") {
      return { ok: false, message: "Product is required." };
    }
    if (!values.referenceSkuId) {
      return { ok: false, message: "Reference Pack SKU is required." };
    }
    if (!Number.isFinite(values.smallerPctUi)) {
      return { ok: false, message: "Smaller pack adjustment % must be a number." };
    }
    if (!Number.isFinite(values.largerPctUi)) {
      return { ok: false, message: "Larger pack adjustment % must be a number." };
    }
    if (!Number.isFinite(values.ceilingIncrement) || values.ceilingIncrement < 0) {
      return { ok: false, message: "Ceiling increment must be zero or greater." };
    }
    if (!values.effectiveFrom) {
      return { ok: false, message: "Effective-from date is required." };
    }
    if (classifyEffectiveDate(values.effectiveFrom) === "INVALID_PAST") {
      return {
        ok: false,
        message:
          "Effective-from date cannot be before the current India business date.",
      };
    }
    if (!values.reason) {
      return { ok: false, message: "Reason is required." };
    }
    return { ok: true, values };
  }

  async function openDerivationPolicyEditModal({ row = null, mode = "create" } = {}) {
    if (!requireEditAccess("set or revise Product MRP derivation policy")) return;
    if (!dom.derivationPolicyEditModal) return;

    setDerivationModalError("");
    derivationPolicyEditRow = row;
    derivationPolicyEditMode = mode;
    derivationPolicyReturnFocus = document.activeElement;

    const productId =
      mode === "create"
        ? row?.product_id ?? null
        : row?.product_id ?? null;
    derivationPolicyEditProductId = productId != null ? productId : null;

    if (dom.derivationPolicyEditTitle) {
      dom.derivationPolicyEditTitle.textContent =
        mode === "create"
          ? "Create Derivation Policy"
          : mode === "basis"
            ? "Revise from Historical Policy"
            : "Revise Derivation Policy";
    }

    populateDerivationProductSelect(productId);
    setDerivationProductChrome(mode, row);

    // Seed adjustment / ceiling values.
    const smallerUi = uiPctFromDecimal(row?.smaller_pack_adjustment_pct ?? null);
    const largerUi = uiPctFromDecimal(row?.larger_pack_adjustment_pct ?? null);
    if (dom.derivationPolicyEditSmallerPct) {
      dom.derivationPolicyEditSmallerPct.value =
        smallerUi === null ? "" : roundTo(smallerUi, 4);
    }
    if (dom.derivationPolicyEditLargerPct) {
      dom.derivationPolicyEditLargerPct.value =
        largerUi === null ? "" : roundTo(largerUi, 4);
    }
    if (dom.derivationPolicyEditCeiling) {
      dom.derivationPolicyEditCeiling.value =
        row?.ceiling_increment ?? "";
    }

    if (dom.derivationPolicyEditEffectiveFrom) {
      dom.derivationPolicyEditEffectiveFrom.value = todayIsoIst();
    }
    if (dom.derivationPolicyEditReason) dom.derivationPolicyEditReason.value = "";
    if (dom.derivationPolicyEditApprovalReference) {
      dom.derivationPolicyEditApprovalReference.value =
        row?.approval_reference || "";
    }

    dom.derivationPolicyEditModal.classList.remove("hidden");
    dom.derivationPolicyEditModal.setAttribute("aria-hidden", "false");

    if (dom.derivationPolicyEditRefMrpDisplay) {
      dom.derivationPolicyEditRefMrpDisplay.innerHTML = `<div class="cp-muted-text">Loading Reference Pack SKUs…</div>`;
    }

    try {
      if (productId != null) {
        await loadDerivationProductSkus(productId);
        populateDerivationReferenceSkuOptions(row?.reference_sku_id ?? null);
      } else {
        derivationProductSkus = [];
        derivationSkuMrpBySkuId = new Map();
        populateDerivationReferenceSkuOptions(null);
      }
      updateDerivationReferenceMrpDisplay();
    } catch (err) {
      setDerivationModalError(
        err?.message
          ? `Failed to load Reference Pack SKUs: ${err.message}`
          : "Failed to load Reference Pack SKUs.",
      );
      handleError("Failed to load Reference Pack SKUs", err);
    }

    syncDerivationEffectiveDateState();
    setDerivationSaveState();
    setTimeout(() => {
      if (mode === "create" && dom.derivationPolicyEditProduct) {
        dom.derivationPolicyEditProduct.focus();
      } else {
        dom.derivationPolicyEditReferenceSku?.focus();
      }
    }, 0);
  }

  function closeDerivationPolicyEditModal() {
    if (!dom.derivationPolicyEditModal) return;
    finishDerivationPolicyConfirmation(false);
    closeFuturePolicyConfirmation({ restoreFocus: false, force: true });

    const active = document.activeElement;
    if (active && dom.derivationPolicyEditModal.contains(active)) {
      active.blur();
    }

    dom.derivationPolicyEditModal.classList.add("hidden");
    dom.derivationPolicyEditModal.setAttribute("aria-hidden", "true");
    setDerivationModalError("");

    const returnTarget =
      derivationPolicyReturnFocus &&
      derivationPolicyReturnFocus !== document.body &&
      document.contains(derivationPolicyReturnFocus)
        ? derivationPolicyReturnFocus
        : dom.drawerClose;

    derivationPolicyEditRow = null;
    derivationPolicyEditProductId = null;
    derivationPolicyEditMode = "create";
    derivationPolicyReturnFocus = null;
    derivationPolicySaving = false;
    derivationProductSkus = [];
    derivationSkuMrpBySkuId = new Map();

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  function finishDerivationPolicyConfirmation(confirmed) {
    if (!derivationPolicyConfirmResolver) return;
    const resolve = derivationPolicyConfirmResolver;
    derivationPolicyConfirmResolver = null;
    dom.derivationPolicyConfirmModal?.classList.add("hidden");
    dom.derivationPolicyConfirmModal?.setAttribute("aria-hidden", "true");
    if (
      !dom.derivationPolicyEditModal?.classList.contains("hidden") &&
      dom.derivationPolicyEditConfirmBtn
    ) {
      setTimeout(() => dom.derivationPolicyEditConfirmBtn.focus(), 0);
    }
    resolve(confirmed === true);
  }

  function requestDerivationPolicyConfirmation() {
    if (
      !dom.derivationPolicyConfirmModal ||
      !dom.derivationPolicyConfirmProceedBtn
    ) {
      return Promise.resolve(false);
    }
    finishDerivationPolicyConfirmation(false);
    return new Promise((resolve) => {
      derivationPolicyConfirmResolver = resolve;
      dom.derivationPolicyConfirmModal.classList.remove("hidden");
      dom.derivationPolicyConfirmModal.setAttribute("aria-hidden", "false");
      setTimeout(() => dom.derivationPolicyConfirmProceedBtn.focus(), 0);
    });
  }

  async function onDerivationProductChange() {
    if (derivationPolicyEditMode !== "create") return;
    const productId = dom.derivationPolicyEditProduct?.value || "";
    derivationPolicyEditProductId = productId || null;
    setDerivationModalError("");
    if (!productId) {
      derivationProductSkus = [];
      derivationSkuMrpBySkuId = new Map();
      populateDerivationReferenceSkuOptions(null);
      updateDerivationReferenceMrpDisplay();
      setDerivationSaveState();
      return;
    }
    if (dom.derivationPolicyEditRefMrpDisplay) {
      dom.derivationPolicyEditRefMrpDisplay.innerHTML = `<div class="cp-muted-text">Loading Reference Pack SKUs…</div>`;
    }
    try {
      await loadDerivationProductSkus(productId);
      populateDerivationReferenceSkuOptions(null);
      updateDerivationReferenceMrpDisplay();
    } catch (err) {
      setDerivationModalError(
        err?.message
          ? `Failed to load Reference Pack SKUs: ${err.message}`
          : "Failed to load Reference Pack SKUs.",
      );
      handleError("Failed to load Reference Pack SKUs", err);
    }
    setDerivationSaveState();
  }

  async function saveDerivationPolicy(confirmPolicy) {
    if (!requireEditAccess("save Product MRP derivation policy")) return;
    if (derivationPolicySaving || futurePolicySubmissionRunning) return;

    const validation = validateDerivationForm();
    if (!validation.ok) {
      setDerivationModalError(validation.message);
      setDerivationSaveState();
      return;
    }
    const { values } = validation;

    if (classifyEffectiveDate(values.effectiveFrom) === "SCHEDULED_FUTURE") {
      openFuturePolicyConfirmation({
        type: "PRODUCT_DERIVATION",
        outcome: confirmPolicy ? "CONFIRMED" : "DRAFT",
        summary: buildDerivationFuturePolicySummary(validation, confirmPolicy),
        returnFocus: confirmPolicy
          ? dom.derivationPolicyEditConfirmBtn
          : dom.derivationPolicyEditDraftBtn,
        execute: () => executeDerivationPolicy(validation, confirmPolicy),
      });
      return;
    }

    if (confirmPolicy) {
      const confirmed = await requestDerivationPolicyConfirmation();
      if (!confirmed) return;
    }

    await executeDerivationPolicy(validation, confirmPolicy);
  }

  function buildDerivationFuturePolicySummary(validation, confirmPolicy) {
    const values = validation.values;
    const row = derivationPolicyEditRow;
    const selectedOption =
      dom.derivationPolicyEditReferenceSku?.selectedOptions?.[0];
    return [
      ["Policy type", "Product MRP Derivation"],
      [
        "Product",
        row?.product_name ||
          dom.derivationPolicyEditProduct?.selectedOptions?.[0]?.textContent ||
          "--",
      ],
      [
        "Reference SKU",
        selectedOption?.textContent?.trim() ||
          (values.referenceSkuId ? `SKU ${values.referenceSkuId}` : "--"),
      ],
      ["Effective date", formatDate(values.effectiveFrom)],
      [
        "Current policy remains effective through",
        formatDate(addDaysIsoIst(values.effectiveFrom, -1)),
      ],
      [
        "Key derivation values",
        `Larger ${formatPercent(values.largerPctUi)} · Smaller ${formatPercent(values.smallerPctUi)} · Ceiling ${formatOptionalMoney(values.ceilingIncrement)}`,
      ],
      ["Submission outcome", confirmPolicy ? "CONFIRMED" : "DRAFT"],
    ];
  }

  async function executeDerivationPolicy(validation, confirmPolicy) {
    if (!requireEditAccess("save Product MRP derivation policy")) return false;
    if (derivationPolicySaving) return false;
    const { values } = validation;
    derivationPolicySaving = true;
    setDerivationSaveState();
    setDerivationModalError("");
    setLoadingMask(
      true,
      confirmPolicy
        ? "Confirming derivation policy..."
        : "Saving derivation policy draft...",
    );

    try {
      const { error } = await costingRpc(
        "rpc_set_product_mrp_derivation_policy",
        {
          p_product_id: Number(values.productId),
          p_reference_sku_id: Number(values.referenceSkuId),
          p_smaller_pack_adjustment_pct: decimalFromUiPct(values.smallerPctUi),
          p_larger_pack_adjustment_pct: decimalFromUiPct(values.largerPctUi),
          p_ceiling_increment: values.ceilingIncrement,
          p_effective_from: values.effectiveFrom,
          p_reason: values.reason,
          p_approval_reference: values.approvalReference,
          p_confirm_policy: confirmPolicy === true,
        },
      );

      if (error) throw error;

      closeDerivationPolicyEditModal();
      showToast(
        confirmPolicy
          ? "Derivation policy confirmed."
          : "Derivation policy draft saved.",
        "success",
        4200,
      );
      await onPolicyDataChanged({
        drawerTab: "policy-detail",
        skuId: null,
        productId: Number(values.productId),
      });
      return true;
    } catch (err) {
      const message = err?.message
        ? `Failed to save derivation policy: ${err.message}`
        : "Failed to save derivation policy.";
      setDerivationModalError(message);
      handleError("Failed to save derivation policy", err);
      return false;
    } finally {
      derivationPolicySaving = false;
      setLoadingMask(false);
      setDerivationSaveState();
    }
  }

  function setScheduledPolicyCancellationError(message) {
    if (!dom.scheduledPolicyCancelError) return;
    dom.scheduledPolicyCancelError.hidden = !message;
    dom.scheduledPolicyCancelError.textContent = message || "";
  }

  function buildScheduledPolicyCancellationSummary(context) {
    const row = context.row;
    if (context.type === "SKU_MRP") {
      return [
        ["Product", row.product_name || "--"],
        [
          "SKU / pack",
          [
            row.sku_id != null ? `SKU ${row.sku_id}` : "",
            formatMrpPackLabel(row),
          ]
            .filter(Boolean)
            .join(" · "),
        ],
        ["IK MRP", formatOptionalMoney(row.mrp_ik)],
        ["OK MRP", formatOptionalMoney(row.mrp_ok)],
        ["Effective from", formatDate(row.effective_from)],
        [
          "Lifecycle status",
          formatMrpLifecycleLabel(row.lifecycle_label || row.status),
        ],
        ["Policy ID", row.policy_id],
      ];
    }
    return [
      ["Product", row.product_name || "--"],
      [
        "Reference SKU / pack",
        [
          row.reference_sku_id != null ? `SKU ${row.reference_sku_id}` : "",
          formatDerivationPackLabel(row),
        ]
          .filter(Boolean)
          .join(" · "),
      ],
      [
        "Larger-pack adjustment",
        formatSignedRatioPercent(row.larger_pack_adjustment_pct),
      ],
      [
        "Smaller-pack adjustment",
        formatSignedRatioPercent(row.smaller_pack_adjustment_pct),
      ],
      ["Ceiling increment", formatOptionalMoney(row.ceiling_increment)],
      ["Effective from", formatDate(row.effective_from)],
      ["Lifecycle status", formatDerivationLifecycle(row)],
      ["Derivation Policy ID", row.derivation_policy_id],
    ];
  }

  function setScheduledPolicyCancellationState() {
    const reason = dom.scheduledPolicyCancelReason?.value?.trim() || "";
    const lockFields =
      scheduledPolicyCancellationSaving || scheduledPolicyCancellationCompleted;
    if (dom.scheduledPolicyCancelReason) {
      dom.scheduledPolicyCancelReason.disabled = lockFields;
    }
    if (dom.scheduledPolicyCancelApprovalReference) {
      dom.scheduledPolicyCancelApprovalReference.disabled = lockFields;
    }
    if (dom.scheduledPolicyCancelReasonError) {
      dom.scheduledPolicyCancelReasonError.hidden =
        !scheduledPolicyCancellationReasonTouched || !!reason;
    }
    if (dom.scheduledPolicyCancelCloseBtn) {
      dom.scheduledPolicyCancelCloseBtn.disabled =
        scheduledPolicyCancellationSaving;
    }
    if (dom.scheduledPolicyCancelKeepBtn) {
      dom.scheduledPolicyCancelKeepBtn.disabled =
        scheduledPolicyCancellationSaving;
      dom.scheduledPolicyCancelKeepBtn.textContent =
        scheduledPolicyCancellationCompleted
          ? "Close"
          : "Keep Scheduled Policy";
    }
    if (dom.scheduledPolicyCancelProceedBtn) {
      dom.scheduledPolicyCancelProceedBtn.disabled =
        !canEditPolicyActions() ||
        scheduledPolicyCancellationSaving ||
        scheduledPolicyCancellationCompleted ||
        !reason;
    }
  }

  function openScheduledPolicyCancellationModal(context) {
    if (!requireEditAccess("cancel scheduled policies")) return;
    if (!dom.scheduledPolicyCancelModal || !context?.row) return;
    const eligible =
      context.type === "SKU_MRP"
        ? isScheduledSkuMrpPolicy(context.row)
        : context.type === "PRODUCT_DERIVATION"
          ? isScheduledDerivationPolicy(context.row)
          : false;
    if (!eligible || !isValidPolicyId(context.id)) {
      showToast(
        "This policy is not eligible for scheduled cancellation.",
        "error",
        4200,
      );
      return;
    }
    scheduledPolicyCancellationContext = {
      type: context.type,
      id: Number(context.id),
      row: context.row,
    };
    scheduledPolicyCancellationReturnFocus = document.activeElement;
    scheduledPolicyCancellationSaving = false;
    scheduledPolicyCancellationCompleted = false;
    scheduledPolicyCancellationReasonTouched = false;
    setScheduledPolicyCancellationError("");
    if (dom.scheduledPolicyCancelSummary) {
      dom.scheduledPolicyCancelSummary.innerHTML = renderPolicySummaryItems(
        buildScheduledPolicyCancellationSummary(
          scheduledPolicyCancellationContext,
        ),
      );
    }
    if (dom.scheduledPolicyCancelReason) {
      dom.scheduledPolicyCancelReason.value = "";
    }
    if (dom.scheduledPolicyCancelApprovalReference) {
      dom.scheduledPolicyCancelApprovalReference.value = "";
    }
    setScheduledPolicyCancellationState();
    dom.scheduledPolicyCancelModal.classList.remove("hidden");
    dom.scheduledPolicyCancelModal.setAttribute("aria-hidden", "false");
    setTimeout(() => dom.scheduledPolicyCancelReason?.focus(), 0);
  }

  function closeScheduledPolicyCancellationModal() {
    if (scheduledPolicyCancellationSaving) return false;
    if (!dom.scheduledPolicyCancelModal) return true;
    dom.scheduledPolicyCancelModal.classList.add("hidden");
    dom.scheduledPolicyCancelModal.setAttribute("aria-hidden", "true");
    setScheduledPolicyCancellationError("");
    const returnFocus = scheduledPolicyCancellationReturnFocus;
    scheduledPolicyCancellationContext = null;
    scheduledPolicyCancellationReturnFocus = null;
    scheduledPolicyCancellationCompleted = false;
    scheduledPolicyCancellationReasonTouched = false;
    if (returnFocus && typeof returnFocus.focus === "function") {
      setTimeout(() => returnFocus.focus(), 0);
    }
    return true;
  }

  async function refreshPricingPolicyDataAfterMutation(context) {
    if (context.type === "SKU_MRP") {
      invalidateMrpPolicyCache(context.row?.sku_id);
      await onPolicyDataChanged({
        drawerTab: "policy-detail",
        skuId: context.row?.sku_id,
      });
      return;
    }
    await onPolicyDataChanged({
      drawerTab: "policy-detail",
      skuId: null,
      productId: context.row?.product_id,
    });
  }

  async function submitScheduledPolicyCancellation() {
    if (!requireEditAccess("cancel scheduled policies")) return;
    if (
      scheduledPolicyCancellationSaving ||
      scheduledPolicyCancellationCompleted
    ) {
      return;
    }
    const context = scheduledPolicyCancellationContext;
    const eligible =
      context?.type === "SKU_MRP"
        ? isScheduledSkuMrpPolicy(context.row)
        : context?.type === "PRODUCT_DERIVATION"
          ? isScheduledDerivationPolicy(context.row)
          : false;
    if (!context || !eligible || !isValidPolicyId(context.id)) {
      setScheduledPolicyCancellationError(
        "This policy is no longer eligible for scheduled cancellation.",
      );
      return;
    }
    const reason = dom.scheduledPolicyCancelReason?.value?.trim() || "";
    scheduledPolicyCancellationReasonTouched = true;
    if (!reason) {
      setScheduledPolicyCancellationState();
      return;
    }
    const approvalReference =
      dom.scheduledPolicyCancelApprovalReference?.value?.trim() || null;
    scheduledPolicyCancellationSaving = true;
    setScheduledPolicyCancellationError("");
    setScheduledPolicyCancellationState();
    setLoadingMask(true, "Cancelling scheduled policy...");

    try {
      let response;
      if (context.type === "SKU_MRP") {
        response = await costingRpc("rpc_cancel_scheduled_sku_mrp_policy", {
          p_policy_id: context.id,
          p_cancellation_reason: reason,
          p_cancellation_approval_reference: approvalReference || null,
        });
      } else {
        response = await costingRpc(
          "rpc_cancel_scheduled_product_mrp_derivation_policy",
          {
            p_derivation_policy_id: context.id,
            p_cancellation_reason: reason,
            p_cancellation_approval_reference: approvalReference || null,
          },
        );
      }
      if (response?.error) throw response.error;
      scheduledPolicyCancellationCompleted = true;

      try {
        await refreshPricingPolicyDataAfterMutation(context);
      } catch (refreshError) {
        const message =
          "The scheduled policy was cancelled successfully, but refreshed policy data could not be loaded.";
        setScheduledPolicyCancellationError(message);
        showToast(message, "error", 6200);
        handleError("Failed to refresh policy data after cancellation", refreshError);
        return;
      }

      scheduledPolicyCancellationSaving = false;
      closeScheduledPolicyCancellationModal();
      showToast("Scheduled policy cancelled.", "success", 4200);
    } catch (err) {
      setScheduledPolicyCancellationError(
        err?.message || "Failed to cancel the scheduled policy.",
      );
      handleError("Failed to cancel scheduled policy", err);
    } finally {
      scheduledPolicyCancellationSaving = false;
      setLoadingMask(false);
      setScheduledPolicyCancellationState();
    }
  }

  function openDerivationCreateModalFromToolbar() {
    if (!requireEditAccess("create Product MRP derivation policy")) return;
    void openDerivationPolicyEditModal({ row: null, mode: "create" });
  }

  async function loadSchemeOptions() {
    const { data, error } = await costingFrom(
      "v_costing_policy_manager_scheme_options",
    )
      .select("*")
      .order("paid_qty", { ascending: true })
      .order("free_qty", { ascending: true })
      .order("scheme_name", { ascending: true });

    if (error) throw error;
    schemeOptions = data || [];
  }

  async function loadSchemeRuleScopeOptions() {
    schemeRuleScopeOptions = await fetchAllRows(
      () =>
        costingFrom("v_costing_scheme_policy_scope_options")
          .select("*")
          .order("policy_scope", { ascending: true })
          .order("display_name", { ascending: true }),
      1000,
    );
  }

  async function loadOptions() {
    await loadSchemeOptions();
    await loadSchemeRuleScopeOptions();
  }

  function schemeMasterRowValue(row, keys, fallback = null) {
    for (const key of keys) {
      const value = row?.[key];
      if (value !== null && value !== undefined && value !== "") {
        return value;
      }
    }
    return fallback;
  }

  function schemeMasterRowNumber(row, keys) {
    const raw = schemeMasterRowValue(row, keys, null);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function schemeMasterRowBool(row, key) {
    return row?.[key] === true;
  }

  function formatSchemeQty(value) {
    if (value === null || value === undefined || value === "") return "--";
    const n = Number(value);
    if (!Number.isFinite(n)) return text(value);
    if (Number.isInteger(n)) return String(n);
    return String(parseFloat(n.toFixed(4)));
  }

  function computeEffectiveFreeDiscountPct(paidQty, freeQty) {
    const paid = Number(paidQty);
    const free = Number(freeQty);
    if (!Number.isFinite(paid) || paid <= 0) return null;
    if (!Number.isFinite(free) || free < 0) return null;
    const total = paid + free;
    if (total <= 0) return null;
    return (free / total) * 100;
  }

  function formatEffectiveFreeDiscountPct(value) {
    if (value === null || value === undefined || value === "") return "--";
    const n = Number(value);
    if (!Number.isFinite(n)) return text(value);
    return `${n.toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    })}%`;
  }

  function schemeMasterEffectiveDiscount(row) {
    const fromView = schemeMasterRowNumber(row, [
      "effective_free_discount_pct",
      "effective_free_discount_percent",
    ]);
    if (fromView !== null) return fromView;
    const paid = schemeMasterRowNumber(row, ["paid_qty"]);
    const free = schemeMasterRowNumber(row, ["free_qty"]);
    return computeEffectiveFreeDiscountPct(paid, free);
  }

  function schemeMasterTotalQty(row) {
    const fromView = schemeMasterRowNumber(row, ["total_qty"]);
    if (fromView !== null) return fromView;
    const paid = schemeMasterRowNumber(row, ["paid_qty"]);
    const free = schemeMasterRowNumber(row, ["free_qty"]);
    if (paid === null && free === null) return null;
    return (paid || 0) + (free || 0);
  }

  function formatSchemeStructure(paidQty, freeQty) {
    return `${formatSchemeQty(paidQty)} + ${formatSchemeQty(freeQty)}`;
  }

  function schemeMasterStatusLabel(row) {
    const explicit = String(
      schemeMasterRowValue(row, ["scheme_status", "status"], ""),
    )
      .trim()
      .toUpperCase();
    if (explicit === "ACTIVE" || explicit === "INACTIVE") return explicit;
    if (row?.is_active === true) return "ACTIVE";
    if (row?.is_active === false) return "INACTIVE";
    return "--";
  }

  function schemeMasterTypeLabel(row) {
    return String(
      schemeMasterRowValue(row, ["scheme_type", "master_type"], "--"),
    )
      .trim()
      .toUpperCase() || "--";
  }

  function schemeMasterStatusChip(row) {
    const status = schemeMasterStatusLabel(row);
    if (status === "ACTIVE") return statusChip("ACTIVE");
    if (status === "INACTIVE") return statusChip("INACTIVE");
    return text(status);
  }

  function schemeMasterTypeBadge(row) {
    const type = schemeMasterTypeLabel(row);
    if (type === "SYSTEM") {
      return `${statusChip("SYSTEM")}<div class="cp-muted-text">System-defined</div>`;
    }
    if (type === "STANDARD") return statusChip("STANDARD");
    return text(type);
  }

  function schemeMasterDisplayName(row) {
    const name = schemeMasterRowValue(row, ["scheme_name", "display_name"], "--");
    const paid = schemeMasterRowNumber(row, ["paid_qty"]);
    const free = schemeMasterRowNumber(row, ["free_qty"]);
    if (paid === null && free === null) return text(name);
    return `${text(name)}<div class="cp-muted-text">${formatSchemeStructure(paid, free)}</div>`;
  }

  function schemeMasterIdentityPlainText(row) {
    const name = schemeMasterRowValue(row, ["scheme_name"], "--");
    const paid = schemeMasterRowNumber(row, ["paid_qty"]);
    const free = schemeMasterRowNumber(row, ["free_qty"]);
    const total = schemeMasterTotalQty(row);
    const discount = schemeMasterEffectiveDiscount(row);
    return `${name} · ${formatSchemeStructure(paid, free)} (total ${formatSchemeQty(total)}) · ${formatEffectiveFreeDiscountPct(discount)}`;
  }

  function schemeMasterIdentityText(row) {
    return schemeMasterIdentityPlainText(row);
  }

  function formatSchemeMasterEventLabel(eventType) {
    const key = String(eventType || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");
    if (key === "BASELINE") {
      return "Baseline — migration baseline, not original creation evidence";
    }
    const labels = {
      CREATED: "Created",
      METADATA_CORRECTED: "Metadata Corrected",
      DEACTIVATED: "Deactivated",
      REACTIVATED: "Reactivated",
    };
    return labels[key] || text(eventType);
  }

  function formatSchemeMasterActiveState(value) {
    if (value === true || String(value).toUpperCase() === "ACTIVE") {
      return "ACTIVE";
    }
    if (value === false || String(value).toUpperCase() === "INACTIVE") {
      return "INACTIVE";
    }
    if (value === null || value === undefined || value === "") return "--";
    return text(value);
  }

  function setSchemeMasterModalError(el, message) {
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
  }

  async function refreshSchemeAssignmentOptions() {
    await loadSchemeOptions();
    populateSchemePolicySchemeOptions();
    populateSchemeRuleSchemeOptions();
  }

  async function afterSchemeMasterMutation({ refreshHistory = false } = {}) {
    await refreshSchemeAssignmentOptions();
    await reloadRows();
    if (typeof refreshOpenDrawerIfNeeded === "function") {
      await refreshOpenDrawerIfNeeded();
    }
    if (
      refreshHistory &&
      schemeMasterHistoryRow?.scheme_id &&
      !dom.schemeMasterHistoryModal?.classList.contains("hidden")
    ) {
      await renderSchemeMasterHistoryContent(schemeMasterHistoryRow);
    }
  }

  function computeSchemeCreatePreview() {
    const name = dom.schemeMasterCreateName?.value?.trim() || "";
    const paidQty = numberOrNullFromInput(dom.schemeMasterCreatePaidQty);
    const freeQty = numberOrNullFromInput(dom.schemeMasterCreateFreeQty);
    const freeQtyValue = freeQty === null ? 0 : freeQty;

    if (!name) {
      return { valid: false, message: "Enter a scheme name to preview." };
    }
    if (!Number.isFinite(paidQty) || paidQty <= 0) {
      return { valid: false, message: "Enter paid quantity greater than zero." };
    }
    if (!Number.isFinite(freeQtyValue) || freeQtyValue < 0) {
      return {
        valid: false,
        message: "Enter free quantity zero or greater.",
      };
    }

    const totalQty = paidQty + freeQtyValue;
    const discount = computeEffectiveFreeDiscountPct(paidQty, freeQtyValue);
    const structure = formatSchemeStructure(paidQty, freeQtyValue);

    return {
      valid: true,
      displayName: `${name} (${structure.replace(" + ", "+")})`,
      structure,
      totalQty,
      discount,
    };
  }

  function renderSchemeCreatePreviewHtml(preview) {
    if (!preview?.valid) {
      return `<div class="cp-muted-text">${text(preview?.message || "Enter values to see a preview.")}</div>`;
    }
    return `
      <div class="cp-preview-row"><span>Display Name</span><span class="cp-preview-value">${text(preview.displayName)}</span></div>
      <div class="cp-preview-row"><span>Paid + Free</span><span class="cp-preview-value">${text(preview.structure)}</span></div>
      <div class="cp-preview-row"><span>Total Quantity</span><span class="cp-preview-value">${formatSchemeQty(preview.totalQty)}</span></div>
      <div class="cp-preview-row"><span>Effective Free Discount %</span><span class="cp-preview-value">${formatEffectiveFreeDiscountPct(preview.discount)}</span></div>
    `;
  }

  function updateSchemeCreatePreview() {
    if (!dom.schemeMasterCreatePreview) return;
    const preview = computeSchemeCreatePreview();
    dom.schemeMasterCreatePreview.innerHTML = `
      <div class="cp-card-label">Preview</div>
      ${renderSchemeCreatePreviewHtml(preview)}
    `;
    setSchemeMasterCreateSaveState();
  }

  function setSchemeMasterCreateSaveState() {
    if (!dom.schemeMasterCreateSaveBtn) return;
    if (!canEditPolicyActions() || schemeMasterSaving) {
      dom.schemeMasterCreateSaveBtn.disabled = true;
      return;
    }
    const preview = computeSchemeCreatePreview();
    dom.schemeMasterCreateSaveBtn.disabled = !preview.valid;
  }

  function openSchemeMasterCreateModal() {
    if (!requireEditAccess("create schemes")) return;
    if (!dom.schemeMasterCreateModal) return;

    schemeMasterReturnFocus = document.activeElement;
    setSchemeMasterModalError(dom.schemeMasterCreateError, "");

    if (dom.schemeMasterCreateName) dom.schemeMasterCreateName.value = "";
    if (dom.schemeMasterCreatePaidQty) dom.schemeMasterCreatePaidQty.value = "";
    if (dom.schemeMasterCreateFreeQty) dom.schemeMasterCreateFreeQty.value = "0";
    if (dom.schemeMasterCreateRemarks) dom.schemeMasterCreateRemarks.value = "";
    if (dom.schemeMasterCreateApprovalReference) {
      dom.schemeMasterCreateApprovalReference.value = "";
    }

    updateSchemeCreatePreview();
    dom.schemeMasterCreateModal.classList.remove("hidden");
    dom.schemeMasterCreateModal.setAttribute("aria-hidden", "false");
    setTimeout(() => dom.schemeMasterCreateName?.focus(), 0);
  }

  function closeSchemeMasterCreateModal() {
    if (!dom.schemeMasterCreateModal) return;
    dom.schemeMasterCreateModal.classList.add("hidden");
    dom.schemeMasterCreateModal.setAttribute("aria-hidden", "true");
    setSchemeMasterModalError(dom.schemeMasterCreateError, "");
    const returnTarget = schemeMasterReturnFocus;
    schemeMasterReturnFocus = null;
    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  async function saveSchemeMasterCreate() {
    if (!requireEditAccess("create schemes")) return;

    const preview = computeSchemeCreatePreview();
    if (!preview.valid) {
      setSchemeMasterModalError(
        dom.schemeMasterCreateError,
        preview.message || "Create form is invalid.",
      );
      setSchemeMasterCreateSaveState();
      return;
    }

    const paidQty = numberOrNullFromInput(dom.schemeMasterCreatePaidQty);
    const freeQty = numberOrNullFromInput(dom.schemeMasterCreateFreeQty);
    const remarks = dom.schemeMasterCreateRemarks?.value?.trim() || null;
    const approvalReference =
      dom.schemeMasterCreateApprovalReference?.value?.trim() || null;

    schemeMasterSaving = true;
    if (dom.schemeMasterCreateSaveBtn) dom.schemeMasterCreateSaveBtn.disabled = true;
    setSchemeMasterModalError(dom.schemeMasterCreateError, "");
    setLoadingMask(true, "Creating scheme...");

    try {
      const { error } = await costingRpc("rpc_create_scheme_master", {
        p_scheme_name: dom.schemeMasterCreateName?.value?.trim(),
        p_paid_qty: paidQty,
        p_free_qty: freeQty === null ? 0 : freeQty,
        p_remarks: remarks,
        p_approval_reference: approvalReference,
      });
      if (error) throw error;

      closeSchemeMasterCreateModal();
      showToast("Scheme created.", "success", 4200);
      setPolicyManagerTab("scheme-master");
      await afterSchemeMasterMutation();
    } catch (err) {
      const message = err?.message
        ? `Failed to create scheme: ${err.message}`
        : "Failed to create scheme.";
      setSchemeMasterModalError(dom.schemeMasterCreateError, message);
      handleError("Failed to create scheme", err);
    } finally {
      schemeMasterSaving = false;
      setLoadingMask(false);
      setSchemeMasterCreateSaveState();
    }
  }

  function openSchemeMasterMetadataModal(row) {
    if (!requireEditAccess("correct scheme metadata")) return;
    if (!row?.scheme_id) {
      showToast("Scheme ID missing for selected row.", "error");
      return;
    }
    if (!schemeMasterRowBool(row, "can_edit_metadata")) {
      showToast("This scheme cannot be edited.", "error");
      return;
    }
    if (!dom.schemeMasterMetadataModal) return;

    schemeMasterMetadataRow = row;
    schemeMasterReturnFocus = document.activeElement;
    setSchemeMasterModalError(dom.schemeMasterMetadataError, "");

    if (dom.schemeMasterMetadataStructure) {
      dom.schemeMasterMetadataStructure.textContent = schemeMasterIdentityText(row);
    }
    if (dom.schemeMasterMetadataName) {
      dom.schemeMasterMetadataName.value = row.scheme_name || "";
    }
    if (dom.schemeMasterMetadataRemarks) {
      dom.schemeMasterMetadataRemarks.value = row.remarks || "";
    }
    if (dom.schemeMasterMetadataReason) dom.schemeMasterMetadataReason.value = "";
    if (dom.schemeMasterMetadataApprovalReference) {
      dom.schemeMasterMetadataApprovalReference.value = "";
    }

    setSchemeMasterMetadataSaveState();
    dom.schemeMasterMetadataModal.classList.remove("hidden");
    dom.schemeMasterMetadataModal.setAttribute("aria-hidden", "false");
    setTimeout(() => dom.schemeMasterMetadataName?.focus(), 0);
  }

  function closeSchemeMasterMetadataModal() {
    if (!dom.schemeMasterMetadataModal) return;
    dom.schemeMasterMetadataModal.classList.add("hidden");
    dom.schemeMasterMetadataModal.setAttribute("aria-hidden", "true");
    setSchemeMasterModalError(dom.schemeMasterMetadataError, "");
    schemeMasterMetadataRow = null;
    const returnTarget = schemeMasterReturnFocus;
    schemeMasterReturnFocus = null;
    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  function setSchemeMasterMetadataSaveState() {
    if (!dom.schemeMasterMetadataSaveBtn) return;
    if (!canEditPolicyActions() || schemeMasterSaving) {
      dom.schemeMasterMetadataSaveBtn.disabled = true;
      return;
    }
    const name = dom.schemeMasterMetadataName?.value?.trim() || "";
    const reason = dom.schemeMasterMetadataReason?.value?.trim() || "";
    dom.schemeMasterMetadataSaveBtn.disabled = !(name && reason);
  }

  async function saveSchemeMasterMetadata() {
    if (!requireEditAccess("correct scheme metadata")) return;
    const row = schemeMasterMetadataRow;
    if (!row?.scheme_id) {
      showToast("Scheme ID missing for selected row.", "error");
      return;
    }
    if (!schemeMasterRowBool(row, "can_edit_metadata")) {
      showToast("This scheme cannot be edited.", "error");
      return;
    }

    const name = dom.schemeMasterMetadataName?.value?.trim() || "";
    const reason = dom.schemeMasterMetadataReason?.value?.trim() || "";
    if (!name || !reason) {
      setSchemeMasterModalError(
        dom.schemeMasterMetadataError,
        "Scheme name and correction reason are required.",
      );
      setSchemeMasterMetadataSaveState();
      return;
    }

    schemeMasterSaving = true;
    if (dom.schemeMasterMetadataSaveBtn) {
      dom.schemeMasterMetadataSaveBtn.disabled = true;
    }
    setSchemeMasterModalError(dom.schemeMasterMetadataError, "");
    setLoadingMask(true, "Saving scheme metadata...");

    try {
      const { error } = await costingRpc("rpc_update_scheme_master_metadata", {
        p_scheme_id: row.scheme_id,
        p_scheme_name: name,
        p_remarks: dom.schemeMasterMetadataRemarks?.value?.trim() || null,
        p_reason: reason,
        p_approval_reference:
          dom.schemeMasterMetadataApprovalReference?.value?.trim() || null,
      });
      if (error) throw error;

      closeSchemeMasterMetadataModal();
      showToast("Scheme metadata corrected.", "success", 4200);
      setPolicyManagerTab("scheme-master");
      await afterSchemeMasterMutation({ refreshHistory: true });
    } catch (err) {
      const message = err?.message
        ? `Failed to save scheme metadata: ${err.message}`
        : "Failed to save scheme metadata.";
      setSchemeMasterModalError(dom.schemeMasterMetadataError, message);
      handleError("Failed to save scheme metadata", err);
    } finally {
      schemeMasterSaving = false;
      setLoadingMask(false);
      setSchemeMasterMetadataSaveState();
    }
  }

  function openSchemeMasterDeactivateModal(row) {
    if (!requireEditAccess("deactivate schemes")) return;
    if (!row?.scheme_id) {
      showToast("Scheme ID missing for selected row.", "error");
      return;
    }
    if (!schemeMasterRowBool(row, "can_deactivate")) {
      showToast("This scheme cannot be deactivated.", "error");
      return;
    }
    if (!dom.schemeMasterDeactivateModal) return;

    schemeMasterDeactivateRow = row;
    schemeMasterReturnFocus = document.activeElement;
    setSchemeMasterModalError(dom.schemeMasterDeactivateError, "");

    if (dom.schemeMasterDeactivateIdentity) {
      dom.schemeMasterDeactivateIdentity.textContent = schemeMasterIdentityText(row);
    }
    if (dom.schemeMasterDeactivateDirectPolicies) {
      dom.schemeMasterDeactivateDirectPolicies.textContent = formatSchemeQty(
        schemeMasterRowNumber(row, [
          "active_direct_policies",
          "active_direct_policy_count",
        ]),
      );
    }
    if (dom.schemeMasterDeactivateHierarchyRules) {
      dom.schemeMasterDeactivateHierarchyRules.textContent = formatSchemeQty(
        schemeMasterRowNumber(row, [
          "active_hierarchy_rules",
          "active_hierarchy_rule_count",
        ]),
      );
    }
    if (dom.schemeMasterDeactivateReplacementRefs) {
      dom.schemeMasterDeactivateReplacementRefs.textContent = formatSchemeQty(
        schemeMasterRowNumber(row, [
          "active_replacement_references",
          "active_replacement_reference_count",
        ]),
      );
    }
    if (dom.schemeMasterDeactivateReason) {
      dom.schemeMasterDeactivateReason.value = "";
    }
    if (dom.schemeMasterDeactivateApprovalReference) {
      dom.schemeMasterDeactivateApprovalReference.value = "";
    }

    setSchemeMasterDeactivateSaveState();
    dom.schemeMasterDeactivateModal.classList.remove("hidden");
    dom.schemeMasterDeactivateModal.setAttribute("aria-hidden", "false");
    setTimeout(() => dom.schemeMasterDeactivateReason?.focus(), 0);
  }

  function closeSchemeMasterDeactivateModal() {
    if (!dom.schemeMasterDeactivateModal) return;
    dom.schemeMasterDeactivateModal.classList.add("hidden");
    dom.schemeMasterDeactivateModal.setAttribute("aria-hidden", "true");
    setSchemeMasterModalError(dom.schemeMasterDeactivateError, "");
    schemeMasterDeactivateRow = null;
    const returnTarget = schemeMasterReturnFocus;
    schemeMasterReturnFocus = null;
    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  function setSchemeMasterDeactivateSaveState() {
    if (!dom.schemeMasterDeactivateSaveBtn) return;
    if (!canEditPolicyActions() || schemeMasterSaving) {
      dom.schemeMasterDeactivateSaveBtn.disabled = true;
      return;
    }
    const reason = dom.schemeMasterDeactivateReason?.value?.trim() || "";
    dom.schemeMasterDeactivateSaveBtn.disabled = !reason;
  }

  async function saveSchemeMasterDeactivate() {
    if (!requireEditAccess("deactivate schemes")) return;
    const row = schemeMasterDeactivateRow;
    if (!row?.scheme_id) {
      showToast("Scheme ID missing for selected row.", "error");
      return;
    }
    if (!schemeMasterRowBool(row, "can_deactivate")) {
      showToast("This scheme cannot be deactivated.", "error");
      return;
    }

    const reason = dom.schemeMasterDeactivateReason?.value?.trim() || "";
    if (!reason) {
      setSchemeMasterModalError(
        dom.schemeMasterDeactivateError,
        "Deactivation reason is required.",
      );
      setSchemeMasterDeactivateSaveState();
      return;
    }

    schemeMasterSaving = true;
    if (dom.schemeMasterDeactivateSaveBtn) {
      dom.schemeMasterDeactivateSaveBtn.disabled = true;
    }
    setSchemeMasterModalError(dom.schemeMasterDeactivateError, "");
    setLoadingMask(true, "Deactivating scheme...");

    try {
      const { error } = await costingRpc("rpc_deactivate_scheme_master", {
        p_scheme_id: row.scheme_id,
        p_reason: reason,
        p_approval_reference:
          dom.schemeMasterDeactivateApprovalReference?.value?.trim() || null,
      });
      if (error) throw error;

      closeSchemeMasterDeactivateModal();
      showToast("Scheme deactivated.", "success", 4200);
      setPolicyManagerTab("scheme-master");
      await afterSchemeMasterMutation({ refreshHistory: true });
    } catch (err) {
      const message = err?.message
        ? `Failed to deactivate scheme: ${err.message}`
        : "Failed to deactivate scheme.";
      setSchemeMasterModalError(dom.schemeMasterDeactivateError, message);
      handleError("Failed to deactivate scheme", err);
    } finally {
      schemeMasterSaving = false;
      setLoadingMask(false);
      setSchemeMasterDeactivateSaveState();
    }
  }

  function openSchemeMasterReactivateModal(row) {
    if (!requireEditAccess("reactivate schemes")) return;
    if (!row?.scheme_id) {
      showToast("Scheme ID missing for selected row.", "error");
      return;
    }
    if (!schemeMasterRowBool(row, "can_reactivate")) {
      showToast("This scheme cannot be reactivated.", "error");
      return;
    }
    if (!dom.schemeMasterReactivateModal) return;

    schemeMasterReactivateRow = row;
    schemeMasterReturnFocus = document.activeElement;
    setSchemeMasterModalError(dom.schemeMasterReactivateError, "");

    if (dom.schemeMasterReactivateIdentity) {
      dom.schemeMasterReactivateIdentity.textContent = schemeMasterIdentityText(row);
    }
    if (dom.schemeMasterReactivateReason) {
      dom.schemeMasterReactivateReason.value = "";
    }
    if (dom.schemeMasterReactivateApprovalReference) {
      dom.schemeMasterReactivateApprovalReference.value = "";
    }

    setSchemeMasterReactivateSaveState();
    dom.schemeMasterReactivateModal.classList.remove("hidden");
    dom.schemeMasterReactivateModal.setAttribute("aria-hidden", "false");
    setTimeout(() => dom.schemeMasterReactivateReason?.focus(), 0);
  }

  function closeSchemeMasterReactivateModal() {
    if (!dom.schemeMasterReactivateModal) return;
    dom.schemeMasterReactivateModal.classList.add("hidden");
    dom.schemeMasterReactivateModal.setAttribute("aria-hidden", "true");
    setSchemeMasterModalError(dom.schemeMasterReactivateError, "");
    schemeMasterReactivateRow = null;
    const returnTarget = schemeMasterReturnFocus;
    schemeMasterReturnFocus = null;
    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  function setSchemeMasterReactivateSaveState() {
    if (!dom.schemeMasterReactivateSaveBtn) return;
    if (!canEditPolicyActions() || schemeMasterSaving) {
      dom.schemeMasterReactivateSaveBtn.disabled = true;
      return;
    }
    const reason = dom.schemeMasterReactivateReason?.value?.trim() || "";
    dom.schemeMasterReactivateSaveBtn.disabled = !reason;
  }

  async function saveSchemeMasterReactivate() {
    if (!requireEditAccess("reactivate schemes")) return;
    const row = schemeMasterReactivateRow;
    if (!row?.scheme_id) {
      showToast("Scheme ID missing for selected row.", "error");
      return;
    }
    if (!schemeMasterRowBool(row, "can_reactivate")) {
      showToast("This scheme cannot be reactivated.", "error");
      return;
    }

    const reason = dom.schemeMasterReactivateReason?.value?.trim() || "";
    if (!reason) {
      setSchemeMasterModalError(
        dom.schemeMasterReactivateError,
        "Reactivation reason is required.",
      );
      setSchemeMasterReactivateSaveState();
      return;
    }

    schemeMasterSaving = true;
    if (dom.schemeMasterReactivateSaveBtn) {
      dom.schemeMasterReactivateSaveBtn.disabled = true;
    }
    setSchemeMasterModalError(dom.schemeMasterReactivateError, "");
    setLoadingMask(true, "Reactivating scheme...");

    try {
      const { error } = await costingRpc("rpc_reactivate_scheme_master", {
        p_scheme_id: row.scheme_id,
        p_reason: reason,
        p_approval_reference:
          dom.schemeMasterReactivateApprovalReference?.value?.trim() || null,
      });
      if (error) throw error;

      closeSchemeMasterReactivateModal();
      showToast("Scheme reactivated.", "success", 4200);
      setPolicyManagerTab("scheme-master");
      await afterSchemeMasterMutation({ refreshHistory: true });
    } catch (err) {
      const message = err?.message
        ? `Failed to reactivate scheme: ${err.message}`
        : "Failed to reactivate scheme.";
      setSchemeMasterModalError(dom.schemeMasterReactivateError, message);
      handleError("Failed to reactivate scheme", err);
    } finally {
      schemeMasterSaving = false;
      setLoadingMask(false);
      setSchemeMasterReactivateSaveState();
    }
  }

  async function fetchSchemeMasterAudit(schemeId) {
    const { data, error } = await costingFrom("v_costing_scheme_master_audit")
      .select("*")
      .eq("scheme_id", schemeId)
      .order("event_at", { ascending: false })
      .order("audit_event_id", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data || [];
  }

  async function renderSchemeMasterHistoryContent(row) {
    if (!dom.schemeMasterHistoryBody) return;

    dom.schemeMasterHistoryBody.innerHTML =
      `<div class="cp-muted-text">Loading history...</div>`;

    try {
      dom.schemeMasterHistoryBody.innerHTML =
        await buildSchemeMasterHistoryHtml(row);
    } catch (err) {
      dom.schemeMasterHistoryBody.innerHTML =
        `<div class="status">Failed to load history.</div>`;
      throw err;
    }
  }

  async function openSchemeMasterHistoryModal(row) {
    if (!row?.scheme_id) {
      showToast("Scheme ID missing for selected row.", "error");
      return;
    }
    if (!dom.schemeMasterHistoryModal) return;

    schemeMasterHistoryRow = row;
    schemeMasterReturnFocus = document.activeElement;

    if (dom.schemeMasterHistoryTitle) {
      dom.schemeMasterHistoryTitle.textContent = `Scheme History — ${row.scheme_name || row.scheme_id}`;
    }

    dom.schemeMasterHistoryModal.classList.remove("hidden");
    dom.schemeMasterHistoryModal.setAttribute("aria-hidden", "false");

    try {
      await renderSchemeMasterHistoryContent(row);
    } catch (err) {
      dom.schemeMasterHistoryBody.innerHTML =
        `<div class="status">Failed to load scheme history.</div>`;
      handleError("Failed to load scheme history", err);
    }
  }

  function closeSchemeMasterHistoryModal() {
    if (!dom.schemeMasterHistoryModal) return;
    dom.schemeMasterHistoryModal.classList.add("hidden");
    dom.schemeMasterHistoryModal.setAttribute("aria-hidden", "true");
    schemeMasterHistoryRow = null;
    const returnTarget = schemeMasterReturnFocus;
    schemeMasterReturnFocus = null;
    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  function renderSchemeMasterDrawerActions(row) {
    const canEdit = canEditPolicyActions();
    if (!canEdit) return "";
    const parts = [];
    if (schemeMasterRowBool(row, "can_edit_metadata")) {
      parts.push(`<button type="button" class="icon-btn icon-btn-primary" id="schemeMasterDrawerEditBtn" title="Edit Metadata" aria-label="Edit Metadata">Edit</button>`);
    }
    if (schemeMasterRowBool(row, "can_deactivate")) {
      parts.push(`<button type="button" class="icon-btn cp-danger-text-btn" id="schemeMasterDrawerDeactivateBtn" title="Deactivate" aria-label="Deactivate">Deactivate</button>`);
    }
    if (schemeMasterRowBool(row, "can_reactivate")) {
      parts.push(`<button type="button" class="icon-btn icon-btn-primary" id="schemeMasterDrawerReactivateBtn" title="Reactivate" aria-label="Reactivate">Reactivate</button>`);
    }
    if (!parts.length) return "";
    return `<div class="cp-drawer-action-bar">${parts.join("")}</div>`;
  }

  function renderSchemeRuleDrawerActions(row) {
    if (!canEditPolicyActions()) return "";
    if (schemeRuleRegisterView !== "current") return "";
    if (normalizeStatus(row.rule_status) !== "ACTIVE") return "";
    return `<div class="cp-drawer-action-bar">
      <button type="button" class="icon-btn cp-danger-text-btn" id="schemeRuleDrawerCloseBtn" title="Close Scheme Rule" aria-label="Close Scheme Rule">Close Rule</button>
    </div>`;
  }

  async function buildSchemeMasterHistoryHtml(row) {
    const rows = await fetchSchemeMasterAudit(row.scheme_id);
    if (!rows.length) {
      return `<div class="status">No audit history available.</div>`;
    }
    return simpleTable(
      [
        "Event",
        "Event Date/Time",
        "Reason",
        "Approval Reference",
        "Actor",
        "Old Name",
        "New Name",
        "Paid/Free Structure",
        "Old Active State",
        "New Active State",
        "Old Remarks",
        "New Remarks",
      ],
      rows,
      (auditRow) => {
        const paid = schemeMasterRowNumber(auditRow, ["paid_qty"]);
        const free = schemeMasterRowNumber(auditRow, ["free_qty"]);
        const structure =
          paid === null && free === null
            ? "--"
            : formatSchemeStructure(paid, free);
        const oldName = schemeMasterRowValue(auditRow, [
          "old_scheme_name",
          "old_name",
        ]);
        const newName = schemeMasterRowValue(auditRow, [
          "new_scheme_name",
          "new_name",
        ]);
        const oldActive = formatSchemeMasterActiveState(
          schemeMasterRowValue(
            auditRow,
            ["old_is_active", "old_active_state"],
            null,
          ),
        );
        const newActive = formatSchemeMasterActiveState(
          schemeMasterRowValue(
            auditRow,
            ["new_is_active", "new_active_state"],
            null,
          ),
        );
        const oldRemarks = schemeMasterRowValue(auditRow, [
          "old_remarks",
          "old_remark",
        ]);
        const newRemarks = schemeMasterRowValue(auditRow, [
          "new_remarks",
          "new_remark",
        ]);

        return `<tr>
          <td>${formatSchemeMasterEventLabel(auditRow.event_type || auditRow.event)}</td>
          <td>${formatDateTime(auditRow.event_at)}</td>
          <td>${text(auditRow.reason)}</td>
          <td>${text(auditRow.approval_reference)}</td>
          <td>${text(auditRow.actor || auditRow.event_actor || auditRow.created_by)}</td>
          <td>${text(oldName)}</td>
          <td>${text(newName)}</td>
          <td>${text(structure)}</td>
          <td>${text(oldActive)}</td>
          <td>${text(newActive)}</td>
          <td>${text(oldRemarks)}</td>
          <td>${text(newRemarks)}</td>
        </tr>`;
      },
    );
  }

  function getPolicyManagerTab() {
    if (
      getLegacyLensForPricingPolicyWorkspace(pricingPolicyWorkspace) ===
      "policy-manager"
    ) {
      return normalizePolicyManagerTab(pricingPolicyWorkspace);
    }
    return PRICING_POLICY_DEFAULT_WORKSPACE;
  }

  function getMrpGovernanceTab() {
    if (
      getLegacyLensForPricingPolicyWorkspace(pricingPolicyWorkspace) ===
      "mrp-governance"
    ) {
      return normalizeMrpGovernanceTab(pricingPolicyWorkspace);
    }
    return MRP_GOVERNANCE_DEFAULT_TAB;
  }

  /** Derived compat Area — not independently mutable. */
  function getPricingPolicyArea() {
    return (
      getPricingPolicyCompatAreaForWorkspace(pricingPolicyWorkspace) ||
      PRICING_POLICY_DEFAULT_AREA
    );
  }

  function getPricingPolicyWorkspace() {
    return pricingPolicyWorkspace;
  }

  function navigationSnapshot() {
    return {
      areaId: getPricingPolicyArea(),
      workspaceId: pricingPolicyWorkspace,
      legacyLensId: getLegacyLensForPricingPolicyWorkspace(
        pricingPolicyWorkspace,
      ),
    };
  }

  /** F2/F5: direct strip active workspace id (always one of nine). */
  function getActiveDirectWorkspaceId() {
    return resolveActivePricingPolicyDirectWorkspaceId(pricingPolicyWorkspace);
  }

  /**
   * Canonical F5 workspace setter. Does not load/render by itself —
   * callers retain the single onTabChange / switchLens / reloadRows cycle.
   */
  function setPricingPolicyWorkspace(workspaceId) {
    pricingPolicyWorkspace = normalizePricingPolicyWorkspace(workspaceId);
    return navigationSnapshot();
  }

  /**
   * Compatibility wrapper for residual areaId-only callers.
   * Does not set independent Area state — workspace ownership wins.
   */
  function setPricingPolicyNavigation({
    areaId = null,
    workspaceId = null,
    preserveWorkspaceState = true,
  } = {}) {
    void preserveWorkspaceState;
    const explicitWorkspace =
      workspaceId != null && String(workspaceId).trim() !== "";
    if (explicitWorkspace) {
      return setPricingPolicyWorkspace(workspaceId);
    }
    if (areaId != null) {
      return setPricingPolicyWorkspace(getDefaultPricingPolicyWorkspace(areaId));
    }
    return navigationSnapshot();
  }

  /**
   * Sync from legacy loader lens when shell sets CURRENT_LENS outside PPM URL parse.
   * Keeps the active workspace when it already matches the lens family.
   */
  function syncNavigationFromLegacyLens(legacyLensId) {
    const lens = String(legacyLensId || "").trim();
    const currentLegacy = getLegacyLensForPricingPolicyWorkspace(
      pricingPolicyWorkspace,
    );
    const currentArea = getPricingPolicyCompatAreaForWorkspace(
      pricingPolicyWorkspace,
    );

    if (lens === "policy-manager" || lens === "selling-schemes") {
      if (currentLegacy === "policy-manager") return navigationSnapshot();
      return setPricingPolicyWorkspace("sku-overview");
    }
    if (
      lens === "mrp-governance" ||
      lens === "mrp-policies" ||
      lens === "mrp-workflow"
    ) {
      if (currentLegacy === "mrp-governance") {
        if (lens === "mrp-workflow" && currentArea !== "mrp-workflow") {
          return setPricingPolicyWorkspace("mrp-proposals");
        }
        if (lens === "mrp-policies" && currentArea !== "mrp-policies") {
          return setPricingPolicyWorkspace("sku-mrp-policies");
        }
        return navigationSnapshot();
      }
      if (lens === "mrp-workflow") {
        return setPricingPolicyWorkspace("mrp-proposals");
      }
      return setPricingPolicyWorkspace("sku-mrp-policies");
    }
    return navigationSnapshot();
  }

  /** Thin compatibility alias — Selling workspace callers. */
  function setPolicyManagerTab(tabId) {
    return setPricingPolicyWorkspace(normalizePolicyManagerTab(tabId));
  }

  /** Thin compatibility alias — MRP workspace / handoff callers. */
  function setMrpGovernanceTab(tabId) {
    return setPricingPolicyWorkspace(normalizeMrpGovernanceTab(tabId));
  }

  function renderMrpGovernanceEmptyStateHtml() {
    const meta = getMrpGovernanceTabMeta(getMrpGovernanceTab());
    return `
      <div class="cp-mrp-governance-empty" role="status">
        <div class="cp-mrp-governance-empty-title">${text(meta.label)}</div>
        <p class="cp-mrp-governance-empty-body">${text(meta.purpose)}</p>
        <p class="cp-mrp-governance-empty-note">Not implemented in this stage.</p>
      </div>`;
  }

  /**
   * PPM-C1H1 — shared workspace toolbar skeleton (presentation only).
   * Empty slots are omitted so they do not consume height.
   * Search remains owned by #search in #globalSearchCard; do not pass searchHtml
   * that clones that control.
   */
  function renderWorkspaceToolbar({
    className = "",
    title = "",
    description = "",
    ariaLabel = "Workspace toolbar",
    navigationHtml = "",
    searchHtml = "",
    filterHtml = "",
    primaryActionHtml = "",
    metaHtml = "",
  } = {}) {
    const identityHtml =
      title || description
        ? `<div class="cp-workspace-toolbar-identity">
            ${
              title
                ? `<div class="cp-workspace-toolbar-title">${text(title)}</div>`
                : ""
            }
            ${
              description
                ? `<div class="cp-workspace-toolbar-description">${text(description)}</div>`
                : ""
            }
          </div>`
        : "";

    const navigationRegion = navigationHtml
      ? `<div class="cp-workspace-toolbar-navigation">${navigationHtml}</div>`
      : "";
    const actionsRegion = primaryActionHtml
      ? `<div class="cp-workspace-toolbar-actions">${primaryActionHtml}</div>`
      : "";
    const searchRegion = searchHtml
      ? `<div class="cp-workspace-toolbar-search">${searchHtml}</div>`
      : "";
    const filtersRegion = filterHtml
      ? `<div class="cp-workspace-toolbar-filters">${filterHtml}</div>`
      : "";
    const metaRegion = metaHtml
      ? `<div class="cp-workspace-toolbar-meta">${metaHtml}</div>`
      : "";

    const mainInner = [identityHtml, navigationRegion, actionsRegion]
      .filter(Boolean)
      .join("");
    const secondaryInner = [searchRegion, filtersRegion, metaRegion]
      .filter(Boolean)
      .join("");

    if (!mainInner && !secondaryInner) return "";

    const main = mainInner
      ? `<div class="cp-workspace-toolbar-main">${mainInner}</div>`
      : "";
    const secondary = secondaryInner
      ? `<div class="cp-workspace-toolbar-secondary">${secondaryInner}</div>`
      : "";
    const extraClass = className ? ` ${className}` : "";

    return `
      <div
        class="cp-workspace-toolbar${extraClass}"
        role="region"
        aria-label="${text(ariaLabel)}"
      >
        ${main}
        ${secondary}
      </div>`;
  }

  /**
   * Nested Current/History or Register/Workspace nav — MCM Manual Rate style cards.
   * Desktop/tablet uses cards; F3 narrow navigation exposes View as a select.
   */
  function renderNestedSubviewNav({
    options,
    activeId,
    dataAttr,
    selectId,
    selectLabel = "View",
    selectAriaLabel,
  }) {
    const aria = selectAriaLabel || selectLabel;
    const list = options || [];
    const colCount = Math.max(2, list.length || 2);
    const cards = list
      .map(
        ({ id, label }) => `
        <button
          type="button"
          class="cp-workbench-summary-card cp-manager-tab-card ${
            activeId === id ? "active" : ""
          }"
          ${dataAttr}="${id}"
          role="tab"
          aria-selected="${activeId === id ? "true" : "false"}"
        >
          <div class="cp-card-label">${text(label)}</div>
        </button>`,
      )
      .join("");

    const selectOptions = list
      .map(
        ({ id, label }) =>
          `<option value="${id}" ${activeId === id ? "selected" : ""}>${text(label)}</option>`,
      )
      .join("");

    return `
      <div class="cp-nested-subview-nav">
        <div
          class="cp-workbench-compact-summary cp-nested-subview-cards"
          style="grid-template-columns: repeat(${colCount}, minmax(0, 1fr));"
          role="tablist"
          aria-label="${text(aria)}"
        >
          ${cards}
        </div>
        <div class="cp-nested-subview-select-wrap">
          <label
            class="cp-nested-subview-select-label"
            for="${selectId}"
          >${text(selectLabel)}</label>
          <select
            id="${selectId}"
            class="tab-select cp-nested-subview-select"
            aria-label="${text(aria)}"
          >
            ${selectOptions}
          </select>
          <svg
            class="cp-nested-subview-select-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <polyline
              points="6 9 12 15 18 9"
              stroke="currentColor"
              stroke-width="2"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></polyline>
          </svg>
        </div>
      </div>`;
  }

  function renderMrpGovernanceTabs(workbenchSummaryEl, onTabChange, onSkuMrpLocalChange) {
    if (!workbenchSummaryEl) return;
    mrpFilterLocalChangeHandler = onSkuMrpLocalChange || null;
    // Nested View chrome only — desktop/narrow workspace nav lives in the shell.

    const skuMrpChrome = isSkuMrpPoliciesTabActive()
      ? `
      ${renderNestedSubviewNav({
        options: SKU_MRP_POLICY_VIEWS,
        activeId: skuMrpPolicyView,
        dataAttr: "data-sku-mrp-view",
        selectId: "skuMrpPolicyViewSelect",
        selectLabel: "View",
        selectAriaLabel: "Workspace view",
      })}
    `
      : "";

    const derivationCreateToolbar = "";

    const derivationChrome = isProductDerivationPoliciesTabActive()
      ? `
      ${renderNestedSubviewNav({
        options: PRODUCT_DERIVATION_POLICY_VIEWS,
        activeId: productDerivationPolicyView,
        dataAttr: "data-product-derivation-view",
        selectId: "productDerivationPolicyViewSelect",
        selectLabel: "View",
        selectAriaLabel: "Workspace view",
      })}
      ${derivationCreateToolbar}
    `
      : "";

    const proposalChrome = mrpProposals.isMrpProposalsTabActive()
      ? mrpProposals.renderChromeHtml()
      : "";

    const decisionChrome = mrpDecisions.isMrpDecisionsTabActive()
      ? mrpDecisions.renderChromeHtml()
      : "";

    const applicationChrome = mrpApplication.isMrpApplicationTabActive()
      ? mrpApplication.renderChromeHtml()
      : "";

    const appliedHistoryChrome = mrpAppliedHistory.isMrpAppliedHistoryTabActive()
      ? mrpAppliedHistory.renderChromeHtml()
      : "";

    const workspaceBodyHtml = [
      skuMrpChrome,
      derivationChrome,
      proposalChrome,
      decisionChrome,
      applicationChrome,
      appliedHistoryChrome,
    ]
      .filter((html) => String(html || "").trim())
      .join("");

    // F2: workspace label/purpose live on primary strip hover; workbench is Views/actions only.
    const toolbarHtml = renderWorkspaceToolbar({
      className: "cp-workspace-toolbar--mrp-governance",
      ariaLabel: "MRP workspace toolbar",
    });

    const workbenchHtml = `${toolbarHtml}${
      workspaceBodyHtml
        ? `<div class="cp-workspace-body">${workspaceBodyHtml}</div>`
        : ""
    }`;
    if (String(workbenchHtml || "").trim()) {
      workbenchSummaryEl.classList.add("is-visible");
      workbenchSummaryEl.innerHTML = workbenchHtml;
    } else {
      workbenchSummaryEl.classList.remove("is-visible");
      workbenchSummaryEl.innerHTML = "";
    }

    const commitSkuMrpView = async (nextView) => {
      const next = nextView === "history" ? "history" : "current";
      if (next === skuMrpPolicyView) return;
      skuMrpPolicyView = next;
      // Keep select + tab visuals in sync without waiting for a full re-render.
      workbenchSummaryEl
        .querySelectorAll("[data-sku-mrp-view]")
        .forEach((btn) => {
          const active = btn.dataset.skuMrpView === next;
          btn.classList.toggle("active", active);
          btn.setAttribute("aria-selected", active ? "true" : "false");
        });
      const viewSelect = workbenchSummaryEl.querySelector("#skuMrpPolicyViewSelect");
      if (viewSelect) viewSelect.value = next;

      if (typeof onSkuMrpLocalChange === "function") {
        await onSkuMrpLocalChange("view");
      } else {
        await onTabChange();
      }
    };

    workbenchSummaryEl
      .querySelectorAll("[data-sku-mrp-view]")
      .forEach((btn) => {
        btn.addEventListener("click", async () => {
          await commitSkuMrpView(btn.dataset.skuMrpView);
        });
      });

    workbenchSummaryEl
      .querySelector("#skuMrpPolicyViewSelect")
      ?.addEventListener("change", async (event) => {
        await commitSkuMrpView(event.target?.value);
      });

    const commitDerivationView = async (nextView) => {
      const next = nextView === "history" ? "history" : "current";
      if (next === productDerivationPolicyView) return;
      productDerivationPolicyView = next;
      workbenchSummaryEl
        .querySelectorAll("[data-product-derivation-view]")
        .forEach((btn) => {
          const active = btn.dataset.productDerivationView === next;
          btn.classList.toggle("active", active);
          btn.setAttribute("aria-selected", active ? "true" : "false");
        });
      const viewSelect = workbenchSummaryEl.querySelector(
        "#productDerivationPolicyViewSelect",
      );
      if (viewSelect) viewSelect.value = next;

      if (typeof onSkuMrpLocalChange === "function") {
        await onSkuMrpLocalChange("view");
      } else {
        await onTabChange();
      }
    };

    workbenchSummaryEl
      .querySelectorAll("[data-product-derivation-view]")
      .forEach((btn) => {
        btn.addEventListener("click", async () => {
          await commitDerivationView(btn.dataset.productDerivationView);
        });
      });

    workbenchSummaryEl
      .querySelector("#productDerivationPolicyViewSelect")
      ?.addEventListener("change", async (event) => {
        await commitDerivationView(event.target?.value);
      });

    if (mrpProposals.isMrpProposalsTabActive()) {
      mrpProposals.wireChromeEvents(
        workbenchSummaryEl,
        onSkuMrpLocalChange,
        onTabChange,
      );
    }

    if (mrpDecisions.isMrpDecisionsTabActive()) {
      mrpDecisions.wireChromeEvents(
        workbenchSummaryEl,
        onSkuMrpLocalChange,
        onTabChange,
      );
    }

    if (mrpApplication.isMrpApplicationTabActive()) {
      mrpApplication.wireChromeEvents(
        workbenchSummaryEl,
        onSkuMrpLocalChange,
        onTabChange,
      );
    }

    if (mrpAppliedHistory.isMrpAppliedHistoryTabActive()) {
      mrpAppliedHistory.wireChromeEvents(
        workbenchSummaryEl,
        onSkuMrpLocalChange,
        onTabChange,
      );
    }
  }

  function getActiveMrpFilterDrawerContent() {
    if (isSkuMrpPoliciesTabActive()) return renderSkuMrpFilterPanel();
    if (isProductDerivationPoliciesTabActive()) {
      return renderProductDerivationFilterPanel();
    }
    if (mrpProposals?.isMrpProposalsTabActive?.()) {
      return mrpProposals.renderActiveFilterDrawerPanel?.() || null;
    }
    if (mrpDecisions?.isMrpDecisionsTabActive?.()) {
      return mrpDecisions.renderActiveFilterDrawerPanel?.() || null;
    }
    if (mrpApplication?.isMrpApplicationTabActive?.()) {
      return mrpApplication.renderActiveFilterDrawerPanel?.() || null;
    }
    if (mrpAppliedHistory?.isMrpAppliedHistoryTabActive?.()) {
      return mrpAppliedHistory.renderActiveFilterDrawerPanel?.() || null;
    }
    return null;
  }

  async function notifyMrpFilterLocalChange() {
    if (typeof mrpFilterLocalChangeHandler === "function") {
      await mrpFilterLocalChangeHandler("filter");
    }
  }

  function wireActiveMrpFilterDrawer(container) {
    if (!container) return;

    container.querySelectorAll("[data-sku-mrp-filter-group]").forEach((input) => {
      input.addEventListener("change", async () => {
        toggleSkuMrpFilter(
          input.dataset.skuMrpFilterGroup,
          input.value,
          input.checked,
        );
        await notifyMrpFilterLocalChange();
      });
    });

    container
      .querySelector("[data-sku-mrp-filter-clear]")
      ?.addEventListener("click", async () => {
        clearSkuMrpFilters();
        await notifyMrpFilterLocalChange();
      });

    container
      .querySelectorAll("[data-product-derivation-filter-group]")
      .forEach((input) => {
        input.addEventListener("change", async () => {
          toggleProductDerivationFilter(
            input.dataset.productDerivationFilterGroup,
            input.value,
            input.checked,
          );
          await notifyMrpFilterLocalChange();
        });
      });

    container
      .querySelector("[data-product-derivation-filter-clear]")
      ?.addEventListener("click", async () => {
        clearProductDerivationFilters();
        await notifyMrpFilterLocalChange();
      });

    if (mrpProposals?.isMrpProposalsTabActive?.()) {
      mrpProposals.wireFilterDrawerEvents?.(
        container,
        mrpFilterLocalChangeHandler,
      );
    }
    if (mrpDecisions?.isMrpDecisionsTabActive?.()) {
      mrpDecisions.wireFilterDrawerEvents?.(
        container,
        mrpFilterLocalChangeHandler,
      );
    }
    if (mrpApplication?.isMrpApplicationTabActive?.()) {
      mrpApplication.wireFilterDrawerEvents?.(
        container,
        mrpFilterLocalChangeHandler,
      );
    }
    if (mrpAppliedHistory?.isMrpAppliedHistoryTabActive?.()) {
      mrpAppliedHistory.wireFilterDrawerEvents?.(
        container,
        mrpFilterLocalChangeHandler,
      );
    }
  }

  async function loadPolicyManagerRows() {
    if (getPolicyManagerTab() === "scheme-master") {
      return fetchAllRows(
        () =>
          costingFrom("v_costing_scheme_master_register")
            .select("*")
            .order("scheme_name", { ascending: true }),
        1000,
      );
    }
    if (getPolicyManagerTab() === "scheme-rule-register") {
      const rows = await fetchAllRows(
        () =>
          costingFrom("v_costing_scheme_policy_rule_register")
            .select("*")
            .order("rule_status", { ascending: true })
            .order("policy_rule_id", { ascending: false }),
        1000,
      );
      return filterSchemeRuleRegisterRows(rows);
    }
    return fetchAllRows(
      () =>
        costingFrom("v_costing_policy_manager_sku_overview")
          .select("*")
          .order("product_name", { ascending: true })
          .order("pack_size", { ascending: true }),
      1000,
    );
  }

  function filterSchemeRuleRegisterRows(rows) {
    const view = schemeRuleRegisterView === "history" ? "history" : "current";
    return (Array.isArray(rows) ? rows : []).filter((row) => {
      const status = normalizeStatus(row?.rule_status);
      if (view === "history") {
        return (
          status === "CLOSED" ||
          (status !== "ACTIVE" && status !== "SCHEDULED")
        );
      }
      return status === "ACTIVE" || status === "SCHEDULED";
    });
  }

  async function fetchSellingPolicyHistory(row) {
    if (!row?.sku_id) return [];

    const { data, error } = await costingFrom(
      "v_costing_policy_manager_selling_policy_history",
    )
      .select("*")
      .eq("sku_id", row.sku_id)
      .order("effective_from", { ascending: false })
      .order("policy_id", { ascending: false })
      .limit(100);

    if (error) throw error;
    return data || [];
  }

  async function fetchSchemePolicyHistory(row) {
    if (!row?.sku_id) return [];

    const { data, error } = await costingFrom(
      "v_costing_policy_manager_scheme_policy_history",
    )
      .select("*")
      .eq("sku_id", row.sku_id)
      .order("region_code", { ascending: true })
      .order("effective_from", { ascending: false })
      .order("policy_id", { ascending: false })
      .limit(200);

    if (error) throw error;
    return data || [];
  }

  function normalizePolicyNumber(value, fallback = 0) {
    if (value === null || value === undefined || value === "") return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function samePolicyNumber(a, b) {
    const an = a === null || a === undefined || a === "" ? null : Number(a);
    const bn = b === null || b === undefined || b === "" ? null : Number(b);

    if (an === null && bn === null) return true;
    if (!Number.isFinite(an) || !Number.isFinite(bn)) return false;

    return Math.abs(an - bn) < 0.000001;
  }

  function readSellingPolicyFormValues() {
    return {
      gstPercent: numberOrZeroFromInput(dom.sellingPolicyGstPercent),
      ikDiscountPercent: numberOrZeroFromInput(dom.sellingPolicyIkDiscountPercent),
      okDiscountPercent: numberOrZeroFromInput(dom.sellingPolicyOkDiscountPercent),
      ikDiscountAmount: numberOrNullFromInput(dom.sellingPolicyIkDiscountAmount),
      okDiscountAmount: numberOrNullFromInput(dom.sellingPolicyOkDiscountAmount),
      contingencyPercent: numberOrZeroFromInput(dom.sellingPolicyContingencyPercent),
      effectiveFrom: dom.sellingPolicyEffectiveFrom?.value || activePeriodIso(),
      remarks: dom.sellingPolicyRemarks?.value?.trim() || null,
    };
  }

  function setSellingPolicySaveState() {
    if (!dom.sellingPolicyEditSaveBtn || !sellingPolicyInitial) return;

    if (!canEditPolicyActions()) {
      dom.sellingPolicyEditSaveBtn.disabled = true;
      return;
    }

    const current = readSellingPolicyFormValues();

    const changed =
      !samePolicyNumber(current.gstPercent, sellingPolicyInitial.gstPercent) ||
      !samePolicyNumber(
        current.ikDiscountPercent,
        sellingPolicyInitial.ikDiscountPercent,
      ) ||
      !samePolicyNumber(
        current.okDiscountPercent,
        sellingPolicyInitial.okDiscountPercent,
      ) ||
      !samePolicyNumber(
        current.ikDiscountAmount,
        sellingPolicyInitial.ikDiscountAmount,
      ) ||
      !samePolicyNumber(
        current.okDiscountAmount,
        sellingPolicyInitial.okDiscountAmount,
      ) ||
      !samePolicyNumber(
        current.contingencyPercent,
        sellingPolicyInitial.contingencyPercent,
      );

    dom.sellingPolicyEditSaveBtn.disabled = !changed;
  }

  function openSellingPolicyEditModal(row) {
    if (!requireEditAccess("edit selling price policy")) return;
    if (!row || !dom.sellingPolicyEditModal) return;

    sellingPolicyEditRow = row;
    sellingPolicyReturnFocus = document.activeElement;

    const skuLabel =
      row.sku_display_name || row.sku_column_label || row.sku_id || "--";

    if (dom.sellingPolicyEditSkuLabel) {
      dom.sellingPolicyEditSkuLabel.textContent = skuLabel;
    }

    const initial = {
      gstPercent: normalizePolicyNumber(row.gst_percent, 12),
      ikDiscountPercent: normalizePolicyNumber(row.ik_discount_percent, 0),
      okDiscountPercent: normalizePolicyNumber(row.ok_discount_percent, 0),
      ikDiscountAmount:
        row.ik_discount_amount === null || row.ik_discount_amount === undefined
          ? null
          : Number(row.ik_discount_amount),
      okDiscountAmount:
        row.ok_discount_amount === null || row.ok_discount_amount === undefined
          ? null
          : Number(row.ok_discount_amount),
      contingencyPercent: normalizePolicyNumber(row.contingency_percent, 2),
    };

    sellingPolicyInitial = initial;

    if (dom.sellingPolicyGstPercent)
      dom.sellingPolicyGstPercent.value = initial.gstPercent;
    if (dom.sellingPolicyIkDiscountPercent)
      dom.sellingPolicyIkDiscountPercent.value = initial.ikDiscountPercent;
    if (dom.sellingPolicyOkDiscountPercent)
      dom.sellingPolicyOkDiscountPercent.value = initial.okDiscountPercent;
    if (dom.sellingPolicyIkDiscountAmount)
      dom.sellingPolicyIkDiscountAmount.value =
        initial.ikDiscountAmount === null ? "" : initial.ikDiscountAmount;
    if (dom.sellingPolicyOkDiscountAmount)
      dom.sellingPolicyOkDiscountAmount.value =
        initial.okDiscountAmount === null ? "" : initial.okDiscountAmount;
    if (dom.sellingPolicyContingencyPercent)
      dom.sellingPolicyContingencyPercent.value = initial.contingencyPercent;
    if (dom.sellingPolicyEffectiveFrom) {
      dom.sellingPolicyEffectiveFrom.value =
        row.selling_price_effective_from || activePeriodIso();
    }
    if (dom.sellingPolicyRemarks) dom.sellingPolicyRemarks.value = "";

    dom.sellingPolicyEditModal.classList.remove("hidden");
    dom.sellingPolicyEditModal.setAttribute("aria-hidden", "false");

    setSellingPolicySaveState();

    setTimeout(() => dom.sellingPolicyGstPercent?.focus(), 0);
  }

  function closeSellingPolicyEditModal() {
    if (!dom.sellingPolicyEditModal) return;

    const active = document.activeElement;
    if (active && dom.sellingPolicyEditModal.contains(active)) {
      active.blur();
    }

    dom.sellingPolicyEditModal.classList.add("hidden");
    dom.sellingPolicyEditModal.setAttribute("aria-hidden", "true");

    const returnTarget =
      sellingPolicyReturnFocus &&
      sellingPolicyReturnFocus !== document.body &&
      document.contains(sellingPolicyReturnFocus)
        ? sellingPolicyReturnFocus
        : dom.drawerClose;

    sellingPolicyReturnFocus = null;
    sellingPolicyEditRow = null;
    sellingPolicyInitial = null;

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  async function saveSellingPolicyEdit() {
    if (!requireEditAccess("save selling price policy")) return;
    const row = sellingPolicyEditRow;
    if (!row?.sku_id) {
      showToast("SKU ID missing for selected row.", "error");
      return;
    }

    const values = readSellingPolicyFormValues();

    const changed =
      !samePolicyNumber(values.gstPercent, sellingPolicyInitial?.gstPercent) ||
      !samePolicyNumber(
        values.ikDiscountPercent,
        sellingPolicyInitial?.ikDiscountPercent,
      ) ||
      !samePolicyNumber(
        values.okDiscountPercent,
        sellingPolicyInitial?.okDiscountPercent,
      ) ||
      !samePolicyNumber(
        values.ikDiscountAmount,
        sellingPolicyInitial?.ikDiscountAmount,
      ) ||
      !samePolicyNumber(
        values.okDiscountAmount,
        sellingPolicyInitial?.okDiscountAmount,
      ) ||
      !samePolicyNumber(
        values.contingencyPercent,
        sellingPolicyInitial?.contingencyPercent,
      );

    if (!changed) {
      showToast("No selling policy change detected.", "info");
      setSellingPolicySaveState();
      return;
    }

    dom.sellingPolicyEditSaveBtn.disabled = true;
    setLoadingMask(true, "Saving selling price policy...");

    try {
      const { error } = await costingRpc("rpc_set_sku_selling_price_policy", {
        p_sku_id: row.sku_id,
        p_gst_percent: values.gstPercent,
        p_ik_discount_percent: values.ikDiscountPercent,
        p_ok_discount_percent: values.okDiscountPercent,
        p_ik_discount_amount: values.ikDiscountAmount,
        p_ok_discount_amount: values.okDiscountAmount,
        p_contingency_percent: values.contingencyPercent,
        p_effective_from: values.effectiveFrom,
        p_remarks: values.remarks,
      });

      if (error) throw error;

      closeSellingPolicyEditModal();
      showToast(
        "Selling policy saved. Request Costing Refresh from the toolbar when you want derived values recalculated.",
        "success",
        5200,
      );

      await onPolicyDataChanged({ drawerTab: "selling-policy", skuId: row.sku_id });
    } catch (err) {
      handleError("Failed to save selling price policy", err);
    } finally {
      setLoadingMask(false);
      dom.sellingPolicyEditSaveBtn.disabled = false;
      setSellingPolicySaveState();
    }
  }

  function schemeIdForRegion(row, region) {
    if (!row) return null;
    const r = String(region || "").toUpperCase();
    if (r === "IK") return row.ik_selected_scheme_id ?? null;
    if (r === "OK") return row.ok_selected_scheme_id ?? null;
    return null;
  }

  function schemeNameForRegion(row, region) {
    if (!row) return "";
    const r = String(region || "").toUpperCase();
    if (r === "IK") return row.ik_selected_scheme_name || "";
    if (r === "OK") return row.ok_selected_scheme_name || "";
    return "";
  }

  function setSchemePolicySaveState() {
    if (!dom.schemePolicyEditSaveBtn) return;

    if (!canEditPolicyActions()) {
      dom.schemePolicyEditSaveBtn.disabled = true;
      return;
    }

    const currentSchemeId = Number(dom.schemePolicyEditScheme?.value || 0);
    const initialSchemeId = Number(schemePolicyInitial.schemeId || 0);

    const hasSchemeChange =
      currentSchemeId > 0 && currentSchemeId !== initialSchemeId;

    dom.schemePolicyEditSaveBtn.disabled = !hasSchemeChange;
  }

  function populateSchemePolicySchemeOptions() {
    if (!dom.schemePolicyEditScheme) return;

    const options = schemeOptions
      .map(
        (s) =>
          `<option value="${text(s.scheme_id)}">
        ${text(s.scheme_name)} (${formatNumber(s.paid_qty)} + ${formatNumber(s.free_qty)})
      </option>`,
      )
      .join("");

    dom.schemePolicyEditScheme.innerHTML = options
      ? options
      : `<option value="">No schemes available</option>`;
  }

  function schemeEffectiveFromForRegion(row, region) {
    const r = String(region || "").toUpperCase();
    if (r === "IK") return row?.ik_scheme_effective_from || activePeriodIso();
    if (r === "OK") return row?.ok_scheme_effective_from || activePeriodIso();
    return activePeriodIso();
  }

  function schemeRemarksForRegion(row, region) {
    const r = String(region || "").toUpperCase();
    if (r === "IK") return row?.ik_remarks || "";
    if (r === "OK") return row?.ok_remarks || "";
    return "";
  }

  function openSchemePolicyEditModal(row, regionCode = "IK") {
    if (!requireEditAccess("edit scheme policy")) return;
    if (!row?.sku_id) {
      showToast("SKU ID missing for selected row.", "error");
      return;
    }
    if (!dom.schemePolicyEditModal) return;

    schemePolicyEditRow = row;
    schemePolicyReturnFocus = document.activeElement;

    const skuLabel =
      row.sku_display_name || row.sku_column_label || row.sku_id || "--";

    if (dom.schemePolicyEditSkuLabel) {
      dom.schemePolicyEditSkuLabel.textContent = skuLabel;
    }

    populateSchemePolicySchemeOptions();

    const region = String(regionCode || "IK").toUpperCase();
    if (dom.schemePolicyEditRegion) {
      dom.schemePolicyEditRegion.value = region;
      dom.schemePolicyEditRegion.disabled = true;
    }

    populateSchemePolicySelectionForRegion(region);

    if (dom.schemePolicyEditEffectiveFrom) {
      dom.schemePolicyEditEffectiveFrom.value = schemeEffectiveFromForRegion(
        row,
        region,
      );
    }
    if (dom.schemePolicyEditRemarks) {
      dom.schemePolicyEditRemarks.value = schemeRemarksForRegion(row, region);
    }

    dom.schemePolicyEditModal.classList.remove("hidden");
    dom.schemePolicyEditModal.setAttribute("aria-hidden", "false");

    setSchemePolicySaveState();

    setTimeout(() => dom.schemePolicyEditScheme?.focus(), 0);
  }

  function populateSchemePolicySelectionForRegion(region) {
    const row = schemePolicyEditRow;
    if (!row || !dom.schemePolicyEditScheme) return;

    const currentSchemeName = schemeNameForRegion(row, region);
    const currentSchemeId =
      schemeIdForRegion(row, region) ??
      schemeOptions.find(
        (s) => String(s.scheme_name || "") === String(currentSchemeName || ""),
      )?.scheme_id ??
      null;
    schemePolicyInitial = {
      region,
      schemeId: currentSchemeId,
    };

    if (currentSchemeId) {
      dom.schemePolicyEditScheme.value = String(currentSchemeId);
    }

    setSchemePolicySaveState();
  }

  function populateSchemeRuleSchemeOptions() {
    if (!dom.schemeRuleScheme || !dom.schemeRuleReplaceFromScheme) return;

    const options = schemeOptions
      .map(
        (s) =>
          `<option value="${text(s.scheme_id)}">
        ${text(s.scheme_name)} (${formatNumber(s.paid_qty)} + ${formatNumber(s.free_qty)})
      </option>`,
      )
      .join("");

    dom.schemeRuleScheme.innerHTML = options;
    dom.schemeRuleReplaceFromScheme.innerHTML = options;
  }

  function populateSchemeRuleScopeOptions() {
    if (
      !dom.schemeRuleScope ||
      !dom.schemeRuleScopeSearch ||
      !dom.schemeRuleScopeSelect
    ) {
      return;
    }

    const selectedScope = dom.schemeRuleScope.value || "PRODUCT";
    const q = String(dom.schemeRuleScopeSearch.value || "")
      .trim()
      .toLowerCase();

    let rows = schemeRuleScopeOptions.filter(
      (row) => row.policy_scope === selectedScope,
    );

    if (q) {
      rows = rows.filter((row) =>
        [
          row.display_name,
          row.scope_name,
          row.category_name,
          row.subcategory_name,
          row.group_name,
          row.sub_group_name,
          row.product_name,
          row.scope_key,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }

    rows = rows.slice(0, 250);

    dom.schemeRuleScopeSelect.innerHTML = rows.length
      ? rows
          .map(
            (row) =>
              `<option value="${text(row.scope_key)}" data-scope-id="${text(row.scope_id)}">
              ${text(row.display_name)}
            </option>`,
          )
          .join("")
      : `<option value="">No matching scope found</option>`;
  }

  function syncSchemeRuleApplyModeUi() {
    if (!dom.schemeRuleApplyMode || !dom.schemeRuleReplaceFromWrap) return;

    const isReplace = dom.schemeRuleApplyMode.value === "REPLACE_EXISTING_SCHEME";

    dom.schemeRuleReplaceFromWrap.style.display = isReplace ? "" : "none";
  }

  function readSchemeRuleFormValues() {
    const selectedOption =
      dom.schemeRuleScopeSelect?.selectedOptions?.[0] || null;

    return {
      policyScope: dom.schemeRuleScope?.value || "",
      scopeKey: dom.schemeRuleScopeSelect?.value || "",
      scopeId: selectedOption?.dataset?.scopeId
        ? Number(selectedOption.dataset.scopeId)
        : null,
      regionCode: dom.schemeRuleRegion?.value || "",
      schemeId: dom.schemeRuleScheme?.value
        ? Number(dom.schemeRuleScheme.value)
        : null,
      applyMode: dom.schemeRuleApplyMode?.value || "ALL_MATCHING",
      replaceFromSchemeId:
        dom.schemeRuleApplyMode?.value === "REPLACE_EXISTING_SCHEME" &&
        dom.schemeRuleReplaceFromScheme?.value
          ? Number(dom.schemeRuleReplaceFromScheme.value)
          : null,
      effectiveFrom: dom.schemeRuleEffectiveFrom?.value || activePeriodIso(),
      remarks: dom.schemeRuleRemarks?.value?.trim() || "",
    };
  }

  function setSchemeRuleSaveState() {
    if (!dom.schemeRuleEditSaveBtn) return;

    if (!canEditPolicyActions()) {
      dom.schemeRuleEditSaveBtn.disabled = true;
      return;
    }

    const values = readSchemeRuleFormValues();

    const valid =
      values.policyScope &&
      values.scopeId &&
      values.regionCode &&
      values.schemeId &&
      values.effectiveFrom &&
      values.remarks.length >= 5 &&
      (values.applyMode !== "REPLACE_EXISTING_SCHEME" ||
        values.replaceFromSchemeId);

    dom.schemeRuleEditSaveBtn.disabled = !valid;
  }

  function openSchemeRuleEditModal(row = null) {
    if (!requireEditAccess("create hierarchy scheme rules")) return;
    if (!dom.schemeRuleEditModal) return;

    schemeRuleEditReturnFocus = document.activeElement;

    populateSchemeRuleSchemeOptions();

    if (dom.schemeRuleScope) {
      dom.schemeRuleScope.value = row?.sku_id ? "SKU" : "PRODUCT";
    }

    if (dom.schemeRuleScopeSearch) {
      dom.schemeRuleScopeSearch.value =
        row?.product_name || row?.sku_display_name || "";
    }

    if (dom.schemeRuleRegion) {
      dom.schemeRuleRegion.value = "IK";
    }

    if (dom.schemeRuleApplyMode) {
      dom.schemeRuleApplyMode.value = "MISSING_ONLY";
    }

    if (dom.schemeRuleEffectiveFrom) {
      dom.schemeRuleEffectiveFrom.value = activePeriodIso();
    }

    if (dom.schemeRuleRemarks) {
      dom.schemeRuleRemarks.value = "";
    }

    populateSchemeRuleScopeOptions();

    if (row?.sku_id && dom.schemeRuleScopeSelect) {
      const skuKey = `SKU:${row.sku_id}`;
      if (
        [...dom.schemeRuleScopeSelect.options].some((opt) => opt.value === skuKey)
      ) {
        dom.schemeRuleScopeSelect.value = skuKey;
      }
    } else if (row?.product_id && dom.schemeRuleScopeSelect) {
      const productKey = `PRODUCT:${row.product_id}`;
      if (
        [...dom.schemeRuleScopeSelect.options].some(
          (opt) => opt.value === productKey,
        )
      ) {
        dom.schemeRuleScopeSelect.value = productKey;
      }
    }

    syncSchemeRuleApplyModeUi();
    setSchemeRuleSaveState();

    dom.schemeRuleEditModal.classList.remove("hidden");
    dom.schemeRuleEditModal.setAttribute("aria-hidden", "false");

    setTimeout(() => dom.schemeRuleScopeSearch?.focus(), 0);
  }

  function closeSchemeRuleEditModal() {
    if (!dom.schemeRuleEditModal) return;

    const active = document.activeElement;
    if (active && dom.schemeRuleEditModal.contains(active)) {
      active.blur();
    }

    dom.schemeRuleEditModal.classList.add("hidden");
    dom.schemeRuleEditModal.setAttribute("aria-hidden", "true");

    const returnTarget =
      schemeRuleEditReturnFocus &&
      schemeRuleEditReturnFocus !== document.body &&
      document.contains(schemeRuleEditReturnFocus)
        ? schemeRuleEditReturnFocus
        : dom.drawerClose;

    schemeRuleEditReturnFocus = null;

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  async function saveSchemeRuleEdit() {
    if (!requireEditAccess("save hierarchy scheme rules")) return;
    const values = readSchemeRuleFormValues();

    if (!values.scopeId) {
      showToast("Please select a valid scope.", "error");
      setSchemeRuleSaveState();
      return;
    }

    if (!values.schemeId) {
      showToast("Please select a scheme.", "error");
      setSchemeRuleSaveState();
      return;
    }

    if (!values.remarks || values.remarks.length < 5) {
      showToast("Remarks / approval reference is required.", "error");
      setSchemeRuleSaveState();
      return;
    }

    if (
      values.applyMode === "REPLACE_EXISTING_SCHEME" &&
      !values.replaceFromSchemeId
    ) {
      showToast("Please select the scheme to replace.", "error");
      setSchemeRuleSaveState();
      return;
    }

    dom.schemeRuleEditSaveBtn.disabled = true;
    setLoadingMask(true, "Saving hierarchy scheme rule...");

    try {
      const { error } = await costingRpc("rpc_set_scheme_policy_rule", {
        p_policy_scope: values.policyScope,
        p_scope_id: values.scopeId,
        p_region_code: values.regionCode,
        p_scheme_id: values.schemeId,
        p_effective_from: values.effectiveFrom,
        p_apply_mode: values.applyMode,
        p_replace_from_scheme_id: values.replaceFromSchemeId,
        p_remarks: values.remarks,
      });

      if (error) throw error;

      closeSchemeRuleEditModal();
      showToast(
        "Hierarchy scheme rule saved. Request Costing Refresh from the toolbar if downstream pricing needs recalculation.",
        "success",
        5200,
      );

      const skuId = getSelectedSkuId?.();
      if (getCurrentLens() === "policy-manager" && skuId) {
        await onPolicyDataChanged({ drawerTab: "scheme-policy", skuId });
      } else {
        await reloadRows();
      }
    } catch (err) {
      handleError("Failed to save hierarchy scheme rule", err);
    } finally {
      setLoadingMask(false);
      dom.schemeRuleEditSaveBtn.disabled = false;
      setSchemeRuleSaveState();
    }
  }

  function readSchemeRuleCloseFormValues() {
    return {
      effectiveTo: dom.schemeRuleCloseEffectiveTo?.value || activePeriodIso(),
      remarks: dom.schemeRuleCloseRemarks?.value?.trim() || "",
    };
  }

  function setSchemeRuleCloseSaveState() {
    if (!dom.schemeRuleCloseSaveBtn) return;

    if (!canEditPolicyActions()) {
      dom.schemeRuleCloseSaveBtn.disabled = true;
      return;
    }

    const values = readSchemeRuleCloseFormValues();
    dom.schemeRuleCloseSaveBtn.disabled = values.remarks.length < 5;
  }

  function openSchemeRuleCloseModal(row) {
    if (!requireEditAccess("close hierarchy scheme rules")) return;
    if (!row || !dom.schemeRuleCloseModal) return;

    schemeRuleCloseRow = row;
    schemeRuleCloseReturnFocus = document.activeElement;

    if (dom.schemeRuleCloseLabel) {
      dom.schemeRuleCloseLabel.textContent = `#${row.policy_rule_id} | ${row.policy_scope} | ${row.scope_name} | ${row.region_code} | ${row.scheme_name}`;
    }

    if (dom.schemeRuleCloseEffectiveTo) {
      dom.schemeRuleCloseEffectiveTo.value = activePeriodIso();
    }

    if (dom.schemeRuleCloseRemarks) {
      dom.schemeRuleCloseRemarks.value = "";
    }

    dom.schemeRuleCloseModal.classList.remove("hidden");
    dom.schemeRuleCloseModal.setAttribute("aria-hidden", "false");

    setSchemeRuleCloseSaveState();

    setTimeout(() => dom.schemeRuleCloseRemarks?.focus(), 0);
  }

  function closeSchemeRuleCloseModal() {
    if (!dom.schemeRuleCloseModal) return;

    const active = document.activeElement;
    if (active && dom.schemeRuleCloseModal.contains(active)) {
      active.blur();
    }

    dom.schemeRuleCloseModal.classList.add("hidden");
    dom.schemeRuleCloseModal.setAttribute("aria-hidden", "true");

    const returnTarget =
      schemeRuleCloseReturnFocus &&
      schemeRuleCloseReturnFocus !== document.body &&
      document.contains(schemeRuleCloseReturnFocus)
        ? schemeRuleCloseReturnFocus
        : dom.drawerClose;

    schemeRuleCloseRow = null;
    schemeRuleCloseReturnFocus = null;

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  async function saveSchemeRuleClose() {
    if (!requireEditAccess("close hierarchy scheme rules")) return;
    const row = schemeRuleCloseRow;

    if (!row?.policy_rule_id) {
      showToast("Scheme rule ID missing.", "error");
      return;
    }

    const values = readSchemeRuleCloseFormValues();

    if (!values.remarks || values.remarks.length < 5) {
      showToast("Close remarks / approval reference is required.", "error");
      setSchemeRuleCloseSaveState();
      return;
    }

    dom.schemeRuleCloseSaveBtn.disabled = true;
    setLoadingMask(true, "Closing scheme rule...");

    try {
      const { error } = await costingRpc("rpc_close_scheme_policy_rule", {
        p_policy_rule_id: row.policy_rule_id,
        p_effective_to: values.effectiveTo,
        p_remarks: values.remarks,
      });

      if (error) throw error;

      closeSchemeRuleCloseModal();

      showToast("Scheme rule closed successfully.", "success", 4200);

      await reloadRows();
      if (typeof closeDetails === "function") {
        closeDetails();
      }
    } catch (err) {
      handleError("Failed to close scheme rule", err);
    } finally {
      setLoadingMask(false);
      dom.schemeRuleCloseSaveBtn.disabled = false;
      setSchemeRuleCloseSaveState();
    }
  }

  function closeSchemePolicyEditModal() {
    if (!dom.schemePolicyEditModal) return;

    const active = document.activeElement;
    if (active && dom.schemePolicyEditModal.contains(active)) {
      active.blur();
    }

    dom.schemePolicyEditModal.classList.add("hidden");
    dom.schemePolicyEditModal.setAttribute("aria-hidden", "true");

    const returnTarget =
      schemePolicyReturnFocus &&
      schemePolicyReturnFocus !== document.body &&
      document.contains(schemePolicyReturnFocus)
        ? schemePolicyReturnFocus
        : dom.drawerClose;

    schemePolicyReturnFocus = null;
    schemePolicyEditRow = null;

    if (dom.schemePolicyEditRegion) {
      dom.schemePolicyEditRegion.disabled = false;
    }

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  async function saveSchemePolicyEdit() {
    if (!requireEditAccess("save scheme policy")) return;
    const row = schemePolicyEditRow;
    if (!row?.sku_id) {
      showToast("SKU ID missing for selected row.", "error");
      return;
    }

    const region = dom.schemePolicyEditRegion?.value;
    const schemeId = Number(dom.schemePolicyEditScheme?.value);
    const initialSchemeId = Number(schemePolicyInitial.schemeId || 0);
    const effectiveFrom =
      dom.schemePolicyEditEffectiveFrom?.value || activePeriodIso();
    const remarks = dom.schemePolicyEditRemarks?.value?.trim() || null;

    if (schemeId === initialSchemeId) {
      showToast("No scheme change detected.", "info");
      setSchemePolicySaveState();
      return;
    }

    if (!region || !schemeId) {
      showToast("Region and scheme are required.", "error");
      return;
    }

    dom.schemePolicyEditSaveBtn.disabled = true;
    setLoadingMask(true, "Saving scheme policy...");

    try {
      const { error } = await costingRpc("rpc_set_sku_scheme_policy", {
        p_sku_id: row.sku_id,
        p_region_code: region,
        p_scheme_id: schemeId,
        p_effective_from: effectiveFrom,
        p_remarks: remarks,
      });

      if (error) throw error;

      closeSchemePolicyEditModal();
      showToast("Scheme policy saved. Refreshing policy view...", "success");

      await onPolicyDataChanged({ drawerTab: "scheme-policy", skuId: row.sku_id });
    } catch (err) {
      handleError("Failed to save scheme policy", err);
    } finally {
      setLoadingMask(false);
      dom.schemePolicyEditSaveBtn.disabled = false;
    }
  }

  function getTableHeaders(lensId) {
    if (lensId === "mrp-governance") {
      if (mrpAppliedHistory.isMrpAppliedHistoryTabActive()) {
        return mrpAppliedHistory.getTableHeaders();
      }
      if (mrpApplication.isMrpApplicationTabActive()) {
        return mrpApplication.getTableHeaders();
      }
      if (mrpDecisions.isMrpDecisionsTabActive()) {
        return mrpDecisions.getTableHeaders();
      }
      if (mrpProposals.isMrpProposalsTabActive()) {
        return mrpProposals.getTableHeaders();
      }
      if (isProductDerivationPoliciesTabActive()) {
        return productDerivationPolicyView === "history"
          ? PRODUCT_DERIVATION_HISTORY_HEADERS
          : PRODUCT_DERIVATION_CURRENT_HEADERS;
      }
      if (!isSkuMrpPoliciesTabActive()) return [];
      return skuMrpPolicyView === "history"
        ? SKU_MRP_HISTORY_HEADERS
        : SKU_MRP_CURRENT_HEADERS;
    }
    if (lensId === "policy-manager") {
      return policyManagerHeaders(getPolicyManagerTab());
    }
    return null;
  }

  function getTableAlignments(lensId) {
    if (lensId === "mrp-governance") {
      if (mrpAppliedHistory.isMrpAppliedHistoryTabActive()) {
        return mrpAppliedHistory.getTableAlignments();
      }
      if (mrpApplication.isMrpApplicationTabActive()) {
        return mrpApplication.getTableAlignments();
      }
      if (mrpDecisions.isMrpDecisionsTabActive()) {
        return mrpDecisions.getTableAlignments();
      }
      if (mrpProposals.isMrpProposalsTabActive()) {
        return mrpProposals.getTableAlignments();
      }
      if (isProductDerivationPoliciesTabActive()) {
        return productDerivationPolicyView === "history"
          ? PRODUCT_DERIVATION_HISTORY_ALIGNMENTS
          : PRODUCT_DERIVATION_CURRENT_ALIGNMENTS;
      }
      if (!isSkuMrpPoliciesTabActive()) return [];
      return skuMrpPolicyView === "history"
        ? SKU_MRP_HISTORY_ALIGNMENTS
        : SKU_MRP_CURRENT_ALIGNMENTS;
    }
    if (lensId === "policy-manager") {
      return policyManagerAlignments(getPolicyManagerTab());
    }
    return null;
  }

  function renderTableRow(lensId, row, trAttrs) {
    if (lensId === "mrp-governance") {
      if (mrpAppliedHistory.isMrpAppliedHistoryTabActive()) {
        return mrpAppliedHistory.renderTableRow(row, trAttrs);
      }
      if (mrpApplication.isMrpApplicationTabActive()) {
        return mrpApplication.renderTableRow(row, trAttrs);
      }
      if (mrpDecisions.isMrpDecisionsTabActive()) {
        return mrpDecisions.renderTableRow(row, trAttrs);
      }
      if (mrpProposals.isMrpProposalsTabActive()) {
        return mrpProposals.renderTableRow(row, trAttrs);
      }
      if (isProductDerivationPoliciesTabActive()) {
        return productDerivationPolicyView === "history"
          ? renderProductDerivationHistoryRow(row, trAttrs)
          : renderProductDerivationCurrentRow(row, trAttrs);
      }
      if (!isSkuMrpPoliciesTabActive()) return null;
      return skuMrpPolicyView === "history"
        ? renderSkuMrpHistoryRow(row, trAttrs)
        : renderSkuMrpCurrentRow(row, trAttrs);
    }
    if (lensId === "policy-manager") {
      if (getPolicyManagerTab() === "scheme-master") {
        const paid = schemeMasterRowNumber(row, ["paid_qty"]);
        const free = schemeMasterRowNumber(row, ["free_qty"]);
        const total = schemeMasterTotalQty(row);
        const discount = schemeMasterEffectiveDiscount(row);
        return `<tr ${trAttrs}>
        <td>${schemeMasterDisplayName(row)}</td>
        <td class="c-right">${formatSchemeQty(paid)}</td>
        <td class="c-right">${formatSchemeQty(free)}</td>
        <td class="c-right">${formatSchemeQty(total)}</td>
        <td class="c-right">${formatEffectiveFreeDiscountPct(discount)}</td>
        <td>${schemeMasterStatusChip(row)}</td>
        <td>${schemeMasterTypeBadge(row)}</td>
        <td class="c-right">${formatSchemeQty(
          schemeMasterRowNumber(row, [
            "active_direct_policies",
            "active_direct_policy_count",
          ]),
        )}</td>
        <td class="c-right">${formatSchemeQty(
          schemeMasterRowNumber(row, [
            "active_hierarchy_rules",
            "active_hierarchy_rule_count",
          ]),
        )}</td>
        <td class="c-right">${formatSchemeQty(
          schemeMasterRowNumber(row, ["viability_periods", "viability_period_count"]),
        )}</td>
        <td>${formatDateTime(row.updated_at)}</td>
      </tr>`;
      }

      if (getPolicyManagerTab() === "scheme-rule-register") {
        return `<tr ${trAttrs}>
        <td>
          ${cpCellPrimaryHtml(`#${text(row.policy_rule_id)}`)}
          <div class="cp-muted-text">${text(row.rule_status)}</div>
        </td>
        <td>
          ${cpCellPrimary(row.policy_scope)}
          <div class="cp-muted-text">${text(row.scope_name)}</div>
        </td>
        <td>${text(row.region_code)}</td>
        <td>
          ${cpCellPrimary(row.scheme_name)}
          <div class="cp-muted-text">
            ${formatNumber(row.paid_qty)} + ${formatNumber(row.free_qty)}
          </div>
        </td>
        <td>
          ${text(row.apply_mode)}
          ${
            row.replace_from_scheme_name
              ? `<div class="cp-muted-text">From: ${text(row.replace_from_scheme_name)}</div>`
              : ""
          }
        </td>
        <td>${formatDate(row.effective_from)}</td>
        <td>${formatDate(row.effective_to)}</td>
        <td>${compactStatusText(row.rule_status)}</td>
        <td>${text(row.remarks)}</td>
      </tr>`;
      }

      return `<tr ${trAttrs}>
      <td>${productSkuLabel(row)}</td>
      <td class="c-right">${formatMoney(row.mrp_ik)}</td>
      <td class="c-right">${formatMoney(row.mrp_ok)}</td>
      <td class="c-right">${formatPercent(row.gst_percent)}</td>
      <td class="c-right">${formatPercent(row.ik_discount_percent)}</td>
      <td class="c-right">${formatPercent(row.ok_discount_percent)}</td>
      <td class="c-right">${formatPercent(row.contingency_percent)}</td>
      <td>
        ${cpCellPrimary(row.ik_selected_scheme_name)}
        <div class="cp-muted-text">${text(row.ik_policy_source_label)}</div>
      </td>
      <td>
        ${cpCellPrimary(row.ok_selected_scheme_name)}
        <div class="cp-muted-text">${text(row.ok_policy_source_label)}</div>
      </td>
      <td>${compactStatusText(row.pricing_bridge_status)}</td>
      <td>${compactStatusText(row.selling_price_bridge_status)}</td>
    </tr>`;
    }

    return null;
  }

  function renderPolicyManagerTabs(workbenchSummaryEl, onTabChange) {
    if (!workbenchSummaryEl) return;
    // F2: Selling workspace strip lives in #lensPills; create actions live in meta +.
    // Scheme Rule Register uses nested Current/History like SKU MRP.

    const schemeRuleChrome =
      getPolicyManagerTab() === "scheme-rule-register"
        ? renderNestedSubviewNav({
            options: [
              { id: "current", label: "Current Rules" },
              { id: "history", label: "Rule History" },
            ],
            activeId: schemeRuleRegisterView,
            dataAttr: "data-scheme-rule-view",
            selectId: "schemeRuleRegisterViewSelect",
            selectLabel: "View",
            selectAriaLabel: "Scheme rule register view",
          })
        : "";

    const toolbarHtml = renderWorkspaceToolbar({
      className: "cp-workspace-toolbar--policy-manager",
      ariaLabel: "Selling and Schemes workspace toolbar",
      primaryActionHtml: "",
    });

    const workbenchHtml = `${toolbarHtml}${
      schemeRuleChrome
        ? `<div class="cp-workspace-body">${schemeRuleChrome}</div>`
        : ""
    }`;

    if (String(workbenchHtml || "").trim()) {
      workbenchSummaryEl.classList.add("is-visible");
      workbenchSummaryEl.innerHTML = workbenchHtml;
    } else {
      workbenchSummaryEl.classList.remove("is-visible");
      workbenchSummaryEl.innerHTML = "";
    }

    const commitSchemeRuleView = async (nextView) => {
      const next = nextView === "history" ? "history" : "current";
      if (next === schemeRuleRegisterView) return;
      schemeRuleRegisterView = next;
      workbenchSummaryEl
        .querySelectorAll("[data-scheme-rule-view]")
        .forEach((btn) => {
          const active = btn.dataset.schemeRuleView === next;
          btn.classList.toggle("active", active);
          btn.setAttribute("aria-selected", active ? "true" : "false");
        });
      const viewSelect = workbenchSummaryEl.querySelector(
        "#schemeRuleRegisterViewSelect",
      );
      if (viewSelect) viewSelect.value = next;
      if (typeof onTabChange === "function") await onTabChange();
    };

    workbenchSummaryEl
      .querySelectorAll("[data-scheme-rule-view]")
      .forEach((btn) => {
        btn.addEventListener("click", async () => {
          await commitSchemeRuleView(btn.dataset.schemeRuleView);
        });
      });
    workbenchSummaryEl
      .querySelector("#schemeRuleRegisterViewSelect")
      ?.addEventListener("change", async (event) => {
        await commitSchemeRuleView(event.target?.value);
      });
  }

  function wirePolicyManagerTableActions() {
    // Table Action columns removed; Edit / Deactivate / Reactivate / Close live in the row drawer.
  }

  function getPolicyManagerDrawerConfig(row, preferredTab) {
    const managerTab = getPolicyManagerTab();

    if (managerTab === "scheme-master") {
      return {
        title: row.scheme_name || `Scheme ${row.scheme_id}` || "Scheme Master",
        subtitle: [schemeMasterTypeLabel(row), schemeMasterStatusLabel(row)]
          .filter((part) => part && part !== "--")
          .join(" · "),
        tabs: [
          { id: "scheme-detail", label: "Scheme Detail" },
          { id: "scheme-history", label: "History" },
        ],
        activeTab: preferredTab || "scheme-detail",
      };
    }

    if (managerTab === "scheme-rule-register") {
      return {
        title:
          row.scheme_name ||
          (row.policy_rule_id != null
            ? `Rule #${row.policy_rule_id}`
            : "Scheme Rule"),
        subtitle: [
          row.policy_scope,
          row.scope_name,
          row.region_code,
          row.rule_status,
        ]
          .filter(Boolean)
          .join(" · "),
        tabs: [{ id: "rule-detail", label: "Rule Detail" }],
        activeTab: preferredTab || "rule-detail",
      };
    }

    const active = preferredTab || "overview";
    return {
      title: row.product_name || row.product_id || "Policy Manager",
      subtitle:
        row.sku_column_label || row.sku_display_name || row.sku_id || "",
      tabs: [
        { id: "overview", label: "Overview" },
        { id: "mrp-policy", label: "MRP Policy" },
        { id: "selling-policy", label: "Selling Policy" },
        { id: "scheme-policy", label: "Scheme Policy" },
        { id: "policy-history", label: "Policy History" },
        { id: "status", label: "Status" },
      ],
      activeTab: active,
    };
  }

  async function renderPolicyManagerDrawerTab(tabId, row) {
    if (getPolicyManagerTab() === "scheme-master") {
      if (tabId === "scheme-history") {
        try {
          return await buildSchemeMasterHistoryHtml(row);
        } catch (err) {
          handleError("Failed to load scheme history", err);
          return `<div class="status">Failed to load history.</div>`;
        }
      }

      return (
        renderSchemeMasterDrawerActions(row) +
        detailPanel([
          kvSection("Scheme Detail", [
            ["Scheme ID", text(row.scheme_id)],
            ["Scheme Name", text(row.scheme_name)],
            ["Type", schemeMasterTypeBadge(row)],
            ["Status", schemeMasterStatusChip(row)],
            [
              "Paid Qty",
              formatSchemeQty(schemeMasterRowNumber(row, ["paid_qty"])),
            ],
            [
              "Free Qty",
              formatSchemeQty(schemeMasterRowNumber(row, ["free_qty"])),
            ],
            ["Total Qty", formatSchemeQty(schemeMasterTotalQty(row))],
            [
              "Effective Free Discount %",
              formatEffectiveFreeDiscountPct(schemeMasterEffectiveDiscount(row)),
            ],
            [
              "Active Direct Policies",
              formatSchemeQty(
                schemeMasterRowNumber(row, [
                  "active_direct_policies",
                  "active_direct_policy_count",
                ]),
              ),
            ],
            [
              "Active Hierarchy Rules",
              formatSchemeQty(
                schemeMasterRowNumber(row, [
                  "active_hierarchy_rules",
                  "active_hierarchy_rule_count",
                ]),
              ),
            ],
            [
              "Viability Periods",
              formatSchemeQty(
                schemeMasterRowNumber(row, [
                  "viability_periods",
                  "viability_period_count",
                ]),
              ),
            ],
            ["Remarks", text(row.remarks)],
            ["Updated At", formatDateTime(row.updated_at)],
          ]),
        ])
      );
    }

    if (getPolicyManagerTab() === "scheme-rule-register") {
      return (
        renderSchemeRuleDrawerActions(row) +
        detailPanel([
          kvSection("Rule Detail", [
            ["Rule ID", text(row.policy_rule_id)],
            ["Status", compactStatusText(row.rule_status)],
            ["Scope", text(row.policy_scope)],
            ["Scope Name", text(row.scope_name)],
            ["Region", text(row.region_code)],
            ["Scheme", text(row.scheme_name)],
            ["Paid Qty", formatNumber(row.paid_qty)],
            ["Free Qty", formatNumber(row.free_qty)],
            ["Apply Mode", text(row.apply_mode)],
            ["Replace From", text(row.replace_from_scheme_name)],
            ["Effective From", formatDate(row.effective_from)],
            ["Effective To", formatDate(row.effective_to)],
            ["Remarks", text(row.remarks)],
          ]),
        ])
      );
    }

    if (tabId === "overview") {
      return detailPanel([
        kvSection("Policy Overview", [
          ["Product", text(row.product_name || row.product_id)],
          ["SKU", text(row.sku_column_label || row.sku_display_name || row.sku_id)],
          [
            "MRP IK / OK",
            `${formatOptionalMoney(row.mrp_ik)} / ${formatOptionalMoney(row.mrp_ok)}`,
          ],
          ["GST %", formatPercent(row.gst_percent)],
          ["IK Discount %", formatPercent(row.ik_discount_percent)],
          ["OK Discount %", formatPercent(row.ok_discount_percent)],
          ["Contingency %", formatPercent(row.contingency_percent)],
          [
            "IK Scheme",
            `${text(row.ik_selected_scheme_name)}<div class="cp-muted-text">${text(row.ik_policy_source_label)}</div>`,
          ],
          [
            "OK Scheme",
            `${text(row.ok_selected_scheme_name)}<div class="cp-muted-text">${text(row.ok_policy_source_label)}</div>`,
          ],
        ]),
      ]);
    }

    if (tabId === "mrp-policy") {
      const { data: currentPolicy, error } = await fetchCurrentMrpPolicy(
        row.sku_id,
      );
      if (error) {
        throw error;
      }
      return renderMrpPolicyTabContent(row, currentPolicy);
    }

    if (tabId === "selling-policy") {
      const editButton = canEditPolicyActions()
        ? `
      <div class="cp-drawer-action-bar">
        <button
          type="button"
          class="icon-btn icon-btn-primary"
          id="editSellingPolicyBtn"
          title="Edit Selling Policy"
          aria-label="Edit Selling Policy"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
          </svg>
          Edit Selling Policy
        </button>
      </div>
    `
        : "";

      return (
        editButton +
        detailPanel([
          kvSection("Selling Policy", [
            ["Selling Price Policy ID", text(row.selling_price_policy_id)],
            ["GST %", formatPercent(row.gst_percent)],
            ["IK Discount %", formatPercent(row.ik_discount_percent)],
            ["OK Discount %", formatPercent(row.ok_discount_percent)],
            [
              "IK Fixed Discount Amount",
              formatOptionalMoney(row.ik_discount_amount),
            ],
            [
              "OK Fixed Discount Amount",
              formatOptionalMoney(row.ok_discount_amount),
            ],
            ["Contingency %", formatPercent(row.contingency_percent)],
            ["Effective From", formatDate(row.selling_price_effective_from)],
            ["Effective To", formatDate(row.selling_price_effective_to)],
            ["Active", text(row.selling_price_policy_active)],
            ["Remarks", text(row.selling_price_policy_remarks)],
          ]),
        ])
      );
    }

    if (tabId === "scheme-policy") {
      const schemeActions = canEditPolicyActions()
        ? `
      <div class="cp-drawer-action-bar">
        <button
          type="button"
          class="icon-btn icon-btn-primary"
          id="editSchemePolicyIkBtn"
          title="Edit IK Scheme"
          aria-label="Edit IK Scheme"
        >
          Edit IK Scheme
        </button>
        <button
          type="button"
          class="icon-btn icon-btn-primary"
          id="editSchemePolicyOkBtn"
          title="Edit OK Scheme"
          aria-label="Edit OK Scheme"
        >
          Edit OK Scheme
        </button>
      </div>
    `
        : "";

      const schemeTable = simpleTable(
        [
          "Region",
          "Scheme",
          "Source",
          "Scope",
          "Rule ID",
          "Apply Mode",
          "Paid Qty",
          "Free Qty",
          "Effective From",
          "Effective To",
          "Active",
          "Remarks",
        ],
        [
          {
            region: "IK",
            scheme: row.ik_selected_scheme_name,
            source: row.ik_policy_source_label,
            scope: row.ik_policy_scope,
            ruleId: row.ik_policy_rule_id,
            applyMode: row.ik_apply_mode,
            paid: row.ik_scheme_paid_qty,
            free: row.ik_scheme_free_qty,
            from: row.ik_scheme_effective_from,
            to: row.ik_scheme_effective_to,
            active: row.ik_scheme_policy_active,
            remarks: row.ik_remarks,
          },
          {
            region: "OK",
            scheme: row.ok_selected_scheme_name,
            source: row.ok_policy_source_label,
            scope: row.ok_policy_scope,
            ruleId: row.ok_policy_rule_id,
            applyMode: row.ok_apply_mode,
            paid: row.ok_scheme_paid_qty,
            free: row.ok_scheme_free_qty,
            from: row.ok_scheme_effective_from,
            to: row.ok_scheme_effective_to,
            active: row.ok_scheme_policy_active,
            remarks: row.ok_remarks,
          },
        ],
        (r) =>
          `<tr>
          <td>${text(r.region)}</td>
          <td>${text(r.scheme)}</td>
          <td>${text(r.source)}</td>
          <td>${text(r.scope)}</td>
          <td>${text(r.ruleId)}</td>
          <td>${text(r.applyMode)}</td>
          <td class="c-right">${formatNumber(r.paid)}</td>
          <td class="c-right">${formatNumber(r.free)}</td>
          <td>${formatDate(r.from)}</td>
          <td>${formatDate(r.to)}</td>
          <td>${text(r.active)}</td>
          <td>${text(r.remarks)}</td>
        </tr>`,
      );

      return schemeActions + schemeTable;
    }

    if (tabId === "policy-history") {
      const sellingRows = await fetchSellingPolicyHistory(row);
      const schemeRows = await fetchSchemePolicyHistory(row);
      const mrpRows = await fetchMrpPolicyHistory(row);

      const sellingTable = simpleTable(
        [
          "Policy ID",
          "GST %",
          "IK Discount %",
          "OK Discount %",
          "IK Fixed Discount",
          "OK Fixed Discount",
          "Contingency %",
          "Effective From",
          "Effective To",
          "Active",
          "Remarks",
          "Updated At",
        ],
        sellingRows,
        (r) =>
          `<tr>
          <td>${text(r.policy_id)}</td>
          <td class="c-right">${formatPercent(r.gst_percent)}</td>
          <td class="c-right">${formatPercent(r.ik_discount_percent)}</td>
          <td class="c-right">${formatPercent(r.ok_discount_percent)}</td>
          <td class="c-right">${formatOptionalMoney(r.ik_discount_amount)}</td>
          <td class="c-right">${formatOptionalMoney(r.ok_discount_amount)}</td>
          <td class="c-right">${formatPercent(r.contingency_percent)}</td>
          <td>${formatDate(r.effective_from)}</td>
          <td>${formatDate(r.effective_to)}</td>
          <td>${r.is_active ? statusChip("ACTIVE") : statusChip("CLOSED")}</td>
          <td>${text(r.remarks)}</td>
          <td>${formatDateTime(r.updated_at)}</td>
        </tr>`,
      );

      const schemeTable = simpleTable(
        [
          "Policy ID",
          "Level",
          "Region",
          "Scheme",
          "Paid Qty",
          "Free Qty",
          "Effective From",
          "Effective To",
          "Active",
          "Remarks",
          "Updated At",
        ],
        schemeRows,
        (r) =>
          `<tr>
          <td>${text(r.policy_id)}</td>
          <td>${text(r.policy_level)}</td>
          <td>${text(r.region_code)}</td>
          <td>${text(r.scheme_name)}</td>
          <td class="c-right">${formatNumber(r.paid_qty)}</td>
          <td class="c-right">${formatNumber(r.free_qty)}</td>
          <td>${formatDate(r.effective_from)}</td>
          <td>${formatDate(r.effective_to)}</td>
          <td>${r.is_active ? statusChip("ACTIVE") : statusChip("CLOSED")}</td>
          <td>${text(r.remarks)}</td>
          <td>${formatDateTime(r.updated_at)}</td>
        </tr>`,
      );

      const mrpTable = simpleTable(
        [
          "Lifecycle",
          "Policy ID",
          "MRP IK",
          "MRP OK",
          "OK Uplift %",
          "Mode",
          "Effective From",
          "Effective To",
          "Reason",
          "Approval Ref",
          "Source Type",
          "Source Quality",
          "Prev Policy",
          "Created At",
          "Created By",
          "Closed At",
          "Closed By",
        ],
        mrpRows,
        (r) =>
          `<tr>
          <td>${compactStatusText(r.lifecycle_label || r.status)}</td>
          <td>${text(r.policy_id)}</td>
          <td class="c-right">${formatOptionalMoney(r.mrp_ik)}</td>
          <td class="c-right">${formatOptionalMoney(r.mrp_ok)}</td>
          <td class="c-right">${formatOkPctFromDecimal(r.ok_pct)}</td>
          <td>${text(r.calc_mode)}</td>
          <td>${formatDate(r.effective_from)}</td>
          <td>${formatDate(r.effective_to)}</td>
          <td>${text(r.reason)}</td>
          <td>${text(r.approval_reference)}</td>
          <td>${text(r.source_type)}</td>
          <td>${formatMrpSourceQualityLabel(r.source_quality, r.source_type)}</td>
          <td>${text(r.previous_policy_id)}</td>
          <td>${formatDateTime(r.created_at)}</td>
          <td>${text(r.created_by)}</td>
          <td>${formatDateTime(r.closed_at)}</td>
          <td>${text(r.closed_by)}</td>
        </tr>`,
      );

      return `
      <div class="cp-card" style="margin-bottom:10px">
        <div class="cp-card-label">Policy History</div>
        <div class="cp-card-value">
          This section shows the audit trail of selling price, scheme, and MRP policy changes for the selected SKU.
        </div>
      </div>

      <h3 class="cp-section-title">Selling Price Policy History</h3>
      ${sellingTable}

      <h3 class="cp-section-title" style="margin-top:14px">Scheme Policy History</h3>
      ${schemeTable}

      <h3 class="cp-section-title" style="margin-top:14px">MRP Policy History</h3>
      ${mrpTable}
    `;
    }

    return detailPanel([
      kvSection("Policy Status", [
        ["Pricing Bridge Status", compactStatusText(row.pricing_bridge_status)],
        [
          "Selling Price Bridge Status",
          compactStatusText(row.selling_price_bridge_status),
        ],
        ["Selling Price Bridge Note", text(row.selling_price_bridge_note)],
        ["Refreshed At", formatDateTime(row.refreshed_at)],
      ]),
    ]);
  }

  function wirePolicyManagerDrawerActions(tabId, row) {
    if (getPolicyManagerTab() === "scheme-master") {
      document
        .getElementById("schemeMasterDrawerEditBtn")
        ?.addEventListener("click", () => openSchemeMasterMetadataModal(row));
      document
        .getElementById("schemeMasterDrawerDeactivateBtn")
        ?.addEventListener("click", () => openSchemeMasterDeactivateModal(row));
      document
        .getElementById("schemeMasterDrawerReactivateBtn")
        ?.addEventListener("click", () => openSchemeMasterReactivateModal(row));
      return;
    }

    if (getPolicyManagerTab() === "scheme-rule-register") {
      document
        .getElementById("schemeRuleDrawerCloseBtn")
        ?.addEventListener("click", () => openSchemeRuleCloseModal(row));
      return;
    }

    if (tabId === "mrp-policy") {
      document.getElementById("editMrpPolicyBtn")?.addEventListener(
        "click",
        () => openMrpPolicyEditModal(row),
      );
    }

    if (tabId === "selling-policy") {
      document.getElementById("editSellingPolicyBtn")?.addEventListener(
        "click",
        () => openSellingPolicyEditModal(row),
      );
    }

    if (tabId === "scheme-policy") {
      document.getElementById("editSchemePolicyIkBtn")?.addEventListener(
        "click",
        () => openSchemePolicyEditModal(row, "IK"),
      );
      document.getElementById("editSchemePolicyOkBtn")?.addEventListener(
        "click",
        () => openSchemePolicyEditModal(row, "OK"),
      );
    }
  }

  function handleEscapeKey() {
    if (mrpAppliedHistory.handleEscapeKey?.()) return true;
    if (mrpApplication.handleEscapeKey?.()) return true;
    if (mrpDecisions.handleEscapeKey?.()) return true;
    if (mrpProposals.handleEscapeKey?.()) return true;
    if (!dom.scheduledPolicyCancelModal?.classList.contains("hidden")) {
      if (!scheduledPolicyCancellationSaving) {
        closeScheduledPolicyCancellationModal();
      }
      return true;
    }
    if (!dom.futurePolicyConfirmModal?.classList.contains("hidden")) {
      if (!futurePolicySubmissionRunning) closeFuturePolicyConfirmation();
      return true;
    }
    if (!dom.derivationPolicyConfirmModal?.classList.contains("hidden")) {
      finishDerivationPolicyConfirmation(false);
      return true;
    }
    if (!dom.sellingPolicyEditModal?.classList.contains("hidden")) {
      closeSellingPolicyEditModal();
      return true;
    }
    if (!dom.schemePolicyEditModal?.classList.contains("hidden")) {
      closeSchemePolicyEditModal();
      return true;
    }
    if (!dom.schemeRuleEditModal?.classList.contains("hidden")) {
      closeSchemeRuleEditModal();
      return true;
    }
    if (!dom.schemeRuleCloseModal?.classList.contains("hidden")) {
      closeSchemeRuleCloseModal();
      return true;
    }
    if (!dom.mrpPolicyEditModal?.classList.contains("hidden")) {
      closeMrpPolicyEditModal();
      return true;
    }
    if (!dom.derivationPolicyEditModal?.classList.contains("hidden")) {
      closeDerivationPolicyEditModal();
      return true;
    }
    if (!dom.schemeMasterCreateModal?.classList.contains("hidden")) {
      closeSchemeMasterCreateModal();
      return true;
    }
    if (!dom.schemeMasterMetadataModal?.classList.contains("hidden")) {
      closeSchemeMasterMetadataModal();
      return true;
    }
    if (!dom.schemeMasterDeactivateModal?.classList.contains("hidden")) {
      closeSchemeMasterDeactivateModal();
      return true;
    }
    if (!dom.schemeMasterReactivateModal?.classList.contains("hidden")) {
      closeSchemeMasterReactivateModal();
      return true;
    }
    if (!dom.schemeMasterHistoryModal?.classList.contains("hidden")) {
      closeSchemeMasterHistoryModal();
      return true;
    }
    return false;
  }

  function bindEvents() {
    syncPricingPolicyWriteUi();
    mrpProposals.bindEvents?.();
    mrpDecisions.bindEvents?.();
    mrpApplication.bindEvents?.();
    mrpAppliedHistory.bindEvents?.();
    dom.sellingPolicyEditCloseBtn?.addEventListener(
      "click",
      closeSellingPolicyEditModal,
    );
    dom.sellingPolicyEditCancelBtn?.addEventListener(
      "click",
      closeSellingPolicyEditModal,
    );
    dom.sellingPolicyEditSaveBtn?.addEventListener(
      "click",
      saveSellingPolicyEdit,
    );
    dom.sellingPolicyEditModal?.addEventListener("click", (e) => {
      if (e.target === dom.sellingPolicyEditModal) closeSellingPolicyEditModal();
    });
    [
      dom.sellingPolicyGstPercent,
      dom.sellingPolicyIkDiscountPercent,
      dom.sellingPolicyOkDiscountPercent,
      dom.sellingPolicyIkDiscountAmount,
      dom.sellingPolicyOkDiscountAmount,
      dom.sellingPolicyContingencyPercent,
    ].forEach((input) => {
      input?.addEventListener("input", setSellingPolicySaveState);
    });
    dom.schemePolicyEditCloseBtn?.addEventListener(
      "click",
      closeSchemePolicyEditModal,
    );
    dom.schemePolicyEditCancelBtn?.addEventListener(
      "click",
      closeSchemePolicyEditModal,
    );
    dom.schemePolicyEditSaveBtn?.addEventListener("click", saveSchemePolicyEdit);
    dom.schemePolicyEditRegion?.addEventListener("change", () => {
      populateSchemePolicySelectionForRegion(dom.schemePolicyEditRegion.value);
    });
    dom.schemePolicyEditScheme?.addEventListener("change", setSchemePolicySaveState);
    dom.schemePolicyEditModal?.addEventListener("click", (e) => {
      if (e.target === dom.schemePolicyEditModal) closeSchemePolicyEditModal();
    });
    dom.schemeRuleEditCloseBtn?.addEventListener("click", closeSchemeRuleEditModal);
    dom.schemeRuleEditCancelBtn?.addEventListener("click", closeSchemeRuleEditModal);
    dom.schemeRuleEditSaveBtn?.addEventListener("click", saveSchemeRuleEdit);
    dom.schemeRuleScope?.addEventListener("change", () => {
      if (dom.schemeRuleScopeSearch) {
        dom.schemeRuleScopeSearch.value = "";
      }

      populateSchemeRuleScopeOptions();
      setSchemeRuleSaveState();
    });
    dom.schemeRuleScopeSearch?.addEventListener("input", () => {
      populateSchemeRuleScopeOptions();
      setSchemeRuleSaveState();
    });
    dom.schemeRuleScopeSelect?.addEventListener("change", setSchemeRuleSaveState);
    dom.schemeRuleRegion?.addEventListener("change", setSchemeRuleSaveState);
    dom.schemeRuleScheme?.addEventListener("change", setSchemeRuleSaveState);
    dom.schemeRuleReplaceFromScheme?.addEventListener(
      "change",
      setSchemeRuleSaveState,
    );
    dom.schemeRuleEffectiveFrom?.addEventListener("change", setSchemeRuleSaveState);
    dom.schemeRuleRemarks?.addEventListener("input", setSchemeRuleSaveState);
    dom.schemeRuleApplyMode?.addEventListener("change", () => {
      syncSchemeRuleApplyModeUi();
      setSchemeRuleSaveState();
    });
    dom.schemeRuleEditModal?.addEventListener("click", (e) => {
      if (e.target === dom.schemeRuleEditModal) closeSchemeRuleEditModal();
    });
    dom.schemeRuleCloseCloseBtn?.addEventListener(
      "click",
      closeSchemeRuleCloseModal,
    );
    dom.schemeRuleCloseCancelBtn?.addEventListener(
      "click",
      closeSchemeRuleCloseModal,
    );
    dom.schemeRuleCloseSaveBtn?.addEventListener("click", saveSchemeRuleClose);
    dom.schemeRuleCloseEffectiveTo?.addEventListener(
      "change",
      setSchemeRuleCloseSaveState,
    );
    dom.schemeRuleCloseRemarks?.addEventListener(
      "input",
      setSchemeRuleCloseSaveState,
    );
    dom.mrpPolicyEditCloseBtn?.addEventListener("click", closeMrpPolicyEditModal);
    dom.mrpPolicyEditCancelBtn?.addEventListener("click", closeMrpPolicyEditModal);
    dom.mrpPolicyEditSaveBtn?.addEventListener("click", saveMrpPolicyEdit);
    dom.mrpPolicyEditModal?.addEventListener("click", (e) => {
      if (e.target === dom.mrpPolicyEditModal) closeMrpPolicyEditModal();
    });
    dom.mrpPolicyEditCalcMode?.addEventListener("change", () => {
      syncMrpCalcModeFieldVisibility();
      updateMrpPolicyPreview();
    });
    const onMrpDriverInput = (driver) => () => {
      if (mrpFieldSyncing) return;
      if (getSelectedMrpCalcMode() === "AUTO" && driver === "OK_MRP") return;
      if (getSelectedMrpCalcMode() === "MANUAL" && driver === "OK_PCT") return;
      mrpInputDriver = driver;
      updateMrpPolicyPreview();
    };
    dom.mrpPolicyEditMrpOk?.addEventListener("input", onMrpDriverInput("OK_MRP"));
    dom.mrpPolicyEditMrpOk?.addEventListener("change", onMrpDriverInput("OK_MRP"));
    dom.mrpPolicyEditOkPct?.addEventListener("input", onMrpDriverInput("OK_PCT"));
    dom.mrpPolicyEditOkPct?.addEventListener("change", onMrpDriverInput("OK_PCT"));
    [
      dom.mrpPolicyEditMrpIk,
      dom.mrpPolicyEditEffectiveFrom,
      dom.mrpPolicyEditReason,
      dom.mrpPolicyEditApprovalReference,
    ].forEach((input) => {
      input?.addEventListener("input", () => {
        if (mrpFieldSyncing) return;
        updateMrpPolicyPreview();
      });
      input?.addEventListener("change", () => {
        if (mrpFieldSyncing) return;
        updateMrpPolicyPreview();
      });
    });
    dom.derivationPolicyEditCloseBtn?.addEventListener(
      "click",
      closeDerivationPolicyEditModal,
    );
    dom.derivationPolicyEditCancelBtn?.addEventListener(
      "click",
      closeDerivationPolicyEditModal,
    );
    dom.derivationPolicyEditModal?.addEventListener("click", (e) => {
      if (e.target === dom.derivationPolicyEditModal) {
        closeDerivationPolicyEditModal();
      }
    });
    dom.derivationPolicyEditProduct?.addEventListener("change", () => {
      void onDerivationProductChange();
    });
    dom.derivationPolicyEditReferenceSku?.addEventListener("change", () => {
      updateDerivationReferenceMrpDisplay();
      setDerivationSaveState();
    });
    [
      dom.derivationPolicyEditSmallerPct,
      dom.derivationPolicyEditLargerPct,
      dom.derivationPolicyEditCeiling,
      dom.derivationPolicyEditEffectiveFrom,
      dom.derivationPolicyEditReason,
      dom.derivationPolicyEditApprovalReference,
    ].forEach((input) => {
      input?.addEventListener("input", setDerivationSaveState);
      input?.addEventListener("change", setDerivationSaveState);
    });
    dom.derivationPolicyEditDraftBtn?.addEventListener("click", () => {
      void saveDerivationPolicy(false);
    });
    dom.derivationPolicyEditConfirmBtn?.addEventListener("click", () => {
      void saveDerivationPolicy(true);
    });
    dom.derivationPolicyConfirmCloseBtn?.addEventListener("click", () => {
      finishDerivationPolicyConfirmation(false);
    });
    dom.derivationPolicyConfirmCancelBtn?.addEventListener("click", () => {
      finishDerivationPolicyConfirmation(false);
    });
    dom.derivationPolicyConfirmProceedBtn?.addEventListener("click", () => {
      finishDerivationPolicyConfirmation(true);
    });
    dom.derivationPolicyConfirmModal?.addEventListener("click", (e) => {
      if (e.target === dom.derivationPolicyConfirmModal) {
        finishDerivationPolicyConfirmation(false);
      }
    });
    dom.futurePolicyConfirmCloseBtn?.addEventListener(
      "click",
      closeFuturePolicyConfirmation,
    );
    dom.futurePolicyConfirmReviewBtn?.addEventListener(
      "click",
      closeFuturePolicyConfirmation,
    );
    dom.futurePolicyConfirmProceedBtn?.addEventListener("click", () => {
      void confirmFuturePolicySubmission();
    });
    dom.futurePolicyConfirmModal?.addEventListener("click", (e) => {
      if (
        e.target === dom.futurePolicyConfirmModal &&
        !futurePolicySubmissionRunning
      ) {
        closeFuturePolicyConfirmation();
      }
    });
    dom.scheduledPolicyCancelCloseBtn?.addEventListener(
      "click",
      closeScheduledPolicyCancellationModal,
    );
    dom.scheduledPolicyCancelKeepBtn?.addEventListener(
      "click",
      closeScheduledPolicyCancellationModal,
    );
    dom.scheduledPolicyCancelProceedBtn?.addEventListener("click", () => {
      void submitScheduledPolicyCancellation();
    });
    dom.scheduledPolicyCancelReason?.addEventListener("input", () => {
      scheduledPolicyCancellationReasonTouched = true;
      setScheduledPolicyCancellationState();
    });
    dom.scheduledPolicyCancelApprovalReference?.addEventListener(
      "input",
      setScheduledPolicyCancellationState,
    );
    dom.scheduledPolicyCancelModal?.addEventListener("click", (e) => {
      if (
        e.target === dom.scheduledPolicyCancelModal &&
        !scheduledPolicyCancellationSaving
      ) {
        closeScheduledPolicyCancellationModal();
      }
    });
    dom.schemeMasterCreateCloseBtn?.addEventListener(
      "click",
      closeSchemeMasterCreateModal,
    );
    dom.schemeMasterCreateCancelBtn?.addEventListener(
      "click",
      closeSchemeMasterCreateModal,
    );
    dom.schemeMasterCreateSaveBtn?.addEventListener("click", saveSchemeMasterCreate);
    dom.schemeMasterCreateModal?.addEventListener("click", (e) => {
      if (e.target === dom.schemeMasterCreateModal) closeSchemeMasterCreateModal();
    });
    [
      dom.schemeMasterCreateName,
      dom.schemeMasterCreatePaidQty,
      dom.schemeMasterCreateFreeQty,
      dom.schemeMasterCreateRemarks,
      dom.schemeMasterCreateApprovalReference,
    ].forEach((input) => {
      input?.addEventListener("input", updateSchemeCreatePreview);
      input?.addEventListener("change", updateSchemeCreatePreview);
    });
    dom.schemeMasterMetadataCloseBtn?.addEventListener(
      "click",
      closeSchemeMasterMetadataModal,
    );
    dom.schemeMasterMetadataCancelBtn?.addEventListener(
      "click",
      closeSchemeMasterMetadataModal,
    );
    dom.schemeMasterMetadataSaveBtn?.addEventListener(
      "click",
      saveSchemeMasterMetadata,
    );
    dom.schemeMasterMetadataModal?.addEventListener("click", (e) => {
      if (e.target === dom.schemeMasterMetadataModal) {
        closeSchemeMasterMetadataModal();
      }
    });
    [
      dom.schemeMasterMetadataName,
      dom.schemeMasterMetadataRemarks,
      dom.schemeMasterMetadataReason,
      dom.schemeMasterMetadataApprovalReference,
    ].forEach((input) => {
      input?.addEventListener("input", setSchemeMasterMetadataSaveState);
      input?.addEventListener("change", setSchemeMasterMetadataSaveState);
    });
    dom.schemeMasterDeactivateCloseBtn?.addEventListener(
      "click",
      closeSchemeMasterDeactivateModal,
    );
    dom.schemeMasterDeactivateCancelBtn?.addEventListener(
      "click",
      closeSchemeMasterDeactivateModal,
    );
    dom.schemeMasterDeactivateSaveBtn?.addEventListener(
      "click",
      saveSchemeMasterDeactivate,
    );
    dom.schemeMasterDeactivateModal?.addEventListener("click", (e) => {
      if (e.target === dom.schemeMasterDeactivateModal) {
        closeSchemeMasterDeactivateModal();
      }
    });
    [
      dom.schemeMasterDeactivateReason,
      dom.schemeMasterDeactivateApprovalReference,
    ].forEach((input) => {
      input?.addEventListener("input", setSchemeMasterDeactivateSaveState);
      input?.addEventListener("change", setSchemeMasterDeactivateSaveState);
    });
    dom.schemeMasterReactivateCloseBtn?.addEventListener(
      "click",
      closeSchemeMasterReactivateModal,
    );
    dom.schemeMasterReactivateCancelBtn?.addEventListener(
      "click",
      closeSchemeMasterReactivateModal,
    );
    dom.schemeMasterReactivateSaveBtn?.addEventListener(
      "click",
      saveSchemeMasterReactivate,
    );
    dom.schemeMasterReactivateModal?.addEventListener("click", (e) => {
      if (e.target === dom.schemeMasterReactivateModal) {
        closeSchemeMasterReactivateModal();
      }
    });
    [
      dom.schemeMasterReactivateReason,
      dom.schemeMasterReactivateApprovalReference,
    ].forEach((input) => {
      input?.addEventListener("input", setSchemeMasterReactivateSaveState);
      input?.addEventListener("change", setSchemeMasterReactivateSaveState);
    });
    dom.schemeMasterHistoryCloseBtn?.addEventListener(
      "click",
      closeSchemeMasterHistoryModal,
    );
    dom.schemeMasterHistoryDismissBtn?.addEventListener(
      "click",
      closeSchemeMasterHistoryModal,
    );
    dom.schemeMasterHistoryModal?.addEventListener("click", (e) => {
      if (e.target === dom.schemeMasterHistoryModal) closeSchemeMasterHistoryModal();
    });
  }

  return {
    bindEvents,
    handleEscapeKey,
    loadOptions,
    getPolicyManagerTab,
    setPolicyManagerTab,
    getMrpGovernanceTab,
    setMrpGovernanceTab,
    getPricingPolicyArea,
    getPricingPolicyWorkspace,
    getActiveDirectWorkspaceId,
    setPricingPolicyNavigation,
    setPricingPolicyWorkspace,
    syncNavigationFromLegacyLens,
    getSkuMrpPolicyView,
    setSkuMrpPolicyView,
    isSkuMrpPoliciesTabActive,
    loadSkuMrpPolicyRows,
    getSkuMrpFilteredRows,
    getSkuMrpDrawerConfig,
    renderSkuMrpDrawerTab,
    wireSkuMrpTableActions,
    wireSkuMrpDrawerActions,
    syncPricingPolicyMetaActions,
    getProductDerivationPolicyView,
    setProductDerivationPolicyView,
    isProductDerivationPoliciesTabActive,
    loadProductDerivationPolicyRows,
    getProductDerivationFilteredRows,
    getProductDerivationDrawerConfig,
    renderProductDerivationDrawerTab,
    wireProductDerivationTableActions,
    wireProductDerivationDrawerActions,
    openDerivationPolicyEditModal,
    closeDerivationPolicyEditModal,
    isMrpProposalsTabActive: () => mrpProposals.isMrpProposalsTabActive(),
    getMrpProposalView: () => mrpProposals.getMrpProposalView(),
    setMrpProposalView: (view) => mrpProposals.setMrpProposalView(view),
    getSelectedMrpProposalId: () => mrpProposals.getSelectedMrpProposalId(),
    loadMrpProposalRows: () => mrpProposals.loadMrpProposalRows(),
    getMrpProposalFilteredRows: () => mrpProposals.getMrpProposalFilteredRows(),
    getMrpProposalDrawerConfig: (row, preferredTab) =>
      mrpProposals.getDrawerConfig(row, preferredTab),
    renderMrpProposalDrawerTab: (tabId, row) =>
      mrpProposals.renderDrawerTab(tabId, row),
    wireMrpProposalTableActions: (tableBody, getViewRow) =>
      mrpProposals.wireTableActions(tableBody, getViewRow),
    wireMrpProposalDrawerActions: (tabId, row) =>
      mrpProposals.wireDrawerActions(tabId, row),
    getMrpProposalEmptyStatusMessage: () => mrpProposals.emptyStatusMessage(),
    getMrpProposalNoMatchMessage: () => mrpProposals.noMatchMessage(),
    isMrpDecisionsTabActive: () => mrpDecisions.isMrpDecisionsTabActive(),
    getMrpDecisionView: () => mrpDecisions.getMrpDecisionView(),
    setMrpDecisionView: (view) => mrpDecisions.setMrpDecisionView(view),
    getSelectedDecisionProposalId: () =>
      mrpDecisions.getSelectedDecisionProposalId(),
    loadMrpDecisionRows: () => mrpDecisions.loadMrpDecisionRows(),
    getMrpDecisionFilteredRows: () => mrpDecisions.getMrpDecisionFilteredRows(),
    getMrpDecisionDrawerConfig: (row, preferredTab) =>
      mrpDecisions.getDrawerConfig(row, preferredTab),
    renderMrpDecisionDrawerTab: (tabId, row) =>
      mrpDecisions.renderDrawerTab(tabId, row),
    wireMrpDecisionTableActions: (tableBody, getViewRow) =>
      mrpDecisions.wireTableActions(tableBody, getViewRow),
    wireMrpDecisionDrawerActions: (tabId, row) =>
      mrpDecisions.wireDrawerActions(tabId, row),
    getMrpDecisionEmptyStatusMessage: () => mrpDecisions.emptyStatusMessage(),
    getMrpDecisionNoMatchMessage: () => mrpDecisions.noMatchMessage(),
    isMrpApplicationTabActive: () => mrpApplication.isMrpApplicationTabActive(),
    getMrpApplicationView: () => mrpApplication.getMrpApplicationView(),
    setMrpApplicationView: (view) => mrpApplication.setMrpApplicationView(view),
    getSelectedApplicationProposalId: () =>
      mrpApplication.getSelectedApplicationProposalId(),
    loadMrpApplicationRows: () => mrpApplication.loadMrpApplicationRows(),
    getMrpApplicationFilteredRows: () =>
      mrpApplication.getMrpApplicationFilteredRows(),
    getMrpApplicationDrawerConfig: (row, preferredTab) =>
      mrpApplication.getDrawerConfig(row, preferredTab),
    renderMrpApplicationDrawerTab: (tabId, row) =>
      mrpApplication.renderDrawerTab(tabId, row),
    wireMrpApplicationTableActions: (tableBody, getViewRow) =>
      mrpApplication.wireTableActions(tableBody, getViewRow),
    wireMrpApplicationDrawerActions: (tabId, row) =>
      mrpApplication.wireDrawerActions(tabId, row),
    getMrpApplicationEmptyStatusMessage: () =>
      mrpApplication.emptyStatusMessage(),
    getMrpApplicationNoMatchMessage: () => mrpApplication.noMatchMessage(),
    isMrpAppliedHistoryTabActive: () =>
      mrpAppliedHistory.isMrpAppliedHistoryTabActive(),
    getMrpAppliedHistoryView: () => mrpAppliedHistory.getMrpAppliedHistoryView(),
    setMrpAppliedHistoryView: (view) =>
      mrpAppliedHistory.setMrpAppliedHistoryView(view),
    getSelectedAppliedProposalId: () =>
      mrpAppliedHistory.getSelectedAppliedProposalId(),
    loadMrpAppliedHistoryRows: () => mrpAppliedHistory.loadMrpAppliedHistoryRows(),
    getMrpAppliedHistoryFilteredRows: () =>
      mrpAppliedHistory.getMrpAppliedHistoryFilteredRows(),
    getMrpAppliedHistoryDrawerConfig: (row, preferredTab) =>
      mrpAppliedHistory.getDrawerConfig(row, preferredTab),
    renderMrpAppliedHistoryDrawerTab: (tabId, row) =>
      mrpAppliedHistory.renderDrawerTab(tabId, row),
    wireMrpAppliedHistoryTableActions: (tableBody, getViewRow) =>
      mrpAppliedHistory.wireTableActions(tableBody, getViewRow),
    wireMrpAppliedHistoryDrawerActions: (tabId, row) =>
      mrpAppliedHistory.wireDrawerActions(tabId, row),
    getMrpAppliedHistoryEmptyStatusMessage: () =>
      mrpAppliedHistory.emptyStatusMessage(),
    getMrpAppliedHistoryNoMatchMessage: () =>
      mrpAppliedHistory.noMatchMessage(),
    loadPolicyManagerRows,
    renderPolicyManagerTabs,
    renderMrpGovernanceTabs,
    getActiveMrpFilterDrawerContent,
    wireActiveMrpFilterDrawer,
    /** N5 aliases — same canonical workspace strip renderers */
    renderPricingPolicySellingWorkspaceNavigation: renderPolicyManagerTabs,
    renderPricingPolicyMrpWorkspaceNavigation: renderMrpGovernanceTabs,
    renderMrpGovernanceEmptyStateHtml,
    wirePolicyManagerTableActions,
    getTableHeaders,
    getTableAlignments,
    renderTableRow,
    getPolicyManagerDrawerConfig,
    renderPolicyManagerDrawerTab,
    wirePolicyManagerDrawerActions,
    syncPricingPolicyWriteUi,
    openSellingPolicyEditModal,
    openSchemePolicyEditModal,
    openMrpPolicyEditModal,
    openSchemeRuleCloseModal,
    openSchemeRuleEditModal,
    closeSellingPolicyEditModal,
    closeSchemePolicyEditModal,
    closeMrpPolicyEditModal,
    closeSchemeRuleEditModal,
    closeSchemeRuleCloseModal,
  };
}
