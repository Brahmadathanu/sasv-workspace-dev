// WP08 G2-0 corrective (#416): one fail-closed access state for the four shared Master Data pages
// (Manage Products, Manage RM BOM, Manage PM BOM, Manage SP BOM).
//
// Client-side control-surface hardening only. It never grants anything, never reads or writes data, never changes a
// permission key, RPC name or argument, and the database remains the sole authority. It exists so that a page which is
// denied, has no session, or could not verify its permission can never present a live-looking writer control.
//
// State machine on <html data-md-access="…">:
//   locked  (default, set in the static HTML before any script runs; also after any failed/denied/errored check)
//   view    (permission verified: can_view without can_edit)
//   edit    (permission verified: can_view AND can_edit)
// Only "edit" releases anything. Elements opt in with static attributes:
//   data-md-writer  a button/control that starts or confirms a write  -> hidden while locked (CSS), inert + aria-disabled in view
//   data-md-field   an input/select/textarea that edits governed data -> inert while not edit
// "inert" is used instead of toggling `disabled`/`readOnly` so the pages' own enable/disable logic is never overwritten and
// is fully intact when the state becomes "edit". A capture-phase guard additionally stops click/submit events (including a
// programmatic .click()) on writer elements unless the state is "edit".

const ATTR = "data-md-access";
const root = typeof document !== "undefined" ? document.documentElement : null;
const touched = new WeakMap(); // element -> { inert: boolean, ariaDisabled: string|null } as it was before we changed it

export const MD_ACCESS = Object.freeze({ LOCKED: "locked", VIEW: "view", EDIT: "edit" });

export function getMasterDataAccess() {
  const v = root?.getAttribute(ATTR);
  return v === MD_ACCESS.VIEW || v === MD_ACCESS.EDIT ? v : MD_ACCESS.LOCKED;
}

/** True only after a successful permission check that granted both view and edit. */
export function canWriteMasterData() {
  return getMasterDataAccess() === MD_ACCESS.EDIT;
}

function applyToElements(level) {
  if (!root) return;
  const els = document.querySelectorAll("[data-md-writer], [data-md-field]");
  for (const el of els) {
    if (level === MD_ACCESS.EDIT) {
      const prev = touched.get(el);
      if (prev) {
        el.inert = prev.inert;
        if (prev.ariaDisabled === null) el.removeAttribute("aria-disabled");
        else el.setAttribute("aria-disabled", prev.ariaDisabled);
        touched.delete(el);
      }
      continue;
    }
    if (!touched.has(el)) touched.set(el, { inert: el.inert, ariaDisabled: el.getAttribute("aria-disabled") });
    el.inert = true;
    el.setAttribute("aria-disabled", "true");
  }
}

/** level: "locked" | "view" | "edit". Anything else is treated as locked (fail closed). */
export function setMasterDataAccess(level) {
  if (!root) return MD_ACCESS.LOCKED;
  const next = level === MD_ACCESS.EDIT || level === MD_ACCESS.VIEW ? level : MD_ACCESS.LOCKED;
  root.setAttribute(ATTR, next);
  applyToElements(next);
  return next;
}

/** Convenience used by the pages after resolving a permission row. Edit requires view. */
export function setMasterDataAccessFromGrant({ canView, canEdit } = {}) {
  if (canView !== true) return setMasterDataAccess(MD_ACCESS.LOCKED);
  return setMasterDataAccess(canEdit === true ? MD_ACCESS.EDIT : MD_ACCESS.VIEW);
}

function blockIfNotEdit(event) {
  if (canWriteMasterData()) return;
  const target = event.target instanceof Element ? event.target.closest("[data-md-writer]") : null;
  if (!target) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

if (root) {
  // Fail closed immediately, even if the static attribute was removed, and before any bootstrap network call.
  if (!root.hasAttribute(ATTR)) root.setAttribute(ATTR, MD_ACCESS.LOCKED);
  applyToElements(getMasterDataAccess());
  for (const type of ["click", "submit", "dblclick", "auxclick"]) document.addEventListener(type, blockIfNotEdit, true);
  document.addEventListener("keydown", (e) => {
    if (canWriteMasterData() || (e.key !== "Enter" && e.key !== " ")) return;
    const t = e.target instanceof Element ? e.target.closest("[data-md-writer]") : null;
    if (t) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
}
