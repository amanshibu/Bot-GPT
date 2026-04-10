/**
 * config/constants.js
 *
 * Central place for all business-level constants.
 * Change these to adapt to a different business.
 */

const LEAD_FIELDS = [
  'name',
  'company',
  'address',
  'phone',
  'device',
  'model',
  'complaint',
  'details',
];

const FIELD_LABELS = {
  name: 'Name',
  company: 'Company Name',
  address: 'Address',
  phone: 'Phone Number',
  device: 'Device Type',
  model: 'Model Name',
  complaint: 'Issue / Complaint',
  details: 'More Details',
};

/** Columns order must match the Google Sheet header row exactly */
const SHEET_COLUMNS = [
  'ID',
  'Date',
  'Name',
  'Company Name',
  'Address',
  'Phone Number',
  'Device Type',
  'Model Name',
  'Complaint',
  'Complaint Details',
  'Status',
  'Assigned Engineer',
  'Price',
  'Payment Status',
];

const DEFAULT_ROW_VALUES = {
  Status: 'New',
  'Assigned Engineer': '',
  Price: '',
  'Payment Status': 'Pending',
};

const SERVICES_OFFERED = [
  'Printer repair',
  'Laptop repair',
  'Currency counting machine repair',
  'Other electronics repair',
];

const CONVERSATION_STATES = {
  IDLE: 'IDLE',
  COLLECTING: 'COLLECTING',
  CONFIRMING: 'CONFIRMING',
  DONE: 'DONE',
};

module.exports = {
  LEAD_FIELDS,
  FIELD_LABELS,
  SHEET_COLUMNS,
  DEFAULT_ROW_VALUES,
  SERVICES_OFFERED,
  CONVERSATION_STATES,
};
