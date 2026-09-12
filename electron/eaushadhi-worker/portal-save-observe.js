/* eslint-env node */

/**
 * One-shot SaveData invocation + outcome observation.
 * Never POSTs SaveProductData from Node. No automatic retry.
 */

const SAVE_OUTCOME = Object.freeze({
  SUCCESS: "SUCCESS",
  FAILURE: "FAILURE",
  AMBIGUOUS: "AMBIGUOUS",
});

function createSaveMutex() {
  let locked = false;
  return {
    isLocked() {
      return locked;
    },
    async runExclusive(fn) {
      if (locked) {
        return {
          ok: false,
          code: "SAVE_MUTEX_BUSY",
          message: "A Product Details execution is already running.",
        };
      }
      locked = true;
      try {
        return await fn();
      } finally {
        locked = false;
      }
    },
  };
}

/**
 * Normalize observed SaveProductData evidence into a joint success decision.
 */
function classifySaveOutcome(observation = {}) {
  const httpOk = observation.httpOk === true;
  const businessOk = observation.businessSuccess === true;
  const portalId =
    observation.portalProductId != null && String(observation.portalProductId).trim() !== ""
      ? String(observation.portalProductId).trim()
      : null;
  const hiddenId =
    observation.hiddenId != null && String(observation.hiddenId).trim() !== ""
      ? String(observation.hiddenId).trim()
      : null;
  const id = portalId || hiddenId;

  if (observation.invoked !== true) {
    return {
      outcome: SAVE_OUTCOME.FAILURE,
      portalProductId: null,
      reason: "savedata_not_invoked",
    };
  }
  if (observation.invokeCount > 1) {
    return {
      outcome: SAVE_OUTCOME.AMBIGUOUS,
      portalProductId: id,
      reason: "multiple_savedata_invocations",
    };
  }
  if (businessOk && id) {
    return {
      outcome: SAVE_OUTCOME.SUCCESS,
      portalProductId: id,
      reason: "joint_success_with_portal_id",
    };
  }
  if (httpOk && !businessOk && !id) {
    return {
      outcome: SAVE_OUTCOME.AMBIGUOUS,
      portalProductId: null,
      reason: "http_ok_without_business_or_id",
    };
  }
  if (!businessOk && observation.businessFailure === true) {
    return {
      outcome: SAVE_OUTCOME.FAILURE,
      portalProductId: id,
      reason: "business_failure",
    };
  }
  return {
    outcome: SAVE_OUTCOME.AMBIGUOUS,
    portalProductId: id,
    reason: "insufficient_joint_evidence",
  };
}

/**
 * Build an in-page one-shot SaveData runner. Live portal must not be used in smokes.
 */
function createInPageSaveOnceScript() {
  return `async function __sasvSaveDataOnce() {
    if (window.__SASV_PD_SAVE_LOCK) {
      return { invoked: false, invokeCount: 0, blocked: true };
    }
    window.__SASV_PD_SAVE_LOCK = true;
    var invokeCount = 0;
    var captured = { response: null, status: null, url: null };
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url) {
      this.__sasvUrl = url;
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function() {
      var xhr = this;
      if (/SaveProductData/i.test(String(xhr.__sasvUrl || ''))) {
        xhr.addEventListener('load', function() {
          captured.url = xhr.__sasvUrl;
          captured.status = xhr.status;
          try { captured.response = xhr.responseText; } catch (e) {}
        });
      }
      return origSend.apply(this, arguments);
    };
    try {
      if (typeof window.SaveData !== 'function') {
        return { invoked: false, invokeCount: 0, error: 'SaveData_missing' };
      }
      invokeCount += 1;
      window.SaveData();
      await new Promise(function(r) { setTimeout(r, 50); });
      var hidden = document.getElementById('id');
      return {
        invoked: true,
        invokeCount: invokeCount,
        httpOk: captured.status >= 200 && captured.status < 300,
        businessSuccess: null,
        portalProductId: null,
        hiddenId: hidden && hidden.value ? String(hidden.value) : null,
        responsePreview: captured.response ? String(captured.response).slice(0, 500) : null,
        url: captured.url
      };
    } finally {
      XMLHttpRequest.prototype.open = origOpen;
      XMLHttpRequest.prototype.send = origSend;
    }
  }
  return __sasvSaveDataOnce;`;
}

module.exports = {
  SAVE_OUTCOME,
  createSaveMutex,
  classifySaveOutcome,
  createInPageSaveOnceScript,
};
