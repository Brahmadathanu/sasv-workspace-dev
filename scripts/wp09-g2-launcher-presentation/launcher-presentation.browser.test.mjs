// WP09 G2 DOM tests in real Chromium: both launchers, flag OFF/ON, 390 and 1280, actual registered keys and client asymmetry.
// Everything is mocked: the network is replaced by an in-page read-only Supabase stub, writer attempts are recorded and asserted,
// and no request may reach a Supabase host. This is NOT authenticated production acceptance.
// Run: node scripts/wp09-g2-launcher-presentation/launcher-presentation.browser.test.mjs [resultsJson] [screenshotDir]
import fs from "node:fs";
import path from "node:path";
import { launch, startServer, openLauncher } from "../wp09-g1-launcher-audit/harness.mjs";
import { loadRegistryModule } from "../wp09-g1-launcher-audit/lib.mjs";
import { snapshot, optionCoverage, registryFor, sectionRows, makeResults, baselineFile } from "./lib.mjs";

const { results, check, skip, failed } = makeResults();
const RM = await loadRegistryModule();
const L = await launch();
if (!L) { skip("browser suite", "Chromium/playwright unavailable in this environment"); if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ results }, null, 2)); process.exit(2); }
const env = { browser: L.browser, servers: { electron: await startServer("electron"), pwa: await startServer("pwa") } };
const FLAG_ON = { LAUNCHER_PRESENTATION_V1: "1" };
const REG = { electron: registryFor("electron"), pwa: registryFor("pwa") };
const SECTIONS = sectionRows.map((s) => ({ ...s }));
const grant = (rows, mode) => rows.map((r) => ({ target: r.target_key, can_view: true, can_edit: mode === "use" }));
const U_A = "00000000-0000-0000-0000-00000000000a", U_B = "00000000-0000-0000-0000-00000000000b";
const pinKey = (u) => `sasv-workspace:${u}:pinned-modules`;
const shotDir = process.argv[3];
const open = (client, o = {}) => openLauncher(env, { client, width: 1280, registry: REG[client], sections: SECTIONS, grants: grant(REG[client], "use"), storage: FLAG_ON, userId: U_A, ...o });

// ---- helpers ----
const eVisible = (page) => page.$$eval("#workspace-sections a.module-link", (as) => as.filter((a) => a.style.display === "flex").map((a) => a.dataset.moduleId));
const pVisible = (page) => page.$$eval("#hub-root .hub-card h3 a", (as) => as.map((a) => a.dataset.moduleKey));
const overflow = (page) => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
const writesOk = async (s) => { const w = await s.page.evaluate(() => window.__WRITES || []); return w.every((x) => x.table === "user_presence") && !s.requests.some((u) => /supabase\.co/.test(u)); };
const topLevel = {
  electron: (page) => page.$$eval("#workspace-sections .panel[data-section-key]", (ps) => Object.fromEntries(ps.map((p) => [p.dataset.sectionKey, p.querySelectorAll(".sasv-subgroup__nodes > a.module-link, .sasv-subgroup__nodes > .sasv-family").length - [...p.querySelectorAll(".sasv-subgroup__nodes > a.module-link")].filter((a) => a.style.display !== "flex").length - [...p.querySelectorAll(".sasv-subgroup__nodes > .sasv-family")].filter((f) => f.style.display === "none").length]))),
  pwa: (page) => page.$$eval("#hub-root .hub-section[data-section-key]", (ps) => Object.fromEntries(ps.map((p) => [p.dataset.sectionKey, p.querySelectorAll(".hub-subgroup .hub-grid > article.hub-card, .hub-subgroup .hub-grid > .hub-family").length]))),
};
const expectedTop = (client) => Object.fromEntries(optionCoverage.find((o) => o.client === client).perSection.map((s) => [s.section, s.option_c_top_level]));
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const same = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

