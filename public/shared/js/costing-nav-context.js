// MDC-07 / N1 — Shared context chip + breadcrumb (display only).
//
// A tiny display model fed with values that controllers/the shell ALREADY hold. It never fetches, derives,
// defaults or computes anything: a chip exists only when a non-empty value was supplied. It performs no
// lifecycle or costing calculation and issues no RPC. Persisting a selection across lenses (Product Route
// Manager) is N4's controller work; N4 will call costingNavContext.set(...) — N1 only provides the interface.
import { LENS_REGISTRY } from "./costing-suite-registry.js";
import { NAV_BASIS, getBasisText, getLensBasis, escapeNavHtml } from "./costing-nav-groups.js";

/** Context keys N1 can display. Order is the display order. */
export const NAV_CONTEXT_KEYS = Object.freeze(["product", "family", "route", "period", "run"]);

const KEY_LABEL = Object.freeze({
  product: "Product",
  family: "Family",
  route: "Route",
  period: "Governed period",
  run: "Run",
});

const MAX_VALUE_LENGTH = 80;

function cleanValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return "";
  const s = String(value).trim();
  return s.length > MAX_VALUE_LENGTH ? `${s.slice(0, MAX_VALUE_LENGTH - 1)}…` : s;
}

export function createNavContextStore() {
  let state = {};
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => { try { fn({ ...state }); } catch { /* listener errors never break navigation */ } });
  return {
    get: () => ({ ...state }),
    /** Merge; empty/null removes a key. Only the known keys plus "basis" are accepted. */
    set(partial = {}) {
      const next = { ...state };
      for (const key of [...NAV_CONTEXT_KEYS, "basis"]) {
        if (!(key in partial)) continue;
        const raw = key === "basis" ? (Object.values(NAV_BASIS).includes(partial[key]) ? partial[key] : "") : cleanValue(partial[key]);
        if (raw) next[key] = raw;
        else delete next[key];
      }
      const changed = JSON.stringify(next) !== JSON.stringify(state);
      state = next;
      if (changed) emit();
      return changed;
    },
    clear() {
      if (!Object.keys(state).length) return;
      state = {};
      emit();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export const costingNavContext = createNavContextStore();

/**
 * Pure display model.
 * @param {object} p
 * @param {string} p.moduleTitle route title
 * @param {{label:string}|null} p.group resolved nav group of the current lens (or null)
 * @param {string} p.lensId current lens id
 * @param {object} p.context values supplied by shell/controllers (see NAV_CONTEXT_KEYS, optional basis)
 * @param {boolean} [p.periodScoped] whether the lens is period scoped (period chip is shown only then)
 */
export function buildNavContextModel({ moduleTitle = "", group = null, lensId = "", context = {}, periodScoped = false } = {}) {
  const lens = LENS_REGISTRY[lensId] || null;
  const crumbs = [moduleTitle];
  if (group?.label) crumbs.push(group.label);
  if (lens?.label) crumbs.push(lens.label);
  const breadcrumb = crumbs.map((c) => String(c || "").trim()).filter(Boolean);

  const basis = getLensBasis(lensId) || (Object.values(NAV_BASIS).includes(context.basis) ? context.basis : null);
  const chips = [];
  for (const key of NAV_CONTEXT_KEYS) {
    if (key === "period" && !periodScoped) continue;
    const value = cleanValue(context[key]);
    if (!value) continue;
    // A run shown on a fixed-historical lens is labelled as such and is never presented as the current run.
    const label = key === "run" && basis === NAV_BASIS.FIXED_HISTORICAL ? "Run (fixed historical)" : KEY_LABEL[key];
    chips.push({ key, label, value, historical: key === "run" && basis === NAV_BASIS.FIXED_HISTORICAL });
  }
  const basisChip = basis ? { key: "basis", label: "Basis", value: getBasisText(basis), basis } : null;
  return { breadcrumb, chips, basisChip };
}

/** HTML for the shared context bar: breadcrumb nav + chip list. Returns "" when nothing at all is known. */
export function renderNavContextHtml(model) {
  if (!model || !model.breadcrumb.length) return "";
  const last = model.breadcrumb.length - 1;
  const crumbs = model.breadcrumb
    .map((c, i) => `<li class="cp-breadcrumb-item"${i === last ? ' aria-current="page"' : ""}>${escapeNavHtml(c)}</li>`)
    .join("");
  const chips = [...model.chips, ...(model.basisChip ? [model.basisChip] : [])]
    .map((chip) => {
      const cls = `cp-context-chip${chip.historical ? " cp-context-chip-historical" : ""}${chip.key === "basis" ? ` cp-context-chip-basis cp-context-chip-basis-${String(chip.basis).toLowerCase().replace(/_/g, "-")}` : ""}`;
      return chip.key === "basis"
        ? `<li class="${cls}" data-context-key="basis">${escapeNavHtml(chip.value)}</li>`
        : `<li class="${cls}" data-context-key="${escapeNavHtml(chip.key)}"><span class="cp-context-chip-label">${escapeNavHtml(chip.label)}</span> <span class="cp-context-chip-value">${escapeNavHtml(chip.value)}</span></li>`;
    })
    .join("");
  return `<nav class="cp-breadcrumb" aria-label="Breadcrumb"><ol class="cp-breadcrumb-list">${crumbs}</ol></nav>${chips ? `<ul class="cp-context-chips" aria-label="Current context">${chips}</ul>` : ""}`;
}
