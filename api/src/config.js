'use strict';

/**
 * Central configuration, read from environment.
 *
 * On Cloud Run, DATABASE_URL is injected from Secret Manager (see deploy/).
 * Locally, it is loaded from a connection string kept in ../creds (gitignored)
 * per project credential conventions.
 */
module.exports = {
  port: parseInt(process.env.PORT || '8080', 10),

  // Postgres connection string, e.g.
  //   postgres://user:pass@host:5432/vallejo
  databaseUrl: process.env.DATABASE_URL || '',

  // Comma-separated list of allowed origins for CORS. '*' allows all.
  corsOrigins: (process.env.CORS_ORIGINS || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Shared secret guarding the admin comment list (PII). When unset, the
  // /api/comments listing is disabled (returns 503) so PII is never exposed
  // by accident.
  adminToken: process.env.ADMIN_TOKEN || '',

  // Reject oversized payloads early.
  maxBodyBytes: '16kb',

  nodeEnv: process.env.NODE_ENV || 'development',
};
