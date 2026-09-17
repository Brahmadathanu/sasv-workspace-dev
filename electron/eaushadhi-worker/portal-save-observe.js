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
 * Parse bounded SaveProductData business payload (no secrets).
 * Accepts object or JSON string. Returns { businessSuccess, businessFailure, portalProductId }.
 */
function parseSaveProductDataBusiness(raw) {
  let payload = raw;
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) {
      return { businessSuccess: null, businessFailure: null, portalProductId: null };
    }
    try {
      payload = JSON.parse(text);
    } catch {
      return { businessSuccess: null, businessFailure: null, portalProductId: null };
    }
  }
  if (!payload || typeof payload !== "object") {
    return { businessSuccess: null, businessFailure: null, portalProductId: null };
  }

  const statusRaw =
    payload.status != null
      ? payload.status
      : payload.Status != null
        ? payload.Status
        : payload.statusCode != null
          ? payload.statusCode
          : null;
  const statusStr = statusRaw == null ? "" : String(statusRaw).trim();
  const message = String(payload.message || payload.Message || payload.msg || "").toLowerCase();

  let businessSuccess = null;
  let businessFailure = null;
  if (
    statusStr === "1" ||
    statusStr === "true" ||
    statusRaw === 1 ||
    statusRaw === true ||
    /success|saved|inserted|updated/i.test(message)
  ) {
    // status alone is not enough when status is missing; require explicit positive status
    // when present. Message-only success is treated as unproven (null).
    if (statusRaw != null) {
      businessSuccess = true;
      businessFailure = false;
    }
  }
  if (
    statusStr === "0" ||
    statusStr === "false" ||
    statusRaw === 0 ||
    statusRaw === false ||
    /fail|error|something went wrong|please select/i.test(message)
  ) {
    if (statusRaw != null || /fail|error|something went wrong/i.test(message)) {
      businessSuccess = false;
      businessFailure = true;
    }
  }

  const idCandidates = [
    payload.id,
    payload.Id,
    payload.ID,
    payload.product_id,
    payload.productId,
    payload.ProductId,
    payload.productid,
    payload.data && typeof payload.data === "object" ? payload.data.id : null,
    payload.data && typeof payload.data === "object" ? payload.data.product_id : null,
  ];
  let portalProductId = null;
  for (const candidate of idCandidates) {
    if (candidate == null) continue;
    const text = String(candidate).trim();
    if (!text || text === "0" || text === "-1") continue;
    // Never accept internal controlled product id 262 as portal id evidence by itself.
    portalProductId = text;
    break;
  }

  return { businessSuccess, businessFailure, portalProductId };
}

/**
 * Normalize observed SaveProductData evidence into a joint success decision.
 * SUCCESS requires businessOk AND proven portalProductId.
 * Hidden #id alone never upgrades to SUCCESS without business success.
 */
function classifySaveOutcome(observation = {}) {
  const httpOk = observation.httpOk === true;
  const businessOk = observation.businessSuccess === true;
  const businessFail = observation.businessFailure === true;
  const responseId =
    observation.portalProductId != null && String(observation.portalProductId).trim() !== ""
      ? String(observation.portalProductId).trim()
      : null;
  const hiddenId =
    observation.hiddenId != null && String(observation.hiddenId).trim() !== ""
      ? String(observation.hiddenId).trim()
      : null;

  // Prefer response-parsed id; allow hidden #id only as corroboration when business already ok.
  let portalProductId = null;
  if (businessOk && responseId) {
    portalProductId = responseId;
    if (hiddenId && hiddenId !== responseId) {
      return {
        outcome: SAVE_OUTCOME.AMBIGUOUS,
        portalProductId: responseId,
        reason: "response_id_hidden_id_mismatch",
      };
    }
  } else if (businessOk && !responseId && hiddenId) {
    portalProductId = hiddenId;
  }

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
      portalProductId: portalProductId || responseId || hiddenId,
      reason: "multiple_savedata_invocations",
    };
  }
  if (businessOk && portalProductId) {
    return {
      outcome: SAVE_OUTCOME.SUCCESS,
      portalProductId,
      reason: responseId
        ? "joint_success_with_response_portal_id"
        : "joint_success_with_hidden_id_corroboration",
    };
  }
  if (businessOk && !portalProductId) {
    return {
      outcome: SAVE_OUTCOME.AMBIGUOUS,
      portalProductId: null,
      reason: "business_ok_without_portal_id",
    };
  }
  if (businessFail) {
    return {
      outcome: SAVE_OUTCOME.FAILURE,
      portalProductId: responseId || hiddenId,
      reason: "business_failure",
    };
  }
  if (httpOk && !businessOk && !portalProductId) {
    return {
      outcome: SAVE_OUTCOME.AMBIGUOUS,
      portalProductId: null,
      reason: "http_ok_without_business_or_id",
    };
  }
  return {
    outcome: SAVE_OUTCOME.AMBIGUOUS,
    portalProductId: responseId || hiddenId,
    reason: "insufficient_joint_evidence",
  };
}

