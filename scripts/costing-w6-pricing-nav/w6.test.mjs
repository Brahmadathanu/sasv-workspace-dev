// WP06 W6: approved five-group presentation, legacy OFF compatibility, and business metadata parity.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stripW6PricingPolicy, stripW6 } from "../lib/w6-nav-strip.mjs";
import {
  resolvePricingPolicyW6Presentation,
  PRICING_POLICY_WORKSPACE_IDS,
  PRICING_POLICY_DEFAULT_WORKSPACE,
  PRICING_POLICY_COMPAT_AREA_DEFAULT_WORKSPACE,
} from "../../public/shared/js/costing-suite-pricing-policy.js";
import { COSTING_PPM_NAV_GROUP_CONTRACT } from "../../public/shared/js/costing-nav-groups.js";

const oldIds = ["sku-mrp-policies", "product-derivation-policies", "mrp-proposals", "proposal-decisions", "approved-for-application", "applied-proposal-history", "sku-overview", "scheme-master", "scheme-rule-register", "commercial-sales-assumptions"];
const expectedGroups = ["sku-policies", "mrp", "mrp-change-workflow", "schemes", "costing-inputs"];

test("W6 OFF preserves the complete legacy three-group workspace strip, order and identities", () => {
  const off = resolvePricingPolicyW6Presentation(false);
  assert.deepEqual(off.groups.map(x => x.id), ["mrp-policy-setup", "mrp-change-workflow", "selling-schemes"]);
  assert.deepEqual(off.workspaces.map(x => x.id), oldIds);
  assert.ok(off.workspaces.every(x => !Object.hasOwn(x, "legacyGroupId")));
  assert.equal(PRICING_POLICY_DEFAULT_WORKSPACE, "sku-overview");
  assert.deepEqual(PRICING_POLICY_COMPAT_AREA_DEFAULT_WORKSPACE, {
    "mrp-policies": "sku-mrp-policies",
    "mrp-workflow": "mrp-proposals",
    "selling-schemes": "sku-overview",
  });
  assert.deepEqual([...PRICING_POLICY_WORKSPACE_IDS].sort(), [...oldIds].sort());
});

test("W6 ON exactly consumes the five N1 groups and presents all ten workspaces once", () => {
  const on = resolvePricingPolicyW6Presentation(true);
  assert.deepEqual(on.groups.map(x => x.id), expectedGroups);
  assert.deepEqual(on.groups.map(x => x.label), COSTING_PPM_NAV_GROUP_CONTRACT.groups.map(x => x.label));
  // Node-version neutral grouping (Object.groupBy needs Node 21+).
  const byGroup = {};
  for (const entry of on.workspaces) (byGroup[entry.groupId] ||= []).push(entry);
  for (const group of COSTING_PPM_NAV_GROUP_CONTRACT.groups) {
    assert.deepEqual(byGroup[group.id].map(x => x.id), group.workspaceIds);
  }
  assert.deepEqual([...new Set(on.workspaces.map(x => x.id))].sort(), [...oldIds].sort());
});

test("W6 ON changes only display group/order, preserving all metadata and legacy identities", () => {
  const off = resolvePricingPolicyW6Presentation(false);
  const on = resolvePricingPolicyW6Presentation(true);
  const old = new Map(off.workspaces.map(x => [x.id,x]));
  for (const entry of on.workspaces) {
    const original = old.get(entry.id);
    assert.ok(original);
    assert.equal(entry.legacyGroupId, original.groupId);
    const {groupId,legacyGroupId,...rest} = entry;
    const {groupId:ignored,...originalRest} = original;
    assert.deepEqual(rest, originalRest);
  }
  assert.equal(on.workspaces.find(x=>x.id==="commercial-sales-assumptions").supportsPeriod,true);
  assert.deepEqual(on.workspaces.filter(x=>x.supportsPeriod).map(x=>x.id), ["commercial-sales-assumptions"]);
});

test("W6 flag input is boolean strict; non-true retains OFF metadata", () => {
  assert.deepEqual(resolvePricingPolicyW6Presentation("1").groups, resolvePricingPolicyW6Presentation(false).groups);
  assert.deepEqual(resolvePricingPolicyW6Presentation(null).workspaces, resolvePricingPolicyW6Presentation(false).workspaces);
});

