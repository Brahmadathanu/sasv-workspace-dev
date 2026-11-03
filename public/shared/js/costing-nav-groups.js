// MDC-07 / N1 — Shared Costing navigation-group contract (presentation only).
//
// One reusable contract describing, per Costing module (suite), the ordered navigation groups and the lens ids
// each group presents. It changes NO permission, route, lens id, controller or RPC: grouping is a label layer
// over the existing registry (costing-suite-registry.js) and route config (costing-route-config.js).
//
// Rules enforced here and by tests:
//   * every allowed lens of a module appears exactly once (a lens missing from the contract is appended to a
//     trailing "More" group, so no destination can ever disappear);
//   * unknown or not-allowed lens ids are dropped from a group, never invented;
//   * group ids are stable, URL-safe, unique within a module;
//   * the contract is inert unless COSTING_NAV_GROUPS_V1 is "1" (see costing-feature-flags.js).
//
// Pricing Policy Manager manages its navigation inside its own controller (workspaces, not lenses). It is
// described here with the compatible shape (kind: "workspace") for W6, but this module never renders it
// (controllerManaged: true) — there is no competing second navigation system.
import { COSTING_SUITE_MODULES, LENS_REGISTRY } from "./costing-suite-registry.js";

export const NAV_FALLBACK_GROUP_ID = "more";
export const NAV_FALLBACK_GROUP_LABEL = "More";

/**
 * Approved grouping (WP05-A3 §3/§4), keyed by registry suite id.
 * contextLabel is static explanatory text for the group (never a data value).
 */
export const COSTING_NAV_GROUP_CONTRACT = Object.freeze({
  "control-center": [
    { id: "overview", label: "Overview", contextLabel: "Control snapshot for the selected period", lensIds: ["dashboard"] },
    { id: "workbench", label: "Workbench", contextLabel: "Material blockers and review acceptance", lensIds: ["costing-review-workbench"] },
    {
      id: "sku-review",
      label: "SKU Review",
      contextLabel: "Two separate lenses with different data bases: SKU Control Status is run-scoped; Readiness is LIVE_AS_OF",
      lensIds: ["sku-control-status", "portfolio-readiness"],
    },
  ],
  "material-cost": [
    { id: "rates", label: "Rates", contextLabel: "Manual RM/PM rates", lensIds: ["manual-rate-manager"] },
    {
      id: "traces",
      label: "Traces",
      contextLabel: "Restricted: access is decided by the server; RM and PM stay separate lenses",
      lensIds: ["rm-cost-trace", "pm-cost-trace"],
    },
  ],
  "cost-build": [
    { id: "mapping-classification", label: "Mapping & classification", contextLabel: "Expense-head mapping and staff classification", lensIds: ["cost-governance", "staff-governance"] },
    { id: "provisions", label: "Provisions", contextLabel: "Manual cost-pool provisions", lensIds: ["manual-provisions"] },
    { id: "policy-approval", label: "Policy approval", contextLabel: "Cost-driver policy approval", lensIds: ["driver-governance"] },
  ],
  "cost-sheet-review": [
    { id: "review", label: "Review", contextLabel: "Read-only cost analysis", lensIds: ["sku-cost-sheet", "scheme-comparison", "cost-comparison"] },
    { id: "documents", label: "Documents", contextLabel: "Printable cost sheet", lensIds: ["printable-cost-sheet"] },
    {
      id: "action-queues",
      label: "Action Queues",
      contextLabel: "Two separate queues with separate controllers",
      lensIds: ["qc-action-queue", "materials-stores-action-queue"],
    },
  ],
  "production-route": [
    { id: "readiness", label: "Readiness", contextLabel: "Route readiness from the governed readiness contract", lensIds: ["route-readiness"] },
    {
      id: "assign-map",
      label: "Assign & Map",
      contextLabel: "Product assignments, subgroup mappings and route families",
      lensIds: ["product-route-assignments", "product-subgroup-mappings", "route-families"],
    },
    {
      id: "build",
      label: "Build",
      contextLabel: "Route authoring and effective route",
      lensIds: ["product-route-editor", "effective-route-viewer", "route-family-route-editor", "production-cost-centres"],
    },
    {
      id: "review",
      label: "Review",
      contextLabel: "Evidence & Review: three independently accessible lenses plus workload preview",
      lensIds: ["route-family-mapping-review", "route-family-foundation-review", "historical-candidate-review", "shared-workload-preview"],
    },
    { id: "history", label: "History", contextLabel: "Read-only archived routes", lensIds: ["archived-routes"] },
  ],
});

