/**
 * controllers/messageController.js
 *
 * Core orchestration layer.
 *
 * Flow per incoming message:
 *  1. Load user state
 *  2. If user is in CONFIRMING stage → handle YES / EDIT
 *  3. Otherwise → call AI with message + history
 *  4. Merge newly extracted fields into state
 *  5. If AI says isEnquiry=true and all mandatory fields collected → CONFIRMING
 *  6. Send reply back to user
 */

const logger = require('../utils/logger');
const { processMessage } = require('../services/aiService');
const { appendLead } = require('../services/sheetsService');
// NOTE: whatsappService is required lazily inside handleConfirmation to avoid
// the messageController <-> whatsappService circular dependency.
const {
  getState,
  setState,
  resetState,
  appendHistory,
} = require('../utils/stateManager');
const {
  sanitizeData,
  hasMandatoryFields,
  getMissingFields,
} = require('../utils/validators');
const { CONVERSATION_STATES, FIELD_LABELS } = require('../config/constants');

// ── Confirmation message builder ─────────────────────────────
function buildConfirmationMessage(data) {
  return (
    `✅ *Please confirm your details before I save your enquiry:*\n\n` +
    `👤 *Name:* ${data.name || '—'}\n` +
    `🏢 *Company:* ${data.company || '—'}\n` +
    `📍 *Address:* ${data.address || '—'}\n` +
    `📞 *Phone:* ${data.phone || '—'}\n` +
    `💻 *Device:* ${data.device || '—'}\n` +
    `🏷️ *Model:* ${data.model || '—'}\n` +
    `🔧 *Issue:* ${data.complaint || '—'}\n` +
    `📝 *Details:* ${data.details || '—'}\n\n` +
    `Reply *YES* to confirm and save, or *EDIT* to make changes.`
  );
}

// ── Merge AI-extracted data into existing state data ─────────
function mergeData(existing, incoming) {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (value && value.trim() !== '' && (!merged[key] || merged[key] === '')) {
      merged[key] = value.trim();
    }
  }
  return merged;
}

// ── Handle confirmed YES ─────────────────────────────────────
async function handleConfirmation(state, phone, sendMessage) {
  // Lazy require breaks the circular dependency at module-load time
  const { notifyOwner } = require('../services/whatsappService');
  try {
    await appendLead(state.data, phone.replace('@c.us', ''));
    await sendMessage(
      phone,
      `🎉 *Enquiry saved successfully!*\n\nOur team will contact you shortly. Thank you for choosing ${process.env.BUSINESS_NAME || 'our service'}! 🙏`
    );
    await notifyOwner(state.data);
    resetState(phone);
    logger.info(`[Controller] Enquiry saved and owner notified for ${phone}`);
  } catch (err) {
    logger.error(`[Controller] Failed to save enquiry for ${phone}:`, err);
    await sendMessage(
      phone,
      `⚠️ Sorry, there was a technical issue saving your enquiry. Please try again in a moment.`
    );
  }
}

// ── Main message handler ─────────────────────────────────────
/**
 * @param {object}   msg         — whatsapp-web.js Message object
 * @param {Function} sendMessage — (to, text) => Promise<void>
 */
async function handleMessage(msg, sendMessage) {
  const phone = msg.from;
  const text = (msg.body || '').trim();

  if (!text) return;

  let state = getState(phone);

  // ── Stage: CONFIRMING — waiting for YES or EDIT ────────────
  if (state.stage === CONVERSATION_STATES.CONFIRMING) {
    const upper = text.toUpperCase();

    if (upper === 'YES' || upper === 'Y' || upper === 'CONFIRM') {
      await handleConfirmation(state, phone, sendMessage);
      return;
    }

    if (upper === 'EDIT' || upper === 'NO' || upper === 'CHANGE') {
      state.stage = CONVERSATION_STATES.COLLECTING;
      setState(phone, state);
      await sendMessage(
        phone,
        `No problem! What would you like to change? Please tell me and I'll update it. 😊`
      );
      return;
    }

    // Any other message while confirming — remind user
    await sendMessage(
      phone,
      `Please reply *YES* to confirm or *EDIT* to make changes.\n\n` +
        buildConfirmationMessage(state.data)
    );
    return;
  }

  // ── Stage: IDLE / COLLECTING — process through AI ─────────
  try {
    appendHistory(phone, 'user', text);

    // Re-read state after history update
    state = getState(phone);

    const aiResult = await processMessage(text, state.history.slice(0, -1), phone);

    // Merge any newly extracted data
    if (aiResult.data) {
      state.data = mergeData(state.data, sanitizeData(aiResult.data));
      // Auto-fill phone if missing
      if (!state.data.phone) {
        state.data.phone = phone.replace('@c.us', '');
      }
      state.missingFields = getMissingFields(state.data);
    }

    // Determine next stage
    if (aiResult.isEnquiry) {
      if (hasMandatoryFields(state.data)) {
        // Enough data — move to confirmation
        state.stage = CONVERSATION_STATES.CONFIRMING;
        setState(phone, state);

        const confirmMsg = buildConfirmationMessage(state.data);
        appendHistory(phone, 'assistant', confirmMsg);
        await sendMessage(phone, confirmMsg);
        return;
      }
      // Still collecting
      state.stage = CONVERSATION_STATES.COLLECTING;
    }

    setState(phone, state);

    const reply = aiResult.reply;
    appendHistory(phone, 'assistant', reply);
    await sendMessage(phone, reply);
  } catch (err) {
    logger.error(`[Controller] Error processing message from ${phone}:`, err);
    await sendMessage(
      phone,
      `⚠️ I'm having a small technical issue right now. Please try again in a moment! 🙏`
    );
  }
}

module.exports = { handleMessage };
