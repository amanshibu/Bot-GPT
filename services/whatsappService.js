/**
 * services/whatsappService.js
 *
 * Manages WhatsApp client lifecycle via whatsapp-web.js.
 * - Boots the Puppeteer-backed client
 * - Displays QR code in terminal for first-time login
 * - Persists session so re-login is not needed on restart
 * - Routes every incoming message to the message controller
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const logger = require('../utils/logger');
const { handleMessage } = require('../controllers/messageController');

let whatsappClient = null;

/**
 * Returns the singleton WhatsApp client instance.
 * Throws if the client has not been created yet.
 */
function getClient() {
  if (!whatsappClient) throw new Error('WhatsApp client is not initialised');
  return whatsappClient;
}

/**
 * Send a text message to a given WhatsApp ID.
 * Safe wrapper — logs errors without crashing.
 *
 * @param {string} to      — e.g. "919876543210@c.us"
 * @param {string} message — plain text
 */
async function sendMessage(to, message) {
  try {
    const client = getClient();
    await client.sendMessage(to, message);
    logger.debug(`[WA] Sent to ${to}: ${message.slice(0, 80)}...`);
  } catch (err) {
    logger.error(`[WA] Failed to send message to ${to}:`, err);
  }
}

/**
 * Notify the shop owner when a new lead is saved.
 * @param {object} data — lead data
 */
async function notifyOwner(data) {
  const ownerPhone = process.env.OWNER_PHONE;
  if (!ownerPhone) {
    logger.warn('[WA] OWNER_PHONE not set — skipping owner notification');
    return;
  }

  const ownerId = ownerPhone.includes('@c.us')
    ? ownerPhone
    : `${ownerPhone}@c.us`;

  const message =
    `🔔 *New Repair Enquiry Received!*\n\n` +
    `👤 *Name:* ${data.name || 'N/A'}\n` +
    `🏢 *Company:* ${data.company || 'N/A'}\n` +
    `📱 *Device:* ${data.device || 'N/A'}\n` +
    `🔧 *Issue:* ${data.complaint || 'N/A'}\n` +
    `📞 *Phone:* ${data.phone || 'N/A'}\n` +
    `📍 *Address:* ${data.address || 'N/A'}\n\n` +
    `_Status: New — Please assign an engineer._`;

  await sendMessage(ownerId, message);
  logger.info(`[WA] Owner notified at ${ownerId}`);
}

/**
 * Create and boot the WhatsApp client.
 * Call once at application startup.
 */
async function createWhatsAppClient() {
  whatsappClient = new Client({
    authStrategy: new LocalAuth({
      dataPath: process.env.SESSION_DATA_PATH || './.wwebjs_auth',
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--disable-extensions',
      ],
    },
  });

  // ── Events ─────────────────────────────────────────────────

  whatsappClient.on('qr', (qr) => {
    logger.info('[WA] QR code received. Scan with WhatsApp to log in:');
    qrcode.generate(qr, { small: true });
    
    // Add web fallback if terminal QR is too large
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qr)}`;
    logger.info(`\n🌐 IF THE QR CODE IS TOO BIG, CLICK THIS LINK TO OPEN IN BROWSER:\n${qrUrl}\n`);
  });

  whatsappClient.on('authenticated', () => {
    logger.info('[WA] ✅ Authenticated successfully');
  });

  whatsappClient.on('auth_failure', (msg) => {
    logger.error(`[WA] ❌ Authentication failure: ${msg}`);
  });

  whatsappClient.on('ready', () => {
    logger.info('[WA] 🟢 WhatsApp client is ready and listening');
  });

  whatsappClient.on('disconnected', (reason) => {
    logger.warn(`[WA] 🔴 Disconnected: ${reason}. Attempting reconnect...`);
    // Attempt re-initialise after 5 seconds
    setTimeout(() => whatsappClient.initialize(), 5000);
  });

  whatsappClient.on('message', async (msg) => {
    // Ignore group messages, status updates, and non-text
    if (msg.isGroupMsg || msg.from === 'status@broadcast') return;
    if (msg.type !== 'chat') return;

    // 🧪 TEST MODE: only respond to messages prefixed with "!b"
    // Remove this block when going live with a dedicated business number
    const TEST_PREFIX = '!b';
    if (!msg.body.toLowerCase().startsWith(TEST_PREFIX)) return;

    // Strip the prefix before processing
    msg.body = msg.body.slice(TEST_PREFIX.length).trim();
    if (!msg.body) return; // ignore bare "!b" with no actual message

    logger.info(`[WA] Incoming from ${msg.from}: ${msg.body.slice(0, 80)}`);
    await handleMessage(msg, sendMessage);
  });

  // ── Initialise ─────────────────────────────────────────────
  await whatsappClient.initialize();
  return whatsappClient;
}

module.exports = { createWhatsAppClient, sendMessage, notifyOwner, getClient };
