// public/shared/js/pec-modal-stack.js
//
// PEC modal stack: ONE source of truth for "which dialog is on top" and the ONLY
// Escape handler that may dismiss a dialog layer.
//
// Why this exists: every PEC dialog is a `.modal-backdrop` with the same CSS
// z-index, so visual stacking used to be decided by DOM order while Escape used a
// hard-coded priority array. The two disagreed for 20+ pairs (e.g. Select Vendor
// opened from an indent line sits above the indent modal on screen, but Escape
// closed the indent modal underneath it), and a held key closed several layers.
//
// Contract
//  - A dialog is "open" iff `.modal-backdrop.show`. Open order == stack order, and
//    each open dialog receives z-index BASE_Z + depth so what you SEE on top is
//    what Escape dismisses.
//  - The stack is reconciled synchronously at every keydown (pending
//    MutationObserver records are flushed first), so there is no timing window
//    between a dialog opening/closing and the next Escape.
//  - One physical key press dismisses at most one layer. Auto-repeat (e.repeat)
//    and IME composition never dismiss anything.
//  - A top dialog whose closer refuses (busy writer, unsaved-change guard,
//    confirmation) still CONSUMES the key: nothing underneath is closed.
//  - Drawers/menus/popovers are "transient layers" owned by a dialog (or the
//    page). They take Escape first only when they belong to the topmost layer.
//  - Focus returns to the control that was focused when the dialog opened, unless
//    the closing code already moved focus somewhere real.
//  - Dialogs opened in the same task keep their ACTUAL open order (taken from the ordered
//    MutationRecords), never DOM order. Re-opening moves a dialog to the top.
//  - Portaled drawers take their z-index from the stack (transientZ), so a dialog opened
//    above their owner always covers them.
//  - Escape performs no business action: closers are the dialogs' existing
//    dismiss functions (cancel/close), never confirm handlers.

export const MODAL_BASE_Z = 9000; // below toast layer (10000), above page chrome
const Z_STEP = 10;
const SELECTOR = ".modal-backdrop";

