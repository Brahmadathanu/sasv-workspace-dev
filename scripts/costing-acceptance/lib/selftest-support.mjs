// LOCAL SELF-TEST SUPPORT ONLY. A fake backend and a stub supabase-js that talks to it over real HTTP, so the runner's network guard can be
// exercised end to end without any real Supabase, credentials or hosted target. Output produced with this support is LOCAL_SELF_TEST evidence.
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const CANARY_TOKEN = "CANARY-TOKEN-SELFTEST-eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjYW5hcnkifQ.SIGNATURE-CANARY";
export const CANARY_EMAIL = "canary.user@example.invalid";
export const CANARY_UID = "11111111-2222-4333-8444-555555555555";
const TARGETS = ["module:costing-control-center", "module:material-cost-manager", "module:cost-build-manager", "module:pricing-policy-manager", "module:cost-sheet-review", "module:production-route-manager"];
export const viewOnlyRows = () => TARGETS.map((target) => ({ target, can_view: true, can_edit: false }));

export function startFakeBackend({ permissions = viewOnlyRows() } = {}) {
  const seen = [];
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x"); let body = "";
    req.on("data", (c) => (body += c)); req.on("end", () => {
      seen.push({ method: req.method, path: u.pathname, auth: req.headers.authorization ? "present" : "absent" });
      res.setHeader("access-control-allow-origin", "*"); res.setHeader("access-control-allow-headers", "*"); res.setHeader("access-control-allow-methods", "*");
      if (req.method === "OPTIONS") return res.writeHead(204).end();
      res.setHeader("content-type", "application/json");
      if (u.pathname === "/rest/v1/rpc/get_user_permissions") return res.end(JSON.stringify(permissions));
      res.end("[]");
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ origin: "http://127.0.0.1:" + server.address().port, seen, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }) })));
}

/** Serves the PUBLIC tree of an exact commit (git archive), so the build verifier can prove it byte-identical. */
export async function startAppServer(root, sha) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "accept-app-"));
  execFileSync("tar", ["-x", "-C", dir], { input: execFileSync("git", ["archive", sha, "public"], { cwd: root, maxBuffer: 512 * 1024 * 1024 }) });
  const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
  const server = http.createServer((req, res) => {
    const f = path.join(dir, "public", decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!f.startsWith(path.join(dir, "public")) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end("nf"); }
    res.setHeader("content-type", MIME[path.extname(f)] || "application/octet-stream"); res.end(fs.readFileSync(f));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { origin: "http://127.0.0.1:" + server.address().port, dir, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(() => { fs.rmSync(dir, { recursive: true, force: true }); r(); }); }) };
}

export const stubSupabaseSource = (backend) => `
const B = ${JSON.stringify(backend)}; const TOKEN = ${JSON.stringify(CANARY_TOKEN)};
const user = { id: ${JSON.stringify(CANARY_UID)}, email: ${JSON.stringify(CANARY_EMAIL)} }; const session = { access_token: TOKEN, user };
const call = (method, path, body) => fetch(B + path, { method, headers: { "content-type": "application/json", authorization: "Bearer " + TOKEN, apikey: "CANARY-ANON-KEY" }, body: body === undefined ? undefined : JSON.stringify(body) })
  .then(async (r) => ({ data: await r.json().catch(() => null), error: r.ok ? null : { message: "http " + r.status }, count: null })).catch((e) => ({ data: null, error: { message: String(e.message) } }));
function chain(view) { let single = false; const proxy = new Proxy(function () {}, { get(_t, p) {
  if (p === "then") return (res, rej) => call("GET", "/rest/v1/" + view).then((r) => res(single ? { ...r, data: r.data?.[0] ?? null } : r), rej);
  if (p === "catch" || p === "finally") return () => proxy;
  if (["insert", "update", "upsert", "delete"].includes(p)) return () => call({ insert: "POST", update: "PATCH", upsert: "POST", delete: "DELETE" }[p], "/rest/v1/" + view, {});
  if (p === "maybeSingle" || p === "single") return () => { single = true; return proxy; };
  return () => proxy; }, apply: () => proxy }); return proxy; }
export function createClient() { const client = {
  auth: { getSession: async () => ({ data: { session }, error: null }), getUser: async () => ({ data: { user }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), refreshSession: async () => ({ data: { session }, error: null }), signOut: async () => ({ error: null }) },
  from: (v) => chain(v), rpc: (name, args) => call("POST", "/rest/v1/rpc/" + name, args ?? {}), schema: () => client, channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {} };
  return client; }
`;

/** Context hook for self-tests: stub the supabase ESM and inert CDN assets; optional trap script runs inside every page. */
export const selfTestContextHook = ({ backendOrigin, trapScript = null }) => async (context) => {
  await context.route(/esm\.sh\/@supabase\/supabase-js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: stubSupabaseSource(backendOrigin) }));
  await context.route(/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/, (r) => r.fulfill({ status: 200, contentType: /\.css/.test(r.request().url()) ? "text/css" : "text/javascript", body: "" }));
  if (trapScript) await context.addInitScript(trapScript);
};
