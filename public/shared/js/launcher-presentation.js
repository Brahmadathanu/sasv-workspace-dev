// WP09 G2 — shared launcher presentation logic (A→C families, shared search, per-user local Quick Access).
// Pure functions only: no DOM, no network, no Supabase import. Runtime visibility ALWAYS comes from the existing
// permission-filtered registry results; nothing here grants, widens or caches access.
//
// Feature flag (default OFF; only the exact value "1" enables the whole new experience in THIS browser):
//   localStorage.setItem("LAUNCHER_PRESENTATION_V1", "1"); location.reload();     // ON : subgroup headings, collapsible
//                                                                                     families, shared search, PWA Quick Access
//   localStorage.removeItem("LAUNCHER_PRESENTATION_V1"); location.reload();       // OFF: today's launcher, unchanged
// Independent of the eleven COSTING_* release flags.
import { LAUNCHER_PRESENTATION_CONTRACT } from "./launcher-presentation-contract.js";

export const LAUNCHER_PRESENTATION_V1 = "LAUNCHER_PRESENTATION_V1";
export const FALLBACK_SUBGROUP = "More";
export const PIN_LIMIT = 10;

export function isLauncherPresentationV1Enabled(storage) {
  try {
    // Access to the storage property itself can throw in restricted browsers.
    const source = storage === undefined ? globalThis.localStorage : storage;
    return source?.getItem?.(LAUNCHER_PRESENTATION_V1) === "1";
  } catch {
    return false;
  }
}

const norm = (v) => String(v ?? "").trim().toLowerCase().replace(/_/g, "-");
const slug = (v) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Contract lookup. A key is "contracted" for a section only when its contract section equals the registry section
 * the row actually lives in: a cross-section disagreement is treated as unknown (flat, fallback subgroup), never
 * merged into another section's family.
 */
export function getContractEntry(moduleKey, liveSectionKey, contract = LAUNCHER_PRESENTATION_CONTRACT) {
  const hit = contract[norm(moduleKey)];
  if (!hit) return null;
  if (liveSectionKey != null && norm(hit[0]) !== norm(liveSectionKey)) return null;
  return { section: hit[0], subgroup: hit[1], family: hit[2] || "" };
}

/**
 * Plans one section. `items` must already be ordered (sort_order, label) and contain only registry rows of this
 * section ({ moduleKey, label, ... }). Returns { subgroups: [{ label, fallback, nodes: [ {kind:"module",item} |
 * {kind:"family", id, label, items} ] }] }. Every input item appears exactly once (nothing can vanish).
 */
export function planSection(items, sectionKey, contract = LAUNCHER_PRESENTATION_CONTRACT) {
  const subgroups = new Map();
  const familyNodes = new Map();
  for (const item of items) {
    const entry = getContractEntry(item.moduleKey, sectionKey, contract);
    const subLabel = entry ? entry.subgroup : FALLBACK_SUBGROUP;
    if (!subgroups.has(subLabel)) subgroups.set(subLabel, { label: subLabel, fallback: !entry, nodes: [] });
    const sub = subgroups.get(subLabel);
    if (entry && entry.family) {
      const id = `${slug(sectionKey)}--${slug(subLabel)}--${slug(entry.family)}`;
      if (!familyNodes.has(id)) {
        const node = { kind: "family", id, label: entry.family, items: [] };
        familyNodes.set(id, node);
        sub.nodes.push(node);
      }
      familyNodes.get(id).items.push(item);
    } else {
      sub.nodes.push({ kind: "module", item });
    }
  }
  const ordered = [...subgroups.values()].sort((a, b) => Number(a.fallback) - Number(b.fallback));
  return { subgroups: ordered };
}

// ---------------------------------------------------------------------------------------------------------------
// Shared search matcher: label, description, approved subgroup and real existing aliases. Flat, module-level.
// Callers pass ONLY entries the user may see (permission-filtered); locked entries carry locked:true and are
// returned flagged so callers keep them disabled. The matcher never invents or enables a destination.
export function normalizeSearchText(value) {
  return String(value ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

export function matchModules(query, entries, { limit = Infinity } = {}) {
  const terms = normalizeSearchText(query).split(" ").filter(Boolean);
  if (!terms.length) return [];
  const scored = [];
  for (const entry of entries) {
    const label = normalizeSearchText(entry.label);
    const aliases = (entry.aliases || []).map(normalizeSearchText);
    const subgroup = normalizeSearchText(entry.subgroup);
    const description = normalizeSearchText(entry.description);
    let total = 0;
    let ok = true;
    for (const term of terms) {
      let best = 0;
      if (label.startsWith(term) || label.split(" ").some((w) => w.startsWith(term))) best = 100;
      else if (label.includes(term)) best = 80;
      else if (aliases.some((a) => a.includes(term))) best = 60;
      else if (subgroup.includes(term)) best = 40;
      else if (description.includes(term)) best = 20;
      if (!best) { ok = false; break; }
      total += best;
    }
    if (ok) scored.push({ entry, score: total + (label === terms.join(" ") ? 1000 : 0) });
  }
  scored.sort((a, b) => b.score - a.score || String(a.entry.label).localeCompare(String(b.entry.label)));
  return scored.slice(0, limit).map((s) => s.entry);
}

// ---------------------------------------------------------------------------------------------------------------
// Per-user LOCAL Quick Access. Same storage key shape as the Electron launcher, so existing Electron pins keep
// working. No server persistence and no cross-device sync is implied or implemented.
export function scopeFromUser(user) {
  return norm(user?.id || user?.email || "guest") || "guest";
}
export function pinsStorageKey(scope) {
  return `sasv-workspace:${scope}:pinned-modules`;
}
export function readPins(storage, scope) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(pinsStorageKey(scope)) || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean).map((v) => String(v)) : [];
  } catch {
    return [];
  }
}
function writePins(storage, scope, items) {
  try {
    storage?.setItem?.(pinsStorageKey(scope), JSON.stringify(items.slice(0, PIN_LIMIT)));
  } catch {
    /* storage unavailable: pins simply do not persist */
  }
}
/** Toggles a normalised module key; returns the new pinned state. Newest pin first; the list is capped at PIN_LIMIT. */
export function togglePin(storage, scope, moduleKey) {
  const key = norm(moduleKey);
  if (!key) return false;
  const current = readPins(storage, scope);
  if (current.includes(key)) {
    writePins(storage, scope, current.filter((k) => k !== key));
    return false;
  }
  writePins(storage, scope, [key, ...current.filter((k) => k !== key)]);
  return true;
}
/**
 * Pins resolve ONLY against the currently visible, enabled and routable entries. Stale, revoked, locked or unknown pins
 * are neither shown nor pruned (they return if access returns). Stored order is preserved.
 */
export function resolveQuickAccess(pins, visibleEntries) {
  const lookup = new Map();
  for (const entry of visibleEntries) {
    if (entry.locked || !entry.href || entry.href === "#") continue;
    lookup.set(norm(entry.moduleKey), entry);
  }
  return pins.map((k) => lookup.get(norm(k))).filter(Boolean);
}
