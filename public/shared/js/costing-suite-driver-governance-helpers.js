/**
 * Cost Build Manager — Driver Governance pure helpers.
 * Gate: Driver Governance lens. No DOM / Supabase side effects.
 */

export const DRIVER_GOVERNANCE_LENS_ID = "driver-governance";

export const DRIVER_GOVERNANCE_PERMISSION_TARGET = "module:cost-build-manager";
export const DRIVER_GOVERNANCE_PRM_PERMISSION_TARGET =
  "module:production-route-manager";

export const DRIVER_GOVERNANCE_RPC_NAMES = Object.freeze({
  registry: "rpc_get_cost_driver_policy_registry",
  detail: "rpc_get_cost_driver_governance_detail",
  submitDirectLabour: "rpc_submit_direct_labour_workload_policy_for_review",
  approveDirectLabour: "rpc_approve_direct_labour_workload_policy",
  submitProductionOverhead:
    "rpc_submit_production_overhead_workload_policy_for_review",
  approveProductionOverhead: "rpc_approve_production_overhead_workload_policy",
  submitEnvelope: "rpc_submit_cost_driver_policy_envelope_for_review",
  approveEnvelope: "rpc_approve_cost_driver_policy_envelope",
});

/** Draft creation is intentionally excluded from v1. */
export const DRIVER_GOVERNANCE_EXCLUDED_RPC_NAMES = Object.freeze([
  "rpc_create_cost_driver_policy_envelope_draft",
]);

export const DRIVER_GOVERNANCE_ACTION_RPC_ALLOWLIST = Object.freeze([
  DRIVER_GOVERNANCE_RPC_NAMES.submitDirectLabour,
  DRIVER_GOVERNANCE_RPC_NAMES.approveDirectLabour,
  DRIVER_GOVERNANCE_RPC_NAMES.submitProductionOverhead,
  DRIVER_GOVERNANCE_RPC_NAMES.approveProductionOverhead,
  DRIVER_GOVERNANCE_RPC_NAMES.submitEnvelope,
  DRIVER_GOVERNANCE_RPC_NAMES.approveEnvelope,
]);

export const DRIVER_GOVERNANCE_RPC_ARG_KEYS = Object.freeze({
  [DRIVER_GOVERNANCE_RPC_NAMES.registry]: Object.freeze([
    "p_cost_element_code",
  ]),
  [DRIVER_GOVERNANCE_RPC_NAMES.detail]: Object.freeze(["p_cost_element_code"]),
  [DRIVER_GOVERNANCE_RPC_NAMES.submitDirectLabour]: Object.freeze([
    "p_policy_id",
  ]),
  [DRIVER_GOVERNANCE_RPC_NAMES.approveDirectLabour]: Object.freeze([
    "p_policy_id",
    "p_approval_reference",
  ]),
  [DRIVER_GOVERNANCE_RPC_NAMES.submitProductionOverhead]: Object.freeze([
    "p_policy_id",
  ]),
  [DRIVER_GOVERNANCE_RPC_NAMES.approveProductionOverhead]: Object.freeze([
    "p_policy_id",
    "p_approval_reference",
  ]),
  [DRIVER_GOVERNANCE_RPC_NAMES.submitEnvelope]: Object.freeze([
    "p_envelope_id",
  ]),
  [DRIVER_GOVERNANCE_RPC_NAMES.approveEnvelope]: Object.freeze([
    "p_envelope_id",
    "p_approval_reference",
  ]),
});

export const DRIVER_GOVERNANCE_ACTION_CODES = Object.freeze({
  SUBMIT_FOR_REVIEW: "SUBMIT_FOR_REVIEW",
  APPROVE: "APPROVE",
});

