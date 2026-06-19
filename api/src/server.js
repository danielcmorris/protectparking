'use strict';

const express = require('express');
const cors = require('cors');

const config = require('./config');
const db = require('./db');
const comments = require('./routes/comments');

const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: config.corsOrigins.includes('*') ? true : config.corsOrigins }));
app.use(express.json({ limit: config.maxBodyBytes }));

// Liveness/readiness probe for Cloud Run.
app.get('/health', async (_req, res) => {
  let database = 'disabled';
  if (db.ENABLE_DB) {
    database = (await db.ping().catch(() => false)) ? 'up' : 'down';
  }
  res.json({ ok: true, status: 'ok', database, stub: !db.ENABLE_DB });
});

app.use('/api', comments);

// 404
app.use((_req, res) => res.status(404).json({ ok: false, error: 'not found' }));

// Error handler (e.g. body too large / malformed JSON)
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ ok: false, error: err.message || 'server error' });
});

const server = app.listen(config.port, () => {
  console.log(`vallejo-street-api listening on :${config.port} (db ${db.ENABLE_DB ? 'enabled' : 'STUB'})`);
});

// Graceful shutdown for Cloud Run SIGTERM.
function shutdown() {
  console.log('shutting down...');
  server.close(() => {
    db.close().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = app;
