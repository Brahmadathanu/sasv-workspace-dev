import { execSync } from "child_process";
import fs from "fs";

const re =
  /\.icon-btn\.icon-btn-primary:hover,[\s\S]*?button\.icon-btn-primary:focus-visible\s*\{[\s\S]*?\}/;
const path = "public/shared/pricing-policy-manager.html";
const cur = fs.readFileSync(path, "utf8");
const head = execSync("git show HEAD:public/shared/pricing-policy-manager.html", {
  encoding: "utf8",
  maxBuffer: 40e6,
});
const hm = head.match(re);
const cm = cur.match(re);
console.log(
  JSON.stringify(
    {
      blues2563: (cur.match(/#2563eb/gi) || []).length,
      blues1d4: (cur.match(/#1d4ed8/gi) || []).length,
      rgba37: (cur.match(/rgba\(\s*37,\s*99,\s*235/g) || []).length,
      modalHidden: /\.cost-sheet-modal\.hidden\s*\{/.test(cur),
      tableWrapHidden: /#tableWrap\.hidden\s*\{/.test(cur),
      loading: cur.includes(".cp-loading-mask"),
      headSpan: hm?.[0]?.length || 0,
      curMatch: cm?.[0]?.length || 0,
      needsRestore: !!(
        hm &&
        cm &&
        cm[0].length < 2000 &&
        hm[0].includes(".cost-sheet-modal.hidden")
      ),
      costingCss: cur.includes("sasv-costing.css"),
      homeEmpty: /id="homeBtn"[^>]*>\s*<\/button>/.test(cur),
      body: (cur.match(/<body[^>]*>/) || [""])[0].replace(/\s+/g, " ").slice(0, 280),
      hasSearch: cur.includes('id="search"'),
      hasRmTrace: cur.includes('id="rmTraceSearch"'),
      title: (cur.match(/<title>([^<]*)<\/title>/) || [, ""])[1],
      h1: (cur.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, ""])[1]
        .replace(/\s+/g, " ")
        .trim(),
      workspaceTabs: (cur.match(/cp-pricing-direct-workspace-tab/g) || []).length,
      managerTab: (cur.match(/cp-manager-tab-card/g) || []).length,
    },
    null,
    2
  )
);

for (const f of [
  "cost-build-manager.html",
  "material-cost-manager.html",
  "production-route-manager.html",
  "costing-control-center.html",
  "cost-sheet-review.html",
]) {
  const s = fs.statSync("public/shared/" + f);
  console.log("BASE", f, s.mtime.toISOString(), s.size);
}
