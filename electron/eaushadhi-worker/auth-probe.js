/* eslint-env node */

/**
 * Fail-closed authenticated-session probe.
 * Intended for page.evaluate: collectAuthProbeSignals must not close over Node.
 */

function normalizePath(href, baseHref) {
  const raw = String(href || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, baseHref || "https://www.e-aushadhi.gov.in/");
    const path = String(url.pathname || "").replace(/\/+$/, "") || "/";
    return path.toLowerCase();
  } catch {
    const path = raw.split(/[?#]/)[0].replace(/\/+$/, "");
    return path.toLowerCase() || "";
  }
}

function isLogoutPath(path) {
  return path === "/logout";
}

function collectAuthProbeSignals(spec) {
  const doc = globalThis.document;
  const loc = globalThis.location;
  const baseHref = loc && loc.href ? loc.href : "https://www.e-aushadhi.gov.in/";
  const logoutSelector = (spec && spec.logoutSelector) || "#logoutForm";
  const logoutEl = doc ? doc.querySelector(logoutSelector) : null;
  const hrefCandidates = [];
  if (logoutEl) {
    hrefCandidates.push(logoutEl.getAttribute("action"));
    hrefCandidates.push(logoutEl.getAttribute("href"));
    if (logoutEl.action) hrefCandidates.push(String(logoutEl.action));
    const nested = logoutEl.querySelectorAll ? logoutEl.querySelectorAll("a, button") : [];
    for (const node of nested) {
      hrefCandidates.push(node.getAttribute("href"));
      hrefCandidates.push(node.getAttribute("formaction"));
    }
  }
  const logoutPaths = hrefCandidates
    .map((value) => normalizePath(value, baseHref))
    .filter(Boolean);
  const logoutPathMatch = logoutPaths.some(isLogoutPath);

  const credentialEntries = [];
  const fields = doc ? doc.querySelectorAll("input, textarea") : [];
  for (const field of fields) {
    const tag = String(field.tagName || "").toLowerCase();
    if (tag !== "input" && tag !== "textarea") continue;
    const type = String(field.getAttribute("type") || field.type || "").toLowerCase();
    const id = String(field.id || "");
    const name = String(field.getAttribute("name") || field.name || "");
    const autocomplete = String(field.getAttribute("autocomplete") || "").toLowerCase();
    const hay = `${id} ${name} ${type} ${autocomplete}`.toLowerCase();
    let kind = null;
    if (type === "password") kind = "password_input";
    else if (/\b(otp|one[-\s]?time|totp)\b/.test(hay) || autocomplete === "one-time-code") {
      kind = "otp_entry";
    } else if (/\bcaptcha\b/.test(hay)) kind = "captcha_entry";
    if (kind) {
      credentialEntries.push({
        kind,
        tag,
        id: id || null,
        name: name || null,
        type: type || null,
      });
    }
  }

  const dashboardSelector = spec && spec.dashboardPath ? spec.dashboardPath : "/admin/custom_dashboard1";
  const dashboardPresent = Boolean(
    doc &&
      Array.from(doc.querySelectorAll("a")).some((anchor) => {
        const path = normalizePath(anchor.getAttribute("href"), baseHref);
        return path === String(dashboardSelector).replace(/\/+$/, "").toLowerCase();
      }),
  );

  return {
    logoutPresent: Boolean(logoutEl),
    logoutPathMatch,
    credentialEntries,
    dashboardPresent,
  };
}

function evaluateAuthProbe(signals, spec) {
  const ignored = Array.isArray(spec && spec.ignoreNavLabels) ? spec.ignoreNavLabels : [];
  void ignored;
  if (signals?.credentialEntries?.length) {
    return {
      authenticated: false,
      reason: "Credential-entry controls are present.",
      signals,
    };
  }
  if (!signals?.logoutPresent || !signals?.logoutPathMatch) {
    return {
      authenticated: false,
      reason: "Authenticated logout control was not proven.",
      signals,
    };
  }
  return {
    authenticated: true,
    reason: null,
    signals,
  };
}

async function probeAuthenticatedSession(page, spec) {
  if (!page || typeof page.evaluate !== "function") {
    return {
      authenticated: false,
      reason: "Current page cannot be inspected.",
      signals: null,
    };
  }
  const signals = await page.evaluate(collectAuthProbeSignals, spec || {});
  return evaluateAuthProbe(signals, spec);
}

module.exports = {
  collectAuthProbeSignals,
  evaluateAuthProbe,
  probeAuthenticatedSession,
  normalizePath,
};