export const DRIVER_GOVERNANCE_CANONICAL_ELEMENTS = Object.freeze([
  {
    code: "DIRECT_LABOUR",
    label: "Direct Labour",
    sort_order: 1,
    prmOwned: true,
  },
  {
    code: "PRODUCTION_OVERHEAD",
    label: "Production Overhead",
    sort_order: 2,
    prmOwned: true,
  },
  {
    code: "QUALITY_CONTROL_OVERHEAD",
    label: "Quality Control Overhead",
    sort_order: 3,
    prmOwned: false,
  },
  {
    code: "MATERIALS_STORES_OVERHEAD",
    label: "Materials / Stores Overhead",
    sort_order: 4,
    prmOwned: false,
  },
  {
    code: "ADMIN_OVERHEAD",
    label: "Administrative Overhead",
    sort_order: 5,
    prmOwned: false,
  },
  {
    code: "FINANCE_ADMIN_OVERHEAD",
    label: "Finance/Admin Overhead",
    sort_order: 6,
    prmOwned: false,
  },
  {
    code: "MARKETING_EXPENSE",
    label: "Marketing Expense",
    sort_order: 7,
    prmOwned: false,
  },
]);

export const DRIVER_GOVERNANCE_SUBMIT_WARNING =
  "After submission, the policy architecture and core fields cannot be edited in place. Any later correction may require a new policy version.";

export const DRIVER_GOVERNANCE_APPROVE_DISCLAIMER =
  "Approval does not authorise Stage 03 cutover or trigger a costing refresh.";

export const DRIVER_GOVERNANCE_APPROVE_ACK_TEXT =
  "I confirm that I have reviewed this policy formula, factors, effective date and validation result. I understand that this approval does not trigger a costing refresh, create snapshots or authorise Stage 03 cutover.";

export const DRIVER_GOVERNANCE_UNREGISTERED_COPY =
  "Policy creation is not yet available in this workspace.";

export const DRIVER_GOVERNANCE_TABLE_HEADERS = Object.freeze([
  "Cost Element",
  "Driver Domain",
  "Formula",
  "Lifecycle",
  "Validation",
  "Effective From",
  "Maturity",
  "Client",
  "DQ",
  "Cutover",
  "Owner",
]);

export const DRIVER_GOVERNANCE_FORBIDDEN_RPC_SUBSTRINGS = Object.freeze([
  "rpc_create_cost_driver_policy_envelope_draft",
  "stage_03",
  "stage03",
  "rpc_refresh_cost",
  "create_costing_snapshot",
  "rebuild_costing",
]);

const CODE_ALIASES = Object.freeze({
  DIRECT_LABOUR: "DIRECT_LABOUR",
  DL: "DIRECT_LABOUR",
  PRODUCTION_OVERHEAD: "PRODUCTION_OVERHEAD",
  POH: "PRODUCTION_OVERHEAD",
  QUALITY_CONTROL_OVERHEAD: "QUALITY_CONTROL_OVERHEAD",
  QUALITY_CONTROL: "QUALITY_CONTROL_OVERHEAD",
  QC: "QUALITY_CONTROL_OVERHEAD",
  MATERIALS_STORES_OVERHEAD: "MATERIALS_STORES_OVERHEAD",
  MATERIALS_STORES: "MATERIALS_STORES_OVERHEAD",
  MATERIALS: "MATERIALS_STORES_OVERHEAD",
  ADMIN_OVERHEAD: "ADMIN_OVERHEAD",
  ADMINISTRATION: "ADMIN_OVERHEAD",
  ADMINISTRATIVE_OVERHEAD: "ADMIN_OVERHEAD",
  ADMIN: "ADMIN_OVERHEAD",
  FINANCE_ADMIN_OVERHEAD: "FINANCE_ADMIN_OVERHEAD",
  FINANCE_ADMIN: "FINANCE_ADMIN_OVERHEAD",
  FINANCE: "FINANCE_ADMIN_OVERHEAD",
  FINANCE_ADMINISTRATION: "FINANCE_ADMIN_OVERHEAD",
  MARKETING_EXPENSE: "MARKETING_EXPENSE",
  MARKETING: "MARKETING_EXPENSE",
});

