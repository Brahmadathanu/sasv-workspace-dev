/**
 * Fixture JavaScript sources for lifecycle contract analyzer smokes.
 * Live-shaped (addproductforlegacy) documentation snippets — non-executable.
 */

const SHELL_CREATE_CANDIDATE = `
function SaveData() {
  var subTypeId = document.getElementById("subTypeId").value;
  if (subTypeId == -1) {
    alert("Please Select Sub Type");
    return false;
  }
  var formData = new FormData();
  formData.append("actiontype", document.getElementById("actiontype").value || "add");
  formData.append("name", $("#name").val());
  formData.append("type", $("#type").val());
  formData.append("categoryId", $("#categoryId").val());
  formData.append("subTypeId", subTypeId);
  formData.append("id", $("#id").val() || "");
  $.ajax({
    url: "../admin/SaveProductData",
    type: "POST",
    data: formData,
    processData: false,
    contentType: false,
    success: function (response) {
      var productId = response.productId;
      $("#id").val(productId);
      $("#compositionPanel").show();
      window.currentMode = "update";
    }
  });
}
`;

const UPDATE_CANDIDATE = `
function SaveData() {
  var formData = new FormData();
  formData.append("actiontype", "update");
  formData.append("id", $("#id").val());
  formData.append("name", $("#name").val());
  $.ajax({
    url: "../admin/SaveProductData",
    type: "POST",
    data: formData,
    processData: false,
    contentType: false,
    success: function () {
      alert("Updated");
    }
  });
}
`;

const MUTATING_UPDATE_PRODUCT = `
function UpdateProduct() {
  $.ajax({
    url: "../admin/UpdateProduct",
    type: "POST",
    data: { id: $("#id").val(), name: $("#name").val(), actiontype: "update" },
    success: function () {
      alert("product updated on server");
    }
  });
}
`;

const TERMINAL_SUBMIT_CANDIDATE = `
document.querySelectorAll('.Submit').forEach(function (el) {
  el.onclick = function () {
    var id = el.getAttribute('data-id');
    if (!confirm('I hereby declare / undertaking that details are correct. Submit product?')) return;
    submitProduct(id);
  };
});
function submitProduct(id) {
  $.ajax({
    url: "../admin/submitProduct",
    type: "POST",
    data: { "id": id },
    success: function () {
      alert("Submitted");
    }
  });
}
`;

const GENERIC_LIBRARY_SUBMIT = `
function wireFormHelpers() {
  // generic library mention of submit must NOT become terminal
  var cfg = { onsubmit: true, submitHandler: function () {} };
  return cfg;
}
`;

const READ_ONLY_LOOKUP_CANDIDATE = `
function searchProductNames(q) {
  $.get("../admin/getProductNames", { query: q }, function (rows) {
    renderExactNameSuggestions(rows);
  });
}
`;

const LOAD_PRODUCT_DATATABLE = `
function LoadProductDataforLegacy() {
  $.ajax({
    url: "../admin/LoadProductDataforLegacy",
    type: "POST",
    data: { pageno: 1, search: "", order: "asc", licenseid: window.licenseId },
    success: function (res) {
      var jsondata = res;
      var TotalCount = res.TotalCount;
      var statusData = res.aaData || res.statusData || [];
      $('#productTable').dataTable({
        aaData: statusData,
        columns: [
          { data: 'srno' },
          { data: 'name' },
          { data: 'type' },
          { data: 'category' },
          { data: 'subtype' },
          { data: 'edit' },
          { data: 'composition' },
          { data: 'referback' },
          { data: 'delete' },
          { data: 'print' },
          { data: 'action' }
        ]
      });
      statusData.forEach(function (row) {
        statusData.composition = '<a class="composition-link" href="#" onclick="openComposition(' + row.id + ')">Composition</a>';
        row.composition = statusData.composition;
      });
    }
  });
}
`;

const LOAD_PRODUCT_POST_WITHOUT_READ_PROOF = `
function LoadSomethingLegacy() {
  $.ajax({
    url: "../admin/LoadSomethingLegacy",
    type: "POST",
    data: { x: 1 },
    success: function () {}
  });
}
`;

