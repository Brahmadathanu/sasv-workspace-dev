/**
 * UI-MOD-3H — Production Route Manager discovery audit (current tree only).
 */
import fs from "fs";

const path = "public/shared/production-route-manager.html";
const h = fs.readFileSync(path, "utf8");
const body = (h.match(/<body[\s\S]*?>/) || [""])[0];
const classes = ((body.match(/class="([^"]*)"/) || [, ""])[1] || "")
  .split(/\s+/)
  .filter(Boolean);

const idHits = [
  "homeBtn",
  "refreshBtn",
  "exportCsv",
  "peqFilterBtn",
  "search",
  "tableWrap",
  "globalSearchCard",
  "costingPeriodSelect",
].map((id) => [id, h.includes(`id="${id}"`)]);

const classHits = [
  "cp-prm-actions",
  "cp-prm-editor-lifecycle",
  "cp-prm-form-actions",
  "cp-prm-candidate-controls",
  "cp-workbench-summary",
  "cp-prm-route-steps",
  "cp-prm-step-row",
  "cp-prm-stage",
  "lens-pills",
  "peq-filter-drawer",
  "modal-overlay",
  "cost-sheet-modal",
].map((c) => [c, (h.match(new RegExp(c, "g")) || []).length]);

console.log(
  JSON.stringify(
    {
      size: h.length,
      classes,
      bodyAttrs: body.replace(/\s+/g, " ").slice(0, 360),
      theme: /data-sasv-theme="sasv-core"/.test(h),
      costingCss: h.includes("sasv-costing.css"),
      blues2563: (h.match(/#2563eb/gi) || []).length,
      blues1d4: (h.match(/#1d4ed8/gi) || []).length,
      rgba37: (h.match(/rgba\(\s*37,\s*99,\s*235/g) || []).length,
      primaryVar: (h.match(/var\(--primary/g) || []).length,
      arial: (h.match(/Arial/gi) || []).length,
      modalHidden: /\.cost-sheet-modal\.hidden\s*\{/.test(h),
      tableWrapHidden: /#tableWrap\.hidden\s*\{/.test(h),
      modalOverlayHidden: /\.modal-overlay\.hidden\s*\{/.test(h),
      homeEmpty: /id="homeBtn"[^>]*>\s*<\/button>/.test(h),
      refreshEmpty: /id="refreshBtn"[^>]*>\s*<\/button>/.test(h),
      exportEmpty: /id="exportCsv"[^>]*>\s*<\/button>/.test(h),
      peqFilter16: /id="peqFilterBtn"[\s\S]{0,500}?width="16"/.test(h),
      nestedSearch: /\n\s{10,}#search\s*\{/.test(h),
      title: (h.match(/<title>([^<]*)<\/title>/) || [, ""])[1],
      h1: ((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, ""])[1] || "")
        .replace(/\s+/g, " ")
        .trim(),
      idHits: Object.fromEntries(idHits),
      classHits: Object.fromEntries(classHits),
      scriptSrcs: [...h.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]),
    },
    null,
    2
  )
);

// Sibling baselines — capture now for verify
for (const f of [
  "pricing-policy-manager.html",
  "cost-build-manager.html",
  "material-cost-manager.html",
  "costing-control-center.html",
  "cost-sheet-review.html",
]) {
  const s = fs.statSync("public/shared/" + f);
  console.log("BASE", f, s.mtime.toISOString(), s.size);
}
