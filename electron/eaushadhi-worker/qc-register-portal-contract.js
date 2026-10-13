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
  saveFunction: "SaveData",
  saveEndpointPath: "/admin/SaveQCData",
  saveControlId: "save_btn",
  saveControlCapturedText: "Submit",
  editControlText: "Update",
  nativeSaveClickEnabled: false,
  nativeSaveBlockedReason: "SAVE_CONTROL_LABELLED_SUBMIT",
  listEndpointPath: "/admin/LoadQCData",
  listPageQuery: "pageno=0",
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
    "SAVE_CONTROL_LABELLED_SUBMIT",
    "LIST_COLUMNS_TRUNCATED_IN_CAPTURE",
    "SAVE_PAYLOAD_KEYS_AFTER_END_DATE_TRUNCATED",
    "LAB_OPTION_VALUE_IS_NAME_IN_GETLABORATROYNAME",
  ]),
});

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
  QC_FILL_KEYS,
};
