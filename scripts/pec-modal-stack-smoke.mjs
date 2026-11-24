#!/usr/bin/env node
/**
 * PEC-UX-01 acceptance: nested-modal stacking and Escape dismissal in a REAL browser
 * against the REAL shared module (synthetic Supabase stub only; see
 * scripts/lib/pec-ui-harness.mjs). Not signed-in operational acceptance.
 *
 * Covers: every ordered pair of PEC dialogs (visual order == Escape order), real
 * Recommend & Accept flow with state/focus preservation, held-key and repeated
 * Escape, rapid open/close, protected dialogs, dynamically created dialogs,
 * drawer/menu precedence, IME composition, three-level unwinding, and no
 * business mutation.
 */
import { startHarness } from "./lib/pec-ui-harness.mjs";

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.error("FAIL:", msg); } else console.log("ok  :", msg); };
const VP = { width: 1440, height: 900 };
const h = await startHarness();

const shown = (page) => page.evaluate(() =>
  [...document.querySelectorAll(".modal-backdrop.show")].map((e) => e.id));
const esc = async (page) => { await page.keyboard.press("Escape"); await page.waitForTimeout(40); };

// ── 1. every ordered pair: what is visually on top is what Escape closes ────────────
{
  const { ctx, page, errors } = await h.open({ role: "edit", indentDate: true }, VP);
  // vendorAliasMapModalBackdrop is an unreachable template (no opener, no close control in the app).
  const ids = (await page.evaluate(() => [...document.querySelectorAll(".modal-backdrop")].map((e) => e.id)))
    .filter((id) => id !== "vendorAliasMapModalBackdrop");
  // Existing, intentional parent->child cleanup in the dialogs' own closers: closing the
  // PARENT while its owned child is (artificially, below it) open dismisses both.
  // In the app the child is always above its parent, so Escape reaches it first.
  const OWNED_CHILD_CLEANUP = new Set([
    "ccfPreviewModalBackdrop>prViewModalBackdrop",
    "s4ReviewModalBackdrop>generatePrModalBackdrop",
    "indPlanModalBackdrop>generatePrModalBackdrop",
  ]);
  let pairs = 0, bad = [];
  for (const a of ids) {
    for (const b of ids) {
      if (a === b) continue;
      pairs++;
      // opened one after the other, as a user does (never in the same task)
      await page.evaluate((x) => document.getElementById(x).classList.add("show"), a);
      await page.evaluate((y) => document.getElementById(y).classList.add("show"), b);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
      const visualTop = await page.evaluate(([x, y]) => {
        const zi = (id) => Number(getComputedStyle(document.getElementById(id)).zIndex);
        return zi(y) > zi(x);
      }, [a, b]);
      await esc(page);
      const afterOne = await shown(page);
      await esc(page);
      const afterTwo = await shown(page);
      const cascade = OWNED_CHILD_CLEANUP.has(`${a}>${b}`);
      if (!visualTop || (cascade ? afterOne.length : afterOne.join() !== a) || afterTwo.length) bad.push(`${a}>${b}:${visualTop}/${afterOne}/${afterTwo}`);
      // reset any leftovers (e.g. a closer that refused)
      await page.evaluate(() => document.querySelectorAll(".modal-backdrop.show").forEach((e) => e.classList.remove("show")));
    }
  }
  check(bad.length === 0, `all ${pairs} ordered dialog pairs: later-opened dialog is visually on top and is the only one Escape closes (${bad.slice(0, 4).join(" | ")})`);
  check(errors.length === 0, `pair sweep produced no browser errors ${errors.slice(0, 2).join("|")}`);
  const leftoverZ = await page.evaluate(() => [...document.querySelectorAll(".modal-backdrop")].filter((e) => e.style.zIndex).length);
  check(leftoverZ === 0, "closed dialogs carry no inline z-index");
  await ctx.close();
}