// ---- derived exports and legacy inbound resolution: flag OFF vs ON, evaluated at module load in a child process ----
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MODULE_URL = new URL("../../public/shared/js/costing-suite-pricing-policy.js", import.meta.url).href;
function evaluateModule(flagValue) {
  const code = `
    globalThis.localStorage = { getItem: (k) => (k === "COSTING_NAV_GROUPS_V1" ? ${JSON.stringify(flagValue)} : null) };
    const m = await import(${JSON.stringify(MODULE_URL)});
    const q = [
      {}, { workspace: "scheme-rule-register" }, { workspace: "commercial-sales-assumptions" }, { workspace: "nope" },
      { lens: "mrp-governance" }, { lens: "mrp-governance", mrpTab: "mrp-proposals" }, { lens: "mrp-governance", mrpTab: "applied-proposal-history" },
      { lens: "policy-manager" }, { lens: "policy-manager", policyTab: "scheme-master" }, { lens: "policy-manager", policyTab: "commercial-sales-assumptions" },
      { lens: "mrp-policies" }, { lens: "mrp-workflow" }, { lens: "selling-schemes" }, { lens: "unknown-lens" },
    ];
    const tokens = ["mrp-policy-setup", "mrp-change-workflow", "selling-schemes", "mrp-policies", "mrp-workflow", "mrp-governance", "policy-manager", "sku-policies", "mrp", "schemes", "costing-inputs", "", "zzz"];
    const out = {
      tabs: m.MRP_GOVERNANCE_TABS, tabIds: m.MRP_GOVERNANCE_TAB_IDS, defaultTab: m.MRP_GOVERNANCE_DEFAULT_TAB,
      areaIds: m.PRICING_POLICY_AREA_IDS, areaDefaults: m.PRICING_POLICY_COMPAT_AREA_DEFAULT_WORKSPACE, defaultWorkspace: m.PRICING_POLICY_DEFAULT_WORKSPACE, defaultArea: m.PRICING_POLICY_DEFAULT_AREA,
      workspaceIds: m.PRICING_POLICY_WORKSPACE_IDS, lensIds: m.PRICING_POLICY_LENS_IDS,
      validation: m.validatePricingPolicyNavMetadata(),
      resolved: q.map((x) => m.resolvePricingPolicyLaunchNavigation(x)),
      canonical: q.map((x) => m.toCanonicalPricingPolicyRouteParams(x)),
      compat: tokens.map((t) => m.normalizePricingPolicyCompatArea(t)),
      // keyed by workspace id: list order legitimately differs between OFF and ON
      areaOf: Object.fromEntries(m.PRICING_POLICY_WORKSPACE_IDS.map((id) => [id, m.getPricingPolicyCompatAreaForWorkspace(id)])),
      legacyLens: Object.fromEntries(m.PRICING_POLICY_WORKSPACE_IDS.map((id) => [id, m.getLegacyLensForPricingPolicyWorkspace(id)])),
      meta: m.PRICING_POLICY_WORKSPACES.map(({ groupId, legacyGroupId, ...rest }) => rest),
      groups: m.PRICING_POLICY_NAV_GROUPS,
      order: m.PRICING_POLICY_WORKSPACES.map((w) => w.id),
    };
    console.log(JSON.stringify(out));
  `;
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", code], { encoding: "utf8", cwd: root }));
}
const OFF = evaluateModule(null);
const ON = evaluateModule("1");

test("module-load flag: only the exact string 1 turns the five-group presentation on", () => {
  assert.equal(OFF.groups.length, 3);
  assert.equal(ON.groups.length, 5);
  for (const v of ["0", "true", "on", " 1", "01", ""]) assert.equal(evaluateModule(v).groups.length, 3, JSON.stringify(v));
});

test("both modes validate their own navigation metadata with no errors", () => {
  assert.deepEqual(OFF.validation, []);
  assert.deepEqual(ON.validation, []);
});