/**
 * Pricing Policy Manager: compatible CONTRACT only (kind "workspace", ids of PRICING_POLICY_WORKSPACES).
 * controllerManaged: the PPM controller owns rendering; its transformation to this contract is W6 work.
 */
export const COSTING_PPM_NAV_GROUP_CONTRACT = Object.freeze({
  suiteId: "pricing-policy",
  kind: "workspace",
  controllerManaged: true,
  groups: [
    { id: "sku-policies", label: "SKU policies", workspaceIds: ["sku-overview"] },
    { id: "mrp", label: "MRP", workspaceIds: ["sku-mrp-policies", "product-derivation-policies"] },
    {
      id: "mrp-change-workflow",
      label: "MRP change workflow",
      workspaceIds: ["mrp-proposals", "proposal-decisions", "approved-for-application", "applied-proposal-history"],
    },
    { id: "schemes", label: "Schemes", workspaceIds: ["scheme-master", "scheme-rule-register"] },
    { id: "costing-inputs", label: "Costing inputs", workspaceIds: ["commercial-sales-assumptions"] },
  ],
});

/**
 * Static data-basis of a lens (what KIND of data it shows). No values: run numbers, dates and ids always come
 * from the live context supplied by the controller/shell, never from this table.
 */
export const NAV_BASIS = Object.freeze({
  LIVE_AS_OF: "LIVE_AS_OF",
  RUN_SCOPED: "RUN_SCOPED",
  FIXED_HISTORICAL: "FIXED_HISTORICAL",
});

export const COSTING_LENS_BASIS = Object.freeze({
  "portfolio-readiness": NAV_BASIS.LIVE_AS_OF,
  "sku-control-status": NAV_BASIS.RUN_SCOPED,
  "shared-workload-preview": NAV_BASIS.FIXED_HISTORICAL,
  "route-family-mapping-review": NAV_BASIS.FIXED_HISTORICAL,
  "route-family-foundation-review": NAV_BASIS.FIXED_HISTORICAL,
});

const BASIS_TEXT = Object.freeze({
  LIVE_AS_OF: "LIVE_AS_OF · live data as of the governed valuation date",
  RUN_SCOPED: "Run-scoped · frozen data of the governed costing run",
  FIXED_HISTORICAL: "Fixed historical context · not the current costing run",
});

export function getLensBasis(lensId) {
  return COSTING_LENS_BASIS[lensId] || null;
}

export function getBasisText(basis) {
  return BASIS_TEXT[basis] || "";
}

/**
 * Resolve the groups to render for one module.
 * @param {string} suiteId registry suite id
 * @param {string[]} allowedLensIds lens ids allowed on this route (from route config)
 * @returns {{id,label,contextLabel,lensIds}[]} non-empty groups; leftovers go to a trailing fallback group
 */
export function resolveNavGroups(suiteId, allowedLensIds = []) {
  const allowed = [...new Set(allowedLensIds)].filter((id) => LENS_REGISTRY[id]);
  const contract = COSTING_NAV_GROUP_CONTRACT[suiteId];
  if (!contract) return [];
  const placed = new Set();
  const groups = [];
  for (const group of contract) {
    const lensIds = group.lensIds.filter((id) => allowed.includes(id) && !placed.has(id));
    lensIds.forEach((id) => placed.add(id));
    if (lensIds.length) groups.push({ id: group.id, label: group.label, contextLabel: group.contextLabel || "", lensIds });
  }
  const rest = allowed.filter((id) => !placed.has(id));
  if (rest.length) {
    groups.push({ id: NAV_FALLBACK_GROUP_ID, label: NAV_FALLBACK_GROUP_LABEL, contextLabel: "", lensIds: rest });
  }
  return groups;
}