// ── 2. real flow: Recommend & Accept over the full-page indent modal ─────────────────
{
  const { ctx, page, errors } = await h.open({ role: "edit", indentDate: true }, VP);
  await h.openIndentModal(page, VP);
  const titleBefore = await page.locator("#indentViewModalBackdrop h3").first().innerText();
  await page.fill("#iSearch", "abc");
  await page.evaluate(() => { document.querySelector("#indentViewModalBackdrop .modal")?.scrollTo?.(0, 0); });
  await page.click("#btnIndentRecommendAcceptVendors");
  await page.waitForSelector("#vendorAcceptModeModalBackdrop.show");
  check((await shown(page)).join() === "indentViewModalBackdrop,vendorAcceptModeModalBackdrop", "Recommend dialog stacks above the indent modal");
  const def = await page.evaluate(() => document.querySelector('input[name="vendorAcceptMode"]:checked')?.value);
  check(def === "false", "default choice unchanged (clear inactive recommendations only)");
  await esc(page);
  check((await shown(page)).join() === "indentViewModalBackdrop", "ONE Escape closes only the Recommend dialog; indent modal stays open");
  const focus = await page.evaluate(() => document.activeElement?.id);
  check(focus === "btnIndentRecommendAcceptVendors", `focus returns to the initiating control (${focus})`);
  check((await page.inputValue("#iSearch")) === "abc", "indent modal search state preserved");
  check((await page.locator("#indentViewModalBackdrop h3").first().innerText()) === titleBefore, "selected indent preserved");
  await esc(page);
  check((await shown(page)).length === 0, "second Escape closes the indent modal");
  check(errors.length === 0, `no browser errors ${errors.join("|")}`);
  await ctx.close();
}

// ── 3. held key, repeated and rapid presses ──────────────────────────────────────────
{
  const { ctx, page } = await h.open({ role: "edit", indentDate: true }, VP);
  await h.openIndentModal(page, VP);
  await page.click("#btnIndentRecommendAcceptVendors");
  await page.waitForSelector("#vendorAcceptModeModalBackdrop.show");
  for (let i = 0; i < 6; i++) await page.keyboard.down("Escape"); // 1 press + 5 auto-repeat
  await page.keyboard.up("Escape");
  await page.waitForTimeout(60);
  check((await shown(page)).join() === "indentViewModalBackdrop", "held Escape (auto-repeat) dismisses exactly one layer");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(40);
  check((await shown(page)).length === 0, "a fresh press afterwards dismisses the next layer");

  // three-level stack unwinds one level per press
  await h.openIndentModal(page, VP);
  await page.evaluate(() => {
    document.getElementById("indentActionModalBackdrop").classList.add("show");
    document.getElementById("stockPickerModalBackdrop").classList.add("show");
  });
  await page.waitForTimeout(30);
  const seq = [];
  for (let i = 0; i < 3; i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(30); seq.push((await shown(page)).length); }
  check(seq.join() === "2,1,0", `three-level stack unwinds one level per press (${seq})`);

  // two quick distinct presses = two layers (state is consistent between them)
  await h.openIndentModal(page, VP);
  await page.click("#btnIndentRecommendAcceptVendors");
  await page.waitForSelector("#vendorAcceptModeModalBackdrop.show");
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
  await page.waitForTimeout(80);
  check((await shown(page)).length === 0, "two rapid distinct presses close two layers, no more, no fewer");

  // rapid open/close churn then Escape
  for (let i = 0; i < 25; i++) {
    await page.evaluate(() => {
      const el = document.getElementById("indentActionModalBackdrop");
      el.classList.add("show"); el.classList.remove("show"); el.classList.add("show");
    });
    if (i % 2) await page.evaluate(() => document.getElementById("indentActionModalBackdrop").classList.remove("show"));
  }
  await page.evaluate(() => document.getElementById("indentActionModalBackdrop").classList.add("show"));
  await esc(page);
  const afterChurn = await shown(page);
  check(afterChurn.join() === "" || !afterChurn.includes("indentActionModalBackdrop"), `after open/close churn Escape still closes the top dialog (${afterChurn})`);
  await ctx.close();
}

