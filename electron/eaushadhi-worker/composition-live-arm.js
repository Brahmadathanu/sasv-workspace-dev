/* eslint-env node */

// The canonical default is owned by composition-contract. This module only
// applies the trusted build gate; an environment variable can never arm it.
const {
  COMPOSITION_LIVE_ARM_DEFAULT,
  compositionLiveArmEnabled,
} = require("./composition-contract");

function isCompositionLiveArmedFor(productId, environment = process.env) {
  return Number(productId) === 262 && compositionLiveArmEnabled(environment) === true;
}

module.exports = {
  COMPOSITION_LIVE_ARM_DEFAULT,
  isCompositionLiveArmedFor,
};
