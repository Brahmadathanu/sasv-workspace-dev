/* eslint-env node */

const AUTH_OUTCOMES = Object.freeze({
  AUTH_REQUIRED: "AUTH_REQUIRED",
  AUTHENTICATED_CANDIDATE: "AUTHENTICATED_CANDIDATE",
  AUTH_UNPROVEN: "AUTH_UNPROVEN",
});

const ENTRY_TAGS = new Set(["input", "textarea"]);
const PASSWORD_TYPE = /^password$/i;
const CREDENTIAL_FIELD =
  /\b(password|passwd|otp|one[-\s]?time|captcha|loginid|login-id|userid|user-id)\b/i;
const POSITIVE_LOGOUT = /\b(log\s*out|sign\s*out|signout|logoff|log\s*off)\b/i;
const POSITIVE_DASHBOARD = /\bdashboard\b/i;

function blob(parts) {
  return parts.filter(Boolean).join(" ");
}

function isEntryControl(control) {
  const tag = String(control?.tag || "").toLowerCase();
  return ENTRY_TAGS.has(tag);
}

function isNegativeControl(control) {
  if (!isEntryControl(control)) return false;
  if (PASSWORD_TYPE.test(String(control?.type || ""))) return true;
  const hay = blob([
    control?.id,
    control?.name,
    control?.label,
    control?.placeholder,
    control?.type,
  ]);
  return CREDENTIAL_FIELD.test(hay);
}

function isPositiveControl(control) {
  const id = String(control?.id || "");
  const href = String(control?.href_path || "");
  if (/^logoutform$/i.test(id)) return true;
  if (href === "/logout" || /\/logout$/i.test(href)) return true;
  if (/custom_dashboard/i.test(href)) return true;
  const hay = blob([
    control?.id,
    control?.name,
    control?.label,
    control?.text,
    control?.href_path,
  ]);
  if (POSITIVE_LOGOUT.test(hay)) return true;
  if (POSITIVE_DASHBOARD.test(hay) || POSITIVE_DASHBOARD.test(href)) return true;
  return false;
}

function collectPageSignals(extracted) {
  const controls = [
    ...(extracted?.inputs || []),
    ...(extracted?.textareas || []),
    ...(extracted?.buttons || []),
    ...(extracted?.anchors || []),
    ...(extracted?.selects || []),
  ];
  const negative = [];
  const positive = [];
  for (const control of controls) {
    const identity = {
      tag: control.tag || null,
      id: control.id || null,
      name: control.name || null,
      type: control.type || null,
      label: control.label || control.text || null,
    };
    if (isNegativeControl(control)) negative.push(identity);
    if (isPositiveControl(control)) positive.push(identity);
  }
  return { negative, positive };
}

function classifyAuth(pages) {
  const warnings = [];
  let negative = [];
  let positive = [];
  for (const page of pages || []) {
    negative = negative.concat(page?.auth?.negative || []);
    positive = positive.concat(page?.auth?.positive || []);
  }
  let outcome = AUTH_OUTCOMES.AUTH_UNPROVEN;
  if (negative.length) {
    outcome = AUTH_OUTCOMES.AUTH_REQUIRED;
  } else if (positive.length) {
    outcome = AUTH_OUTCOMES.AUTHENTICATED_CANDIDATE;
  } else {
    warnings.push("No strong login or authenticated-only landmarks were observed.");
  }
  return {
    outcome,
    negative_count: negative.length,
    positive_count: positive.length,
    negative,
    positive,
    warnings,
    proposed_auth_probe: {
      verification_status: "unverified",
      negative_signal_kinds: ["password_input", "otp_or_captcha_entry_control"],
      positive_signal_kinds: ["logout_control", "dashboard_landmark"],
    },
  };
}

module.exports = {
  AUTH_OUTCOMES,
  collectPageSignals,
  classifyAuth,
};
