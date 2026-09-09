/**
 * Fixture JavaScript sources for lifecycle contract analyzer smokes.
 * These are non-executable documentation-style snippets resembling portal patterns.
 */

const SHELL_CREATE_CANDIDATE = `
function SaveData() {
  var subTypeId = document.getElementById("subTypeId").value;
  if (subTypeId == -1) {
    alert("Please Select Sub Type");
    return false;
  }
  var payload = {
    actiontype: "add",
    name: $("#name").val(),
    type: $("#type").val(),
    categoryId: $("#categoryId").val(),
    subTypeId: subTypeId,
    id: ""
  };
  $.ajax({
    url: "../admin/saveproductforlegacy",
    type: "POST",
    data: JSON.stringify(payload),
    contentType: "application/json",
    success: function (response) {
      var productId = response.productId;
      $("#hiddenProductId").val(productId);
      // composition section becomes available after shell create
      $("#compositionPanel").show();
      // subsequent edit/update state
      window.currentMode = "update";
    }
  });
}
`;

const UPDATE_CANDIDATE = `
function SaveData() {
  var payload = {
    actiontype: "update",
    id: $("#hiddenProductId").val(),
    name: $("#name").val()
  };
  $.ajax({
    url: "../admin/updateproductforlegacy",
    type: "POST",
    data: payload,
    success: function () {
      alert("Updated");
    }
  });
}
`;

const TERMINAL_SUBMIT_CANDIDATE = `
function FinalSubmitProduct() {
  $.ajax({
    url: "../admin/finalsubmitproduct",
    type: "POST",
    data: { id: $("#hiddenProductId").val(), actiontype: "final_submit" },
    success: function () {
      // forward for approval / irreversible lock
      window.location = "../admin/forwardforapproval";
    }
  });
}
`;

const READ_ONLY_LOOKUP_CANDIDATE = `
function searchLegacyProducts() {
  var name = $("#productSearch").val();
  $.get("../admin/viewproducttbllegacy", { productName: name }, function (rows) {
    renderExactNameRows(rows);
  });
}
function LoadProductDataforLegacy(productId) {
  $.ajax({
    url: "../admin/LoadProductDataforLegacy",
    type: "GET",
    data: { id: productId },
    success: function (data) {
      $("#name").val(data.name);
      $("#type").val(data.type);
    }
  });
}
`;

const UNKNOWN_AMBIGUOUS_CANDIDATE = `
function doThing() {
  // bare GET with no read semantics — must remain UNKNOWN
  fetch("/admin/mysteryEndpoint?x=1");
}
`;

const COMPOSITION_LOAD_UPDATE = `
function loadCompositionRows(productId) {
  $.get("../admin/getcompositionrows", { id: productId }, function (rows) {
    renderComposition(rows);
  });
}
function saveCompositionRow() {
  $.ajax({
    url: "../admin/savecompositionrow",
    type: "POST",
    data: { ingredient: $("#ingredient").val(), productId: $("#hiddenProductId").val() },
    success: function () { loadCompositionRows($("#hiddenProductId").val()); }
  });
}
`;

const EXISTING_RECORD_REREAD = `
function openExistingLegacyProduct(productId) {
  LoadProductDataforLegacy(productId);
}
function LoadProductDataforLegacy(productId) {
  $.ajax({
    url: "../admin/LoadProductDataforLegacy",
    method: "GET",
    data: { id: productId },
    success: function (retained) {
      // server-provided retained values — not DOM-after-typing
      $("#name").val(retained.name);
      $("#categoryId").val(retained.categoryId);
      $("#subTypeId").val(retained.subTypeId);
    }
  });
}
`;

const GET_ALONE_UNKNOWN = `
function ping() {
  $.ajax({
    url: "../admin/obscureStatus",
    type: "GET",
    success: function () {}
  });
}
`;

module.exports = {
  SHELL_CREATE_CANDIDATE,
  UPDATE_CANDIDATE,
  TERMINAL_SUBMIT_CANDIDATE,
  READ_ONLY_LOOKUP_CANDIDATE,
  UNKNOWN_AMBIGUOUS_CANDIDATE,
  COMPOSITION_LOAD_UPDATE,
  EXISTING_RECORD_REREAD,
  GET_ALONE_UNKNOWN,
};
