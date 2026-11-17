// Deploy-preview provenance gate for a PR candidate (WP11 / hub-cache-v394). Read-only: GET requests only.
//
//   node scripts/wp11-preview-provenance/verify-preview-candidate.mjs <preview-origin> <expected-40-hex-sha> [--attempts N] [--delay-ms MS]
//
// PASS only when ALL hold (anything else FAILS, never skips):
//   1. the checked-out commit is exactly <expected sha>;
//   2. every reviewed Master-Data gate file served by the preview is byte-identical (LF-normalised) to the checkout. The only tolerated
//      difference is the single, exactly-shaped Netlify deploy-preview div (data-netlify-deploy-id) that Netlify appends to HTML on
//      Deploy Preview URLs; JS/CSS and sw.js are never normalised;
//   3. the served /sw.js is byte-identical to the checkout's public/sw.js and its cache name equals the checkout's (e.g. hub-cache-v394).
// The production v393 monitoring gate (deploy-gate.mjs verify <production origin>) is separate and unchanged.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { verifyDeployed, repoRoot as GATE_ROOT } from "../wp08-g2-0-shared-master-data/deploy-gate.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "../..");
const lf = (s) => String(s).replace(/\r\n/g, "\n");
const sha = (s) => crypto.createHash("sha256").update(lf(s), "utf8").digest("hex");

// Exact structure Netlify inserts on Deploy Preview URLs (observed on PR #467). Anything else is NOT normalised.
const PREVIEW_DIV = /\n?<div data-netlify-deploy-id="[0-9a-f]{24}" data-netlify-site-id="[0-9a-f-]{36}" data-vcs="github" style="position:fixed">\n  <!-- This div is automatically inserted by Netlify for all Deploy Preview URLs\. -->\n  <script async src="\/\.netlify\/scripts\/cdp"><\/script>\n<\/div>\n?/g;
export function stripPreviewDiv(html) {
  const text = lf(html);
  const matches = text.match(PREVIEW_DIV) || [];
  if (matches.length !== 1) return text; // zero or several: leave untouched so the comparison fails if the file differs
  return text.replace(PREVIEW_DIV, "\n").replace(/\n\n$/, "\n");
}
export const cacheNameOf = (sw) => (/const CACHE_NAME = "([^"]+)"/.exec(sw) || [])[1] || null;

/** fetchImpl(url) -> {status, text()}. Returns {ok, problems}. */
export async function verifyPreview(origin, expectedSha, { fetchImpl = fetch, root = repoRoot, headSha } = {}) {
  const problems = [];
  if (!/^[0-9a-f]{40}$/.test(String(expectedSha))) return { ok: false, problems: ["expected sha must be the full 40-hex candidate commit"] };
  const head = headSha ?? execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  if (head !== expectedSha) problems.push(`checkout HEAD ${head} is not the expected candidate ${expectedSha}`);
  // Wrap the fetch so ONLY the exact Deploy Preview div is removed from HTML before the shared byte comparison runs.
  const wrapped = async (url) => {
    const res = await fetchImpl(url);
    if (res.status !== 200 || !/\.html$/i.test(new URL(url).pathname)) return res;
    const body = stripPreviewDiv(await res.text());
    return { status: 200, text: async () => body };
  };
  const gate = await verifyDeployed(origin, wrapped, root);
  problems.push(...gate.problems);
  try {
    const res = await fetchImpl(origin + "/sw.js");
    if (res.status !== 200) problems.push(`/sw.js: HTTP ${res.status}`);
    else {
      const served = await res.text();
      const local = fs.readFileSync(path.join(root, "public/sw.js"), "utf8");
      if (sha(served) !== sha(local)) problems.push("/sw.js: served bytes differ from the candidate's public/sw.js");
      if (cacheNameOf(served) !== cacheNameOf(local)) problems.push(`/sw.js: served cache ${cacheNameOf(served)} != candidate ${cacheNameOf(local)}`);
    }
  } catch (e) { problems.push(`/sw.js: ${e.message}`); }
  return { ok: problems.length === 0, problems, cache: cacheNameOf(fs.readFileSync(path.join(root, "public/sw.js"), "utf8")) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? Number(args[i + 1]) : d; };
  const [origin, sha40] = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
  if (!origin || !sha40) { console.error("usage: verify-preview-candidate.mjs <preview-origin> <40-hex-sha> [--attempts N] [--delay-ms MS]"); process.exit(2); }
  const attempts = opt("--attempts", 30), delay = opt("--delay-ms", 20000);
  let r;
  for (let i = 1; i <= attempts; i++) {
    r = await verifyPreview(origin.replace(/\/$/, ""), sha40);
    if (r.ok) break;
    // a wrong checkout is permanent; do not wait for it
    if (r.problems.some((p) => p.startsWith("checkout HEAD") || p.startsWith("expected sha"))) break;
    console.error(`attempt ${i}/${attempts}: ${r.problems.length} problem(s); retrying in ${delay} ms (preview may still be building)`);
    if (i < attempts) await new Promise((res) => setTimeout(res, delay));
  }
  if (r.ok) console.log(`PREVIEW PASS ${origin} candidate=${sha40} cache=${r.cache}`);
  else { console.error(`PREVIEW FAIL\n${r.problems.map((p) => " - " + p).join("\n")}`); process.exit(1); }
}
void GATE_ROOT;
