/**
 * SASV Workspace — canonical action icon helper (Phase 3A)
 *
 * Stroke SVG grammar: viewBox 0 0 24 24, currentColor, round caps/joins.
 * Default render size 16px (overridable).
 *
 * Usage (module):
 *   import { svgIcon, iconHtml } from "./ui-icons.js";
 *   btn.innerHTML = svgIcon("refresh");
 *
 * Non-module / progressive enhancement:
 *   window.SASVIcons.svgIcon("home")
 */

const PATHS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 10v10h14V10"/>',
  search:
    '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  refresh:
    '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash:
    '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  delete:
    '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  filter:
    '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  "chevron-up": '<polyline points="18 15 12 9 6 15"/>',
  "chevron-down": '<polyline points="6 9 12 15 18 9"/>',
  "chevron-left": '<polyline points="15 18 9 12 15 6"/>',
  "chevron-right": '<polyline points="9 18 15 12 9 6"/>',
  more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  download:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  external:
    '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  "alert-triangle":
    '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  "eye-off":
    '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-6 0-10-8-10-8a21.77 21.77 0 0 1 5.06-6.94"/><path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6 0 10 8 10 8a21.87 21.87 0 0 1-3.13 4.7"/><line x1="1" y1="1" x2="23" y2="23"/>',

  /* Home section-family icons (UI-HOME-8E) */
  factory:
    '<path d="M2 20h20"/><path d="M4 20V10l5 3V10l5 3V6h6v14"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/>',
  cart: '<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 8H7"/>',
  package:
    '<path d="M16.5 9.4 7.5 4.2"/><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>',
  "shield-check":
    '<path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/>',
  calculator:
    '<rect x="5" y="3" width="14" height="18" rx="2"/><rect x="8" y="6" width="8" height="3" rx="0.5"/><line x1="8" y1="12" x2="8.01" y2="12"/><line x1="12" y1="12" x2="12.01" y2="12"/><line x1="16" y1="12" x2="16.01" y2="12"/><line x1="8" y1="16" x2="8.01" y2="16"/><line x1="12" y1="16" x2="12.01" y2="16"/><line x1="16" y1="16" x2="16.01" y2="16"/>',
  chart:
    '<line x1="4" y1="20" x2="20" y2="20"/><rect x="6" y="11" width="3" height="7" rx="0.5"/><rect x="11" y="7" width="3" height="11" rx="0.5"/><rect x="16" y="13" width="3" height="5" rx="0.5"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  "layout-grid":
    '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  activity:
    '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  document:
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>',
  database:
    '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6"/>',
  wrench:
    '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5z"/>',
  layers:
    '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  flask:
    '<path d="M9 3h6"/><path d="M10 3v6.2L5.4 18a2 2 0 0 0 1.7 3h9.8a2 2 0 0 0 1.7-3L14 9.2V3"/><path d="M8.5 14h7"/>',
};

/**
 * Family tonal fallback icons (UI-HOME-8E). Prefer SECTION_KEY_ICONS for Home.
 */
export const SECTION_FAMILY_ICONS = {
  operations: "factory",
  planning: "calendar",
  procurement: "cart",
  inventory: "package",
  finance: "calculator",
  quality: "shield-check",
  reports: "chart",
  admin: "settings",
  general: "layout-grid",
};

/**
 * Explicit registry sectionKey → iconKey (UI-HOME-8F).
 * Stable keys from app_nav_sections / module registry only — no title inference.
 */
export const SECTION_KEY_ICONS = {
  "work-log": "activity",
  "planning-workspace": "calendar",
  "mrp-procurement": "cart",
  "inventory-sales": "package",
  "product-reference-master": "database",
  "plant-assets": "factory",
  "qa-qc": "shield-check",
  "bmr-production-records": "document",
  sops: "layers",
  system: "wrench",
  admin: "settings",
  /* local fallback inject keys */
  "laboratory-masters": "flask",
  "admin-masters": "settings",
};

/** @deprecated alias map for callers migrating from PEC names */
const ALIASES = {
  x: "close",
  arrowRight: "chevron-right",
  alertTriangle: "alert-triangle",
  checkCircle: "check",
};

function resolveName(name) {
  if (!name) return "";
  if (PATHS[name]) return name;
  return ALIASES[name] || name;
}

export function getIconPath(name) {
  const key = resolveName(name);
  return PATHS[key] || "";
}

export function listIcons() {
  return Object.keys(PATHS);
}

/**
 * @param {string} name
 * @param {number|{size?:number, className?:string, strokeWidth?:number|string, title?:string}} [opts]
 */
export function svgIcon(name, opts = 16) {
  const options =
    typeof opts === "number" ? { size: opts } : opts && typeof opts === "object" ? opts : {};
  const size = options.size ?? 16;
  const className = options.className ? ` sasv-icon ${options.className}` : " sasv-icon";
  const strokeWidth = options.strokeWidth ?? 2;
  const paths = getIconPath(name);
  const title = options.title
    ? `<title>${String(options.title).replace(/</g, "&lt;")}</title>`
    : "";
  return `<svg class="${className.trim()}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${title}${paths}</svg>`;
}

/** Alias for svgIcon */
export function iconHtml(name, opts) {
  return svgIcon(name, opts);
}

/**
 * @param {string} family section identity key (e.g. "operations")
 * @param {number|{size?:number, className?:string, strokeWidth?:number|string}} [opts]
 */
export function sectionFamilyIcon(family, opts = 16) {
  const key =
    SECTION_FAMILY_ICONS[family] || SECTION_FAMILY_ICONS.general || "layout-grid";
  return svgIcon(key, opts);
}

function normalizeSectionKey(sectionKey) {
  return String(sectionKey || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

/**
 * @param {string} sectionKey stable registry section key
 * @param {number|{size?:number, className?:string, strokeWidth?:number|string}} [opts]
 */
export function sectionKeyIcon(sectionKey, opts = 16) {
  const normalized = normalizeSectionKey(sectionKey);
  const iconKey = SECTION_KEY_ICONS[normalized] || "layout-grid";
  return svgIcon(iconKey, opts);
}

const api = {
  PATHS,
  SECTION_FAMILY_ICONS,
  SECTION_KEY_ICONS,
  getIconPath,
  listIcons,
  svgIcon,
  iconHtml,
  sectionFamilyIcon,
  sectionKeyIcon,
};

if (typeof window !== "undefined") {
  window.SASVIcons = api;
}

export default api;
