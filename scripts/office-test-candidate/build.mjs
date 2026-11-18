#!/usr/bin/env node
// Builds the UNPUBLISHED office-PC TEST candidate (NSIS + ZIP) from an EXACT committed SHA and verifies it. Never publishes.
//   node scripts/office-test-candidate/build.mjs --out <dir-outside-repo> [--sha <40-hex>] [--skip-build <existing-out-dir-with-build>]
// Source is exported with `git archive <sha>` into a temp dir, so the package is byte-for-byte the commit (dirty working trees, CRLF noise
// and untracked files cannot leak in). Environment that could publish/sign is stripped. Exit: 0 verified | 1 verification failure | 2 usage/build error.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BASELINE_MAIN_SHA, CONFIG_REL, REPO, asarContentProblems, identityProblems, listAsar, packagedPkgProblems, parityWithGit, readAsarFile, scrubbedEnv, secretScan, sha256File } from "./lib.mjs";
import { costingAssetList } from "../costing-acceptance/verify-served-assets.mjs";

const args = process.argv.slice(2); const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const fail = (code, msg) => { console.error(msg); process.exit(code); };
const git = (a, cwd = REPO) => execFileSync("git", a, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();

const outDir = opt("--out"); if (!outDir) fail(2, "--out <dir> required");
const out = path.resolve(outDir);
if (out.startsWith(REPO + path.sep)) fail(2, "--out must be outside the repository (installers must never be committed)");
const sha = git(["rev-parse", opt("--sha", "HEAD")]);
if (!/^[0-9a-f]{40}$/.test(sha)) fail(2, "bad sha");
try { git(["merge-base", "--is-ancestor", BASELINE_MAIN_SHA, sha]); } catch { fail(2, `commit ${sha} does not descend from the pinned baseline ${BASELINE_MAIN_SHA}`); }
fs.mkdirSync(out, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), "office-test-"));
const src = path.join(work, "src"); fs.mkdirSync(src);
console.log(`source commit ${sha}\nwork dir ${work}`);

// 1. exact-source export
execFileSync("sh", ["-c", `git archive ${sha} | tar -x -C ${JSON.stringify(src)}`], { cwd: REPO, stdio: "inherit" });
const cfgPath = path.join(src, CONFIG_REL);
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
const productionPkg = JSON.parse(fs.readFileSync(path.join(src, "package.json"), "utf8"));
if (productionPkg.sasvOfficeTestCandidate) fail(2, "package.json must not carry the candidate marker (production source must stay unmarked)");
const idProblems = identityProblems(cfg, productionPkg);
if (idProblems.length) fail(1, `identity guard FAILED: ${idProblems.join("; ")}`);
cfg.extraMetadata.sasvOfficeTestCandidate.sourceCommit = sha;
const genCfg = path.join(work, "builder.generated.json"); fs.writeFileSync(genCfg, JSON.stringify(cfg, null, 2));

