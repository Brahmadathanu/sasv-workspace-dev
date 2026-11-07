// Build identification for acceptance: compares the bytes a deployment SERVES with the bytes of an EXPLICIT git commit, for every Costing asset.
// Unauthenticated static GETs only (no login, no cookies, no API calls, no writes).
//
//   node scripts/costing-acceptance/verify-served-assets.mjs <base-url> <40-hex-git-sha> [--json out.json] [--expect-cache hub-cache-vNNN] [--allow-local-self-test]
//
// Exit codes: 0 verified | 1 MISMATCH (content differs, file missing, wrong content type, access wall) | 2 usage / unknown commit
//             3 NOT VERIFIED (target unreachable or inaccessible: no evidence either way). Never 0 unless every asset matches.
// Evidence class: a loopback/localhost target is REFUSED unless --allow-local-self-test is given, and then the report says LOCAL_SELF_TEST and
// hosted_proof=false. A local server can therefore never be presented as proof of a hosted build.
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
export const EXIT = Object.freeze({ OK: 0, MISMATCH: 1, USAGE: 2, NOT_VERIFIED: 3 });
const PAGES = ["cost-build-manager", "cost-sheet-review", "costing-control-center", "material-cost-manager", "pricing-policy-manager", "production-route-manager"];
const TEXT_EXT = /\.(html|js|mjs|css|json|svg|txt|webmanifest)$/i;
const isLoopback = (host) => /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|0\.0\.0\.0)$/i.test(host);
const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const normalise = (rel, buf) => (TEXT_EXT.test(rel) ? Buffer.from(buf.toString("utf8").replace(/\r\n/g, "\n")) : buf);   // LF/CRLF is not identity; binary bytes are

export const normaliseForTest = (rel, buf) => normalise(rel, buf);
function git(args, cwd) { return execFileSync("git", args, { cwd, maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }); }

