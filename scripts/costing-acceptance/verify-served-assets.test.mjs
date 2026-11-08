// Build-identification script: faithful build, every failure mode, spoof guards. Local servers only: no network, no Netlify, no login.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFileSync, execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { verifyServedAssets, normaliseForTest, stripNetlifyBanner, NETLIFY_BANNER, NETLIFY_BANNER_ID, EXIT } from "./verify-served-assets.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "scripts/costing-acceptance/verify-served-assets.mjs");
const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root }).toString().trim();
let dir, server, base, other, otherBase, mode = {}, hits = new Map();
const CHANGED = "public/shared/js/costing-feature-flags.js";
test.before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "served-"));
  execFileSync("tar", ["-x", "-C", dir], { input: execFileSync("git", ["archive", sha, "public"], { cwd: root, maxBuffer: 256 * 1024 * 1024 }) });
  other = http.createServer((req, res) => res.end("elsewhere")); await new Promise((r) => other.listen(0, "127.0.0.1", r)); otherBase = "http://127.0.0.1:" + other.address().port;
  server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname); const f = path.join(dir, "public", rel);
    hits.set(rel, (hits.get(rel) ?? 0) + 1);
    if (mode.deny) { res.statusCode = 403; return res.end("forbidden"); }
    if (mode.flaky && hits.get(rel) === 1) { res.statusCode = 503; return res.end("busy"); }
    if (mode.redirect && rel.endsWith("sw.js")) { res.writeHead(302, { location: otherBase + "/login" }); return res.end(); }
    if (!f.startsWith(path.join(dir, "public")) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      if (mode.htmlFallback) { res.writeHead(200, { "content-type": "text/html" }); return res.end("<html>app shell</html>"); }
      res.statusCode = 404; return res.end("nf");
    }
    if (mode.override?.[rel] != null) { res.setHeader("content-type", rel.endsWith(".html") ? "text/html" : "text/javascript"); return res.end(mode.override[rel]); }
    res.setHeader("content-type", rel.endsWith(".html") ? "text/html" : rel.endsWith(".css") ? "text/css" : "text/javascript"); res.end(fs.readFileSync(f));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r)); base = "http://127.0.0.1:" + server.address().port;
});
test.after(async () => { await new Promise((r) => server?.close(r)); await new Promise((r) => other?.close(r)); fs.rmSync(dir, { recursive: true, force: true }); });
test.beforeEach(() => { mode = {}; hits = new Map(); });
// ASYNC on purpose: the servers live in this process, so a synchronous child would deadlock them.
const run = (target = base, extra = [], useSha = sha) => new Promise((resolve) => { const j = path.join(dir, "out.json");
  execFile("node", [script, target, useSha, "--json", j, "--allow-local-self-test", ...extra], { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }, (err, stdout) => resolve({ status: err ? (err.code ?? 1) : 0, stdout, report: fs.existsSync(j) ? JSON.parse(fs.readFileSync(j, "utf8")) : null })); });

