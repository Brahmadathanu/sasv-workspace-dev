// R7: the WP10 helper modules are imported with ?v=<token> so a cached helper can never pair with a different parent version
// (public/sw.js caches by exact URL incl. query and is intentionally unchanged). The token is a content hash of the two helpers
// (ui's own token normalised). After editing wp10-safeguards.js or wp10-safeguards-ui.js run: node scripts/wp10-g2-safeguards/stamp-asset-version.mjs
// The source test fails if the stamped token is stale.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const FILES = ["public/shared/js/products.js", "public/shared/js/costing-suite-readiness.js", "public/shared/js/wp10-safeguards-ui.js"];
const norm = (t) => t.replace(/\r\n/g, "\n").replace(/(wp10-safeguards(?:-ui)?\.js)\?v=[0-9a-f]{10}/g, "$1?v=__V__");
export function computeToken() {
  const h = crypto.createHash("sha256");
  for (const f of ["public/shared/js/wp10-safeguards.js", "public/shared/js/wp10-safeguards-ui.js"]) h.update(norm(fs.readFileSync(path.join(root, f), "utf8")));
  return h.digest("hex").slice(0, 10);
}
export const TOKEN_RE = /(wp10-safeguards(?:-ui)?\.js)\?v=([0-9a-f]{10})/g;
if (import.meta.url === `file://${process.argv[1]}`) {
  const t = computeToken();
  for (const f of FILES) {
    const p = path.join(root, f); const s = fs.readFileSync(p, "utf8");
    fs.writeFileSync(p, s.replace(TOKEN_RE, `$1?v=${t}`));
  }
  console.log("stamped", t);
}
