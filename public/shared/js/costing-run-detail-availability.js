// Run detail-availability contract (retention R3). Server is the only authority: this module passes through
// public.rpc_costing_run_detail_availability and FAILS CLOSED. It never substitutes another run for an unavailable one.

const KNOWN_UNAVAILABLE_TEXT = {
  DETAILS_PURGED: "Detailed data for this run was removed under the monthly retention policy. Approval and summary evidence are preserved.",
  PURGE_IN_PROGRESS: "Detail removal for this run is in progress. The run cannot be used.",
  RUN_IN_PROGRESS: "This run has not finished.",
  DETAILS_INCOMPLETE: "This run did not complete successfully and is not a valid cost basis.",
  INCOMPLETE: "This run did not complete successfully and is not a valid cost basis.",
  UNKNOWN_RUN: "This run is not registered. It cannot be used.",
  UNKNOWN: "Availability of this run could not be confirmed. It is treated as unavailable.",
};

export function parseRunDetailAvailability(payload) {
  const ok = payload && typeof payload === "object" && typeof payload.available === "boolean" && typeof payload.state === "string" && payload.state;
  if (!ok) {
    return { runId: payload?.refresh_run_id ?? null, available: false, state: "UNKNOWN", unverified: false, message: KNOWN_UNAVAILABLE_TEXT.UNKNOWN };
  }
  const state = String(payload.state);
  const available = payload.available === true && (state === "AVAILABLE" || state === "AVAILABLE_UNVERIFIED");
  return {
    runId: payload.refresh_run_id ?? null,
    available,
    state: available ? state : (state === "AVAILABLE" || state === "AVAILABLE_UNVERIFIED" ? "UNKNOWN" : state),
    unverified: available && payload.unverified === true,
    message: available ? "" : String(payload.reason || KNOWN_UNAVAILABLE_TEXT[state] || KNOWN_UNAVAILABLE_TEXT.UNKNOWN),
    purgedAt: payload.details_purged_at ?? null,
  };
}

export async function fetchRunDetailAvailability(client, runId) {
  if (runId === null || runId === undefined || runId === "") return parseRunDetailAvailability(null);
  try {
    const { data, error } = await client.rpc("rpc_costing_run_detail_availability", { p_refresh_run_id: runId });
    if (error) return parseRunDetailAvailability(null);
    return parseRunDetailAvailability(data);
  } catch {
    return parseRunDetailAvailability(null);
  }
}

// Selecting a run for review/comparison/pricing/cost sheet: honour exactly the requested run or block. No fallback.
export function resolveRunSelection(requestedRunId, availability) {
  const a = availability && typeof availability === "object" && "available" in availability ? availability : parseRunDetailAvailability(null);
  if (requestedRunId === null || requestedRunId === undefined) return { selectedRunId: null, blocked: true, state: "UNKNOWN", message: KNOWN_UNAVAILABLE_TEXT.UNKNOWN };
  if (!a.available) return { selectedRunId: null, blockedRunId: requestedRunId, blocked: true, state: a.state, message: a.message };
  return { selectedRunId: requestedRunId, blocked: false, state: a.state, unverified: a.unverified, message: "" };
}

export function isRunDetailsUnavailableError(err) {
  return /RUN_DETAILS_UNAVAILABLE/.test(String(err?.message ?? err ?? ""));
}
