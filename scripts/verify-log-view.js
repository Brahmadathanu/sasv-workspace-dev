const fs = require("fs");
const src = fs.readFileSync("./public/shared/js/log-view.js", "utf8");

const bad = [["OLD slice (0,-1) still present", "slice(0, -1)"]];
const good = [
  ["tbody.replaceChildren() still in code", "tbody.replaceChildren();"],
  ["daily_work_log still primary source", '.from("daily_work_log")'],
  [
    "v_fg_bulk_transfer_history used for transfers",
    '.from("v_fg_bulk_transfer_history")',
  ],
  [
    "showDetails still fetches from daily_work_log",
    '.from("daily_work_log")\n    .select(\n      `\n      *,sections',
  ],
];

let issues = 0;
bad.forEach(([label, needle]) => {
  if (src.includes(needle)) {
    console.log("[ISSUE]", label);
    issues++;
  } else console.log("[OK] (absent as expected)", label);
});
good.forEach(([label, needle]) => {
  if (src.includes(needle)) console.log("[OK]", label);
  else {
    console.log("[MISSING]", label);
    issues++;
  }
});
console.log(
  issues === 0
    ? "\nAll sanity checks passed."
    : "\n" + issues + " sanity issue(s) found!",
);
