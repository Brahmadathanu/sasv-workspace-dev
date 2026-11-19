// Electron main-process hardening helpers (pure Node: no `electron` import, so they are unit-testable).
// Used by main.js for: loopback-only static server binding, same-origin window/navigation policy, and
// validation of the privileged `open-module-url` IPC.
"use strict";

const http = require("http");

const DEFAULT_STATIC_PORT = 3000;
const APP_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** Static server port. SASV_STATIC_PORT is for automated tests; an invalid value falls back to 3000. */
function resolveStaticPort(env = process.env) {
  const raw = env && env.SASV_STATIC_PORT;
  if (raw === undefined || raw === "") return DEFAULT_STATIC_PORT;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1024 && n <= 65535 ? n : DEFAULT_STATIC_PORT;
}

/** Canonical origin the app pages are served from (kept as `localhost`, as the Supabase redirect URLs expect). */
function appOrigin(port = DEFAULT_STATIC_PORT) {
  return `http://localhost:${port}`;
}

function parse(url) {
  try {
    return new URL(String(url));
  } catch {
    return null;
  }
}

/** True for http://localhost:<port>/... and http://127.0.0.1:<port>/... (the only origins the app is served from). */
function isAppUrl(url, port = DEFAULT_STATIC_PORT) {
  const u = parse(url);
  return !!u && u.protocol === "http:" && APP_HOSTS.has(u.hostname) && Number(u.port) === Number(port);
}

/**
 * Validates the URL a renderer asks `open-module-url` to open in a privileged child window.
 * Relative paths resolve against the app origin; anything that is not an app-origin http page
 * (https:, file:, javascript:, data:, other hosts or ports, credentials in the URL) is rejected.
 * Returns the normalised absolute URL, or null.
 */
function resolveModuleUrl(absUrl, port = DEFAULT_STATIC_PORT) {
  if (typeof absUrl !== "string" || absUrl.length === 0 || absUrl.length > 4096) return null;
  let u;
  try {
    u = new URL(absUrl, `${appOrigin(port)}/`);
  } catch {
    return null;
  }
  if (!isAppUrl(u.toString(), port) || u.username || u.password) return null;
  return u.toString();
}

/** Clamps child-window dimensions requested over IPC. */
function clampSize(value, fallback, min = 320, max = 4000) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

/**
 * Policy for window.open / target=_blank from app pages.
 * allow: app-origin pages, about:blank (print/report popups), and blob: URLs minted by the app origin.
 * external: other http(s) URLs, to be opened in the user's default browser, never inside the app.
 * deny: everything else (file:, javascript:, data:, custom schemes).
 */
function classifyWindowOpen(url, port = DEFAULT_STATIC_PORT) {
  if (url === "about:blank") return "allow";
  const u = parse(url);
  if (!u) return "deny";
  if (u.protocol === "blob:") {
    const inner = parse(u.pathname.startsWith("http") ? u.pathname : u.href.slice(5));
    return inner && isAppUrl(`${inner.origin}/`, port) ? "allow" : "deny";
  }
  if (isAppUrl(url, port)) return "allow";
  if (u.protocol === "https:" || u.protocol === "http:") return "external";
  return "deny";
}

/**
 * Policy for top-level navigation of a window that is currently showing an app page:
 * stay on the app origin, send other http(s) targets to the default browser, block the rest.
 * Windows that are not showing an app page (for example electron-prompt dialogs) are not restricted.
 */
function classifyNavigation(currentUrl, nextUrl, port = DEFAULT_STATIC_PORT) {
  if (!isAppUrl(currentUrl, port)) return "allow";
  if (isAppUrl(nextUrl, port)) return "allow";
  const u = parse(nextUrl);
  if (u && (u.protocol === "https:" || u.protocol === "http:")) return "external";
  return "block";
}

/**
 * Serves an Express app on loopback only (127.0.0.1, plus ::1 when available) so it is not reachable from the LAN.
 * Resolves with the servers; rejects if the IPv4 loopback listener fails (for example the port is in use).
 */
function listenLoopback(expressApp, port, log = () => {}) {
  return new Promise((resolve, reject) => {
    const v4 = http.createServer(expressApp);
    v4.once("error", reject);
    v4.listen(port, "127.0.0.1", () => {
      v4.removeListener("error", reject);
      const servers = [v4];
      const v6 = http.createServer(expressApp);
      v6.once("error", (err) => log(`IPv6 loopback listener unavailable: ${err && err.code}`));
      v6.listen(port, "::1", () => servers.push(v6));
      log(`Static server listening on loopback port ${port}`);
      resolve(servers);
    });
  });
}

module.exports = {
  DEFAULT_STATIC_PORT,
  resolveStaticPort,
  appOrigin,
  isAppUrl,
  resolveModuleUrl,
  clampSize,
  classifyWindowOpen,
  classifyNavigation,
  listenLoopback,
};
