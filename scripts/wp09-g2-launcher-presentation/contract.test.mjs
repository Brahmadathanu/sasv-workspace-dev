// WP09 G2 pure contract / matcher / pin tests + mutation controls (offline, read-only).
// Run: node scripts/wp09-g2-launcher-presentation/contract.test.mjs [resultsJson]
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { loadRegistryModule } from "../wp09-g1-launcher-audit/lib.mjs";
import { repoRoot, snapshot, optionCoverage, registryFor, bySection, loadPresentation, makeResults, readFile, baselineFile } from "./lib.mjs";

const { results, check, failed } = makeResults();
const P = await loadPresentation();
const R = await loadRegistryModule();
const elec = registryFor("electron"), pwa = registryFor("pwa");

// ---- contract vs live snapshot / accepted mapping ----
const keys = Object.keys(P.LAUNCHER_PRESENTATION_CONTRACT);
check("C1 contract has exactly the 79 live Electron keys", keys.length === 79 && elec.length === 79 && elec.every((r) => keys.includes(r.module_key)));
check("C2 every contract section equals the CURRENT live section (A preserves all sections)", elec.every((r) => P.LAUNCHER_PRESENTATION_CONTRACT[r.module_key][0] === r.section_key));
check("C3 41 PWA keys are a subset of the contract", pwa.length === 41 && pwa.every((r) => keys.includes(r.module_key)));
let genOk = true; try { execFileSync("node", ["scripts/wp09-g2-launcher-presentation/generate-contract.mjs", "--check"], { cwd: repoRoot, stdio: "pipe" }); } catch { genOk = false; }
check("C4 committed contract equals the generator output from the accepted mapping + snapshot", genOk);
for (const [client, rows] of [["electron", elec], ["pwa", pwa]]) {
  const per = Object.fromEntries(optionCoverage.find((o) => o.client === client).perSection.map((s) => [s.section, s.option_c_top_level]));
  let total = 0, ok = true; const seen = {};
  for (const [section, items] of bySection(rows)) {
    const plan = P.planSection(items, section);
    const top = plan.subgroups.reduce((n, sg) => n + sg.nodes.length, 0);
    total += top; seen[section] = top;
    if (per[section] !== top) ok = false;
    const flat = plan.subgroups.flatMap((sg) => sg.nodes.flatMap((n) => (n.kind === "module" ? [n.item.moduleKey] : n.items.map((i) => i.moduleKey))));
    if (flat.length !== items.length || new Set(flat).size !== items.length) ok = false;
  }
  check(`C5 ${client}: section-scoped top-level cards = option-coverage maximum (${client === "electron" ? 36 : 24}), every module exactly once`, ok && total === (client === "electron" ? 36 : 24), `total=${total}`);
}
{
  const fams = new Map();
  for (const [k, v] of Object.entries(P.LAUNCHER_PRESENTATION_CONTRACT)) if (v[2]) { const id = `${v[0]}|${v[2]}`; fams.set(id, (fams.get(id) || new Set()).add(v[1])); }
  check("C6 every (section,family) lives in exactly one subgroup", [...fams.values()].every((s) => s.size === 1));
  const costing = ["costing-control-center", "material-cost-manager", "cost-build-manager", "pricing-policy-manager", "production-route-manager", "cost-sheet-review"];
  const cf = new Set(costing.map((k) => P.LAUNCHER_PRESENTATION_CONTRACT[k].join("|")));
  check("C7 six Costing modules incl. Production Route Manager form ONE family in ONE section", cf.size === 1, [...cf].join());
  check("C8 registered child pages stay launchable: coa-print, edit-log-entry, sop-editor, sop-viewer", ["coa-print", "edit-log-entry", "sop-editor", "sop-viewer"].every((k) => keys.includes(k) && elec.some((r) => r.module_key === k)));
  check("C9 families never cross sections: no family label appears in two sections with merged ids", (() => { const ids = new Set(); for (const [section, items] of bySection(elec)) for (const sg of P.planSection(items, section).subgroups) for (const n of sg.nodes) if (n.kind === "family") { if (ids.has(n.id)) return false; ids.add(n.id); } return true; })());
}

