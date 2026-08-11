/**
 * SASV Workspace — canonical toast (Phase 3A)
 *
 * Preferred:
 *   import { showToast, toast } from "./toast.js";
 *   showToast("Saved", { type: "success" });
 *   showToast("Failed", "error");           // legacy positional type
 *   showToast("Failed", "error", 4000);     // type + duration
 *
 * Styles live in style.css (.sasv-toast*). Icons via ui-icons.js when available.
 */

import { svgIcon } from "./ui-icons.js";

const TYPE_MAP = {
  success: "success",
  ok: "success",
  warning: "warning",
  warn: "warning",
  danger: "danger",
  error: "danger",
  err: "danger",
  info: "info",
  neutral: "neutral",
  default: "neutral",
};

const TYPE_ICON = {
  success: "check",
  warning: "alert-triangle",
  danger: "alert-triangle",
  info: "info",
  neutral: "info",
};

function normalizeType(type) {
  const key = String(type || "info").toLowerCase();
  return TYPE_MAP[key] || "info";
}

function ensureContainer() {
  let container = document.getElementById("sasv-toast-container");
  if (!container) {
    container = document.getElementById("app-toast-container");
  }
  if (!container) {
    container = document.createElement("div");
    container.id = "sasv-toast-container";
    container.className = "sasv-toast-container";
    container.setAttribute("aria-live", "polite");
    container.setAttribute("aria-relevant", "additions");
    document.body.appendChild(container);
  } else {
    container.classList.add("sasv-toast-container");
  }
  return container;
}

function parseArgs(message, optsOrType, maybeDuration) {
  let type = "info";
  let duration = 3200;
  let multiline = false;

  if (typeof optsOrType === "string") {
    type = optsOrType;
    if (typeof maybeDuration === "number") duration = maybeDuration;
  } else if (optsOrType && typeof optsOrType === "object") {
    type = optsOrType.type ?? optsOrType.kind ?? "info";
    if (typeof optsOrType.duration === "number") duration = optsOrType.duration;
    if (typeof optsOrType.timeout === "number") duration = optsOrType.timeout;
    if (optsOrType.multiline) multiline = true;
  } else if (typeof optsOrType === "number") {
    // showToast(msg, 5000) — some callers pass timeout as 2nd arg
    duration = optsOrType;
  }

  return {
    message: message == null ? "" : String(message),
    type: normalizeType(type),
    duration,
    multiline,
  };
}

/**
 * @param {string} message
 * @param {string|object|number} [optsOrType]
 * @param {number} [maybeDuration]
 */
export function showToast(message, optsOrType, maybeDuration) {
  const { message: text, type, duration, multiline } = parseArgs(
    message,
    optsOrType,
    maybeDuration,
  );
  if (!text) return;

  const container = ensureContainer();
  const el = document.createElement("div");
  el.className = `sasv-toast sasv-toast--${type}${multiline ? " sasv-toast--multiline" : ""}`;
  el.setAttribute("role", "status");

  const iconName = TYPE_ICON[type] || "info";
  let iconMarkup = "";
  try {
    iconMarkup = `<span class="sasv-toast__icon" aria-hidden="true">${svgIcon(iconName, 16)}</span>`;
  } catch {
    iconMarkup = "";
  }

  el.innerHTML = `${iconMarkup}<span class="sasv-toast__msg"></span>`;
  const msgEl = el.querySelector(".sasv-toast__msg");
  if (msgEl) msgEl.textContent = text;

  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add("is-show"));

  const remove = () => {
    el.classList.remove("is-show");
    window.setTimeout(() => el.remove(), 220);
  };

  const timer = window.setTimeout(remove, Math.max(1200, duration));
  el.addEventListener("click", () => {
    window.clearTimeout(timer);
    remove();
  });
}

/** Compatibility alias used by ui-helpers and some modules */
export function toast(msg, type = "info", duration) {
  return showToast(msg, type, duration);
}

if (typeof window !== "undefined") {
  window.showToast = showToast;
  window.sasvToast = showToast;
}
