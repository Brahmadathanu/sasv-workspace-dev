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
  $.ajax({
    url: "../admin/GetproductDataUpdate",
    type: "POST",
    data: { id: id },
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
      // Live portal nests Load ajax under generic object callback "data" — must not override LoadProduct.
      var cfg = {
        data: function () {
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
      cfg.data();
    }
    LoadProductDataforLegacy();
  }

  function GetproductDataUpdate(id) {
    $.ajax({
      url: "../admin/GetproductDataUpdate",
      type: "POST",
      data: { id: id }
    }).done(function (data) {
      $("#name").val(data.name);
      $("#type").val(data.type);
      $("#categoryId").val(data.category);
      $("#subTypeId").val(data.subtype);
      $("#compositionTitle").val(data.compositionTitle);
      $("#id").val(data.id);
      document.getElementById("actiontype").value = "Edit";
      $("#save_btn").text("Update");
      $("#pageHeading").text("Update Product");
    });
  }

  function submitProduct(id) {
    $.ajax({
      url: "../admin/submitProduct",
      type: "POST",
      data: { "id": id }
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
