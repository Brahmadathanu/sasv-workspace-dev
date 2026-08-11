export const COSTING_SUITE_MODULES = [
  {
    id: "control-center",
    label: "Costing Control Center",
    lensIds: ["dashboard", "costing-review-workbench", "sku-control-status"],
  },
  {
    id: "material-cost",
    label: "Material Cost Manager",
    lensIds: ["manual-rate-manager", "rm-cost-trace", "pm-cost-trace"],
  },
  {
    id: "cost-build",
    label: "Cost Build Manager",
    lensIds: [
      "cost-governance",
      "staff-governance",
      "manual-provisions",
      "driver-governance",
    ],
  },
  {
    id: "pricing-policy",
    label: "Pricing Policy Manager",
    // SC1/SC4: scheme-comparison owned by cost-sheet-review. PPM suite has no
    // scheme-comparison lens. SC5 redirects legacy PPM Scheme Comparison URLs.
    lensIds: ["mrp-governance", "policy-manager"],
  },
  {
    id: "cost-sheet-review",
    label: "Cost Sheet Review & Approval",
    lensIds: [
      "sku-cost-sheet",
      "printable-cost-sheet",
      "cost-comparison",
      "scheme-comparison",
      "qc-action-queue",
      "materials-stores-action-queue",
    ],
  },
  {
    id: "production-route",
    label: "Production Route Manager",
    lensIds: [
      "route-readiness",
      "product-route-assignments",
      "shared-workload-preview",
      "route-families",
      "route-family-mapping-review",
      "route-family-foundation-review",
      "production-cost-centres",
      "route-family-route-editor",
      "product-route-editor",
      "historical-candidate-review",
      "effective-route-viewer",
    ],
  },
];

