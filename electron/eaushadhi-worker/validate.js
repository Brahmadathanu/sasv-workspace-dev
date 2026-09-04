/* eslint-env node */

const { ERROR_KINDS, workerError } = require("./errors");

function validateProductId(value) {
  const id = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw workerError(
      ERROR_KINDS.PREFLIGHT_DENIED,
      "productId must be a positive integer.",
    );
  }
  return id;
}

function validateAccessToken(value) {
  if (typeof value !== "string") {
    throw workerError(
      ERROR_KINDS.AUTHORIZATION,
      "A session token is required.",
    );
  }
  const token = value.trim();
  if (token.length < 16 || token.length > 8192) {
    throw workerError(
      ERROR_KINDS.AUTHORIZATION,
      "A session token is required.",
    );
  }
  if (/\s/.test(token)) {
    throw workerError(
      ERROR_KINDS.AUTHORIZATION,
      "A session token is required.",
    );
  }
  return token;
}

function publicStatus(snapshot) {
  return {
    state: snapshot.state,
    label: snapshot.label,
    phase: snapshot.phase || null,
    productId: snapshot.productId || null,
    lastErrorKind: snapshot.lastErrorKind || null,
    lastErrorMessage: snapshot.lastErrorMessage || null,
  };
}

module.exports = {
  validateProductId,
  validateAccessToken,
  publicStatus,
};
