/**
 * PPM launch resolver, F3 metadata, F4 workspace-only URL, F5 Area-state cleanup,
 * and SC5 relocation smoke checks. Mirrors focused helpers without the browser shell.
 */

const PRICING_POLICY_DEFAULT_AREA = "selling-schemes";
const PRICING_POLICY_DEFAULT_WORKSPACE = "sku-overview";

const PRICING_POLICY_NAV_GROUPS = [
  { id: "mrp-policy-setup", label: "MRP Policy Setup" },
  { id: "mrp-change-workflow", label: "MRP Change Workflow" },
  { id: "selling-schemes", label: "Selling & Schemes" },
];

/** F5 inbound-only: former Area → default workspace. */
const PRICING_POLICY_COMPAT_AREA_DEFAULT_WORKSPACE = {
  "mrp-policies": "sku-mrp-policies",
  "mrp-workflow": "mrp-proposals",
  "selling-schemes": "sku-overview",
};

const PRICING_POLICY_GROUP_TO_COMPAT_AREA_ID = {
  "mrp-policy-setup": "mrp-policies",
  "mrp-change-workflow": "mrp-workflow",
  "selling-schemes": "selling-schemes",
};

const PRICING_POLICY_WORKSPACES = [
  {
    id: "sku-mrp-policies",
    groupId: "mrp-policy-setup",
    supportsSearch: true,
    supportsPeq: false,
    supportsPeriod: false,
    legacyLensId: "mrp-governance",
    nestedViewType: "current-history",
  },
  {
    id: "product-derivation-policies",
    groupId: "mrp-policy-setup",
    supportsSearch: true,
    supportsPeq: false,
    supportsPeriod: false,
    legacyLensId: "mrp-governance",
    nestedViewType: "current-history",
  },
  {
    id: "mrp-proposals",
    groupId: "mrp-change-workflow",
    supportsSearch: true,
    supportsPeq: false,
    supportsPeriod: false,
    legacyLensId: "mrp-governance",
    nestedViewType: "register-workspace",
  },
  {
    id: "proposal-decisions",
    groupId: "mrp-change-workflow",
    supportsSearch: true,
    supportsPeq: false,
    supportsPeriod: false,
    legacyLensId: "mrp-governance",
    nestedViewType: "register-workspace",
  },
  {
    id: "approved-for-application",
    groupId: "mrp-change-workflow",
    supportsSearch: true,
    supportsPeq: false,
    supportsPeriod: false,
    legacyLensId: "mrp-governance",
    nestedViewType: "register-workspace",
  },
  {
    id: "applied-proposal-history",
    groupId: "mrp-change-workflow",
    supportsSearch: true,
    supportsPeq: false,
    supportsPeriod: false,
    legacyLensId: "mrp-governance",
    nestedViewType: "register-workspace",
  },
  {
    id: "sku-overview",
    groupId: "selling-schemes",
    supportsSearch: true,
    supportsPeq: true,
    supportsPeriod: false,
    legacyLensId: "policy-manager",
    nestedViewType: null,
  },
  {
    id: "scheme-master",
    groupId: "selling-schemes",
    supportsSearch: true,
    supportsPeq: true,
    supportsPeriod: false,
    legacyLensId: "policy-manager",
    nestedViewType: null,
  },
  {
    id: "scheme-rule-register",
    groupId: "selling-schemes",
    supportsSearch: true,
    supportsPeq: true,
    supportsPeriod: false,
    legacyLensId: "policy-manager",
    nestedViewType: "current-history",
  },
];

const PRICING_POLICY_WORKSPACE_IDS = PRICING_POLICY_WORKSPACES.map((w) => w.id);
const WS_BY_ID = new Map(PRICING_POLICY_WORKSPACES.map((w) => [w.id, w]));
const WS_TO_AREA = new Map();
const WS_TO_GROUP = new Map();
for (const ws of PRICING_POLICY_WORKSPACES) {
  WS_TO_GROUP.set(ws.id, ws.groupId);
  WS_TO_AREA.set(ws.id, PRICING_POLICY_GROUP_TO_COMPAT_AREA_ID[ws.groupId]);
}

