/* eslint-env node */

// The canonical default is owned by composition-contract. This module only
// applies the trusted build gate; an environment variable can never arm it.
const {
  COMPOSITION_CONTROLLED_PHASE2_931_RELEASE,
  COMPOSITION_CONTROLLED_PRODUCT_ID,
  COMPOSITION_CONTROLLED_SOURCE_LINE_ID,
  COMPOSITION_FIRST_LIVE_930_RELEASE,
  COMPOSITION_FIRST_LIVE_PRODUCT_ID,
  COMPOSITION_FIRST_LIVE_SOURCE_LINE_ID,
  COMPOSITION_LIVE_ARM_DEFAULT,
  compositionControlledPhase2TargetEnabled,
} = require("./composition-contract");

function isCompositionLiveArmedFor(productId, sourceCompositionLineId, environment = process.env) {
  return compositionControlledPhase2TargetEnabled(productId, sourceCompositionLineId, environment) === true;
}

module.exports = {
  COMPOSITION_CONTROLLED_PHASE2_931_RELEASE,
  COMPOSITION_CONTROLLED_PRODUCT_ID,
  COMPOSITION_CONTROLLED_SOURCE_LINE_ID,
  COMPOSITION_FIRST_LIVE_930_RELEASE,
  COMPOSITION_FIRST_LIVE_PRODUCT_ID,
  COMPOSITION_FIRST_LIVE_SOURCE_LINE_ID,
  COMPOSITION_LIVE_ARM_DEFAULT,
  isCompositionLiveArmedFor,
};