/**
 * Build an in-page one-shot SaveData runner. Live portal must not be used in smokes
 * unless explicitly evaluated under trusted adapters.
 */
function createInPageSaveOnceScript() {
  return `async function __sasvSaveDataOnce() {
    if (window.__SASV_PD_SAVE_LOCK) {
      return { invoked: false, invokeCount: 0, blocked: true };
    }
    window.__SASV_PD_SAVE_LOCK = true;
    var invokeCount = 0;
    var captured = {
      response: null,
      status: null,
      url: null,
      settled: false,
    };
    function looksLikeSaveProductData(url) {
      return /SaveProductData/i.test(String(url || ''));
    }
    function parseBusiness(raw) {
      if (raw == null || raw === '') {
        return { businessSuccess: null, businessFailure: null, portalProductId: null };
      }
      var payload = raw;
      if (typeof raw === 'string') {
        try { payload = JSON.parse(raw); } catch (e) {
          return { businessSuccess: null, businessFailure: null, portalProductId: null };
        }
      }
      if (!payload || typeof payload !== 'object') {
        return { businessSuccess: null, businessFailure: null, portalProductId: null };
      }
      var statusRaw = payload.status != null ? payload.status
        : (payload.Status != null ? payload.Status
          : (payload.statusCode != null ? payload.statusCode : null));
      var statusStr = statusRaw == null ? '' : String(statusRaw).trim();
      var message = String(payload.message || payload.Message || payload.msg || '').toLowerCase();
      var businessSuccess = null;
      var businessFailure = null;
      if (statusStr === '1' || statusStr === 'true' || statusRaw === 1 || statusRaw === true) {
        businessSuccess = true;
        businessFailure = false;
      }
      if (statusStr === '0' || statusStr === 'false' || statusRaw === 0 || statusRaw === false
          || /fail|error|something went wrong/i.test(message)) {
        businessSuccess = false;
        businessFailure = true;
      }
      var idCandidates = [
        payload.id, payload.Id, payload.ID, payload.product_id, payload.productId,
        payload.ProductId, payload.productid,
        payload.data && typeof payload.data === 'object' ? payload.data.id : null,
        payload.data && typeof payload.data === 'object' ? payload.data.product_id : null
      ];
      var portalProductId = null;
      for (var i = 0; i < idCandidates.length; i++) {
        var c = idCandidates[i];
        if (c == null) continue;
        var t = String(c).trim();
        if (!t || t === '0' || t === '-1') continue;
        portalProductId = t;
        break;
      }
      return { businessSuccess: businessSuccess, businessFailure: businessFailure, portalProductId: portalProductId };
    }
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url) {
      this.__sasvUrl = url;
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function() {
      var xhr = this;
      if (looksLikeSaveProductData(xhr.__sasvUrl)) {
        xhr.addEventListener('loadend', function() {
          captured.url = xhr.__sasvUrl;
          captured.status = xhr.status;
          try { captured.response = xhr.responseText; } catch (e) {}
          captured.settled = true;
        });
      }
      return origSend.apply(this, arguments);
    };
    var origFetch = window.fetch;
    if (typeof origFetch === 'function') {
      window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input && input.url);
        if (!looksLikeSaveProductData(url)) {
          return origFetch.apply(this, arguments);
        }
        return origFetch.apply(this, arguments).then(function(res) {
          captured.url = url;
          captured.status = res.status;
          return res.clone().text().then(function(text) {
            captured.response = text;
            captured.settled = true;
            return res;
          }).catch(function() {
            captured.settled = true;
            return res;
          });
        });
      };
    }
    try {
      if (typeof window.SaveData !== 'function') {
        return { invoked: false, invokeCount: 0, error: 'SaveData_missing' };
      }
      invokeCount += 1;
      window.SaveData();
      var deadline = Date.now() + 15000;
      while (!captured.settled && Date.now() < deadline) {
        await new Promise(function(r) { setTimeout(r, 50); });
      }
      var parsed = parseBusiness(captured.response);
      var hidden = document.getElementById('id');
      var hiddenId = hidden && hidden.value ? String(hidden.value).trim() : null;
      if (hiddenId === '0' || hiddenId === '-1') hiddenId = null;
      return {
        invoked: true,
        invokeCount: invokeCount,
        httpOk: captured.status >= 200 && captured.status < 300,
        businessSuccess: parsed.businessSuccess,
        businessFailure: parsed.businessFailure,
        portalProductId: parsed.portalProductId,
        hiddenId: hiddenId,
        responsePreview: captured.response ? String(captured.response).slice(0, 500) : null,
        url: captured.url,
        settled: captured.settled === true
      };
    } finally {
      XMLHttpRequest.prototype.open = origOpen;
      XMLHttpRequest.prototype.send = origSend;
      if (typeof origFetch === 'function') {
        window.fetch = origFetch;
      }
    }
  }
  return __sasvSaveDataOnce;`;
}

module.exports = {
  SAVE_OUTCOME,
  createSaveMutex,
  classifySaveOutcome,
  parseSaveProductDataBusiness,
  createInPageSaveOnceScript,
};