export const DRIVER_GOVERNANCE_FORMULA_EXPLANATION_FIELDS = Object.freeze([
  "title",
  "purpose",
  "equation",
  "calculation_steps",
  "evidence_basis",
  "status_treatment",
  "redistribution_rule",
  "interpretation",
  "future_improvements",
]);

function isBlank(value) {
  return value == null || String(value).trim() === "";
}

export function isDriverGovernanceLens(lensId) {
  return String(lensId || "").trim() === DRIVER_GOVERNANCE_LENS_ID;
}

export function normalizeDriverGovernanceCode(value) {
  if (isBlank(value)) return null;
  const raw = String(value)
    .trim()
    .toUpperCase()
    .replace(/[/\s-]+/g, "_")
    .replace(/_+/g, "_");
  if (CODE_ALIASES[raw]) return CODE_ALIASES[raw];
  const known = DRIVER_GOVERNANCE_CANONICAL_ELEMENTS.find(
    (el) => el.code === raw || el.label.toUpperCase().replace(/[/\s-]+/g, "_") === raw,
  );
  return known?.code || raw;
}

export function normalizeDriverGovernanceIntegerId(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

export function isMeaningfulDriverGovernanceApprovalReference(value) {
  const raw = String(value ?? "").trim();
  if (raw.length < 5) return false;
  const upper = raw.toUpperCase();
  if (["N/A", "NA", "NONE", "TEST", "TODO", "TBD", "-", "—"].includes(upper)) {
    return false;
  }
  if (/^[-\u2013\u2014._\s]+$/.test(raw)) return false;
  return true;
}

export function enforceExactDriverGovernanceRpcKeys(rpcName, params = {}) {
  const allowed = DRIVER_GOVERNANCE_RPC_ARG_KEYS[rpcName];
  if (!allowed) {
    return {
      ok: false,
      params: {},
      errors: [`Unknown driver-governance RPC: ${rpcName}`],
    };
  }
  const keys = Object.keys(params || {});
  const unsupported = keys.filter((k) => !allowed.includes(k));
  if (unsupported.length) {
    return {
      ok: false,
      params: {},
      errors: [`Unsupported keys for ${rpcName}: ${unsupported.join(", ")}`],
    };
  }
  return { ok: true, params: { ...params }, errors: [] };
}

export function buildGetCostDriverPolicyRegistryArgs({
  cost_element_code = null,
} = {}) {
  const params = { p_cost_element_code: null };
  if (cost_element_code != null && cost_element_code !== "") {
    const code = normalizeDriverGovernanceCode(cost_element_code);
    if (!code) {
      return { ok: false, params: {}, errors: ["Invalid cost_element_code"] };
    }
    params.p_cost_element_code = code;
  }
  return enforceExactDriverGovernanceRpcKeys(
    DRIVER_GOVERNANCE_RPC_NAMES.registry,
    params,
  );
}

export function buildGetCostDriverGovernanceDetailArgs({
  cost_element_code,
} = {}) {
  const code = normalizeDriverGovernanceCode(cost_element_code);
  if (!code) {
    return {
      ok: false,
      params: {},
      errors: ["p_cost_element_code is required"],
    };
  }
  return enforceExactDriverGovernanceRpcKeys(
    DRIVER_GOVERNANCE_RPC_NAMES.detail,
    { p_cost_element_code: code },
  );
}

export function buildSubmitSpecialisedDriverPolicyArgs({ record_id } = {}) {
  const id = normalizeDriverGovernanceIntegerId(record_id);
  if (id == null) {
    return { ok: false, params: {}, errors: ["p_policy_id must be a positive integer"] };
  }
  // Caller selects which submit RPC; keys are identical.
  return { ok: true, params: { p_policy_id: id }, errors: [] };
}

export function buildApproveSpecialisedDriverPolicyArgs({
  record_id,
  approval_reference,
} = {}) {
  const id = normalizeDriverGovernanceIntegerId(record_id);
  const errors = [];
  if (id == null) errors.push("p_policy_id must be a positive integer");
  if (!isMeaningfulDriverGovernanceApprovalReference(approval_reference)) {
    errors.push("Meaningful approval reference is required (min 5 characters)");
  }
  if (errors.length) return { ok: false, params: {}, errors };
  return {
    ok: true,
    params: {
      p_policy_id: id,
      p_approval_reference: String(approval_reference).trim(),
    },
    errors: [],
  };
}

export function buildSubmitDriverPolicyEnvelopeArgs({ record_id } = {}) {
  const id = normalizeDriverGovernanceIntegerId(record_id);
  if (id == null) {
    return {
      ok: false,
      params: {},
      errors: ["p_envelope_id must be a positive integer"],
    };
  }
  return enforceExactDriverGovernanceRpcKeys(
    DRIVER_GOVERNANCE_RPC_NAMES.submitEnvelope,
    { p_envelope_id: id },
  );
}

export function buildApproveDriverPolicyEnvelopeArgs({
  record_id,
  approval_reference,
} = {}) {
  const id = normalizeDriverGovernanceIntegerId(record_id);
  const errors = [];
  if (id == null) errors.push("p_envelope_id must be a positive integer");
  if (!isMeaningfulDriverGovernanceApprovalReference(approval_reference)) {
    errors.push("Meaningful approval reference is required (min 5 characters)");
  }
  if (errors.length) return { ok: false, params: {}, errors };
  return enforceExactDriverGovernanceRpcKeys(
    DRIVER_GOVERNANCE_RPC_NAMES.approveEnvelope,
    {
      p_envelope_id: id,
      p_approval_reference: String(approval_reference).trim(),
    },
  );
}

export function buildDriverGovernanceActionArgs(action, { approval_reference } = {}) {
  if (!action || typeof action !== "object") {
    return { ok: false, params: {}, errors: ["Action object required"] };
  }
  const rpc = String(action.rpc || "").trim();
  const code = String(action.action_code || "")
    .trim()
    .toUpperCase();
  const recordId = normalizeDriverGovernanceIntegerId(action.record_id);
  if (!DRIVER_GOVERNANCE_ACTION_RPC_ALLOWLIST.includes(rpc)) {
    return {
      ok: false,
      params: {},
      errors: [`Unknown or disallowed action RPC: ${rpc || "(empty)"}`],
    };
  }
  if (
    code !== DRIVER_GOVERNANCE_ACTION_CODES.SUBMIT_FOR_REVIEW &&
    code !== DRIVER_GOVERNANCE_ACTION_CODES.APPROVE
  ) {
    return {
      ok: false,
      params: {},
      errors: [`Unrecognised action_code: ${code || "(empty)"}`],
    };
  }
  if (recordId == null) {
    return {
      ok: false,
      params: {},
      errors: ["action.record_id must be a positive integer"],
    };
  }

  const isEnvelope =
    rpc === DRIVER_GOVERNANCE_RPC_NAMES.submitEnvelope ||
    rpc === DRIVER_GOVERNANCE_RPC_NAMES.approveEnvelope;
  const isApprove = code === DRIVER_GOVERNANCE_ACTION_CODES.APPROVE;

  if (isEnvelope && isApprove) {
    return buildApproveDriverPolicyEnvelopeArgs({
      record_id: recordId,
      approval_reference,
    });
  }
  if (isEnvelope && !isApprove) {
    return buildSubmitDriverPolicyEnvelopeArgs({ record_id: recordId });
  }
  if (!isEnvelope && isApprove) {
    const built = buildApproveSpecialisedDriverPolicyArgs({
      record_id: recordId,
      approval_reference,
    });
    if (!built.ok) return built;
    return enforceExactDriverGovernanceRpcKeys(rpc, built.params);
  }
  const built = buildSubmitSpecialisedDriverPolicyArgs({ record_id: recordId });
  if (!built.ok) return built;
  return enforceExactDriverGovernanceRpcKeys(rpc, built.params);
}

/**
 * Fail-closed readiness check before invoking a lifecycle action.
 */
export function evaluateDriverGovernanceActionDispatch(action, ctx = {}) {
  const errors = [];
  if (!action || typeof action !== "object") {
    return { ok: false, errors: ["Missing action object"] };
  }
  if (action.enabled !== true) errors.push("Action is not enabled");
  const code = String(action.action_code || "")
    .trim()
    .toUpperCase();
  if (
    code !== DRIVER_GOVERNANCE_ACTION_CODES.SUBMIT_FOR_REVIEW &&
    code !== DRIVER_GOVERNANCE_ACTION_CODES.APPROVE
  ) {
    errors.push("Unrecognised action_code");
  }
  const rpc = String(action.rpc || "").trim();
  if (!DRIVER_GOVERNANCE_ACTION_RPC_ALLOWLIST.includes(rpc)) {
    errors.push("Unknown or disallowed action RPC");
  }
  if (DRIVER_GOVERNANCE_EXCLUDED_RPC_NAMES.includes(rpc)) {
    errors.push("Draft-create RPC is not available in this workspace");
  }
  if (normalizeDriverGovernanceIntegerId(action.record_id) == null) {
    errors.push("record_id must be a positive integer");
  }
  const required = String(action.required_module || "").trim();
  if (required === DRIVER_GOVERNANCE_PRM_PERMISSION_TARGET) {
    if (ctx.canEditPrm !== true) {
      errors.push("Production Route Manager edit permission required");
    }
  } else if (required === DRIVER_GOVERNANCE_PERMISSION_TARGET || !required) {
    if (ctx.canEditCbm !== true) {
      errors.push("Cost Build Manager edit permission required");
    }
  } else if (required) {
    // Unknown required_module: fail closed unless caller supplied matching grant.
    if (ctx.canEditRequiredModule !== true) {
      errors.push(`Missing edit permission for ${required}`);
    }
  }
  if (
    ctx.selectedCostElementCode &&
    ctx.actionCostElementCode &&
    normalizeDriverGovernanceCode(ctx.selectedCostElementCode) !==
      normalizeDriverGovernanceCode(ctx.actionCostElementCode)
  ) {
    errors.push("Action is stale for the selected cost element");
  }
  if (ctx.actionToken != null && ctx.detailActionToken != null) {
    if (ctx.actionToken !== ctx.detailActionToken) {
      errors.push("Action object is stale");
    }
  }
  if (ctx.detailLoading === true) errors.push("Detail is still loading");
  if (ctx.detailFailed === true) errors.push("Detail load failed");
  return { ok: errors.length === 0, errors };
}

function coerceList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw == null) return [];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function normalizeDriverGovernanceRegistryRow(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  const code = normalizeDriverGovernanceCode(
    r.cost_element_code || r.cost_element || r.element_code || r.code,
  );
  const canonical = DRIVER_GOVERNANCE_CANONICAL_ELEMENTS.find(
    (el) => el.code === code,
  );
  const validationRaw =
    r.validation_status ??
    r.validation ??
    r.registry_validation_status ??
    null;
  // Registry may omit validation — never invent PASS.
  const validation_status = isBlank(validationRaw)
    ? null
    : typeof validationRaw === "object"
      ? validationRaw.status || validationRaw.result || null
      : String(validationRaw).trim();

  return {
    ...r,
    cost_element_code: code,
    cost_element_label:
      r.cost_element_label ||
      r.cost_element_name ||
      r.label ||
      canonical?.label ||
      code ||
      "—",
    sort_order:
      Number(r.sort_order) ||
      canonical?.sort_order ||
      999,
    driver_domain: r.driver_domain || r.domain || null,
    formula_type:
      r.formula_type || r.formula || r.formula_display || r.formula_code || null,
    lifecycle_status:
      r.lifecycle_status || r.status || r.policy_status || r.envelope_status || null,
    validation_status,
    effective_from: r.effective_from || r.effective_from_date || null,
    maturity_status: r.maturity_status || r.maturity || null,
    client_status: r.client_status || r.client || null,
    data_quality_status:
      r.data_quality_status || r.dq_status || r.data_quality || null,
    cutover_status: r.cutover_status || r.cutover || null,
    owner_module:
      r.owner_module || r.canonical_owner_module || r.owner || null,
    is_registered:
      r.is_registered === false || r.registered === false
        ? false
        : r.is_registered === true || r.registered === true
          ? true
          : null,
  };
}

