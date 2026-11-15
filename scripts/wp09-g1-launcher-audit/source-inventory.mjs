// WP09 G1 read-only source inventory. Usage: node scripts/wp09-g1-launcher-audit/source-inventory.mjs [outDir]
// Scans every launcher-candidate HTML page in the repository (Electron root + public/) and records: client reachability,
// redirect stubs, data objects touched (.from/.rpc), writer calls, outgoing page links, viewport/media-query presence.
import fs from "node:fs";
import path from "node:path";
import { repoRoot, read, exists } from "./lib.mjs";

const SKIP_DIRS = new Set(["node_modules", ".git", "docs", "tools", "vendor", "scripts", "sql", "supabase", "css", "js", "electron"]);

function listHtml() {
  const out = [];
  for (const f of fs.readdirSync(repoRoot)) if (f.endsWith(".html")) out.push(f);
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (e.name === "vendor" || e.name === "assets" || e.name === "fonts") continue;
        walk(rel);
      } else if (e.name.endsWith(".html")) out.push(rel);
    }
  };
  walk("public");
  return out.sort();
}

function resolveLocal(fromFile, spec) {
  if (/^(https?:)?\/\//.test(spec) || !/\.(m?js)$/.test(spec.split("?")[0])) return null;
  const clean = spec.split("?")[0];
  const rel = clean.startsWith("/") ? clean.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), clean));
  return exists(rel) ? rel : null;
}

function collectScripts(htmlRel, html) {
  const seen = new Set();
  const queue = [];
  for (const m of html.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/g)) {
    const r = resolveLocal(htmlRel, m[1]);
    if (r) queue.push(r);
  }
  for (const m of html.matchAll(/import\s+[^;]*?from\s+["']([^"']+)["']/g)) {
    const r = resolveLocal(htmlRel, m[1]);
    if (r) queue.push(r);
  }
  while (queue.length) {
    const f = queue.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    const src = read(f);
    for (const m of src.matchAll(/(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g)) {
      const r = resolveLocal(f, m[1]);
      if (r) queue.push(r);
    }
  }
  return [...seen].sort();
}

const uniq = (a) => [...new Set(a)].sort();

export function inventory() {
  const pages = [];
  for (const rel of listHtml()) {
    const html = read(rel);
    const scripts = collectScripts(rel, html);
    const code = html + "\n" + scripts.map(read).join("\n");
    const redirectTarget =
      /http-equiv="refresh"[^>]*url=([^"']+)/i.exec(html)?.[1] ||
      /location\.replace\(\s*["']([^"']+)["']/.exec(html)?.[1] ||
      null;
    const title = /<title>([^<]*)/i.exec(html)?.[1]?.replace(/&amp;/g, "&").trim() || "";
    const h1 = /<h1[^>]*>([^<]*)/i.exec(html)?.[1]?.replace(/&amp;/g, "&").trim() || "";
    const tables = uniq([...code.matchAll(/\.from\(\s*["'`]([a-z0-9_]+)["'`]/g)].map((m) => m[1]));
    const rpcs = uniq([...code.matchAll(/\.rpc\(\s*["'`]([a-z0-9_]+)["'`]/g)].map((m) => m[1]));
    const writers = {
      insert: (code.match(/\.insert\(/g) || []).length,
      update: (code.match(/\.update\(/g) || []).length,
      upsert: (code.match(/\.upsert\(/g) || []).length,
      delete: (code.match(/\.delete\(\)/g) || []).length,
    };
    const links = uniq(
      [...code.matchAll(/["'`]((?:\.{1,2}\/|\/)?(?:public\/(?:shared|utilities-hub)\/|shared\/)?[a-z0-9-]+\.html)(?:[?#"'`])/g)].map((m) => m[1]),
    );
    const moduleTokens = uniq([
      ...[...code.matchAll(/["'`]module:([a-z0-9_-]+)["'`]/g)].map((m) => m[1]),
      ...[...code.matchAll(/(?:MODULE_ID|MODULE_KEY|moduleKey)\s*[=:]\s*["']([a-z0-9_-]+)["']/g)].map((m) => m[1]),
    ]);
    const inPublic = rel.startsWith("public/");
    pages.push({
      path: rel,
      electronRoute: rel,
      pwaRoute: inPublic ? rel.replace(/^public\//, "/") : null,
      pwaReachable: inPublic,
      redirectStub: !!redirectTarget,
      redirectTarget,
      title,
      h1,
      viewportMeta: /<meta[^>]+name=["']viewport["']/i.test(html),
      mediaQueries: (code.match(/@media/g) || []).length,
      htmlLines: html.split("\n").length,
      scripts,
      scriptLines: scripts.reduce((n, f) => n + read(f).split("\n").length, 0),
      tables,
      rpcs,
      writers,
      hasWriter: Object.values(writers).some((n) => n > 0),
      outgoingPageLinks: links.filter((l) => !l.endsWith(rel.split("/").pop())),
      moduleTokens,
    });
  }
  return pages;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outDir = process.argv[2];
  const pages = inventory();
  const json = JSON.stringify({ generatedBy: "scripts/wp09-g1-launcher-audit/source-inventory.mjs", pages }, null, 2);
  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "source-page-inventory.json"), json + "\n");
  }
  console.log(`pages=${pages.length} redirectStubs=${pages.filter((p) => p.redirectStub).length} pwaReachable=${pages.filter((p) => p.pwaReachable).length}`);
}