test("a faithful build is VERIFIED: every asset matches, cache name and bundle digest match, evidence is labelled LOCAL_SELF_TEST and not hosted proof", async () => {
  const r = await run(); assert.equal(r.status, EXIT.OK, r.stdout);
  assert.equal(r.report.verdict, "VERIFIED"); assert.equal(r.report.evidence_class, "LOCAL_SELF_TEST"); assert.equal(r.report.hosted_proof, false);
  assert.ok(r.report.files >= 60 && r.report.mismatches === 0); assert.match(r.report.served_cache_name, /^hub-cache-v\d+$/); assert.equal(r.report.served_cache_name, r.report.expected_cache_name);
  assert.equal(r.report.served_bundle_digest, r.report.expected_bundle_digest); assert.match(r.stdout, /NOT hosted proof/);
  assert.ok(r.report.rows.some((x) => x.path === "public/shared/costing-control-center.html") && r.report.rows.some((x) => x.path.endsWith("css")), "the asset set comes from the pages' own scripts and stylesheets");
});
test("usage failures are refused before any request: loopback without the self-test flag, short/branch SHA, unknown commit, non-https hosted target, bad URL", () => {
  const v = (o) => verifyServedAssets(o);
  for (const [o, why] of [[{ base: "http://127.0.0.1:9", sha }, /loopback target refused/], [{ base: "http://localhost", sha }, /loopback target refused/], [{ base: "https://x.example", sha: "main" }, /40-hex/], [{ base: "https://x.example", sha: sha.slice(0, 12) }, /40-hex/],
    [{ base: "https://x.example", sha: "0".repeat(40) }, /not present/], [{ base: "http://hosted.example", sha }, /https/], [{ base: "not a url", sha }, /valid URL/], [{ base: "ftp://x.example", sha }, /http/]]) {
    const r = v(o); assert.equal(r.exit_code, EXIT.USAGE, JSON.stringify(o)); assert.match(r.reasons.join(), why); assert.equal(r.rows, undefined, "no request was made");
  }
});
test("an unreachable target is NOT_VERIFIED (exit 3), never a pass and never a mismatch claim", async () => {
  const closed = http.createServer(); await new Promise((r) => closed.listen(0, "127.0.0.1", r)); const port = closed.address().port; await new Promise((r) => closed.close(r));
  const r = await run("http://127.0.0.1:" + port); assert.equal(r.status, EXIT.NOT_VERIFIED, r.stdout); assert.equal(r.report.verdict, "NOT_VERIFIED"); assert.match(r.report.reasons.join(), /unreachable/); assert.ok(r.report.rows.every((x) => x.failure === "UNREACHABLE"));
});
test("an access wall (403 everywhere) and an off-origin login redirect are NOT_VERIFIED: identity not established", async () => {
  mode = { deny: true }; let r = await run(); assert.equal(r.status, EXIT.NOT_VERIFIED); assert.ok(r.report.rows.every((x) => x.failure === "ACCESS_DENIED"));
  mode = { redirect: true }; r = await run(); assert.notEqual(r.status, EXIT.OK); assert.ok(r.report.rows.some((x) => x.failure === "REDIRECTED_OFF_ORIGIN" && x.path === "public/sw.js"));
});
test("a SPA-style HTML fallback for a missing script, a missing file and a changed byte are each a MISMATCH (exit 1)", async () => {
  const f = path.join(dir, CHANGED); const orig = fs.readFileSync(f);
  try {
    fs.rmSync(f); mode = { htmlFallback: true }; let r = await run(); assert.equal(r.status, EXIT.MISMATCH); assert.equal(r.report.rows.find((x) => x.path === CHANGED).failure, "HTML_FALLBACK_FOR_ASSET");
    mode = {}; r = await run(); assert.equal(r.status, EXIT.MISMATCH); assert.equal(r.report.rows.find((x) => x.path === CHANGED).failure, "MISSING");
    fs.writeFileSync(f, Buffer.concat([orig, Buffer.from("\n// tampered\n")])); r = await run(); assert.equal(r.status, EXIT.MISMATCH); assert.equal(r.report.rows.find((x) => x.path === CHANGED).failure, "CONTENT_DIFFERS");
    assert.notEqual(r.report.served_bundle_digest, r.report.expected_bundle_digest, "the bundle digest changes with any asset"); assert.match(r.stdout, /CONTENT_DIFFERS\s+200\s+public\/shared\/js\/costing-feature-flags\.js/);
  } finally { fs.writeFileSync(f, orig); }
});
test("a stale service-worker cache name is a MISMATCH even if every other asset matches (a cached older build would otherwise be served)", async () => {
  const f = path.join(dir, "public/sw.js"); const orig = fs.readFileSync(f, "utf8");
  try { fs.writeFileSync(f, orig.replace(/hub-cache-v\d+/, "hub-cache-v1")); const r = await run(); assert.equal(r.status, EXIT.MISMATCH); assert.match(r.report.reasons.join(), /service-worker cache hub-cache-v1/); assert.equal(r.report.served_cache_name, "hub-cache-v1"); }
  finally { fs.writeFileSync(f, orig); }
});
test("--expect-cache pins the cache name: a commit whose cache name differs from the expected one is refused", async () => {
  const r = await run(base, ["--expect-cache", "hub-cache-v999"]); assert.equal(r.status, EXIT.MISMATCH); assert.match(r.report.reasons.join(), /not the expected hub-cache-v999/);
});
test("normal LF/CRLF divergence is NOT a mismatch; transient 503 responses are retried; binary bytes are compared exactly", async () => {
  const f = path.join(dir, CHANGED); const orig = fs.readFileSync(f);
  try { fs.writeFileSync(f, Buffer.from(orig.toString("utf8").replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"))); mode = { flaky: true }; const r = await run(); assert.equal(r.status, EXIT.OK, r.stdout); assert.ok([...hits.values()].every((n) => n >= 2), "each asset needed a retry"); }
  finally { fs.writeFileSync(f, orig); }
  const a = Buffer.from([1, 2, 13, 10, 3]), b = Buffer.from([1, 2, 10, 3]);
  assert.notDeepEqual(normaliseForTest("public/x.png", a), normaliseForTest("public/x.png", b), "binary: CRLF bytes are content");
  assert.deepEqual(normaliseForTest("public/x.js", Buffer.from("a\r\nb")), normaliseForTest("public/x.js", Buffer.from("a\nb")), "text: line endings are not content");
});

// ── NETLIFY_INJECTED_BANNER_V1: positive and negative regression tests ─────────────────────────────────────────────────────────────────────────────
const PAGE_A = "public/shared/cost-build-manager.html", PAGE_B = "public/shared/costing-control-center.html";
const CHARSET = '<meta charset="UTF-8" />\n';
const gitText = (rel) => fs.readFileSync(path.join(dir, rel), "utf8").replace(/\r\n/g, "\n");
const withBanner = (rel, banner = NETLIFY_BANNER) => { const t = gitText(rel); const i = t.indexOf(CHARSET) + CHARSET.length; return t.slice(0, i) + banner + t.slice(i); };
const served = (o) => ({ override: Object.fromEntries(Object.entries(o).map(([rel, body]) => ["/" + rel.replace(/^public\//, ""), body])) });
const failureOf = (r, rel) => r.report.rows.find((x) => x.path === rel).failure;

test("banner: the exact observed Netlify comment after the charset meta on both pages is VERIFIED, with raw, normalised and git hashes recorded and the transformation named", async () => {
  mode = served({ [PAGE_A]: withBanner(PAGE_A), [PAGE_B]: withBanner(PAGE_B).replace(/\n/g, "\r\n") });   // also tolerates CRLF on the wire
  const r = await run(); assert.equal(r.status, EXIT.OK, r.stdout); assert.equal(r.report.verdict, "VERIFIED"); assert.equal(r.report.mismatches, 0);
  assert.deepEqual(r.report.normalisations_applied.map((x) => x.path).sort(), [PAGE_A, PAGE_B]);
  for (const rel of [PAGE_A, PAGE_B]) {
    const row = r.report.rows.find((x) => x.path === rel);
    assert.equal(row.normalisation, NETLIFY_BANNER_ID); assert.notEqual(row.served_raw_sha256, row.served_normalised_sha256);
    assert.equal(row.served_normalised_sha256, row.expected_sha256); assert.equal(row.served_sha256, row.expected_sha256);
    const gitBytes = execFileSync("git", ["show", `${sha}:${rel}`], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
    assert.equal(row.git_blob_sha256, crypto.createHash("sha256").update(gitBytes).digest("hex"));
  }
  assert.match(r.report.reasons.join(), /NETLIFY_INJECTED_BANNER_V1/); assert.equal(r.report.served_bundle_digest, r.report.expected_bundle_digest);
});
test("banner: untouched pages record no normalisation", async () => {
  const r = await run(); assert.equal(r.status, EXIT.OK); assert.deepEqual(r.report.normalisations_applied, []); assert.ok(r.report.rows.every((x) => x.normalisation === undefined));
});
test("banner: the banner cannot hide a real change (changed script, added script, removed content, changed markup)", async () => {
  for (const mutate of [(t) => t + "\n<script>fetch('/x')</script>\n", (t) => t.replace("<title>", "<title>X"), (t) => t.slice(0, -200), (t) => t.replace(/<button/, "<button data-x")]) {
    mode = served({ [PAGE_A]: mutate(withBanner(PAGE_A)) }); const r = await run(); assert.equal(r.status, EXIT.MISMATCH, mutate.toString()); assert.equal(failureOf(r, PAGE_A), "CONTENT_DIFFERS");
    assert.equal(r.report.rows.find((x) => x.path === PAGE_A).normalisation, undefined);
  }
});
test("banner: a duplicated, relocated, altered, extended or indented banner is a MISMATCH", async () => {
  const t = gitText(PAGE_A), at = t.indexOf(CHARSET) + CHARSET.length, B = NETLIFY_BANNER;
  const cases = {
    duplicated: t.slice(0, at) + B + B + t.slice(at),
    "relocated after <title>": (() => { const i = t.indexOf("</title>\n") + 9; return t.slice(0, i) + B + t.slice(i); })(),
    "relocated to end of file": t + B,
    "separated by a blank line": t.slice(0, at) + "\n" + B + t.slice(at),
    "altered campaign id": withBanner(PAGE_A, B.replace("d8ee0b4c", "deadbeef")),
    "altered wording": withBanner(PAGE_A, B.replace("hosted on Netlify", "hosted on Evil")),
    "extra comment line": withBanner(PAGE_A, B.replace(" -->", "\n     extra -->")),
    "extra trailing content": withBanner(PAGE_A, B + "<!-- another -->\n"),
    "generic other comment": withBanner(PAGE_A, "<!-- anything at all -->\n"),
    "indented banner": withBanner(PAGE_A, B.split("\n").map((l) => (l ? "  " + l : l)).join("\n")),
    "banner plus a second charset meta": withBanner(PAGE_A).replace("<title>", CHARSET + "<title>"),
  };
  for (const [name, body] of Object.entries(cases)) { mode = served({ [PAGE_A]: body }); const r = await run(); assert.equal(r.status, EXIT.MISMATCH, name); assert.equal(failureOf(r, PAGE_A), "CONTENT_DIFFERS", name); assert.deepEqual(r.report.normalisations_applied, [], name); }
});
test("banner: never applied to non-HTML assets (script, stylesheet, service worker), even with the exact banner text", async () => {
  for (const rel of [CHANGED, "public/sw.js"]) {
    const orig = fs.readFileSync(path.join(dir, rel), "utf8"); mode = served({ [rel]: NETLIFY_BANNER + orig }); const r = await run();
    assert.equal(r.status, EXIT.MISMATCH, rel); assert.equal(failureOf(r, rel), "CONTENT_DIFFERS");
  }
});
test("banner: stripNetlifyBanner is pure and strict (unit level)", () => {
  const html = "<head>\n    <meta charset=\"UTF-8\" />\n" + NETLIFY_BANNER + "<title>t</title>\n";
  assert.equal(stripNetlifyBanner("a.html", Buffer.from(html)).toString(), "<head>\n    <meta charset=\"UTF-8\" />\n<title>t</title>\n");
  assert.equal(stripNetlifyBanner("a.js", Buffer.from(html)), null);
  assert.equal(stripNetlifyBanner("a.html", Buffer.from(html.replace(NETLIFY_BANNER, ""))), null, "no banner: nothing to strip");
  assert.equal(stripNetlifyBanner("a.html", Buffer.from(html.replace(CHARSET.trim(), '<meta charset="utf-8" />'))), null, "no exact charset anchor");
  assert.equal(stripNetlifyBanner("a.html", Buffer.from(html + NETLIFY_BANNER)), null, "second occurrence");
});
