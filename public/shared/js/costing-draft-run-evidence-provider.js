// CDE-1b (PROPOSED, NOT CONNECTED): read adapter between the CDE-1a drawer seam and the proposed server RPC
// public.rpc_get_costing_draft_component_evidence_v1 (CDE-2, see CDE2_OWNER_REVIEW_PACKAGE_2026-11-04.md).
//
// STATUS: the server RPC does NOT exist and CDE2-D1..D5 are undecided. Nothing in the application calls
// connectDraftRunEvidenceProvider(); production therefore still shows "provider not connected". This file is inert until a
// separate, owner-approved wiring change and a server read-back exist. A guard test pins that nothing connects it.
//
// SAFETY CONTRACT
//  - Imports NO Supabase client. The RPC caller is injected: callRpc(name, args) -> Promise<{ data, error }>.
//  - Can call exactly ONE function name (below); any other name is refused before the caller is reached. Read-only by construction.
//  - Fails closed: an unknown status, a malformed envelope, a monetary-looking key, a numeric value outside the identity keys,
//    or a thrown caller all yield an error answer, never evidence. null is never translated to READY (the loader keeps null = UNKNOWN).
//  - Identity (period/run/SKU) is verified again by the CDE-1a loader; this adapter only forwards the envelope.
import { setDraftRunEvidenceProvider } from "./costing-draft-run-evidence.js";

export const DRAFT_EVIDENCE_RPC_NAME = "rpc_get_costing_draft_component_evidence_v1";
const ANSWER_STATUSES = new Set(["ok", "empty", "forbidden", "stale", "foreign-run", "error"]);
const IDENTITY_KEYS = new Set(["refresh_run_id", "sku_id"]);
// Contract: "Return no monetary amount, rate, sales figure or PII". Token match on snake_case key names.
const MONEY_TOKEN = /(^|_)(amount|amounts|rate|rates|price|prices|cost|costs|revenue|sales|mrp|margin|profit|salary|wage|wages|email|phone)(_|$)/i;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const POSITIVE_INT = /^[1-9]\d{0,17}$/;

const fail = (status, error) => Object.freeze({ status, ...(error ? { error } : {}) });

/** Returns the first contract violation found in a record, or null. Whitelisting itself is done by the CDE-1a loader. */
export function findEvidenceContractViolation(record, path = "") {
  if (record === null || typeof record !== "object") return null;
  for (const [key, value] of Object.entries(record)) {
    const here = path ? `${path}.${key}` : key;
    if (MONEY_TOKEN.test(key)) return `monetary or personal field "${here}" must not be returned`;
    if (typeof value === "number" && !(path === "" && IDENTITY_KEYS.has(key))) return `numeric value at "${here}" is not allowed (non-monetary status text only)`;
    if (value !== null && typeof value === "object") {
      const nested = findEvidenceContractViolation(value, here);
      if (nested) return nested;
    }
  }
  return null;
}

function mapTransportError(error) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "");
  if (code === "42501" || /permission denied|not authori[sz]ed|forbidden/i.test(message)) return fail("forbidden");
  if (code === "57014") return fail("error", "The evidence read timed out. Try again later.");
  if (code === "PGRST202" || code === "42883" || /could not find the function|does not exist/i.test(message)) return fail("error", "Draft-run evidence service is not available on this server.");
  return fail("error", "Evidence could not be read.");
}

/** Builds the provider the CDE-1a loader expects: { readSkuEvidence({ periodStart, runId, skuId }) }. */
export function createDraftRunEvidenceRpcProvider({ callRpc } = {}) {
  if (typeof callRpc !== "function") throw new TypeError("createDraftRunEvidenceRpcProvider requires an injected callRpc function");
  return Object.freeze({
    async readSkuEvidence({ periodStart, runId, skuId } = {}) {
      const period = String(periodStart ?? "").trim(), run = String(runId ?? "").trim(), sku = String(skuId ?? "").trim();
      if (!DATE_ONLY.test(period) || !POSITIVE_INT.test(run) || !POSITIVE_INT.test(sku)) return fail("error", "Invalid evidence request.");
      let response;
      try {
        response = await callRpc(DRAFT_EVIDENCE_RPC_NAME, { p_period_start: period, p_refresh_run_id: Number(run), p_sku_id: Number(sku) });
      } catch (error) {
        return mapTransportError(error);
      }
      if (response?.error) return mapTransportError(response.error);
      let data = response?.data;
      if (Array.isArray(data)) { if (data.length > 1) return fail("error", "Unexpected evidence response."); data = data[0] ?? null; }
      if (data === null || data === undefined) return fail("empty");
      if (typeof data !== "object") return fail("error", "Unexpected evidence response.");
      const status = String(data.status ?? "");
      if (!ANSWER_STATUSES.has(status)) return fail("error", "Unexpected evidence response.");
      if (status !== "ok") return fail(status, status === "error" ? "Evidence could not be read." : undefined);
      if (!data.record || typeof data.record !== "object" || Array.isArray(data.record)) return fail("error", "Unexpected evidence response.");
      const violation = findEvidenceContractViolation(data.record);
      if (violation) return fail("error", "Evidence response rejected: " + violation);
      return Object.freeze({ status: "ok", record: data.record });
    },
  });
}

/**
 * NOT CALLED ANYWHERE. The single place a future, separately approved wiring change would connect the adapter.
 * `callRpc` must be the application's existing Costing RPC caller; it is deliberately not imported here.
 */
export function connectDraftRunEvidenceProvider(callRpc) {
  setDraftRunEvidenceProvider(createDraftRunEvidenceRpcProvider({ callRpc }));
}
