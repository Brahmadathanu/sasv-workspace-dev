/* eslint-env node */

const { QC_FILL_KEYS, QC_PORTAL_CONTRACT } = require("./qc-register-portal-contract");

function createInPageQcFillScript() {
  return `async function __sasvFillQcRegister(plan) {
    var keys = ${JSON.stringify(QC_FILL_KEYS)};
    function byId(id) { return document.getElementById(id); }
    function setValue(el, value) {
      if (!el) return false;
      el.value = value == null ? "" : String(value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    var fields = plan.fillFields || {};
    var expectedLab = fields.labName == null ? "" : String(fields.labName);
    var lab = byId("lab_name");
    var labFound = false;
    if (lab && lab.options) {
      for (var i = 0; i < lab.options.length; i++) {
        if (lab.options[i].value === expectedLab) labFound = true;
      }
    }
    if (!labFound) return { ok: false, filled: false, message: "Laboratory not in the portal list" };
    var study = byId(${JSON.stringify(QC_PORTAL_CONTRACT.studySelectId)});
    setValue(study, plan.studyTypeSelectValue || "");
    var other = byId(${JSON.stringify(QC_PORTAL_CONTRACT.otherTextId)});
    var selected = study && study.options ? study.options[study.selectedIndex] : null;
    var others = selected && String(selected.text || "").trim() === ${JSON.stringify(QC_PORTAL_CONTRACT.othersOptionText)};
    if (others) setValue(other, fields.typeOfStudy || "");
    setValue(byId("sdate"), fields.startDate || "");
    setValue(byId("edate"), fields.endDate || "");
    setValue(byId("reportdate"), fields.reportDate || "");
    setValue(byId("batchno"), fields.batchNo || "");
    var qcIn = byId("qc_in");
    var qcOut = byId("qc_out");
    if (qcIn) qcIn.checked = String(fields.qualityCntrl || "") === String(qcIn.value || "In");
    if (qcOut) qcOut.checked = String(fields.qualityCntrl || "") === String(qcOut.value || "Out");
    setValue(byId("lab_name"), fields.labName || "");
    await new Promise(function(resolve) {
      requestAnimationFrame(function() { requestAnimationFrame(resolve); });
    });
    setValue(byId("duration"), fields.duration || "");
    var typeOfStudy = "";
    if (others && other) typeOfStudy = other.value == null ? "" : String(other.value);
    else if (study) typeOfStudy = study.value == null ? "" : String(study.value);
    var quality = "";
    if (qcOut && qcOut.checked) quality = qcOut.value == null ? "" : String(qcOut.value);
    else if (qcIn && qcIn.checked) quality = qcIn.value == null ? "" : String(qcIn.value);
    var filled = {
      typeOfStudy: typeOfStudy,
      startDate: byId("sdate") && byId("sdate").value != null ? String(byId("sdate").value) : "",
      endDate: byId("edate") && byId("edate").value != null ? String(byId("edate").value) : "",
      reportDate: byId("reportdate") && byId("reportdate").value != null ? String(byId("reportdate").value) : "",
      batchNo: byId("batchno") && byId("batchno").value != null ? String(byId("batchno").value) : "",
      duration: byId("duration") && byId("duration").value != null ? String(byId("duration").value) : "",
      labName: byId("lab_name") && byId("lab_name").value != null ? String(byId("lab_name").value) : "",
      qualityCntrl: quality
    };
    var extra = Object.keys(filled).filter(function(key) { return keys.indexOf(key) < 0; });
    return { ok: true, filled: true, filled_values: filled, extraKeys: extra };
  }
  return __sasvFillQcRegister;`;
}

