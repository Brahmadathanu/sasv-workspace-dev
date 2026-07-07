export const COSTING_SUITE_MODULES = [
  {
    id: "control-center",
    label: "Costing Control Center",
    lensIds: ["dashboard", "costing-review-workbench"],
  },
  {
    id: "material-cost",
    label: "Material Cost Manager",
    lensIds: ["manual-rate-manager"],
  },
  {
    id: "cost-build",
    label: "Cost Build Manager",
    lensIds: ["cost-governance", "staff-governance", "manual-provisions"],
  },
  {
    id: "pricing-policy",
    label: "Pricing Policy Manager",
    lensIds: ["policy-manager", "scheme-comparison"],
  },
  {
    id: "cost-sheet-review",
    label: "Cost Sheet Review & Approval",
    lensIds: ["sku-cost-sheet", "printable-cost-sheet", "cost-comparison"],
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
  "manual-rate-manager": {
    id: "manual-rate-manager",
    label: "Manual Rate Manager",
    suiteId: "material-cost",
    periodScoped: false,
    description: "Manual RM/PM rates, action queue, register, and history.",
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
  "policy-manager": {
    id: "policy-manager",
    label: "Policy Manager",
    suiteId: "pricing-policy",
    periodScoped: false,
    description: "SKU selling policy, scheme policy, and scheme rule register.",
  },
  "scheme-comparison": {
    id: "scheme-comparison",
    label: "Scheme Comparison",
    suiteId: "pricing-policy",
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
