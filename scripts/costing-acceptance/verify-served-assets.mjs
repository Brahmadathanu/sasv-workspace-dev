// Build identification for acceptance: compares the bytes a deployment SERVES with the bytes of a git commit, for every Costing asset.
// Unauthenticated static GETs only (no login, no cookies, no API calls, no writes). Usage:
//   node scripts/costing-acceptance/verify-served-assets.mjs <base-url> <git-sha> [--json out.json]
// Exit 0 only if every asset matches. The result (base URL, SHA, per-file digests, sw.js cache line) is the provenance block for the owner acceptance record.
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";

const [, , baseArg, sha, flag, outPath] = process.argv;
if (!baseArg || !sha) { console.error("usage: verify-served-assets.mjs <base-url> <git-sha> [--json out.json]"); process.exit(2); }
const base = baseArg.replace(/\/+$/, "");
const git = (...a) => execFileSync("git", a, { maxBuffer: 64 * 1024 * 1024 });
const tracked = git("ls-tree", "-r", "--name-only", sha, "public/").toString().split("\n").filter(Boolean);
const wanted = tracked.filter((p) => /^public\/shared\/(cost-build-manager|cost-sheet-review|costing-control-center|material-cost-manager|pricing-policy-manager|production-route-manager)\.html$/.test(p)
  || /^public\/shared\/js\/(costing|cost-sheet|cost-build|material-cost|pricing-policy|production-route|prm|cw|csa|mrp)[a-z0-9-]*\.js$/.test(p) || p === "public/sw.js" || p === "public/shared/js/costing-feature-flags.js");
if (wanted.length < 20) { console.error("unexpectedly few Costing assets found for " + sha + ": " + wanted.length); process.exit(2); }
const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const norm = (buf) => Buffer.from(buf.toString("utf8").replace(/\r\n/g, "\n"));   // line endings are not part of identity
const rows = []; let bad = 0;
for (const rel of wanted.sort()) {
  const url = base + "/" + rel.replace(/^public\//, "");
  let served = null, status = "";
  try { served = execFileSync("curl", ["-sS", "-L", "--max-time", "30", "-w", "\n%{http_code}", url], { maxBuffer: 64 * 1024 * 1024 }); } catch (e) { status = "fetch-failed"; }
  let body = null;
  if (served) { const i = served.lastIndexOf(10); status = served.subarray(i + 1).toString().trim(); body = served.subarray(0, i); }
  const want = sha256(norm(git("show", `${sha}:${rel}`)));
  const got = body && status === "200" ? sha256(norm(body)) : null;
  const ok = got === want; if (!ok) bad++;
  rows.push({ path: rel, status, expected_sha256: want, served_sha256: got, match: ok });
}
const sw = git("show", `${sha}:public/sw.js`).toString().split("\n").slice(0, 3).join(" | ");
const result = { base, git_sha: sha, checked_at: new Date().toISOString(), files: rows.length, mismatches: bad, service_worker_head: sw, rows };
if (flag === "--json" && outPath) fs.writeFileSync(outPath, JSON.stringify(result, null, 1));
for (const r of rows.filter((x) => !x.match)) console.log("MISMATCH", r.status, r.path);
console.log(`${base} vs ${sha}: ${rows.length - bad}/${rows.length} Costing assets byte-identical (line endings ignored). sw.js: ${sw}`);
process.exit(bad ? 1 : 0);
