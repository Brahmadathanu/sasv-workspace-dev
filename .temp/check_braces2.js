const fs = require("fs");
const path =
  "d:\\ELECTRON PROJECTS\\daily-worklog-app\\public\\shared\\js\\stock-purchase-explorer.js";
const txt = fs.readFileSync(path, "utf8");
const lines = txt.split(/\r?\n/);
let open = 0,
  close = 0;
let peak = { diff: 0, line: 0 };
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const noStrings = line.replace(
    /(".*?(?<!\\)")|('.*?(?<!\\)')|(`.*?(?<!\\)`)/g,
    ""
  );
  open += (noStrings.match(/\{/g) || []).length;
  close += (noStrings.match(/\}/g) || []).length;
  if (open !== close) {
    console.log(`LINE:${i + 1} OPEN:${open} CLOSE:${close} -> ${line.trim()}`);
  }
  if (open - close > peak.diff) {
    peak.diff = open - close;
    peak.line = i + 1;
  }
}
console.log("FINAL OPEN:", open, "CLOSE:", close);
console.log("PEAK DIFF:", peak.diff, "AT LINE", peak.line);
