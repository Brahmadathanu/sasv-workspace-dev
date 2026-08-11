import fs from "fs";

const h = fs.readFileSync("public/shared/cost-build-manager.html", "utf8");
const body = (h.match(/<body[\s\S]*?>/) || [""])[0];
const m = body.match(/class="([^"]*)"/);
const classes = m ? m[1].split(/\s+/).filter(Boolean) : [];
const css = fs.readFileSync("public/shared/css/sasv-costing.css", "utf8");

console.log(
  JSON.stringify(
    {
      classes,
      hasRoot: classes.includes("sasv-cost-build-manager"),
      hasSuite: classes.includes("sasv-costing"),
      costingCss: h.includes("sasv-costing.css"),
      modalHidden: /\.cost-sheet-modal\.hidden\s*\{/.test(h),
      tableWrapHidden: /#tableWrap\.hidden\s*\{/.test(h),
      loading: h.includes(".cp-loading-mask"),
      exportCsv: h.includes('id="exportCsv"'),
      homeEmpty: /id="homeBtn"[^>]*>\s*<\/button>/.test(h),
      blues2563: (h.match(/#2563eb/gi) || []).length,
      blues1d4: (h.match(/#1d4ed8/gi) || []).length,
      rgba37: (h.match(/rgba\(\s*37,\s*99,\s*235/g) || []).length,
      cbmCssSection: css.includes("COST BUILD MANAGER"),
      csrTableWrapScoped: css.includes("body.sasv-cost-sheet-review #tableWrap"),
      noBareSuiteTableWrap: !/body\.sasv-costing #tableWrap/.test(css),
      peqFilter16: /id="peqFilterBtn"[\s\S]*?width="16"/.test(h),
    },
    null,
    2
  )
);

const base = {
  "material-cost-manager.html": ["2026-08-09T10:39:07.257Z", 150292],
  "pricing-policy-manager.html": ["2026-08-09T09:56:39.731Z", 215291],
  "production-route-manager.html": ["2026-08-09T10:19:19.077Z", 72692],
  "costing-control-center.html": ["2026-08-09T10:31:40.289Z", 134792],
  "cost-sheet-review.html": ["2026-08-09T10:31:24.028Z", 148097],
};
for (const [f, [mtime, size]] of Object.entries(base)) {
  const s = fs.statSync("public/shared/" + f);
  const ok = s.mtime.toISOString() === mtime && s.size === size;
  console.log(ok ? "UNCHANGED" : "CHANGED", f, s.mtime.toISOString(), s.size);
}
