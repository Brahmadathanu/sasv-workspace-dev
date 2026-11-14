#!/usr/bin/env node
/**
 * PEC build-provenance check — AUTOMATIC, UNAUTHENTICATED, READ-ONLY.
 * Proves nothing about roles/permissions. It compares the SHA-256 of the three
 * canonical PEC client files (+ the service-worker cache name) in this checkout
 * with the bytes a deployed HTTPS host serves. Plain GET, no cookies/tokens.
 *
 *   node scripts/pec-release-provenance-check.mjs --local            (repo hashes only; exit 0)
 *   node scripts/pec-release-provenance-check.mjs --url=https://<host> [--json]
 *
 * Deploy-preview hosts only: Netlify injects one fixed 4-line <div> before </body> of served
 * HTML (issue #399). That exact block is removed from the served HTML before hashing and the
 * result reports netlifyPreviewInjectionStripped. Any other byte difference still FAILS, and
 * the production host strips only the pinned 3-line Netlify comment (see NETLIFY_PRODUCTION_COMMENT).
 *
 * Exit codes: 0 PASS (every served file identical), 1 FAIL (mismatch/HTTP error),
 *             2 BLOCKED (host unreachable / not allow-listed: NOT TESTED, never PASS).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, '..', 'public');
export const PEC_FILES = [
  '/shared/procurement-execution-console.html',
  '/shared/js/procurement-execution-console.js',
  '/shared/css/sasv-procurement-execution-console.css',
  '/sw.js',
];
export const ALLOWED_HOSTS = /^(deploy-preview-\d+--sasv-utilities-hub\.netlify\.app|sasv-utilities-hub\.netlify\.app)$/;
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
// Normalise only line endings: .gitattributes may differ from what a host serves.
const norm = (b) => Buffer.from(b.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
// Exact Netlify deploy-preview injection (observed 14 Nov 2026). Deliberately strict: fixed
// attribute order, hex/uuid ids, fixed comment and script, exactly once.
export const NETLIFY_PREVIEW_INJECTION = /<div data-netlify-deploy-id="[0-9a-f]{24}" data-netlify-site-id="[0-9a-f-]{36}" data-vcs="github" style="position:fixed">\n  <!-- This div is automatically inserted by Netlify for all Deploy Preview URLs\. -->\n  <script async src="\/\.netlify\/scripts\/cdp"><\/script>\n<\/div>\n?/g;
export const isPreviewHost = (h) => /^deploy-preview-\d+--sasv-utilities-hub\.netlify\.app$/.test(h);
// Production host only: Netlify Edge serves the PEC HTML with ONE fixed 3-line comment inserted
// directly after the `<meta charset="UTF-8" />` line (observed 14 Nov 2026, post-deploy of main 6ce8a1cb).
// Pinned byte-for-byte (including utm_id); anything else, a second copy, or another position is NOT
// tolerated and still FAILS. If Netlify changes the text the check fails loudly (never a false PASS).
export const NETLIFY_PRODUCTION_COMMENT =
  '<!-- This site is hosted on Netlify. Anyone can build and deploy a site\n' +
  '     like this one for free: https://netlify.new/?utm_campaign=loops&utm_source=ai-legible&utm_medium=owned&utm_content=comment&utm_id=d8ee0b4c-1a12-4efd-b47c-7ced60eadcac\n' +
  '     Netlify hosting facts for this site: static/SSR served via Netlify Edge. -->\n';
const PRODUCTION_ANCHOR = '<meta charset="UTF-8" />\n';
export const isProductionHost = (h) => h === 'sasv-utilities-hub.netlify.app';
// Returns { buf, stripped }. Preview host: strips only the preview block; production host: strips only
// the pinned comment; HTML only, only if the exact block occurs once (production: right after the anchor).
export function stripNetlifyPreviewInjection(buf, hostname, file) {
  if (!file.endsWith('.html')) return { buf, stripped: false };
  const text = buf.toString('latin1').replace(/\r\n/g, '\n');
  if (isPreviewHost(hostname)) {
    const hits = text.match(NETLIFY_PREVIEW_INJECTION) || [];
    if (hits.length !== 1) return { buf, stripped: false };
    return { buf: Buffer.from(text.replace(NETLIFY_PREVIEW_INJECTION, ''), 'latin1'), stripped: true };
  }
  if (isProductionHost(hostname)) {
    const block = PRODUCTION_ANCHOR + NETLIFY_PRODUCTION_COMMENT;
    if (text.split(NETLIFY_PRODUCTION_COMMENT).length !== 2 || text.split(block).length !== 2) return { buf, stripped: false };
    return { buf: Buffer.from(text.replace(block, PRODUCTION_ANCHOR), 'latin1'), stripped: true };
  }
  return { buf, stripped: false };
}
export const cacheName = (buf) => /const\s+CACHE_NAME\s*=\s*"([^"]+)"/.exec(buf.toString('utf8'))?.[1] || null;

export function localManifest() {
  return Object.fromEntries(PEC_FILES.map((p) => {
    const b = fs.readFileSync(path.join(pub, p));
    return [p, { sha256: sha256(norm(b)), bytes: b.length, ...(p === '/sw.js' ? { cacheName: cacheName(b) } : {}) }];
  }));
}

export function compare(local, served) {
  const rows = [];
  for (const p of PEC_FILES) {
    const s = served[p];
    if (!s || s.error) { rows.push({ file: p, status: 'FAIL', detail: s?.error || 'missing' }); continue; }
    const same = s.sha256 === local[p].sha256;
    const swSame = p !== '/sw.js' || s.cacheName === local[p].cacheName;
    rows.push({ file: p, status: same && swSame ? 'PASS' : 'FAIL',
      detail: same ? (swSame ? 'byte-identical' : 'cache name differs') : 'sha256 differs' });
  }
  return rows;
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const i = a.indexOf('='); return [i > 0 ? a.slice(2, i) : a.slice(2), i > 0 ? a.slice(i + 1) : 'true'];
  }));
  const local = localManifest();
  if (args.local || !args.url) { console.log(JSON.stringify({ mode: 'local', files: local }, null, 2)); return 0; }
  const origin = new URL(args.url);
  if (origin.protocol !== 'https:' || !ALLOWED_HOSTS.test(origin.hostname)) {
    console.error('BLOCKED: host is not an allow-listed PEC Netlify host'); return 2;
  }
  const served = {};
  let injectionStripped = false;
  for (const p of PEC_FILES) {
    try {
      const r = await fetch(new URL(p, origin), { cache: 'no-store', redirect: 'error', credentials: 'omit' });
      if (!r.ok) { served[p] = { error: 'HTTP ' + r.status }; continue; }
      const raw = Buffer.from(await r.arrayBuffer());
      const { buf: b, stripped } = stripNetlifyPreviewInjection(raw, origin.hostname, p);
      injectionStripped = injectionStripped || stripped;
      served[p] = { sha256: sha256(norm(b)), bytes: b.length, ...(p === '/sw.js' ? { cacheName: cacheName(b) } : {}) };
    } catch (e) {
      console.error('BLOCKED: host unreachable from this environment (' + (e.cause?.code || e.name) + '); provenance NOT TESTED');
      return 2;
    }
  }
  const rows = compare(local, served);
  console.log(JSON.stringify({ mode: 'served', host: origin.hostname, netlifyPreviewInjectionStripped: injectionStripped, rows,
    note: 'Proves served client assets only. Says nothing about roles, RLS or server migrations.' }, null, 2));
  return rows.every((r) => r.status === 'PASS') ? 0 : 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await main());
