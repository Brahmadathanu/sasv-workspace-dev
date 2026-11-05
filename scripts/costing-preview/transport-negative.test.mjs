// Wave B negative tests: server-side loopback denial, opaque-origin/proxy, traversal, symlink, file types.
// Pure Node (no browser); raw http.request is used so headers are sent exactly as written.
import test from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import { createConnection } from "node:net";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createReadOnlyLoopbackServer } from "./read-only-loopback-server.mjs";

let server, port, root, outside, tmpRoot;
test.before(async () => {
  const dir = tmpRoot = await mkdtemp(join(tmpdir(), "costing-preview-neg-"));
  root = join(dir, "public");
  outside = join(dir, "outside-secret.txt");
  await mkdir(join(root, "shared"), { recursive: true });
  await writeFile(join(root, "shared", "ok.html"), "<html><body>" + "x".repeat(600) + "</body></html>");
  await writeFile(join(root, "shared", "notes.txt"), "plain text not in allowlist");
  await writeFile(join(root, "shared", "app.js.map"), "{}");
  await writeFile(join(root, ".env"), "SECRET=1");
  await writeFile(outside, "TOP-SECRET-OUTSIDE");
  await symlink(outside, join(root, "shared", "link.html"));
  await symlink(dir, join(root, "shared", "dirlink"));
  server = await createReadOnlyLoopbackServer({ root });
  port = server.address().port;
});
test.after(async () => { await new Promise((r) => server?.close(r)); if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true }); });

const send = ({ path = "/shared/ok.html", method = "GET", headers = {}, host } = {}) => new Promise((resolve, reject) => {
  const req = request({ hostname: "127.0.0.1", port, path, method, setHost: false,
    headers: { ...(host === null ? {} : { Host: host ?? "127.0.0.1:" + port }), ...headers } }, (res) => {
    const chunks = []; res.on("data", (c) => chunks.push(c));
    res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
  });
  req.on("error", reject); req.end();
});

test("server listens on IPv4 loopback only", () => {
  assert.equal(server.address().address, "127.0.0.1");
  assert.equal(server.address().family, "IPv4");
});

test("baseline: correct Host serves the page", async () => {
  const r = await send();
  assert.equal(r.status, 200);
  assert.equal((await send({ host: "localhost:" + port })).status, 200);
});

test("wrong, spoofed, missing or wrong-port Host headers are refused (DNS rebinding)", async () => {
  for (const host of ["evil.example", "evil.example:" + port, "127.0.0.1.evil.example:" + port, "localhost.evil.example:" + port,
    "127.0.0.1", "127.0.0.1:1", "0.0.0.0:" + port, "[::1]:" + port, "user@127.0.0.1:" + port, "", "127.0.0.1:" + port + ", evil.example"]) {
    // Node itself answers 400 for some malformed Host values; both are refusals.
    assert.ok([400, 403].includes((await send({ host })).status), JSON.stringify(host));
  }
  assert.ok([400, 403].includes((await send({ host: null })).status), "missing Host");
});

test("opaque / cross-origin browser requests are refused and no CORS grant is ever sent", async () => {
  for (const origin of ["null", "https://evil.example", "http://127.0.0.1:1", "http://localhost.evil.example:" + port, "file://"]) {
    const r = await send({ headers: { Origin: origin } });
    assert.equal(r.status, 403, origin);
    assert.equal(r.headers["access-control-allow-origin"], undefined, origin);
  }
  for (const site of ["cross-site", "same-site"]) {
    assert.equal((await send({ headers: { "Sec-Fetch-Site": site } })).status, 403, site);
  }
  const same = await send({ headers: { Origin: "http://127.0.0.1:" + port, "Sec-Fetch-Site": "same-origin" } });
  assert.equal(same.status, 200);
  assert.equal(same.headers["access-control-allow-origin"], undefined);
  assert.equal((await send({ method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" } })).status, 405);
});

test("every non-GET/HEAD method is refused, including proxy and diagnostic verbs", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "TRACE", "PROPFIND", "CONNECT"]) {
    if (method === "CONNECT") continue; // Node client cannot emit a CONNECT with a path; covered by raw socket below
    const r = await send({ method });
    assert.equal(r.status, 405, method);
    assert.equal(r.headers.allow, "GET, HEAD", method);
  }
});

test("raw-socket CONNECT and absolute-form proxy requests are refused", async () => {
  const raw = (text) => new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port }, () => socket.write(text));
    let data = ""; socket.on("data", (c) => (data += c)); socket.on("end", () => resolve(data)); socket.on("close", () => resolve(data));
    socket.on("error", reject); setTimeout(() => socket.destroy(), 1500);
  });
  const connect = await raw("CONNECT example.com:443 HTTP/1.1\r\nHost: example.com:443\r\n\r\n");
  assert.doesNotMatch(connect, /^HTTP\/1\.1 200/, "CONNECT must never tunnel");
  const absolute = await raw("GET http://example.com/ HTTP/1.1\r\nHost: 127.0.0.1:" + port + "\r\nConnection: close\r\n\r\n");
  assert.match(absolute, /^HTTP\/1\.1 403/);
  const protocolRelative = await raw("GET //example.com/x HTTP/1.1\r\nHost: 127.0.0.1:" + port + "\r\nConnection: close\r\n\r\n");
  assert.match(protocolRelative, /^HTTP\/1\.1 403/);
});

