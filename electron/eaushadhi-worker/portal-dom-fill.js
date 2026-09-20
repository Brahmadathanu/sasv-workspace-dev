/* eslint-env node */

/**
 * Bounded portal DOM fill helpers for Product Details execution.
 * Pure planning helpers + injectable page adapters. No network.
 */

/** Default bounded wait for dependent controls after classification. */
const CONTROL_READY_TIMEOUT_MS = 8000;
const CONTROL_READY_POLL_MS = 50;

function buildDependentClassificationSteps(fillPlan) {
  const byKey = new Map((fillPlan?.fields || []).map((f) => [f.key, f]));
  const type = byKey.get("type");
  const category = byKey.get("categoryId");
  const subtype = byKey.get("subTypeId");
  const steps = [];
  if (type?.fill) {
    steps.push({ key: "type", selector: "#type", value: type.expected, waitFor: "categoryId" });
  }
  if (category?.fill) {
    steps.push({
      key: "categoryId",
      selector: "#categoryId",
      value: category.expected,
      waitFor: "subTypeId",
    });
  }
  if (subtype?.fill) {
    steps.push({ key: "subTypeId", selector: "#subTypeId", value: subtype.expected, waitFor: null });
  }
  return steps;
}

/**
 * In-page fill script factory (string). Evaluated only when executor runs with a live page.
 * Smokes must not evaluate this against the real portal.
 */
