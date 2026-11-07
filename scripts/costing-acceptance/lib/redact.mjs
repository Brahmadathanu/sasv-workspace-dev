// Scrubs anything credential-shaped before it can reach a report, a log or an artefact.
const RULES = [
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g, "[REDACTED_JWT]"],
  [/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, "[REDACTED_AUTH]"],
  [/\b(?:apikey|access_token|refresh_token|authorization|password|secret|token)\s*[:=]\s*["']?[^\s"',;&]{6,}/gi, "[REDACTED_SECRET]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[REDACTED_EMAIL]"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[REDACTED_UUID]"],
  [/\bCANARY[-A-Z0-9_.]*/g, "[REDACTED_CANARY]"],
];
export const redact = (text, max = 300) => RULES.reduce((t, [re, to]) => t.replace(re, to), String(text ?? "")).replace(/\s+/g, " ").trim().slice(0, max);
/** URL reduced to origin + path (no query, no fragment, no userinfo): query strings can carry tokens. */
export const safeUrl = (u) => { try { const x = new URL(u); return x.origin + x.pathname; } catch { return "[unparseable-url]"; } };
export const containsSecret = (text) => RULES.slice(0, 3).some(([re]) => { re.lastIndex = 0; return re.test(String(text)); });
