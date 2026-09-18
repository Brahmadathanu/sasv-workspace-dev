/* eslint-env node */

/**
 * Trusted Product Details live-execution arm (Phase A: disarmed).
 * Renderer cannot supply or override this module.
 *
 * Phase B may flip enabled→true under separate approval.
 */

const { FIRST_CONTROLLED_PRODUCT_ID } = require("./product-lock");

const PRODUCT_DETAILS_LIVE_ARM = Object.freeze({
  enabled: false,
  productIds: Object.freeze([FIRST_CONTROLLED_PRODUCT_ID]),
});

function isProductDetailsLiveArmedFor(productId) {
  const id = Number(productId);
  return (
    PRODUCT_DETAILS_LIVE_ARM.enabled === true &&
    PRODUCT_DETAILS_LIVE_ARM.productIds.includes(id) &&
    id === FIRST_CONTROLLED_PRODUCT_ID
  );
}

module.exports = {
  PRODUCT_DETAILS_LIVE_ARM,
  isProductDetailsLiveArmedFor,
};
