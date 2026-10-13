/* eslint-env node */

function classifyQcSaveObservation(observation = {}) {
  if (observation.clicked !== true) {
    return { outcome: null, reason: "NOT_CLICKED" };
  }
  const count = Number(observation.matchingRequestCount) || 0;
  if (count > 1 || Number(observation.invokeCount) > 1) {
    return { outcome: "AMBIGUOUS", reason: "MULTIPLE_SAVE" };
  }
  if (observation.settled !== true) {
    return { outcome: "AMBIGUOUS", reason: "SAVE_EFFECT_UNCERTAIN" };
  }
  const status = observation.status == null ? "" : String(observation.status);
  if (
    status === "1"
    && count === 1
    && observation.listDelta === "one-match"
  ) {
    return { outcome: "CONFIRMED", reason: "NATIVE_SUCCESS_CONFIRMED" };
  }
  if (observation.businessFailure === true && observation.listDelta === "none" && count <= 1) {
    return { outcome: "REJECTED", reason: "NATIVE_FAILURE" };
  }
  return { outcome: "AMBIGUOUS", reason: "SAVE_EFFECT_UNCERTAIN" };
}

function createInPageSaveObserveScript() {
  return `async function __sasvQcObserveSave(spec) {
    var started = Date.now();
    var hits = [];
    var originalFetch = window.fetch;
    window.fetch = function(input, init) {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var isSave = /SaveQCData/i.test(String(url));
      var pending = originalFetch.apply(this, arguments);
      if (!isSave) return pending;
      return pending.then(function(response) {
        var copy = response.clone();
        return copy.text().then(function(text) {
          hits.push({ url: String(url), status: response.status, body: text });
          return response;
        }).catch(function() {
          hits.push({ url: String(url), status: response.status, body: "" });
          return response;
        });
      });
    };
    var target = document.getElementById(spec.controlId);
    var text = target ? String(target.textContent || "").replace(/\\s+/g, " ").trim() : "";
    if (!target || text !== "Save" || /submit/i.test(text)) {
      window.fetch = originalFetch;
      return { clicked: false, reason: "SUBMIT_TARGET", text: text, matchingRequestCount: 0 };
    }
    target.click();
    var timeout = Number(spec.timeoutMs) || 8000;
    while (Date.now() - started < timeout && hits.length === 0) {
      await new Promise(function(resolve) { setTimeout(resolve, 50); });
    }
    window.fetch = originalFetch;
    var match = hits[0] || null;
    var parsed = null;
    if (match && match.body) {
      try { parsed = JSON.parse(match.body); } catch (error) { parsed = null; }
    }
    var status = parsed && parsed.status != null ? String(parsed.status) : "";
    return {
      clicked: true,
      invokeCount: 1,
      matchingRequestCount: hits.length,
      settled: hits.length > 0,
      httpStatus: match ? match.status : null,
      status: status,
      businessFailure: hits.length > 0 && status !== "" && status !== "1",
      text: text
    };
  }
  return __sasvQcObserveSave;`;
}

module.exports = {
  classifyQcSaveObservation,
  createInPageSaveObserveScript,
};
