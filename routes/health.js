/**
 * routes/health.js
 *
 * Simple health-check endpoint.
 * Used by Railway/Render uptime monitoring and load balancers.
 *
 * GET /health → 200 OK  { status, uptime, timestamp }
 */

const { Router } = require('express');
const router = Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'WhatsApp Repair Bot',
    version: process.env.npm_package_version || '1.0.0',
  });
});

module.exports = router;