export function unwrapDriverGovernanceRegistryPayload(raw) {
  let payload = raw;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = null;
    }
  }
  let rows = [];
  if (Array.isArray(payload)) rows = payload;
  else if (payload && typeof payload === "object") {
    rows = coerceList(
      payload.rows ||
        payload.registry ||
        payload.items ||
        payload.data ||
        payload.cost_elements,
    );
  }

  const normalized = rows
    .map(normalizeDriverGovernanceRegistryRow)
    .filter((row) => !!row.cost_element_code);

  // Fallback catalog only when the registry RPC returns no usable rows.
  if (normalized.length === 0) {
    return DRIVER_GOVERNANCE_CANONICAL_ELEMENTS.map((el) => ({
      cost_element_code: el.code,
      cost_element_label: el.label,
      sort_order: el.sort_order,
      driver_domain: null,
      formula_type: null,
      lifecycle_status: null,
      validation_status: null,
      effective_from: null,
      maturity_status: null,
      client_status: null,
      data_quality_status: null,
      cutover_status: null,
      owner_module: null,
      is_registered: false,
    }));
  }

  // Server rows are the sole canonical registry. Key only by cost_element_code.
  // Never append fallback rows. Never merge by label.
  const byCode = new Map();
  for (const row of normalized) {
    if (!byCode.has(row.cost_element_code)) {
      byCode.set(row.cost_element_code, row);
    }
  }

  return [...byCode.values()].sort((a, b) => {
    const ao = Number(a.sort_order);
    const bo = Number(b.sort_order);
    const aOrder = Number.isFinite(ao) && ao > 0 ? ao : 999;
    const bOrder = Number.isFinite(bo) && bo > 0 ? bo : 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a.cost_element_code).localeCompare(
      String(b.cost_element_code),
    );
  });
}

