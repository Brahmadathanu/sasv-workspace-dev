// WP09 G2 scope / safety source tests (offline, read-only). Run: node scripts/wp09-g2-launcher-presentation/source.test.mjs [resultsJson]
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { repoRoot, AUTHORITY_HEAD, readFile, baselineFile, makeResults } from "./lib.mjs";

const { results, check, failed } = makeResults();
const git = (...a) => execFileSync("git", a, { cwd: repoRoot, encoding: "utf8" }).split("\n").filter(Boolean);

// ---- scope guard: only the authorised runtime files changed against the authority head ----
const changed = new Set([...git("diff", "--name-only", AUTHORITY_HEAD), ...git("diff", "--name-only", "--cached", AUTHORITY_HEAD), ...git("ls-files", "--others", "--exclude-standard")]);
for (const f of [...changed]) {
  if (!/^supabase\/migrations\/20261112/.test(f)) continue;
  // Ignore only working-copy line endings on an otherwise unchanged tracked file.
  // Committed SQL edits or substantive whitespace/content changes must still fail.
  const committed = execFileSync("git", ["show", `HEAD:${f}`], { cwd: repoRoot, encoding: "utf8" });
  if (committed === baselineFile(f) && readFile(f).replace(/\r\n/g, "\n") === committed.replace(/\r\n/g, "\n")) changed.delete(f);
}
const RUNTIME_ALLOWED = new Set(["index.html", "public/utilities-hub/js/hub-auth.js", "public/shared/js/module-registry.js", "public/shared/js/launcher-presentation.js", "public/shared/js/launcher-presentation-contract.js", "public/shared/css/launcher-presentation.css", "public/sw.js"]);
const runtimeChanged = [...changed].filter((f) => !f.startsWith("docs/") && !f.startsWith("scripts/"));
check("G1 runtime files changed are exactly within the authorised client set", runtimeChanged.every((f) => RUNTIME_ALLOWED.has(f)), runtimeChanged.filter((f) => !RUNTIME_ALLOWED.has(f)).join() || `${runtimeChanged.length} files`);
check("G2 nothing under supabase/, sql/, tools/ or electron/ changed; no migration added", ![...changed].some((f) => /^(supabase|sql|tools|electron)\//.test(f)) && !changed.has("main.js") && !changed.has("preload.js"));
check("G3 no legacy/source page, WP08 shared page or master page changed", ![...changed].some((f) => /^manage-.*\.html$|^public\/shared\/(manage-|production-route|costing|cost-|pricing|material).*\.html$/.test(f)));
check("G4 Costing flag source, the eleven-flag sweep and the WP08 tests are byte-identical to the authority head", ["public/shared/js/costing-feature-flags.js", "scripts/costing-wp12-flag-sweep/console-rpc-allowlist.test.mjs", "scripts/costing-wp12-flag-sweep/flag-sweep-browser.test.mjs", "scripts/wp08-g2-0-shared-master-data/source.test.mjs", "scripts/wp08-g2-1-navigation/source.test.mjs"].every((f) => readFile(f) === baselineFile(f)));
check("G5 historical G1 evidence snapshot and mapping CSV unchanged (provenance preserved)", ["docs/master-data-costing/WP09_G1_EVIDENCE/live-registry-snapshot-2026-11-15.json", "docs/master-data-costing/WP09_G1_EVIDENCE/option-coverage.json", "docs/master-data-costing/WP09_G1_EVIDENCE/module-group-mapping.csv", "scripts/wp09-g1-launcher-audit/module-mapping.mjs"].every((f) => readFile(f) === baselineFile(f)));
check("G6 original G1 handover/report/authority documents preserved verbatim", ["docs/master-data-costing/WP09_G1_BULK_AUDIT_REPORT_2026-11-15.md", "docs/master-data-costing/WP09_G1_INDEPENDENT_REVIEW_NEW_CHAT_HANDOVER_2026-11-15.md", "docs/master-data-costing/WP09_OWNER_G1_ACCEPTANCE_G2_AUTHORITY_2026-11-15.md", "docs/master-data-costing/WP09_G2_SINGLE_CLIENT_PACKAGE_2026-11-15.md"].every((f) => readFile(f) === baselineFile(f)));

// ---- no new writers, no permission/registry logic ----
const writer = /\.(insert|update|upsert|delete)\(|\.rpc\(|\.from\(["'`](app_modules|app_module_clients|app_nav_sections|permission|user_permissions)/;
const added = (f) => { const base = new Set(baselineFile(f).split("\n")); return readFile(f).split("\n").filter((l) => !base.has(l)); };
for (const f of ["index.html", "public/utilities-hub/js/hub-auth.js", "public/shared/js/module-registry.js", "public/sw.js"]) check(`W1 ${f}: no added line introduces a Supabase writer/RPC/registry table access`, !added(f).some((l) => writer.test(l)));
const lp = readFile("public/shared/js/launcher-presentation.js") + readFile("public/shared/js/launcher-presentation-contract.js");
const lpCode = lp.replace(/^\s*\/\/.*$/gm, "");
check("W2 shared presentation module has no Supabase import, no network, no permission logic", !/supabase|fetch\(|XMLHttpRequest|get_user_permissions|can_edit|can_view|grant/i.test(lp.replace(/\/\/.*$/gm, "")));
check("W3 contract is data only (79 frozen tuples; no routes, grants or targets)", (readFile("public/shared/js/launcher-presentation-contract.js").match(/Object\.freeze\(\[/g) || []).length === 79 && !/route_path|target_key|module:|\.html/.test(readFile("public/shared/js/launcher-presentation-contract.js").replace(/^\/\/.*$/gm, "")));

// ---- exactly one default-off flag; no activation anywhere ----
const flagHits = [...changed].filter((f) => /\.(js|html|mjs)$/.test(f) && !f.startsWith("scripts/") && !f.startsWith("docs/")).filter((f) => readFile(f).includes("LAUNCHER_PRESENTATION_V1"));
check("X1 flag identifier LAUNCHER_PRESENTATION_V1 is defined once and read via localStorage exact value '1'", /export const LAUNCHER_PRESENTATION_V1 = "LAUNCHER_PRESENTATION_V1"/.test(lp) && /getItem\?\.\(LAUNCHER_PRESENTATION_V1\) === "1"/.test(lp));
check("X2 no code anywhere sets the flag (no setItem of LAUNCHER_PRESENTATION_V1 in runtime files)", !flagHits.some((f) => /setItem\([^)]*LAUNCHER_PRESENTATION_V1/.test(readFile(f).replace(/^\s*\/\/.*$/gm, ""))) && !/setItem\(\s*(LAUNCHER_PRESENTATION_V1|"LAUNCHER_PRESENTATION_V1")/.test(lpCode));
check("X3 flag is independent of the eleven COSTING_* flags", !/COSTING_/.test(lpCode));
const idx = readFile("index.html"), hub = readFile("public/utilities-hub/js/hub-auth.js");
function presentationEntryGuards(indexSource, hubSource) {
  return [indexSource, hubSource].every((src) =>
    /const presentationOn = isLauncherPresentationV1Enabled\(\)/.test(src) &&
    /if \(presentationOn\) \{\s*document\.documentElement\.dataset\.launcherPresentation/.test(src)
  ) && /if \(!presentationOn\) \{[\s\S]*?section\.items\.map\(renderModuleLink\)[\s\S]*?else \{\s*const plan = planSection/.test(indexSource) &&
    /if \(!presentationOn\) \{[\s\S]*?list\.forEach[\s\S]*?else \{\s*html \+= renderSectionPresentation/.test(hubSource) &&
    /if \(presentationOn\) renderHubTools\(session, utilities, accessMap\);/.test(hubSource) &&
    /if \(presentationOn\) syncPresentationGroups\(\);/.test(indexSource);
}
check("X4 presentation CSS, renderers and tools require explicit flag guards", presentationEntryGuards(idx, hub));
check("X4M1 unconditional PWA tools mutation is rejected", !presentationEntryGuards(idx, hub.replace("if (presentationOn) renderHubTools(session, utilities, accessMap);", "renderHubTools(session, utilities, accessMap);")));
check("X4M2 unconditional Electron group sync mutation is rejected", !presentationEntryGuards(idx.replace("if (presentationOn) syncPresentationGroups();", "syncPresentationGroups();"), hub));

// ---- service worker: delivery of the changed scripts without touching existing behaviour ----
const sw = readFile("public/sw.js"), swBase = baselineFile("public/sw.js");
check("SW1 CACHE_NAME is UNCHANGED (hub-cache-v393): network-first routing alone delivers the changed scripts, keeping the WP08 service-worker guards green", /CACHE_NAME = "hub-cache-v393"/.test(sw) && /CACHE_NAME = "hub-cache-v393"/.test(swBase));
const removedSw = swBase.split("\n").filter((l) => !sw.split("\n").includes(l));
check("SW2 service-worker diff is ADD-ONLY (no existing line removed or edited; G2-0 and G2-1 patterns byte-identical)", removedSw.length === 0, removedSw.map((l) => l.slice(0, 60)).join(" | "));
check("SW3 new files and the two changed cache-first scripts are network-first; PRECACHE list untouched (stale ETL precache cleanup deferred)", /launcher-presentation\(\?:-contract\)\?/.test(sw) && /launcher-presentation\\\.css/.test(sw) && /module-registry\\\.js/.test(sw) && /hub-auth\\\.js/.test(sw) && sw.split("const PRECACHE")[1].split("];")[0] === swBase.split("const PRECACHE")[1].split("];")[0]);

// ---- Quick Access decision: recents are not displayed in either client ----
check("D1 decision recorded in code: PWA does not record recents/usage; Electron keeps recents storage but renders pins only", !/recent-modules|usage-stats/.test(hub + lp) && /const shortcuts = pinnedItems;/.test(idx));
check("D2 PWA Quick Access has no server persistence (localStorage only)", !/supabase\.(from|rpc)\([^)]*pin/i.test(hub) && /globalThis\.localStorage/.test(hub));

console.log(failed() ? `\n${failed()} FAILED` : "\nALL PASSED");
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ results }, null, 2) + "\n");
process.exit(failed() ? 1 : 0);
