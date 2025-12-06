const fs = require("fs");
const path =
  "d:\\ELECTRON PROJECTS\\daily-worklog-app\\public\\shared\\js\\stock-purchase-explorer.js";
const txt = fs.readFileSync(path, "utf8");
const lines = txt.split(/\r?\n/);
let open = 0,
  close = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // count braces but ignore those inside strings? simple approach — approximate
  // Remove contents of double and single quoted strings to reduce false positives
  const noStrings = line.replace(
    /(".*?(?<!\\)")|('.*?(?<!\\)')|(`.*?(?<!\\)`)/g,
    ""
  );
  open += (noStrings.match(/\{/g) || []).length;
  close += (noStrings.match(/\}/g) || []).length;
  if (open !== close) {
    console.log(`LINE:${i + 1} OPEN:${open} CLOSE:${close} -> ${line.trim()}`);
  }
}
console.log("FINAL OPEN:", open, "CLOSE:", close);