export function normalizeDriverGovernanceFormulaExplanation(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const textField = (key) => {
    const value = raw[key];
    if (isBlank(value)) return null;
    if (typeof value === "object") return null;
    return String(value).trim();
  };

  const normalizeStepItem = (item, index) => {
    if (item == null) return null;
    if (typeof item === "string" || typeof item === "number") {
      const text = String(item).trim();
      return text ? { order: index + 1, text } : null;
    }
    if (typeof item !== "object") return null;
    const text =
      item.text ||
      item.step ||
      item.description ||
      item.label ||
      item.detail ||
      item.name ||
      null;
    if (isBlank(text) || typeof text === "object") return null;
    const order = Number(item.order ?? item.seq ?? item.sequence ?? index + 1);
    return {
      order: Number.isFinite(order) && order > 0 ? order : index + 1,
      text: String(text).trim(),
    };
  };

  const calculation_steps = coerceList(raw.calculation_steps)
    .map(normalizeStepItem)
    .filter(Boolean);
  const evidence_basis = coerceList(raw.evidence_basis)
    .map(normalizeStepItem)
    .filter(Boolean);

  const explanation = {
    title: textField("title"),
    purpose: textField("purpose"),
    equation: textField("equation"),
    calculation_steps,
    evidence_basis,
    status_treatment: textField("status_treatment"),
    redistribution_rule: textField("redistribution_rule"),
    interpretation: textField("interpretation"),
    future_improvements: textField("future_improvements"),
  };

  const hasContent =
    explanation.title ||
    explanation.purpose ||
    explanation.equation ||
    explanation.calculation_steps.length > 0 ||
    explanation.evidence_basis.length > 0 ||
    explanation.status_treatment ||
    explanation.redistribution_rule ||
    explanation.interpretation ||
    explanation.future_improvements;

  return hasContent ? explanation : null;
}

