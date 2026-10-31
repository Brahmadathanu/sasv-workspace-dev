/** UX-9.1 Composition toolbar, filter drawer and table-scroll contract. */
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

check(html.includes('id="compositionToolbar"') && html.indexOf('id="compositionToolbar"') < html.indexOf('id="workspaceScroll"'), "Composition toolbar is outside the workspace/table scroll content");
check(html.includes('id="compositionFilterBtn"') && html.includes('aria-controls="compositionFilterDrawer"'), "filter button names and controls its drawer");
check(html.includes('id="compositionFilterBadge"') && js.includes("compositionActiveDrawerFilterCount"), "filter badge is backed by lens-only count logic");
check(html.includes('id="compositionFilterDrawer"') && html.includes('id="compositionReviewLenses"') && html.includes('id="compositionAttentionLenses"'), "existing lens IDs move into the drawer");
check(html.includes('id="btnClearCompositionFiltersDrawer"') && !html.includes('id="btnClearCompositionFiltersBar"'), "drawer owns the only toolbar Clear filters action");
check(!html.includes('id="openReferenceDictionaryFromCompositionBtn"') && !js.includes('$("openReferenceDictionaryFromCompositionBtn")'), "Composition Reference Dictionary shortcut and handler are removed");
check(html.includes('aria-describedby="compositionActionHint"') && html.includes('id="compositionActionHint"') && html.includes("composition-info-icon"), "Composition tab exposes the helper through an info tooltip");
check(js.includes("placeCompositionFilterPopover") && js.includes("setCompositionFiltersOpen") && js.includes('event.key === "Escape"'), "drawer has positioned Escape-close behaviour");
check(js.includes('document.addEventListener("pointerdown", onPointer, true)') && js.includes('button.focus()'), "outside click closes drawer and returns funnel focus");
check(js.includes("clear.disabled = !compositionFiltersAreActive(state.compositionView)"), "drawer Clear filters follows search or lens activity");
check(js.includes('event.target.id !== "compositionTableScroll"') && js.includes("appendCompositionChunk()"), "progressive rendering listens to the dedicated table scroller");
check(js.includes("state.compositionView.scrollTop = scroll.scrollTop") && js.includes("compositionScroll"), "table scroll position is captured and restored across reloads");
check(js.includes("focusCompositionRow(returnId, { scroll: false })") && js.includes("preventScroll"), "modal close restores row focus without moving the table scroll");
check(css.includes(".composition-table th") && css.includes("position: sticky") && css.includes("background: var(--sasv-surface-soft)"), "table header remains sticky and opaque");
check(css.includes(".composition-toolbar") && css.includes("flex-wrap: wrap") && css.includes(".composition-toolbar-actions"), "toolbar has an explicit responsive wrap layout");
check(css.includes(".ea-btn--primary") && css.includes(".ea-btn--secondary") && css.includes(".ea-btn--quiet") && css.includes(".ea-btn--danger") && css.includes(".ea-btn--icon"), "scoped button system defines every approved variant");
check(js.includes('id="sourceReferenceBulkClose"') && js.includes("source-reference-bulk-heading"), "bulk header uses a flexible title wrapper with close last");
check(css.includes(".source-reference-bulk-heading") && css.includes("flex: 1 1 auto") && css.includes("min-width: 0"), "bulk heading lets the close button sit at the far right");
check(!js.includes("globalThis.confirm") && js.includes('idPrefix: "sourceReferenceDiscard"'), "discard uses a nested in-page confirmation");
check(js.includes("event.stopImmediatePropagation()") && js.includes('cancelLabel: "Keep editing"'), "nested confirmation captures Escape before the bulk dialog");
check(js.includes('if ($("sourceReferenceDiscardBackdrop") || openQcConfirm.showing === true) return;'), "bulk keydown yields while nested discard confirm is open");
check(js.includes("const allowed = canWrite();") && !js.includes("const allowed = canWrite() && !state.busy;"), "Approve reviewed lines is not gated on state.busy");

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
    const data = typeof globalThis.__ux91Rpc === "function" ? globalThis.__ux91Rpc(name, args) : [];
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
globalThis.__ux91 = {
  openProduct,
  selectWorkflowTab,
  openSourceReferenceBulkDialog,
  requestCloseSourceReferenceBulkDialog,
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
const executablePath = process.env.UX91_BROWSER_PATH || ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
if (!executablePath) throw new Error("Set UX91_BROWSER_PATH to an installed Chromium browser; no downloads are performed.");
const browser = await chromium.launch({ headless: true, executablePath });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1.25 });
  await page.addInitScript(({ lines, preview }) => {
    globalThis.__ux91Rpc = (name) => {
      switch (name) {
        case "get_user_permissions":
          return [{ target: "module:e-aushadhi-automation", can_view: true, can_edit: true }];
        case "rpc_eaushadhi_my_roles_v1":
          return { is_verifier: true, is_approver: true, is_admin: false };
        case "rpc_eaushadhi_worklist_v1":
          return [{
            product_id: 262,
            product_name: "UX91 fixture product",
            family: "Fixture",
            queue_code: "TO_VERIFY",
            next_action_label: "Open composition",
            updated_at: "2026-10-31T00:00:00Z",
          }];
        case "rpc_eaushadhi_product_queue":
          return [{ product_id: 262, product_name: "UX91 fixture product" }];
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
            product_name: "UX91 fixture product",
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

  for (const width of [1366, 683]) {
    await page.setViewportSize({ width, height: 768 });
    await page.goto(pageUrl, { waitUntil: "networkidle" });
    await page.waitForFunction(() => globalThis.__ux91?.access?.loaded === true);
    await page.evaluate(async () => {
      const api = globalThis.__ux91;
      await api.openProduct(262);
      api.selectWorkflowTab("composition");
    });
    await page.waitForSelector("#compositionTableScroll");
    await page.waitForSelector("#compositionTableBody tr.composition-table-row");

    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px at 125%: toolbar/table create no horizontal page scroll`);
    check(await page.locator("#compositionTableScroll").evaluate((el) => getComputedStyle(el).overflowX === "hidden" && document.documentElement.scrollWidth <= innerWidth), `${width}px at 125%: table scroller clips horizontal overflow without page scroll`);
    check(await page.locator(".composition-table th").first().evaluate((el) => { const s = getComputedStyle(el); return s.position === "sticky" && s.top === "0px" && s.backgroundColor !== "rgba(0, 0, 0, 0)"; }), `${width}px at 125%: table header is computed sticky and opaque`);
    check(await page.locator("#compositionToolbar").evaluate((host) => {
      const items = [...host.children].filter((el) => getComputedStyle(el).display !== "none").map((el) => el.getBoundingClientRect());
      return items.every((a, i) => items.every((b, j) => i === j || a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1));
    }), `${width}px at 125%: toolbar actions wrap without overlap`);

    await page.locator("#compositionFilterBtn").click();
    check(await page.locator("#compositionFilterBtn").getAttribute("aria-expanded") === "true", `${width}px: filter drawer opens and updates aria-expanded`);
    await page.keyboard.press("Escape");
    check(await page.evaluate(() => document.activeElement?.id === "compositionFilterBtn" && document.querySelector("#compositionFilterDrawer").hidden), `${width}px: Escape closes drawer and restores funnel focus`);

    check(await page.locator("#compositionTableBody tr").count() === 40, `${width}px: first paint shows 40 of 80 production fixture rows`);
    await page.locator("#compositionTableScroll").evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await page.waitForFunction(() => document.querySelectorAll("#compositionTableBody tr").length === 80);
    check(await page.locator("#compositionTableBody tr").count() === 80, `${width}px: progressive scroll appends the next 40 rows`);

    await page.locator('#compositionTableBody tr[data-line-id="1040"]').focus();
    await page.keyboard.press("ArrowDown");
    check(await page.evaluate(() => document.activeElement?.dataset?.lineId === "1041"), `${width}px: keyboard row focus advances inside the scroller`);

    await page.locator("#compositionTableScroll").evaluate((el) => { el.scrollTop = 120; });
    await page.locator('#compositionTableBody tr[data-line-id="1041"]').click();
    await page.waitForSelector("#compositionLineModalDialog");
    const before = await page.locator("#compositionTableScroll").evaluate((el) => el.scrollTop);
    await page.locator("#compositionLineModalClose").click();
    await page.waitForSelector("#compositionLineModalDialog", { state: "detached" });
    check(await page.evaluate(() => document.activeElement?.dataset?.lineId === "1041"), `${width}px: modal close returns focus to the same row`);
    check(await page.locator("#compositionTableScroll").evaluate((el, top) => el.scrollTop === top, before), `${width}px: modal close preserves table scroll position`);

    await page.locator("#btnSetSourceReference").click();
    await page.waitForSelector("#sourceReferenceBulkDialog");
    await page.locator("#sourceReferenceReason").fill("Discard escape smoke reason");
    await page.keyboard.press("Escape");
    await page.waitForSelector("#sourceReferenceDiscardBackdrop");
    await page.keyboard.press("Escape");
    check(await page.evaluate(() => {
      const discardGone = !document.getElementById("sourceReferenceDiscardBackdrop");
      const bulkOpen = Boolean(document.getElementById("sourceReferenceBulkDialog"));
      const focusInside = Boolean(document.getElementById("sourceReferenceBulkDialog")?.contains(document.activeElement));
      return discardGone && bulkOpen && focusInside;
    }), `${width}px: nested discard Escape closes only the confirm and restores bulk focus`);
    await page.evaluate(async () => {
      await globalThis.__ux91.requestCloseSourceReferenceBulkDialog({ force: true });
    });
    await page.waitForSelector("#sourceReferenceBulkDialog", { state: "detached" });
  }
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}

console.log(`UX-9.1 Composition toolbar checks: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