function createInPageFillScript() {
  return `async function __sasvFillProductDetails(plan) {
    var CONTROL_READY_TIMEOUT_MS = 8000;
    var CONTROL_READY_POLL_MS = 50;
    function q(sel) { return document.querySelector(sel); }
    function optionsOf(sel) {
      const el = q(sel);
      if (!el || !el.options) return [];
      return Array.from(el.options).map(function(o) {
        return { value: String(o.value), label: String(o.textContent || o.label || '') };
      });
    }
    function setSelectByValue(sel, value) {
      const el = q(sel);
      if (!el) throw new Error('missing ' + sel);
      el.value = String(value);
      el.dispatchEvent(new Event('change', { bubbles: true }));
      if (window.jQuery) {
        try { window.jQuery(el).val(String(value)).trigger('change'); } catch (e) {}
      }
      return String(el.value);
    }
    function setText(sel, value) {
      const el = q(sel);
      if (!el) throw new Error('missing ' + sel);
      el.value = String(value == null ? '' : value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return String(el.value);
    }
    function failControl(code, fieldKey) {
      var err = new Error(code);
      err.code = code;
      err.fieldKey = fieldKey || null;
      throw err;
    }
    function readyTimeoutMs() {
      var n = Number(plan && plan.controlReadyTimeoutMs);
      if (Number.isFinite(n) && n > 0 && n <= CONTROL_READY_TIMEOUT_MS) return n;
      return CONTROL_READY_TIMEOUT_MS;
    }
    function waitForElement(sel, timeoutMs) {
      var deadline = Date.now() + (timeoutMs || CONTROL_READY_TIMEOUT_MS);
      return new Promise(function(resolve, reject) {
        (function tick() {
          if (q(sel)) return resolve(true);
          if (Date.now() > deadline) {
            return reject(new Error('element timeout ' + sel));
          }
          setTimeout(tick, CONTROL_READY_POLL_MS);
        })();
      });
    }
    /**
     * Wait until exactly one option label matches expected (trim/case-insensitive).
     * Placeholder-only (--Select--) is NOT ready. Duplicate exact labels fail closed.
     */
    function waitForExactSelectOption(sel, expectedLabel, timeoutMs) {
      var expected = String(expectedLabel || '').trim().toLowerCase();
      var deadline = Date.now() + (timeoutMs || CONTROL_READY_TIMEOUT_MS);
      return new Promise(function(resolve, reject) {
        (function tick() {
          var el = q(sel);
          if (el) {
            var opts = optionsOf(sel);
            var matches = opts.filter(function(o) {
              return String(o.label || '').trim().toLowerCase() === expected;
            });
            if (matches.length > 1) {
              var amb = new Error('PORTAL_PERMISSION_PURPOSE_TARGET_AMBIGUOUS');
              amb.code = 'PORTAL_PERMISSION_PURPOSE_TARGET_AMBIGUOUS';
              return reject(amb);
            }
            if (matches.length === 1) {
              return resolve({ label: matches[0].label, value: matches[0].value });
            }
            // 0 matches: placeholder-only or Ajax not finished — keep waiting.
          }
          if (Date.now() > deadline) {
            var miss = new Error('PORTAL_PERMISSION_PURPOSE_TARGET_NOT_READY');
            miss.code = 'PORTAL_PERMISSION_PURPOSE_TARGET_NOT_READY';
            return reject(miss);
          }
          setTimeout(tick, CONTROL_READY_POLL_MS);
        })();
      });
    }
    /**
     * Narrow readiness for governed exact-value radios (Shelf Life).
     * Exact-value uniqueness is evaluated separately BEFORE this helper.
     * Intentionally omits legacy layout-parent heuristics and Playwright actionability.
     */
    function isExactRadioTargetReady(el) {
      if (!el) return false;
      var tag = String(el.tagName || '').toLowerCase();
      if (tag && tag !== 'input') return false;
      var type = String(el.type || '').toLowerCase();
      if (type && type !== 'radio') return false;
      if (el.isConnected === false) return false;
      if (el.disabled === true) return false;
      if (el.hidden === true) return false;
      var win = typeof window !== 'undefined' ? window : null;
      var style = win && typeof win.getComputedStyle === 'function' ? win.getComputedStyle(el) : null;
      if (style) {
        if (String(style.display || '') === 'none') return false;
        if (String(style.visibility || '') === 'hidden') return false;
      }
      return true;
    }
    function shelfRadioSel(name) {
      return String(name) === 'shelfmonth'
        ? 'input[name="shelfmonth"]'
        : 'input[name="' + String(name).replace(/"/g, '') + '"]';
    }
    function collectExactValueRadios(name, expectedValue) {
      var expected = String(expectedValue || '').trim();
      var all = document.querySelectorAll(shelfRadioSel(name));
      var sameName = Array.prototype.slice.call(all);
      var exact = sameName.filter(function(el) {
        return String(el.value || '') === expected;
      });
      return { sameName: sameName, exact: exact, expected: expected };
    }
    function describeExactRadioCandidates(exact) {
      var parts = [];
      var limit = Math.min(exact.length, 3);
      for (var i = 0; i < limit; i++) {
        var el = exact[i];
        var win = typeof window !== 'undefined' ? window : null;
        var style = win && typeof win.getComputedStyle === 'function' ? win.getComputedStyle(el) : null;
        parts.push(
          'cand' + i +
            '{id=' + String(el && el.id != null ? el.id : '') +
            ',value=' + String(el && el.value != null ? el.value : '') +
            ',disabled=' + String(el && el.disabled === true) +
            ',connected=' + String(el && el.isConnected !== false) +
            ',hidden=' + String(el && el.hidden === true) +
            ',display=' + String(style && style.display != null ? style.display : '') +
            ',visibility=' + String(style && style.visibility != null ? style.visibility : '') +
            ',ready=' + String(isExactRadioTargetReady(el)) +
            '}'
        );
      }
      return parts.join(';');
    }
    function shelfRadioDiag(name, expected, collected) {
      return (
        'name=' + String(name) +
        ' expected=' + String(expected) +
        ' sameNameCount=' + String(collected.sameName.length) +
        ' exactValueCount=' + String(collected.exact.length) +
        (collected.exact.length ? ' ' + describeExactRadioCandidates(collected.exact) : '')
      );
    }
    function resolveUniqueExactReadyRadio(name, expectedValue) {
      var collected = collectExactValueRadios(name, expectedValue);
      if (collected.exact.length > 1) {
        var amb = new Error(
          'PORTAL_SHELFLIFE_TARGET_AMBIGUOUS ' + shelfRadioDiag(name, collected.expected, collected)
        );
        amb.code = 'PORTAL_SHELFLIFE_TARGET_AMBIGUOUS';
        throw amb;
      }
      if (collected.exact.length === 1 && isExactRadioTargetReady(collected.exact[0])) {
        return collected.exact[0];
      }
      return null;
    }
    /**
     * Wait until exactly one exact-value radio exists and that unique candidate is ready.
     * Exact-value duplicates fail closed as AMBIGUOUS before readiness is considered.
     */
    function waitForExactVisibleRadio(name, expectedValue, timeoutMs) {
      var expected = String(expectedValue || '').trim();
      var deadline = Date.now() + (timeoutMs || CONTROL_READY_TIMEOUT_MS);
      return new Promise(function(resolve, reject) {
        (function tick() {
          try {
            var collected = collectExactValueRadios(name, expected);
            if (collected.exact.length > 1) {
              var amb = new Error(
                'PORTAL_SHELFLIFE_TARGET_AMBIGUOUS ' + shelfRadioDiag(name, expected, collected)
              );
              amb.code = 'PORTAL_SHELFLIFE_TARGET_AMBIGUOUS';
              return reject(amb);
            }
            if (collected.exact.length === 1 && isExactRadioTargetReady(collected.exact[0])) {
              return resolve(collected.exact[0]);
            }
          } catch (e) {
            return reject(e);
          }
          if (Date.now() > deadline) {
            var collectedLate = collectExactValueRadios(name, expected);
            var miss = new Error(
              'PORTAL_SHELFLIFE_TARGET_NOT_READY ' + shelfRadioDiag(name, expected, collectedLate)
            );
            miss.code = 'PORTAL_SHELFLIFE_TARGET_NOT_READY';
            return reject(miss);
          }
          setTimeout(tick, CONTROL_READY_POLL_MS);
        })();
      });
    }
    function waitForOption(sel, value, timeoutMs) {
      const deadline = Date.now() + (timeoutMs || 8000);
      return new Promise(function(resolve, reject) {
        (function tick() {
          const opts = optionsOf(sel);
          if (opts.some(function(o) { return o.value === String(value) || o.label.trim() === String(value).trim(); })) {
            return resolve(true);
          }
          if (Date.now() > deadline) return reject(new Error('option timeout ' + sel + ' ' + value));
          setTimeout(tick, 50);
        })();
      });
    }
    var proven = { permission: null, shelfRadio: null };
    async function waitRequiredDependentControls() {
      var fields = plan.fields || [];
      var timeoutMs = readyTimeoutMs();
      var permissionField = fields.find(function(f) { return f && f.fill && f.key === 'permissionPurpose'; });
      var shelfField = fields.find(function(f) { return f && f.fill && f.key === 'shelfmonth'; });
      var needsUpload = fields.some(function(f) { return f && f.fill && f.key === 'uploadAttachment'; });

      if (permissionField) {
        try {
          proven.permission = await waitForExactSelectOption(
            '#permissionPurpose',
            permissionField.expected,
            timeoutMs,
          );
        } catch (e) {
          var pCode = String(e && (e.code || e.message) || '');
          if (pCode.indexOf('PORTAL_PERMISSION_PURPOSE_TARGET_AMBIGUOUS') >= 0) {
            failControl('PORTAL_PERMISSION_PURPOSE_TARGET_AMBIGUOUS', 'permissionPurpose');
          }
          failControl('PORTAL_PERMISSION_PURPOSE_TARGET_NOT_READY', 'permissionPurpose');
        }
      }
      if (shelfField) {
        try {
          proven.shelfRadio = await waitForExactVisibleRadio(
            'shelfmonth',
            shelfField.expected,
            timeoutMs,
          );
        } catch (e) {
          var sCode = String(e && (e.code || e.message) || '');
          if (sCode.indexOf('PORTAL_SHELFLIFE_TARGET_AMBIGUOUS') >= 0) {
            if (e && e.code === 'PORTAL_SHELFLIFE_TARGET_AMBIGUOUS') throw e;
            failControl('PORTAL_SHELFLIFE_TARGET_AMBIGUOUS', 'shelfmonth');
          }
          if (e && e.code === 'PORTAL_SHELFLIFE_TARGET_NOT_READY') throw e;
          failControl('PORTAL_SHELFLIFE_TARGET_NOT_READY', 'shelfmonth');
        }
      }
      if (needsUpload) {
        try {
          await waitForElement('#uploadAttachment', timeoutMs);
        } catch (e) {
          failControl('PORTAL_REQUIRED_CONTROL_MISSING', 'uploadAttachment');
        }
      }
    }
    const result = { filled: [], permission: null };
    for (const step of (plan.classificationSteps || [])) {
      if (step.key === 'categoryId' || step.key === 'subTypeId') {
        await waitForOption(step.selector, step.value, 8000);
      }
      const selected = setSelectByValue(step.selector, step.value);
      if (selected !== String(step.value) && selected !== String(step.value).trim()) {
        const opts = optionsOf(step.selector);
        const byLabel = opts.find(function(o) { return o.label.trim() === String(step.value).trim(); });
        if (!byLabel) throw new Error('failed set ' + step.key);
        setSelectByValue(step.selector, byLabel.value);
      }
      result.filled.push(step.key);
    }
    // After classification, wait for EXACT governed dependent targets before filling.
    await waitRequiredDependentControls();
    for (const field of (plan.fields || [])) {
      if (!field.fill || field.key === 'type' || field.key === 'categoryId' || field.key === 'subTypeId') continue;
      if (field.key === 'permissionPurpose') {
        var provenPerm = proven.permission;
        if (!provenPerm || provenPerm.value == null) {
          failControl('PORTAL_PERMISSION_PURPOSE_TARGET_NOT_READY', 'permissionPurpose');
        }
        setSelectByValue('#permissionPurpose', provenPerm.value);
        var afterOpts = optionsOf('#permissionPurpose');
        var afterSel = afterOpts.filter(function(o) {
          return String(o.value) === String(provenPerm.value);
        });
        var expectedNorm = String(field.expected || '').trim().toLowerCase();
        var afterLabel = afterSel[0] ? String(afterSel[0].label || '').trim() : '';
        if (
          afterSel.length !== 1 ||
          afterLabel.toLowerCase() !== expectedNorm
        ) {
          failControl('PORTAL_PERMISSION_PURPOSE_TARGET_NOT_READY', 'permissionPurpose');
        }
        result.permission = { label: afterLabel, value: String(provenPerm.value) };
        result.filled.push('permissionPurpose');
        continue;
      }
      if (field.key === 'indications') {
        const el = q('select#indications');
        if (!el) throw new Error('missing indications');
        const wanted = (field.expected || []).map(String);
        Array.from(el.options).forEach(function(o) {
          o.selected = wanted.indexOf(String(o.value)) >= 0 || wanted.indexOf(String(o.textContent || '').trim()) >= 0;
        });
        el.dispatchEvent(new Event('change', { bubbles: true }));
        if (window.jQuery) {
          try { window.jQuery(el).trigger('change'); } catch (e) {}
        }
        result.filled.push('indications');
        continue;
      }
      if (field.key === 'drugs') {
        if (field.expected === 'YES') q('#drug_yes') && (q('#drug_yes').checked = true);
        if (field.expected === 'NO') q('#drug_no') && (q('#drug_no').checked = true);
        result.filled.push('drugs');
        continue;
      }
      if (
        field.key === 'name' ||
        field.key === 'compositionTitle' ||
        field.key === 'disease' ||
        field.key === 'drugsValue' ||
        field.key === 'remarks'
      ) {
        setText(field.selector, field.expected);
        result.filled.push(field.key);
        continue;
      }
      if (field.key === 'shelfmonth') {
        var expectedShelf = String(field.expected || '').trim();
        var radio = null;
        try {
          radio = resolveUniqueExactReadyRadio('shelfmonth', expectedShelf);
        } catch (e) {
          if (e && e.code === 'PORTAL_SHELFLIFE_TARGET_AMBIGUOUS') throw e;
          if (e && e.code === 'PORTAL_SHELFLIFE_TARGET_NOT_READY') throw e;
          failControl('PORTAL_SHELFLIFE_TARGET_NOT_READY', 'shelfmonth');
        }
        if (!radio) {
          var collectedFill = collectExactValueRadios('shelfmonth', expectedShelf);
          var missFill = new Error(
            'PORTAL_SHELFLIFE_TARGET_NOT_READY ' + shelfRadioDiag('shelfmonth', expectedShelf, collectedFill)
          );
          missFill.code = 'PORTAL_SHELFLIFE_TARGET_NOT_READY';
          throw missFill;
        }
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        if (radio.checked !== true) {
          var collectedProof = collectExactValueRadios('shelfmonth', expectedShelf);
          var missProof = new Error(
            'PORTAL_SHELFLIFE_TARGET_NOT_READY post-check failed ' +
              shelfRadioDiag('shelfmonth', expectedShelf, collectedProof)
          );
          missProof.code = 'PORTAL_SHELFLIFE_TARGET_NOT_READY';
          throw missProof;
        }
        proven.shelfRadio = radio;
        result.filled.push('shelfmonth');
      }
    }
    return result;
  }
  return __sasvFillProductDetails;`;
}

async function fillProductDetailsOnPage(page, fillPlan, permissionLiveOptions) {
  if (!page || typeof page.evaluate !== "function") {
    throw new Error("fillProductDetailsOnPage requires a page.evaluate adapter");
  }
  const classificationSteps = buildDependentClassificationSteps(fillPlan);
  return page.evaluate(
    async ({ source, plan }) => {
      // eslint-disable-next-line no-new-func
      const fn = new Function(source)();
      return fn(plan);
    },
    {
      source: createInPageFillScript(),
      plan: {
        fields: fillPlan?.fields || [],
        classificationSteps,
        permissionLiveOptions: permissionLiveOptions || [],
      },
    },
  );
}

module.exports = {
  buildDependentClassificationSteps,
  createInPageFillScript,
  fillProductDetailsOnPage,
  CONTROL_READY_TIMEOUT_MS,
  CONTROL_READY_POLL_MS,
};