/**
 * Ordered Driver Logic blocks for dense ERP detail rendering.
 * Empty fields are omitted. Unknown server keys are ignored.
 */
export function buildDriverGovernanceLogicSections(explanation) {
  const expl = normalizeDriverGovernanceFormulaExplanation(explanation);
  if (!expl) return [];

  const sections = [];
  if (expl.title) {
    sections.push({ id: "title", label: "Driver title", kind: "text", value: expl.title });
  }
  if (expl.purpose) {
    sections.push({
      id: "purpose",
      label: "Purpose",
      kind: "text",
      value: expl.purpose,
    });
  }
  if (expl.equation) {
    sections.push({
      id: "equation",
      label: "Formula",
      kind: "text",
      value: expl.equation,
    });
  }
  if (expl.calculation_steps.length) {
    sections.push({
      id: "calculation_steps",
      label: "How the allocation is calculated",
      kind: "steps",
      value: expl.calculation_steps,
    });
  }
  if (expl.evidence_basis.length) {
    sections.push({
      id: "evidence_basis",
      label: "Evidence and source basis",
      kind: "steps",
      value: expl.evidence_basis,
    });
  }
  if (expl.status_treatment) {
    sections.push({
      id: "status_treatment",
      label: "Ready / Review / Blocked treatment",
      kind: "text",
      value: expl.status_treatment,
    });
  }
  if (expl.redistribution_rule) {
    sections.push({
      id: "redistribution_rule",
      label: "Future-run redistribution",
      kind: "text",
      value: expl.redistribution_rule,
    });
  }
  if (expl.interpretation) {
    sections.push({
      id: "interpretation",
      label: "Interpretation",
      kind: "text",
      value: expl.interpretation,
    });
  }
  if (expl.future_improvements) {
    sections.push({
      id: "future_improvements",
      label: "Future improvements",
      kind: "text",
      value: expl.future_improvements,
    });
  }
  return sections;
}