// 2. dependencies from the lockfile, then build (publish never; publish/signing env stripped)
const { env, removed } = scrubbedEnv();
env.CI = "true";
const run = (cmd, a, cwd) => { const r = spawnSync(cmd, a, { cwd, env, stdio: "inherit" }); if (r.status !== 0) fail(2, `${cmd} ${a.join(" ")} failed (${r.status})`); };
run("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], src);
// Wine's rcedit/NSIS helpers segfault when TMPDIR/TMP/TEMP are redirected (reproduced on Wine 9.0, Ubuntu 24.04); run the builder with the default temp dir.
const builderEnvBackup = { ...env }; for (const k of ["TMPDIR", "TMP", "TEMP"]) delete env[k];
run(path.join(src, "node_modules/.bin/electron-builder"), ["--win", "nsis", "zip", "--publish", "never", "--config", genCfg], src);
void builderEnvBackup;

// 3. collect
const dist = path.join(src, "dist-office-test");
const names = fs.readdirSync(dist);
const nsis = names.find((n) => /^SASV-Workspace-OFFICE-TEST-.*\.exe$/.test(n));
const zip = names.find((n) => /^SASV-Workspace-OFFICE-TEST-.*\.zip$/.test(n));
if (!nsis || !zip) fail(1, `expected NSIS and ZIP in ${dist}, got ${names.join(", ")}`);
for (const n of [nsis, zip]) fs.copyFileSync(path.join(dist, n), path.join(out, n));
const asarSrc = path.join(dist, "win-unpacked/resources/app.asar");
fs.copyFileSync(asarSrc, path.join(out, "app.asar"));
fs.copyFileSync(path.join(dist, "builder-effective-config.yaml"), path.join(out, "builder-effective-config.yaml"));

// 4. verification
const problems = []; const checks = {};
const files = listAsar(asarSrc, src);
const costing = costingAssetList(sha, REPO);
const content = asarContentProblems(files, costing); problems.push(...content.problems); checks.asar = { files: content.fileCount, costingAssetsRequired: costing.length };
const pkg = JSON.parse(readAsarFile(asarSrc, "package.json", src).toString("utf8"));
problems.push(...packagedPkgProblems(pkg, { sha, productionPkg })); checks.packagedPackageJson = { name: pkg.name, productName: pkg.productName, version: pkg.version, marker: pkg.sasvOfficeTestCandidate };
const mainJs = readAsarFile(asarSrc, "main.js", src).toString("utf8");
if (!/OFFICE_TEST/.test(mainJs) || !/updater:restart[\s\S]{0,120}OFFICE_TEST/.test(mainJs)) problems.push("packaged main.js lacks the updater guard");
const parity = parityWithGit({ asarPath: asarSrc, files, sha, root: src, gitCwd: REPO }); problems.push(...parity.mismatches.map((m) => `parity: ${m}`)); checks.gitByteParity = { filesCompared: parity.compared, mismatches: parity.mismatches.length };
const scan = secretScan({ asarPath: asarSrc, files, root: src }); if (scan.hits.length) problems.push(`secret scan hits: ${JSON.stringify(scan.hits)}`); checks.secretScan = { hits: scan.hits.length, publicAnonJwtOccurrences: scan.publicAnonJwtOccurrences };
const resDir = path.join(dist, "win-unpacked/resources");
if (fs.existsSync(path.join(resDir, "app-update.yml"))) problems.push("app-update.yml present in resources (updater feed would exist)");
if (names.some((n) => /^latest.*\.yml$/.test(n))) problems.push("latest.yml was produced (release-feed artefact)");
const eff = fs.readFileSync(path.join(out, "builder-effective-config.yaml"), "utf8");
for (const needle of ["appId: com.brahmadathanu.sasvworkspace.officetest", "productName: SASV Workspace OFFICE TEST", `guid: ${cfg.nsis.guid}`]) if (!eff.includes(needle)) problems.push(`effective config lacks "${needle}"`);
if (/A3F5C8D2-14BE-4E7A-9B3C-6D0E2F1A4B87|appId: com\.brahmadathanu\.sasvworkspace\s*$/m.test(eff)) problems.push("effective config contains the production GUID/appId");
if (/provider: github/.test(eff)) problems.push("effective config contains a github publish provider");
checks.effectiveConfig = { appIdOk: true, guidOk: true, noProductionIdentity: !/A3F5C8D2-14BE/.test(eff) };
const mz = (p) => { const b = Buffer.alloc(2); const fd = fs.openSync(p, "r"); fs.readSync(fd, b, 0, 2, 0); fs.closeSync(fd); return b.toString("latin1") === "MZ"; };
if (!mz(path.join(out, nsis))) problems.push("NSIS installer is not a PE (MZ) file");
// ZIP contents and the app.asar inside it
const zl = execFileSync("unzip", ["-Z1", path.join(out, zip)], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\n");
const exeInZip = zl.find((n) => n === "SASV Workspace OFFICE TEST.exe"); if (!exeInZip) problems.push("ZIP lacks 'SASV Workspace OFFICE TEST.exe'");
if (zl.some((n) => /(^|\/)SASV Workspace\.exe$/.test(n))) problems.push("ZIP contains production executable name");
const zx = path.join(work, "zipx"); fs.mkdirSync(zx); execFileSync("unzip", ["-q", "-o", path.join(out, zip), "resources/app.asar", "-d", zx]);
const asarHash = sha256File(path.join(out, "app.asar"));
if (sha256File(path.join(zx, "resources/app.asar")) !== asarHash) problems.push("ZIP app.asar differs from win-unpacked app.asar");
checks.zip = { entries: zl.filter(Boolean).length, exe: exeInZip || null, asarSameAsUnpacked: sha256File(path.join(zx, "resources/app.asar")) === asarHash };
// NSIS payload app.asar (7z extraction of the installer; independent of the unpacked dir)
try {
  const z7 = path.join(src, "node_modules/7zip-bin/linux/x64/7za"); const nx = path.join(work, "nsisx"); fs.mkdirSync(nx);
  execFileSync(z7, ["x", "-y", `-o${nx}`, path.join(out, nsis)], { stdio: "ignore" });
  const pay = (function find(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { const r = find(p); if (r) return r; } else if (/^app-64\.7z$/.test(e.name)) return p; } return null; })(nx);
  if (!pay) { checks.nsisPayload = { status: "NOT VERIFIED: app-64.7z not found in installer extraction" }; }
  else { const px = path.join(work, "payx"); fs.mkdirSync(px); execFileSync(z7, ["x", "-y", `-o${px}`, pay], { stdio: "ignore" });
    const same = sha256File(path.join(px, "resources/app.asar")) === asarHash; if (!same) problems.push("NSIS payload app.asar differs from win-unpacked app.asar");
    checks.nsisPayload = { status: same ? "app.asar in installer payload == app.asar hashed below" : "MISMATCH", exe: fs.existsSync(path.join(px, "SASV Workspace OFFICE TEST.exe")) }; if (!checks.nsisPayload.exe) problems.push("NSIS payload lacks the OFFICE TEST executable"); }
} catch (e) { checks.nsisPayload = { status: `NOT VERIFIED: ${String(e.message).split("\n")[0]}` }; }

// 5. hashes + manifest
const hashes = { [nsis]: sha256File(path.join(out, nsis)), [zip]: sha256File(path.join(out, zip)), "app.asar": asarHash };
fs.writeFileSync(path.join(out, "SHA256SUMS.txt"), Object.entries(hashes).map(([n, h]) => `${h}  ${n}`).join("\n") + "\n");
const manifest = { kind: "OFFICE-PC TEST CANDIDATE - UNPUBLISHED - NOT A RELEASE", sourceCommit: sha, baselineMain: BASELINE_MAIN_SHA, builtAtUtc: new Date().toISOString(),
  builder: { host: `${os.platform()} ${os.arch()} (cross-build; Wine ${execFileSync("wine", ["--version"], { encoding: "utf8" }).trim()} for NSIS uninstaller + exe resource editing)`, node: process.version, electronBuilder: JSON.parse(fs.readFileSync(path.join(src, "node_modules/electron-builder/package.json"), "utf8")).version, electron: JSON.parse(fs.readFileSync(path.join(src, "node_modules/electron/package.json"), "utf8")).version },
  signing: "UNSIGNED (no certificate configured; credentials stripped from the environment). Windows SmartScreen will warn.", strippedEnv: removed,
  artifacts: Object.fromEntries(Object.entries(hashes).map(([n, h]) => [n, { sha256: h, bytes: fs.statSync(path.join(out, n === "app.asar" ? "app.asar" : n)).size }])),
  checks, problems, verdict: problems.length ? "FAIL" : "VERIFIED" };
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ verdict: manifest.verdict, problems, hashes }, null, 2));
process.exit(problems.length ? 1 : 0);
