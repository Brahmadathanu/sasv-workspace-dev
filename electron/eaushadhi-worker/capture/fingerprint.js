/* eslint-env node */

const { createHash } = require("crypto");

function sortValue(value) {
  if (Array.isArray(value)) {
    const mapped = value.map(sortValue);
    const allObjects = mapped.every((item) => item && typeof item === "object" && !Array.isArray(item));
    if (allObjects) {
      return mapped.slice().sort((a, b) => {
        const left = JSON.stringify(a);
        const right = JSON.stringify(b);
        return left < right ? -1 : left > right ? 1 : 0;
      });
    }
    return mapped;
  }
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = sortValue(value[key]);
  }
  return out;
}

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(sortValue(value))).digest("hex");
}

function structureFingerprintInput(capture) {
  return {
    pages: (capture.pages || []).map((page) => ({
      path: page.path,
      forms: page.forms,
      inputs: (page.inputs || []).map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        tag: item.tag,
        label: item.label,
      })),
      selects: (page.selects || []).map((item) => ({
        id: item.id,
        name: item.name,
        multiple: item.multiple,
        select2_linked: item.select2_linked,
      })),
      buttons: (page.buttons || []).map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        text: item.text,
      })),
      tables: page.tables,
      composition_structure: page.composition_structure || capture.composition_structure,
      save_update_structure: page.save_update_structure || capture.save_update_structure,
    })),
  };
}

function optionSetFingerprintInput(capture) {
  return (capture.vocabularies || []).map((vocab) => ({
    control_key: vocab.control_key,
    select_id: vocab.select_id,
    select_name: vocab.select_name,
    options: (vocab.options || []).map((opt) => ({
      value: opt.value,
      label: opt.label,
    })),
  }));
}

function fingerprintsFor(capture) {
  return {
    structure_sha256: sha256(structureFingerprintInput(capture)),
    option_sets_sha256: sha256(optionSetFingerprintInput(capture)),
  };
}

module.exports = {
  sortValue,
  sha256,
  fingerprintsFor,
};
