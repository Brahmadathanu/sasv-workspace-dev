// G7 authenticated acceptance harness — READ ONLY, browser console, no tokens logged.
// Run in the normal SASV Workspace origin, in an independently existing signed-in
// MIS View session and separately in a real signed-in no-MIS-View session.
// For anon, run in a genuinely logged-out/private browser session.
// No staff provisioning, permission changes, token impersonation or writes.
// Copy the async IIFE below into DevTools console. Do not paste keys or JWTs.
(async () => {
  const moduleUrl = new URL("/public/shared/js/supabaseClient.js", location.origin);
  const { supabase } = await import(moduleUrl.href);
  const result = {
    check: "MIS_G7_CANONICAL_AUTH_RPC",
    origin: location.origin,
    time: new Date().toISOString(),
    role_classification: "UNKNOWN",
    session_present: false,
    canonical_permission: null,
    rpc_outcome: "NOT_RUN",
    rpc_code: null,
    approved_cost_run: null,
    report_month: null,
    receipt_events: null,
    receipt_unvalued: null,
    plan_status: null,
    comparable: null,
    note: "No user identity, token or response body recorded"
  };
  const { data: userData, error: userError } = await supabase.auth.getUser();
  result.session_present = Boolean(userData?.user && !userError);
  if (result.session_present) {
    const { data, error } = await supabase.rpc("app_has_permission", {
      p_target: "module:executive-mis-dashboard",
      p_mode: "view"
    });
    if (error) {
      result.rpc_outcome = "BLOCKED_PERMISSION_LOOKUP";
      result.rpc_code = error.code || "UNKNOWN";
      console.table(result);
      return result;
    }
    result.canonical_permission = data === true;
    result.role_classification = result.canonical_permission
      ? "SIGNED_IN_MIS_VIEW" : "SIGNED_IN_NO_MIS_VIEW";
  } else {
    result.role_classification = "ANONYMOUS";
  }
  const { data: report, error: reportError } = await supabase.rpc(
    "get_mis_production_value_summary",
    { p_report_month: "2026-11-01", p_as_of_date: "2026-11-20" }
  );
  if (reportError) {
    result.rpc_outcome = "DENIED_OR_ERROR";
    result.rpc_code = reportError.code || "UNKNOWN";
  } else {
    result.rpc_outcome = "ALLOWED";
    result.approved_cost_run = report?.approved_cost_run_id ?? null;
    result.report_month = report?.report_month ?? null;
    result.receipt_events = report?.receipt_event_count ?? null;
    result.receipt_unvalued = report?.receipt_unvalued_count ?? null;
    result.plan_status = report?.plan_status ?? null;
    result.comparable = report?.comparability ?? null;
  }
  const expectation =
    result.role_classification === "SIGNED_IN_MIS_VIEW"
      ? result.rpc_outcome === "ALLOWED"
      : result.rpc_outcome !== "ALLOWED";
  result.acceptance = expectation ? "PASS" : "FAIL";
  console.table(result);
  return result;
})();
// Expected: MIS View -> ALLOWED with approved_cost_run=143, report_month=2026-11-01,
// receipt_events=79, receipt_unvalued=2, comparable=NOT_COMPARABLE at a
// matching source vintage. Genuine signed-in no-View and anonymous -> DENIED.
// Results may drift with source updates; record as-of and source observation.
// Never publish email, user ID, authorization headers, JWT or raw RPC response.
