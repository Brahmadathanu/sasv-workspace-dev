// R3: central exact-run read guard for the Costing Suite client.
// The shell injects ONE costingFrom / costingRpc into every screen module, so guarding those two functions covers every
// explicit run selection (cost sheet, printable, traceability, comparison, review worklist, draft evidence, run status,
// material/driver/route/QC/MS explain, control-center drilldowns). The server remains the authority; this layer makes the
// UI fail closed with an explicit message instead of showing a purged run as an empty or valid result.
import { parseRunDetailAvailability } from "./costing-run-detail-availability.js";

export const RUN_GUARD_ERROR_CODES = Object.freeze({
  UNAVAILABLE: "RUN_DETAILS_UNAVAILABLE",
  UNCONFIRMED: "RUN_AVAILABILITY_UNCONFIRMED",
  MISMATCH: "RUN_RESPONSE_MISMATCH",
});
// Only removed-detail states block reads. In-progress/failed runs keep their (partial) metadata and diagnostics readable;
// they are never a valid cost basis, which is enforced at selection/approval time (strict helper) and by the server.
const BLOCKED_READ_STATES = new Set(["DETAILS_PURGED", "PURGE_IN_PROGRESS"]);
// Exact-run READ rpc families only. Writers, refresh, approval and the availability probe itself are never gated here.
const GUARDED_RPC = /^rpc_(get|export|preview)_/;
const NEVER_GUARD_RPC = new Set(["rpc_costing_run_detail_availability"]);

export function isRunReadable(av) {
  if (!av || av.state === "UNKNOWN" || av.state === "UNKNOWN_RUN") return false;
  return !BLOCKED_READ_STATES.has(av.state);
}

function guardError(code, runId, message) {
  return { code, message, details: `run ${runId}`, hint: null, runId };
}

export function createRunGuard({ supabase, ttlMs = 15000, now = () => Date.now() }) {
  const cache = new Map(); // runId -> { at, value }
  const inflight = new Map();

  async function check(runId) {
    const key = String(runId);
    const hit = cache.get(key);
    if (hit && now() - hit.at < ttlMs) return hit.value;
    if (inflight.has(key)) return inflight.get(key);
    const p = (async () => {
      let av;
      try {
        const { data, error } = await supabase.rpc("rpc_costing_run_detail_availability", { p_refresh_run_id: Number(runId) });
        av = error ? parseRunDetailAvailability(null) : parseRunDetailAvailability(data);
        // the answer must be about the run we asked about
        if (!error && data && data.refresh_run_id != null && Number(data.refresh_run_id) !== Number(runId)) av = parseRunDetailAvailability(null);
      } catch {
        av = parseRunDetailAvailability(null);
      }
      cache.set(key, { at: now(), value: av });
      return av;
    })().finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  }

  async function gate(runId) {
    if (runId === null || runId === undefined || runId === "") return null;
    const av = await check(runId);
    if (isRunReadable(av)) return null;
    const unconfirmed = av.state === "UNKNOWN" || av.state === "UNKNOWN_RUN";
    return guardError(
      unconfirmed ? RUN_GUARD_ERROR_CODES.UNCONFIRMED : RUN_GUARD_ERROR_CODES.UNAVAILABLE,
      runId,
      `Run ${runId}: ${av.message || "details are not available"}`,
    );
  }

  function rowsMismatch(data, runId) {
    const rows = Array.isArray(data) ? data : data && typeof data === "object" ? [data] : [];
    return rows.some((r) => r && typeof r === "object" && r.refresh_run_id != null && Number(r.refresh_run_id) !== Number(runId));
  }
  const mismatchResult = (runId) => ({ data: null, error: guardError(RUN_GUARD_ERROR_CODES.MISMATCH, runId, `Run ${runId}: the server returned rows for a different run; the response was rejected.`) });

  // View/table reads: the run is whatever .eq("refresh_run_id", X) selected. Returns {data:null,error} (supabase shape).
  function from(view) {
    const wrap = (builder, run) =>
      new Proxy(builder, {
        get(target, prop) {
          if (prop === "then") {
            return (resolve, reject) =>
              (async () => {
                if (run.id !== null) {
                  const blocked = await gate(run.id);
                  if (blocked) return { data: null, error: blocked };
                }
                const res = await target;
                if (run.id !== null && !res?.error && rowsMismatch(res?.data, run.id)) return mismatchResult(run.id);
                return res;
              })().then(resolve, reject);
          }
          const v = target[prop];
          if (typeof v !== "function") return v;
          return (...args) => {
            if (prop === "eq" && args[0] === "refresh_run_id") run.id = args[1];
            if (prop === "in" && args[0] === "refresh_run_id" && Array.isArray(args[1]) && args[1].length === 1) run.id = args[1][0];
            const out = v.apply(target, args);
            return out && typeof out === "object" && typeof out.then === "function" ? wrap(out, run) : out;
          };
        },
      });
    return wrap(supabase.from(view), { id: null });
  }

  // RPC reads with an exact-run parameter.
  async function rpc(name, params, options = null) {
    const runId = params && params.p_refresh_run_id != null ? params.p_refresh_run_id : null;
    let query;
    const exec = async () => {
      if (runId !== null && GUARDED_RPC.test(String(name)) && !NEVER_GUARD_RPC.has(String(name))) {
        const blocked = await gate(runId);
        if (blocked) return { data: null, error: blocked };
      }
      query = supabase.rpc(name, params);
      if (options && Number.isFinite(Number(options.rangeFrom)) && Number.isFinite(Number(options.rangeTo))) {
        query = query.range(Number(options.rangeFrom), Number(options.rangeTo));
      }
      const res = await query;
      if (runId !== null && GUARDED_RPC.test(String(name)) && !res?.error && rowsMismatch(res?.data, runId)) return mismatchResult(runId);
      return res;
    };
    return exec();
  }

  return { from, rpc, check, gate, invalidate: (runId) => (runId == null ? cache.clear() : cache.delete(String(runId))) };
}
