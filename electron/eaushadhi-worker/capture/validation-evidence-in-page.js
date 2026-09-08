/* eslint-env node, browser */

/**
 * Frozen observational extractor for classification validation evidence.
 * Playwright page.evaluate serializes this function; it must not close over
 * Node requires, mutate the portal DOM, invoke handlers, or fetch scripts.
 */
function extractClassificationValidationEvidence() {
  const MAX_NEARBY = 8;
  const MAX_SCRIPT_MATCHES = 20;
  const MAX_SNIPPET = 160;
  const MAX_PREVIEW = 240;
  const MAX_TEXT = 120;
  const MAX_DATA_ATTRS = 20;
  const MAX_DATA_VALUE = 80;

  const SUBMIT_IDS = ["save_btn", "save_rbtn"];
  const MATCH_TERMS = [
    "subTypeId",
    "subtype",
    "sub type",
    "Sub Type",
    "categoryId",
    "save_btn",
    "save_rbtn",
    '"-1"',
    "'-1'",
    "Please Select",
  ];

  function attr(el, name) {
    if (!el || typeof el.getAttribute !== "function") return null;
    const value = el.getAttribute(name);
    return value == null || value === "" ? null : String(value);
  }

  function textOf(el) {
    if (!el) return "";
    return String(el.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_TEXT);
  }

  function sliceText(value, max) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  }

  function cssAttr(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function labelFor(id) {
    if (!id) return null;
    const label = document.querySelector(`label[for="${cssAttr(id)}"]`);
    return label ? textOf(label) : null;
  }

  function associatedLabel(el) {
    if (!el) return null;
    if (el.id) {
      const byFor = labelFor(el.id);
      if (byFor) return byFor;
    }
    const parentLabel = el.closest && el.closest("label");
    if (parentLabel) return textOf(parentLabel);
    const labelled = attr(el, "aria-label");
    if (labelled) return labelled.slice(0, MAX_TEXT);
    return null;
  }

  function containerMeta(el) {
    if (!el) return null;
    const parent = el.parentElement || null;
    if (!parent) return null;
    return {
      tag: String(parent.tagName || "").toLowerCase() || null,
      id: parent.id || null,
      class_name: sliceText(parent.className, MAX_TEXT) || null,
    };
  }

  function dataAttributes(el) {
    const out = {};
    if (!el || !el.attributes) return out;
    let count = 0;
    const attrs = Array.from(el.attributes || []);
    for (const item of attrs) {
      const name = String(item && item.name ? item.name : "");
      if (!/^data-/i.test(name)) continue;
      if (count >= MAX_DATA_ATTRS) break;
      const key = name.slice(5);
      if (!key) continue;
      out[key] = sliceText(item.value, MAX_DATA_VALUE);
      count += 1;
    }
    return out;
  }

  function visibilityHeuristic(el) {
    if (!el) return "unresolved";
    try {
      if (typeof el.getClientRects === "function") {
        const rects = el.getClientRects();
        if (rects && typeof rects.length === "number") {
          return rects.length > 0;
        }
      }
      if (el.offsetParent === null && String(el.tagName || "").toLowerCase() !== "body") {
        return false;
      }
      return true;
    } catch {
      return "unresolved";
    }
  }

  function readValidity(el) {
    const validity = el && el.validity ? el.validity : null;
    if (!validity) {
      return {
        valid: null,
        value_missing: null,
        custom_error: null,
        bad_input: null,
        pattern_mismatch: null,
        range_overflow: null,
        range_underflow: null,
        step_mismatch: null,
        too_long: null,
        too_short: null,
        type_mismatch: null,
      };
    }
    return {
      valid: validity.valid === true,
      value_missing: validity.valueMissing === true,
      custom_error: validity.customError === true,
      bad_input: validity.badInput === true,
      pattern_mismatch: validity.patternMismatch === true,
      range_overflow: validity.rangeOverflow === true,
      range_underflow: validity.rangeUnderflow === true,
      step_mismatch: validity.stepMismatch === true,
      too_long: validity.tooLong === true,
      too_short: validity.tooShort === true,
      type_mismatch: validity.typeMismatch === true,
    };
  }

  function selectedOption(el) {
    if (!el || !el.options) {
      return { selected_index: null, selected_option_value: null, selected_option_label: null };
    }
    const index =
      typeof el.selectedIndex === "number" && el.selectedIndex >= 0 ? el.selectedIndex : null;
    const opt = index != null && el.options[index] ? el.options[index] : null;
    return {
      selected_index: index,
      selected_option_value: opt ? String(opt.value == null ? "" : opt.value) : null,
      selected_option_label: opt ? textOf(opt) : null,
    };
  }

  function subtypeControl() {
    const el = document.querySelector("#subTypeId");
    if (!el) {
      return {
        control_found: false,
        id: "subTypeId",
        name: null,
        tag: null,
        type: null,
        selected_index: null,
        selected_option_value: null,
        selected_option_label: null,
        required_property: null,
        required_attribute: null,
        aria_required: null,
        disabled: null,
        readonly: null,
        class_name: null,
        data_attributes: {},
        will_validate: null,
        validity: readValidity(null),
        label: null,
        aria_describedby: null,
        parent_container: null,
      };
    }
    const tag = String(el.tagName || "").toLowerCase();
    const selected = selectedOption(el);
    return {
      control_found: true,
      id: el.id || "subTypeId",
      name: attr(el, "name"),
      tag,
      type: attr(el, "type") || (tag === "select" ? "select" : null),
      selected_index: selected.selected_index,
      selected_option_value: selected.selected_option_value,
      selected_option_label: selected.selected_option_label,
      required_property: el.required === true,
      required_attribute:
        typeof el.getAttribute === "function" && el.getAttribute("required") != null
          ? String(el.getAttribute("required"))
          : null,
      aria_required: attr(el, "aria-required"),
      disabled: el.disabled === true,
      readonly: el.readOnly === true,
      class_name: sliceText(el.className, MAX_TEXT) || null,
      data_attributes: dataAttributes(el),
      will_validate: el.willValidate === true,
      validity: readValidity(el),
      label: associatedLabel(el),
      aria_describedby: attr(el, "aria-describedby"),
      parent_container: containerMeta(el),
    };
  }

  function handlerPreview(el) {
    const onclickAttr = attr(el, "onclick");
    const isFn = typeof el.onclick === "function";
    let preview = null;
    let status = "unavailable";
    if (onclickAttr) {
      preview = sliceText(onclickAttr, MAX_PREVIEW);
      status = "attribute_preview";
    }
    if (isFn) {
      try {
        const raw = Function.prototype.toString.call(el.onclick);
        const bounded = sliceText(raw, MAX_PREVIEW);
        if (bounded) {
          preview = bounded;
          status = "bounded_preview";
        } else if (!preview) {
          status = "empty_function_source";
        }
      } catch {
        if (!preview) status = "tostring_failed";
      }
    } else if (!onclickAttr) {
      status = "no_onclick";
    }
    return {
      onclick_attribute: onclickAttr ? sliceText(onclickAttr, MAX_PREVIEW) : null,
      onclick_property_is_function: isFn,
      onclick_source_preview_raw: preview,
      onclick_source_capture: status,
    };
  }

  function hrefLiteral(el) {
    const raw = attr(el, "href");
    if (!raw) return { href_literal: null, href_path: null };
    const literal = sliceText(raw, MAX_PREVIEW);
    const lower = String(raw).trim().toLowerCase();
    if (lower === "#" || lower.startsWith("javascript:")) {
      return { href_literal: literal, href_path: null };
    }
    try {
      const base =
        typeof location !== "undefined" && location.href
          ? location.href
          : "https://www.e-aushadhi.gov.in/";
      const parsed = new URL(raw, base);
      return { href_literal: literal, href_path: parsed.pathname || null };
    } catch {
      return { href_literal: literal, href_path: null };
    }
  }

  function submitControls() {
    const out = [];
    for (const id of SUBMIT_IDS) {
      const el = document.querySelector(`#${cssAttr(id)}`);
      if (!el) {
        out.push({
          id,
          control_found: false,
          tag: null,
          href_literal: null,
          href_path: null,
          role: null,
          class_name: null,
          disabled: null,
          aria_disabled: null,
          visible_heuristic: "unresolved",
          onclick_attribute: null,
          onclick_property_is_function: false,
          onclick_source_preview_raw: null,
          onclick_source_capture: "control_missing",
          container: null,
          activated: false,
        });
        continue;
      }
      const href = hrefLiteral(el);
      const handler = handlerPreview(el);
      out.push({
        id: el.id || id,
        control_found: true,
        tag: String(el.tagName || "").toLowerCase() || null,
        href_literal: href.href_literal,
        href_path: href.href_path,
        role: attr(el, "role"),
        class_name: sliceText(el.className, MAX_TEXT) || null,
        disabled: el.disabled === true,
        aria_disabled: attr(el, "aria-disabled"),
        visible_heuristic: visibilityHeuristic(el),
        onclick_attribute: handler.onclick_attribute,
        onclick_property_is_function: handler.onclick_property_is_function,
        onclick_source_preview_raw: handler.onclick_source_preview_raw,
        onclick_source_capture: handler.onclick_source_capture,
        container: containerMeta(el),
        activated: false,
      });
    }
    return out;
  }

  function nearbyValidationElements(control) {
    const out = [];
    const el = document.querySelector("#subTypeId");
    if (!el) return out;

    function pushNode(node, relation) {
      if (!node || out.length >= MAX_NEARBY) return;
      const tag = String(node.tagName || "").toLowerCase();
      if (!tag || tag === "script" || tag === "style") return;
      const id = node.id || null;
      const className = sliceText(node.className, MAX_TEXT) || null;
      const text = textOf(node);
      if (!id && !className && !text) return;
      const key = `${relation}|${id || ""}|${className || ""}|${text}`;
      if (out.some((item) => `${item.relation}|${item.id || ""}|${item.class_name || ""}|${item.text}` === key)) {
        return;
      }
      out.push({
        id,
        class_name: className,
        tag,
        text,
        relation,
      });
    }

    const describedBy = control && control.aria_describedby ? String(control.aria_describedby) : "";
    for (const ref of describedBy.split(/\s+/).filter(Boolean)) {
      pushNode(document.getElementById(ref), "aria-describedby");
    }

    const parent = el.parentElement;
    if (parent) {
      const buckets = ["span", "div", "p", "small", "label"];
      const candidates = [];
      for (const tag of buckets) {
        for (const node of Array.from(parent.querySelectorAll(tag) || [])) {
          candidates.push(node);
        }
      }
      for (const child of Array.from(parent.children || [])) {
        if (child && child.tagName) candidates.push(child);
      }
      for (const node of candidates) {
        if (out.length >= MAX_NEARBY) break;
        if (node === el) continue;
        const blob = `${node.id || ""} ${node.className || ""} ${node.textContent || ""}`;
        if (!/(error|invalid|help|validation|subtype|sub\s*type|select)/i.test(blob)) continue;
        pushNode(node, "parent-descendant");
      }
      const sibling = el.nextElementSibling;
      if (sibling) {
        const blob = `${sibling.id || ""} ${sibling.className || ""} ${sibling.textContent || ""}`;
        if (/(error|invalid|help|validation|subtype|sub\s*type|select)/i.test(blob)) {
          pushNode(sibling, "sibling");
        }
      }
    }
    return out.slice(0, MAX_NEARBY);
  }

  function isSubtypeRelated(term) {
    return /subtype|sub\s*type|subTypeId/i.test(String(term || ""));
  }

  function isValidationOrSentinel(term) {
    return /please\s*select|"-1"|'-1'|save_btn|save_rbtn|categoryId|valid|error|required/i.test(
      String(term || ""),
    );
  }

  function scriptMatches() {
    const inlineMatches = [];
    const externalUnresolved = [];
    const scripts = Array.from(document.scripts || []);
    for (let index = 0; index < scripts.length; index += 1) {
      const script = scripts[index];
      const src = attr(script, "src");
      if (src) {
        if (externalUnresolved.length >= 5) continue;
        let srcPath = null;
        try {
          const base =
            typeof location !== "undefined" && location.href
              ? location.href
              : "https://www.e-aushadhi.gov.in/";
          srcPath = new URL(src, base).pathname || null;
        } catch {
          srcPath = sliceText(src, MAX_TEXT);
        }
        // Do not fetch external script bodies.
        externalUnresolved.push({
          script_index: index,
          src_path: srcPath,
          source_kind: "external_unresolved",
          match_term: null,
          context_snippet: null,
          evidence_class: "external_script_not_fetched",
          subtype_related: false,
          validation_or_sentinel: false,
        });
        continue;
      }

      const body = String(script.textContent || "");
      if (!body) continue;
      const lower = body.toLowerCase();
      for (const term of MATCH_TERMS) {
        if (inlineMatches.length >= MAX_SCRIPT_MATCHES) break;
        const idx = lower.indexOf(String(term).toLowerCase());
        if (idx < 0) continue;
        const start = Math.max(0, idx - 40);
        const end = Math.min(body.length, idx + String(term).length + 80);
        const snippet = sliceText(body.slice(start, end), MAX_SNIPPET);
        const subtypeRelated = isSubtypeRelated(term) || /subtype|sub\s*type|subtypeid/i.test(snippet);
        const validationOrSentinel =
          isValidationOrSentinel(term) || /please\s*select|valid|error|required|"-1"|'-1'/i.test(snippet);
        let evidenceClass = "validation_contract_candidate";
        if (subtypeRelated && validationOrSentinel) {
          evidenceClass = "subtype_validation_candidate";
        } else if (!subtypeRelated && /"-1"|'-1'/.test(term)) {
          evidenceClass = "unrelated_sentinel_candidate";
        }
        inlineMatches.push({
          script_index: index,
          src_path: null,
          source_kind: "inline",
          match_term: term,
          context_snippet: snippet,
          evidence_class: evidenceClass,
          subtype_related: subtypeRelated,
          validation_or_sentinel: validationOrSentinel,
        });
      }
    }
    return inlineMatches.concat(externalUnresolved).slice(0, MAX_SCRIPT_MATCHES);
  }

  let pathHint = null;
  try {
    pathHint = location && location.pathname ? String(location.pathname) : null;
  } catch {
    pathHint = null;
  }

  const subtype = subtypeControl();
  return {
    target_path_hint: pathHint,
    subtype_control: subtype,
    submit_controls: submitControls(),
    nearby_validation_elements: nearbyValidationElements(subtype),
    script_matches: scriptMatches(),
    limitations: [
      "external_script_bodies_not_fetched",
      "delegated_or_dynamic_listeners_not_enumerated",
      "checkValidity_and_reportValidity_not_called",
    ],
  };
}

module.exports = {
  extractClassificationValidationEvidence,
};