test("legacy inbound resolution is identical ON and OFF (?lens=, ?workspace=, mrpTab/policyTab, Area aliases, defaults)", () => {
  assert.deepEqual(ON.resolved, OFF.resolved);
  assert.deepEqual(ON.canonical, OFF.canonical);
  assert.deepEqual(ON.compat, OFF.compat);
  assert.deepEqual(ON.areaOf, OFF.areaOf);
  assert.deepEqual(ON.legacyLens, OFF.legacyLens);
  assert.deepEqual(ON.areaIds, OFF.areaIds);
  assert.deepEqual(ON.areaDefaults, OFF.areaDefaults);
  assert.equal(ON.defaultWorkspace, OFF.defaultWorkspace);
  assert.equal(ON.defaultArea, OFF.defaultArea);
  assert.deepEqual(ON.workspaceIds.slice().sort(), OFF.workspaceIds.slice().sort());
  assert.deepEqual(ON.lensIds.slice().sort(), OFF.lensIds.slice().sort());
});

test("internal MRP governance tabs and selling classification are not corrupted by the new presentation group ids", () => {
  assert.deepEqual(ON.tabs, OFF.tabs);
  assert.deepEqual(ON.tabIds, OFF.tabIds);
  assert.equal(ON.defaultTab, OFF.defaultTab);
  assert.deepEqual(ON.tabIds, ["sku-mrp-policies", "product-derivation-policies", "mrp-proposals", "proposal-decisions", "approved-for-application", "applied-proposal-history"]);
});

test("ON presents identical per-workspace business metadata (capabilities, period scoping, labels) - only group and order differ", () => {
  const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.deepEqual(byId(ON.meta), byId(OFF.meta));
  assert.deepEqual(ON.meta.filter((w) => w.supportsPeriod).map((w) => w.id), ["commercial-sales-assumptions"]);
  assert.deepEqual(OFF.meta.filter((w) => w.supportsPeriod).map((w) => w.id), ["commercial-sales-assumptions"]);
  assert.notDeepEqual(ON.order, OFF.order, "ON follows the approved contract order");
  assert.deepEqual(ON.order, COSTING_PPM_NAV_GROUP_CONTRACT.groups.flatMap((g) => g.workspaceIds));
});

// ---- scope guards (explicit failure when history is unavailable: full history required, `git fetch --unshallow`) ----
// Permanent main commit after N1/N2/N3/N4 were merged (N4 squash #135).
const MAIN_BASE = "2ce8af0731afbb2bb0c998cf3074a3dec59b5a3c";
function gitOrFail(...args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    assert.fail(`W6 scope guard needs git history for ${MAIN_BASE} (shallow clone? run: git fetch --unshallow): ${String(err.message).split("\n")[0]}`);
  }
}