test("backend path prefixes are denied in every case and encoding variant", async () => {
  for (const path of ["/REST/v1/x", "/Rest/V1", "/rest", "/rest/v1", "/%72est/v1/x", "/auth/v1/token", "/AUTH/v1", "/rpc/rpc_refresh_cost",
    "/functions/v1/a", "/storage/v1/object/x", "/realtime/v1/websocket", "/pg/query", "/api/anything", "/__preview/unsafe"]) {
    assert.equal((await send({ path })).status, 403, path);
  }
});

test("path traversal in plain, encoded, double-encoded, backslash and null-byte forms never serves outside files", async () => {
  for (const path of ["/../outside-secret.txt", "/shared/../../outside-secret.txt", "/%2e%2e/outside-secret.txt", "/%2E%2E%2Foutside-secret.txt",
    "/shared/..%2f..%2foutside-secret.txt", "/%252e%252e/outside-secret.txt", "/..%5coutside-secret.txt", "/shared/%00ok.html", "/shared/ok.html%00.png",
    "/shared//../../outside-secret.txt"]) {
    const r = await send({ path });
    assert.notEqual(r.status, 200, path);
    assert.doesNotMatch(r.body, /TOP-SECRET-OUTSIDE|SECRET=1/, path);
  }
});

test("symlinks escaping the preview root are refused", async () => {
  const file = await send({ path: "/shared/link.html" });
  assert.equal(file.status, 403);
  assert.doesNotMatch(file.body, /TOP-SECRET-OUTSIDE/);
  const viaDir = await send({ path: "/shared/dirlink/outside-secret.txt" });
  assert.notEqual(viaDir.status, 200);
  assert.doesNotMatch(viaDir.body, /TOP-SECRET-OUTSIDE/);
});

test("unlisted file types, dotfiles and directories are not served", async () => {
  for (const path of ["/shared/notes.txt", "/shared/app.js.map", "/.env", "/shared/", "/shared"]) {
    const r = await send({ path });
    assert.notEqual(r.status, 200, path);
    assert.doesNotMatch(r.body, /SECRET=1|plain text not in allowlist/, path);
  }
});

test("service-worker scripts are refused and every response is non-cacheable with CSP connect-src none", async () => {
  for (const path of ["/sw.js", "/service-worker.js"]) assert.equal((await send({ path })).status, 403, path);
  for (const path of ["/shared/ok.html", "/__preview/", "/__preview/status", "/rest/v1/x", "/missing.html"]) {
    const r = await send({ path });
    assert.equal(r.headers["cache-control"], "no-store", path);
    assert.match(r.headers["content-security-policy"], /connect-src 'none'.*worker-src 'none'/, path);
    assert.equal(r.headers["x-content-type-options"], "nosniff", path);
  }
});

test("status endpoint never claims connectivity, authentication or acceptance", async () => {
  const j = JSON.parse((await send({ path: "/__preview/status" })).body);
  assert.deepEqual(j, { kind: "LOCAL_ONLY_SYNTHETIC_PREVIEW", backend: "DISCONNECTED", realAuthentication: false,
    readWrites: "NOT_AVAILABLE", signedInAcceptance: "NOT_TESTED" });
});
