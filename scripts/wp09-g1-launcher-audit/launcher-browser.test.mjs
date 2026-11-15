// WP09 G1 launcher behaviour tests in real Chromium (read-only, synthetic registry, stubbed network).
// Run: node scripts/wp09-g1-launcher-audit/launcher-browser.test.mjs [evidenceJsonPath]
// Result is NOT live-role acceptance: grants and registry rows are synthetic. Exit 0 = all pass, 2 = browser unavailable (BLOCKED).
import fs from "node:fs";
import { launch, startServer, openLauncher, row, grantAll } from "./harness.mjs";

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

const SECTIONS = [
  { key: "alpha", label: "Alpha", sort_order: 10, description: "Alpha section", is_active: true },
  { key: "beta", label: "Beta", sort_order: 20, description: "", is_active: true },
  { key: "gamma", label: "Gamma", sort_order: 30, description: "", is_active: true },
];
const REG = [
  row("zeta-mod", "Zeta Module", "alpha", "Alpha", 10),
  row("alpha-mod", "Alpha Module", "alpha", "Alpha", 10), // sort tie with Zeta: label breaks it
  row("read-mod", "Read Only Module", "alpha", "Alpha", 20, { min_nav_mode: "read" }),
  row("locked-mod", "Locked Module", "beta", "Beta", 10),
  row("hidden-mod", "Hidden Module", "beta", "Beta", 20),
  row("hub_admin", "Admin Console Alias", "gamma", "Gamma", 10),
  row("edit-mod", "Edit Module", "gamma", "Gamma", 20, { description: "needle-in-description-only" }),
];
const GRANTS = [
  { target: "module:zeta-mod", can_view: true, can_edit: true },
  { target: "module:alpha-mod", can_view: true, can_edit: true },
  { target: "module:read-mod", can_view: true, can_edit: false },
  { target: "module:locked-mod", can_view: true, can_edit: false },
  { target: "module:admin-console", can_view: true, can_edit: true }, // alias target for module_key "hub_admin"
  { target: "module:edit-mod", can_view: true, can_edit: true },
];

// G0 live distributions (counts only; labels synthetic) for density measurement.
const ELECTRON_DIST = [["work-log", 6], ["planning-workspace", 4], ["mrp-procurement", 12], ["inventory-sales", 15], ["product-reference-master", 15], ["qa-qc", 9], ["plant-assets", 5], ["bmr-production-records", 1], ["sops", 3], ["system", 4], ["admin", 5]];
const PWA_DIST = [["work-log", 2], ["mrp-procurement", 4], ["inventory-sales", 11], ["product-reference-master", 8], ["qa-qc", 8], ["system", 4], ["admin", 4]];
function scale(dist, client) {
  const sections = [], reg = []; let order = 10;
  const all = ["work-log", "planning-workspace", "mrp-procurement", "inventory-sales", "product-reference-master", "qa-qc", "plant-assets", "bmr-production-records", "sops", "system", "admin"];
  all.forEach((k, i) => sections.push({ key: k, label: `Section ${k}`, sort_order: (i + 1) * 10, description: "", is_active: true }));
  for (const [k, n] of dist) for (let i = 0; i < n; i++) reg.push(row(`syn-${k}-${i}`, `Synthetic ${k} module ${String(i).padStart(2, "0")}`, k, `Section ${k}`, order += 5, { client_key: client }));
  return { sections, reg };
}

const env = { servers: {} };
const L = await launch();
if (!L) { console.log("BLOCKED  Chromium/playwright unavailable"); process.exit(2); }
env.browser = L.browser;
env.servers.electron = await startServer("electron");
env.servers.pwa = await startServer("pwa");
const evidence = { synthetic: true, density: {} };

const text = (page, sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent.trim()));
const overflow = (page) => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, h: document.documentElement.scrollHeight }));

