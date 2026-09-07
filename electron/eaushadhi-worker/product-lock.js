/* eslint-env node */

const FIRST_CONTROLLED_PRODUCT_ID = 262;

function isFirstControlledProduct(productId) {
  return Number(productId) === FIRST_CONTROLLED_PRODUCT_ID;
}

module.exports = {
  FIRST_CONTROLLED_PRODUCT_ID,
  isFirstControlledProduct,
};
