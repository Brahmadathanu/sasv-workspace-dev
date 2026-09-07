/* eslint-env node */

const STATUS = Object.freeze({
  PROVEN: "proven",
  UNRESOLVED: "unresolved",
  CONTRADICTION: "contradiction",
});

const AYURVEDIC_PROPRIETARY = /ayurvedic\s+proprietary/i;
const SIDDHA_CLASSICAL = /siddha\s+classical/i;

function statusFor(complete, note, contradiction) {
  if (contradiction) {
    return { status: STATUS.CONTRADICTION, note };
  }
  if (complete) {
    return { status: STATUS.PROVEN, note };
  }
  return { status: STATUS.UNRESOLVED, note };
}

function flattenVocab(capture) {
  return Array.isArray(capture?.vocabularies) ? capture.vocabularies : [];
}

function typeVocab(capture) {
  return flattenVocab(capture).find((item) => {
    const id = String(item.select_id || "");
    const key = String(item.control_key || "");
    return id === "type" || /product_type|medicine_class/i.test(key);
  });
}

function firstOf(value) {
  if (Array.isArray(value)) return value[0] || {};
  return value || {};
}

function summarizeContractEvidence(capture) {
  const pages = Array.isArray(capture?.pages) ? capture.pages : [];
  const lookups = pages.map((page) => page.lookup).filter(Boolean);
  const hasSearch = lookups.some(
    (item) => (item.search_inputs || []).length > 0 || (item.search_buttons || []).length > 0,
  );
  const hasTable = lookups.some((item) => (item.result_tables || []).length > 0);
  const hasOpen = lookups.some((item) => (item.edit_or_update_entry || []).length > 0);

  const type = typeVocab(capture);
  const typeOptions = Array.isArray(type?.options) ? type.options : [];
  const hasAyurvedicProprietary = typeOptions.some((opt) =>
    AYURVEDIC_PROPRIETARY.test(String(opt.label || "")),
  );
  const categoryVocabs = flattenVocab(capture).filter(
    (item) => item.select_id === "categoryId" || /category/i.test(String(item.control_key || "")),
  );
  const siddhaScopedCategory = categoryVocabs.some((vocab) =>
    (vocab.options || []).some((opt) => SIDDHA_CLASSICAL.test(String(opt.label || ""))),
  );
  const categoryCount = categoryVocabs.reduce(
    (sum, vocab) => sum + (Array.isArray(vocab.options) ? vocab.options.length : 0),
    0,
  );

  const composition = Array.isArray(capture?.composition_structure)
    ? capture.composition_structure
    : [];
  const hasCompositionTable = composition.some((item) => (item.tables || []).length > 0);
  const hasCompositionFields = composition.some((item) => (item.fields || []).length > 0);

  const saveUpdate = Array.isArray(capture?.save_update_structure)
    ? capture.save_update_structure
    : [];
  const candidates = saveUpdate.map((item) => item.action_candidate || item.kind);
  const hasAmbiguousSubmit = saveUpdate.some(
    (item) => item.action_candidate === "unknown" || item.kind === "submit",
  );

  const evidenceBlocks = Array.isArray(capture?.evidence_structure)
    ? capture.evidence_structure
    : [firstOf(capture?.evidence_structure)];
  const uploadCount = evidenceBlocks.reduce(
    (sum, block) => sum + (block.upload_controls || []).length,
    0,
  );
  const rereadBlocks = Array.isArray(capture?.reread_structure)
    ? capture.reread_structure
    : [firstOf(capture?.reread_structure)];
  const rereadLocations = rereadBlocks.reduce(
    (sum, block) => sum + (block.locations || []).length,
    0,
  );

  return {
    productLookup: statusFor(
      false,
      hasSearch || hasTable || hasOpen
        ? "Lookup controls were observed but exact-name targeting and duplicate distinguishability are not proven."
        : "No product lookup/search structure was observed.",
    ),
    productDetails: statusFor(
      false,
      hasAyurvedicProprietary
        ? `Ayurvedic Proprietary Medicine appears in Product Type, but category/subtype capture is not proven for that type (observed category option rows: ${categoryCount}).`
        : "Ayurvedic Proprietary Medicine Product Type / category / subtype vocabulary is not proven.",
      hasAyurvedicProprietary && siddhaScopedCategory,
    ),
    composition: statusFor(
      false,
      hasCompositionTable || hasCompositionFields
        ? "Composition controls were observed but add/edit/reread semantics are not proven."
        : "No composition table or line controls were observed.",
    ),
    saveUpdate: statusFor(
      false,
      saveUpdate.length
        ? hasAmbiguousSubmit
          ? "Save/Update/Submit candidates were observed; irreversible Submit is not distinguished."
          : "Save/Update candidates were observed; lifecycle semantics are not proven."
        : "No Save/Update/Submit candidates were observed.",
    ),
    evidence: statusFor(
      false,
      uploadCount
        ? "File upload controls were observed; portal evidence reread is not proven."
        : "No Approved Product Copy upload control was observed.",
    ),
    reread: statusFor(
      false,
      rereadLocations
        ? "Candidate reread locations were recorded; retained-state reread is not proven."
        : "No retained-state reread contract is proven.",
    ),
    action_candidates: candidates,
  };
}

module.exports = {
  STATUS,
  summarizeContractEvidence,
};
