import fs from "fs";

const filePath = "public/shared/production-route-manager.html";
let html = fs.readFileSync(filePath, "utf8");

// Chrome mount (shell) keys off body.sasv-costing. Keep page root; do NOT
// re-add sasv-module--app or sasv-costing.css (geometry isolation).
html = html.replace(/<body([^>]*)>/i, (full, attrs) => {
  let a = attrs;
  if (/class="/i.test(a)) {
    a = a.replace(/class="([^"]*)"/i, (m, cls) => {
      const parts = new Set(
        cls
          .split(/\s+/)
          .filter(Boolean)
          .filter((c) => c !== "sasv-module--app")
      );
      parts.add("sasv-production-route-manager");
      parts.add("sasv-costing"); // chrome/toast only; stylesheet not linked
      return `class="${[...parts].join(" ")}"`;
    });
  }
  return `<body${a}>`;
});

fs.writeFileSync(filePath, html);
console.log((html.match(/<body[^>]*>/) || [""])[0].replace(/\s+/g, " ").slice(0, 240));
console.log("css link", html.includes("sasv-costing.css"));
