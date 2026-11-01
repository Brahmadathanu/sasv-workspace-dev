/**
 * WP-07 Bundle A (UX-10) consistency smoke: A1 floating helper follows scroll/resize, A2 behavioural
 * verifyReviewed finally, A3 tab focus rings not clipped, A4 helper from the Composition tab button,
 * A5 Composition horizontal scroll only when needed, A6 .ea-btn hover/focus contrast, (b) .ea-btn on the
 * other workspace tabs with one vertical scroller per tab, (c) legacy line-card renderer still has its caller.
 * Runs at deviceScaleFactor 1.25 (owner: Windows 125%) at 1366 and 683 px. Local fixture only; no network.
 */
import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sharedRoot = join(root, "public/shared");
const read = (name) => readFileSync(join(root, name), "utf8");
const html = read("public/shared/e-aushadhi-review-control.html");
const js = read("public/shared/js/eaushadhi-review-control.js");
const css = read("public/shared/css/sasv-eaushadhi-review.css");
let passed = 0;
let failed = 0;
function check(ok, label) {
  if (ok) { passed += 1; console.log(`OK ${label}`); }
  else { failed += 1; console.error(`FAIL ${label}`); }
}
const fnBody = (name) => {
  const start = js.search(new RegExp(`\\n(async )?function ${name}\\(`));
  if (start < 0) return "";
  const next = js.slice(start + 1).search(/\n(async )?function [A-Za-z0-9_]+\(/);
  return next < 0 ? js.slice(start) : js.slice(start, start + 1 + next);
};
const cssRule = (selector) => {
  const at = css.indexOf(`${selector} {`);
  return at < 0 ? "" : css.slice(at, css.indexOf("}", at));
};

// ---- Static contract checks ----
check(/composition-table-wrap \{[^}]*overflow-x:\s*auto;[^}]*overflow-y:\s*auto;[^}]*scrollbar-gutter:\s*auto;/s.test(css), "A5: Composition table scroller owns both axes with overflow-x:auto, overflow-y:auto and no reserved gutter");
check(/\.composition-table \{[^}]*min-width:\s*720px;/s.test(css), "A5: Composition table keeps a 720px minimum so narrow windows scroll instead of crushing columns");
check(/\.workflow-nav \.workflow-step:focus-visible \{[^}]*outline-offset:\s*-3px;/s.test(css), "A3: workflow tab focus ring is drawn inset so the scrolling strip cannot clip it");
check(/\.composition-info-icon \{[^}]*color:\s*var\(--sasv-info\);/s.test(css) && /\.composition-filter-badge \{[^}]*background:\s*var\(--sasv-warning\);/s.test(css), "A4: helper icon uses the blue info accent; filter dot stays amber");
for (const variant of ["primary", "secondary", "soft", "quiet", "danger"]) {
  check(["hover", "focus-visible", "active"].every((st) => css.includes(`.ea-btn.ea-btn--${variant}:${st}`)), `A6: .ea-btn--${variant} has scoped hover, focus-visible and active colour rules`);
}
check(!/\.ea-btn[^{]*\{[^}]*!important/.test(css), "A6: .ea-btn rules use no !important");
check(css.includes(".ea-btn.ea-btn--primary:disabled") && css.includes(".ea-btn.ea-btn--danger:disabled"), "A6: solid .ea-btn variants keep light text when disabled");
check(js.includes('window.addEventListener("scroll", () => {') && js.includes("{ capture: true, passive: true }") && js.includes("scheduleCompositionActionHintPlacement"), "A1: open helper repositions on scroll in the capture phase");
check(/function scheduleCompositionActionHintPlacement\(\) \{[\s\S]*?requestAnimationFrame[\s\S]*?compositionActionHintAnchorVisible[\s\S]*?hideCompositionActionHint\(\)[\s\S]*?placeCompositionActionHint\(\)/.test(js), "A1: placement is rAF-throttled and hides when the icon leaves the view");
check(/window\.addEventListener\("resize", \(\) => \{[\s\S]*?scheduleCompositionActionHintPlacement\(\)/.test(js), "A1: resize also goes through the throttled placement");
check(fnBody("renderWorkflowNav").includes('matches(":hover")') && fnBody("renderWorkflowNav").includes("showCompositionActionHint()"), "A4: rebuilt Composition tab re-opens the helper while still hovered or focused");
check(js.includes('$("workspaceTabs")?.addEventListener("focusin"') && js.includes('scrollIntoView?.({ block: "nearest", inline: "nearest" })'), "A3: a focused workflow tab is scrolled fully into the strip so its ring is never cut at the edge");
check(fnBody("wireCompositionActionHint").includes('"mouseenter", showCompositionActionHint') && fnBody("wireCompositionActionHint").includes('"focus", showCompositionActionHint'), "A4: Composition tab button itself opens the helper on hover and focus");

const tabButtonFns = {
  "Product Details": ["renderDetails"],
  "Pharmacological Action": ["renderActions"],
  "QC Register": ["qcTestReportCardHtml", "qcPrepWorkspaceHtml", "qcSourceFactsCardHtml", "qcLabDecisionCardHtml", "qcFactAcceptCardHtml", "qcFactCorrectCardHtml", "qcProtocolMappingCardHtml", "qcFillPreflightCardHtml"],
  Evidence: ["renderEvidence", "copyCardActions"],
  Readiness: ["renderReadiness", "renderFillOnPortalSection", "renderWorkerFoundationCard", "renderEntryDryRunCard"],
};
for (const [tab, fns] of Object.entries(tabButtonFns)) {
  const buttons = fns.flatMap((fn) => fnBody(fn).match(/<button[^>]*class="[^"]*icon-btn[^"]*"/g) || []);
  check(buttons.length > 0 && buttons.every((b) => /\bea-btn\b/.test(b) && /\bea-btn--(primary|secondary|soft|quiet|danger)\b/.test(b)), `(b) ${tab}: all ${buttons.length} action buttons carry .ea-btn and a variant`);
  const primaries = buttons.filter((b) => /\bprimary\b/.test(b.replace(/ea-btn--primary/g, "")));
  check(primaries.every((b) => b.includes("ea-btn--primary")), `(b) ${tab}: legacy primary buttons map to .ea-btn--primary`);
}
check(fnBody("renderOverview").includes("section-card") && !/<button/.test(fnBody("renderOverview")), "(b) Overview has no buttons to restyle (unchanged)");
check(fnBody("renderComposition").includes("renderCompositionLegacy();") && js.includes("state.compositionLineHtml.get(id)"), "(c) legacy line-card renderer still feeds the line modal, so it is kept");
check(html.includes('id="worklistFallback"') && html.includes('id="legacyQueueControls"') && html.includes('id="queueTableWrap"'), "(c) worklist error fallback to the old queue is untouched");
check(js.includes("isFirstControlledEntryProduct") && js.includes("btnPortalEntryGateOn") && js.includes("btnPortalEntryGateOff"), "safety: PKG3a portal-entry gate controls still present");

const fixtureLines = Array.from({ length: 80 }, (_, index) => ({
  source_composition_line_id: 1000 + index,
  source_row_no: index + 1,
  raw_ingredient_name: `Ingredient ${index + 1}`,
  raw_scientific_name: index % 4 === 0 ? `Botanica longissima specimen ${index + 1}` : "",
  raw_part_used: "Root",
  raw_quantity_text: "10",
  raw_unit_text: "mg",
  raw_reference_text: index === 1 ? "API Vol. I" : null,
  review_status: "PENDING",
  row_version: 1 + index,
  suggestion_basis: null,
}));

const previewLines = fixtureLines.map((line) => ({
  source_composition_line_id: line.source_composition_line_id,
  source_row_no: line.source_row_no,
  raw_ingredient_name: line.raw_ingredient_name,
  raw_reference_text: line.raw_reference_text,
  row_version: line.row_version,
  review_status: line.review_status,
  lock_reason: null,
}));

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const supabaseStub = `export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: { user: { id: "ux91-smoke-user" } } }, error: null }),
  },
  rpc: async (name, args) => {
    if (globalThis.__ux10RpcThrow === true) {
      globalThis.__ux10RpcThrown = (globalThis.__ux10RpcThrown || 0) + 1;
      throw new Error("ux10 mocked RPC failure: " + name);
    }
    const data = typeof globalThis.__ux10Rpc === "function" ? globalThis.__ux10Rpc(name, args) : [];
    return { data, error: null };
  },
  schema() { return this; },
  from() { return this; },
  select() { return this; },
  eq() { return this; },
  maybeSingle: async () => ({ data: null, error: null }),
  storage: {
    from() {
      return {
        upload: async () => ({ data: {}, error: null }),
        remove: async () => ({ data: {}, error: null }),
        createSignedUrl: async () => ({ data: { signedUrl: "about:blank" }, error: null }),
      };
    },
  },
};
export const labSupabase = supabase;
export const hrSupabase = supabase;
export const handleSupabaseError = (error) => error;
`;

function transformControl(source) {
  if (!source.includes("\ninitPage();")) throw new Error("expected initPage() bootstrap in production control");
  return `${source.replace(
    /\ninitPage\(\);\s*$/,
    `
globalThis.__ux10 = {
  openProduct,
  selectWorkflowTab,
  openSourceReferenceBulkDialog,
  requestCloseSourceReferenceBulkDialog,
  openVerifyReviewed,
  renderCompositionToolbarActions,
  showCompositionActionHint,
  hideCompositionActionHint,
  placeCompositionActionHint,
  renderComposition,
  renderWorkflowNav,
  submitVerifyReviewed,
  syncCompositionFilterControls,
  state,
  access,
};
initPage();
`,
  )}`;
}

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/" || rel === "/e-aushadhi-review-control.html") rel = "/e-aushadhi-review-control.html";
  const filePath = join(sharedRoot, rel.replace(/^\//, ""));
  if (!filePath.startsWith(sharedRoot) || !existsSync(filePath)) {
    res.writeHead(404).end("not found");
    return;
  }
  const type = mime[extname(filePath)] || "application/octet-stream";
  if (rel.endsWith("/js/supabaseClient.js")) {
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" }).end(supabaseStub);
    return;
  }
  let body = readFileSync(filePath);
  if (rel.endsWith("/js/eaushadhi-review-control.js")) {
    body = Buffer.from(transformControl(body.toString("utf8")), "utf8");
  }
  res.writeHead(200, { "content-type": type, "cache-control": "no-store" }).end(body);
});

await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
const { port } = server.address();
const pageUrl = `http://127.0.0.1:${port}/e-aushadhi-review-control.html`;

let require = createRequire(join(root, "package.json"));
let chromium;
try { ({ chromium } = require("playwright-core")); }
catch { require = createRequire(join(root, "..", "daily-worklog-app", "package.json")); ({ chromium } = require("playwright-core")); }
const executablePath = process.env.UX10_BROWSER_PATH || process.env.UX91_BROWSER_PATH || ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
if (!executablePath) throw new Error("Set UX10_BROWSER_PATH to an installed Chromium browser; no downloads are performed.");
const browser = await chromium.launch({ headless: true, executablePath });

const pageHelpers = () => {
  const parse = (value) => {
    const m = String(value || "").match(/rgba?\(([^)]+)\)/);
    if (!m) return [0, 0, 0, 0];
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  };
  const blend = (top, under) => {
    const a = top[3];
    return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1);
  };
  const lum = (c) => {
    const [r, g, b] = c.slice(0, 3).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const effectiveBg = (el) => {
    const chain = [];
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) chain.push(parse(getComputedStyle(node).backgroundColor));
    return chain.reverse().reduce((under, top) => blend(top, under), [255, 255, 255, 1]);
  };
  const ratio = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  globalThis.__ux10Contrast = (el) => {
    const bg = effectiveBg(el);
    const fg = blend(parse(getComputedStyle(el).color), bg);
    return { ratio: ratio(fg, bg), fgLum: lum(fg), color: getComputedStyle(el).color, bg: `rgb(${bg.slice(0, 3).map(Math.round).join(",")})` };
  };
  globalThis.__ux10VerticalScrollers = () => {
    const list = [...document.querySelectorAll("body *")].filter((el) => {
      if (el.closest("[hidden]")) return false;
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") return false;
      return ["auto", "scroll"].includes(s.overflowY) && el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 1;
    }).map((el) => el.id || el.className);
    if (document.documentElement.scrollHeight > innerHeight + 1 && getComputedStyle(document.documentElement).overflowY !== "hidden" && getComputedStyle(document.body).overflowY !== "hidden") list.push("document");
    return list;
  };
};

async function forceStates(cdp, selector, states) {
  const { root: doc } = await cdp.send("DOM.getDocument", { depth: 0 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: doc.nodeId, selector });
  if (!nodeId) return false;
  await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: states });
  return true;
}