/** The asset set is derived from the six Costing pages themselves (their local scripts and stylesheets) plus the Costing module code and sw.js. */
export function costingAssetList(sha, cwd = repoRoot) {
  const tracked = git(["ls-tree", "-r", "--name-only", sha, "public/"], cwd).toString().split("\n").filter(Boolean);
  const set = new Set();
  for (const p of tracked) {
    if (/^public\/shared\/(cost-build-manager|cost-sheet-review|costing-control-center|material-cost-manager|pricing-policy-manager|production-route-manager)\.html$/.test(p)) set.add(p);
    if (/^public\/shared\/js\/(costing|cost-sheet|cost-build|material-cost|pricing-policy|production-route|prm|cw|csa|mrp)[a-z0-9-]*\.js$/.test(p)) set.add(p);
    if (p === "public/sw.js") set.add(p);
  }
  const tset = new Set(tracked);
  for (const page of PAGES) {
    const html = git(["show", `${sha}:public/shared/${page}.html`], cwd).toString();
    for (const m of html.matchAll(/<(?:script|link)[^>]+(?:src|href)=["']([^"']+)["']/gi)) {
      const u = m[1].split(/[?#]/)[0];
      if (/^(https?:)?\/\//i.test(u) || u.startsWith("data:") || u.startsWith("#") || !/\.(js|css)$/i.test(u)) continue;
      const rel = path.posix.normalize("public/shared/" + u);
      if (tset.has(rel)) set.add(rel);
    }
  }
  return [...set].sort();
}

const CURL_NETWORK = new Set([5, 6, 7, 28, 35, 51, 52, 55, 56, 60, 97]);   // resolve/connect/timeout/TLS/proxy failures: no answer from the target
function fetchOnce(url, timeoutS) {
  try {
    const out = execFileSync("curl", ["-sS", "-L", "--max-redirs", "3", "--max-time", String(timeoutS), "-D", "-", "-o", "-", "-w", "\n__SASV_STATUS__%{http_code}__%{url_effective}__%{num_redirects}", url],
      { maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
    const marker = out.lastIndexOf("\n__SASV_STATUS__"); const tail = out.subarray(marker + 1).toString();
    const [, code, effective, redirects] = /^__SASV_STATUS__(\d+)__(.*)__(\d+)$/.exec(tail) || [];
    const raw = out.subarray(0, marker);
    let body = raw, headers = "";
    for (;;) { const i = body.indexOf("\r\n\r\n"); if (i < 0 || !/^HTTP\/[\d.]+ \d+/.test(body.subarray(0, 12).toString())) break; headers = body.subarray(0, i).toString(); body = body.subarray(i + 4); }
    return { status: Number(code), effective, redirects: Number(redirects), headers, body };
  } catch (e) { return { networkError: CURL_NETWORK.has(e.status) ? `curl exit ${e.status}` : `curl exit ${e.status ?? "?"}: ${String(e.stderr || e.message).trim().slice(0, 120)}` }; }
}
function fetchRetry(url, { timeoutS, retries }) {
  let last;
  for (let i = 0; i <= retries; i++) { last = fetchOnce(url, timeoutS); if (!last.networkError && last.status < 500) return last; }
  return last;
}
const cacheNameOf = (text) => /CACHE_NAME\s*=\s*["']([^"']+)["']/.exec(text)?.[1] ?? null;

/** Pure-ish verification used by the CLI and by the acceptance runner. Returns the report; never throws for target problems. */
export function verifyServedAssets({ base, sha, expectCache = null, allowLocalSelfTest = false, cwd = repoRoot, timeoutS = 30, retries = 2 }) {
  const report = { kind: "BUILD_VERIFICATION", base: String(base || ""), git_sha: String(sha || ""), checked_at: new Date().toISOString(), verdict: "NOT_VERIFIED", exit_code: EXIT.USAGE, reasons: [] };
  const fail = (code, verdict, reason) => { report.exit_code = code; report.verdict = verdict; report.reasons.push(reason); return report; };
  let url; try { url = new URL(base); } catch { return fail(EXIT.USAGE, "USAGE", "base URL is not a valid URL"); }
  if (!/^https?:$/.test(url.protocol)) return fail(EXIT.USAGE, "USAGE", "base URL must be http(s)");
  const loopback = isLoopback(url.hostname);
  if (loopback && !allowLocalSelfTest) return fail(EXIT.USAGE, "USAGE", "loopback target refused: a local server is not proof of a hosted build (use --allow-local-self-test for self-tests only)");
  if (!loopback && url.protocol !== "https:") return fail(EXIT.USAGE, "USAGE", "a hosted target must be https");
  if (!/^[0-9a-f]{40}$/.test(String(sha))) return fail(EXIT.USAGE, "USAGE", "an explicit full 40-hex git SHA is required (branch names and short SHAs are refused)");
  try { git(["cat-file", "-e", `${sha}^{commit}`], cwd); } catch { return fail(EXIT.USAGE, "USAGE", "commit not present in this checkout: fetch it first"); }
  report.evidence_class = loopback ? "LOCAL_SELF_TEST" : "HOSTED"; report.hosted_proof = !loopback;
  const origin = url.origin; report.origin = origin;
  const assets = costingAssetList(sha, cwd);
  if (assets.length < 20) return fail(EXIT.USAGE, "USAGE", `unexpectedly few Costing assets for ${sha}: ${assets.length}`);
  const rows = []; const expectedLines = []; const servedLines = [];
  let unreachable = 0, access = 0, mismatches = 0;
  for (const rel of assets) {
    const want = sha256(normalise(rel, git(["show", `${sha}:${rel}`], cwd)));
    expectedLines.push(`${rel}\t${want}`);
    const r = fetchRetry(origin + "/" + rel.replace(/^public\//, ""), { timeoutS, retries });
    const row = { path: rel, expected_sha256: want, served_sha256: null, status: r.networkError ? "NETWORK_ERROR" : String(r.status), failure: null };
    if (r.networkError) { row.failure = "UNREACHABLE"; row.detail = r.networkError; unreachable++; }
    else if (r.redirects > 0 && new URL(r.effective).origin !== origin) { row.failure = "REDIRECTED_OFF_ORIGIN"; row.detail = new URL(r.effective).host; access++; }
    else if (r.status === 401 || r.status === 403) { row.failure = "ACCESS_DENIED"; access++; }
    else if (r.status === 404) { row.failure = "MISSING"; mismatches++; }
    else if (r.status !== 200) { row.failure = `HTTP_${r.status}`; mismatches++; }
    else {
      const ctype = /content-type:\s*([^\r\n;]+)/i.exec(r.headers)?.[1]?.toLowerCase() ?? "";
      if (/\.(js|mjs|css)$/.test(rel) && /text\/html/.test(ctype)) { row.failure = "HTML_FALLBACK_FOR_ASSET"; mismatches++; }
      else { row.served_sha256 = sha256(normalise(rel, r.body)); if (row.served_sha256 !== want) { row.failure = "CONTENT_DIFFERS"; row.detail = TEXT_EXT.test(rel) ? "text differs (line endings ignored)" : "binary bytes differ"; mismatches++; } if (rel === "public/sw.js") row.served_cache_name = cacheNameOf(r.body.toString("utf8")); }
    }
    servedLines.push(`${rel}\t${row.served_sha256 ?? "-"}`); rows.push(row);
  }
  const sw = rows.find((x) => x.path === "public/sw.js");
  const expectedCache = cacheNameOf(git(["show", `${sha}:public/sw.js`], cwd).toString("utf8"));
  Object.assign(report, { files: rows.length, mismatches, unreachable, access_problems: access, expected_cache_name: expectedCache, served_cache_name: sw?.served_cache_name ?? null,
    expected_bundle_digest: sha256(expectedLines.join("\n")), served_bundle_digest: sha256(servedLines.join("\n")), rows });
  if (expectCache && expectedCache !== expectCache) report.reasons.push(`commit cache name ${expectedCache} is not the expected ${expectCache}`);
  if (unreachable === rows.length) { report.exit_code = EXIT.NOT_VERIFIED; report.verdict = "NOT_VERIFIED"; report.reasons.push("target unreachable: no evidence either way"); return report; }
  if (unreachable + access > 0 && mismatches === 0) { report.exit_code = EXIT.NOT_VERIFIED; report.verdict = "NOT_VERIFIED"; report.reasons.push(`${unreachable} unreachable, ${access} access-denied/redirected: build identity not established`); return report; }
  const cacheBad = sw?.served_cache_name !== expectedCache || (expectCache && expectedCache !== expectCache);
  if (mismatches + unreachable + access > 0 || cacheBad || report.served_bundle_digest !== report.expected_bundle_digest) {
    report.exit_code = EXIT.MISMATCH; report.verdict = "MISMATCH";
    if (sw?.served_cache_name !== expectedCache) report.reasons.push(`served service-worker cache ${sw?.served_cache_name} != commit ${expectedCache}`);
    if (mismatches + unreachable + access > 0) report.reasons.push(`${mismatches + unreachable + access} of ${rows.length} assets do not match`);
    return report;
  }
  report.exit_code = EXIT.OK; report.verdict = "VERIFIED"; return report;
}

function cli(argv) {
  const args = argv.slice(2); const pos = args.filter((a, i) => !a.startsWith("--") && !["--json", "--expect-cache"].includes(args[i - 1]));
  const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const report = verifyServedAssets({ base: pos[0], sha: pos[1], expectCache: opt("--expect-cache"), allowLocalSelfTest: args.includes("--allow-local-self-test") });
  if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify(report, null, 1));
  for (const r of (report.rows ?? []).filter((x) => x.failure)) console.log(`${r.failure.padEnd(24)} ${r.status.padEnd(13)} ${r.path}${r.detail ? "  (" + r.detail + ")" : ""}`);
  const ok = report.verdict === "VERIFIED";
  console.log(`${report.verdict}${report.evidence_class ? " [" + report.evidence_class + (report.hosted_proof ? "" : ", NOT hosted proof") + "]" : ""} ${report.base} vs ${report.git_sha}: ` +
    (report.files != null ? `${report.files - report.mismatches - report.unreachable - report.access_problems}/${report.files} assets match; cache ${report.served_cache_name ?? "?"} (commit ${report.expected_cache_name}); bundle ${report.served_bundle_digest?.slice(0, 16)}…` : ""));
  for (const why of report.reasons) console.log("  - " + why);
  process.exit(ok ? EXIT.OK : report.exit_code);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) cli(process.argv);
