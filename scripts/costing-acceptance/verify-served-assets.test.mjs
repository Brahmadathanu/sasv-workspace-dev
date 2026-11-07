// Self-test of the build-identification script against a LOCAL static server (no network, no Netlify, no login).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFileSync, execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "scripts/costing-acceptance/verify-served-assets.mjs");
const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root }).toString().trim();
let dir, server, base;
test.before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "served-"));
  const tar = execFileSync("git", ["archive", sha, "public"], { cwd: root, maxBuffer: 256 * 1024 * 1024 });
  execFileSync("tar", ["-x", "-C", dir], { input: tar });
  server = http.createServer((req, res) => {
    const f = path.join(dir, "public", decodeURIComponent(req.url.split("?")[0]));
    if (!f.startsWith(path.join(dir, "public")) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end("nf"); }
    res.end(fs.readFileSync(f));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r)); base = "http://127.0.0.1:" + server.address().port;
});
test.after(async () => { await new Promise((r) => server?.close(r)); fs.rmSync(dir, { recursive: true, force: true }); });
// ASYNC on purpose: the local server lives in this process, so a synchronous child would deadlock it.
const run = () => new Promise((resolve) => execFile("node", [script, base, sha], { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => resolve({ status: err ? (err.code ?? 1) : 0, stdout, stderr })));

test("a faithful build is reported byte-identical for every Costing asset, and the cache line is captured", async () => {
  const r = await run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /(\d+)\/\1 Costing assets byte-identical/); assert.match(r.stdout, /sw\.js: .*hub-cache-v/);
  assert.ok(Number(/(\d+)\/\d+ Costing/.exec(r.stdout)[1]) >= 60, "covers the Costing page and module set");
});
test("one changed byte, one missing file, and a CRLF-only difference: tampering is detected, line endings are ignored", async () => {
  const f = path.join(dir, "public/shared/js/costing-feature-flags.js"); const orig = fs.readFileSync(f);
  fs.writeFileSync(f, Buffer.concat([orig, Buffer.from("\n// tampered\n")]));  // (git archive may already have applied CRLF conversion in a CRLF clone; normalise before comparing)
  let r = await run(); assert.notEqual(r.status, 0); assert.match(r.stdout, /MISMATCH 200 public\/shared\/js\/costing-feature-flags\.js/);
  fs.writeFileSync(f, Buffer.from(orig.toString("utf8").replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"))); r = await run(); assert.equal(r.status, 0, "CRLF-only difference is not a mismatch");
  fs.rmSync(f); r = await run(); assert.notEqual(r.status, 0); assert.match(r.stdout, /MISMATCH 404 public\/shared\/js\/costing-feature-flags\.js/);
  fs.writeFileSync(f, orig);
});
