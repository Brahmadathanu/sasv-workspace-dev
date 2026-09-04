/* eslint-env node */

const AUTH_OUTCOMES = Object.freeze({
  AUTH_REQUIRED: "AUTH_REQUIRED",
  AUTHENTICATED_CANDIDATE: "AUTHENTICATED_CANDIDATE",
  AUTH_UNPROVEN: "AUTH_UNPROVEN",
});

const SECRET_TYPE = /^(password|hidden)$/i;
const NEGATIVE =
  /\b(password|passwd|otp|one[-\s]?time|captcha|loginid|login-id|userid|user-id)\b/i;
const LOGIN_LANDMARK = /\b(login|sign[-\s]?in|authenticate)\b/i;
const POSITIVE =
  /\b(log\s*out|sign\s*out|signout|logoff|log\s*off|dashboard|my\s*account|change\s*password)\b/i;

function blob(parts) {
  return parts.filter(Boolean).join(" ");
}

function isNegativeControl(control) {
  const hay = blob([
    control?.type,
    control?.id,
    control?.name,
    control?.label,
    control?.placeholder,
    control?.role,
    control?.text,
  ]);
  if (String(control?.type || "").toLowerCase() === "password") return true;
  if (NEGATIVE.test(hay)) return true;
  if (LOGIN_LANDMARK.test(hay) && SECRET_TYPE.test(String(control?.type || ""))) return true;
  return false;
}

function isPositiveControl(control) {
  const hay = blob([
    control?.id,
    control?.name,
    control?.label,
    control?.text,
    control?.href_path,
    control?.role,
  ]);
  return POSITIVE.test(hay);
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
      negative_signal_kinds: ["password_input", "otp_or_captcha_labelled_control", "login_landmark"],
      positive_signal_kinds: ["logout_or_signout", "dashboard_or_account_landmark"],
    },
  };
}

module.exports = {
  AUTH_OUTCOMES,
  collectPageSignals,
  classifyAuth,
};