export function createModalStack({ doc = document, win = window } = {}) {
  /** @type {HTMLElement[]} open dialogs, bottom -> top */
  let stack = [];
  const initiators = new WeakMap();
  const closers = new Map(); // backdrop id -> () => unknown (return false = refused)
  const transientSources = []; // () => [{ owner: Element|null, close: () => void }]
  let lastFocus = null;
  let observer = null;
  let installed = false;

  const isOpen = (el) => el.classList.contains("show");

  function visibleFocusable(el) {
    if (!(el instanceof win.HTMLElement) || !doc.contains(el)) return false;
    if (el.matches(":disabled") || el.hidden) return false;
    return el.getClientRects().length > 0;
  }

  function onFocusIn(e) {
    const t = e.target;
    if (t instanceof win.HTMLElement && !t.closest(SELECTOR + ".show")) lastFocus = t;
    else if (t instanceof win.HTMLElement && stack.length) {
      // keep the most recent control that lives in the next-lower layer
      const owner = t.closest(SELECTOR);
      if (owner && owner !== stack[stack.length - 1]) lastFocus = t;
    }
  }

  const hasShow = (cls) => /(^|\s)show(\s|$)/.test(cls || "");

  function release(el) {
    el.style.zIndex = "";
    const from = initiators.get(el);
    initiators.delete(el);
    const active = doc.activeElement;
    // Focus is "lost" when it is on nothing, on a detached element, inside the dialog that was
    // just dismissed, or on any element that is attached but no longer rendered.
    const focusLost =
      !active ||
      active === doc.body ||
      !doc.contains(active) ||
      el.contains(active) ||
      active.getClientRects().length === 0;
    if (focusLost && visibleFocusable(from)) {
      try { from.focus({ preventScroll: true }); } catch { /* no-op */ }
    }
  }

  function moveToTop(el) {
    const i = stack.indexOf(el);
    if (i >= 0) stack.splice(i, 1);
    else {
      const active = doc.activeElement;
      initiators.set(
        el,
        active instanceof win.HTMLElement && active !== doc.body && !el.contains(active)
          ? active
          : lastFocus,
      );
    }
    stack.push(el);
  }

  function drop(el) {
    const i = stack.indexOf(el);
    if (i >= 0) { stack.splice(i, 1); release(el); }
  }

  /** Apply ordered MutationRecords so the stack reflects actual open order. */
  function applyRecords(records) {
    const byEl = new Map();
    records.forEach((r, i) => {
      if (r.type !== "attributes") return;
      if (!byEl.has(r.target)) byEl.set(r.target, []);
      byEl.get(r.target).push(i);
    });
    records.forEach((r, i) => {
      if (r.type === "attributes" && r.target.matches?.(SELECTOR)) {
        const idx = byEl.get(r.target);
        const pos = idx.indexOf(i);
        const after = pos < idx.length - 1 ? records[idx[pos + 1]].oldValue : r.target.getAttribute("class");
        const was = hasShow(r.oldValue);
        const now = hasShow(after);
        if (!was && now) moveToTop(r.target);
        else if (was && !now) drop(r.target);
      } else if (r.type === "childList") {
        r.removedNodes.forEach((n) => {
          if (n instanceof win.Element) [n, ...n.querySelectorAll(SELECTOR)].forEach((x) => stack.includes(x) && drop(x));
        });
        r.addedNodes.forEach((n) => {
          if (!(n instanceof win.Element)) return;
          [n, ...n.querySelectorAll(SELECTOR)].filter((x) => x.matches(SELECTOR) && isOpen(x)).forEach(moveToTop);
        });
      }
    });
  }

  /** Reconcile the stack with the DOM. Safe to call at any time. Returns the stack. */
  function sync(records = []) {
    const pending = observer ? observer.takeRecords() : [];
    if (records.length || pending.length) applyRecords([...records, ...pending]);
    // Authoritative final check against the DOM (covers anything opened before install()).
    const open = Array.from(doc.querySelectorAll(SELECTOR)).filter(isOpen);
    const openSet = new Set(open);
    stack.filter((el) => !openSet.has(el)).forEach(drop);
    for (const el of open) if (!stack.includes(el)) moveToTop(el);
    stack.forEach((el, i) => {
      const z = String(MODAL_BASE_Z + (i + 1) * Z_STEP);
      if (el.style.zIndex !== z) el.style.zIndex = z;
    });
    return stack;
  }

  function top() {
    const s = sync();
    return s.length ? s[s.length - 1] : null;
  }

  function fallbackClose(el) {
    const btn = el.querySelector(
      "[data-pec-dismiss], .modal-close-btn, button[aria-label='Close']",
    );
    if (btn && !btn.disabled) { btn.click(); return true; }
    return false;
  }

  /** Dismiss the top dialog through its registered closer. Returns the layer handled. */
  function dismissTop(el) {
    // Protected or busy (in-flight writer) dialogs consume Escape and stay open.
    if (el.dataset.pecEscape === "protect" || el.getAttribute("aria-busy") === "true") return;
    const closer = closers.get(el.id);
    if (closer) { closer(); return; }
    fallbackClose(el); // dynamically created dialogs: use their own close control
  }

  function openTransient(topEl) {
    const found = [];
    for (const source of transientSources) {
      for (const layer of source() || []) {
        const owner = layer.owner || null;
        // belongs to the topmost layer (a dialog, or the page when none is open)
        if (owner === topEl || (!owner && !topEl)) found.push(layer);
        else if (owner && topEl && topEl.contains(owner)) found.push(layer);
      }
    }
    return found.length ? found[found.length - 1] : null;
  }

  function onKeydown(e) {
    if (e.key !== "Escape") return;
    if (e.isComposing || e.keyCode === 229) return; // IME: never dismiss
    if (e.__pecEscapeHandled) return;
    const topEl = top();
    const layer = openTransient(topEl);
    if (!layer && !topEl) return; // nothing of ours open: leave the key alone
    e.__pecEscapeHandled = true;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return; // held key: consume, never dismiss a second layer
    if (layer) { layer.close(); sync(); return; }
    dismissTop(topEl);
    sync();
  }

  return {
    /** Register the dismiss function for a dialog (by backdrop id). Return false to refuse. */
    registerCloser(id, fn) { closers.set(id, fn); },
    registerClosers(map) { Object.entries(map).forEach(([id, fn]) => closers.set(id, fn)); },
    /** Register a source of transient layers (drawers, menus) -> [{owner, close}] */
    registerTransientSource(fn) { transientSources.push(fn); },
    sync,
    top,
    /** z-index for a portaled drawer/popover anchored to `anchor`: above its owning dialog, below the next layer. */
    transientZ(anchor) {
      const owner = anchor instanceof win.Element ? anchor.closest(SELECTOR) : null;
      sync();
      const z = owner && stack.includes(owner) ? Number(owner.style.zIndex) : MODAL_BASE_Z;
      return z + Z_STEP / 2 - (owner && stack.includes(owner) ? 0 : Z_STEP);
    },
    get depth() { return sync().length; },
    stack() { return sync().slice(); },
    install() {
      if (installed) return;
      installed = true;
      doc.addEventListener("focusin", onFocusIn, true);
      // Bubble phase: element-level handlers (search popovers, inline editors)
      // that stopPropagation() keep dismissing their own innermost layer first.
      doc.addEventListener("keydown", onKeydown, false);
      const isBackdrop = (n) => n instanceof win.Element && (n.matches(SELECTOR) || !!n.querySelector?.(SELECTOR));
      observer = new win.MutationObserver((records) => {
        // Only dialog open/close/creation can change the stack.
        const mine = records.filter((r) => isBackdrop(r.target) || [...r.addedNodes, ...r.removedNodes].some(isBackdrop));
        if (mine.length) sync(mine);
      });
      observer.observe(doc.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class"],
        attributeOldValue: true,
      });
      sync();
    },
    /** test seam */
    _handleKey: onKeydown,
  };
}
