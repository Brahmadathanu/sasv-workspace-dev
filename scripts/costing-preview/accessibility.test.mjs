// R4 accessibility gate (structural + keyboard) on the launcher and all six populated module pages, 1280px and 390px.
// Structural checks are deliberately strict because every page is rendered with data (not an empty shell).
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createReadOnlyLoopbackServer } from "./read-only-loopback-server.mjs";

const require = createRequire(import.meta.url);
const { chromium } = createRequire(import.meta.url)("playwright");
let server, browser, base;
test.before(async () => {
  server = await createReadOnlyLoopbackServer();
  base = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({ args: ["--no-sandbox"] });
});
test.after(async () => { await browser?.close(); await new Promise((r) => server?.close(r)); });

const PAGES = ["/__preview/", "/shared/costing-control-center.html?lens=sku-control-status", "/shared/material-cost-manager.html", "/shared/cost-build-manager.html",
  "/shared/pricing-policy-manager.html?workspace=sku-overview", "/shared/cost-sheet-review.html", "/shared/production-route-manager.html"];
const audit = () => ({
  lang: document.documentElement.lang, hasTitle: document.title.trim().length > 0, h1: document.querySelectorAll("h1").length,
  unnamedButtons: [...document.querySelectorAll("button")].filter((e) => e.offsetParent && !(e.innerText.trim() || e.getAttribute("aria-label") || e.title)).map((e) => e.id || e.className.toString().slice(0, 30)),
  unnamedFields: [...document.querySelectorAll("input:not([type=hidden]),select,textarea")].filter((e) => e.offsetParent && !(e.labels?.length || e.getAttribute("aria-label") || e.getAttribute("aria-labelledby") || e.title || e.placeholder)).map((e) => e.id || e.name || e.type),
  tablesWithoutHeaders: [...document.querySelectorAll("table")].filter((t) => t.offsetParent && !t.querySelector("th")).length,
  imagesWithoutAlt: [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).length,
  smallTargets: [...document.querySelectorAll("button, a[href], select, input:not([type=hidden])")].filter((e) => { const r = e.getBoundingClientRect(); return e.offsetParent && r.width > 0 && (r.width < 20 || r.height < 20) && e.type !== "checkbox" && e.type !== "radio"; }).map((e) => (e.id || e.className.toString().slice(0, 20)) + ":" + Math.round(e.getBoundingClientRect().width) + "x" + Math.round(e.getBoundingClientRect().height)),
});

for (const width of [1280, 390]) {
  test("structural accessibility holds on the launcher and all six pages at " + width + "px", async () => {
    const failures = [];
    for (const path of PAGES) {
      const context = await browser.newContext({ serviceWorkers: "block", viewport: { width, height: 900 } });
      const page = await context.newPage();
      await page.goto(base + path);
      await page.waitForTimeout(1500);
      const r = await page.evaluate(audit);
      if (r.lang !== "en") failures.push(path + ": html lang");
      if (!r.hasTitle) failures.push(path + ": title");
      if (r.h1 !== 1) failures.push(path + ": expected exactly one h1, saw " + r.h1);
      for (const key of ["unnamedButtons", "unnamedFields", "smallTargets"]) if (r[key].length) failures.push(path + ": " + key + " " + r[key].join(","));
      if (r.tablesWithoutHeaders) failures.push(path + ": table without header cells");
      if (r.imagesWithoutAlt) failures.push(path + ": image without alt");
      await context.close();
    }
    assert.deepEqual(failures, []);
  });
}

test("keyboard: Tab reaches the lens navigation and Enter/Space switches lens; focus is visibly indicated", async () => {
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(base + "/shared/cost-sheet-review.html");
  await page.waitForTimeout(1500);
  let reached = false;
  for (let i = 0; i < 30 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(() => document.activeElement?.dataset?.lens === "printable-cost-sheet");
  }
  assert.ok(reached, "printable-cost-sheet pill must be reachable by keyboard");
  const outline = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== "none" || s.boxShadow !== "none"; });
  assert.ok(outline, "focused lens needs a visible focus indicator");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);
  assert.match(await page.evaluate(() => document.body.innerText), /Sample Oil/);
  assert.equal(await page.evaluate(() => document.querySelector('button[data-lens="printable-cost-sheet"]').classList.contains("active")), true);
  await context.close();
});

test("launcher flags are real checkboxes operable by keyboard with accessible names", async () => {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  await page.goto(base + "/__preview/");
  const box = page.getByRole("checkbox", { name: "COSTING_DIALOGS_V1" });
  await box.focus();
  await page.keyboard.press("Space");
  assert.equal(await page.evaluate(() => localStorage.getItem("COSTING_DIALOGS_V1")), "1");
  assert.equal(await page.getByRole("checkbox").count(), 11);
  await context.close();
});
