// CW-13 responsive audit harness for the six Costing suite pages.
// Serves /public from disk, stubs the network (Supabase ESM + jsPDF CDN) with inert fakes, loads each page at
// 390/520/768/900/1280 px and reports page-level horizontal overflow, the elements that cause it, clipped
// non-scrolling elements and keyboard-focus visibility. No network, no Supabase, no writes.
//
//   node scripts/costing-responsive/responsive-audit.mjs [--json out.json] [--shots dir] [--pages a,b]
//
// Requires Playwright (chromium) on NODE_PATH; exits 0 and prints "SKIP" if it is unavailable.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// COSTING_AUDIT_ROOT lets the same harness measure another checkout (e.g. the baseline) for before/after evidence.
const root = process.env.COSTING_AUDIT_ROOT ? path.resolve(process.env.COSTING_AUDIT_ROOT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const PAGES = [
  ["costing-control-center", "shared/costing-control-center.html"],
  ["cost-build-manager", "shared/cost-build-manager.html"],
  ["cost-sheet-review", "shared/cost-sheet-review.html"],
  ["material-cost-manager", "shared/material-cost-manager.html"],
  ["pricing-policy-manager", "shared/pricing-policy-manager.html"],
  ["production-route-manager", "shared/production-route-manager.html"],
];
export const WIDTHS = [320, 390, 520, 768, 900, 1280];

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2" };

// Inert Supabase: every chain resolves to { data: [], error: null }; auth reports a signed-in test user.
const SUPABASE_STUB = `
const TARGETS = ["module:costing-control-center","module:material-cost-manager","module:cost-build-manager","module:pricing-policy-manager","module:cost-sheet-review","module:production-route-manager"];
const user = { id: "00000000-0000-0000-0000-000000000000", email: "audit@example.invalid" };
const session = { access_token: "stub", user };
const result = { data: [], error: null, count: 0 };
function chain() {
  const fn = () => proxy;
  const proxy = new Proxy(fn, {
    get(_t, prop) {
      if (prop === "then") return (res) => Promise.resolve(result).then(res);
      if (prop === "catch" || prop === "finally") return () => proxy;
      return (..._a) => proxy;
    },
    apply: () => proxy,
  });
  return proxy;
}
export function createClient() {
  const client = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      refreshSession: async () => ({ data: { session }, error: null }),
      signOut: async () => ({ error: null }),
    },
    from: () => chain(),
    // View-only fake permissions (can_view, never can_edit) so each suite renders its chrome. Read-only audit.
    rpc: (name) => (name === "get_user_permissions" ? Promise.resolve({ data: TARGETS.map((target) => ({ target, can_view: true, can_edit: false })), error: null }) : chain()), schema: () => client, channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
  };
  return client;
}
`;

export function startServer() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "");
    const file = path.join(root, "public", rel);
    if (!file.startsWith(path.join(root, "public")) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" }).end(fs.readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

// Runs inside the page (also exported as source for detector self-tests): page-level overflow, culprits, and clipped elements outside scroll containers.
function measure() {
  const vw = document.documentElement.clientWidth;
  const doc = document.documentElement;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && cs.position !== "fixed";
  };
  const scrollParent = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p);
      if (/(auto|scroll|hidden|clip)/.test(o.overflowX)) return p;
    }
    return null;
  };
  const sel = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };
  const culprits = [];
  for (const el of document.body.querySelectorAll("*")) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 && !scrollParent(el)) culprits.push({ el: sel(el), right: Math.round(r.right), width: Math.round(r.width) });
    if (culprits.length > 400) break;
  }
  // Collapse to the outermost few distinct selectors.
  const seen = new Map();
  for (const c of culprits) if (!seen.has(c.el)) seen.set(c.el, c);
  // Header collisions: title, subtitle, header actions and the run-status chip must not overlap each other,
  // and the module title must not be clipped by its own box.
  const headerEls = [...document.querySelectorAll(".page-header h1, .page-header .page-sub, .page-header .header-actions > *, .sc-run-status")].filter(visible);
  const overlaps = [];
  for (let i = 0; i < headerEls.length; i += 1) {
    for (let j = i + 1; j < headerEls.length; j += 1) {
      const a = headerEls[i], b = headerEls[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ox > 2 && oy > 2) overlaps.push(`${sel(a)} x ${sel(b)}`);
    }
  }
  // Header actions (incl. the Home button) must stay inside the page header and the viewport, whatever the
  // run-status chip text is: a clipped Home button is unreachable on phones.
  const headerBox = document.querySelector(".page-header")?.getBoundingClientRect();
  const clippedActions = [];
  if (headerBox) {
    for (const el of document.querySelectorAll(".page-header button, .page-header .sc-run-status, .page-header .sc-snapshot")) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > headerBox.right + 1 || r.right > vw + 1 || r.left < -1) clippedActions.push(`${sel(el)}@${Math.round(r.right)}>${Math.round(headerBox.right)}`);
    }
  }
  // Compact-header facts (CW-13 mobile header): size and row layout of the header, header control sizes, the status
  // icon button versus the long chip, and that the retired freshness chip is not rendered.
  const hdr = document.querySelector(".page-header");
  const hdrRect = hdr?.getBoundingClientRect();
  const titleEl = document.querySelector(".page-header h1");
  const titleRect = titleEl?.getBoundingClientRect();
  const homeRect = document.getElementById("homeBtn")?.getBoundingClientRect();
  const shown = (el) => Boolean(el) && visible(el);
  const chipEl = document.querySelector(".sc-run-status");
  const runBtn = document.getElementById("costingRunStatusBtn");
  const controls = [...document.querySelectorAll(".page-header button")].filter(visible).map((b) => { const r = b.getBoundingClientRect(); return { id: b.id || sel(b), w: Math.round(r.width), h: Math.round(r.height) }; });
  const compact = {
    headerHeight: hdrRect ? Math.round(hdrRect.height) : null,
    titleFontPx: titleEl ? parseFloat(getComputedStyle(titleEl).fontSize) : null,
    // One row: the title and Home button share a horizontal band (their vertical ranges overlap).
    sameRow: Boolean(titleRect && homeRect) && Math.min(titleRect.bottom, homeRect.bottom) - Math.max(titleRect.top, homeRect.top) > 4,
    smallestControl: controls.length ? Math.min(...controls.map((c) => Math.min(c.w, c.h))) : null,
    runButtonShown: shown(runBtn),
    chipShown: shown(chipEl),
    freshnessShown: shown(document.getElementById("lastRefreshed")),
    refreshPresent: Boolean(document.getElementById("refreshBtn")),
  };
  const h1 = document.querySelector(".page-header h1");
  const titleClipped = h1 ? h1.scrollWidth > h1.clientWidth + 1 : false;
  return {
    compact,
    headerOverlaps: overlaps.slice(0, 6),
    clippedActions: clippedActions.slice(0, 6),
    titleClipped,
    viewport: vw,
    docScrollWidth: doc.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    pageOverflow: Math.max(doc.scrollWidth, document.body.scrollWidth) > vw + 1,
    culprits: [...seen.values()].slice(0, 12),
    interactiveTotal: document.querySelectorAll("button, a[href], select, input, textarea, [role=tab], [role=button]").length,
  };
}