export const LENS_REGISTRY = {
  dashboard: {
    id: "dashboard",
    label: "Dashboard",
    suiteId: "control-center",
    periodScoped: true,
    description: "Control snapshot, readiness counts, and integrity overview.",
  },
  "costing-review-workbench": {
    id: "costing-review-workbench",
    label: "Control Workbench",
    suiteId: "control-center",
    periodScoped: true,
    description: "Material action queue, blockers, and review acceptance.",
  },
  "sku-control-status": {
    id: "sku-control-status",
    label: "SKU Control Status",
    suiteId: "control-center",
    periodScoped: true,
    description:
      "Canonical SKU costing remediation index: primary control, recommended route, and secondary material evidence.",
  },
  "manual-rate-manager": {
    id: "manual-rate-manager",
    label: "Manual Rate Manager",
    suiteId: "material-cost",
    periodScoped: false,
    description: "Manual RM/PM rates, action queue, register, and history.",
  },
  "rm-cost-trace": {
    id: "rm-cost-trace",
    label: "RM Cost Trace",
    suiteId: "material-cost",
    periodScoped: true,
    description:
      "Read-only confidential raw-material contribution traceability.",
  },
  "pm-cost-trace": {
    id: "pm-cost-trace",
    label: "PM Cost Trace",
    suiteId: "material-cost",
    periodScoped: true,
    description:
      "Read-only packing-material contribution traceability for the current successful run.",
  },
  "cost-governance": {
    id: "cost-governance",
    label: "Cost Governance",
    suiteId: "cost-build",
    periodScoped: false,
    description: "Expense head mapping, exclusions, and cost pool summary.",
  },
  "staff-governance": {
    id: "staff-governance",
    label: "Staff Governance",
    suiteId: "cost-build",
    periodScoped: false,
    description: "Staff costing classification review and pool summary.",
  },
  "manual-provisions": {
    id: "manual-provisions",
    label: "Manual Provisions",
    suiteId: "cost-build",
    periodScoped: true,
    description: "Manual cost pool provisions and monthly pool impact.",
  },
  "driver-governance": {
    id: "driver-governance",
    label: "Driver Governance",
    suiteId: "cost-build",
    periodScoped: false,
    description:
      "Cost-driver policy registry, validation, submission, and approval.",
  },
  "mrp-governance": {
    id: "mrp-governance",
    label: "MRP Governance",
    suiteId: "pricing-policy",
    periodScoped: false,
    description:
      "Canonical SKU MRP policies, product derivation, proposals, decisions, and application history.",
  },
  "policy-manager": {
    id: "policy-manager",
    label: "Selling & Scheme Policies",
    suiteId: "pricing-policy",
    periodScoped: false,
    description: "SKU selling policy, scheme policy, and scheme rule register.",
  },
  "scheme-comparison": {
    id: "scheme-comparison",
    label: "Scheme Comparison",
    // SC1: canonical suite owner is Cost Sheet Review (period analysis).
    suiteId: "cost-sheet-review",
    periodScoped: true,
    description: "Scheme viability and margin comparison by SKU.",
  },
  "sku-cost-sheet": {
    id: "sku-cost-sheet",
    label: "SKU Cost Details",
    suiteId: "cost-sheet-review",
    periodScoped: true,
    description: "SKU-level cost layers, selling price bridge, and diagnostics.",
  },
  "printable-cost-sheet": {
    id: "printable-cost-sheet",
    label: "Cost Sheet",
    suiteId: "cost-sheet-review",
    periodScoped: true,
    description: "Printable A4 cost sheets and PDF export.",
  },
  "cost-comparison": {
    id: "cost-comparison",
    label: "Cost Comparison",
    suiteId: "cost-sheet-review",
    periodScoped: true,
    description: "Monthly and yearly cost sheet snapshot comparison.",
  },
  "qc-action-queue": {
    id: "qc-action-queue",
    label: "QC Action Queue",
    suiteId: "cost-sheet-review",
    periodScoped: true,
    description:
      "Quality Control allocation blockers and absorption-basis review actions.",
  },
  "materials-stores-action-queue": {
    id: "materials-stores-action-queue",
    label: "Materials / Stores Action Queue",
    suiteId: "cost-sheet-review",
    periodScoped: true,
    description:
      "Materials / Stores overhead blockers and review actions (BLOCKED and REVIEW_REQUIRED only).",
  },
  "route-readiness": {
    id: "route-readiness",
    label: "Route Readiness",
    suiteId: "production-route",
    periodScoped: false,
    description:
      "Product route readiness from guarded readiness RPC (not client-calculated).",
  },
  "product-route-assignments": {
    id: "product-route-assignments",
    label: "Product Assignments",
    suiteId: "production-route",
    periodScoped: false,
    description:
      "Cross-Product Product-to-Route-Family assignment lifecycle register.",
  },
  "shared-workload-preview": {
    id: "shared-workload-preview",
    label: "Workload Preview",
    suiteId: "production-route",
    periodScoped: false,
    description:
      "Exact-run nonmonetary DL/POH quantity, batch, route and scope workload preview.",
  },
  "route-families": {
    id: "route-families",
    label: "Manufacturing Route Families",
    suiteId: "production-route",
    periodScoped: false,
    description:
      "Governed Manufacturing Route Families, hierarchy mappings, and approved family routes.",
  },
  "route-family-mapping-review": {
    id: "route-family-mapping-review",
    label: "Mapping Review",
    suiteId: "production-route",
    periodScoped: false,
    description:
      "Exact-run Route Family coverage candidates for Product-Group mapping review (no automatic mapping).",
  },
  "route-family-foundation-review": {
    id: "route-family-foundation-review",
    label: "Foundation Review",
    suiteId: "production-route",
    periodScoped: false,
    description:
      "Exact-run Product Group historical foundation evidence for governed Route Family design review (read-only).",
  },
  "production-cost-centres": {
    id: "production-cost-centres",
    label: "Cost Centres",
    suiteId: "production-route",
    periodScoped: false,
    description:
      "Governed Production Cost Centre master: draft, validate, approve, and inactivate.",
  },
  "route-family-route-editor": {
    id: "route-family-route-editor",
    label: "Route Family Route Editor",
    suiteId: "production-route",
    periodScoped: false,
    description:
      "Draft, validate, submit, approve, and supersede Manufacturing Route Family routes.",
  },
  "product-route-editor": {
    id: "product-route-editor",
    label: "Product Route Editor",
    suiteId: "production-route",
    periodScoped: false,
    description:
      "Product deltas over an inherited family route and resolved effective route.",
  },
  "historical-candidate-review": {
    id: "historical-candidate-review",
    label: "Historical Evidence Review",
    suiteId: "production-route",
    periodScoped: false,
    description:
      "Historical Route Family and Product evidence previews that may stage drafts only.",
  },
  "effective-route-viewer": {
    id: "effective-route-viewer",
    label: "Effective Route Viewer",
    suiteId: "production-route",
    periodScoped: false,
    description: "Resolved effective Product-to-Process route with source badges.",
  },
};

export function getLensMeta(lensId) {
  return LENS_REGISTRY[lensId] || null;
}

export function getSuiteForLens(lensId) {
  const meta = getLensMeta(lensId);
  if (!meta?.suiteId) return null;
  return (
    COSTING_SUITE_MODULES.find((suite) => suite.id === meta.suiteId) || null
  );
}

export function isLensPeriodScoped(lensId) {
  return !!LENS_REGISTRY[lensId]?.periodScoped;
}
