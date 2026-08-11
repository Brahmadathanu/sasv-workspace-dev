/**
 * UI-MOD-3R — reverse identifiable UI-MOD-3B presentation on Production Route Manager.
 * Does NOT checkout/replace the page. Preserves parallel-agent DOM/architecture.
 */
import fs from "fs";

const filePath = "public/shared/production-route-manager.html";
let html = fs.readFileSync(filePath, "utf8");

html = html.replace(
  /\s*<link\s+rel="stylesheet"\s+href="\.\.\/shared\/css\/sasv-costing\.css"\s*\/>\s*/g,
  "\n"
);

html = html.replace(/<body([^>]*)>/i, (full, attrs) => {
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
      if (!parts.includes("sasv-production-route-manager")) {
        parts.push("sasv-production-route-manager");
      }
      return `class="${parts.join(" ")}"`;
    });
  } else {
    a = ` class="sasv-production-route-manager"${a}`;
  }
  return `<body${a}>`;
});

fs.writeFileSync(filePath, html);

const body = (html.match(/<body[^>]*>/) || [""])[0];
console.log(
  JSON.stringify(
    {
      hasCostingCss: html.includes("sasv-costing.css"),
      body: body.slice(0, 220),
      hasPageRoot: body.includes("sasv-production-route-manager"),
      hasSuiteClass: /(?:^|[\s"'])sasv-costing(?:[\s"']|$)/.test(body),
    },
    null,
    2
  )
);