function createInPageIdentityScript() {
  return `function __sasvQcPageIdentity() {
    var url = new URL(window.location.href);
    function read(id) {
      var el = document.getElementById(id);
      return {
        present: Boolean(el),
        value: el && el.value != null ? String(el.value).trim() : ""
      };
    }
    var save = document.getElementById("save_btn");
    var product = document.getElementById("productId");
    var productOptions = [];
    var productSelected = { value: "", text: "" };
    if (product && product.options) {
      for (var i = 0; i < product.options.length; i++) {
        productOptions.push({
          value: product.options[i].value == null ? "" : String(product.options[i].value),
          text: String(product.options[i].textContent || "").replace(/\\s+/g, " ").trim()
        });
      }
      var selectedOption = product.selectedIndex >= 0 ? product.options[product.selectedIndex] : null;
      if (selectedOption) {
        productSelected = {
          value: selectedOption.value == null ? "" : String(selectedOption.value),
          text: String(selectedOption.textContent || "").replace(/\\s+/g, " ").trim()
        };
      }
    }
    var heading = "";
    var headings = document.querySelectorAll("h1, h2, h3, h4");
    for (var h = 0; h < headings.length; h++) {
      var headingText = String(headings[h].textContent || "").replace(/\\s+/g, " ").trim();
      if (headingText.indexOf("Quality Control") >= 0) {
        heading = headingText;
        break;
      }
    }
    return {
      origin: url.origin,
      route: url.pathname,
      heading: heading,
      productId: read("productId"),
      productSelected: productSelected,
      productOptions: productOptions,
      actiontype: read("actiontype"),
      hiddenId: read("id"),
      saveData: typeof window.SaveData === "function",
      saveControl: {
        present: Boolean(save),
        id: save ? save.id : "",
        text: save ? String(save.textContent || "").replace(/\\s+/g, " ").trim() : "",
        onclick: save && typeof save.onclick === "function" ? String(save.onclick) : (save && save.getAttribute ? String(save.getAttribute("onclick") || "") : "")
      }
    };
  }
  return __sasvQcPageIdentity;`;
}

function createInPageListScript() {
  return `async function __sasvQcReadList() {
    var license = document.getElementById("licenseid");
    var licenseValue = license && license.value != null ? String(license.value) : "";
    var response = await fetch("../admin/LoadQCData?pageno=0&&length=-1&&search=&&order=&&licenseid=" + encodeURIComponent(licenseValue), {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-Requested-With": "XMLHttpRequest" }
    });
    var payload = null;
    try { payload = await response.json(); } catch (error) { payload = null; }
    var ids = Array.prototype.map.call(document.querySelectorAll('[id^="hid"]'), function(el) {
      return { id: el.id, value: el.value != null ? String(el.value) : "" };
    });
    return { httpStatus: response.status, payload: payload, domRowIds: ids };
  }
  return __sasvQcReadList;`;
}

function createInPageRereadScript() {
  return `async function __sasvQcReread(spec) {
    var response = await fetch("../admin/GetqcData", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
      body: JSON.stringify({ id: spec && spec.id != null ? String(spec.id) : "" })
    });
    var payload = null;
    try { payload = await response.json(); } catch (error) { payload = null; }
    return { httpStatus: response.status, payload: payload };
  }
  return __sasvQcReread;`;
}

function createInPagePortalFactsScript() {
  return `function __sasvQcPortalFacts() {
    function optionsOf(id) {
      var el = document.getElementById(id);
      var options = [];
      if (el && el.options) {
        for (var i = 0; i < el.options.length; i++) {
          options.push({
            value: el.options[i].value == null ? "" : String(el.options[i].value),
            label: String(el.options[i].text || "").replace(/\\s+/g, " ").trim()
          });
        }
      }
      return { present: Boolean(el), options: options };
    }
    return { laboratory: optionsOf("lab_name"), studyType: optionsOf("typeofstudy") };
  }
  return __sasvQcPortalFacts;`;
}

module.exports = {
  createInPageIdentityScript,
  createInPageListScript,
  createInPagePortalFactsScript,
  createInPageQcFillScript,
  createInPageRereadScript,
};
