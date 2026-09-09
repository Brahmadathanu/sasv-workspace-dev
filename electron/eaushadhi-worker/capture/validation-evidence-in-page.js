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
  // Hard cap for transferring Function#toString of an allowlisted referenced handler.
  const MAX_REFERENCED_FUNCTION_SOURCE = 262144;
  const MAX_HANDLER_SNIPPETS = 8;
  const SUBTYPE_VALIDATION_MESSAGE = "Please Select Sub Type";
  const MAX_SUBTYPE_MESSAGE_CONTEXTS = 3;
  const SUBTYPE_MESSAGE_CONTEXT_BEFORE = 512;
  const SUBTYPE_MESSAGE_CONTEXT_AFTER = 256;
  const MAX_SUBTYPE_MESSAGE_CONTEXT = 1024;

  const SUBMIT_IDS = ["save_btn", "save_rbtn"];
  // Legacy Add Product primary submit target only — do not expand without new evidence.
  const REFERENCED_HANDLER_ALLOWLIST = ["SaveData"];
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
  const HANDLER_MATCH_TERMS = [
    "subTypeId",
    "subtype",
    "sub type",
    "Sub Type",
    "categoryId",
    '"-1"',
    "'-1'",
    "Please Select",
    "required",
    "error",
    "alert",
    "validation",
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

  /**
   * Conservative: only count when a subtype value expression is directly compared
   * to a quoted "-1" (either operand order). Prefer under-classification.
   */
  function subtypeValueExprSource() {
    return (
      "(?:" +
      "document\\.getElementById\\s*\\(\\s*['\"]subTypeId['\"]\\s*\\)\\s*\\.\\s*value" +
      "|" +
      "\\$\\s*\\(\\s*['\"]#subTypeId['\"]\\s*\\)\\s*\\.\\s*val\\s*\\(\\s*\\)" +
      "|" +
      "subTypeId\\s*\\.\\s*value" +
      ")"
    );
  }

  function directMinusOneRegexes() {
    const subtypeValueExpr = subtypeValueExprSource();
    const minusOne = "['\"]-1['\"]";
    const op = "(?:===?|!==?)";
    return [
      new RegExp(subtypeValueExpr + "\\s*" + op + "\\s*" + minusOne, "gi"),
      new RegExp(minusOne + "\\s*" + op + "\\s*" + subtypeValueExpr, "gi"),
    ];
  }

  function hasDirectMinusOneComparison(snippet) {
    const s = String(snippet || "");
    return directMinusOneRegexes().some((re) => {
      re.lastIndex = 0;
      return re.test(s);
    });
  }

  /**
   * Stronger than candidate: recognized direct subtype-to--1 comparison plus
   * rejection/messaging language in the same bounded snippet.
   */
  function hasRejectionMessaging(text) {
    return /please\s*select|alert\s*\(|\$\s*\.\s*confirm\s*\(|throw\s+|return\s+['"][^'"]+/i.test(
      String(text || ""),
    );
  }

  function hasExplicitMinusOneRejection(snippet) {
    if (!hasDirectMinusOneComparison(snippet)) return false;
    return hasRejectionMessaging(snippet);
  }

  function isEqualityOperator(op) {
    return op === "==" || op === "===";
  }

  /**
   * Trusted binding only:
   *   var|let|const subTypeId = document.getElementById("subTypeId").value
   * Do not add bare subTypeId to subtypeValueExprSource().
   */
  function collectTrustedSubTypeAliases(source) {
    const body = String(source || "");
    const re =
      /(?:var|let|const)\s+(subTypeId)\s*=\s*document\.getElementById\s*\(\s*['"]subTypeId['"]\s*\)\s*\.\s*value\s*;?/gi;
    const out = [];
    let match;
    while ((match = re.exec(body)) !== null) {
      out.push({
        aliasName: match[1],
        assignStart: match.index,
        assignEnd: match.index + match[0].length,
        assignmentText: match[0],
        sourceExpression: 'document.getElementById("subTypeId").value',
      });
      if (out.length >= 5) break;
    }
    return out;
  }

  function aliasReassignedBetween(source, aliasName, from, to) {
    if (to <= from) return false;
    const slice = String(source || "").slice(from, to);
    // Any assignment to the alias (not == / === / != / !==).
    const re = new RegExp("(?:^|[^\\w$])" + aliasName + "\\s*=(?!=)", "g");
    return re.test(slice);
  }

  function findAliasComparisons(source, aliasName, afterOffset) {
    const body = String(source || "");
    const out = [];
    const forward = new RegExp(
      "(?:^|[^\\w$])(" + aliasName + ")\\s*(===?|!==?)\\s*['\"]-1['\"]",
      "g",
    );
    const reverse = new RegExp(
      "['\"]-1['\"]\\s*(===?|!==?)\\s*(" + aliasName + ")(?![\\w$])",
      "g",
    );
    function pushMatch(match, operator) {
      const cmpIndex = match.index;
      if (cmpIndex < afterOffset) return;
      out.push({
        index: cmpIndex,
        end: cmpIndex + match[0].length,
        operator,
        text: match[0],
      });
    }
    let match;
    while ((match = forward.exec(body)) !== null) {
      pushMatch(match, match[2]);
      if (out.length >= 8) return out;
    }
    while ((match = reverse.exec(body)) !== null) {
      pushMatch(match, match[1]);
      if (out.length >= 8) return out;
    }
    return out;
  }

  function collectAliasedMinusOneMatches(body, scriptIndex) {
    const source = String(body || "");
    const out = [];
    const seen = new Set();
    for (const binding of collectTrustedSubTypeAliases(source)) {
      const comparisons = findAliasComparisons(source, binding.aliasName, binding.assignEnd);
      for (const cmp of comparisons) {
        const provenanceValid = !aliasReassignedBetween(
          source,
          binding.aliasName,
          binding.assignEnd,
          cmp.index,
        );
        if (!provenanceValid) continue;

        const equality = isEqualityOperator(cmp.operator);
        const explicitWindowStart = Math.max(0, cmp.index - 80);
        const explicitWindowEnd = Math.min(source.length, cmp.end + 220);
        const explicitWindow = source.slice(explicitWindowStart, explicitWindowEnd);
        const contextStart = Math.max(0, cmp.index - 24);
        const contextEnd = Math.min(source.length, cmp.end + 72);
        const snippet = sliceText(source.slice(contextStart, contextEnd), MAX_SNIPPET);
        const assignmentSnippet = sliceText(binding.assignmentText, MAX_SNIPPET);
        const comparisonSnippet = sliceText(cmp.text, MAX_SNIPPET);

        const key = `${binding.assignStart}:${cmp.index}:${cmp.operator}`;
        if (seen.has(key)) continue;
        seen.add(key);

        // Inequality: factual alias comparison only — never rejection/explicit.
        if (!equality) {
          out.push({
            script_index: scriptIndex,
            src_path: null,
            source_kind: scriptIndex == null ? "referenced_handler" : "inline",
            match_term: "subTypeId-alias~-1",
            context_snippet: snippet,
            evidence_class: "subtype_alias_inequality_comparison_candidate",
            subtype_related: true,
            validation_or_sentinel: true,
            direct_minus_one_comparison: false,
            explicit_minus_one_rejection: false,
            alias_name: binding.aliasName,
            alias_source_expression: binding.sourceExpression,
            alias_assignment_snippet: assignmentSnippet,
            alias_comparison_snippet: comparisonSnippet,
            comparison_operator: cmp.operator,
            direct_alias_minus_one_comparison: true,
            alias_provenance_valid: true,
            explicit_alias_minus_one_rejection: false,
          });
          if (out.length >= 5) return out;
          continue;
        }

        const explicitAlias =
          hasRejectionMessaging(explicitWindow) || hasRejectionMessaging(snippet);
        out.push({
          script_index: scriptIndex,
          src_path: null,
          source_kind: scriptIndex == null ? "referenced_handler" : "inline",
          match_term: "subTypeId-alias~-1",
          context_snippet: snippet,
          evidence_class: explicitAlias
            ? "explicit_subtype_minus_one_rejection_candidate"
            : "subtype_minus_one_rejection_candidate",
          subtype_related: true,
          validation_or_sentinel: true,
          direct_minus_one_comparison: true,
          explicit_minus_one_rejection: explicitAlias,
          alias_name: binding.aliasName,
          alias_source_expression: binding.sourceExpression,
          alias_assignment_snippet: assignmentSnippet,
          alias_comparison_snippet: comparisonSnippet,
          comparison_operator: cmp.operator,
          direct_alias_minus_one_comparison: true,
          alias_provenance_valid: true,
          explicit_alias_minus_one_rejection: explicitAlias,
        });
        if (out.length >= 5) return out;
      }
    }
    return out;
  }

  function collectDirectMinusOneMatches(body, scriptIndex) {
    const out = [];
    const seen = new Set();
    const source = String(body || "");
    for (const re of directMinusOneRegexes()) {
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(source)) !== null) {
        const start = Math.max(0, match.index - 24);
        const end = Math.min(source.length, match.index + match[0].length + 72);
        const snippet = sliceText(source.slice(start, end), MAX_SNIPPET);
        const key = `${match.index}:${snippet}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const explicitMinusOne = hasExplicitMinusOneRejection(snippet);
        out.push({
          script_index: scriptIndex,
          src_path: null,
          source_kind: "inline",
          match_term: "subTypeId~-1",
          context_snippet: snippet,
          evidence_class: explicitMinusOne
            ? "explicit_subtype_minus_one_rejection_candidate"
            : "subtype_minus_one_rejection_candidate",
          subtype_related: true,
          validation_or_sentinel: true,
          direct_minus_one_comparison: true,
          explicit_minus_one_rejection: explicitMinusOne,
        });
        if (out.length >= 5) break;
      }
      if (out.length >= 5) break;
    }
    for (const aliasHit of collectAliasedMinusOneMatches(source, scriptIndex)) {
      if (out.length >= 5) break;
      const key = `alias:${aliasHit.alias_assignment_snippet}:${aliasHit.alias_comparison_snippet}:${aliasHit.comparison_operator}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(aliasHit);
    }
    return out;
  }

  function classifyInlineSnippet(term, snippet) {
    const subtypeRelated = isSubtypeRelated(term) || /subtype|sub\s*type|subtypeid/i.test(snippet);
    const validationOrSentinel =
      isValidationOrSentinel(term) || /please\s*select|valid|error|required|"-1"|'-1'/i.test(snippet);
    const directMinusOne = hasDirectMinusOneComparison(snippet);
    const explicitMinusOne = hasExplicitMinusOneRejection(snippet);
    const termIsMinusOneSentinel = /"-1"|'-1'/.test(String(term || ""));
    const hasSubtypeControlRef =
      /subTypeId|#subTypeId|getElementById\s*\(\s*['"]subTypeId['"]\s*\)/i.test(String(snippet || ""));

    let evidenceClass = "validation_contract_candidate";
    if (explicitMinusOne) {
      evidenceClass = "explicit_subtype_minus_one_rejection_candidate";
    } else if (directMinusOne) {
      evidenceClass = "subtype_minus_one_rejection_candidate";
    } else if (termIsMinusOneSentinel && !hasSubtypeControlRef) {
      // A bare "-1" without a subtype control reference is not subtype rejection evidence,
      // even if nearby prose mentions the English word "subtype".
      evidenceClass = "unrelated_sentinel_candidate";
    } else if (subtypeRelated && validationOrSentinel) {
      evidenceClass = "subtype_validation_candidate";
    }

    return {
      evidenceClass,
      subtypeRelated: hasSubtypeControlRef || (subtypeRelated && !termIsMinusOneSentinel),
      validationOrSentinel,
      directMinusOne,
      explicitMinusOne,
    };
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
          direct_minus_one_comparison: false,
          explicit_minus_one_rejection: false,
        });
        continue;
      }

      const body = String(script.textContent || "");
      if (!body) continue;
      const lower = body.toLowerCase();
      const perScript = [];
      for (const term of MATCH_TERMS) {
        const idx = lower.indexOf(String(term).toLowerCase());
        if (idx < 0) continue;
        const start = Math.max(0, idx - 60);
        const end = Math.min(body.length, idx + String(term).length + 120);
        const snippet = sliceText(body.slice(start, end), MAX_SNIPPET);
        const classified = classifyInlineSnippet(term, snippet);
        perScript.push({
          script_index: index,
          src_path: null,
          source_kind: "inline",
          match_term: term,
          context_snippet: snippet,
          evidence_class: classified.evidenceClass,
          subtype_related: classified.subtypeRelated,
          validation_or_sentinel: classified.validationOrSentinel,
          direct_minus_one_comparison: classified.directMinusOne,
          explicit_minus_one_rejection: classified.explicitMinusOne,
        });
      }
      // Dedicated body scan finds every direct subtype-to--1 comparison, not only
      // the first term hit inside a large script.
      for (const direct of collectDirectMinusOneMatches(body, index)) {
        perScript.push(direct);
      }
      // Prefer keeping recognized direct/alias subtype-to--1 comparison matches,
      // and at most one match per other evidence_class so negatives are not crowded out.
      const kept = [];
      const byClass = new Map();
      for (const match of perScript) {
        if (
          match.direct_minus_one_comparison === true ||
          match.direct_alias_minus_one_comparison === true
        ) {
          if (
            kept.filter(
              (item) =>
                item.direct_minus_one_comparison === true ||
                item.direct_alias_minus_one_comparison === true,
            ).length < 5
          ) {
            kept.push(match);
          }
          continue;
        }
        if (!byClass.has(match.evidence_class)) byClass.set(match.evidence_class, match);
      }
      for (const match of byClass.values()) kept.push(match);
      for (const match of kept) {
        if (inlineMatches.length >= MAX_SCRIPT_MATCHES) break;
        inlineMatches.push(match);
      }
    }
    return inlineMatches.concat(externalUnresolved).slice(0, MAX_SCRIPT_MATCHES);
  }

  /**
   * Recognize only a simple zero-arg Identifier() call. Reject dotted / dynamic forms.
   * Name must still pass the hard allowlist before resolution.
   */
  function simpleAllowlistedCallName(preview) {
    const text = String(preview || "");
    if (!text) return null;
    if (/\[\s*['"]SaveData['"]\s*\]/.test(text)) return null;
    // Require a non-member SaveData() occurrence (rejects only-dotted forms like obj.SaveData()).
    const match = text.match(/(?:^|[^\w$.])(SaveData)\s*\(\s*\)/);
    if (!match) return null;
    if (REFERENCED_HANDLER_ALLOWLIST.indexOf(match[1]) < 0) return null;
    return match[1];
  }

  function scanHandlerSource(body) {
    const source = String(body || "");
    const lower = source.toLowerCase();
    const per = [];
    for (const term of HANDLER_MATCH_TERMS) {
      const idx = lower.indexOf(String(term).toLowerCase());
      if (idx < 0) continue;
      const start = Math.max(0, idx - 60);
      const end = Math.min(source.length, idx + String(term).length + 120);
      const snippet = sliceText(source.slice(start, end), MAX_SNIPPET);
      const classified = classifyInlineSnippet(term, snippet);
      per.push({
        match_term: term,
        context_snippet: snippet,
        evidence_class: classified.evidenceClass,
        subtype_related: classified.subtypeRelated,
        validation_or_sentinel: classified.validationOrSentinel,
        direct_minus_one_comparison: classified.directMinusOne,
        explicit_minus_one_rejection: classified.explicitMinusOne,
      });
    }
    for (const direct of collectDirectMinusOneMatches(source, null)) {
      per.push({
        match_term: direct.match_term,
        context_snippet: direct.context_snippet,
        evidence_class: direct.evidence_class,
        subtype_related: direct.subtype_related,
        validation_or_sentinel: direct.validation_or_sentinel,
        direct_minus_one_comparison: direct.direct_minus_one_comparison,
        explicit_minus_one_rejection: direct.explicit_minus_one_rejection,
        alias_name: direct.alias_name || null,
        alias_source_expression: direct.alias_source_expression || null,
        alias_assignment_snippet: direct.alias_assignment_snippet || null,
        alias_comparison_snippet: direct.alias_comparison_snippet || null,
        comparison_operator: direct.comparison_operator || null,
        direct_alias_minus_one_comparison: direct.direct_alias_minus_one_comparison === true,
        alias_provenance_valid: direct.alias_provenance_valid === true,
        explicit_alias_minus_one_rejection: direct.explicit_alias_minus_one_rejection === true,
      });
    }
    const kept = [];
    const byClass = new Map();
    for (const item of per) {
      if (
        item.direct_minus_one_comparison === true ||
        item.direct_alias_minus_one_comparison === true
      ) {
        if (
          kept.filter(
            (row) =>
              row.direct_minus_one_comparison === true ||
              row.direct_alias_minus_one_comparison === true,
          ).length < 5
        ) {
          kept.push(item);
        }
        continue;
      }
      if (!byClass.has(item.evidence_class)) byClass.set(item.evidence_class, item);
    }
    for (const item of byClass.values()) kept.push(item);
    return kept.slice(0, MAX_HANDLER_SNIPPETS);
  }

  function observationFlagsFromSnippets(snippets) {
    const list = Array.isArray(snippets) ? snippets : [];
    return {
      subtype_validation_candidate_observed: list.some(
        (item) =>
          item.evidence_class === "subtype_validation_candidate" ||
          item.evidence_class === "subtype_minus_one_rejection_candidate" ||
          item.evidence_class === "explicit_subtype_minus_one_rejection_candidate",
      ),
      // Rejection requires equality-class evidence — not bare inequality alias facts.
      subtype_minus_one_rejection_candidate_observed: list.some(
        (item) =>
          item.evidence_class === "subtype_minus_one_rejection_candidate" ||
          item.evidence_class === "explicit_subtype_minus_one_rejection_candidate" ||
          (item.direct_minus_one_comparison === true &&
            item.evidence_class !== "subtype_alias_inequality_comparison_candidate"),
      ),
      explicit_subtype_minus_one_rejection_observed: list.some(
        (item) =>
          item.evidence_class === "explicit_subtype_minus_one_rejection_candidate" ||
          item.explicit_minus_one_rejection === true ||
          item.explicit_alias_minus_one_rejection === true,
      ),
    };
  }

  /**
   * Factual only: bounded windows around exact "Please Select Sub Type" in a full
   * untruncated SaveData Function#toString body. No semantic classification.
   */
  function collectSubtypeValidationMessageContexts(fullSource) {
    const source = String(fullSource || "");
    const needle = SUBTYPE_VALIDATION_MESSAGE;
    const needleLower = needle.toLowerCase();
    const sourceLower = source.toLowerCase();
    const out = [];
    let searchFrom = 0;
    while (out.length < MAX_SUBTYPE_MESSAGE_CONTEXTS) {
      const messageOffset = sourceLower.indexOf(needleLower, searchFrom);
      if (messageOffset < 0) break;
      const phraseEnd = messageOffset + needle.length;
      const rawStart = Math.max(0, messageOffset - SUBTYPE_MESSAGE_CONTEXT_BEFORE);
      const rawEnd = Math.min(source.length, phraseEnd + SUBTYPE_MESSAGE_CONTEXT_AFTER);
      const rawSlice = source.slice(rawStart, rawEnd);
      out.push({
        validation_message: SUBTYPE_VALIDATION_MESSAGE,
        validation_message_offset: messageOffset,
        // Transport raw slice; Node finalize sanitizes to <= 1024.
        validation_branch_context_snippet_raw: rawSlice,
        validation_branch_context_start: rawStart,
        validation_branch_context_end: rawEnd,
        validation_branch_context_truncated_before: rawStart > 0,
        validation_branch_context_truncated_after: rawEnd < source.length,
      });
      searchFrom = phraseEnd;
    }
    return out;
  }

  /**
   * Read-only inspection of allowlisted globals referenced by submit onclick wrappers.
   * Uses Function.prototype.toString only — never invokes the target function.
   */
  function referencedHandlerFunctions(controls) {
    const out = [];
    const globalObject = typeof window !== "undefined" ? window : globalThis;
    for (const control of controls || []) {
      if (!control || control.control_found !== true || control.id !== "save_btn") continue;
      const fromAttribute = simpleAllowlistedCallName(control.onclick_attribute);
      const fromPreview = simpleAllowlistedCallName(control.onclick_source_preview_raw);
      const functionName = fromAttribute || fromPreview;
      if (!functionName) continue;

      // Hard-coded property access for the allowlisted legacy name only.
      const value = globalObject.SaveData;
      const typeOf = typeof value;
      const entry = {
        function_name: functionName,
        control_id: control.id,
        referenced_by_onclick: true,
        found: typeOf === "function",
        typeof: typeOf,
        source_capture_status: "not_found",
        source_length: null,
        source_truncated: false,
        function_source_raw: null,
        snippets: [],
        subtype_validation_message_contexts: [],
        observation_flags: {
          subtype_validation_candidate_observed: false,
          subtype_minus_one_rejection_candidate_observed: false,
          explicit_subtype_minus_one_rejection_observed: false,
        },
        evidence_complete: false,
      };

      if (typeOf !== "function") {
        entry.source_capture_status = typeOf === "undefined" ? "not_found" : "not_a_function";
        out.push(entry);
        continue;
      }

      try {
        const raw = Function.prototype.toString.call(value);
        entry.source_length = raw.length;
        if (/\[native code\]/i.test(raw)) {
          entry.source_capture_status = "native_or_opaque";
        } else if (raw.length > MAX_REFERENCED_FUNCTION_SOURCE) {
          // Bound scan only; do not transfer unrestricted full source across evaluate.
          // Wide subtype message contexts require untruncated full source — omit them.
          entry.source_truncated = true;
          entry.source_capture_status = "captured_truncated";
          const bounded = raw.slice(0, MAX_REFERENCED_FUNCTION_SOURCE);
          entry.snippets = scanHandlerSource(bounded);
          entry.function_source_raw = null;
          entry.subtype_validation_message_contexts = [];
        } else {
          entry.source_truncated = false;
          entry.source_capture_status = "captured";
          entry.snippets = scanHandlerSource(raw);
          entry.function_source_raw = raw;
          entry.subtype_validation_message_contexts = collectSubtypeValidationMessageContexts(raw);
        }
        entry.observation_flags = observationFlagsFromSnippets(entry.snippets);
      } catch {
        entry.source_capture_status = "tostring_failed";
      }
      out.push(entry);
    }
    return out;
  }

  let pathHint = null;
  try {
    pathHint = location && location.pathname ? String(location.pathname) : null;
  } catch {
    pathHint = null;
  }

  const subtype = subtypeControl();
  const controls = submitControls();
  const referenced = referencedHandlerFunctions(controls);
  const limitations = [
    "external_script_bodies_not_fetched",
    "delegated_or_dynamic_listeners_not_enumerated",
    "checkValidity_and_reportValidity_not_called",
    "referenced_handler_bodies_via_tostring_only",
  ];
  if (referenced.some((item) => item.source_capture_status === "native_or_opaque")) {
    limitations.push("native_or_opaque_functions_not_inspectable");
  }
  if (referenced.some((item) => item.source_truncated === true)) {
    limitations.push("referenced_function_source_size_limited");
  }

  return {
    target_path_hint: pathHint,
    subtype_control: subtype,
    submit_controls: controls,
    nearby_validation_elements: nearbyValidationElements(subtype),
    script_matches: scriptMatches(),
    referenced_handler_functions: referenced,
    limitations,
  };
}

module.exports = {
  extractClassificationValidationEvidence,
};