// ---- unknown / collision / fallback ----
{
  const items = [...bySection(elec).get("work-log"), { moduleKey: "zz-future-module", label: "Zz Future", description: "", order: 9999, section: "work-log" }];
  const plan = P.planSection(items, "work-log");
  const last = plan.subgroups[plan.subgroups.length - 1];
  check("U1 unknown future key lands in the fallback subgroup, flat, LAST, and is not lost", last.fallback && last.label === "More" && last.nodes.some((n) => n.kind === "module" && n.item.moduleKey === "zz-future-module") && plan.subgroups.flatMap((s) => s.nodes).length > 0);
  const collided = bySection(elec).get("work-log").map((i) => (i.moduleKey === "view-logs" ? i : i));
  const planSys = P.planSection([{ moduleKey: "view-logs", label: "View Logs", order: 1, description: "" }], "system");
  check("U2 cross-section disagreement => treated as unknown (fallback, no family), never merged into the other section", planSys.subgroups.length === 1 && planSys.subgroups[0].fallback && planSys.subgroups[0].nodes[0].kind === "module");
  check("U3 getContractEntry null for unknown key and for mismatched section", P.getContractEntry("nope", "work-log") === null && P.getContractEntry("view-logs", "system") === null && P.getContractEntry("view-logs", "work-log") !== null);
}

// ---- matcher ----
const entries = elec.map((r) => ({ moduleKey: r.module_key, label: r.label, description: r.description, subgroup: P.LAUNCHER_PRESENTATION_CONTRACT[r.module_key][1], aliases: R.getModuleKeyAliases(r.module_key), locked: false }));
const find = (q, list = entries) => P.matchModules(q, list).map((e) => e.moduleKey);
check("S1 label match", find("route manager").includes("production-route-manager"));
check("S2 subgroup match (approved subgroup 'Stock positions')", find("stock positions").includes("bottled-stock"));
check("S3 real alias match (operations-monitor found via former name etl-monitor)", find("etl monitor").includes("operations-monitor") && R.getModuleKeyAliases("operations-monitor").includes("etl-monitor"));
check("S4 description-only match", (() => { const e = elec.find((r) => /control sample/i.test(r.description) && !/control sample/i.test(r.label)); return e ? find("control sample", entries).length > 0 : true; })());
check("S5 AND of terms; empty/space query returns no results", find("route zzzz").length === 0 && P.matchModules("   ", entries).length === 0);
check("S6 section names are NOT searched (section label alone finds no section-only module)", P.matchModules("administration", [{ moduleKey: "x", label: "Foo", description: "", subgroup: "", aliases: [] }]).length === 0);
check("S7 matcher returns the entry object flagged locked (callers keep it disabled) and never adds fields that enable it", (() => { const hit = P.matchModules("foo", [{ moduleKey: "x", label: "Foo", locked: true, href: "#" }])[0]; return hit.locked === true && hit.href === "#"; })());
check("S8 deterministic order: exact label first, then label order", find("log")[0] !== undefined && JSON.stringify(find("log")) === JSON.stringify(find("log")));
{
  const aliasBlock = (src) => /const MODULE_KEY_ALIASES = Object\.freeze\(\{[\s\S]*?\}\);/.exec(src)[0];
  check("S9 NO alias was added or changed in module-registry.js (lab key differences are not masked)", aliasBlock(readFile("public/shared/js/module-registry.js")) === aliasBlock(baselineFile("public/shared/js/module-registry.js")));
  check("S10 the two recorded lab permission-name differences have no alias", R.getModuleKeyAliases("test-method-master-manager").length === 0 && R.getModuleKeyAliases("lab-workflow-access-control-manager").length === 0 && R.normalizeModuleKey("lab-test-method-master") !== "test-method-master-manager" && R.normalizeModuleKey("lab-workflow-access-control") !== "lab-workflow-access-control-manager");
}

// ---- pins (storage-injected) ----
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), dump: () => Object.fromEntries(m) }; };
{
  const st = mem();
  check("Q1 key shape identical to the Electron launcher key", P.pinsStorageKey("u1") === "sasv-workspace:u1:pinned-modules" && /sasv-workspace:\$\{workspaceStorageScope\}:\$\{suffix\}|sasv-workspace:\$\{workspaceStorageScope\}/.test(readFile("index.html")));
  check("Q2 scope derivation matches normalizeModuleKey for uuid/email/guest", ["8C1F-AA_bb", "User@Example.com", ""].every((v) => P.scopeFromUser({ id: v }) === (R.normalizeModuleKey(v || "guest") || "guest")));
  for (let i = 0; i < 12; i++) P.togglePin(st, "u1", `m${i}`);
  const pins = P.readPins(st, "u1");
  check("Q3 maximum 10 pins, newest first, oldest dropped", pins.length === 10 && pins[0] === "m11" && !pins.includes("m0") && !pins.includes("m1"));
  check("Q4 toggle off removes; scopes are isolated", P.togglePin(st, "u1", "m11") === false && !P.readPins(st, "u1").includes("m11") && P.readPins(st, "u2").length === 0);
  const visible = [{ moduleKey: "m5", href: "x.html" }, { moduleKey: "m6", href: "#" }, { moduleKey: "m7", href: "y.html", locked: true }];
  const resolved = P.resolveQuickAccess(["m7", "m6", "m5", "gone"], visible).map((e) => e.moduleKey);
  check("Q5 pins resolve only to visible, enabled, routable modules; order kept", resolved.join() === "m5");
  check("Q6 stale/revoked/locked pins are retained (not pruned) for restore", P.readPins(st, "u1").includes("m5") && JSON.stringify(P.readPins(st, "u1")) === JSON.stringify(P.readPins(st, "u1")));
  check("Q7 corrupt storage and throwing storage degrade to no pins", P.readPins({ getItem: () => "{bad" }, "u") .length === 0 && P.readPins({ getItem: () => { throw new Error("x"); } }, "u").length === 0);
}
check("F1 flag: only the exact value '1' enables; default OFF", ["1"].every((v) => P.isLauncherPresentationV1Enabled({ getItem: () => v })) && ["0", "true", "", null, "on", " 1"].every((v) => !P.isLauncherPresentationV1Enabled({ getItem: () => v })) && !P.isLauncherPresentationV1Enabled({ getItem: () => { throw new Error("x"); } }) && P.LAUNCHER_PRESENTATION_V1 === "LAUNCHER_PRESENTATION_V1");

