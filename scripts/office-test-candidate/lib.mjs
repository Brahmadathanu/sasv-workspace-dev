// Office-PC TEST candidate: pure/offline helpers for identity checks, ASAR inspection, hashing and secret scanning.
// Nothing here publishes, uploads, signs, installs or contacts any service. Excluded from packages by `!scripts/**`.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, "..", "..");
export const CONFIG_REL = "electron/candidate/electron-builder.office-test.json";
export const BASELINE_MAIN_SHA = "8c7648fab72f2cf2e40bacc74e8fe59bedca2777";
export const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
export const sha256File = (p) => sha256(fs.readFileSync(p));
const requireFrom = (root) => createRequire(path.join(root, "package.json"));

/** Environment that could cause an implicit publish or signing. The build child never sees these. */
export const FORBIDDEN_ENV = ["GH_TOKEN", "GITHUB_TOKEN", "GH_ENTERPRISE_TOKEN", "CSC_LINK", "CSC_KEY_PASSWORD", "CSC_NAME", "WIN_CSC_LINK", "WIN_CSC_KEY_PASSWORD", "EP_GH_IGNORE_TIME", "ELECTRON_BUILDER_PUBLISH"];
export function scrubbedEnv(env = process.env) {
  const out = { ...env }; const removed = [];
  for (const k of FORBIDDEN_ENV) if (k in out) { delete out[k]; removed.push(k); }
  out.EP_PRE_RELEASE = undefined; delete out.EP_PRE_RELEASE;
  return { env: out, removed };
}

/** Candidate config vs production package.json `build`: every identity field must differ, publishing must be off. Returns problems[]. */
export function identityProblems(candidateCfg, productionPkg) {
  const prod = productionPkg.build || {}; const p = [];
  const same = (a, b) => String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase();
  if (same(candidateCfg.appId, prod.appId)) p.push("appId equals production");
  if (same(candidateCfg.productName, prod.productName) || same(candidateCfg.productName, productionPkg.productName)) p.push("productName equals production");
  if (same(candidateCfg.nsis?.guid, prod.nsis?.guid)) p.push("NSIS GUID equals production");
  if (!/^[0-9A-F]{8}(-[0-9A-F]{4}){3}-[0-9A-F]{12}$/.test(String(candidateCfg.nsis?.guid || ""))) p.push("NSIS GUID malformed");
  if (same(candidateCfg.extraMetadata?.name, productionPkg.name)) p.push("package name equals production");
  if (same(candidateCfg.extraMetadata?.version, productionPkg.version)) p.push("version equals production");
  if (same(candidateCfg.nsis?.shortcutName, prod.productName)) p.push("shortcut name equals production");
  if (candidateCfg.publish !== null) p.push("publish must be null (no feed, no app-update.yml)");
  if (candidateCfg.nsis?.deleteAppDataOnUninstall !== false) p.push("deleteAppDataOnUninstall must be false");
  const m = candidateCfg.extraMetadata?.sasvOfficeTestCandidate;
  if (!m || m.updaterDisabled !== true) p.push("candidate marker missing or updater not disabled");
  if (m && m.appId !== candidateCfg.appId) p.push("marker appId differs from builder appId");
  if (m && m.candidateVersion !== candidateCfg.extraMetadata.version) p.push("marker version differs from package version");
  if (!String(candidateCfg.artifactName || "").includes("OFFICE-TEST")) p.push("artifactName must contain OFFICE-TEST");
  return p;
}

