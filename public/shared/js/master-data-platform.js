// WP08 G2-0 — platform-neutral navigation targets for the shared Master Data pages
// (Manage Products, Manage RM BOM, Manage PM BOM, Manage SP BOM).
//
// One canonical implementation serves Electron (repo root at http://localhost:3000, pages at
// /public/shared/…) and the PWA (public/ published, pages at /shared/…). The pages therefore must not use
// page-relative "index.html" / "login.html". Authorisation is unchanged: this module only chooses WHERE to go;
// it grants nothing and never reads or writes data.
import { Platform } from "./platform.js";

export const ELECTRON_LOGIN_PATH = "/login.html";
export const ELECTRON_HOME_PATH = "/index.html";
export const PWA_HUB_PATH = "/utilities-hub/index.html";

/** Sign-in page for the current client. The PWA hub renders its own sign-in form when no session exists. */
export function resolveMasterDataLoginPage(platform = Platform) {
  return platform.isElectron ? ELECTRON_LOGIN_PATH : PWA_HUB_PATH;
}

/** Launcher (HOME) for the current client. */
export function resolveMasterDataHomePath(platform = Platform) {
  return platform.isElectron ? ELECTRON_HOME_PATH : PWA_HUB_PATH;
}

export function goMasterDataHome() {
  window.location.href = resolveMasterDataHomePath();
}

/**
 * Season Profiles is a separate Master Data page that exists only at the Electron repo root (it is not part of
 * G2-0). Return its Electron-root URL, or null on the PWA so the caller hides the link instead of 404ing.
 */
export function resolveSeasonProfilesHref(platform = Platform) {
  return platform.isElectron ? "../../manage-season-profiles.html" : null;
}
