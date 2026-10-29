/**
 * ─────────────────────────────────────────────────────────────
 *  backend/src/config/ruleConfigLoader.js
 *  FoodieBite — Startup Biomarker Rules Validator & Loader (Phase 1)
 * ─────────────────────────────────────────────────────────────
 *
 *  PURPOSE:
 *  Reads biomarkerRules.json once at server startup, validates every
 *  biomarker unit against canonicalUnits.js and every food rule tag
 *  against sharedTags.js. Throws a loud startup error if anything drifts.
 * ─────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');
const { CANONICAL_UNITS } = require('./canonicalUnits');
const { validateTag, validateConditionTag } = require('./sharedTags');

function loadAndValidateRules() {
  const jsonPath = path.join(__dirname, 'biomarkerRules.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`[RuleConfigLoader Error] Config file not found at: ${jsonPath}`);
  }

  const rawContent = fs.readFileSync(jsonPath, 'utf8');
  let config;
  try {
    config = JSON.parse(rawContent);
  } catch (err) {
    throw new Error(`[RuleConfigLoader Error] Failed to parse biomarkerRules.json: ${err.message}`);
  }

  if (!config.version) {
    throw new Error('[RuleConfigLoader Error] biomarkerRules.json is missing required top-level "version" field.');
  }

  if (!config.biomarkers || typeof config.biomarkers !== 'object') {
    throw new Error('[RuleConfigLoader Error] biomarkerRules.json is missing required "biomarkers" object.');
  }

  // Iterate and validate each biomarker definition
  for (const [key, bioDef] of Object.entries(config.biomarkers)) {
    // 1. Unit Validation against canonicalUnits.js
    const expectedUnit = CANONICAL_UNITS[key];
    if (!expectedUnit) {
      throw new Error(
        `[RuleConfigLoader Error] Biomarker "${key}" in biomarkerRules.json is not registered in canonicalUnits.js.`
      );
    }
    if (bioDef.unit !== expectedUnit) {
      throw new Error(
        `[RuleConfigLoader Error] Unit mismatch for biomarker "${key}". Config has "${bioDef.unit}", expected canonical unit "${expectedUnit}".`
      );
    }

    // 2. Range Tag Validation
    if (Array.isArray(bioDef.ranges)) {
      for (const range of bioDef.ranges) {
        if (range.tag) {
          try {
            validateConditionTag(range.tag);
          } catch (err) {
            throw new Error(
              `[RuleConfigLoader Error] Invalid range tag "${range.tag}" in biomarker "${key}": ${err.message}`
            );
          }
        }
      }
    }

    // 3. Food Rules Tag Validation against sharedTags.js
    if (bioDef.foodRules && typeof bioDef.foodRules === 'object') {
      for (const [condKey, rule] of Object.entries(bioDef.foodRules)) {
        if (rule.limit && Array.isArray(rule.limit)) {
          for (const limitTag of rule.limit) {
            try {
              validateTag(limitTag);
            } catch (err) {
              throw new Error(
                `[RuleConfigLoader Error] Invalid limit tag "${limitTag}" under condition "${condKey}" in biomarker "${key}": ${err.message}`
              );
            }
          }
        }
        if (rule.prefer && Array.isArray(rule.prefer)) {
          for (const preferTag of rule.prefer) {
            try {
              validateTag(preferTag);
            } catch (err) {
              throw new Error(
                `[RuleConfigLoader Error] Invalid prefer tag "${preferTag}" under condition "${condKey}" in biomarker "${key}": ${err.message}`
              );
            }
          }
        }
      }
    }
  }

  // Freeze config object to prevent runtime mutations
  return Object.freeze(config);
}

const loadedConfig = loadAndValidateRules();

module.exports = {
  biomarkerRules: loadedConfig,
  biomarkers: loadedConfig.biomarkers,
  version: loadedConfig.version
};