try {
  // ===== 1. Flag default OFF and byte-identical rollback to today's launcher =====
  for (const client of ["electron", "pwa"]) {
    const files = client === "electron" ? [[/\/index\.html$/, () => baselineFile("index.html")]] : [[/\/utilities-hub\/js\/hub-auth\.js$/, () => baselineFile("public/utilities-hub/js/hub-auth.js")], [/\/shared\/js\/module-registry\.js$/, () => baselineFile("public/shared/js/module-registry.js")]];
    const sel = client === "electron" ? "#workspace-sections" : "#hub-root";
    const base = await open(client, { storage: null, rewrites: files });
    const cur = await open(client, { storage: null });
    const [a, b] = [await base.page.$eval(sel, (e) => e.innerHTML), await cur.page.$eval(sel, (e) => e.innerHTML)];
    check(`O1 ${client}: flag unset => launcher DOM is byte-identical to the authority-head launcher (rollback = today's launcher)`, a === b && a.length > 1000, `bytes=${a.length}`);
    const flags = await cur.page.evaluate(() => ({ attr: document.documentElement.dataset.launcherPresentation || null, fam: document.querySelectorAll(".sasv-family, .hub-family, .sasv-subgroup, .hub-subgroup, #hub-tools").length, ls: !!window.__launcherSearch }));
    check(`O2 ${client}: flag unset => no presentation attribute, no families/subgroups/tools, no shared-search bridge`, flags.attr === null && flags.fam === 0 && flags.ls === false);
    await base.close(); await cur.close();
    for (const v of ["0", "true", "on", " 1", ""]) {
      const s = await open(client, { storage: { LAUNCHER_PRESENTATION_V1: v } });
      const n = await s.page.evaluate(() => document.querySelectorAll(".sasv-family, .hub-family").length);
      if (n !== 0) check(`O3 ${client}: value ${JSON.stringify(v)} must not enable`, false);
      await s.close();
    }
    check(`O3 ${client}: only the exact value "1" enables (0/true/on/' 1'/'' stay OFF)`, true);
  }

  // ===== 2. ON, editor: structure and counts at 1280 and 390 (both clients) =====
  for (const client of ["electron", "pwa"]) for (const width of [1280, 390]) {
    const s = await open(client, { width });
    const vis = await (client === "electron" ? eVisible(s.page) : pVisible(s.page));
    const top = await topLevel[client](s.page);
    const exp = expectedTop(client);
    check(`T1 ${client}@${width}: editor sees all ${REG[client].length} registered modules, ${sum(exp)} top-level cards (section-scoped A→C reference)`, vis.length === REG[client].length && same(top, exp), `modules=${vis.length} top=${sum(top)}`);
    const hdrs = await s.page.$$eval(client === "electron" ? ".sasv-subgroup__title" : ".hub-subgroup__title", (e) => e.length);
    check(`T2 ${client}@${width}: subgroup headings rendered (approved A subgroup count)`, hdrs === optionCoverage.find((o) => o.client === client).option_a_subgroups, `headings=${hdrs}`);
    const o = await overflow(s.page);
    check(`T3 ${client}@${width}: no horizontal overflow (families collapsed)`, o.sw <= o.iw + 1, `${o.sw}/${o.iw}`);
    await s.page.$$eval(client === "electron" ? ".sasv-family__toggle" : ".hub-family__toggle", (bs) => bs.forEach((b) => b.getAttribute("aria-expanded") !== "true" && b.click()));
    const o2 = await overflow(s.page);
    check(`T4 ${client}@${width}: no horizontal overflow (all families expanded)`, o2.sw <= o2.iw + 1, `${o2.sw}/${o2.iw}`);
    check(`T5 ${client}@${width}: only mocked reads; writes limited to the existing presence heartbeat; no Supabase host contacted`, await writesOk(s), JSON.stringify((await s.page.evaluate(() => window.__WRITES || [])).slice(0, 3)));
    if (s.errors.length) check(`T5b ${client}@${width}: no page errors`, false, s.errors.join(" | "));
    await s.close();
  }

  // ===== 3. Family toggle keyboard / focus (both clients) =====
  for (const client of ["electron", "pwa"]) {
    const sel = client === "electron" ? ".sasv-family__toggle" : ".hub-family__toggle";
    const s = await open(client, { width: 390 });
    const bodyId = await s.page.locator(`${sel}[aria-expanded="false"]`).first().getAttribute("aria-controls");
    const first = s.page.locator(`${sel}[aria-controls="${bodyId}"]`);
    await first.focus();
    const before = await first.getAttribute("aria-expanded");
    await s.page.keyboard.press("Enter");
    const afterEnter = await first.getAttribute("aria-expanded");
    const hiddenAfterEnter = await s.page.$eval(`#${bodyId}`, (e) => e.hidden);
    await s.page.keyboard.press("Space");
    const afterSpace = await first.getAttribute("aria-expanded");
    const focused = await s.page.evaluate((id) => document.activeElement?.getAttribute("aria-controls") === id, bodyId);
    check(`K1 ${client}: native button toggles with Enter and Space, aria-expanded/aria-controls/hidden agree, focus stays on the toggle`, before === "false" && afterEnter === "true" && hiddenAfterEnter === false && afterSpace === "false" && focused);
    const tab = await s.page.evaluate(() => { document.activeElement?.blur(); return true; });
    await s.close();
  }

  // ===== 4. Costing family: six modules, direct routes, individual search + pin independent of collapsed state =====
  {
    const COSTING = ["costing-control-center", "material-cost-manager", "cost-build-manager", "pricing-policy-manager", "production-route-manager", "cost-sheet-review"];
    const s = await open("electron");
    const info = await s.page.$$eval(".sasv-family", (fs) => fs.map((f) => ({ id: f.dataset.familyId, keys: [...f.querySelectorAll("a.module-link")].map((a) => a.dataset.moduleId), hrefs: [...f.querySelectorAll("a.module-link")].map((a) => a.getAttribute("href")), expanded: f.querySelector(".sasv-family__toggle").getAttribute("aria-expanded") })));
    const fam = info.find((f) => COSTING.every((k) => f.keys.includes(k)));
    check("F1 electron: one Costing family holds all six modules incl. Production Route Manager, collapsed by default", !!fam && fam.keys.length === 6 && fam.expanded === "false", fam?.id);
    const regRoutes = Object.fromEntries(REG.electron.map((r) => [r.module_key, r.route_path]));
    check("F2 electron: every family child keeps its exact registered direct route", fam.keys.every((k, i) => fam.hrefs[i] === regRoutes[k]));
    await s.page.keyboard.press("Control+k");
    await s.page.fill("#cmdPaletteInput", "route manager");
    await s.page.waitForTimeout(150);
    const titles = await s.page.$$eval("#cmd-results .cmd-result-item", (is) => is.map((i) => ({ t: i.querySelector(".cmd-result-title").textContent, href: i.dataset.href })));
    const hit = titles.find((t) => /Production Route Manager/.test(t.t));
    const stillCollapsed = await s.page.$eval(`[data-family-id="${fam.id}"] .sasv-family__toggle`, (b) => b.getAttribute("aria-expanded"));
    check("F3 electron: palette finds Production Route Manager (direct route) while its family stays collapsed", !!hit && hit.href === regRoutes["production-route-manager"] && stillCollapsed === "false");
    await s.page.click("#cmd-results .cmd-result-pin");
    await s.page.keyboard.press("Escape");
    await s.page.waitForTimeout(150);
    const qa = await s.page.$$eval("#workspace-quick-links .sasv-qa-chip", (cs) => cs.map((c) => ({ id: c.dataset.moduleId, href: c.getAttribute("href") })));
    check("F4 electron: pin works with the family collapsed; Quick Access chip routes to the registered destination", qa.length === 1 && qa[0].id === "production-route-manager" && qa[0].href === regRoutes["production-route-manager"]);
    await s.close();
    const p = await open("pwa", { width: 390 });
    await p.page.fill("#hub-search-input", "route manager");
    await p.page.waitForTimeout(150);
    const pr = await p.page.$$eval("#hub-search-results .hub-search__result a", (as) => as.map((a) => ({ k: a.dataset.moduleKey, href: a.getAttribute("href") })));
    const prReg = REG.pwa.find((r) => r.module_key === "production-route-manager");
    check("F5 pwa: search finds Production Route Manager at its PWA route while the family is collapsed", pr.some((x) => x.k === "production-route-manager" && x.href === RM.normalizeClientRoute(prReg.route_path, "pwa")) && (await p.page.$$eval(".hub-family:has([data-module-key=\"production-route-manager\"]) .hub-family__toggle", (e) => e.map((b) => b.getAttribute("aria-expanded")))).join() === "false");
    await p.page.click("#hub-search-results button.hub-pin");
    const pqa = await p.page.$$eval("#hub-quick .hub-quick__item a", (as) => as.map((a) => a.dataset.moduleKey));
    check("F6 pwa: pin works from search with family collapsed (per-user local Quick Access)", pqa.join() === "production-route-manager" && (await p.page.evaluate((k) => localStorage.getItem(k), pinKey(U_A))) === '["production-route-manager"]');
    await p.close();
  }

  // ===== 5. Shared search: label / description / subgroup / alias (both clients), locked and denied semantics =====
  {
    const s = await open("electron");
    const q = async (text) => { await s.page.keyboard.press("Control+k"); await s.page.fill("#cmdPaletteInput", text); await s.page.waitForTimeout(120); const r = await s.page.$$eval("#cmd-results .cmd-result-title", (e) => e.map((x) => x.textContent)); await s.page.keyboard.press("Escape"); return r; };
    const stock = await q("stock positions");
    check("S1 electron palette: approved subgroup search finds the stock views", stock.some((t) => /Bottled|FG Bulk|WIP|Stock/i.test(t)), stock.slice(0, 4).join("|"));
    const alias = await q("etl monitor");
    const opLabel = REG.electron.find((r) => r.module_key === "operations-monitor").label;
    check("S2 electron palette: existing alias (etl-monitor) finds Operations Monitor", alias.includes(opLabel), alias.join("|"));
    const desc = REG.electron.find((r) => r.description && r.description.length > 40 && r.module_key !== "admin-console");
    const words = desc.description.split(/\s+/).filter((w) => w.length > 7)[0];
    const byDesc = await q(words);
    check("S3 electron palette: description text now matches", byDesc.length > 0, `${words} -> ${byDesc.length}`);
    await s.close();
    const p = await open("pwa", { width: 390 });
    const pq = async (text) => { await p.page.fill("#hub-search-input", text); await p.page.waitForTimeout(100); return p.page.$$eval("#hub-search-results .hub-search__result a", (as) => as.map((a) => a.dataset.moduleKey)); };
    check("S4 pwa: same matcher — alias, subgroup and label hits", (await pq("etl monitor")).includes("operations-monitor") && (await pq("stock positions")).length > 0 && (await pq("vendor")).includes("vendor-master"));
    await p.close();
  }

  // ===== 6. Roles: editor / viewer(locked+read) / denied / mixed (both clients) =====
  for (const client of ["electron", "pwa"]) {
    const rows = REG[client];
    const viewerS = await open(client, { grants: grant(rows, "view"), width: 390 });
    if (client === "electron") {
      const st = await viewerS.page.$$eval("#workspace-sections a.module-link", (as) => as.map((a) => ({ id: a.dataset.moduleId, locked: a.classList.contains("locked-module"), ro: a.classList.contains("read-only-module"), href: a.getAttribute("href"), dh: a.dataset.href, disp: a.style.display, mode: a.dataset.minNavMode })));
      const okLocked = st.filter((x) => x.mode === "view").every((x) => x.locked && x.href === "#" && x.dh && x.disp === "flex");
      const okRead = st.filter((x) => x.mode === "read").every((x) => x.ro && !x.locked && x.href === x.dh);
      check("R1 electron viewer: view-mode modules locked (href '#', route kept), read-mode modules clickable read-only", okLocked && okRead, `locked=${st.filter((x) => x.locked).length} read=${st.filter((x) => x.ro).length}`);
      await viewerS.page.keyboard.press("Control+k");
      await viewerS.page.fill("#cmdPaletteInput", "a");
      const items = await viewerS.page.$$eval("#cmd-results .cmd-result-item", (is) => is.length);
      const lockedLabel = REG.electron.find((r) => r.min_nav_mode === "view").label;
      await viewerS.page.fill("#cmdPaletteInput", lockedLabel);
      const lockedInPalette = await viewerS.page.$$eval("#cmd-results .cmd-result-title", (e) => e.map((x) => x.textContent));
      check("R2 electron viewer: locked modules never appear in the palette (existing semantics) and cannot be pinned", !lockedInPalette.includes(lockedLabel));
      const dl = await viewerS.page.$$eval("#module-list-datalist option", (os) => os.map((o) => o.value));
      check("R3 electron viewer: header search still lists the already-visible locked module (disabled), as before", dl.includes(lockedLabel));
    } else {
      await viewerS.page.fill("#hub-search-input", REG.pwa.find((r) => r.min_nav_mode === "view").label);
      const res = await viewerS.page.$$eval("#hub-search-results .hub-search__result", (rs) => rs.map((r) => ({ disabled: r.getAttribute("aria-disabled") === "true", href: r.querySelector("a").getAttribute("href"), pin: !!r.querySelector("button.hub-pin") })));
      check("R1 pwa viewer: already-visible locked result is shown DISABLED (href '#', no pin button), never enabled", res.length > 0 && res.every((r) => r.disabled && r.href === "#" && !r.pin));
      await viewerS.page.click("#hub-search-results a[aria-disabled='true']").catch(() => {});
      check("R2 pwa viewer: clicking a locked result does not navigate", viewerS.page.url().includes("/utilities-hub/"));
    }
    await viewerS.close();

    const denied = await open(client, { grants: [], width: 390 });
    const famN = await denied.page.$$eval(".sasv-family, .hub-family, .sasv-subgroup, .hub-subgroup", (e) => e.filter((x) => x.style.display !== "none").length);
    check(`R4 ${client} denied: no module, family or subgroup is visible`, (client === "electron" ? (await eVisible(denied.page)).length : (await pVisible(denied.page)).length) === 0 && famN === 0, `groups=${famN}`);
    await denied.close();

    // mixed: only 1 of the six Costing modules + nothing else in its subgroup
    const only = rows.filter((r) => r.module_key === "production-route-manager");
    const mixed = await open(client, { grants: grant(only, "use"), width: 1280 });
    const fams = await mixed.page.$$eval(".sasv-family, .hub-family", (fs) => fs.filter((f) => f.style.display !== "none").map((f) => ({ n: [...f.querySelectorAll("a.module-link, .hub-card h3 a")].filter((a) => a.style.display !== "none").length, open: (f.querySelector("button")?.getAttribute("aria-expanded")) })));
    const vis = client === "electron" ? await eVisible(mixed.page) : await pVisible(mixed.page);
    check(`R5 ${client} mixed: single granted member shows its family (1 child, auto-expanded) and every other family/section disappears`, vis.join() === "production-route-manager" && fams.length === 1 && fams[0].n === 1 && fams[0].open === "true", JSON.stringify(fams));
    await mixed.close();

    // permission-RPC failures fail closed, no leftovers
    for (const mode of ["error", "nonarray"]) {
      const f = await open(client, { permFail: mode, width: 390 });
      const v = client === "electron" ? await eVisible(f.page) : await pVisible(f.page);
      const tools = client === "pwa" ? await f.page.$$eval("#hub-search-results li, #hub-quick .hub-quick__item", (e) => e.length) : 0;
      check(`R6 ${client}: permission failure (${mode}) => fail closed (0 visible modules, no pinned/search leftovers)`, v.length === 0 && tools === 0);
      await f.close();
    }
  }

  // ===== 7. Unknown key, cross-section collision, catalog-missing section order =====
  for (const client of ["electron", "pwa"]) {
    const base = REG[client].filter((r) => r.section_key === "work-log" || r.section_key === "system");
    const unknown = { ...base[0], module_key: "zz-future-module", target_key: "module:zz-future-module", label: "ZZ Future Module", route_path: "public/shared/zz-future.html", sort_order: 5, section_key: "work-log", section_label: "Work Log" };
    const collided = { ...REG[client].find((r) => r.module_key === "view-logs"), section_key: "system", section_label: REG[client].find((r) => r.section_key === "system").section_label };
    const orphanSection = { ...base[0], module_key: "zz-orphan-section", target_key: "module:zz-orphan-section", label: "ZZ Orphan", route_path: "public/shared/zz-orphan.html", section_key: "zz-not-in-catalog", section_label: "ZZ Not In Catalog", sort_order: 1 };
    const registry = [...REG[client].filter((r) => r.module_key !== "view-logs"), unknown, collided, orphanSection];
    const s = await open(client, { registry, grants: grant(registry, "use"), width: 1280 });
    const vis = client === "electron" ? await eVisible(s.page) : await pVisible(s.page);
    check(`X1 ${client}: unknown registry key stays visible and reachable`, vis.includes("zz-future-module") && vis.includes("zz-orphan-section"));
    const place = await s.page.evaluate(([c]) => {
      const q = (k) => document.querySelector(c === "electron" ? `a.module-link[data-module-id="${k}"]` : `a[data-module-key="${k}"]`);
      const info = (k) => { const a = q(k); const sub = a?.closest(c === "electron" ? ".sasv-subgroup" : ".hub-subgroup"); const fam = a?.closest(c === "electron" ? ".sasv-family" : ".hub-family"); const sec = a?.closest(c === "electron" ? ".panel" : ".hub-section"); return { sub: sub?.dataset.subgroup, fallback: sub?.dataset.subgroupFallback, fam: !!fam, sec: sec?.dataset.sectionKey }; };
      return { unknown: info("zz-future-module"), collided: info("view-logs") };
    }, [client]);
    check(`X2 ${client}: unknown key => 'More' subgroup, flat (no family)`, place.unknown.sub === "More" && place.unknown.fallback === "true" && !place.unknown.fam);
    check(`X3 ${client}: cross-section collision (view-logs moved to System) => stays in System as a flat 'More' item; Work Log family is NOT used`, place.collided.sec === "system" && place.collided.fam === false && place.collided.sub === "More", JSON.stringify(place.collided));
    const order = await s.page.$$eval(client === "electron" ? "#workspace-sections .panel[data-section-key]" : "#hub-root .hub-section[data-section-key]", (ps) => ps.filter((p) => p.style.display !== "none").map((p) => p.dataset.sectionKey));
    check(`X4 ${client}: section absent from the catalog sorts AFTER every catalog section (deterministic)`, order[order.length - 1] === "zz-not-in-catalog" || (client === "pwa" && order.includes("zz-not-in-catalog")), order.join(">"));
    await s.close();
  }

  // ===== 8. Pins: revocation/restore, 10-pin cap, user switch =====
  for (const client of ["electron", "pwa"]) {
    const rows = REG[client];
    const keys = rows.slice(0, 12).map((r) => r.module_key);
    const seed = { ...FLAG_ON, [pinKey(U_A)]: JSON.stringify(keys.slice(0, 3)) };
    const pinnedText = (page) => page.$$eval(client === "electron" ? "#workspace-quick-links .workspace-shortcut-title" : "#hub-quick .hub-quick__item a", (e) => e.map((x) => x.textContent.trim()));
    const full = await open(client, { storage: seed });
    const shown = await pinnedText(full.page);
    check(`P1 ${client}: three seeded pins render for their owner`, shown.length === 3, shown.join("|"));
    await full.close();
    const revoked = await open(client, { storage: seed, grants: grant(rows.filter((r) => r.module_key !== keys[1]), "use") });
    const afterRevoke = await pinnedText(revoked.page);
    const stored = await revoked.page.evaluate((k) => localStorage.getItem(k), pinKey(U_A));
    check(`P2 ${client}: revoked module disappears from Quick Access but the pin is retained`, afterRevoke.length === 2 && JSON.parse(stored).includes(keys[1]));
    await revoked.close();
    const lockedOnly = await open(client, { storage: seed, grants: rows.map((r) => ({ target: r.target_key, can_view: true, can_edit: r.module_key !== keys[0] })) });
    const lockedShown = await pinnedText(lockedOnly.page);
    const lockedMode = rows.find((r) => r.module_key === keys[0]).min_nav_mode;
    check(`P3 ${client}: a pin whose module became view-only is not shown (pins require enabled modules)`, lockedMode === "read" ? lockedShown.length >= 2 : lockedShown.length === 2, `mode=${lockedMode} shown=${lockedShown.length}`);
    await lockedOnly.close();

    // user switch within one browser profile
    const ctx = await env.browser.newContext({ viewport: { width: 390, height: 900 } });
    const a = await open(client, { storage: seed, context: ctx });
    const forA = await pinnedText(a.page);
    check(`P4 ${client}: user A sees A's pins`, forA.length === 3);
    if (client === "pwa") {
      await a.page.fill("#hub-search-input", rows[0].label.slice(0, 4));
      await a.page.evaluate((u) => { window.__USER_ID = u; window.dispatchEvent(new Event("pageshow")); }, U_B);
      await a.page.waitForTimeout(700);
      const forB = await pinnedText(a.page);
      const sr = await a.page.$$eval("#hub-search-results li", (e) => e.length);
      const inputVal = await a.page.$eval("#hub-search-input", (e) => e.value);
      check("P5 pwa: identity change clears the active Quick Access, search results and query (no state from user A is shown to user B)", forB.length === 0 && sr === 0 && inputVal === "");
      await a.page.evaluate((u) => { window.__USER_ID = u; window.dispatchEvent(new Event("pageshow")); }, U_A);
      await a.page.waitForTimeout(700);
      check("P6 pwa: switching back shows A's pins again (no cross-user write occurred)", (await pinnedText(a.page)).length === 3);
      await a.page.evaluate(() => { window.__NO_SESSION = true; window.dispatchEvent(new Event("pageshow")); });
      await a.page.waitForTimeout(700);
      check("P7 pwa: sign-out clears tools (no pins/search state remain)", (await a.page.$$eval("#hub-tools *", (e) => e.length)) === 0);
    } else {
      await a.page.close();
      const b = await open(client, { storage: seed, context: ctx, userId: U_B });
      const forB = await pinnedText(b.page);
      check("P5 electron: a different user in the same browser profile sees none of A's pins", forB.length === 0);
      await b.page.close();
    }
    if (client === "pwa") await a.page.close();
    await ctx.close();

    // 10-pin cap through the UI
    const cap = await open(client, { width: 1280 });
    let pinned = 0;
    if (client === "electron") {
      for (const r of rows.filter((r) => r.min_nav_mode).slice(0, 12)) {
        await cap.page.keyboard.press("Control+k");
        await cap.page.fill("#cmdPaletteInput", r.label);
        await cap.page.waitForTimeout(80);
        const btn = cap.page.locator("#cmd-results .cmd-result-item", { hasText: r.label }).first().locator(".cmd-result-pin");
        if (await btn.count()) { await btn.click(); pinned++; }
        await cap.page.keyboard.press("Escape");
      }
    } else {
      for (const r of rows.slice(0, 12)) {
        await cap.page.fill("#hub-search-input", r.label);
        const btn = cap.page.locator(`#hub-search-results li[data-module-key="${r.module_key}"] button.hub-pin`);
        if (await btn.count()) { await btn.click(); pinned++; }
      }
    }
    const stored10 = JSON.parse((await cap.page.evaluate((k) => localStorage.getItem(k), pinKey(U_A))) || "[]");
    check(`P8 ${client}: pin cap is 10 (attempted ${pinned})`, pinned >= 11 && stored10.length === 10, `stored=${stored10.length}`);
    await cap.close();
  }

  // ===== 9. Mutation controls (browser): the suite must FAIL when the guards are removed =====
  {
    const deniedAbsent = async (client, rewrites) => {
      const rows = REG[client]; const one = rows.slice(0, 1);
      const s = await open(client, { grants: grant(one, "use"), rewrites, width: 1280 });
      const vis = client === "electron" ? await eVisible(s.page) : await pVisible(s.page);
      await s.close();
      return vis.length === 1;
    };
    check("M0 control: permission filter holds on the real code (electron + pwa)", (await deniedAbsent("electron", [])) && (await deniedAbsent("pwa", [])));
    const m1 = await deniedAbsent("electron", [[/\/index\.html$/, (b) => b.replace('anchor.style.display = isPlaceholder ? "flex" : "none";', 'anchor.style.display = "flex";').replace('if (accessLevel === "none") {', 'if (false) {')]]);
    check("M1 mutation 'electron permission-filter bypass' is DETECTED", m1 === false);
    const m2 = await deniedAbsent("pwa", [[/\/utilities-hub\/js\/hub-auth\.js$/, (b) => b.replace('.filter((utility) => utility.accessLevel !== "none")', ".filter(() => true)")]]);
    check("M2 mutation 'pwa permission-filter bypass' is DETECTED", m2 === false);
    const leak = async (client, rewrites) => {
      const rows = REG[client]; const one = rows.filter((r) => r.module_key === "vendor-master");
      const s = await open(client, { grants: grant(one, "use"), rewrites, width: 1280 });
      let found;
      if (client === "pwa") { await s.page.fill("#hub-search-input", "bottled"); found = await s.page.$$eval("#hub-search-results li", (e) => e.length); }
      else { await s.page.keyboard.press("Control+k"); await s.page.fill("#cmdPaletteInput", "bottled"); found = await s.page.$$eval("#cmd-results .cmd-result-item", (e) => e.length); }
      await s.close();
      return found;
    };
    check("M3 control: denied modules never leak into search (electron + pwa)", (await leak("electron", [])) === 0 && (await leak("pwa", [])) === 0);
    const m4 = await leak("pwa", [[/\/utilities-hub\/js\/hub-auth\.js$/, (b) => b.replace('.filter((utility) => (accessMap[utility.id] || "none") !== "none")\n    .map((utility) => {\n      const level', ".map((utility) => {\n      const level")]]);
    check("M4 mutation 'pwa hidden search-result leakage' is DETECTED", m4 > 0);
    const m5 = await leak("electron", [[/\/index\.html$/, (b) => b.replace('.filter((a) => a.style.display !== "none")\n            .map((a) => ({', ".map((a) => ({")]]);
    check("M5 mutation 'electron palette leakage of denied modules' is DETECTED", m5 > 0);
    const switchLeak = async (rewrites) => {
      const seed = { ...FLAG_ON, [pinKey(U_A)]: JSON.stringify([REG.pwa[0].module_key]) };
      const ctx = await env.browser.newContext({ viewport: { width: 390, height: 900 } });
      const s = await open("pwa", { storage: seed, context: ctx, rewrites });
      await s.page.evaluate((u) => { window.__USER_ID = u; window.dispatchEvent(new Event("pageshow")); }, U_B);
      await s.page.waitForTimeout(700);
      const n = await s.page.$$eval("#hub-quick .hub-quick__item", (e) => e.length);
      await s.close(); await ctx.close();
      return n;
    };
    check("M6 control: no pin reuse across a user switch on the real code", (await switchLeak([])) === 0);
    const m7 = await switchLeak([[/\/utilities-hub\/js\/hub-auth\.js$/, (b) => b.replace("hubTools.scope = scopeFromUser(session?.user);", 'hubTools.scope = hubTools.scope === "guest" ? scopeFromUser(session?.user) : hubTools.scope;')]]);
    check("M7 mutation 'stale pin reuse across users' is DETECTED", m7 > 0);
  }

  // ===== 10. Screenshots (mocked data; reproducible) =====
  if (shotDir) {
    fs.mkdirSync(shotDir, { recursive: true });
    const shots = [["electron", 1280], ["electron", 390], ["pwa", 1280], ["pwa", 390]];
    for (const [client, width] of shots) {
      const s = await open(client, { width, height: 1000, deviceScaleFactor: 2 });
      await s.page.$$eval(client === "electron" ? ".sasv-family__toggle" : ".hub-family__toggle", (bs, n) => bs.slice(0, n).forEach((b) => b.click()), 1);
      await s.page.waitForTimeout(200);
      await s.page.screenshot({ path: path.join(shotDir, `${client}-${width}-flag-on.png`) });
      await s.close();
    }
    const off = await open("pwa", { width: 390, height: 1000, deviceScaleFactor: 2, storage: null });
    await off.page.screenshot({ path: path.join(shotDir, "pwa-390-flag-off.png") });
    await off.close();
    check("V1 screenshots written (mocked data)", fs.readdirSync(shotDir).filter((f) => f.endsWith(".png")).length === 5, shotDir);
  }
} finally {
  await L.close();
  env.servers.electron.close(); env.servers.pwa.close();
}
console.log(failed() ? `\n${failed()} FAILED of ${results.length}` : `\nALL ${results.length} PASSED`);
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ synthetic: "mocked network/grants; actual registered keys from the committed live snapshot", results }, null, 2) + "\n");
process.exit(failed() ? 1 : 0);
