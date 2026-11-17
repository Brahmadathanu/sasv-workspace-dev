import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { verifyPreview, stripPreviewDiv, repoRoot } from "./verify-preview-candidate.mjs";
import { GATE_FILES } from "../wp08-g2-0-shared-master-data/deploy-gate.mjs";

const SHA = "a".repeat(40);
const DIV = '<div data-netlify-deploy-id="6afc4e192277d6a5ffd43ff9" data-netlify-site-id="d8ee0b4c-1a12-4efd-b47c-7ced60eadcac" data-vcs="github" style="position:fixed">\n  <!-- This div is automatically inserted by Netlify for all Deploy Preview URLs. -->\n  <script async src="/.netlify/scripts/cdp"></script>\n</div>\n';
const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), "utf8");

// Serves the checkout exactly as a faithful preview would (plus the Netlify div on HTML), with optional per-URL mutation.
const serve = (mutate = {}) => async (url) => {
  const p = new URL(url).pathname;
  const rel = p === "/sw.js" ? "public/sw.js" : "public" + p;
  let body = mutate[p] !== undefined ? (typeof mutate[p] === "function" ? mutate[p](read(rel)) : mutate[p]) : read(rel);
  if (/\.html$/.test(p)) body = body.replace(/(<\/html>\s*)$/, "$1") + (body.endsWith("\n") ? "" : "\n") + DIV;
  return { status: 200, text: async () => body };
};

test("faithful preview of the exact candidate passes (Netlify deploy-preview div tolerated)", async () => {
  const r = await verifyPreview("https://x", SHA, { fetchImpl: serve(), headSha: SHA });
  assert.deepEqual(r.problems, []);
  assert.equal(r.ok, true);
  assert.match(r.cache, /^hub-cache-v\d+$/);
});
test("wrong checkout SHA fails", async () => {
  const r = await verifyPreview("https://x", SHA, { fetchImpl: serve(), headSha: "b".repeat(40) });
  assert.equal(r.ok, false); assert.match(r.problems.join("\n"), /not the expected candidate/);
});
test("non-40-hex sha fails", async () => { assert.equal((await verifyPreview("https://x", "abc", { fetchImpl: serve() })).ok, false); });
test("MUTATION: a changed PM BOM page fails (production v393 page served as candidate)", async () => {
  const r = await verifyPreview("https://x", SHA, { fetchImpl: serve({ "/shared/manage-pm-bom.html": (t) => t.replace("WP11: .hdr-top", "XX") }), headSha: SHA });
  assert.equal(r.ok, false); assert.match(r.problems.join("\n"), /manage-pm-bom\.html: deployed bytes differ/);
});
test("MUTATION: any changed gate JS fails (never normalised)", async () => {
  const js = GATE_FILES.find((f) => f.url.endsWith("manage-pm-bom.js")).url;
  const r = await verifyPreview("https://x", SHA, { fetchImpl: serve({ [js]: (t) => t + "\n//x" }), headSha: SHA });
  assert.equal(r.ok, false);
});
test("MUTATION: stale sw.js (previous cache generation) fails", async () => {
  const r = await verifyPreview("https://x", SHA, { fetchImpl: serve({ "/sw.js": (t) => t.replace(/hub-cache-v\d+/, "hub-cache-v393") }), headSha: SHA });
  assert.equal(r.ok, false); assert.match(r.problems.join("\n"), /sw\.js/);
});
test("MUTATION: a different injected script is NOT normalised", async () => {
  const f = async (url) => { const res = await serve()(url); if (!/manage-pm-bom\.html$/.test(url)) return res; const t = (await res.text()).replace('/.netlify/scripts/cdp', "/evil.js"); return { status: 200, text: async () => t }; };
  const r = await verifyPreview("https://x", SHA, { fetchImpl: f, headSha: SHA });
  assert.equal(r.ok, false);
});
test("MUTATION: two preview divs are NOT normalised", async () => {
  const f = async (url) => { const res = await serve()(url); if (!/manage-pm-bom\.html$/.test(url)) return res; const t = (await res.text()) + DIV; return { status: 200, text: async () => t }; };
  assert.equal((await verifyPreview("https://x", SHA, { fetchImpl: f, headSha: SHA })).ok, false);
});
test("HTTP error on a gate file fails", async () => {
  const f = async (url) => (url.endsWith("manage-pm-bom.js") ? { status: 404, text: async () => "" } : serve()(url));
  assert.equal((await verifyPreview("https://x", SHA, { fetchImpl: f, headSha: SHA })).ok, false);
});
test("stripPreviewDiv removes exactly one exact div and nothing else", () => {
  assert.equal(stripPreviewDiv("<p>a</p>\n" + DIV), "<p>a</p>\n");
  assert.equal(stripPreviewDiv("<p>a</p>\n"), "<p>a</p>\n");
});
