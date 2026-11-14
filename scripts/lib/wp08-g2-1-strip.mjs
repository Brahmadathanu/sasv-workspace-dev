// WP08 G2-1 (14 Nov 2026): historical package tests pin costing-suite-shell.js to older base text so that flag-OFF code
// stays provably untouched. G2-1 adds exactly five pieces to the shell (destination permission gate wiring):
//   1 an import block, 2 a comment + armDestinationAccessGate() call, 3 resetDestinationAccess(), 4 markDestinationAccessFailed(),
//   5 setDestinationAccessFromPermissionRows(perms).
// Like sec-a2-strip.mjs, each piece is reversed only if its text occurs EXACTLY ONCE; a duplicated, missing, altered or
// extended piece stays in place, so any other shell change still fails the historical comparison. The behaviour is covered by
// scripts/wp08-g2-1-navigation (resolver, source and browser tests), not by the historical comparisons.

const norm = (src) => String(src).replace(/\r\n/g, "\n");
const once = (t, from, to) => (t.split(from).length - 1 === 1 ? t.replace(from, () => to) : t);

export const WP08_G2_1_SHELL_PIECES = Object.freeze([
  'import {\n  armDestinationAccessGate,\n  markDestinationAccessFailed,\n  resetDestinationAccess,\n  setDestinationAccessFromPermissionRows,\n} from "./costing-destination-access.js";\n',
  "// WP08 G2-1: fail closed — remediation links are offered only after the\n// authenticated permission rows verify the destination module view grant.\narmDestinationAccessGate();\n",
  "  resetDestinationAccess();\n",
  "  markDestinationAccessFailed();\n",
  "  setDestinationAccessFromPermissionRows(perms);\n",
]);

export function stripWp08G21Shell(src) {
  return WP08_G2_1_SHELL_PIECES.reduce((t, piece) => once(t, piece, ""), norm(src));
}

// Files whose G2-1 change is too extensive to reverse piecewise (the resolver gained four routes, a permission gate and href
// helpers; the control-center consumer gained one import and one line). They are reverted ONLY when the LF-normalised text is
// byte-identical to the reviewed G2-1 revision (SHA-256 pin) and the revert target is the exact file at the G2-1 start
// commit. Any other edit changes the hash, is not reverted, and fails the historical comparison. Update the pin only with
// the same owner review as the change itself.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const WP08_G2_1_START_COMMIT = "26e3f9f29f5a22bdc6cdd82b66ba19918047ad51";
export const WP08_G2_1_PINNED_FILES = Object.freeze({
  "public/shared/js/costing-suite-control-center.js": "9b4433b559cedff47b64e224a9094d7f09edc3ddd012fe0a8b53f18e0cdd03d9",
  "public/shared/js/costing-suite-recommended-ui-route.js": "8140bdc7882efde6e6e2c5093037d78f8ac869c33a2fba8fce530c770f72eb3f",
});
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function stripWp08G21Pinned(rel, text) {
  const key = Object.keys(WP08_G2_1_PINNED_FILES).find((k) => String(rel).replace(/\\/g, "/").endsWith(k));
  if (!key) return text;
  const lf = norm(text);
  if (createHash("sha256").update(lf).digest("hex") !== WP08_G2_1_PINNED_FILES[key]) return text;
  return norm(execFileSync("git", ["show", `${WP08_G2_1_START_COMMIT}:${key}`], { cwd: root, encoding: "utf8", maxBuffer: 1 << 26 }));
}