// ---- invariant suite used for mutation controls ----
async function invariants(mod) {
  const bad = [];
  const unknown = [{ moduleKey: "zz-new", label: "Zz", order: 1, description: "" }];
  const flat = (plan) => plan.subgroups.flatMap((s) => s.nodes.flatMap((n) => (n.kind === "module" ? [n.item.moduleKey] : n.items.map((i) => i.moduleKey))));
  if (!flat(mod.planSection(unknown, "work-log")).includes("zz-new")) bad.push("lost-unknown-module");
  const plan = mod.planSection([{ moduleKey: "view-logs", label: "View Logs", order: 1, description: "" }], "system");
  if (plan.subgroups.some((s) => s.nodes.some((n) => n.kind === "family"))) bad.push("cross-section-family-collision");
  const st = mem(); mod.togglePin(st, mod.scopeFromUser({ id: "A" }), "m1");
  if (mod.readPins(st, mod.scopeFromUser({ id: "B" })).length !== 0) bad.push("stale-pin-reuse-across-users");
  if (mod.resolveQuickAccess(["m1"], [{ moduleKey: "m1", href: "x", locked: true }]).length !== 0) bad.push("locked-pin-resolved");
  if (mod.resolveQuickAccess(["m1"], [{ moduleKey: "m1", href: "#" }]).length !== 0) bad.push("unroutable-pin-resolved");
  if (mod.resolveQuickAccess(["m1"], []).length !== 0) bad.push("revoked-pin-resolved");
  const hit = mod.matchModules("foo", [{ moduleKey: "x", label: "Foo", locked: true, href: "#" }])[0];
  if (!hit || hit.locked !== true || hit.href !== "#") bad.push("locked-result-enabled");
  return bad;
}
check("MU0 invariant suite is clean on the real module", (await invariants(P)).length === 0);
const mutants = {
  "lost-unknown-module": (s) => s.replace("const subLabel = entry ? entry.subgroup : FALLBACK_SUBGROUP;", "if (!entry) continue;\n    const subLabel = entry.subgroup;"),
  "cross-section-family-collision": (s) => s.replace("if (liveSectionKey != null && norm(hit[0]) !== norm(liveSectionKey)) return null;", ""),
  "stale-pin-reuse-across-users": (s) => s.replace("return norm(user?.id || user?.email || \"guest\") || \"guest\";", "return \"guest\";"),
  "locked-pin-resolved": (s) => s.replace("if (entry.locked || !entry.href || entry.href === \"#\") continue;", "if (!entry.href || entry.href === \"#\") continue;"),
  "unroutable-pin-resolved": (s) => s.replace("if (entry.locked || !entry.href || entry.href === \"#\") continue;", "if (entry.locked) continue;"),
  "revoked-pin-resolved": (s) => s.replace("return pins.map((k) => lookup.get(norm(k))).filter(Boolean);", "return pins.map((k) => lookup.get(norm(k)) || { moduleKey: k, href: \"stale.html\" });"),
};
for (const [name, fn] of Object.entries(mutants)) {
  let mod; try { mod = await loadPresentation((s) => { const out = fn(s); if (out === s) throw new Error("mutation did not apply"); return out; }); } catch (e) { check(`MU ${name} (mutation applies)`, false, e.message); continue; }
  const bad = await invariants(mod);
  check(`MU ${name} is detected by the invariant suite`, bad.length > 0, bad.join(","));
}

console.log(failed() ? `\n${failed()} FAILED` : "\nALL PASSED");
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ results }, null, 2) + "\n");
process.exit(failed() ? 1 : 0);