// ── 4. protected, dynamic, IME ───────────────────────────────────────────────────────
{
  const { ctx, page } = await h.open({ role: "edit", indentDate: true }, VP);
  await h.openIndentModal(page, VP);
  // protected top dialog consumes Escape without closing anything underneath
  await page.evaluate(() => {
    const el = document.getElementById("hardDeleteModalBackdrop");
    el.dataset.pecEscape = "protect"; el.classList.add("show");
  });
  await page.waitForTimeout(30);
  await esc(page);
  check((await shown(page)).join() === "indentViewModalBackdrop,hardDeleteModalBackdrop", "protected top dialog consumes Escape; nothing underneath closes");
  await page.evaluate(() => { const el = document.getElementById("hardDeleteModalBackdrop"); delete el.dataset.pecEscape; el.classList.remove("show"); });

  // dynamically created dialog (no registered closer) is dismissed through its own close control
  await page.evaluate(() => {
    const b = document.createElement("div");
    b.className = "modal-backdrop show"; b.id = "dynTestBackdrop";
    b.innerHTML = '<div class="modal"><button class="modal-close-btn" type="button" aria-label="Close">x</button></div>';
    b.querySelector("button").addEventListener("click", () => b.remove());
    document.body.appendChild(b);
  });
  await page.waitForTimeout(30);
  const dynZ = await page.evaluate(() => Number(document.getElementById("dynTestBackdrop").style.zIndex));
  check(dynZ > 9000, `dynamic dialog joins the stack with an assigned z-index (${dynZ})`);
  await esc(page);
  check((await shown(page)).join() === "indentViewModalBackdrop", "Escape dismisses the dynamic dialog only");

  // IME composition never dismisses
  await page.evaluate(() => document.getElementById("indentActionModalBackdrop").classList.add("show"));
  await page.waitForTimeout(30);
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", isComposing: true, bubbles: true })));
  check((await shown(page)).includes("indentActionModalBackdrop"), "Escape during IME composition is ignored");
  await page.evaluate(() => document.getElementById("indentActionModalBackdrop").classList.remove("show"));
  await ctx.close();
}

// ── 5. drawers / menus follow the visual layer ───────────────────────────────────────
{
  const { ctx, page } = await h.open({ role: "edit", indentDate: true }, VP);
  await h.openIndentModal(page, VP);
  await page.click("#iLineFilterBtn");
  await page.waitForSelector("#iLineFilterDrawer.open", { timeout: 2000 }).catch(() => {});
  const drawerOpen = await page.evaluate(() => document.getElementById("iLineFilterDrawer")?.classList.contains("open"));
  check(drawerOpen, "line filter drawer opens inside the indent modal");
  // a dialog above the indent modal takes Escape before the (lower) drawer
  await page.evaluate(() => document.getElementById("indentActionModalBackdrop").classList.add("show"));
  await page.waitForTimeout(30);
  await esc(page);
  let st = await page.evaluate(() => ({
    drawer: document.getElementById("iLineFilterDrawer").classList.contains("open"),
    action: document.getElementById("indentActionModalBackdrop").classList.contains("show"),
    indent: document.getElementById("indentViewModalBackdrop").classList.contains("show"),
  }));
  check(!st.action && st.drawer && st.indent, `dialog above takes Escape first; lower drawer and indent modal untouched (${JSON.stringify(st)})`);
  await esc(page);
  st = await page.evaluate(() => ({
    drawer: document.getElementById("iLineFilterDrawer").classList.contains("open"),
    indent: document.getElementById("indentViewModalBackdrop").classList.contains("show"),
  }));
  check(!st.drawer && st.indent, "next Escape closes the drawer, not the indent modal");
  await esc(page);
  check((await shown(page)).length === 0, "next Escape closes the indent modal");
  // export menu inside the modal
  await h.openIndentModal(page, VP);
  await page.click("#btnIExportMenu");
  const menuOpen = await page.evaluate(() => !!document.querySelector(".export-menu.open"));
  await esc(page);
  const menuAfter = await page.evaluate(() => ({ menu: !!document.querySelector(".export-menu.open"), indent: document.getElementById("indentViewModalBackdrop").classList.contains("show") }));
  check(menuOpen && !menuAfter.menu && menuAfter.indent, "Escape closes the export menu first, indent modal stays");
  await ctx.close();
}

