// WP10 PWA enablement: public/sw.js is pinned and intentionally UNCHANGED, and it caches unknown static assets cache-first by exact
// URL (including the query string). The shared startup module and the page stylesheet are therefore referenced with ?v=<token>,
// a content hash of those two files, so an updated page can never pair with a stale cached helper or stylesheet.
// After editing classification-master-shell.js or sasv-classification-masters.css run:
//   node scripts/wp10-g2-safeguards/stamp-classification-pwa-version.mjs
// The offline test fails if any stamped token is stale.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MODULES = ['categories', 'subcategories', 'product-groups', 'subgroups'];
export const STAMPED = [
  ...MODULES.map(m => `public/shared/js/${m}.js`),
  ...MODULES.map(m => `public/shared/manage-${m}.html`)
];
const HASHED = ['public/shared/js/classification-master-shell.js', 'public/shared/css/sasv-classification-masters.css'];
export const TOKEN_RE = /((?:classification-master-shell\.js|sasv-classification-masters\.css))\?v=([0-9a-f]{10})/g;
export function computeToken() {
  const h = crypto.createHash('sha256');
  for (const f of HASHED) h.update(fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n'));
  return h.digest('hex').slice(0, 10);
}
if (process.argv[1]?.endsWith('stamp-classification-pwa-version.mjs')) {
  const token = computeToken();
  for (const f of STAMPED) {
    const p = path.join(root, f);
    const s = fs.readFileSync(p, 'utf8');
    const next = s.replace(/(classification-master-shell\.js|sasv-classification-masters\.css)(\?v=[0-9a-f]{10})?(?=["'])/g, `$1?v=${token}`);
    if (next !== s) fs.writeFileSync(p, next);
  }
  console.log('stamped', token);
}
