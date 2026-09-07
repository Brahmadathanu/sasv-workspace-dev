/* eslint-env node */

function normalizeLookupName(value) {
  if (value == null) return "";
  return String(value).normalize("NFC").trim();
}

function namesEqualExact(left, right) {
  const a = normalizeLookupName(left);
  const b = normalizeLookupName(right);
  if (!a || !b) return false;
  return a.toLocaleLowerCase("en-US") === b.toLocaleLowerCase("en-US");
}

function classifyLookupMatches(candidates, expectedName) {
  const list = Array.isArray(candidates) ? candidates : [];
  const matches = list.filter((item) =>
    namesEqualExact(item?.name ?? item?.product_name ?? item, expectedName),
  );
  if (matches.length === 0) {
    return { outcome: "NONE", matches };
  }
  if (matches.length === 1) {
    return { outcome: "EXACT_ONE", matches };
  }
  return { outcome: "AMBIGUOUS", matches };
}

module.exports = {
  normalizeLookupName,
  namesEqualExact,
  classifyLookupMatches,
};