// ── 6. Escape never performs a business action ──────────────────────────────────────
{
  const { ctx, page } = await h.open({ role: "edit", indentDate: true }, VP);
  await h.openIndentModal(page, VP);
  await page.click("#btnIndentRecommendAcceptVendors");
  await page.waitForSelector("#vendorAcceptModeModalBackdrop.show");
  await esc(page); await esc(page);
  const writes = await page.evaluate(() => (globalThis.__rpcNames || []).filter((n) => /accept|recommend|issue|clear|delete|set_|apply|update|create|close|resync/i.test(n)));
  check(writes.length === 0, `Escape sequences invoked no mutating RPC (${writes.join(",")})`);
  await ctx.close();
}


// ── 7. review hardening ──────────────────────────────────────────────────────────────
{
  // 7.1 several dialogs opened synchronously in ONE task, in reverse DOM order:
  //     actual open order wins, DOM order must not.
  const { ctx, page } = await h.open({ role: "edit", indentDate: true }, VP);
  const dom = await page.evaluate(() => [...document.querySelectorAll(".modal-backdrop")].map((e) => e.id));
  const A = "indentActionModalBackdrop", B = "vendorModalBackdrop", C = "indentViewModalBackdrop";
  check(dom.indexOf(B) < dom.indexOf(A) && dom.indexOf(C) < dom.indexOf(B), "fixture: B precedes A, C precedes B in the DOM");
  await page.evaluate(([a, b, c]) => {
    for (const id of [a, b, c]) document.getElementById(id).classList.add("show"); // one synchronous turn
  }, [A, B, C]);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  const z = await page.evaluate((ids) => ids.map((id) => Number(getComputedStyle(document.getElementById(id)).zIndex)), [A, B, C]);
  check(z[0] < z[1] && z[1] < z[2], `same-turn opens keep open order, not DOM order (z ${z})`);
  const seqS = [];
  for (let i = 0; i < 3; i++) { await esc(page); seqS.push((await shown(page)).join("+")); }
  check(seqS.join(" | ") === `${B}+${A} | ${A} | `, `Escape unwinds in reverse OPEN order (${seqS.join(" | ")})`);
  // same-turn churn: A open, B open, A closed, A re-opened => A is now on top
  await page.evaluate(([a, b]) => {
    const A_ = document.getElementById(a), B_ = document.getElementById(b);
    A_.classList.add("show"); B_.classList.add("show"); A_.classList.remove("show"); A_.classList.add("show");
  }, [A, B]);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  await esc(page);
  check((await shown(page)).join() === B, "re-opened dialog is on top of the dialog opened in between (same turn)");
  await page.evaluate(() => document.querySelectorAll(".modal-backdrop.show").forEach((e) => e.classList.remove("show")));
  await ctx.close();
}
{
  // 7.2 focus restoration when the focused element stays in the DOM but is no longer visible
  const { ctx, page } = await h.open({ role: "edit", indentDate: true }, VP);
  await h.openIndentModal(page, VP);
  await page.focus("#btnIndentRecommendAcceptVendors");
  await page.click("#btnIndentRecommendAcceptVendors");
  await page.waitForSelector("#vendorAcceptModeModalBackdrop.show");
  const r = await page.evaluate(async () => {
    const inside = document.querySelector('#vendorAcceptModeModalBackdrop input[name="vendorAcceptMode"]');
    inside.focus();
    // a closer that hides the dialog and does NOT move focus (the element stays attached, invisible)
    document.getElementById("vendorAcceptModeModalBackdrop").classList.remove("show");
    await Promise.resolve(); await Promise.resolve();
    const sync = document.activeElement?.id || document.activeElement?.tagName;
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    return { sync, later: document.activeElement?.id || document.activeElement?.tagName, attached: document.contains(inside), hidden: inside.getClientRects().length === 0 };
  });
  check(r.attached && r.hidden, "fixture: the previously focused radio is still attached but invisible");
  check(r.sync === "btnIndentRecommendAcceptVendors" && r.later === "btnIndentRecommendAcceptVendors", `focus restored to the initiator, not left on a hidden element (${r.sync} / ${r.later})`);
  await ctx.close();
}
{
  // 7.3 busy dialogs consume Escape without dismissing the layers beneath them
  const { ctx, page } = await h.open({ role: "edit", indentDate: true, delays: { proc_indent_delete_draft: 900 } }, VP);
  await h.openIndentModalAt(page, VP, 1); // first row = draft indent
  await page.click("#btnIndentDeleteDraft");
  await page.waitForSelector("#hardDeleteModalBackdrop.show");
  await page.fill("#hardDeleteConfirmText", "DELETE");
  await page.click("#btnHardDeleteConfirm");
  await page.waitForTimeout(150);
  await esc(page); await esc(page);
  check((await shown(page)).join() === "indentViewModalBackdrop,hardDeleteModalBackdrop", "in-flight delete: Escape neither closes the confirm dialog nor the indent modal");
  await page.waitForFunction(() => !document.querySelector("#hardDeleteModalBackdrop.show"), null, { timeout: 4000 });
  await ctx.close();
}
{
  // 7.4 visual stacking: drawers and menus render above their owning dialog and below any dialog above it
  const { ctx, page } = await h.open({ role: "edit", indentDate: true }, VP);
  await h.openIndentModal(page, VP);
  const topAt = (sel) => page.evaluate((s) => {
    const el = document.querySelector(s); const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 20));
    return { inside: !!hit && (el === hit || el.contains(hit)), z: getComputedStyle(el).zIndex, hit: hit?.id || hit?.className || hit?.tagName };
  }, sel);
  await page.click("#iLineFilterBtn");
  await page.waitForSelector("#iLineFilterDrawer.open");
  let t = await topAt("#iLineFilterDrawer");
  check(t.inside, `filter drawer is visually above its owning indent modal (${JSON.stringify(t)})`);
  await page.evaluate(() => document.getElementById("indentActionModalBackdrop").classList.add("show"));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  t = await topAt("#iLineFilterDrawer");
  check(!t.inside, `a dialog opened above the owner covers the lower drawer (${JSON.stringify(t)})`);
  await page.evaluate(() => document.getElementById("indentActionModalBackdrop").classList.remove("show"));
  await page.keyboard.press("Escape"); await page.waitForTimeout(40);
  await page.click("#btnIExportMenu");
  await page.waitForSelector(".export-menu.open");
  t = await topAt(".export-menu.open");
  check(t.inside, `export menu is visually above its owning indent modal (${JSON.stringify(t)})`);
  await page.evaluate(() => document.getElementById("indentActionModalBackdrop").classList.add("show"));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  t = await topAt(".export-menu.open");
  check(!t.inside, `a dialog opened above the owner covers the lower export menu (${JSON.stringify(t)})`);
  await ctx.close();
}
await h.close();
if (failures) { console.error(`pec-modal-stack-smoke: ${failures} FAILED`); process.exit(1); }
console.log("pec-modal-stack-smoke: PASS");
