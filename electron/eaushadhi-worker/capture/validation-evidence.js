/* eslint-env node */

const { createHash } = require("crypto");
const { sanitizeText } = require("../diagnostics");

const HANDLER_PREVIEW_MAX = 240;
const SNIPPET_MAX = 160;
const MAX_HANDLER_SNIPPETS = 8;

function sha256Text(value) {
  return createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function boundSanitize(value, max) {
  const cleaned = sanitizeText(String(value || ""));
  return cleaned.replace(/\s+/g, " ").trim().slice(0, max);
}

function finalizeSubmitControl(control) {
  const rawPreview = control?.onclick_source_preview_raw || control?.onclick_attribute || null;
  const preview = rawPreview ? boundSanitize(rawPreview, HANDLER_PREVIEW_MAX) : null;
  const hash = preview ? sha256Text(preview) : null;
  const {
    onclick_source_preview_raw: _raw,
    ...rest
  } = control || {};
  return {
    ...rest,
    href_literal: rest.href_literal ? boundSanitize(rest.href_literal, HANDLER_PREVIEW_MAX) : null,
    onclick_attribute: rest.onclick_attribute
      ? boundSanitize(rest.onclick_attribute, HANDLER_PREVIEW_MAX)
      : null,
    onclick_source_preview: preview,
    onclick_source_sha256: hash,
    activated: false,
  };
}

function finalizeScriptMatch(match) {
  return {
    script_index: match?.script_index ?? null,
    src_path: match?.src_path || null,
    source_kind: match?.source_kind || null,
    match_term: match?.match_term || null,
    context_snippet: match?.context_snippet
      ? boundSanitize(match.context_snippet, SNIPPET_MAX)
      : null,
    evidence_class: match?.evidence_class || null,
    subtype_related: match?.subtype_related === true,
    validation_or_sentinel: match?.validation_or_sentinel === true,
    direct_minus_one_comparison: match?.direct_minus_one_comparison === true,
    explicit_minus_one_rejection: match?.explicit_minus_one_rejection === true,
  };
}

function finalizeReferencedHandler(entry) {
  const rawSource = entry?.function_source_raw;
  const hasFullRaw = typeof rawSource === "string" && rawSource.length > 0;
  const truncated = entry?.source_truncated === true;
  let sourceSha256 = null;
  let hashScope = null;
  if (hasFullRaw && truncated !== true) {
    sourceSha256 = sha256Text(rawSource);
    hashScope = "full_function_source";
  }

  const snippets = (Array.isArray(entry?.snippets) ? entry.snippets : [])
    .slice(0, MAX_HANDLER_SNIPPETS)
    .map((item) => ({
      match_term: item?.match_term || null,
      context_snippet: item?.context_snippet
        ? boundSanitize(item.context_snippet, SNIPPET_MAX)
        : null,
      evidence_class: item?.evidence_class || null,
      subtype_related: item?.subtype_related === true,
      validation_or_sentinel: item?.validation_or_sentinel === true,
      direct_minus_one_comparison: item?.direct_minus_one_comparison === true,
      explicit_minus_one_rejection: item?.explicit_minus_one_rejection === true,
    }));

  const flags = entry?.observation_flags || {};
  return {
    function_name: entry?.function_name || null,
    control_id: entry?.control_id || null,
    referenced_by_onclick: entry?.referenced_by_onclick === true,
    found: entry?.found === true,
    typeof: entry?.typeof || null,
    source_capture_status: entry?.source_capture_status || null,
    source_length: typeof entry?.source_length === "number" ? entry.source_length : null,
    source_truncated: truncated === true,
    source_sha256: sourceSha256,
    hash_scope: hashScope,
    snippets,
    observation_flags: {
      subtype_validation_candidate_observed: flags.subtype_validation_candidate_observed === true,
      subtype_minus_one_rejection_candidate_observed:
        flags.subtype_minus_one_rejection_candidate_observed === true,
      explicit_subtype_minus_one_rejection_observed:
        flags.explicit_subtype_minus_one_rejection_observed === true,
    },
    evidence_complete: false,
  };
}

function emptyConclusionInputs() {
  return {
    html_required_observed: false,
    native_value_missing: false,
    subtype_validation_candidate_observed: false,
    subtype_minus_one_rejection_candidate_observed: false,
    explicit_subtype_minus_one_rejection_observed: false,
    inline_script_subtype_terms_observed: false,
    referenced_handler_subtype_validation_candidate_observed: false,
    referenced_handler_subtype_minus_one_rejection_candidate_observed: false,
    referenced_handler_explicit_subtype_minus_one_rejection_observed: false,
    evidence_complete: false,
  };
}

/**
 * Node-side finalize: sanitize previews, hash handlers, build factual conclusion_inputs.
 * Never sets blank_valid / portal_accepts_blank. evidence_complete stays false while
 * external/dynamic enforcement surfaces remain unresolved.
 *
 * Inline rejection semantics (conservative / under-classify):
 * - subtype_validation_candidate: subtype + generic validation language only
 * - subtype_minus_one_rejection_candidate: direct subtype-to--1 comparison
 * - explicit_subtype_minus_one_rejection: direct comparison + rejection messaging
 *
 * Referenced-handler flags are additive and separate from inline-script facts.
 */
function finalizeClassificationValidationEvidence(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      target_path_hint: null,
      subtype_control: { control_found: false, id: "subTypeId" },
      submit_controls: [],
      nearby_validation_elements: [],
      script_matches: [],
      referenced_handler_functions: [],
      limitations: [
        "external_script_bodies_not_fetched",
        "delegated_or_dynamic_listeners_not_enumerated",
        "checkValidity_and_reportValidity_not_called",
        "validation_evidence_extract_missing",
      ],
      conclusion_inputs: emptyConclusionInputs(),
      verification_status: "unverified",
    };
  }

  const subtype = raw.subtype_control || { control_found: false, id: "subTypeId" };
  const scriptMatches = (raw.script_matches || []).map(finalizeScriptMatch);
  const referencedHandlers = (raw.referenced_handler_functions || []).map(finalizeReferencedHandler);
  const nearby = (raw.nearby_validation_elements || []).slice(0, 8).map((item) => ({
    id: item?.id || null,
    class_name: item?.class_name ? boundSanitize(item.class_name, 120) : null,
    tag: item?.tag || null,
    text: item?.text ? boundSanitize(item.text, 120) : null,
    relation: item?.relation || null,
  }));

  const htmlRequiredObserved =
    subtype.control_found === true &&
    (subtype.required_property === true ||
      subtype.required_attribute != null ||
      String(subtype.aria_required || "").toLowerCase() === "true");

  const nativeValueMissing =
    subtype.control_found === true && subtype.validity && subtype.validity.value_missing === true;

  const inline = scriptMatches.filter((match) => match.source_kind === "inline");

  const subtypeValidationCandidateObserved = inline.some(
    (match) =>
      match.evidence_class === "subtype_validation_candidate" ||
      match.evidence_class === "subtype_minus_one_rejection_candidate" ||
      match.evidence_class === "explicit_subtype_minus_one_rejection_candidate",
  );

  const rejectionCandidateObserved = inline.some(
    (match) =>
      match.evidence_class === "subtype_minus_one_rejection_candidate" ||
      match.evidence_class === "explicit_subtype_minus_one_rejection_candidate" ||
      match.direct_minus_one_comparison === true,
  );

  const explicitRejectionObserved = inline.some(
    (match) =>
      match.evidence_class === "explicit_subtype_minus_one_rejection_candidate" ||
      match.explicit_minus_one_rejection === true,
  );

  const inlineSubtypeTerms = inline.some((match) => match.subtype_related === true);

  const referencedValidationObserved = referencedHandlers.some(
    (item) => item.observation_flags?.subtype_validation_candidate_observed === true,
  );
  const referencedRejectionObserved = referencedHandlers.some(
    (item) => item.observation_flags?.subtype_minus_one_rejection_candidate_observed === true,
  );
  const referencedExplicitObserved = referencedHandlers.some(
    (item) => item.observation_flags?.explicit_subtype_minus_one_rejection_observed === true,
  );

  const limitations = Array.from(
    new Set([
      ...(Array.isArray(raw.limitations) ? raw.limitations : []),
      "external_script_bodies_not_fetched",
      "delegated_or_dynamic_listeners_not_enumerated",
      "checkValidity_and_reportValidity_not_called",
      "referenced_handler_bodies_via_tostring_only",
    ]),
  );

  return {
    target_path_hint: raw.target_path_hint || null,
    subtype_control: subtype,
    submit_controls: (raw.submit_controls || []).map(finalizeSubmitControl),
    nearby_validation_elements: nearby,
    script_matches: scriptMatches,
    referenced_handler_functions: referencedHandlers,
    limitations,
    conclusion_inputs: {
      html_required_observed: htmlRequiredObserved,
      native_value_missing: nativeValueMissing,
      subtype_validation_candidate_observed: subtypeValidationCandidateObserved,
      subtype_minus_one_rejection_candidate_observed: rejectionCandidateObserved,
      explicit_subtype_minus_one_rejection_observed: explicitRejectionObserved,
      inline_script_subtype_terms_observed: inlineSubtypeTerms,
      referenced_handler_subtype_validation_candidate_observed: referencedValidationObserved,
      referenced_handler_subtype_minus_one_rejection_candidate_observed: referencedRejectionObserved,
      referenced_handler_explicit_subtype_minus_one_rejection_observed: referencedExplicitObserved,
      // Asymmetric: unresolved external/dynamic surfaces keep evidence incomplete.
      evidence_complete: false,
    },
    verification_status: "unverified",
  };
}

module.exports = {
  finalizeClassificationValidationEvidence,
};