const PRICING_POLICY_AREA_IDS = Object.keys(
  PRICING_POLICY_COMPAT_AREA_DEFAULT_WORKSPACE,
);

function getPricingPolicyAreaForWorkspace(workspaceId) {
  return WS_TO_AREA.get(String(workspaceId || "").trim()) || null;
}
function getPricingPolicyGroupForWorkspace(workspaceId) {
  return WS_TO_GROUP.get(String(workspaceId || "").trim()) || null;
}
function getDefaultPricingPolicyWorkspace(areaId) {
  if (arguments.length === 0 || areaId == null || areaId === "") {
    return PRICING_POLICY_DEFAULT_WORKSPACE;
  }
  const id = String(areaId || "").trim();
  if (id === "policy-manager") {
    return PRICING_POLICY_COMPAT_AREA_DEFAULT_WORKSPACE["selling-schemes"];
  }
  if (id === "mrp-governance") {
    return PRICING_POLICY_COMPAT_AREA_DEFAULT_WORKSPACE["mrp-policies"];
  }
  return (
    PRICING_POLICY_COMPAT_AREA_DEFAULT_WORKSPACE[id] ||
    PRICING_POLICY_DEFAULT_WORKSPACE
  );
}
function getLegacyLensForPricingPolicyWorkspace(workspaceId) {
  return (
    WS_BY_ID.get(String(workspaceId || "").trim())?.legacyLensId ||
    "policy-manager"
  );
}
function normalizePricingPolicyWorkspace(areaIdOrWorkspaceId, workspaceId) {
  if (arguments.length < 2) {
    const id = String(areaIdOrWorkspaceId || "").trim();
    if (id && WS_BY_ID.has(id)) return id;
    return PRICING_POLICY_DEFAULT_WORKSPACE;
  }
  const id = String(workspaceId || "").trim();
  if (id && WS_BY_ID.has(id)) return id;
  return getDefaultPricingPolicyWorkspace(areaIdOrWorkspaceId);
}
function workspaceSupportsPeq(workspaceId) {
  return !!WS_BY_ID.get(String(workspaceId || "").trim())?.supportsPeq;
}
function workspaceSupportsPeriod(workspaceId) {
  return !!WS_BY_ID.get(String(workspaceId || "").trim())?.supportsPeriod;
}
function workspaceSupportsSearch(workspaceId) {
  return !!WS_BY_ID.get(String(workspaceId || "").trim())?.supportsSearch;
}

function resolvePricingPolicyLaunchNavigation({
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
    workspaceId = normalizePricingPolicyWorkspace(rawWorkspace);
  } else if (
    rawLens === "mrp-governance" &&
    rawMrpTab &&
    WS_BY_ID.get(rawMrpTab)?.legacyLensId === "mrp-governance"
  ) {
    workspaceId = rawMrpTab;
  } else if (
    rawLens === "policy-manager" &&
    rawPolicyTab &&
    WS_BY_ID.get(rawPolicyTab)?.legacyLensId === "policy-manager"
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
  }

  const areaId =
    getPricingPolicyAreaForWorkspace(workspaceId) ||
    PRICING_POLICY_DEFAULT_AREA;
  return {
    areaId,
    workspaceId,
    legacyLensId: getLegacyLensForPricingPolicyWorkspace(workspaceId),
    isLegacyInput,
    shouldRewriteCanonicalUrl:
      isLegacyInput ||
      !workspaceProvided ||
      rawWorkspace !== workspaceId,
  };
}

function toCanonicalPricingPolicyRouteParams(params = {}) {
  const resolved = resolvePricingPolicyLaunchNavigation(params);
  const next = { ...params, workspace: resolved.workspaceId };
  delete next.lens;
  delete next.policyTab;
  delete next.mrpTab;
  delete next.policy_tab;
  delete next.mrp_tab;
  delete next.area;
  delete next.group;
  return next;
}

