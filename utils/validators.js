/**
 * utils/validators.js
 *
 * Input validation helpers.
 */

const { LEAD_FIELDS } = require('../config/constants');

/**
 * Check if the AI response JSON has the expected shape.
 * @param {any} obj
 * @returns {boolean}
 */
function isValidAIResponse(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (typeof obj.isEnquiry !== 'boolean') return false;
  if (typeof obj.reply !== 'string' || obj.reply.trim() === '') return false;
  if (!Array.isArray(obj.missingFields)) return false;
  if (typeof obj.data !== 'object' || obj.data === null) return false;
  return true;
}

/**
 * Remove undefined / null / empty-string values from an object.
 * @param {object} obj
 * @returns {object}
 */
function sanitizeData(obj) {
  const cleaned = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') {
      cleaned[k] = String(v).trim();
    }
  }
  return cleaned;
}

/**
 * Check whether all mandatory fields are present and non-empty.
 * Mandatory fields: name, company, address, device, complaint
 * (Phone is excluded because we capture it automatically from WhatsApp)
 * @param {object} data
 * @returns {boolean}
 */
function hasMandatoryFields(data) {
  const mandatory = ['name', 'company', 'address', 'device', 'complaint'];
  return mandatory.every((f) => data[f] && data[f].trim() !== '');
}

/**
 * Compute which fields are still missing from the data object.
 * @param {object} data
 * @returns {string[]} list of field keys that are empty
 */
function getMissingFields(data) {
  return LEAD_FIELDS.filter((f) => !data[f] || data[f].trim() === '');
}

module.exports = {
  isValidAIResponse,
  sanitizeData,
  hasMandatoryFields,
  getMissingFields,
};
