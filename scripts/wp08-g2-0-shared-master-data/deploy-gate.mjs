// WP08 G2-0 deployment gate. Prevents step A (PWA registry rows) from being applied before the PWA actually serves the
// reviewed bytes AND a service worker that keeps the new modules out of the cache-first path.
//
//   node scripts/wp08-g2-0-shared-master-data/deploy-gate.mjs manifest            # print reviewed manifest + token
//   node scripts/wp08-g2-0-shared-master-data/deploy-gate.mjs verify <origin>     # GET the deployed PWA; print token only if identical
//   node scripts/wp08-g2-0-shared-master-data/deploy-gate.mjs stamp               # write the expected token into 02_apply SQL
//
// Read-only: only HTTP GETs of public static files. Line endings are normalised (CRLF -> LF) before hashing so a Windows
// checkout and the LF bytes the host serves agree.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { stripNetlifyBanner, NETLIFY_BANNER_ID } from "../costing-acceptance/verify-served-assets.mjs";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** [repo path under public/, URL path the PWA serves]. */
export const GATE_FILES = Object.freeze([
  "shared/manage-products.html", "shared/manage-rm-bom.html", "shared/manage-pm-bom.html", "shared/manage-sp-bom.html",
  "shared/js/products.js", "shared/js/manage-rm-bom.js", "shared/js/manage-pm-bom.js", "shared/js/manage-sp-bom.js",
  "shared/js/master-data-platform.js", "shared/css/shared-ui.css", "shared/css/sasv-bom.css",
].map((p) => ({ repo: `public/${p}`, url: `/${p}` })));

/** The deployed service worker must route the new modules through the network-first branch (not hashed: sw.js changes with every release). */
export const SW_REQUIRED_PATTERNS = Object.freeze([
  String.raw`(?:products|manage-rm-bom|manage-pm-bom|manage-sp-bom|master-data-platform)\.js$`,
  String.raw`(?:shared-ui|sasv-bom)\.css$`,
]);
export const SW_MARKER = "WP08 G2-0";

const norm = (buf) => Buffer.from(String(buf instanceof Buffer ? buf.toString("utf8") : buf).replace(/\r\n/g, "\n"), "utf8");
const sha = (buf) => crypto.createHash("sha256").update(norm(buf)).digest("hex");

export function localManifest(root = repoRoot) {
  return GATE_FILES.map((f) => ({ ...f, sha256: sha(fs.readFileSync(path.join(root, f.repo))) }));
}
export function tokenOf(manifest) {
  const body = manifest.map((m) => `${m.url} ${m.sha256}`).join("\n");
  return `g2-0-${crypto.createHash("sha256").update(`wp08-g2-0-gate\n${body}\n`).digest("hex").slice(0, 32)}`;
}
export function swProblems(swText) {
  const problems = [];
  if (!swText.includes(SW_MARKER)) problems.push(`sw.js lacks the "${SW_MARKER}" network-first marker`);
  for (const p of SW_REQUIRED_PATTERNS) if (!swText.replace(/\\\//g, "/").includes(p.replace(/\\\//g, "/")) && !swText.includes(p)) problems.push(`sw.js lacks network-first pattern ${p}`);
  // The new modules must sit in the network-first branch, i.e. before the "Static → cache-first" fallback.
  const idx = swText.indexOf("master-data-platform");
  const cacheFirst = swText.indexOf("// Static → cache-first");
  if (idx < 0 || cacheFirst < 0 || idx > cacheFirst) problems.push("sw.js: new modules are not ahead of the cache-first fallback");
  return problems;
}

/** fetchImpl(url) -> {status, text()}. Returns {ok, problems, token, normalized}.
 *  Owner-approved (Issue #410): an .html file whose LF-normalised hash fails the plain comparison is accepted ONLY if removing the single,
 *  exact, correctly placed Netlify banner (stripNetlifyBanner / NETLIFY_BANNER_ID, shared with verify-served-assets.mjs) yields the reviewed hash.
 *  JS/CSS and sw.js are never normalised; the token calculation is unchanged. Raw and normalised hashes are returned in `normalized`. */
export async function verifyDeployed(origin, fetchImpl = fetch, root = repoRoot) {
  const problems = [];
  const normalized = [];
  const reviewed = localManifest(root);
  for (const f of reviewed) {
    let res;
    try { res = await fetchImpl(origin + f.url); } catch (e) { problems.push(`${f.url}: ${e.message}`); continue; }
    if (res.status !== 200) { problems.push(`${f.url}: HTTP ${res.status}`); continue; }
    const servedText = await res.text();
    const got = sha(Buffer.from(servedText, "utf8"));
    if (got === f.sha256) continue;
    const stripped = /\.html$/i.test(f.url) ? stripNetlifyBanner(f.url, norm(servedText)) : null;
    if (stripped && sha(stripped) === f.sha256) normalized.push({ url: f.url, normalisation: NETLIFY_BANNER_ID, raw_sha256: got, normalized_sha256: sha(stripped), expected_sha256: f.sha256 });
    else problems.push(`${f.url}: deployed bytes differ from the reviewed file`);
  }
  try {
    const sw = await fetchImpl(origin + "/sw.js");
    if (sw.status !== 200) problems.push(`/sw.js: HTTP ${sw.status}`);
    else problems.push(...swProblems(await sw.text()));
  } catch (e) { problems.push(`/sw.js: ${e.message}`); }
  return { ok: problems.length === 0, problems, normalized, token: problems.length === 0 ? tokenOf(reviewed) : null };
}

export const SQL_A = "docs/master-data-costing/WP08_G2_0_REGISTRY_PROPOSAL_UNAPPLIED/02_apply_pwa_client_rows.sql";
export function stampSql(root = repoRoot) {
  const p = path.join(root, SQL_A);
  const token = tokenOf(localManifest(root));
  const t = fs.readFileSync(p, "utf8").replace(/v_expected constant text := '[^']*';/, `v_expected constant text := '${token}';`);
  fs.writeFileSync(p, t);
  return token;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, origin] = process.argv.slice(2);
  if (cmd === "manifest") {
    const m = localManifest();
    for (const x of m) console.log(`${x.sha256}  ${x.url}`);
    console.log(`TOKEN ${tokenOf(m)}`);
  } else if (cmd === "stamp") {
    console.log(`stamped ${stampSql()}`);
  } else if (cmd === "verify" && origin) {
    const r = await verifyDeployed(origin.replace(/\/$/, ""));
    if (r.ok) {
      for (const n of r.normalized) console.log(`NORMALIZED ${n.url} ${n.normalisation} raw=${n.raw_sha256} normalized=${n.normalized_sha256} expected=${n.expected_sha256}`);
      console.log(`GATE PASS\nGATE TOKEN ${r.token}`);
    }
    else { console.error(`GATE FAIL\n${r.problems.map((p) => " - " + p).join("\n")}`); process.exit(1); }
  } else { console.error("usage: deploy-gate.mjs manifest | stamp | verify <origin>"); process.exit(2); }
}
