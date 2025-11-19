// Quick sanity test for CSV header-skip logic used in js/bmr-add.js

function parseCsvText(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const data = [];
  const expectedHeader = ["item", "bn", "batch_size", "uom"];
  const hasHeader = (() => {
    if (!lines.length) return false;
    const firstLine = lines[0].replace(/^\uFEFF/, "");
    const cols = firstLine
      .split(",")
      .map((c) => c.trim().replace(/^"|"$/g, "").toLowerCase());
    if (cols.length !== expectedHeader.length) return false;
    for (let i = 0; i < cols.length; i++) {
      if (cols[i] !== expectedHeader[i]) return false;
    }
    return true;
  })();

  (hasHeader ? lines.slice(1) : lines).forEach((ln, idx) => {
    const rawCols = ln.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const [item, bn, size, uom] = rawCols;
    if (!item || !bn || !uom) {
      const rowNum = hasHeader ? idx + 2 : idx + 1;
      throw new Error(`CSV row ${rowNum} incomplete`);
    }
    data.push({ item, bn, size: parseFloat(size) || null, uom });
  });

  return data;
}

const withHeader = `item,bn,batch_size,uom\nProd A,BN-001,100,kg\nProd B,BN-002,,L`;
const noHeader = `Prod X,BN-010,50,kg\nProd Y,BN-011,25,kg`;
const quotedHeader = `"item","bn","batch_size","uom"\n"Prod Z","BN-100","200","kg"`;

try {
  console.log("withHeader:", parseCsvText(withHeader));
  console.log("noHeader:", parseCsvText(noHeader));
  console.log("quotedHeader:", parseCsvText(quotedHeader));
  console.log("All good.");
} catch (e) {
  console.error("Test failed:", e.message);
  process.exit(1);
}
