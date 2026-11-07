// Network-level read-only policy for the acceptance runner. Pure functions; every request the browser makes is classified here and
// anything that is not provably a read is ABORTED before it leaves the browser and recorded as a violation.
export const READ_RPC = /^(get_user_permissions|rpc_get_[a-z0-9_]+)$/;
// Names that must never be called by acceptance, even if a future name pattern would match them. Informational and tested.
export const FORBIDDEN_RPC_HINT = /(^|_)(create|update|upsert|delete|submit|approve|accept|close|supersede|clone|set|apply|archive|retire|import|map|unmap|inactivate|reactivate|deactivate|cancel|correct|request|refresh|recalc|recalculation|finali[sz]e|lock|decide|generate|adjust|run|start|trigger|save|register|insert|remove|reject|reopen|release|publish|post|authori[sz]e|preview|revoke|designate)(_|$)/i;
// UI controls that must only be OBSERVED (present / enabled), never clicked.
// Bare "Preview" buttons on the pricing/route pages are advisory reads (network-guarded anyway); the approval-impact action is "Review for approval".
export const FORBIDDEN_UI_VERBS = /\b(review for approval|approval preview|request|approve|recalculate|recalc|refresh|lock|apply|accept|finali[sz]e|close period|supersede|save|create|delete|decide|revoke|submit|run costing|request draft)\b/i;
const CDN = /^(esm\.sh|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com)$/;

/**
 * @returns {{ allowed: boolean, kind: string, name?: string, reason?: string, violation: boolean }}
 *  violation=true means a write-capable or unknown backend operation was attempted (fails the run); blocked non-violations (e.g. unknown third party) are findings.
 */
export function classifyRequest({ method, url }, { baseOrigin, backendOrigin, extraRead = new Set() }) {
  let u; try { u = new URL(url); } catch { return { allowed: false, kind: "malformed", reason: "unparseable URL", violation: true }; }
  const m = String(method || "GET").toUpperCase();
  if (u.origin === backendOrigin) {
    const p = u.pathname;
    let mm;
    if ((mm = /^\/rest\/v1\/rpc\/([^/]+)$/.exec(p))) {
      const name = decodeURIComponent(mm[1]);
      if ((m === "POST" || m === "GET") && READ_RPC.test(name)) return { allowed: true, kind: "rpc-read", name, violation: false };
      if ((m === "POST" || m === "GET") && extraRead.has(name)) return { allowed: true, kind: "rpc-read-app-documented", name, violation: false };
      return { allowed: false, kind: "rpc-denied", name, reason: READ_RPC.test(name) ? `method ${m} not allowed` : "not on the read-only RPC allow-list", violation: true };
    }
    if ((mm = /^\/rest\/v1\/([^/]+)$/.exec(p))) {
      if (m === "GET" || m === "HEAD") return { allowed: true, kind: "rest-read", name: decodeURIComponent(mm[1]), violation: false };
      return { allowed: false, kind: "rest-write", name: decodeURIComponent(mm[1]), reason: `${m} on a table or view`, violation: true };
    }
    if (p === "/auth/v1/token" && m === "POST" && u.searchParams.get("grant_type") === "refresh_token") return { allowed: true, kind: "auth-refresh", violation: false };
    if (p === "/auth/v1/user" && m === "GET") return { allowed: true, kind: "auth-read", violation: false };
    return { allowed: false, kind: "backend-denied", reason: `${m} ${p} is not an allowed backend operation`, violation: true };
  }
  if (u.origin === baseOrigin) return m === "GET" || m === "HEAD" ? { allowed: true, kind: "static", violation: false } : { allowed: false, kind: "static-write", reason: `${m} to the app origin`, violation: true };
  if (CDN.test(u.hostname) && (m === "GET" || m === "HEAD")) return { allowed: true, kind: "cdn", violation: false };
  if (u.protocol === "data:" || u.protocol === "blob:") return { allowed: true, kind: "inline", violation: false };
  return { allowed: false, kind: "unexpected-origin", reason: `${m} ${u.origin}`, violation: m !== "GET" && m !== "HEAD" };
}

/** Read RPCs the app itself documents (RUN_STATUS_READ_RPCS in costing-run-status-screen.js at the commit under test). Their server-side read-only
 *  behaviour is NOT verifiable from the repository (definitions pre-date it), so the runner reports every use as a finding for read-back. */
export function appDocumentedReadRpcs(runStatusScreenSource) {
  const m = /RUN_STATUS_READ_RPCS\s*=\s*Object\.freeze\(\[([^\]]*)\]\)/.exec(String(runStatusScreenSource));
  return m ? [...m[1].matchAll(/"([a-z0-9_]+)"/g)].map((x) => x[1]) : [];
}
