import fs from "fs";

const h = fs.readFileSync("public/shared/costing-control-center.html", "utf8");
const body = (h.match(/<body[\s\S]*?>/) || [""])[0];
const m = body.match(/class="([^"]*)"/);
const classes = m ? m[1].split(/\s+/).filter(Boolean) : [];
console.log(
  JSON.stringify(
    {
      classes,
      hasRoot: classes.includes("sasv-costing-control-center"),
      hasSuite: classes.includes("sasv-costing"),
      costingCss: h.includes("sasv-costing.css"),
      modalHidden: /\.cost-sheet-modal\.hidden\s*\{/.test(h),
      tableWrapHidden: /#tableWrap\.hidden\s*\{/.test(h),
      loading: h.includes(".cp-loading-mask"),
      homeEmpty: /id="homeBtn"[^>]*>\s*<\/button>/.test(h),
      blues2563: (h.match(/#2563eb/gi) || []).length,
      blues1d4: (h.match(/#1d4ed8/gi) || []).length,
      rgba37: (h.match(/rgba\(\s*37,\s*99,\s*235/g) || []).length,
    },
    null,
    2
  )
);
const css = fs.readFileSync("public/shared/css/sasv-costing.css", "utf8");
console.log("ccc section", css.includes("COSTING CONTROL CENTER"));
console.log(
  "csr tableWrap still scoped",
  css.includes("body.sasv-cost-sheet-review #tableWrap")
);
console.log("no bare suite tableWrap", !/body\.sasv-costing #tableWrap/.test(css));
for (const f of [
  "material-cost-manager.html",
  "cost-build-manager.html",
  "pricing-policy-manager.html",
  "production-route-manager.html",
]) {
  const s = fs.statSync("public/shared/" + f);
  console.log(f, s.mtime.toISOString(), s.size);
}
