/* eslint-env node */

const fs = require("fs");
const path = require("path");
const { ERROR_KINDS, workerError } = require("../errors");

function loadPortalContract(contractPath) {
  const filePath =
    contractPath || path.join(__dirname, "portal-contract.json");
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function allowedOriginSet(contract) {
  const origins = Array.isArray(contract?.allowedOrigins)
    ? contract.allowedOrigins
    : [];
  return new Set(origins.map((value) => String(value).replace(/\/+$/, "")));
}

function originFromUrl(urlValue) {
  let parsed;
  try {
    parsed = new URL(String(urlValue || ""));
  } catch {
    throw workerError(
      ERROR_KINDS.CONTRACT_INCOMPLETE,
      "URL is not allowed for the e-Aushadhi worker.",
    );
  }
  return `${parsed.protocol}//${parsed.host}`;
}

function assertAllowedUrl(urlValue, contract = loadPortalContract()) {
  const origin = originFromUrl(urlValue);
  if (!allowedOriginSet(contract).has(origin)) {
    throw workerError(
      ERROR_KINDS.CONTRACT_INCOMPLETE,
      "Navigation outside the e-Aushadhi origin is blocked.",
    );
  }
  return origin;
}

function isSectionComplete(contract, section) {
  const completeness = contract?.completeness || {};
  return completeness[section] === true && contract[section] != null;
}

function requireContract(section, contract = loadPortalContract()) {
  const key = String(section || "");
  if (!key) {
    throw workerError(
      ERROR_KINDS.CONTRACT_INCOMPLETE,
      "A portal contract section is required.",
      { section: key },
    );
  }
  if (key === "origins") {
    if (!contract?.baseUrl || allowedOriginSet(contract).size === 0) {
      throw workerError(
        ERROR_KINDS.CONTRACT_INCOMPLETE,
        "Portal origin contract is incomplete.",
        { section: key },
      );
    }
    assertAllowedUrl(contract.baseUrl, contract);
    return {
      baseUrl: contract.baseUrl,
      allowedOrigins: [...allowedOriginSet(contract)],
    };
  }
  if (!isSectionComplete(contract, key)) {
    throw workerError(
      ERROR_KINDS.CONTRACT_INCOMPLETE,
      `Portal contract section '${key}' is incomplete.`,
      { section: key },
    );
  }
  return contract[key];
}

function getContractCompleteness(contract = loadPortalContract()) {
  const completeness = contract?.completeness || {};
  return {
    origins: completeness.origins === true,
    authProbe: completeness.authProbe === true,
    productLookup: completeness.productLookup === true,
    productDetails: completeness.productDetails === true,
    pharmacologicalActions: completeness.pharmacologicalActions === true,
    composition: completeness.composition === true,
    saveUpdate: completeness.saveUpdate === true,
    reread: completeness.reread === true,
  };
}

module.exports = {
  loadPortalContract,
  assertAllowedUrl,
  requireContract,
  getContractCompleteness,
  isSectionComplete,
};
