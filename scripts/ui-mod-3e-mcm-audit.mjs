import { execSync } from "child_process";
import fs from "fs";

const re =
  /\.icon-btn\.icon-btn-primary:hover,[\s\S]*?button\.icon-btn-primary:focus-visible\s*\{[\s\S]*?\}/;
const path = "public/shared/material-cost-manager.html";
const cur = fs.readFileSync(path, "utf8");
const head = execSync("git show HEAD:public/shared/material-cost-manager.html", {
  encoding: "utf8",
  maxBuffer: 30e6,
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
      needsRestore:
        !!(hm && cm && cm[0].length < 1000 && hm[0].includes(".cost-sheet-modal.hidden")),
      homeEmpty: /id="homeBtn"[^>]*>\s*<\/button>/.test(cur),
      body: (cur.match(/<body[^>]*>/) || [""])[0].replace(/\s+/g, " ").slice(0, 240),
    },
    null,
    2
  )
);