const expectedWorkspaceOrder = [
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

const expectedGroupByWorkspace = {
  "sku-mrp-policies": "mrp-policy-setup",
  "product-derivation-policies": "mrp-policy-setup",
  "mrp-proposals": "mrp-change-workflow",
  "proposal-decisions": "mrp-change-workflow",
  "approved-for-application": "mrp-change-workflow",
  "applied-proposal-history": "mrp-change-workflow",
  "sku-overview": "selling-schemes",
  "scheme-master": "selling-schemes",
  "scheme-rule-register": "selling-schemes",
};

const expectedLegacyByWorkspace = {
  "sku-mrp-policies": "mrp-governance",
  "product-derivation-policies": "mrp-governance",
  "mrp-proposals": "mrp-governance",
  "proposal-decisions": "mrp-governance",
  "approved-for-application": "mrp-governance",
  "applied-proposal-history": "mrp-governance",
  "sku-overview": "policy-manager",
  "scheme-master": "policy-manager",
  "scheme-rule-register": "policy-manager",
};

let metaFailed = 0;
function metaOk(label, pass, detail = "") {
  if (pass) console.log("META OK", label);
  else {
    metaFailed += 1;
    console.error("META FAIL", label, detail);
  }
}

metaOk(
  "workspace count is 9",
  PRICING_POLICY_WORKSPACE_IDS.length === 9,
  String(PRICING_POLICY_WORKSPACE_IDS.length),
);
metaOk(
  "group count is 3",
  PRICING_POLICY_NAV_GROUPS.length === 3 &&
    !PRICING_POLICY_NAV_GROUPS.some((g) => g.id === "analysis"),
);
metaOk(
  "no scheme-comparison workspace",
  !WS_BY_ID.has("scheme-comparison"),
);
metaOk(
  "no scheme-comparison area",
  !PRICING_POLICY_AREA_IDS.includes("scheme-comparison"),
);
metaOk(
  "workspace order",
  PRICING_POLICY_WORKSPACE_IDS.join(",") === expectedWorkspaceOrder.join(","),
  PRICING_POLICY_WORKSPACE_IDS.join(","),
);
metaOk(
  "invalid workspace normalizes to sku-overview",
  normalizePricingPolicyWorkspace("not-a-workspace") === "sku-overview" &&
    normalizePricingPolicyWorkspace("") === "sku-overview" &&
    normalizePricingPolicyWorkspace("scheme-comparison") === "sku-overview",
);
metaOk(
  "default workspace",
  PRICING_POLICY_DEFAULT_WORKSPACE === "sku-overview",
);
metaOk(
  "no period-capable workspace",
  PRICING_POLICY_WORKSPACES.every((w) => !w.supportsPeriod),
);

for (const id of expectedWorkspaceOrder) {
  metaOk(`normalize ${id}`, normalizePricingPolicyWorkspace(id) === id);
  metaOk(
    `group ${id}`,
    getPricingPolicyGroupForWorkspace(id) === expectedGroupByWorkspace[id],
    `${getPricingPolicyGroupForWorkspace(id)}`,
  );
  metaOk(
    `legacy ${id}`,
    getLegacyLensForPricingPolicyWorkspace(id) === expectedLegacyByWorkspace[id],
    `${getLegacyLensForPricingPolicyWorkspace(id)}`,
  );
}

for (const id of [
  "sku-mrp-policies",
  "product-derivation-policies",
  "mrp-proposals",
  "proposal-decisions",
  "approved-for-application",
  "applied-proposal-history",
]) {
  metaOk(
    `mrp caps ${id}`,
    workspaceSupportsSearch(id) &&
      !workspaceSupportsPeq(id) &&
      !workspaceSupportsPeriod(id),
  );
}
for (const id of ["sku-overview", "scheme-master", "scheme-rule-register"]) {
  metaOk(
    `selling caps ${id}`,
    workspaceSupportsSearch(id) &&
      workspaceSupportsPeq(id) &&
      !workspaceSupportsPeriod(id),
  );
}

function buildNarrowWorkspaceSelectModel() {
  return PRICING_POLICY_NAV_GROUPS.map((group) => ({
    label: group.label,
    workspaceIds: PRICING_POLICY_WORKSPACES.filter(
      (workspace) => workspace.groupId === group.id,
    ).map((workspace) => workspace.id),
  })).filter((group) => group.workspaceIds.length > 0);
}

const narrowSelectModel = buildNarrowWorkspaceSelectModel();
const expectedNarrowGroupLabels = [
  "MRP Policy Setup",
  "MRP Change Workflow",
  "Selling & Schemes",
];
const expectedNarrowGroupWorkspaces = [
  ["sku-mrp-policies", "product-derivation-policies"],
  [
    "mrp-proposals",
    "proposal-decisions",
    "approved-for-application",
    "applied-proposal-history",
  ],
  ["sku-overview", "scheme-master", "scheme-rule-register"],
];

metaOk(
  "F3 narrow optgroup count",
  narrowSelectModel.length === 3,
  String(narrowSelectModel.length),
);
metaOk(
  "F3 narrow optgroup labels",
  narrowSelectModel.map((group) => group.label).join("|") ===
    expectedNarrowGroupLabels.join("|"),
  narrowSelectModel.map((group) => group.label).join("|"),
);
for (let i = 0; i < expectedNarrowGroupWorkspaces.length; i += 1) {
  metaOk(
    `F3 narrow optgroup ${i + 1} workspaces`,
    narrowSelectModel[i]?.workspaceIds.join(",") ===
      expectedNarrowGroupWorkspaces[i].join(","),
    narrowSelectModel[i]?.workspaceIds.join(","),
  );
}
metaOk(
  "scheme-rule-register nested view",
  WS_BY_ID.get("scheme-rule-register")?.nestedViewType === "current-history",
);

const cases = [
  [{}, { areaId: "selling-schemes", workspaceId: "sku-overview" }],
  [
    { lens: "mrp-policies", workspace: "sku-mrp-policies" },
    { areaId: "mrp-policies", workspaceId: "sku-mrp-policies" },
  ],
  [
    { lens: "mrp-policies", workspace: "product-derivation-policies" },
    { areaId: "mrp-policies", workspaceId: "product-derivation-policies" },
  ],
  [
    { lens: "mrp-workflow", workspace: "mrp-proposals" },
    { areaId: "mrp-workflow", workspaceId: "mrp-proposals" },
  ],
  [
    { lens: "mrp-workflow", workspace: "proposal-decisions" },
    { areaId: "mrp-workflow", workspaceId: "proposal-decisions" },
  ],
  [
    { lens: "mrp-workflow", workspace: "approved-for-application" },
    { areaId: "mrp-workflow", workspaceId: "approved-for-application" },
  ],
  [
    { lens: "mrp-workflow", workspace: "applied-proposal-history" },
    { areaId: "mrp-workflow", workspaceId: "applied-proposal-history" },
  ],
  [
    { lens: "selling-schemes", workspace: "sku-overview" },
    { areaId: "selling-schemes", workspaceId: "sku-overview" },
  ],
  [
    { lens: "selling-schemes", workspace: "scheme-master" },
    { areaId: "selling-schemes", workspaceId: "scheme-master" },
  ],
  [
    { lens: "selling-schemes", workspace: "scheme-rule-register" },
    { areaId: "selling-schemes", workspaceId: "scheme-rule-register" },
  ],
  [
    { lens: "mrp-governance" },
    { areaId: "mrp-policies", workspaceId: "sku-mrp-policies" },
  ],
  [
    { lens: "mrp-governance", mrpTab: "proposal-decisions" },
    { areaId: "mrp-workflow", workspaceId: "proposal-decisions" },
  ],
  [
    { lens: "mrp-governance", mrpTab: "product-derivation-policies" },
    { areaId: "mrp-policies", workspaceId: "product-derivation-policies" },
  ],
  [
    { lens: "policy-manager" },
    { areaId: "selling-schemes", workspaceId: "sku-overview" },
  ],
  [
    { lens: "policy-manager", policyTab: "scheme-master" },
    { areaId: "selling-schemes", workspaceId: "scheme-master" },
  ],
  [
    { lens: "unknown" },
    { areaId: "selling-schemes", workspaceId: "sku-overview" },
  ],
  [
    { lens: "mrp-policies", workspace: "unknown" },
    { areaId: "selling-schemes", workspaceId: "sku-overview" },
  ],
  [
    { lens: "mrp-policies", workspace: "proposal-decisions" },
    { areaId: "mrp-workflow", workspaceId: "proposal-decisions" },
  ],
  [
    {
      lens: "selling-schemes",
      workspace: "product-derivation-policies",
    },
    {
      areaId: "mrp-policies",
      workspaceId: "product-derivation-policies",
    },
  ],
  [
    { workspace: "proposal-decisions" },
    { areaId: "mrp-workflow", workspaceId: "proposal-decisions" },
  ],
  [
    { workspace: "" },
    { areaId: "selling-schemes", workspaceId: "sku-overview" },
  ],
  // SC5 relocation runs before this resolver in the shell. These fallback
  // expectations document resolver behavior only if redirect construction fails.
  [
    { lens: "scheme-comparison" },
    { areaId: "selling-schemes", workspaceId: "sku-overview" },
  ],
  [
    { workspace: "scheme-comparison" },
    { areaId: "selling-schemes", workspaceId: "sku-overview" },
  ],
  [
    { lens: "scheme-comparison", workspace: "scheme-master" },
    { areaId: "selling-schemes", workspaceId: "scheme-master" },
  ],
];

let failed = 0;
for (const [input, expected] of cases) {
  const got = resolvePricingPolicyLaunchNavigation(input);
  const ok =
    got.areaId === expected.areaId && got.workspaceId === expected.workspaceId;
  if (!ok) {
    failed += 1;
    console.error("FAIL", JSON.stringify(input), "got", got, "expected", expected);
  } else {
    console.log(
      "OK",
      JSON.stringify(input),
      "=>",
      `${got.areaId}/${got.workspaceId}`,
    );
  }
}

// ---------------------------------------------------------------------------
// F4: workspace-only canonical route contract
// ---------------------------------------------------------------------------

let f4Failed = 0;
function f4Ok(label, pass, detail = "") {
  if (pass) console.log("F4 OK", label);
  else {
    f4Failed += 1;
    console.error("F4 FAIL", label, detail);
  }
}

for (const workspaceId of expectedWorkspaceOrder) {
  const resolved = resolvePricingPolicyLaunchNavigation({ workspace: workspaceId });
  f4Ok(
    `canonical resolve ${workspaceId}`,
    resolved.workspaceId === workspaceId &&
      resolved.isLegacyInput === false &&
      resolved.shouldRewriteCanonicalUrl === false,
    JSON.stringify(resolved),
  );

  const canonical = toCanonicalPricingPolicyRouteParams({
    lens: expectedLegacyByWorkspace[workspaceId],
    workspace: workspaceId,
    mrpTab: workspaceId,
    policyTab: workspaceId,
    area: expectedGroupByWorkspace[workspaceId],
    group: expectedGroupByWorkspace[workspaceId],
  });
  f4Ok(
    `canonical write ${workspaceId}`,
    canonical.workspace === workspaceId &&
      canonical.lens == null &&
      canonical.mrpTab == null &&
      canonical.policyTab == null &&
      canonical.area == null &&
      canonical.group == null,
    JSON.stringify(canonical),
  );
}

const f4CompatibilityCases = [
  [
    "N4 workspace wins stale lens",
    { lens: "mrp-policies", workspace: "proposal-decisions" },
    "proposal-decisions",
  ],
  [
    "cross-area workspace wins",
    {
      lens: "selling-schemes",
      workspace: "product-derivation-policies",
    },
    "product-derivation-policies",
  ],
  [
    "legacy MRP tab",
    { lens: "mrp-governance", mrpTab: "approved-for-application" },
    "approved-for-application",
  ],
  [
    "legacy policy tab",
    { lens: "policy-manager", policyTab: "scheme-master" },
    "scheme-master",
  ],
  [
    "invalid legacy MRP tab",
    { lens: "mrp-governance", mrpTab: "unknown" },
    "sku-mrp-policies",
  ],
  [
    "invalid legacy policy tab",
    { lens: "policy-manager", policyTab: "unknown" },
    "sku-overview",
  ],
  ["invalid workspace", { workspace: "unknown" }, "sku-overview"],
  ["blank workspace", { workspace: "" }, "sku-overview"],
  ["no params", {}, "sku-overview"],
];

for (const [label, input, expectedWorkspace] of f4CompatibilityCases) {
  const resolved = resolvePricingPolicyLaunchNavigation(input);
  f4Ok(
    label,
    resolved.workspaceId === expectedWorkspace &&
      resolved.shouldRewriteCanonicalUrl === true,
    JSON.stringify(resolved),
  );
}

const preserved = toCanonicalPricingPolicyRouteParams({
  lens: "selling-schemes",
  workspace: "sku-overview",
  status: ["ACTIVE"],
});
f4Ok(
  "supported non-navigation params preserved",
  preserved.workspace === "sku-overview" &&
    preserved.status?.[0] === "ACTIVE" &&
    preserved.lens == null,
  JSON.stringify(preserved),
);

// ---------------------------------------------------------------------------
// F5: Area-state cleanup / workspace capability ownership
// ---------------------------------------------------------------------------

let f5Failed = 0;
function f5Ok(label, pass, detail = "") {
  if (pass) console.log("F5 OK", label);
  else {
    f5Failed += 1;
    console.error("F5 FAIL", label, detail);
  }
}

f5Ok(
  "compat Area defaults only (no Area projection objects)",
  Object.keys(PRICING_POLICY_COMPAT_AREA_DEFAULT_WORKSPACE).join(",") ===
    "mrp-policies,mrp-workflow,selling-schemes",
);
f5Ok(
  "lens-only mrp-policies → sku-mrp-policies",
  getDefaultPricingPolicyWorkspace("mrp-policies") === "sku-mrp-policies",
);
f5Ok(
  "lens-only mrp-workflow → mrp-proposals",
  getDefaultPricingPolicyWorkspace("mrp-workflow") === "mrp-proposals",
);
f5Ok(
  "lens-only selling-schemes → sku-overview",
  getDefaultPricingPolicyWorkspace("selling-schemes") === "sku-overview",
);
f5Ok(
  "lens-only mrp-governance → sku-mrp-policies",
  getDefaultPricingPolicyWorkspace("mrp-governance") === "sku-mrp-policies",
);
f5Ok(
  "lens-only policy-manager → sku-overview",
  getDefaultPricingPolicyWorkspace("policy-manager") === "sku-overview",
);

for (const id of expectedWorkspaceOrder) {
  f5Ok(
    `workspace search ${id}`,
    workspaceSupportsSearch(id) === true,
  );
  f5Ok(
    `workspace period ${id}`,
    workspaceSupportsPeriod(id) === false,
  );
  f5Ok(
    `loader lens ${id}`,
    getLegacyLensForPricingPolicyWorkspace(id) ===
      expectedLegacyByWorkspace[id],
  );
}

for (const id of [
  "sku-mrp-policies",
  "product-derivation-policies",
  "mrp-proposals",
  "proposal-decisions",
  "approved-for-application",
  "applied-proposal-history",
]) {
  f5Ok(`MRP PEQ off ${id}`, workspaceSupportsPeq(id) === false);
}
for (const id of ["sku-overview", "scheme-master", "scheme-rule-register"]) {
  f5Ok(`Selling PEQ on ${id}`, workspaceSupportsPeq(id) === true);
}

f5Ok(
  "foreign workspace wins two-arg normalize",
  normalizePricingPolicyWorkspace("mrp-policies", "proposal-decisions") ===
    "proposal-decisions",
);

// ---------------------------------------------------------------------------
// SC5: relocated-target detection + redirect param contract (mirrored helpers)
// ---------------------------------------------------------------------------

function resolveRelocatedPricingPolicyTarget({
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

function buildSchemeComparisonRedirectParams(qp) {
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

function getModuleKeyForLensSmoke(lensId) {
  const id = String(lensId || "").trim();
  if (
    id === "mrp-policies" ||
    id === "mrp-workflow" ||
    id === "selling-schemes" ||
    id === "mrp-governance" ||
    id === "policy-manager"
  ) {
    return "pricing-policy-manager";
  }
  const csrLenses = [
    "sku-cost-sheet",
    "printable-cost-sheet",
    "cost-comparison",
    "scheme-comparison",
  ];
  if (csrLenses.includes(id)) return "cost-sheet-review";
  return null;
}

const sc5Cases = [
  [
    { lens: "scheme-comparison" },
    { relocated: true, moduleKey: "cost-sheet-review", lens: "scheme-comparison" },
  ],
  [
    { workspace: "scheme-comparison" },
    { relocated: true, moduleKey: "cost-sheet-review", lens: "scheme-comparison" },
  ],
  [
    { lens: "scheme-comparison", workspace: "scheme-master" },
    { relocated: true, moduleKey: "cost-sheet-review", lens: "scheme-comparison" },
  ],
  [
    { workspace: "scheme-comparison", lens: "selling-schemes" },
    { relocated: true, moduleKey: "cost-sheet-review", lens: "scheme-comparison" },
  ],
  [
    { mrpTab: "scheme-comparison" },
    { relocated: true, moduleKey: "cost-sheet-review", lens: "scheme-comparison" },
  ],
  [
    { policyTab: "scheme-comparison" },
    { relocated: true, moduleKey: "cost-sheet-review", lens: "scheme-comparison" },
  ],
  [{ lens: "selling-schemes", workspace: "scheme-master" }, { relocated: false }],
  [{ workspace: "unknown-workspace" }, { relocated: false }],
];

let sc5Failed = 0;
for (const [input, expected] of sc5Cases) {
  const got = resolveRelocatedPricingPolicyTarget(input);
  const ok =
    !!got.relocated === !!expected.relocated &&
    (!expected.relocated ||
      (got.moduleKey === expected.moduleKey && got.lens === expected.lens));
  if (!ok) {
    sc5Failed += 1;
    console.error("FAIL SC5 relocate", JSON.stringify(input), "got", got, "expected", expected);
  } else {
    console.log("OK SC5 relocate", JSON.stringify(input), "=>", got);
  }
}

const redirectParamCases = [
  [
    "lens=scheme-comparison&status=BLOCKED,REVIEW_REQUIRED&issue=X&source=Y&period_start=2026-04-01&workspace=scheme-comparison&mrpTab=scheme-comparison",
    {
      lens: "scheme-comparison",
      status: ["BLOCKED", "REVIEW_REQUIRED"],
      period_start: "2026-04-01",
    },
  ],
  [
    "workspace=scheme-comparison",
    { lens: "scheme-comparison" },
  ],
];

for (const [query, expected] of redirectParamCases) {
  const got = buildSchemeComparisonRedirectParams(new URLSearchParams(query));
  const ok =
    got.lens === expected.lens &&
    String(got.period_start || "") === String(expected.period_start || "") &&
    JSON.stringify(got.status || []) === JSON.stringify(expected.status || []) &&
    got.issue == null &&
    got.source == null &&
    got.workspace == null &&
    got.mrpTab == null &&
    got.policyTab == null;
  if (!ok) {
    sc5Failed += 1;
    console.error("FAIL SC5 params", query, "got", got, "expected", expected);
  } else {
    console.log("OK SC5 params", query, "=>", got);
  }
}

if (getModuleKeyForLensSmoke("scheme-comparison") !== "cost-sheet-review") {
  sc5Failed += 1;
  console.error("FAIL SC5 module-key scheme-comparison");
} else {
  console.log("OK SC5 module-key scheme-comparison => cost-sheet-review");
}

if (getModuleKeyForLensSmoke("sku-mrp-policies") === "cost-sheet-review") {
  sc5Failed += 1;
  console.error("FAIL SC5 module-key sku-mrp-policies must not be CSR");
} else {
  console.log("OK SC5 module-key non-scheme PPM ownership unchanged");
}

const totalFailed = failed + metaFailed + f4Failed + f5Failed + sc5Failed;
console.log(
  totalFailed
    ? `FAILED resolver=${failed} metadata/F3=${metaFailed} F4=${f4Failed} F5=${f5Failed} SC5=${sc5Failed}`
    : `PASSED resolver=${cases.length} metadata/F3=ok F4=ok F5=ok SC5=${sc5Cases.length + redirectParamCases.length + 2}`,
);
process.exit(totalFailed ? 1 : 0);