export function normalizeDriverGovernanceAction(raw = {}) {
  const a = raw && typeof raw === "object" ? raw : {};
  return {
    ...a,
    action_code: String(a.action_code || a.code || a.action || "")
      .trim()
      .toUpperCase(),
    enabled: a.enabled === true,
    required_module: String(
      a.required_module || a.permission_target || a.module || "",
    ).trim(),
    rpc: String(a.rpc || a.rpc_name || a.function_name || "").trim(),
    record_id: normalizeDriverGovernanceIntegerId(
      a.record_id ?? a.policy_id ?? a.envelope_id ?? a.id,
    ),
  };
}

export function unwrapDriverGovernanceDetailPayload(raw) {
  let payload = raw;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = null;
    }
  }
  if (!payload || typeof payload !== "object") {
    return {
      cost_element: null,
      registry: null,
      detail: {},
      actions: [],
      owner_module: null,
      cutover_authorised: false,
      is_unregistered: true,
    };
  }
  const root = Array.isArray(payload) ? payload[0] || {} : payload;
  const detail =
    root.detail && typeof root.detail === "object" ? root.detail : root;
  const actions = coerceList(root.actions || detail.actions).map(
    normalizeDriverGovernanceAction,
  );
  const cost_element = root.cost_element || root.element || null;
  const registry = root.registry || null;
  const owner_module =
    root.owner_module ||
    detail.canonical_source_module ||
    registry?.owner_module ||
    null;
  // Server may return either alias; UI never invokes Stage 03 RPCs.
  const cutover_authorised =
    root.cutover_authorised === true ||
    root.stage03_cutover_authorised === true ||
    root.stage_03_cutover_authorised === true;

  const hasCurrent =
    detail.current_policy != null || detail.current_envelope != null;
  const hasHistory =
    coerceList(detail.policy_rows).length > 0 ||
    coerceList(detail.envelope_history).length > 0;
  const explicitUnregistered =
    root.is_registered === false ||
    registry?.is_registered === false ||
    detail.is_registered === false;
  const is_unregistered =
    explicitUnregistered || (!hasCurrent && !hasHistory && actions.length === 0);

  return {
    cost_element,
    registry,
    detail: {
      policy_rows: coerceList(detail.policy_rows),
      current_policy: detail.current_policy ?? null,
      envelope_history: coerceList(detail.envelope_history),
      current_envelope: detail.current_envelope ?? null,
      validation: detail.validation ?? null,
      scope_factors: coerceList(detail.scope_factors),
      behaviour_factors: coerceList(detail.behaviour_factors),
      resource_factors: coerceList(detail.resource_factors),
      formula_display: detail.formula_display ?? null,
      formula_explanation: normalizeDriverGovernanceFormulaExplanation(
        detail.formula_explanation ?? root.formula_explanation ?? null,
      ),
      canonical_source_module:
        detail.canonical_source_module || owner_module || null,
    },
    actions,
    owner_module,
    cutover_authorised,
    is_unregistered,
  };
}