const GETPRODUCT_DATA_UPDATE_REREAD = `
function GetproductDataUpdate(id) {
  var jsondata = { "id": id };
  $.ajax({
    url: "../admin/GetproductDataUpdate",
    type: "POST",
    data: JSON.stringify(jsondata),
    success: function (data) {
      $("#name").val(data.name);
      $("#type").val(data.type);
      $("#categoryId").val(data.category);
      $("#subTypeId").val(data.subtype);
      $("#permissionPurpose").val(data.permission);
      $("#remarks").val(data.remarks);
      $("#compositionTitle").val(data.compositionTitle);
      $("#disease").val(data.actions || data.disease);
      $("#id").val(data.id);
      document.getElementById("actiontype").value = "Edit";
      $("#save_btn").text("Update");
      $("#pageHeading").text("Update Product");
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

const COMPOSITION_STATUSDATA_LINKAGE = `
function mapProductRows(statusData) {
  for (var i = 0; i < statusData.length; i++) {
    statusData.composition = '<a class="composition-action" href="#" onclick="openComposition(' + statusData[i].id + ')">Composition</a>';
  }
}
`;

const EXISTING_RECORD_REREAD = GETPRODUCT_DATA_UPDATE_REREAD;

const GET_ALONE_UNKNOWN = `
function ping() {
  $.ajax({
    url: "../admin/obscureStatus",
    type: "GET",
    success: function () {}
  });
}
`;

/**
 * Whole-page live-shaped static script (addproductforlegacy).
 * Analyzed as static_script:/db_static/... — not per-function snippets.
 * Uses $.ajax + .done/.fail, non-window LoadProductDataforLegacy region,
 * GetproductDataUpdate, submitProduct + ACTIVE .Submit binder, composition.
 */
const LIVE_STATIC_PAGE_SCRIPT = `
(function (window, document, $) {
  // historical commented binder must not be preferred over ACTIVE .Submit below
  // document.querySelectorAll('.Submit').forEach(function(el){ submitProduct(el.id); });

  function SaveData() {
    var formData = new FormData();
    formData.append("actiontype", document.getElementById("actiontype").value || "add");
    formData.append("name", $("#name").val());
    formData.append("id", $("#id").val() || "");
    // Live portal nests Save ajax under generic object callback "action" — must not override SaveData.
    var handlers = {
      action: function () {
        $ . ajax({
          url: "../admin/SaveProductData",
          type: "POST",
          data: formData,
          processData: false,
          contentType: false
        }).done(function (response) {
          var productId = response.productId;
          $("#id").val(productId);
          $("#compositionPanel").show();
          window.currentMode = "update";
        }).fail(function () {
          alert("save failed");
        });
      }
    };
    handlers.action();
  }

  function wireProductTable() {
    function LoadProductDataforLegacy() {
      // Live portal nests Load under generic "data" and "response" — must not override LoadProduct.
      var cfg = {
        data: function () {
          var transport = {
            response: function () {
              $.ajax({
                url: "../admin/LoadProductDataforLegacy",
                type: "POST",
                data: { pageno: 1, length: 10, search: "", order: "asc", licenseid: window.licenseId }
              }).done(function (res) {
                var TotalCount = res.TotalCount;
                var statusData = res.aaData || [];
                $('#productTable').dataTable({ aaData: statusData, columns: [{ data: 'name' }, { data: 'composition' }] });
                for (var i = 0; i < statusData.length; i++) {
                  statusData.composition = '<a class="addcomposition" href="#">Composition</a>';
                  statusData[i].composition = statusData.composition;
                }
              });
            }
          };
          transport.response();
        }
      };
      cfg.data();
    }
    LoadProductDataforLegacy();
  }

  function GetproductDataUpdate(id) {
    var jsondata = { "id": id };
    // Live Getproduct bodies are large; retained-field population precedes late Edit/Update UI.
    // Pad beyond 2400 chars so FUNCTION_SEMANTIC_MAX=8192 must retain late actiontype evidence.
    /* pad01 ${"x".repeat(220)} */
    /* pad02 ${"x".repeat(220)} */
    /* pad03 ${"x".repeat(220)} */
    /* pad04 ${"x".repeat(220)} */
    /* pad05 ${"x".repeat(220)} */
    /* pad06 ${"x".repeat(220)} */
    /* pad07 ${"x".repeat(220)} */
    /* pad08 ${"x".repeat(220)} */
    /* pad09 ${"x".repeat(220)} */
    /* pad10 ${"x".repeat(220)} */
    /* pad11 ${"x".repeat(220)} */
    /* pad12 ${"x".repeat(220)} */
    $.ajax({
      url: "../admin/GetproductDataUpdate",
      type: "POST",
      data: JSON.stringify(jsondata)
    }).done(function (data) {
      $("#name").val(data.name);
      $("#type").val(data.type);
      $("#categoryId").val(data.category);
      $("#subTypeId").val(data.subtype);
      $("#permissionPurpose").val(data.permission);
      $("#remarks").val(data.remarks);
      $("#compositionTitle").val(data.compositionTitle);
      $("#disease").val(data.actions || data.disease);
      $("#indications").val(data.indications);
      $("#contra").val(data.contra);
      $("#dose").val(data.dose);
      $("#pack").val(data.pack);
      $("#mfg").val(data.mfg);
      $("#id").val(data.id);
      $("#f01").val(data.f01); $("#f02").val(data.f02); $("#f03").val(data.f03); $("#f04").val(data.f04);
      $("#f05").val(data.f05); $("#f06").val(data.f06); $("#f07").val(data.f07); $("#f08").val(data.f08);
      $("#f09").val(data.f09); $("#f10").val(data.f10); $("#f11").val(data.f11); $("#f12").val(data.f12);
      $("#f13").val(data.f13); $("#f14").val(data.f14); $("#f15").val(data.f15); $("#f16").val(data.f16);
      $("#f17").val(data.f17); $("#f18").val(data.f18); $("#f19").val(data.f19); $("#f20").val(data.f20);
      $("#f21").val(data.f21); $("#f22").val(data.f22); $("#f23").val(data.f23); $("#f24").val(data.f24);
      $("#f25").val(data.f25); $("#f26").val(data.f26); $("#f27").val(data.f27); $("#f28").val(data.f28);
      $("#f29").val(data.f29); $("#f30").val(data.f30); $("#f31").val(data.f31); $("#f32").val(data.f32);
      $("#f33").val(data.f33); $("#f34").val(data.f34); $("#f35").val(data.f35); $("#f36").val(data.f36);
      $("#f37").val(data.f37); $("#f38").val(data.f38); $("#f39").val(data.f39); $("#f40").val(data.f40);
      $("#f41").val(data.f41); $("#f42").val(data.f42); $("#f43").val(data.f43); $("#f44").val(data.f44);
      $("#f45").val(data.f45); $("#f46").val(data.f46); $("#f47").val(data.f47); $("#f48").val(data.f48);
      $("#f49").val(data.f49); $("#f50").val(data.f50); $("#f51").val(data.f51); $("#f52").val(data.f52);
      $("#f53").val(data.f53); $("#f54").val(data.f54); $("#f55").val(data.f55); $("#f56").val(data.f56);
      $("#f57").val(data.f57); $("#f58").val(data.f58); $("#f59").val(data.f59); $("#f60").val(data.f60);
      document.getElementById("actiontype").value = "Edit";
      $("#save_btn").text("Update");
      $("#pageHeading").text("Update Product");
    });
  }

  function submitProduct(id) {
    var jsondata = { "id": id };
    $.ajax({
      url: "../admin/submitProduct",
      type: "POST",
      data: JSON
        .stringify(jsondata)
    }).done(function () {
      alert("Submitted");
    });
  }

  document.querySelectorAll('.Submit').forEach(function (el) {
    el.onclick = function () {
      var hid = el.getAttribute('data-id');
      if (!confirm('I hereby declare / undertaking that details are correct. Submit product?')) return;
      submitProduct(hid);
    };
  });

  document.querySelectorAll('.addcomposition').forEach(function (el) {
    el.onclick = function () {
      var hid = el.getAttribute('data-id');
      openComposition(hid);
    };
  });

  window.SaveData = SaveData;
  window.GetproductDataUpdate = GetproductDataUpdate;
  window.submitProduct = submitProduct;
  wireProductTable();
})(window, document, jQuery);
`;

const CONTRADICTION_GETPRODUCT_MUTATING = `
function GetproductDataUpdate(id) {
  $.ajax({
    url: "../admin/GetproductDataUpdate",
    type: "POST",
    data: { id: id, actiontype: "update", name: $("#name").val() },
    success: function () {
      alert("server write via update endpoint semantics");
    }
  });
}
`;

module.exports = {
  SHELL_CREATE_CANDIDATE,
  UPDATE_CANDIDATE,
  MUTATING_UPDATE_PRODUCT,
  TERMINAL_SUBMIT_CANDIDATE,
  GENERIC_LIBRARY_SUBMIT,
  READ_ONLY_LOOKUP_CANDIDATE,
  LOAD_PRODUCT_DATATABLE,
  LOAD_PRODUCT_POST_WITHOUT_READ_PROOF,
  GETPRODUCT_DATA_UPDATE_REREAD,
  UNKNOWN_AMBIGUOUS_CANDIDATE,
  COMPOSITION_LOAD_UPDATE,
  COMPOSITION_STATUSDATA_LINKAGE,
  EXISTING_RECORD_REREAD,
  GET_ALONE_UNKNOWN,
  LIVE_STATIC_PAGE_SCRIPT,
  CONTRADICTION_GETPRODUCT_MUTATING,
};
