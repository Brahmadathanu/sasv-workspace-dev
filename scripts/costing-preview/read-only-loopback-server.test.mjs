import test from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import { createReadOnlyLoopbackServer } from "./read-only-loopback-server.mjs";

let server;
let base;
test.before(async () => {
  server = await createReadOnlyLoopbackServer();
  assert.equal(server.address().address, "127.0.0.1", "must be loopback only");
  base = "http://127.0.0.1:" + server.address().port;
});
test.after(() => new Promise((resolve) => server?.close(resolve)));

test("status explicitly reports no backend/authentication or acceptance", async () => {
  const r = await fetch(base + "/__preview/status");
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.backend, "DISCONNECTED");
  assert.equal(j.realAuthentication, false);
  assert.equal(j.signedInAcceptance, "NOT_TESTED");
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.match(r.headers.get("content-security-policy"), /connect-src 'none'/);
});
test("six genuine module static HTML pages load without external backend", async () => {
  for (const module of ["costing-control-center","material-cost-manager","cost-build-manager","pricing-policy-manager","cost-sheet-review","production-route-manager"]) {
    const r = await fetch(base + "/shared/" + module + ".html");
    assert.equal(r.status, 200, module);
    assert.match(r.headers.get("content-type"), /text\/html/, module);
    assert.ok((await r.text()).length > 500, module);
  }
});
test("write methods fail closed for static pages and RPC endpoints", async () => {
  for (const method of ["POST","PUT","PATCH","DELETE"]) {
    for (const path of ["/shared/cost-sheet-review.html","/rest/v1/costing_refresh_run","/rpc/rpc_refresh_costing"]) {
      const r = await fetch(base + path, { method });
      assert.equal(r.status, 405, method + " " + path);
    }
  }
});
test("backend routes and proxy attempts are denied", async () => {
  for (const route of ["/rest/v1", "/rest/v1/snapshot", "/auth/v1/token", "/rpc/rpc_get_costing", "/functions/v1/x", "/storage/v1/object", "/realtime/v1", "/api/proxy"]) {
    assert.equal((await fetch(base + route)).status, 403, route);
  }
});
test("head requests are safe and ordinary unknown resources are absent", async () => {
  const r = await fetch(base + "/shared/cost-sheet-review.html", { method: "HEAD" });
  assert.equal(r.status, 200);
  assert.equal(await r.text(), "");
  assert.equal((await fetch(base + "/__private_environment.txt")).status, 404);
});
test("cross-site Host and absolute-form proxy URLs cannot reach resources", async () => {
  const transport = (path, host) => new Promise((resolve, reject) => {
    const req = request({ hostname: "127.0.0.1", port: server.address().port, method: "GET", path, headers: { Host: host } },
      (response) => { response.resume(); response.on("end", () => resolve(response.statusCode)); });
    req.on("error", reject); req.end();
  });
  assert.equal(await transport("/shared/cost-sheet-review.html", "evil.example"), 403);
  assert.equal(await transport("http://example.com/rest/v1/x", "127.0.0.1"), 403);
});
test("traversal, unsupported files, and encoded path separators stay outside preview", async () => {
  const transport = (path) => new Promise((resolve, reject) => {
    const req = request({ hostname: "127.0.0.1", port: server.address().port, path },
      (response) => { response.resume(); response.on("end", () => resolve(response.statusCode)); });
    req.on("error", reject); req.end();
  });
  for (const path of ["/%2e%2e/package.json", "/..%5c..%5cpackage.json", "/%00package.json"]) {
    assert.notEqual(await transport(path), 200, path);
  }
  assert.notEqual(await transport("/.env"), 200);
});
