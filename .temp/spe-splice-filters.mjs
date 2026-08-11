import fs from "fs";

const path = "public/shared/js/stock-purchase-explorer.js";
let s = fs.readFileSync(path, "utf8");
const start = s.indexOf("// Mobile filters modal elements");
const end = s.indexOf("// Data loading functions");
if (start < 0 || end < 0) {
  console.error("markers not found", start, end);
  process.exit(1);
}
const block = fs.readFileSync(".temp/spe-filters-js-block.js", "utf8");
s = s.slice(0, start) + block + s.slice(end);
fs.writeFileSync(path, s);
console.log("spliced filters block", start, end, "new length", s.length);
