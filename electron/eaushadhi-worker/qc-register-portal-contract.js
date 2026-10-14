/* eslint-env node */

/**
 * Product 262 Add QC Register contract, taken from the read-only capture
 * 2d2840d0-e708-4000-9096-18d8ccf7e4d3 (page /admin/addQCRegister,
 * script /db_static/eaushadhi/addQCRegister-3a4e291e06dee01cb500b8f9385a1a2f.js,
 * sha256 74654be39595d5ac66880952a0bd48fb0969810e6bc87b9d8518d6cf8cc9a1f9).
 * Native Save stays disabled: the only control wired to SaveData() is #save_btn,
 * and that control's captured text is "Submit".
 */

const QC_PORTAL_CONTRACT = Object.freeze({
  captureId: "2d2840d0-e708-4000-9096-18d8ccf7e4d3",
  origin: "https://www.e-aushadhi.gov.in",
  route: "/admin/addQCRegister",
  saveHandler: "SaveData",
  saveFunction: "SaveData",
  saveEndpointPath: "/admin/SaveQCData",
  saveEnableNote: "The Submit label runs a per-row Save (SaveQCData, status 1, reload). Rows stay editable/deletable. Enabling the click needs a recorded operator decision.",
  saveControlId: "save_btn",
  saveControlCapturedText: "Submit",
  editControlText: "Update",
  nativeSaveClickEnabled: false,
  nativeSaveBlockedReason: "SAVE_CONTROL_LABELLED_SUBMIT",
  listEndpointPath: "/admin/LoadQCData",
  listPageQuery: "pageno=0&&length=-1&&search=&&order=&&licenseid=",
  listSuccessStatus: "1",
  editEndpointPath: "/admin/GetqcData",
  editFunction: "GetQCData",
  rowIdDomPrefix: "hid",
  fileInputId: "upload_document",
  productSelectId: "productId",
  actionTypeId: "actiontype",
  hiddenIdId: "id",
  studySelectId: "typeofstudy",
  otherTextId: "otherText",
  othersOptionText: "Others",
  successStatus: "1",
  gaps: Object.freeze([
    "LIST_COLUMNS_TRUNCATED_IN_CAPTURE",
    "SAVE_PAYLOAD_KEYS_AFTER_END_DATE_TRUNCATED",
    "GETQCDATA_DATE_FORMAT_NOT_IN_CAPTURE",
  ]),
});

const QC_PORTAL_PRODUCT_LABEL = Object.freeze({
  262: "KARPOORADI THAILAM",
});

const QC_NATIVE_SAVE_CONTROL = Object.freeze({
  page: "/admin/addQCRegister",
  selector: "#save_btn",
  label: "Submit",
  endpoint: "/admin/SaveQCData",
  semantics: "PER_ROW_SAVE",
  decidedAt: "2026-10-14T18:31+05:30",
  decidedBy: "operator",
});

// May only change in a separately authorized commit.
const NATIVE_SAVE_AUTHORIZED = false;

function isPermittedSaveControl(pagePath, selector) {
  return pagePath === QC_NATIVE_SAVE_CONTROL.page && selector === QC_NATIVE_SAVE_CONTROL.selector;
}

const QC_FILL_KEYS = Object.freeze([
  "typeOfStudy",
  "startDate",
  "endDate",
  "reportDate",
  "batchNo",
  "duration",
  "labName",
  "qualityCntrl",
]);

module.exports = {
  QC_PORTAL_CONTRACT,
  QC_PORTAL_PRODUCT_LABEL,
  QC_NATIVE_SAVE_CONTROL,
  NATIVE_SAVE_AUTHORIZED,
  isPermittedSaveControl,
  QC_FILL_KEYS,
};
