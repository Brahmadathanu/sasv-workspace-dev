/**
 * WP08 G2-1 — destination access state for permission-aware navigation.
 *
 * Reads nothing and grants nothing. The Costing shell feeds it the rows it
 * already received from the authenticated `get_user_permissions` call; the
 * recommended-route resolver then offers a link only when the destination
 * module's own permission target is verified `can_view === true`.
 *
 * Fail closed once armed: unknown (not yet resolved), failed or missing rows
 * are never treated as granted. Before the shell arms it (unit tests, non-shell
 * hosts) the gate is a pass-through so the pure resolver stays testable.
 */

export const DESTINATION_ACCESS = Object.freeze({
  GRANTED: "granted",
  DENIED: "denied",
  UNKNOWN: "unknown",
});

let armed = false;
let resolved = false;
let failed = false;
let byTarget = new Map();

/** Shell calls this once at module load, before any permission load or render. */
export function armDestinationAccessGate() {
  armed = true;
}

export function isDestinationAccessGateArmed() {
  return armed;
}

/** Drop every grant (permission refresh start, sign-out). */
export function resetDestinationAccess() {
  resolved = false;
  failed = false;
  byTarget = new Map();
}

export function markDestinationAccessFailed() {
  resolved = true;
  failed = true;
  byTarget = new Map();
}

/** @param {Array<{target?: string, can_view?: unknown}>} rows */
export function setDestinationAccessFromPermissionRows(rows) {
  const next = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row && typeof row.target === "string" && row.target) {
      next.set(row.target, row.can_view === true);
    }
  }
  byTarget = next;
  failed = false;
  resolved = true;
}

/** Strict: only boolean `true` from a resolved, non-failed load grants view. */
export function getDestinationViewAccess(permissionTarget) {
  if (!resolved || failed) return DESTINATION_ACCESS.UNKNOWN;
  if (!permissionTarget || !byTarget.has(permissionTarget)) {
    return DESTINATION_ACCESS.DENIED;
  }
  return byTarget.get(permissionTarget) === true
    ? DESTINATION_ACCESS.GRANTED
    : DESTINATION_ACCESS.DENIED;
}
