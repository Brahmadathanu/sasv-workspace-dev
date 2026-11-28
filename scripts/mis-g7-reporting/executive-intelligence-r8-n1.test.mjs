import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, mkdirSync } from "node:fs";
import { openDashboard, startServer } from "../mis-c1/mis-harness.mjs";

const require = createRequire(import.meta.url);
const widths = [320, 375, 390, 414, 430, 768, 1440];
const screenshots = process.env.EI_N1_SCREENSHOTS;
if (screenshots) mkdirSync(screenshots, { recursive: true });

async function chartFits(chart) {
  const problems = await chart.evaluate((figure) => {
    const problems = [];
    const inside = (inner, outer) => {
      if (inner.left < outer.left - 1 || inner.right > outer.right + 1) {
        problems.push(`bounds: ${inner.left}–${inner.right} outside ${outer.left}–${outer.right}`);
      }
    };
    const figureBox = figure.getBoundingClientRect();
    const panel = document.getElementById("tabPanel");
    inside(figureBox, figure.parentElement.getBoundingClientRect());
    for (const el of [document.documentElement, document.body, panel, figure, ...figure.querySelectorAll(
      ".ei-chart-head, .ei-chart-title, .ei-asof, .ei-line-plot, .ei-cols, .ei-trend-stats, .ei-trend-stats li, .ei-trend-summary, .ei-bars-note, .ei-trend-values",
    )]) {
      if (el.clientWidth && el.scrollWidth > el.clientWidth + 1) problems.push(`scroll width: ${el.className} (${el.scrollWidth} > ${el.clientWidth})`);
      if (figure.contains(el) && el.getClientRects().length) inside(el.getBoundingClientRect(), figureBox);
    }
    const ticks = [...figure.querySelectorAll(".ei-col-label span")]
      .filter((el) => el.getClientRects().length);
    const labels = ticks.map((el) => el.getBoundingClientRect());
    for (const [i, label] of labels.entries()) {
      inside(label, figureBox);
      if (i && label.left < labels[i - 1].right) problems.push("overlapping month labels");
    }
    if (ticks.length < 2) problems.push("too few visible month labels");
    return problems;
  });
  assert.deepEqual(problems, []);
}

