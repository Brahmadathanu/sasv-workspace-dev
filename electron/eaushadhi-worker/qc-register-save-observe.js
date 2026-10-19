/* eslint-env node */

function classifyQcSaveObservation(observation = {}) {
  const retry = false;
  if (observation.clicked !== true) {
    return { outcome: null, reason: "NOT_CLICKED", retry };
  }
  if (observation.responseParsed === false || observation.transportError === true || observation.reason === "SAVE_AMBIGUOUS") {
    return { outcome: "AMBIGUOUS", reason: "SAVE_AMBIGUOUS", retry };
  }
  const count = Number(observation.matchingRequestCount) || 0;
  if (count > 1 || Number(observation.invokeCount) > 1) {
    return { outcome: "AMBIGUOUS", reason: "MULTIPLE_SAVE", retry };
  }
  if (observation.settled !== true) {
    return { outcome: "AMBIGUOUS", reason: "SAVE_AMBIGUOUS", retry };
  }
  const status = observation.status == null ? "" : String(observation.status);
  if (
    status === "1"
    && count === 1
    && observation.listDelta === "one-match"
  ) {
    return { outcome: "CONFIRMED", reason: "NATIVE_SUCCESS_CONFIRMED", retry };
  }
  if (observation.businessFailure === true && observation.listDelta === "none" && count <= 1) {
    return { outcome: "REJECTED", reason: "NATIVE_FAILURE", retry };
  }
  return { outcome: "AMBIGUOUS", reason: "SAVE_AMBIGUOUS", retry };
}

function createInPageSaveWatchScript() {
  return `function __sasvQcInstallSaveWatch() {
    var hits = [];
    var scope = window;
    var OriginalXHR = scope.XMLHttpRequest;
    var originalFetch = scope.fetch;
    var originalOpen = OriginalXHR && OriginalXHR.prototype ? OriginalXHR.prototype.open : null;
    var originalSend = OriginalXHR && OriginalXHR.prototype ? OriginalXHR.prototype.send : null;
    var originalSetHeader = OriginalXHR && OriginalXHR.prototype ? OriginalXHR.prototype.setRequestHeader : null;
    function pathnameOf(url) {
      try { return new URL(String(url), "https://www.e-aushadhi.gov.in").pathname; }
      catch (error) { return ""; }
    }
    function isSave(url) { return pathnameOf(url).endsWith("/admin/SaveQCData"); }
    function headerValue(headers, name) {
      var keys = Object.keys(headers || {});
      for (var i = 0; i < keys.length; i++) {
        if (String(keys[i]).toLowerCase() === String(name).toLowerCase()) return String(headers[keys[i]]);
      }
      return "";
    }
    if (originalOpen && originalSend) {
      OriginalXHR.prototype.open = function(method, url) {
        this.__sasvMethod = method;
        this.__sasvUrl = url;
        this.__sasvHeaders = {};
        return originalOpen.apply(this, arguments);
      };
      if (originalSetHeader) {
        OriginalXHR.prototype.setRequestHeader = function(name, value) {
          this.__sasvHeaders = this.__sasvHeaders || {};
          this.__sasvHeaders[name] = value;
          return originalSetHeader.apply(this, arguments);
        };
      }
      OriginalXHR.prototype.send = function() {
        var xhr = this;
        if (isSave(xhr.__sasvUrl)) {
          var started = Date.now();
          function record(kind) {
            if (xhr.__sasvRecorded) return;
            xhr.__sasvRecorded = true;
            var parsed = null;
            var responseParsed = false;
            if (xhr.responseText) {
              try { parsed = JSON.parse(xhr.responseText); responseParsed = true; } catch (error) { parsed = null; }
            }
            hits.push({
              url: String(xhr.__sasvUrl || ""),
              method: String(xhr.__sasvMethod || ""),
              actionType: headerValue(xhr.__sasvHeaders, "X-Action-Type"),
              httpStatus: Number(xhr.status) || 0,
              status: parsed && parsed.status != null ? String(parsed.status) : "",
              message: parsed && parsed.message != null ? String(parsed.message).slice(0, 500) : "",
              responseParsed: responseParsed,
              transportError: kind !== "loadend" || !xhr.status,
              elapsedMs: Date.now() - started
            });
          }
          xhr.addEventListener("loadend", function() { record("loadend"); });
          xhr.addEventListener("error", function() { record("error"); });
          xhr.addEventListener("timeout", function() { record("timeout"); });
        }
        return originalSend.apply(this, arguments);
      };
    }
    if (typeof originalFetch === "function") {
      scope.fetch = function(input, init) {
        var url = typeof input === "string" ? input : (input && input.url) || "";
        var method = (init && init.method) || (typeof input === "object" && input && input.method) || "GET";
        var actionType = "";
        var headers = init && init.headers;
        if (headers && typeof headers.get === "function") actionType = headers.get("X-Action-Type") || "";
        else if (headers && typeof headers === "object") actionType = headers["X-Action-Type"] || headers["x-action-type"] || "";
        var started = Date.now();
        var pending = originalFetch.apply(this, arguments);
        if (!isSave(url)) return pending;
        return Promise.resolve(pending).then(function(response) {
          return response.clone().text().then(function(text) {
            var parsed = null;
            var responseParsed = false;
            try { parsed = JSON.parse(text); responseParsed = true; } catch (error) { parsed = null; }
            hits.push({
              url: String(url),
              method: String(method),
              actionType: actionType == null ? "" : String(actionType),
              httpStatus: response.status,
              status: parsed && parsed.status != null ? String(parsed.status) : "",
              message: parsed && parsed.message != null ? String(parsed.message).slice(0, 500) : "",
              responseParsed: responseParsed,
              transportError: false,
              elapsedMs: Date.now() - started
            });
            return response;
          }).catch(function() {
            hits.push({ url: String(url), method: String(method), actionType: "", httpStatus: response.status, status: "", message: "", responseParsed: false, transportError: true, elapsedMs: Date.now() - started });
            return response;
          });
        }).catch(function(error) {
          hits.push({ url: String(url), method: String(method), actionType: "", httpStatus: 0, status: "", message: "", responseParsed: false, transportError: true, elapsedMs: Date.now() - started });
          throw error;
        });
      };
    }
    function restore() {
      if (OriginalXHR && originalOpen) OriginalXHR.prototype.open = originalOpen;
      if (OriginalXHR && originalSend) OriginalXHR.prototype.send = originalSend;
      if (OriginalXHR && originalSetHeader) OriginalXHR.prototype.setRequestHeader = originalSetHeader;
      scope.fetch = originalFetch;
    }
    return {
      hits: hits,
      restore: restore,
      finish: function() {
        restore();
        var saveHits = hits.filter(function(hit) { return pathnameOf(hit.url).endsWith("/admin/SaveQCData"); });
        var match = saveHits[0] || null;
        var ambiguous = !match || match.responseParsed !== true || match.transportError === true;
        return {
          matchingRequestCount: saveHits.length,
          settled: Boolean(match) && match.transportError !== true && match.responseParsed === true,
          httpStatus: match ? match.httpStatus : null,
          status: match ? match.status : "",
          message: match ? match.message : "",
          method: match ? match.method : "",
          actionType: match ? match.actionType : "",
          elapsedMs: match ? match.elapsedMs : null,
          responseParsed: Boolean(match) && match.responseParsed === true,
          transportError: Boolean(match) && match.transportError === true,
          outcome: ambiguous ? "AMBIGUOUS" : "OBSERVED",
          reason: ambiguous ? "SAVE_AMBIGUOUS" : "OBSERVED",
          businessFailure: Boolean(match) && match.responseParsed === true && match.status !== "" && match.status !== "1",
          hits: saveHits
        };
      }
    };
  }
  return __sasvQcInstallSaveWatch;`;
}