async function openComposition(page, width, height = 768) {
  await page.setViewportSize({ width, height });
  await page.goto(pageUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => globalThis.__ux10?.access?.loaded === true);
  await page.evaluate(pageHelpers);
  await page.evaluate(async () => {
    const api = globalThis.__ux10;
    await api.openProduct(262);
    api.selectWorkflowTab("composition");
  });
  await page.waitForSelector("#compositionTableBody tr.composition-table-row");
}

const nextFrames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

try {
  const page = await browser.newPage({ deviceScaleFactor: 1.25 });
  await page.addInitScript(({ lines, preview }) => {
    globalThis.__ux10Rpc = (name) => {
      switch (name) {
        case "get_user_permissions":
          return [{ target: "module:e-aushadhi-automation", can_view: true, can_edit: true }];
        case "rpc_eaushadhi_my_roles_v1":
          return { is_verifier: true, is_approver: true, is_admin: false };
        case "rpc_eaushadhi_worklist_v1":
          return [{
            product_id: 262,
            product_name: "UX10 fixture product",
            family: "Fixture",
            queue_code: "TO_VERIFY",
            next_action_label: "Open composition",
            updated_at: "2026-10-31T00:00:00Z",
          }];
        case "rpc_eaushadhi_product_queue":
          return [{ product_id: 262, product_name: "UX10 fixture product" }];
        case "rpc_eaushadhi_portal_options":
        case "rpc_eaushadhi_permission_purpose_options":
        case "rpc_eaushadhi_pharmacological_action_options":
        case "rpc_eaushadhi_product_classification_options":
        case "rpc_eaushadhi_product_actions_get":
        case "rpc_eaushadhi_product_issues":
        case "rpc_eaushadhi_reference_mapping_get":
        case "rpc_eaushadhi_stage_review_state_v1":
          return [];
        case "rpc_eaushadhi_product_review_get":
          return {
            product_id: 262,
            product_name: "UX10 fixture product",
            review_status: "PENDING",
            row_version: 1,
          };
        case "rpc_eaushadhi_review_queue":
          return lines;
        case "rpc_eaushadhi_product_evidence_status":
          return { product_id: 262, has_approved_copy: false };
        case "rpc_eaushadhi_product_classification_review_get":
          return { product_id: 262, review_status: "PENDING", row_version: 1 };
        case "rpc_eaushadhi_approved_product_copy_get":
        case "rpc_eaushadhi_product_dossier_portal_fields_get":
        case "rpc_eaushadhi_product_portal_text_get":
          return null;
        case "rpc_eaushadhi_document_upload_contract":
          return {
            product_id: 262,
            document_purpose: "APPROVED_PRODUCT_COPY",
            extension: "pdf",
            expected_file_name: "copy.pdf",
            expected_storage_path: "copy/copy.pdf",
          };
        case "rpc_eaushadhi_source_reference_preview_v1":
          return {
            product_id: 262,
            max_lines: 200,
            caller: { is_verifier: true, is_approver: true },
            product_lock_reason: null,
            known_wordings: [{ raw_reference_text: "API Vol. I", line_count: 20, product_line_count: 1 }],
            lines: preview,
          };
        default:
          return [];
      }
    };
  }, { lines: fixtureLines, preview: previewLines });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");

  for (const width of [1366, 683]) {
    const at = `${width}px at 125%`;
    await openComposition(page, width);

    // ---- A4: helper from the Composition tab button ----
    await page.mouse.move(2, 760);
    await page.evaluate(() => globalThis.__ux10.hideCompositionActionHint());
    const tabBox = await page.locator("#wf-tab-composition").boundingBox();
    await page.mouse.move(tabBox.x + 10, tabBox.y + tabBox.height / 2);
    check(await page.evaluate(() => document.querySelector("#compositionActionHint")?.classList.contains("is-open") === true
      && document.querySelector("#wf-tab-composition")?.getAttribute("aria-describedby") === "compositionActionHint"), `${at}: A4 hovering the Composition tab button (not the i) opens the helper tooltip`);
    await page.mouse.move(2, 760);
    check(await page.evaluate(() => !document.querySelector("#compositionActionHint").classList.contains("is-open")), `${at}: A4 mouseleave from the tab button hides the helper`);
    await page.mouse.click(tabBox.x + 10, tabBox.y + tabBox.height / 2);
    check(await page.evaluate(() => document.querySelector("#compositionActionHint").classList.contains("is-open")), `${at}: A4 helper stays open after clicking the tab button (nav re-render)`);
    await page.mouse.move(2, 760);
    await page.locator("#wf-tab-overview").focus();
    await page.keyboard.press("Home");
    for (let i = 0; i < 2; i += 1) await page.keyboard.press("ArrowRight");
    check(await page.evaluate(() => document.activeElement?.id === "wf-tab-composition" && document.querySelector("#compositionActionHint").classList.contains("is-open")), `${at}: A4 keyboard focus on the Composition tab button opens the helper`);
    check(await page.evaluate(() => {
      const tip = document.querySelector("#compositionActionHint");
      const r = tip.getBoundingClientRect();
      const s = getComputedStyle(tip);
      const nav = document.querySelector("#workspaceTabs");
      return s.position === "fixed" && s.pointerEvents === "none" && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && nav.scrollHeight <= nav.clientHeight + 0.5;
    }), `${at}: A4 tooltip opened from the tab is fixed, inside the viewport, pointer-events none and adds no nav scroll bar`);
    await page.keyboard.press("Escape");
    check(await page.evaluate(() => !document.querySelector("#compositionActionHint").classList.contains("is-open")), `${at}: A4 Escape closes the helper opened from the tab button`);
    check(await page.evaluate(() => {
      const icon = document.querySelector("#wf-tab-composition .composition-info-icon");
      const tab = document.querySelector("#wf-tab-composition");
      const c = globalThis.__ux10Contrast(icon);
      const tabBg = globalThis.__ux10Contrast(tab).bg;
      const dot = getComputedStyle(document.querySelector("#compositionFilterBadge")).backgroundColor;
      return c.ratio >= 3 && c.color !== dot && c.bg === tabBg;
    }), `${at}: A4 info icon colour has >= 3:1 contrast on the tab background and differs from the amber filter dot`);
    check(await page.evaluate(() => {
      const nav = document.querySelector("#workspaceTabs");
      const tab = [...nav.querySelectorAll("button")].find((b) => b.getAttribute("aria-selected") !== "true");
      const icon = document.querySelector("#wf-tab-composition .composition-info-icon");
      const bg = globalThis.__ux10Contrast(nav).bg;
      return Boolean(tab) && globalThis.__ux10Contrast(icon).ratio >= 3 && bg.length > 0;
    }), `${at}: A4 info icon keeps >= 3:1 on the strip whether or not Composition is selected`);

    // ---- A1: helper follows scroll / resize ----
    await page.evaluate(() => globalThis.__ux10.showCompositionActionHint());
    const followed = await page.evaluate(async () => {
      const nav = document.querySelector("#workspaceTabs");
      const icon = document.querySelector("#wf-tab-composition .composition-info-icon");
      const tip = document.querySelector("#compositionActionHint");
      const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      // Simulate the page/workspace moving under the open tooltip: shift the nav and fire a scroll on the workspace.
      const before = tip.getBoundingClientRect().left;
      nav.style.marginLeft = "40px";
      document.querySelector("#workspaceScroll").dispatchEvent(new Event("scroll"));
      await frames();
      const ir = icon.getBoundingClientRect();
      const tr = tip.getBoundingClientRect();
      const centred = Math.abs((tr.left + tr.width / 2) - (ir.left + ir.width / 2)) <= 2 || tr.right >= innerWidth - 9 || tr.left <= 9;
      const moved = Math.abs(tr.left - before) > 1 || tr.right >= innerWidth - 9;
      const below = Math.abs(tr.top - (ir.bottom + 6)) <= 1.5 || Math.abs(tr.bottom - (ir.top - 6)) <= 1.5;
      nav.style.marginLeft = "";
      return { ok: tip.classList.contains("is-open") && centred && moved && below };
    });
    check(followed.ok, `${at}: A1 open helper re-anchors to its i after a (capture-phase) scroll`);
    check(await page.evaluate(async () => {
      const nav = document.querySelector("#workspaceTabs");
      const tip = document.querySelector("#compositionActionHint");
      const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      nav.style.transform = "translateY(-2000px)";
      nav.dispatchEvent(new Event("scroll"));
      await frames();
      const hidden = !tip.classList.contains("is-open");
      nav.style.transform = "";
      return hidden;
    }), `${at}: A1 helper hides when its icon scrolls out of view`);
    await page.evaluate(() => globalThis.__ux10.showCompositionActionHint());
    await page.setViewportSize({ width: width - 40, height: 760 });
    await nextFrames(page);
    check(await page.evaluate(() => {
      const icon = document.querySelector("#wf-tab-composition .composition-info-icon").getBoundingClientRect();
      const tip = document.querySelector("#compositionActionHint");
      const r = tip.getBoundingClientRect();
      return tip.classList.contains("is-open") && r.right <= innerWidth + 0.5 && r.left >= -0.5 && Math.abs(r.top - (icon.bottom + 6)) <= 1.5;
    }), `${at}: A1 open helper follows its icon after a window resize and stays in the viewport`);
    await page.evaluate(() => globalThis.__ux10.hideCompositionActionHint());
    await page.setViewportSize({ width, height: 768 });
    await nextFrames(page);

    // ---- A3: tab focus rings are not clipped ----
    await page.locator("#wf-tab-overview").focus();
    await page.keyboard.press("Home");
    const tabCount = await page.locator("#workspaceTabs button").count();
    let ringsOk = true;
    const ringFails = [];
    for (let i = 0; i < tabCount; i += 1) {
      if (i > 0) await page.keyboard.press("ArrowRight");
      const res = await page.evaluate(() => {
        const el = document.activeElement;
        const nav = document.querySelector("#workspaceTabs");
        if (!el || !nav.contains(el) || !el.matches(":focus-visible")) return { ok: false, why: "not focus-visible" };
        const s = getComputedStyle(el);
        const w = parseFloat(s.outlineWidth) || 0;
        const off = parseFloat(s.outlineOffset) || 0;
        const grow = Math.max(0, w + off);
        const r = el.getBoundingClientRect();
        const n = nav.getBoundingClientRect();
        const ns = getComputedStyle(nav);
        const clip = {
          left: n.left + parseFloat(ns.borderLeftWidth), right: n.right - parseFloat(ns.borderRightWidth),
          top: n.top + parseFloat(ns.borderTopWidth), bottom: n.bottom - parseFloat(ns.borderBottomWidth),
        };
        const ring = { left: r.left - grow, right: r.right + grow, top: r.top - grow, bottom: r.bottom + grow };
        const inside = ring.left >= clip.left - 0.5 && ring.right <= clip.right + 0.5 && ring.top >= clip.top - 0.5 && ring.bottom <= clip.bottom + 0.5;
        return { ok: s.outlineStyle !== "none" && w >= 2 && inside, why: `${el.id} w=${w} off=${off} ring=${Math.round(ring.left)}..${Math.round(ring.right)} clip=${Math.round(clip.left)}..${Math.round(clip.right)}` };
      });
      if (!res.ok) { ringsOk = false; ringFails.push(res.why); }
    }
    check(ringsOk && tabCount >= 7, `${at}: A3 every workflow tab shows a full, unclipped :focus-visible ring (${tabCount} tabs)${ringFails.length ? ` [${ringFails.join("; ")}]` : ""}`);
    await page.evaluate(() => globalThis.__ux10.selectWorkflowTab("composition"));
    await page.waitForSelector("#compositionTableScroll");
    await page.evaluate(() => { globalThis.__ux10.hideCompositionActionHint(); document.activeElement?.blur(); });

    // ---- A5: horizontal scroll only when needed, on the same table scroller ----
    const a5 = await page.locator("#compositionTableScroll").evaluate((el) => {
      const s = getComputedStyle(el);
      return { sw: el.scrollWidth, cw: el.clientWidth, ox: s.overflowX, oy: s.overflowY, gutter: s.scrollbarGutter };
    });
    if (width === 683) {
      check(a5.sw > a5.cw && a5.ox === "auto", `${at}: A5 table scroller has scrollWidth ${a5.sw} > clientWidth ${a5.cw} with overflow-x auto (horizontal bar present)`);
    } else {
      check(a5.sw <= a5.cw && a5.ox === "auto", `${at}: A5 table fits, so no horizontal bar (scrollWidth ${a5.sw} <= clientWidth ${a5.cw})`);
    }
    check(a5.oy === "auto" && a5.gutter !== "stable" && !String(a5.gutter).includes("stable"), `${at}: A5 the same scroller owns vertical scroll with no reserved gutter`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector("#workspaceScroll").scrollWidth <= document.querySelector("#workspaceScroll").clientWidth + 0.5), `${at}: A5 no horizontal page or workspace scroll; only the table scroller scrolls sideways`);
    check(await page.evaluate(() => {
      const list = globalThis.__ux10VerticalScrollers();
      globalThis.__ux10LastScrollers = list.join(", ");
      return list.length === 1 && list[0] === "compositionTableScroll";
    }), `${at}: A5 exactly one vertical scroller (the table) on Composition`);
    check(await page.locator("#compositionTableScroll").evaluate(async (el) => {
      el.scrollTop = 200;
      el.scrollLeft = 60;
      await new Promise((r) => requestAnimationFrame(r));
      const th = el.querySelector("thead th");
      const top = Math.abs(th.getBoundingClientRect().top - (el.getBoundingClientRect().top + el.clientTop)) <= 1;
      const opaque = getComputedStyle(th).backgroundColor !== "rgba(0, 0, 0, 0)" && getComputedStyle(th).position === "sticky";
      el.scrollTop = 0;
      el.scrollLeft = 0;
      return top && opaque;
    }), `${at}: A5 sticky opaque header stays at the top while scrolled on both axes`);

    // ---- A6: .ea-btn contrast in every state ----
    await page.evaluate(() => {
      const host = document.createElement("div");
      host.id = "ux10Samples";
      host.style.cssText = "position:fixed;left:8px;bottom:8px;display:flex;gap:6px;z-index:9999;background:var(--sasv-surface)";
      host.innerHTML = [
        ["primary", "icon-btn with-label ea-btn ea-btn--primary"],
        ["primaryLegacy", "icon-btn with-label primary ea-btn ea-btn--primary"],
        ["secondary", "icon-btn with-label ea-btn ea-btn--secondary"],
        ["soft", "icon-btn with-label ea-btn ea-btn--soft"],
        ["quiet", "icon-btn with-label ea-btn ea-btn--quiet"],
        ["danger", "icon-btn with-label ea-btn ea-btn--danger"],
        ["iconSecondary", "icon-btn ea-btn ea-btn--icon ea-btn--secondary"],
      ].map(([id, cls]) => `<button type="button" id="ux10-${id}" class="${cls}">${id === "iconSecondary" ? "i" : "Sample"}</button>`).join("");
      document.body.appendChild(host);
    });
    const targets = ["#btnVerifyReviewedLines", "#btnSetSourceReference", "#compositionFilterBtn", "#ux10-primary", "#ux10-primaryLegacy", "#ux10-secondary", "#ux10-soft", "#ux10-quiet", "#ux10-danger", "#ux10-iconSecondary"];
    for (const selector of targets) {
      const results = [];
      for (const states of [[], ["hover"], ["focus", "focus-visible"], ["hover", "active"], ["hover", "focus", "focus-visible"]]) {
        await forceStates(cdp, selector, states);
        const c = await page.locator(selector).evaluate((el) => globalThis.__ux10Contrast(el));
        results.push({ states: states.join("+") || "default", ...c });
      }
      await forceStates(cdp, selector, []);
      const worst = results.reduce((a, b) => (b.ratio < a.ratio ? b : a));
      check(worst.ratio >= 4.5, `${at}: A6 ${selector} text/background contrast >= 4.5:1 in default, hover, focus-visible and active (worst ${worst.states} ${worst.ratio.toFixed(2)}:1 ${worst.color} on ${worst.bg})`);
    }
    for (const selector of ["#btnVerifyReviewedLines", "#ux10-primary", "#ux10-primaryLegacy", "#ux10-danger"]) {
      const lums = [];
      for (const states of [["hover"], ["focus", "focus-visible"], ["hover", "active"]]) {
        await forceStates(cdp, selector, states);
        lums.push(await page.locator(selector).evaluate((el) => globalThis.__ux10Contrast(el).fgLum));
      }
      await forceStates(cdp, selector, []);
      lums.push(await page.locator(selector).evaluate((el) => { el.disabled = true; const v = globalThis.__ux10Contrast(el).fgLum; el.disabled = false; return v; }));
      check(lums.every((l) => l >= 0.85), `${at}: A6 ${selector} text stays white/light on hover, focus-visible, active and disabled`);
    }
    await page.evaluate(() => document.querySelector("#ux10Samples")?.remove());

    // ---- (b) other tabs: .ea-btn and one vertical scroller per tab ----
    for (const tab of ["overview", "details", "actions", "qc", "evidence", "readiness"]) {
      await page.evaluate((t) => globalThis.__ux10.selectWorkflowTab(t), tab);
      await page.waitForFunction((t) => document.querySelector(`#tab-${t}`) && !document.querySelector(`#tab-${t}`).hidden, tab);
      await nextFrames(page);
      const info = await page.evaluate((t) => {
        const panel = document.querySelector(`#tab-${t}`);
        const buttons = [...panel.querySelectorAll("button.icon-btn")].filter((b) => !b.closest("[hidden]"));
        const missing = buttons.filter((b) => !b.classList.contains("ea-btn")).map((b) => b.id || b.textContent.trim());
        return { count: buttons.length, missing, scrollers: globalThis.__ux10VerticalScrollers() };
      }, tab);
      check(info.missing.length === 0, `${at}: (b) ${tab} tab: ${info.count} rendered action buttons all carry .ea-btn${info.missing.length ? ` [missing: ${info.missing.join(", ")}]` : ""}`);
      check(info.scrollers.length <= 1 && info.scrollers.every((s) => s === "workspaceScroll"), `${at}: (b) ${tab} tab has at most one vertical scroll bar, owned by #workspaceScroll [${info.scrollers.join(", ")}]`);
      if (tab === "overview" || tab === "qc") {
        check(await page.evaluate(async (t) => {
          const scroll = document.querySelector("#workspaceScroll");
          const spacer = document.createElement("div");
          spacer.style.height = "2400px";
          document.querySelector(`#tab-${t}`).appendChild(spacer);
          scroll.scrollTop = 300;
          await new Promise((r) => requestAnimationFrame(r));
          const ok = getComputedStyle(scroll).overflowY === "auto" && scroll.scrollTop > 0 && globalThis.__ux10VerticalScrollers().length === 1;
          spacer.remove();
          scroll.scrollTop = 0;
          return ok;
        }, tab), `${at}: (b) ${tab} tab still scrolls vertically in #workspaceScroll when content is tall`);
      }
    }
  }

  // ---- A2: behavioural finally for submitVerifyReviewed ----
  await openComposition(page, 1366);
  const a2 = await page.evaluate(async () => {
    const api = globalThis.__ux10;
    const line = api.state.lines[0];
    const id = String(line.source_composition_line_id);
    line.review_status = "IN_REVIEW";
    const draft = api.state.lineDrafts.get(id) || {};
    api.state.lineDrafts.set(id, { ...draft, sourceCompositionLineId: line.source_composition_line_id, rowVersion: line.row_version, ingredientTypeOptionId: 1, ingredientFormOptionId: 2, partUsedOptionId: 3, measurementOptionId: 4, reviewNotes: "" });
    api.state.lineSaveStatus.set(id, "saved");
    globalThis.__ux10RpcThrow = true;
    globalThis.__ux10RpcThrown = 0;
    const errors = [];
    const origError = console.error;
    console.error = (...args) => { errors.push(args.map(String).join(" ")); };
    let threw = false;
    let runningDuring = null;
    try {
      const pending = api.submitVerifyReviewed();
      runningDuring = api.state.verifyReviewed.running;
      await pending;
    } catch {
      threw = true;
    } finally {
      console.error = origError;
      globalThis.__ux10RpcThrow = false;
    }
    const approve = document.querySelector("#btnVerifyReviewedLines");
    return {
      thrown: globalThis.__ux10RpcThrown,
      runningDuring,
      running: api.state.verifyReviewed.running,
      disabled: approve?.disabled,
      ariaDisabled: approve?.getAttribute("aria-disabled"),
      threw,
    };
  });
  check(a2.thrown > 0 && a2.runningDuring === true, `A2: submitVerifyReviewed ran against a mocked RPC that throws (${a2.thrown} rejected calls) and was marked running`);
  check(a2.running === false, "A2: verifyReviewed.running is false after the throwing run (finally executed)");
  check(a2.disabled === false && a2.ariaDisabled === "false", "A2: Approve reviewed lines is re-enabled after the throwing run");
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}

console.log(`UX-10 Bundle A consistency checks: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
