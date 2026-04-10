/**
 * services/sheetsService.js
 *
 * Google Sheets integration via googleapis.
 * Appends a new lead row to the configured spreadsheet.
 */

const { google } = require('googleapis');
const path = require('path');
const logger = require('../utils/logger');
const { SHEET_COLUMNS, DEFAULT_ROW_VALUES } = require('../config/constants');

let sheetsClient = null;

// ── Authenticate & create client ─────────────────────────────
async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const keyPath = path.resolve(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH ||
      './config/google-service-account.json'
  );

  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const authClient = await auth.getClient();
  sheetsClient = google.sheets({ version: 'v4', auth: authClient });
  logger.info('[Sheets] Google Sheets client initialised');
  return sheetsClient;
}

// ── Ensure header row exists ─────────────────────────────────
async function ensureHeaders() {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const tab = process.env.GOOGLE_SHEET_TAB || 'Leads';

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A1:Z1`,
  });

  const existing = res.data.values ? res.data.values[0] : [];
  if (existing.length === 0) {
    // Write header row
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [SHEET_COLUMNS] },
    });
    logger.info('[Sheets] Header row written');
  }
}

// ── Map lead data to a row array (column order matters!) ─────
function buildRow(data, phone) {
  const now = new Date();
  const id = now.getTime().toString();
  const date = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  return SHEET_COLUMNS.map((col) => {
    switch (col) {
      case 'ID':                return id;
      case 'Date':              return date;
      case 'Name':              return data.name || '';
      case 'Company Name':      return data.company || '';
      case 'Address':           return data.address || '';
      case 'Phone Number':      return data.phone || phone || '';
      case 'Device Type':       return data.device || '';
      case 'Model Name':        return data.model || '';
      case 'Complaint':         return data.complaint || '';
      case 'Complaint Details': return data.details || '';
      case 'Status':            return DEFAULT_ROW_VALUES['Status'];
      case 'Assigned Engineer': return DEFAULT_ROW_VALUES['Assigned Engineer'];
      case 'Price':             return DEFAULT_ROW_VALUES['Price'];
      case 'Payment Status':    return DEFAULT_ROW_VALUES['Payment Status'];
      default:                  return '';
    }
  });
}

// ── Public: append a confirmed lead ─────────────────────────
/**
 * @param {object} data  — lead data object
 * @param {string} phone — WhatsApp phone number (used as fallback)
 * @returns {Promise<void>}
 */
async function appendLead(data, phone) {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const tab = process.env.GOOGLE_SHEET_TAB || 'Leads';

  await ensureHeaders();

  const row = buildRow(data, phone);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tab}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });

  logger.info(`[Sheets] Lead appended for ${phone} — ${data.name} / ${data.device}`);
}

module.exports = { appendLead };
