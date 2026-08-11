/**
 * UI-MOD-3R recovery helper (one-shot). Not a visual migrator.
 * Restores sibling page roots / removes suite CSS link / restores emptied chrome buttons.
 * Safe to keep for audit; do not use for future Costing page migrations.
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const pages = [
  ["costing-control-center.html", "sasv-costing-control-center"],
  ["material-cost-manager.html", "sasv-material-cost-manager"],
  ["cost-build-manager.html", "sasv-cost-build-manager"],
  ["pricing-policy-manager.html", "sasv-pricing-policy-manager"],
];

function extractButton(html, id) {
  const re = new RegExp(`<button\\s+id="${id}"[\\s\\S]*?<\\/button>`, "i");
  const m = html.match(re);
  return m ? m[0] : null;
}

const report = [];
for (const [file, rootClass] of pages) {
  const filePath = path.join("public/shared", file);
  const head = execSync(`git show HEAD:public/shared/${file}`, {
    encoding: "utf8",
    maxBuffer: 30e6,
  });
  let cur = fs.readFileSync(filePath, "utf8");

  cur = cur.replace(
    /\s*<link\s+rel="stylesheet"\s+href="\.\.\/shared\/css\/sasv-costing\.css"\s*\/>\s*/g,
    "\n"
  );

  cur = cur.replace(/<body([^>]*)>/i, (full, attrs) => {
    let a = attrs;
    if (/class="/i.test(a)) {
      a = a.replace(/class="([^"]*)"/i, (m, cls) => {
        const parts = cls
          .split(/\s+/)
          .filter(Boolean)
          .filter(
            (c) =>
              !["sasv-module", "sasv-module--app", "sasv-costing"].includes(c)
          );
        if (!parts.includes(rootClass)) parts.push(rootClass);
        return `class="${parts.join(" ")}"`;
      });
    } else {
      a = ` class="${rootClass}"${a}`;
    }
    return `<body${a}>`;
  });

  for (const id of ["homeBtn", "refreshBtn", "exportCsv"]) {
    const headBtn = extractButton(head, id);
    const curBtn = extractButton(cur, id);
    if (!headBtn || !curBtn) continue;
    const curInner = curBtn
      .replace(/^<button[^>]*>/i, "")
      .replace(/<\/button>$/i, "")
      .trim();
    const headInner = headBtn
      .replace(/^<button[^>]*>/i, "")
      .replace(/<\/button>$/i, "")
      .trim();
    if (curInner.length < 20 && headInner.length > 20) {
      cur = cur.replace(curBtn, headBtn);
      report.push({ file, restoredBtn: id });
    }
  }

  fs.writeFileSync(filePath, cur);
  report.push({
    file,
    rootClass,
    hasCostingCss: cur.includes("sasv-costing.css"),
    hasSasvCostingClass: /class="[^"]*\bsasv-costing\b/.test(cur),
    bodySnippet: (cur.match(/<body[^>]*>/) || [""])[0].slice(0, 200),
  });
}

console.log(JSON.stringify(report, null, 2));
