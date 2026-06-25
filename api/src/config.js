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

  // Resend transactional email. When resendApiKey is unset, email sending is
  // disabled (callers should no-op rather than error). resendFrom must be an
  // address on a domain verified in Resend.
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFrom: process.env.RESEND_FROM || 'donotreply@protectparking.com',
  // Where new-comment notifications are sent (staff inbox, not the signer).
  resendNotifyTo: process.env.RESEND_NOTIFY_TO || 'it@morrisdev.com',
  // Public base URL, used to build the admin link in notification emails.
  siteUrl: process.env.SITE_URL || 'https://protectparking.com',

  // Reject oversized payloads early.
  maxBodyBytes: '16kb',

  nodeEnv: process.env.NODE_ENV || 'development',
};
