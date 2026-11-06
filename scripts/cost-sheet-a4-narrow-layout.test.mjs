// CS-A4-LEFT-CLIP regression: the 210mm printable Cost Sheet inside the modal must keep its LEFT edge reachable at narrow widths
// (flex + justify-content:center pushes overflow to the unscrollable left). Real Chromium, real page, inert backend, static content.
// Fails closed: if Chromium is unavailable this test FAILS (a skip would not be evidence).
import test from "node:test";
import assert from "node:assert/strict";
import { launchAudit, openAuditPage } from "./costing-responsive/responsive-audit.mjs";

let env;
test.before(async () => { env = await launchAudit(); });
test.after(async () => { await env?.close(); });

// The real sheet has wide min-content (letterhead, nowrap figures), so a flex item cannot shrink below ~700px. min-width reproduces that.
const ROWS = Array.from({ length: 12 }, (_, i) => `<tr><td style="min-width:700px">Component ${i}</td><td>${i}.00</td></tr>`).join("");
async function measure(width, lines = ROWS) {
  const { context, page } = await openAuditPage(env, "shared/cost-sheet-review.html", { width });
  const m = await page.evaluate((html) => {
    const modal = document.getElementById("costSheetModal"); modal.classList.remove("hidden"); modal.setAttribute("aria-hidden", "false");
    const a4 = document.getElementById("costSheetA4"); a4.innerHTML = `<table><tbody>${html}</tbody></table>`;
    const wrap = document.getElementById("costSheetA4Wrap");
    const r = a4.getBoundingClientRect(), w = wrap.getBoundingClientRect();
    wrap.scrollLeft = 0;
    return { a4Left: r.left, a4Width: r.width, wrapLeft: w.left, wrapWidth: w.width, scrollable: wrap.scrollWidth > wrap.clientWidth, docOverflow: document.documentElement.scrollWidth - window.innerWidth, overflowX: getComputedStyle(wrap).overflowX };
  }, lines);
  await context.close();
  return m;
}

test("this test needs Chromium (no skip)", () => assert.ok(env, "Playwright/Chromium must be available"));

for (const width of [320, 390, 520, 768]) {
  test(`${width}px: sheet left edge is not clipped, wrapper scrolls horizontally, page does not overflow`, async () => {
    const m = await measure(width);
    assert.ok(m.a4Width > m.wrapWidth, "premise: the 210mm sheet is wider than the container at " + width);
    assert.ok(m.a4Left >= m.wrapLeft - 0.5, `A4 left edge ${m.a4Left} is left of the wrapper ${m.wrapLeft}: unreachable content`);
    assert.ok(m.scrollable && /auto|scroll/.test(m.overflowX));
    assert.ok(m.docOverflow <= 1, "document overflow " + m.docOverflow);
  });
}

test("wide viewport: sheet stays horizontally centred", async () => {
  const m = await measure(1400);
  assert.ok(m.a4Width < m.wrapWidth);
  const leftGap = m.a4Left - m.wrapLeft, rightGap = m.wrapLeft + m.wrapWidth - (m.a4Left + m.a4Width);
  assert.ok(Math.abs(leftGap - rightGap) <= 20, `centred within tolerance (left ${leftGap}, right ${rightGap})`);
});

test("negative control: the pre-fix CSS (flex + justify-content:center, no margin) IS clipped, so this test can fail", async () => {
  const { context, page } = await openAuditPage(env, "shared/cost-sheet-review.html", { width: 390 });
  const left = await page.evaluate(() => {
    document.getElementById("costSheetModal").classList.remove("hidden");
    const st = document.createElement("style"); st.textContent = ".cost-sheet-a4-wrap{justify-content:center!important}.cost-sheet-a4{margin:0!important}"; document.head.append(st);
    const a4 = document.getElementById("costSheetA4"); a4.innerHTML = '<div style="min-width:700px">x</div>';
    return a4.getBoundingClientRect().left - document.getElementById("costSheetA4Wrap").getBoundingClientRect().left;
  });
  await context.close();
  assert.ok(left < -50, "pre-fix layout must clip on the left, got " + left);
});