function createInPageSaveObserveScript() {
  const watch = createInPageSaveWatchScript().replace(/\n\s*return __sasvQcInstallSaveWatch;\s*$/, "");
  return `${watch}
  function __sasvQcReadDialog() {
    var node = document.querySelector(".jconfirm-content, .jconfirm-box, .jquery-confirm");
    if (!node) return { dialogAppeared: false, dialogText: "" };
    var text = String(node.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 500);
    return { dialogAppeared: true, dialogText: text };
  }
  function __sasvQcBindAjaxComplete(watchHandle) {
    var jq = (typeof window !== "undefined" && (window.jQuery || window.$)) || null;
    if (!jq || typeof jq !== "function") return;
    jq(document).on("ajaxComplete", function(_event, xhr, settings) {
      var url = settings && settings.url ? String(settings.url) : "";
      var path = "";
      try { path = new URL(url, "https://www.e-aushadhi.gov.in").pathname; } catch (error) { path = ""; }
      if (!path.endsWith("/admin/SaveQCData")) return;
      if (xhr && xhr.__sasvRecorded) return;
      if (xhr) xhr.__sasvRecorded = true;
      var parsed = null;
      var responseParsed = false;
      var raw = xhr && xhr.responseText ? String(xhr.responseText) : "";
      try { parsed = JSON.parse(raw); responseParsed = true; } catch (error) { parsed = null; }
      var status = parsed && parsed.status != null ? String(parsed.status) : "";
      var message = parsed && parsed.message != null ? String(parsed.message).slice(0, 500) : "";
      var contentType = "";
      try {
        contentType = xhr && typeof xhr.getResponseHeader === "function" ? String(xhr.getResponseHeader("content-type") || "") : "";
      } catch (error) { contentType = ""; }
      watchHandle.hits.push({
        url: url,
        method: "POST",
        httpStatus: xhr ? Number(xhr.status) || 0 : 0,
        status: status,
        message: message,
        responseParsed: responseParsed,
        transportError: !xhr || !xhr.status,
        contentType: contentType,
        elapsedMs: 0
      });
    });
  }
  async function __sasvQcObserveSave(spec) {
    var watch = __sasvQcInstallSaveWatch();
    __sasvQcBindAjaxComplete(watch);
    var target = document.getElementById(spec && spec.controlId);
    var clicks = 0;
    if (spec && spec.allowClick === true && target) {
      clicks += 1;
      target.click();
      var started = Date.now();
      var timeout = Number(spec.timeoutMs) || 15000;
      while (Date.now() - started < timeout && watch.hits.length === 0) {
        await new Promise(function(resolve) { setTimeout(resolve, 50); });
      }
    }
    var observed = watch.finish();
    var dialog = __sasvQcReadDialog();
    observed.clicked = clicks === 1 && Boolean(target);
    observed.invokeCount = clicks;
    observed.dialogAppeared = dialog.dialogAppeared === true;
    observed.dialogText = dialog.dialogText || "";
    observed.message = observed.message == null ? "" : String(observed.message).slice(0, 500);
    return observed;
  }
  return __sasvQcObserveSave;`;
}

module.exports = {
  classifyQcSaveObservation,
  createInPageSaveObserveScript,
  createInPageSaveWatchScript,
};
