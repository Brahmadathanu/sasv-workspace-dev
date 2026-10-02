/* eslint-env node */

// The canonical default is owned by composition-contract. This module only
// applies the trusted build gate; an environment variable can never arm it.
const {
  COMPOSITION_FIRST_LIVE_930_RELEASE,
  COMPOSITION_FIRST_LIVE_PRODUCT_ID,
  COMPOSITION_FIRST_LIVE_SOURCE_LINE_ID,
  COMPOSITION_LIVE_ARM_DEFAULT,
  compositionFirstLiveTargetEnabled,
} = require("./composition-contract");

function isCompositionLiveArmedFor(productId, sourceCompositionLineId, environment = process.env) {
  return compositionFirstLiveTargetEnabled(productId, sourceCompositionLineId, environment) === true;
}

module.exports = {
  COMPOSITION_FIRST_LIVE_930_RELEASE,
  COMPOSITION_FIRST_LIVE_PRODUCT_ID,
  COMPOSITION_FIRST_LIVE_SOURCE_LINE_ID,
  COMPOSITION_LIVE_ARM_DEFAULT,
  isCompositionLiveArmedFor,
};
