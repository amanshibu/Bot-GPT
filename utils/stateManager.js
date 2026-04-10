/**
 * utils/stateManager.js
 *
 * In-memory per-user conversation state store.
 * Each user (identified by phone number) has an isolated state object.
 *
 * State shape:
 * {
 *   stage:         'IDLE' | 'COLLECTING' | 'CONFIRMING' | 'DONE'
 *   data:          { name, company, address, phone, device, model, complaint, details }
 *   missingFields: ['name', 'device', ...]
 *   history:       [ { role: 'user'|'assistant', content: '...' }, ... ]
 *   lastActivity:  timestamp (ms)
 * }
 */

const { CONVERSATION_STATES, LEAD_FIELDS } = require('../config/constants');
const logger = require('./logger');

// Map<phoneNumber, stateObject>
const userStates = new Map();

// Auto-expire idle sessions after 30 minutes
const SESSION_TTL_MS = 30 * 60 * 1000;

/**
 * Retrieve or initialise a user session.
 * @param {string} phone — WhatsApp sender ID (e.g. "919876543210@c.us")
 * @returns {object} mutable state reference
 */
function getState(phone) {
  if (!userStates.has(phone)) {
    userStates.set(phone, createFreshState());
    logger.debug(`[StateManager] New session created for ${phone}`);
  }
  const state = userStates.get(phone);
  state.lastActivity = Date.now();
  return state;
}

/**
 * Persist an updated state for a user.
 * @param {string} phone
 * @param {object} updatedState
 */
function setState(phone, updatedState) {
  updatedState.lastActivity = Date.now();
  userStates.set(phone, updatedState);
}

/**
 * Reset a user's session back to idle (e.g. after enquiry is saved).
 * @param {string} phone
 */
function resetState(phone) {
  userStates.set(phone, createFreshState());
  logger.debug(`[StateManager] Session reset for ${phone}`);
}

/**
 * Return a blank state object.
 */
function createFreshState() {
  return {
    stage: CONVERSATION_STATES.IDLE,
    data: Object.fromEntries(LEAD_FIELDS.map((f) => [f, ''])),
    missingFields: [...LEAD_FIELDS],
    history: [],
    lastActivity: Date.now(),
  };
}

/**
 * Append a message to a user's conversation history.
 * Keeps the last 20 turns to avoid token overflow.
 * @param {string} phone
 * @param {'user'|'assistant'} role
 * @param {string} content
 */
function appendHistory(phone, role, content) {
  const state = getState(phone);
  state.history.push({ role, content });
  if (state.history.length > 20) {
    state.history = state.history.slice(-20);
  }
  setState(phone, state);
}

/**
 * Periodically clean up expired sessions (run every 10 minutes).
 */
setInterval(() => {
  const now = Date.now();
  for (const [phone, state] of userStates.entries()) {
    if (now - state.lastActivity > SESSION_TTL_MS) {
      userStates.delete(phone);
      logger.debug(`[StateManager] Session expired and removed for ${phone}`);
    }
  }
}, 10 * 60 * 1000);

module.exports = { getState, setState, resetState, appendHistory };
