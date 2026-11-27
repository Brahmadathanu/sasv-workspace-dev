// Enumerates direct client readers of the four classification tables (PostgREST .from("<table>")), excluding the four classification
// management controllers themselves. Used to pin the reader matrix so a NEW direct reader fails CI until the matrix is reviewed.
import fs from 'node:fs';
import path from 'node:path';
export const TABLES = ['categories', 'sub_categories', 'product_groups', 'sub_groups'];
const SELF = new Set(['public/shared/js/categories.js', 'public/shared/js/subcategories.js', 'public/shared/js/product-groups.js', 'public/shared/js/subgroups.js']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'docs', 'supabase', 'scripts', 'dist', 'vendor']);
function* walk(dir, root) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) yield* walk(path.join(dir, e.name), root); } else if (/\.(?:js|mjs|html)$/.test(e.name)) yield path.relative(root, path.join(dir, e.name)).split(path.sep).join('/');
  }
}
export function scanClientReaders(root) {
  const re = /\.from\(\s*["'](categories|sub_categories|product_groups|sub_groups)["']\s*\)/g;
  const out = {};
  for (const rel of walk(root, root)) {
    if (SELF.has(rel)) continue;
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    const tables = [...new Set([...text.matchAll(re)].map(m => m[1]))].sort();
    if (tables.length) out[rel] = tables;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}
