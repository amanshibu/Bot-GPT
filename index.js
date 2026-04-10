/**
 * index.js — Application Entry Point
 *
 * Bootstraps the Express server and WhatsApp client.
 * All route/service wiring is done through modular imports.
 */

require('dotenv').config();

const express = require('express');
const { createWhatsAppClient } = require('./services/whatsappService');
const logger = require('./utils/logger');
const healthRouter = require('./routes/health');

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());
app.use('/health', healthRouter);

// ── Start Express server ─────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info(`🚀 Express server running on port ${PORT}`);
});

// ── Boot WhatsApp client ─────────────────────────────────────
(async () => {
  try {
    await createWhatsAppClient();
  } catch (err) {
    logger.error('❌ Fatal error starting WhatsApp client:', err);
    process.exit(1);
  }
})();

// ── Graceful shutdown ────────────────────────────────────────
const shutdown = (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});