// Keyboard focus visibility: tab through the first N focusable controls and require a visible indicator.
async function focusAudit(page, limit = 14) {
  const problems = [];
  await page.evaluate(() => document.activeElement?.blur?.());
  for (let i = 0; i < limit; i += 1) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(260); // let focus transitions settle before reading computed styles
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const outlined = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
      const shadow = cs.boxShadow && cs.boxShadow !== "none";
      const borderChange = false;
      return { fv: el.matches(":focus-visible"), bg: cs.backgroundColor, border: cs.borderTopColor, tag: el.tagName.toLowerCase(), id: el.id, cls: String(el.className).slice(0, 40), visible: r.width > 0 && r.height > 0, outlined, shadow: Boolean(shadow), borderChange, inView: r.right > 0 && r.left < innerWidth };
    });
    // Only controls that really show :focus-visible (a date input's inner segment or picker button does not).
    if (info && info.visible && info.fv && !info.outlined && !info.shadow) problems.push(info);
  }
  return problems;
}

/** Detector self-test helper: measure a synthetic document at a width (no app code involved). */
export async function measureHtml(html, width = 390) {
  let chromium;
  try {
    chromium = createRequire(import.meta.url)("playwright").chromium;
  } catch {
    return { skipped: "playwright not available" };
  }
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    await page.setContent(html);
    return await page.evaluate(measure);
  } finally {
    await browser.close();
  }
}

// Realistic long run-status text (approved run, newer draft, valuation date) used by the header stress check.
export const LONG_RUN_STATUS_TEXT = "Approved run 143 · Draft run 148 · valuation 31 Oct 2026";

