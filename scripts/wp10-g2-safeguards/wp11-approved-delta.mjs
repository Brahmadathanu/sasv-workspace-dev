// WP11 (PM BOM responsive fix, hub-cache-v394) narrow permits for the WP10 G2 scope guards (S4/S5).
// These are NOT blanket exceptions: each permit is an exact, content-pinned delta and every other change still fails.
import crypto from "node:crypto";

const lf = (s) => String(s).replace(/\r\n/g, "\n");
const sha256 = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex");

export const WP11_PM_BOM_PATH = "public/shared/manage-pm-bom.html";
/** SHA-256 of the LF-joined ADDED lines of the reviewed WP11 CSS block (pure additions, zero removed lines). */
export const WP11_PM_BOM_ADDED_SHA256 = "8c8239df2affd7498e60d16fc11fb567f83f4e60fd8f1d16f38458ea1a740c15";

/** diffU0: output of `git diff -U0 <base> -- public/shared/manage-pm-bom.html`. Empty diff (already on base) is approved. */
export function pmBomDeltaApproved(diffU0) {
  const lines = lf(diffU0).split("\n").filter(Boolean);
  if (!lines.length) return true;
  const body = lines.filter((l) => !/^(diff --git|index |--- |\+\+\+ |@@ )/.test(l));
  if (body.some((l) => !l.startsWith("+"))) return false; // any removed or context line => not the reviewed pure addition
  const added = body.map((l) => l.slice(1)).join("\n");
  return sha256(added) === WP11_PM_BOM_ADDED_SHA256;
}

const APPROVED_PREFIX = 'const CACHE_NAME = "hub-cache-v394"; // WP11 PM BOM header toolbar wraps at phone width (genuine 390px overflow fix); v393 was ';

/**
 * The only approved service-worker delta is line 2: the v393 release line becomes the v394 line that embeds the v393 comment verbatim.
 * Returns `current` with that single line mapped back to the base line, so the caller can assert byte-identity of everything else
 * (any route / network-first / permission drift survives normalisation and fails). If current already equals base, returns it unchanged.
 */
export function normaliseApprovedSwDelta(current, existing) {
  const cur = lf(current).split("\n"), base = lf(existing).split("\n");
  if (cur[1] === base[1]) return cur.join("\n");
  const m = /^const CACHE_NAME = "hub-cache-v393"; \/\/ (.*)$/.exec(base[1]);
  if (!m || cur[1] !== APPROVED_PREFIX + m[1]) return cur.join("\n"); // not the approved delta: leave as is (comparison will fail)
  cur[1] = base[1];
  return cur.join("\n");
}

// MIS G7 release candidate (owner-authorised bounded PWA-freshness review): the ONLY other approved public/sw.js delta is one five-line
// network-first block (three comment lines + two pathname rules; CACHE_NAME untouched). Content-pinned like the WP11 permits; stripped before the
// byte-identity comparison so any other route / caching / permission drift still fails.
export const MIS_G7_SW_BLOCK_SHA256 = "9fd891e9a726757387278ad2269b2cdf7968b61cbe73565b157a840af45223b8";
export function stripApprovedMisSwBlock(current) {
  const text = lf(current); const start = text.indexOf("    // MIS G7 release candidate:");
  if (start < 0) return text;
  const endMarker = "    /\\/shared\\/css\\/sasv-mis-batch-governance\\.css$/.test(url.pathname) ||\n";
  const end = text.indexOf(endMarker, start); if (end < 0) return text;
  const block = text.slice(start, end + endMarker.length);
  return sha256(block) === MIS_G7_SW_BLOCK_SHA256 ? text.slice(0, start) + text.slice(end + endMarker.length) : text;   // unknown block: leave in place so the comparison fails
}