export function getNavGroupForLens(suiteId, allowedLensIds, lensId) {
  return resolveNavGroups(suiteId, allowedLensIds).find((g) => g.lensIds.includes(lensId)) || null;
}

/** Contract self-check used by tests (and callable by tooling): returns a list of problems, empty when sound. */
export function validateNavGroupContract() {
  const problems = [];
  for (const suite of COSTING_SUITE_MODULES) {
    if (suite.id === COSTING_PPM_NAV_GROUP_CONTRACT.suiteId) {
      if (COSTING_NAV_GROUP_CONTRACT[suite.id]) problems.push(`${suite.id}: lens contract must not exist (controller managed)`);
      continue;
    }
    const groups = COSTING_NAV_GROUP_CONTRACT[suite.id];
    if (!groups) {
      problems.push(`${suite.id}: no group contract`);
      continue;
    }
    const seenGroup = new Set();
    const seenLens = new Map();
    for (const g of groups) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.id)) problems.push(`${suite.id}/${g.id}: unstable id`);
      if (seenGroup.has(g.id)) problems.push(`${suite.id}/${g.id}: duplicate group`);
      seenGroup.add(g.id);
      if (!g.label?.trim()) problems.push(`${suite.id}/${g.id}: empty label`);
      for (const id of g.lensIds) {
        if (!suite.lensIds.includes(id)) problems.push(`${suite.id}/${g.id}: ${id} not in suite`);
        if (seenLens.has(id)) problems.push(`${suite.id}: ${id} in ${seenLens.get(id)} and ${g.id}`);
        seenLens.set(id, g.id);
      }
    }
    for (const id of suite.lensIds) if (!seenLens.has(id)) problems.push(`${suite.id}: ${id} not grouped`);
  }
  return problems;
}

/* ---------- renderers (string builders; callers escape nothing: everything is escaped here) ---------- */

export function escapeNavHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Grouped pill strip. Pills keep class "pill" + data-lens so the shell's existing click handler and
 * focus/active styling apply unchanged. Each group is a labelled role=group.
 */
export function renderGroupedNavHtml(groups, currentLensId) {
  return groups
    .map((group) => {
      const headingId = `cpNavGroup-${group.id}`;
      const pills = group.lensIds
        .map((lensId) => {
          const meta = LENS_REGISTRY[lensId];
          if (!meta) return "";
          const active = lensId === currentLensId;
          return `<button type="button" class="pill${active ? " active" : ""}" data-lens="${escapeNavHtml(meta.id)}"${active ? ' aria-current="page"' : ""}>${escapeNavHtml(meta.label)}</button>`;
        })
        .join("");
      if (!pills) return "";
      const hasActive = group.lensIds.includes(currentLensId);
      return `<div class="cp-nav-group${hasActive ? " cp-nav-group-current" : ""}" role="group" aria-labelledby="${headingId}" data-nav-group="${escapeNavHtml(group.id)}"${group.contextLabel ? ` title="${escapeNavHtml(group.contextLabel)}"` : ""}><span class="cp-nav-group-heading" id="${headingId}">${escapeNavHtml(group.label)}</span><div class="cp-nav-group-pills">${pills}</div></div>`;
    })
    .join("");
}

/** Narrow-screen select markup: one optgroup per group. Option values are the unchanged lens ids. */
export function renderGroupedSelectHtml(groups) {
  return groups
    .map((group) => {
      const options = group.lensIds
        .map((lensId) => {
          const meta = LENS_REGISTRY[lensId];
          return meta ? `<option value="${escapeNavHtml(meta.id)}">${escapeNavHtml(meta.label)}</option>` : "";
        })
        .join("");
      return options ? `<optgroup label="${escapeNavHtml(group.label)}">${options}</optgroup>` : "";
    })
    .join("");
}
