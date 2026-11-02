// CW-13: compact run-status control for phone-width Costing headers (<= 520 px).
//
// On a phone the long run-status chip is replaced VISUALLY by one status-coded icon button that opens a small
// details popover (run ids, valuation dates, APPROVED / DRAFT, and an explicit "not approved" warning). It is a
// presentation layer only: the authoritative badge element (#costingRunStatusBadge, created and updated by
// costing-run-status-badge.js from the governed period run-status row) stays in the DOM with its role="status",
// label and data-* values, and everything shown here is read from it. Nothing is fetched, computed or written
// here, so run binding, the feature flags and desktop behaviour are unchanged (the button is hidden by CSS
// above 520 px). Safe to import on every Costing page: it does nothing when the badge never appears.

export const MOBILE_QUERY = "(max-width: 520px)";

const ICON = {
  // Shape differs by status as well as colour (WCAG 1.4.1): check, check with dot, dashed ring with bar, question.
  approved: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.6 2.6L16 9.6"/>',
  "approved-pending": '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.6 2.6L16 9.6"/><circle cx="19" cy="5" r="2.2" class="dot"/>',
  draft: '<circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/><path d="M12 7.5v5.5M12 16.2v.3"/>',
  empty: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.7a2.5 2.5 0 114.2 1.8c-.8.7-1.8 1.1-1.8 2.3M12 16.3v.3"/>',
};

const STATE_WORD = {
  approved: "APPROVED",
  "approved-pending": "APPROVED, newer DRAFT exists",
  draft: "DRAFT",
  empty: "No run status",
};

/** Pure: popover content from the badge's own text, tone, label and data-* values. */
export function describeRunStatusPopover(snapshot = {}) {
  const tone = ICON[snapshot.tone] ? snapshot.tone : snapshot.tone ? "draft" : "empty";
  const rows = [];
  const add = (label, value) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") rows.push({ label, value: String(value).trim() });
  };
  add("Label", snapshot.text);
  add("Displayed run", snapshot.runDisplayed);
  add("Approved run", snapshot.runApproved);
  add("Newer draft run", snapshot.runDraft || snapshot.newerDraft);
  add("Approved run valuation date", snapshot.valuationApproved);
  add("Draft run valuation date", snapshot.valuationDraft);
  const notApproved = tone === "draft" || tone === "approved-pending" || tone === "empty";
  const warning =
    tone === "draft"
      ? "Not approved. Figures are a draft and are not approved for pricing."
      : tone === "approved-pending"
        ? "A newer draft run is not approved. Screens show the approved run; the draft is not used for pricing."
        : tone === "empty"
          ? "No approved run is available for this period."
          : "";
  return Object.freeze({
    tone,
    state: STATE_WORD[tone],
    rows: Object.freeze(rows),
    warning,
    notApproved,
    detail: String(snapshot.title || "").trim(),
    buttonLabel: `Run status: ${STATE_WORD[tone]}${snapshot.text ? `. ${snapshot.text}` : ""}`,
  });
}

function readSnapshot(badge) {
  const ds = badge.dataset || {};
  return {
    tone: ds.tone || "",
    text: (badge.querySelector?.(".sc-run-status-main")?.textContent || badge.textContent || "").trim(),
    title: badge.getAttribute("aria-label") || badge.title || "",
    runDisplayed: ds.runDisplayed,
    runApproved: ds.runApproved,
    runDraft: ds.runDraft,
    newerDraft: ds.newerDraft,
    valuationApproved: ds.valuationApproved,
    valuationDraft: ds.valuationDraft,
  };
}

