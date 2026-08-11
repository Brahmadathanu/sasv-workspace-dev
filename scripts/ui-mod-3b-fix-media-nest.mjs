/**
 * DEPRECATED / DO NOT RUN — UI-MOD-3B fix-media-nest (REJECTED)
 * Follow-on repair for unsafe 3B rollout. Kept for audit history only.
 * Recovery: UI-MOD-3R. Do not execute.
 */
import fs from "fs";
import path from "path";

const files = [
  "costing-control-center.html",
  "material-cost-manager.html",
  "cost-build-manager.html",
  "pricing-policy-manager.html",
  "production-route-manager.html",
];

throw new Error("DEPRECATED: ui-mod-3b-fix-media-nest.mjs — DO NOT RUN (UI-MOD-3B rejected)");

for (const f of files) {
  const p = path.join("public/shared", f);
  let h = fs.readFileSync(p, "utf8");

  // Close @media before #search when search was accidentally nested.
  // Matches: end of a nested rule, then #search still inside @media (max-width: 640px)
  const patterns = [
    // PPM
    `(        .cp-pricing-meta-chrome {
          flex-wrap: wrap;
        }
                    #search {)`,
    // CCC / others with filter-item.search then #search
    `(        .search-card .filter-item.search {
          flex: 1 1 100%;
        }
            #search)`,
    `(        .search-card .filter-item.search {
          flex: 1 1 100%;
        }
                  #search)`,
    `(        .search-card .filter-item.search {
          flex: 1 1 100%;
          min-width: 0;
        }
                    #search)`,
  ];

  // Generic: after any indented block end inside 640 media, insert closing brace before #search
  h = h.replace(
    /( @media \(max-width: 640px\) \{[\s\S]*?)(\n[ \t]+#search(?:\s*,\s*\n[ \t]+#(?:rm|pm)TraceSearch)*)/m,
    (full, mediaPart, searchPart) => {
      // Determine if mediaPart's braces are balanced from the @media {
      const i = mediaPart.indexOf("{");
      const body = mediaPart.slice(i + 1);
      let depth = 1;
      for (const ch of body) {
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
        if (depth === 0) break;
      }
      if (depth === 0) return full; // already closed before #search
      return `${mediaPart}\n      }${searchPart}`;
    }
  );

  fs.writeFileSync(p, h);

  // Report nesting status
  const m = h.match(
    /@media \(max-width: 640px\) \{([\s\S]*?)\n\s*#search/
  );
  console.log(f, m ? "STILL_NESTED_OR_ADJACENT" : "search_not_immediately_after_media");
}

// More precise verification
for (const f of files) {
  const h = fs.readFileSync(path.join("public/shared", f), "utf8");
  const mediaMatches = [...h.matchAll(/@media \(max-width: 640px\) \{/g)];
  let nested = false;
  for (const mm of mediaMatches) {
    const start = mm.index + mm[0].length;
    let depth = 1;
    let end = start;
    for (; end < h.length && depth > 0; end++) {
      if (h[end] === "{") depth++;
      if (h[end] === "}") depth--;
    }
    const block = h.slice(start, end);
    if (/#search\b/.test(block)) nested = true;
  }
  console.log("verify", f, nested ? "BAD_NESTED" : "OK");
}