test("source: W6 adds no second navigation engine, new flag, RPC, storage, date or network code", () => {
  gitOrFail("cat-file", "-e", `${MAIN_BASE}^{commit}`);
  const diff = gitOrFail("diff", "-U0", MAIN_BASE, "--", "public/shared/js/costing-suite-pricing-policy.js");
  const added = diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).join("\n");
  assert.ok(added.length > 0);
  assert.doesNotMatch(added, /\.rpc\(|costingRpc|supabase|fetch\(|localStorage|sessionStorage|new Date|Date\.now|setItem/);
  assert.doesNotMatch(added, /COSTING_[A-Z_]+_V1/, "no new flag name");
  assert.deepEqual([...new Set(added.match(/is[A-Za-z]+V1Enabled/g) || [])], ["isCostingNavGroupsV1Enabled"], "only the existing N1 flag");
});

// Fixed, immutable W6 range (N4 merge .. W6 squash merge): later packages (e.g. U11) cannot widen or evade this guard.
const W6_MERGE = "d395d7e8031a28e56ea1b0997424932997a36636";
test("source: W6 changes only the PPM controller (plus tests and docs): shell, registry, route config, nav helpers, flags, CSS, HTML, SQL and cache are untouched", () => {
  gitOrFail("cat-file", "-e", `${MAIN_BASE}^{commit}`);
  gitOrFail("cat-file", "-e", `${W6_MERGE}^{commit}`);
  const changed = [...new Set(gitOrFail("diff", "--name-only", MAIN_BASE, W6_MERGE).split("\n").filter(Boolean))];
  assert.ok(changed.includes("public/shared/js/costing-suite-pricing-policy.js"));
  assert.deepEqual(changed.filter((f) => f.startsWith("public/")), ["public/shared/js/costing-suite-pricing-policy.js"]);
  assert.deepEqual(changed.filter((f) => /^(supabase|sql)\/|\.html$|sw\.js$|package(-lock)?\.json$/.test(f)), []);
});

// ---- the historical-pin strip helper removes exactly W6's additions and nothing else ----
const PPM_REL = "public/shared/js/costing-suite-pricing-policy.js";
const readPpm = () => fs.readFileSync(path.join(root, PPM_REL), "utf8").replace(/\r\n/g, "\n");
const baselinePpm = () => gitOrFail("show", `${MAIN_BASE}:${PPM_REL}`).replace(/\r\n/g, "\n");
/**
 * Narrow, exact post-W6 source exception for #303 Scheme History actor fix.
 * This does not alter the W6 strip helper or historical pin; unrelated edits
 * still fail the comparison. Fail if the expected two strings drift.
 */
function removeApprovedSchemeAuditActorFix(source) {
  const actorImport = 'import { formatSchemeMasterAuditActor } from "./costing-suite-scheme-audit-actor.mjs";\\n';
  const actorUsage = "text(formatSchemeMasterAuditActor(auditRow))";
  const previousUsage = "text(auditRow.actor || auditRow.event_actor || auditRow.created_by)";
  assert.equal(source.split(actorImport).length, 2, "exact Scheme actor import required once");
  assert.equal(source.split(actorUsage).length, 2, "exact Scheme actor renderer required once");
  return source.replace(actorImport, "").replace(actorUsage, previousUsage);
}


test("strip helper: removing the W6 additions from the controller reproduces the pre-W6 file exactly", () => {
  assert.notEqual(readPpm(), baselinePpm(), "W6 really changes the controller");
  // Frozen history: the controller's only sanctioned post-W6 change is PR #263 (31-column Scheme Master list projection).
  // The original pin (stripped W6 text == pre-W6 baseline) is kept exactly, but evaluated at the last pre-#263 revision;
  // the current controller is pinned to the #263 revision. Any later controller edit still fails here and must be reviewed (#264).
  const PRE_263 = "cf41740ec054dac7cabd1df343eb4b0b67d5bd60^";
  const POST_263 = "cf41740ec054dac7cabd1df343eb4b0b67d5bd60";
  const at = (rev) => gitOrFail("show", `${rev}:${PPM_REL}`).replace(/\r\n/g, "\n");
  assert.equal(stripW6PricingPolicy(at(PRE_263)), baselinePpm());
  assert.equal(stripW6PricingPolicy(removeApprovedSchemeAuditActorFix(readPpm())), stripW6PricingPolicy(at(POST_263)));
  assert.equal(stripW6(PPM_REL, removeApprovedSchemeAuditActorFix(readPpm())), stripW6PricingPolicy(at(POST_263)));
  assert.equal(stripW6PricingPolicy(baselinePpm()), baselinePpm(), "idempotent on the pre-W6 text");
  assert.equal(stripW6("public/shared/js/costing-suite-cost-build.js", "x"), "x", "other files are never touched");
});

// (Edits inside the W6 block itself are W6-owned and are covered by the W6 behaviour tests above, not by the historical pins.)
test("strip helper is not a blanket: any extra edit to the controller survives stripping and therefore fails the historical pin", () => {
  for (const tamper of [
    (t) => t + "\n// unrelated change\n",
    (t) => t.replace('export const PRICING_POLICY_DEFAULT_AREA = "selling-schemes";', 'export const PRICING_POLICY_DEFAULT_AREA = "mrp-policies";'),
    (t) => t.replace('export const MRP_GOVERNANCE_DEFAULT_TAB = "sku-mrp-policies";', 'export const MRP_GOVERNANCE_DEFAULT_TAB = "mrp-proposals";'),
  ]) {
    const tampered = tamper(readPpm());
    assert.notEqual(tampered, readPpm());
    assert.notEqual(stripW6PricingPolicy(tampered), baselinePpm());
  }
});
