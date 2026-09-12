/* eslint-env node */

/**
 * Bounded portal DOM fill helpers for Product Details execution.
 * Pure planning helpers + injectable page adapters. No network.
 */

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
    for (const field of (plan.fields || [])) {
      if (!field.fill || field.key === 'type' || field.key === 'categoryId' || field.key === 'subTypeId') continue;
      if (field.key === 'permissionPurpose') {
        const opts = optionsOf('#permissionPurpose');
        const expected = String(field.expected || '').trim().toLowerCase();
        const matches = opts.filter(function(o) {
          return String(o.label || '').trim().toLowerCase() === expected;
        });
        if (matches.length !== 1) throw new Error('permissionPurpose match count ' + matches.length);
        setSelectByValue('#permissionPurpose', matches[0].value);
        result.permission = { label: matches[0].label, value: matches[0].value };
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
      if (field.key === 'name' || field.key === 'compositionTitle' || field.key === 'disease' || field.key === 'drugsValue') {
        setText(field.selector, field.expected);
        result.filled.push(field.key);
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
    async (plan) => {
      // placeholder replaced by in-page script in real evaluate string form when wired
      return plan;
    },
    {
      fields: fillPlan.fields,
      classificationSteps,
      permissionLiveOptions: permissionLiveOptions || [],
    },
  );
}

module.exports = {
  buildDependentClassificationSteps,
  createInPageFillScript,
  fillProductDetailsOnPage,
};
