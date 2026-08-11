import fs from "fs";

const checks = [
  ["costing-control-center.html", "sasv-costing-control-center"],
  ["material-cost-manager.html", "sasv-material-cost-manager"],
  ["cost-build-manager.html", "sasv-cost-build-manager"],
  ["pricing-policy-manager.html", "sasv-pricing-policy-manager"],
  ["production-route-manager.html", "sasv-production-route-manager"],
  ["cost-sheet-review.html", "sasv-cost-sheet-review"],
];

for (const [f, root] of checks) {
  const h = fs.readFileSync(`public/shared/${f}`, "utf8");
  const body = (h.match(/<body[^>]*>/) || [""])[0];
  const cm = body.match(/class="([^"]*)"/);
  const classes = cm ? cm[1].split(/\s+/).filter(Boolean) : [];
  const hasSuite = classes.includes("sasv-costing");
  console.log(
    JSON.stringify({
      f,
      root: classes.includes(root),
      classes,
      hasSuite,
      costingCss: h.includes("sasv-costing.css"),
      modalHiddenCss: /\.cost-sheet-modal\.hidden\s*\{/.test(h),
      modalDom: /id="costSheetModal"/.test(h),
      homeEmpty: /id="homeBtn"[^>]*>\s*<\/button>/.test(h),
    })
  );
}