function esc(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function installRunStatusPopover(doc = globalThis.document, win = globalThis.window) {
  if (!doc || !win || doc.__scRunStatusPopover) return null;
  doc.__scRunStatusPopover = true;
  let badge = null;
  let button = null;
  let pop = null;
  let open = false;
  let observer = null;

  function ensureControls() {
    if (button) return;
    button = doc.createElement("button");
    button.type = "button";
    button.id = "costingRunStatusBtn";
    button.className = "sc-run-status-btn";
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "costingRunStatusPopover");
    badge.insertAdjacentElement("afterend", button);
    pop = doc.createElement("div");
    pop.id = "costingRunStatusPopover";
    pop.className = "sc-run-status-popover";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Run status details");
    pop.tabIndex = -1;
    pop.hidden = true;
    doc.body.appendChild(pop);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (open) close({ restoreFocus: true });
      else openPopover();
    });
    pop.addEventListener("click", (event) => event.stopPropagation());
    doc.addEventListener("click", () => close({ restoreFocus: false }));
    // Capture phase: while open, Escape closes only this popover (the shell's own Escape handling must not also act).
    doc.addEventListener(
      "keydown",
      (event) => {
        if (!open || event.key !== "Escape") return;
        event.preventDefault();
        event.stopImmediatePropagation();
        close({ restoreFocus: true });
      },
      true,
    );
    const mq = win.matchMedia?.(MOBILE_QUERY);
    mq?.addEventListener?.("change", () => close({ restoreFocus: false }));
    win.addEventListener("resize", () => {
      if (open) position();
    });
  }

  function position() {
    if (!button || !pop) return;
    const r = button.getBoundingClientRect();
    const vw = doc.documentElement.clientWidth;
    const width = pop.getBoundingClientRect().width || Math.min(vw * 0.92, 320);
    // Right edge under the button, then clamped so the whole popover stays inside the viewport (8 px margin).
    const left = Math.min(Math.max(8, r.right - width), Math.max(8, vw - width - 8));
    pop.style.top = `${Math.round(r.bottom + 6)}px`;
    pop.style.left = `${Math.round(left)}px`;
    pop.style.right = "auto";
  }

  function render() {
    if (!badge || !button) return;
    const info = describeRunStatusPopover(readSnapshot(badge));
    button.dataset.tone = info.tone;
    button.setAttribute("aria-label", info.buttonLabel);
    button.title = info.buttonLabel;
    button.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON[info.tone]}</svg>`;
    button.hidden = badge.hidden === true;
    if (button.hidden && open) close({ restoreFocus: false });
    const rowsHtml = info.rows.map((row) => `<dt>${esc(row.label)}</dt><dd>${esc(row.value)}</dd>`).join("");
    pop.dataset.tone = info.tone;
    pop.innerHTML = `<div class="sc-run-status-popover-head"><strong>${esc(info.state)}</strong></div><dl>${rowsHtml}</dl>${
      info.warning ? `<p class="sc-run-status-popover-warn" role="note">${esc(info.warning)}</p>` : ""
    }${info.detail ? `<p class="sc-run-status-popover-detail">${esc(info.detail)}</p>` : ""}`;
  }

  function openPopover() {
    if (!button || button.hidden) return;
    render();
    pop.hidden = false;
    position();
    open = true;
    button.setAttribute("aria-expanded", "true");
    pop.focus({ preventScroll: true });
  }

  function close({ restoreFocus }) {
    if (!open || !pop) return;
    open = false;
    pop.hidden = true;
    button.setAttribute("aria-expanded", "false");
    if (restoreFocus) button.focus({ preventScroll: true });
  }

  function attach(node) {
    badge = node;
    ensureControls();
    render();
    observer?.disconnect();
    observer = new win.MutationObserver(() => {
      render();
      if (open) position();
    });
    observer.observe(badge, { attributes: true, childList: true, characterData: true, subtree: true });
    doc.body.classList.add("sc-run-status-btn-ready");
  }

  const find = () => doc.getElementById("costingRunStatusBadge");
  const first = find();
  if (first) attach(first);
  else {
    const watcher = new win.MutationObserver(() => {
      const node = find();
      if (!node) return;
      watcher.disconnect();
      attach(node);
    });
    watcher.observe(doc.body || doc.documentElement, { childList: true, subtree: true });
  }
  return { isOpen: () => open };
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => installRunStatusPopover());
  else installRunStatusPopover();
}