export function filterVisibleDriverGovernanceActions(
  actions = [],
  { canEditCbm = false, canEditPrm = false, viewOnly = false } = {},
) {
  if (viewOnly) return [];
  return (Array.isArray(actions) ? actions : [])
    .map(normalizeDriverGovernanceAction)
    .filter((action) => {
      if (action.enabled !== true) return false;
      if (!DRIVER_GOVERNANCE_ACTION_RPC_ALLOWLIST.includes(action.rpc)) {
        return false;
      }
      if (action.record_id == null) return false;
      const required = action.required_module;
      if (required === DRIVER_GOVERNANCE_PRM_PERMISSION_TARGET) {
        return canEditPrm === true;
      }
      if (
        required === DRIVER_GOVERNANCE_PERMISSION_TARGET ||
        !required ||
        required.includes("cost-build-manager")
      ) {
        return canEditCbm === true;
      }
      return false;
    });
}

export function formatDriverGovernanceBadgeLabel(value) {
  if (isBlank(value)) return null;
  return String(value)
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isPrmOwnedDriverCostElement(code) {
  const normalized = normalizeDriverGovernanceCode(code);
  return (
    normalized === "DIRECT_LABOUR" || normalized === "PRODUCTION_OVERHEAD"
  );
}

export function buildDriverGovernancePrmHandoffLinks() {
  return [
    { id: "route-readiness", label: "Open Route Readiness", lens: "route-readiness" },
    {
      id: "shared-workload-preview",
      label: "Open Workload Preview",
      lens: "shared-workload-preview",
    },
    {
      id: "route-families",
      label: "Open Route Family Editor",
      lens: "route-families",
    },
    {
      id: "product-route-assignments",
      label: "Open Product Assignments",
      lens: "product-route-assignments",
    },
    {
      id: "production-route-home",
      label: "Open Production Route Manager",
      lens: "route-readiness",
    },
  ];
}

export function pickDriverGovernanceCurrentRecord(detailPayload) {
  const d = detailPayload?.detail || {};
  return d.current_policy || d.current_envelope || null;
}

export function listHasItems(value) {
  return Array.isArray(value) && value.length > 0;
}