for (const engine of ["chromium", "webkit"]) {
  let browserType;
  if (process.env.MIS_C1_SKIP_BROWSER !== "1") {
    try { browserType = require("playwright")[engine]; } catch (error) {
      if (error.code !== "MODULE_NOT_FOUND") throw error;
    }
  }
  const available = browserType && existsSync(browserType.executablePath());
  test(`R8 N1 browser acceptance in ${engine}`, { skip: !available && `${engine} unavailable` }, async (t) => {
    const browser = await browserType.launch();
    const { base, server } = await startServer();
    t.after(async () => { await browser.close(); server.close(); });
    for (const theme of ["light", "dark"]) {
      for (const width of widths) {
        await t.test(`${theme} at ${width}px`, async (t) => {
          const { context, page } = await openDashboard(browser, base, {
            width, height: 900, lens: "overview", hasTouch: width <= 430,
            init: () => {
              window.__mis.handlers = {
                ei_sales_history: () => {
                  const rows = Array.from({ length: 12 }, (_, i) => ({
                    dimension_name: "All sales", month: `2026-${String(i + 1).padStart(2, "0")}-01`,
                    sales_value: i === 5 ? null : 12987654.32 + i * 100000,
                    source_reported_amount: 12987654.32 + i * 100000,
                    coverage: i === 5 ? "MISSING_OR_AMBIGUOUS_MEASURES" : "OBSERVED_NOT_CERTIFIED",
                  })).filter((_, i) => i !== 3);
                  return { data: { anchor: "2026-12-24", start_date: "2026-01-01", total: rows.length, rows }, error: null };
                },
              };
            },
          });
          t.after(() => context.close());
          page.setDefaultTimeout(6000);
          await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, theme);
          // SASV Core currently ships light tokens. Exercise dark surfaces by mapping
          // the shared legacy dark palette onto the semantic slots in this fixture.
          if (theme === "dark") await page.addStyleTag({ content: `
            html[data-theme="dark"] {
              color-scheme: dark;
              --sasv-bg: var(--bg-color);
              --sasv-surface: var(--panel-bg);
              --sasv-surface-elevated: var(--panel-bg);
              --sasv-surface-soft: var(--btn-bg);
              --sasv-text: var(--text-color);
              --sasv-text-secondary: var(--text-color);
              --sasv-text-muted: var(--muted);
              --sasv-divider: var(--table-divider);
              --sasv-border: var(--table-divider);
              --sasv-search-select-bg: var(--panel-bg);
              --sasv-action-primary: var(--sasv-primary-300);
            }
          ` });
          const selectLens = async (lens) => {
            const select = page.locator("#detailTabSelect");
            if (await select.isVisible()) await select.selectOption(lens);
            else await page.locator(`#detailTabs [data-tab="${lens}"]`).click();
          };
          const capture = async (locator, name) => {
            if (screenshots && engine === "chromium" && [320, 390, 1440].includes(width)) {
              await locator.screenshot({ path: `${screenshots}/${name}-${width}-${theme}.png` });
            }
          };
          const chart = page.locator(".ei-trend");
          for (const lens of ["overview", "history"]) {
            if (lens === "history") {
              await selectLens("sales");
              await page.locator('[data-sales-view="history"]').click();
            }
            await chart.waitFor();
            await chartFits(chart);
            assert.match(await chart.locator(".ei-asof").innerText(), /To 24 Dec 2026/);
            assert.equal(await chart.locator("svg [role=img]").count(), 12);
            assert.equal(await chart.locator(".ei-line-gap").count(), 2);
            assert.equal(await chart.locator(".ei-trend-stats li").count(), 3);
            const visible = await chart.locator(".ei-col-label span:visible").count();
            if (width <= 430) assert.ok(visible < 12, "dense axes show fewer labels");
            if (width === 1440) assert.equal(visible, 12, "wide charts show each month");
            await capture(chart, lens);
            await chart.locator("summary").click();
            const values = chart.locator(".ei-trend-values li");
            assert.equal(await values.count(), 12);
            assert.match(await values.first().innerText(), /1,29,87,654\.32/);
            await chartFits(chart);
          }

          await selectLens("finance");
          const trigger = page.locator("#financeAgeBtn");
          const dialog = page.getByRole("dialog", { name: "Ageing analysis" });
          const date = dialog.locator('input[type="date"]');
          await page.evaluate(() => {
            window.ageDateFocusEvents = 0;
            document.addEventListener("focusin", (event) => {
              if (event.target.id === "financeAgeAsOf") window.ageDateFocusEvents++;
            });
          });
          if (width <= 430) await trigger.tap();
          else await trigger.press("Enter");
          await dialog.waitFor();
          assert.ok(await dialog.getByRole("button", { name: "Close ageing settings" }).evaluate((el) => el === document.activeElement));
          assert.equal(await page.evaluate(() => window.ageDateFocusEvents), 0);
          await capture(dialog, "finance-ageing");
          await page.keyboard.press("Shift+Tab");
          assert.ok(await dialog.getByRole("button", { name: "Apply ageing" }).evaluate((el) => el === document.activeElement));
          await page.keyboard.press("Tab");
          assert.ok(await dialog.getByRole("button", { name: "Close ageing settings" }).evaluate((el) => el === document.activeElement));
          await page.keyboard.press("Escape");
          await dialog.waitFor({ state: "hidden" });
          assert.ok(await trigger.evaluate((el) => el === document.activeElement));
          if (width <= 430) await trigger.tap();
          else await trigger.press("Enter");
          if (width <= 430) await date.tap();
          else await page.keyboard.press("Tab");
          assert.ok(await date.evaluate((el) => el === document.activeElement));
          assert.equal(await page.evaluate(() => window.ageDateFocusEvents), 1);
          const enterAllowed = await date.evaluate((el) => el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));
          assert.ok(enterAllowed, "native date-field Enter behavior is available");
          await date.fill("2026-12-15");
          assert.equal(await date.inputValue(), "2026-12-15");
        });
      }
    }
  });
}