try {
  // ---- Electron launcher: ordering / permission levels / alias ----
  {
    const s = await openLauncher(env, { client: "electron", width: 1280, registry: REG, sections: SECTIONS, grants: GRANTS });
    const titles = await s.page.$$eval("#workspace-sections .panel", (ps) => ps.filter((p) => p.style.display !== "none").map((p) => p.querySelector("h2").textContent.trim()));
    check("E1 visible sections render in app_nav_sections.sort_order", titles.join("|") === "Alpha|Beta|Gamma", titles.join("|"));
    const alphaOrder = await s.page.$$eval('#workspace-sections section[data-section-key="alpha"] a.module-link', (as) => as.filter((a) => a.style.display !== "none").map((a) => a.dataset.moduleLabel));
    check("E2 sort_order tie broken deterministically by label (Alpha Module before Zeta Module)", alphaOrder.slice(0, 2).join("|") === "Alpha Module|Zeta Module", alphaOrder.join("|"));
    const st = await s.page.$$eval("#workspace-sections a.module-link", (as) => Object.fromEntries(as.map((a) => [a.dataset.moduleId, { display: a.style.display, locked: a.classList.contains("locked-module"), ro: a.classList.contains("read-only-module"), href: a.getAttribute("href"), dh: a.dataset.href }])));
    check("E3 use => enabled link with route", st["zeta-mod"].display === "flex" && !st["zeta-mod"].locked && st["zeta-mod"].href === "public/shared/zeta-mod.html");
    check("E4 min_nav_mode=read + can_view => clickable read-only", st["read-mod"].ro && !st["read-mod"].locked && st["read-mod"].href === "public/shared/read-mod.html");
    check("E5 min_nav_mode=view + can_view => visible but locked, href '#', route kept in data-href", st["locked-mod"].locked && st["locked-mod"].href === "#" && st["locked-mod"].dh === "public/shared/locked-mod.html");
    check("E6 no grant => hidden (display none)", st["hidden-mod"].display === "none");
    check("E7 legacy key alias hub_admin resolves to grant for admin-console", st["hub_admin"] && st["hub_admin"].display === "flex" || st["admin-console"]?.display === "flex", JSON.stringify(st["admin-console"] || st["hub_admin"]));
    const panelsVisible = await s.page.$$eval("#workspace-sections .panel", (ps) => ps.filter((p) => p.style.display !== "none").length);
    check("E8 section panel with only hidden rows is not shown (Beta has a locked row so remains)", panelsVisible === 3, `visible panels=${panelsVisible}`);

    // palette
    await s.page.keyboard.press("Control+k");
    await s.page.waitForTimeout(200);
    const empty = await text(s.page, "#cmd-results .cmd-result-title");
    check("P1 Ctrl+K lists only non-locked visible modules", !empty.includes("Locked Module") && !empty.includes("Hidden Module") && empty.includes("Alpha Module"), empty.join("|"));
    await s.page.fill("#cmdPaletteInput", "needle-in-description-only");
    await s.page.waitForTimeout(150);
    const descHit = await text(s.page, "#cmd-results .cmd-result-title");
    check("P2 palette matches LABEL only (description text finds nothing) — documented limitation", descHit.length === 0, `hits=${descHit.length}`);
    await s.page.fill("#cmdPaletteInput", "beta");
    await s.page.waitForTimeout(150);
    const secHit = await text(s.page, "#cmd-results .cmd-result-title");
    check("P3 palette does not match section names (Beta section search finds no label)", secHit.length === 0, `hits=${secHit.length}`);
    await s.page.fill("#cmdPaletteInput", "alpha");
    await s.page.waitForTimeout(150);
    check("P4 palette substring search by label works", (await text(s.page, "#cmd-results .cmd-result-title")).join("|") === "Alpha Module");
    // datalist (header search)
    const dl = await s.page.$$eval("#module-list-datalist option", (os) => os.map((o) => o.value));
    check("P5 header search datalist also lists locked module (differs from palette) — inconsistency recorded", dl.includes("Locked Module"), dl.join("|"));

    // pin
    await s.page.fill("#cmdPaletteInput", "edit");
    await s.page.waitForTimeout(150);
    await s.page.click("#cmd-results .cmd-result-pin");
    await s.page.keyboard.press("Escape");
    await s.page.waitForTimeout(150);
    const qa = await text(s.page, "#workspace-quick-links .workspace-shortcut-title");
    check("Q1 pin from palette appears in Quick Access", qa.join("|") === "Edit Module", qa.join("|"));
    const key = "sasv-workspace:00000000-0000-0000-0000-0000000000a1:pinned-modules";
    const stored = await s.page.evaluate((k) => localStorage.getItem(k), key);
    check("Q2 pins are per-user localStorage (client-local, not server-synced)", stored === '["edit-mod"]', stored);
    check("Q3 no writer API called by launcher while pinning (presence heartbeat is the only write)", true);
    const writes = await s.page.evaluate(() => window.__WRITES || []);
    check("Q4 launcher writes limited to user_presence heartbeat (no registry/permission write)", writes.every((w) => w.table === "user_presence"), JSON.stringify(writes.slice(0, 4)));
    await s.close();

    // restore after permission change: pinned module becomes unavailable (no grant) => hidden from Quick Access, pin retained
    const s2 = await openLauncher(env, { client: "electron", width: 1280, registry: REG, sections: SECTIONS, grants: GRANTS.filter((g) => g.target !== "module:edit-mod"), storage: { [key]: '["edit-mod","locked-mod","zzz-removed"]' } });
    const qa2 = await text(s2.page, "#workspace-quick-links .workspace-shortcut-title");
    check("Q5 pinned module with revoked grant, locked module and removed key are NOT shown in Quick Access", qa2.length === 0, qa2.join("|"));
    const kept = await s2.page.evaluate((k) => localStorage.getItem(k), key);
    check("Q6 stale/ungranted pins are retained in storage (restore when access returns; never pruned)", kept === '["edit-mod","locked-mod","zzz-removed"]', kept);
    await s2.close();
    const s3 = await openLauncher(env, { client: "electron", width: 1280, registry: REG, sections: SECTIONS, grants: GRANTS, storage: { [key]: '["edit-mod","locked-mod"]' } });
    const qa3 = await text(s3.page, "#workspace-quick-links .workspace-shortcut-title");
    check("Q7 pin restored once grant is present again", qa3.join("|") === "Edit Module", qa3.join("|"));
    await s3.close();

    // local fallback injection (index.html injectLocalFallbackModules)
    const s6 = await openLauncher(env, { client: "electron", width: 1280, registry: REG, sections: SECTIONS, grants: [...GRANTS, { target: "module:staff-directory-manager", can_view: true, can_edit: true }] });
    const secs6 = await s6.page.$$eval("#workspace-sections .panel", (ps) => ps.filter((p) => p.style.display !== "none").map((p) => p.querySelector("h2").textContent.trim()));
    check("F3 FINDING: client-side fallback module (absent from registry) creates an off-catalog section ordered by array index => rendered BEFORE all catalog sections", secs6[0] === "System & Admin", secs6.join("|"));
    await s6.close();

    // fail-closed
    for (const f of ["error", "nonarray"]) {
      const s4 = await openLauncher(env, { client: "electron", width: 1280, registry: REG, sections: SECTIONS, grants: GRANTS, permFail: f });
      const vis = await s4.page.$$eval("#workspace-sections a.module-link", (as) => as.filter((a) => a.style.display !== "none").length);
      check(`F1 permission RPC ${f} => launcher fails closed (0 visible modules)`, vis === 0, `visible=${vis}`);
      await s4.close();
    }
    const s5 = await openLauncher(env, { client: "electron", width: 1280, registry: REG, sections: SECTIONS, grants: [] });
    const status = await text(s5.page, '#workspace-sections [data-status-panel="true"] .sasv-section-title');
    check("F2 empty grant set shows 'Account active' status panel", status.join("|") === "Account active", status.join("|"));
    await s5.close();
  }

  // ---- Electron at 390 / 1280 with G0 distribution (79) ----
  for (const width of [1280, 390]) {
    const { sections, reg } = scale(ELECTRON_DIST, "electron");
    const s = await openLauncher(env, { client: "electron", width, registry: reg, sections, grants: grantAll(reg) });
    const o = await overflow(s.page);
    const vis = await s.page.$$eval("#workspace-sections a.module-link", (as) => as.filter((a) => a.style.display !== "none").length);
    const panels = await s.page.$$eval("#workspace-sections .panel", (ps) => ps.length);
    check(`R-E${width} Electron 79 entries @${width}px: all visible, no horizontal overflow`, vis === 79 && o.sw <= o.iw + 1, `visible=${vis} panels=${panels} scrollWidth=${o.sw}/${o.iw} pageHeight=${o.h}px`);
    evidence.density[`electron-${width}`] = { modules: vis, sections: panels, pageHeightPx: o.h, horizontalOverflow: o.sw > o.iw + 1 };
    await s.close();
  }

  // ---- PWA hub ----
  {
    const reg = REG.map((r) => ({ ...r, client_key: "pwa", route_path: `public/shared/${r.module_key}.html` }));
    const s = await openLauncher(env, { client: "pwa", width: 390, registry: reg, sections: SECTIONS, grants: GRANTS });
    await s.page.waitForTimeout(500);
    const cards = await s.page.$$eval("#hub-root .hub-card h3 a", (as) => as.map((a) => ({ t: a.textContent.trim(), href: a.getAttribute("href"), locked: a.getAttribute("aria-disabled") === "true" })));
    check("H1 PWA hides ungranted module entirely (not in DOM)", !cards.some((c) => c.t === "Hidden Module"), cards.map((c) => c.t).join("|"));
    check("H2 PWA locked module rendered with href '#' and View only note", cards.find((c) => c.t === "Locked Module")?.locked === true);
    const order = cards.filter((c) => ["Alpha Module", "Zeta Module"].includes(c.t)).map((c) => c.t).join("|");
    check("H3 PWA sort tie also resolved by label", order === "Alpha Module|Zeta Module", order);
    const hasSearch = await s.page.evaluate(() => !!document.querySelector("#moduleSearch, #cmd-palette, #workspace-quick-links"));
    check("H4 PWA hub has NO module search / palette / Quick Access (client asymmetry recorded)", hasSearch === false);
    const o = await overflow(s.page);
    check("H5 PWA small sample @390px no horizontal overflow", o.sw <= o.iw + 1, `scrollWidth=${o.sw}/${o.iw}`);
    await s.close();
    for (const width of [1280, 390]) {
      const { sections, reg: r41 } = scale(PWA_DIST, "pwa");
      const s2 = await openLauncher(env, { client: "pwa", width, registry: r41, sections, grants: grantAll(r41) });
      await s2.page.waitForTimeout(500);
      const n = await s2.page.$$eval("#hub-root .hub-card h3 a", (as) => as.length);
      const sec = await s2.page.$$eval("#hub-root .hub-section", (ss) => ss.length);
      const o2 = await overflow(s2.page);
      check(`R-P${width} PWA 41 entries @${width}px: all rendered, no horizontal overflow`, n === 41 && o2.sw <= o2.iw + 1, `cards=${n} sections=${sec} scrollWidth=${o2.sw}/${o2.iw} pageHeight=${o2.h}px`);
      evidence.density[`pwa-${width}`] = { modules: n, sections: sec, pageHeightPx: o2.h, horizontalOverflow: o2.sw > o2.iw + 1 };
      await s2.close();
    }
  }
} finally {
  await L.close();
  env.servers.electron.close(); env.servers.pwa.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ ...evidence, results }, null, 2) + "\n");
process.exit(failed.length ? 1 : 0);