/** Launches chromium plus the static server for interaction tests; null when Playwright is unavailable. */
export async function launchAudit() {
  let chromium;
  try {
    chromium = createRequire(import.meta.url)("playwright").chromium;
  } catch {
    return null;
  }
  const server = await startServer();
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  return { browser, base: `http://127.0.0.1:${server.address().port}`, close: async () => { await browser.close(); server.close(); } };
}

/** Opens one Costing page with the fake backend. `storage` entries are written to localStorage before load. */
export async function openAuditPage(env, rel, { width = 390, storage = {}, stressChip = false } = {}) {
  const context = await env.browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
  await page.addInitScript((entries) => { try { for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v); } catch { /* ignore */ } }, storage);
  await page.route(/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|esm\.sh/, (r) => {
    if (/\.css/.test(r.request().url())) return r.fulfill({ status: 200, contentType: "text/css", body: "" });
    return r.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });
  await page.route(/esm\.sh\/@supabase\/supabase-js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: SUPABASE_STUB }));
  await page.goto(`${env.base}/${rel}`, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  if (stressChip) {
    await page.evaluate((text) => { for (const chip of document.querySelectorAll(".sc-run-status")) { chip.hidden = false; const main = chip.querySelector(".sc-run-status-main"); if (main) main.textContent = text; else chip.textContent = text; } }, LONG_RUN_STATUS_TEXT);
  }
  return { context, page, errors };
}

export async function audit({ pages = PAGES, widths = WIDTHS, shotsDir = null, focus = true, stressChip = false } = {}) {
  let chromium;
  try {
    chromium = createRequire(import.meta.url)("playwright").chromium;
  } catch {
    return { skipped: "playwright not available" };
  }
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const out = [];
  try {
    for (const [name, rel] of pages) {
      for (const width of widths) {
        const ctx = await browser.newContext({ viewport: { width, height: 900 } });
        const page = await ctx.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
        // Playwright matches the most recently registered route first: generic CDN stubs, then the Supabase stub.
        await page.route(/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|esm\.sh/, (r) => {
          const u = r.request().url();
          if (/\.css/.test(u)) return r.fulfill({ status: 200, contentType: "text/css", body: "" });
          return r.fulfill({ status: 200, contentType: "text/javascript", body: "" });
        });
        await page.route(/esm\.sh\/@supabase\/supabase-js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: SUPABASE_STUB }));
        await page.goto(`${base}/${rel}`, { waitUntil: "load" });
        await page.waitForTimeout(1200);
        if (stressChip) {
          await page.evaluate((text) => {
            for (const chip of document.querySelectorAll(".sc-run-status")) {
              chip.hidden = false;
              const main = chip.querySelector(".sc-run-status-main");
              if (main) main.textContent = text;
              else chip.textContent = text;
            }
          }, LONG_RUN_STATUS_TEXT);
        }
        const m = await page.evaluate(measure);
        const f = focus ? await focusAudit(page) : [];
        if (shotsDir) {
          fs.mkdirSync(shotsDir, { recursive: true });
          await page.screenshot({ path: path.join(shotsDir, `${name}-${width}.png`) });
        }
        out.push({ page: name, width, ...m, focusProblems: f, pageErrors: errors });
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  return { results: out };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  const only = arg("--pages")?.split(",");
  const pages = only ? PAGES.filter(([n]) => only.includes(n)) : PAGES;
  const widthsArg = arg("--widths")?.split(",").map(Number).filter(Boolean);
  const res = await audit({ pages, widths: widthsArg || WIDTHS, shotsDir: arg("--shots"), stressChip: process.argv.includes("--stress-chip"), focus: !process.argv.includes("--no-focus") });
  if (res.skipped) { console.log(`SKIP: ${res.skipped}`); process.exit(0); }
  if (arg("--json")) fs.writeFileSync(arg("--json"), JSON.stringify(res, null, 2));
  for (const r of res.results) {
    console.log(`${r.page.padEnd(26)} ${String(r.width).padStart(4)}px overflow=${r.pageOverflow ? "YES" : "no "} scrollW=${r.docScrollWidth} focusIssues=${r.focusProblems.length} hdrOverlap=${r.headerOverlaps.length} clippedActions=${r.clippedActions.length} titleClip=${r.titleClipped ? 'Y' : 'n'} controls=${r.interactiveTotal} errs=${r.pageErrors.length}${r.pageOverflow ? " culprits=" + r.culprits.slice(0, 3).map((c) => c.el + "@" + c.right).join(", ") : ""}`);
  }
}