export function listAsar(asarPath, root) { return requireFrom(root)("@electron/asar").listPackage(asarPath, { isPack: false }).map((x) => x.replace(/\\/g, "/").replace(/^\//, "")); }
export function readAsarFile(asarPath, rel, root) { return requireFrom(root)("@electron/asar").extractFile(asarPath, rel); }

const REQUIRED_ASAR = [
  "package.json", "main.js", "preload.js", "electron/candidate/office-test-isolation.js",
  "manage-categories.html", "manage-subcategories.html", "manage-product-groups.html", "manage-subgroups.html",
  "js/categories.js", "js/subcategories.js", "js/product-groups.js", "js/subgroups.js",
  "public/shared/js/wp10-safeguards.js", "public/shared/js/costing-cost-comparison-read.js", "public/shared/js/costing-feature-flags.js", "public/sw.js",
];
const FORBIDDEN_ASAR = [/^docs\//, /^scripts\//, /^supabase\//, /^sql\//, /^tools\//, /^\.git/, /^dist/, /(^|\/)\.env(\.|$)/, /\.(pem|pfx|p12|key)$/i, /^electron\/candidate\/electron-builder/, /(^|\/)app-update\.yml$/, /(^|\/)latest\.yml$/];

/** Structural ASAR checks; returns { problems, fileCount, missing, forbidden }. `costingAssets` = repo-relative paths that must be present. */
export function asarContentProblems(files, costingAssets = []) {
  const set = new Set(files); const problems = [];
  const missing = [...REQUIRED_ASAR, ...costingAssets].filter((f) => !set.has(f));
  if (missing.length) problems.push(`missing from ASAR: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? ` (+${missing.length - 10})` : ""}`);
  const forbidden = files.filter((f) => !f.startsWith("node_modules/") && FORBIDDEN_ASAR.some((re) => re.test(f)));
  if (forbidden.length) problems.push(`forbidden in ASAR: ${forbidden.slice(0, 10).join(", ")}`);
  return { problems, fileCount: files.length, missing, forbidden };
}

/** Packaged package.json checks (marker present, identity differs from production, version stamped with the exact SHA). */
export function packagedPkgProblems(pkg, { sha, productionPkg }) {
  const p = []; const m = pkg.sasvOfficeTestCandidate;
  if (!m) return ["packaged package.json has no candidate marker"];
  if (m.sourceCommit !== sha) p.push(`marker sourceCommit ${m.sourceCommit} != ${sha}`);
  if (m.baselineMainSha !== BASELINE_MAIN_SHA) p.push("marker baselineMainSha is not the pinned baseline");
  if (pkg.productName !== "SASV Workspace OFFICE TEST") p.push(`productName ${pkg.productName}`);
  if (pkg.name === productionPkg.name) p.push("package name equals production");
  if (pkg.version === productionPkg.version) p.push("version equals production");
  if (pkg.version !== m.candidateVersion) p.push("package version != marker version");
  return p;
}

/** Byte parity of every non-node_modules ASAR file with the exact committed blob (LF/CRLF is NOT normalised: bytes must be identical). */
export function parityWithGit({ asarPath, files, sha, root, gitCwd }) {
  const mismatches = []; let compared = 0;
  for (const f of files) {
    if (f.startsWith("node_modules/") || f === "package.json") continue;
    let blob; try { blob = execFileSync("git", ["show", `${sha}:${f}`], { cwd: gitCwd, maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }); } catch { mismatches.push(`${f}: not in commit`); continue; }
    compared++; if (sha256(blob) !== sha256(readAsarFile(asarPath, f, root))) mismatches.push(`${f}: bytes differ`);
  }
  return { compared, mismatches };
}

const TEXT = /\.(js|mjs|cjs|json|html|css|txt|md|yml|yaml|svg|map|env|sql)$/i;
/** Secret scan of ASAR text files (excluding node_modules). Reports counts and file names only, never values. */
export function secretScan({ asarPath, files, root }) {
  const hits = []; let anonJwt = 0;
  const rules = [
    ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)PRIVATE KEY-----/],
    ["github-token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|github_pat_[A-Za-z0-9_]{30,}/],
    ["supabase-secret-key", /\bsb_secret_[A-Za-z0-9_-]{10,}/],
    ["db-url-with-password", /postgres(?:ql)?:\/\/[^:@\s/]+:[^@\s/]+@/i],
    ["aws-access-key", /\bAKIA[0-9A-Z]{16}\b/],
  ];
  for (const f of files) {
    if (f.startsWith("node_modules/") || !TEXT.test(f)) continue;
    const t = readAsarFile(asarPath, f, root).toString("utf8");
    for (const [name, re] of rules) if (re.test(t)) hits.push({ file: f, rule: name });
    for (const m of t.matchAll(/\beyJ[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g)) {
      try { const role = JSON.parse(Buffer.from(m[1], "base64url").toString("utf8")).role; if (role === "service_role") hits.push({ file: f, rule: "supabase-service-role-jwt" }); else if (role === "anon") anonJwt++; } catch { /* not a JWT */ }
    }
  }
  return { hits, publicAnonJwtOccurrences: anonJwt, note: "public anon keys are expected in a client app and are counted only; no values recorded" };
}
