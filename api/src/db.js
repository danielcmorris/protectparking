'use strict';

/**
 * Postgres data-access layer.
 *
 * The DB activates automatically when DATABASE_URL is set (locally via
 * ../creds/api.env, on Cloud Run via Secret Manager). With no DATABASE_URL the
 * layer falls back to an in-memory stub so the server still runs (e.g. the
 * current deployment before the Cloud SQL connection is attached).
 *
 * Schema: see db/schema.sql (table `comments`).
 */

const config = require('./config');

const ENABLE_DB = !!config.databaseUrl;

// Allowed `visibility` values (matches the comments.visibility column).
// New submissions default to 'to-review'; an admin promotes to 'public' or
// drops to 'private' from the admin page.
const VISIBILITIES = ['private', 'to-review', 'public'];
const DEFAULT_VISIBILITY = 'to-review';

let pool = null;

function getPool() {
  if (!ENABLE_DB) return null;
  if (!pool) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    pool.on('error', (err) => console.error('pg pool error:', err.message));
  }
  return pool;
}

// In-memory fallback so the stub behaves while no DATABASE_URL is configured.
let stubCount = 1284;

/**
 * Persist one comment/contact submission.
 * @param {{name:string,address:string,email:string,district3:boolean,comment:string,visibility?:string}} entry
 * @returns {Promise<{id:number}>}
 */
async function saveComment(entry) {
  const visibility = VISIBILITIES.includes(entry.visibility) ? entry.visibility : DEFAULT_VISIBILITY;

  if (!ENABLE_DB) {
    stubCount += 1;
    return { id: stubCount };
  }

  const sql = `
    INSERT INTO comments (name, address, email, district3, comment, visibility)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id`;
  const { rows } = await getPool().query(sql, [
    entry.name, entry.address, entry.email, entry.district3, entry.comment, visibility,
  ]);
  return { id: rows[0].id };
}

/**
 * Update a single comment's visibility (admin action).
 * @param {number} id
 * @param {string} visibility one of VISIBILITIES
 * @returns {Promise<{id:number, visibility:string}|null>} null if not found / invalid
 */
async function updateCommentVisibility(id, visibility) {
  const numId = parseInt(id, 10);
  if (!Number.isInteger(numId) || !VISIBILITIES.includes(visibility)) return null;

  if (!ENABLE_DB) {
    return { id: numId, visibility };
  }

  const sql = `UPDATE comments SET visibility = $2 WHERE id = $1 RETURNING id, visibility`;
  const { rows } = await getPool().query(sql, [numId, visibility]);
  return rows[0] || null;
}

/**
 * Count of submissions, used to power the "neighbors have spoken up" tally.
 * @returns {Promise<number>}
 */
async function getCommentCount() {
  if (!ENABLE_DB) {
    return stubCount;
  }

  const { rows } = await getPool().query('SELECT COUNT(*)::int AS n FROM comments');
  return rows[0].n;
}

/**
 * List submissions newest-first for the admin view.
 * @param {{limit?:number, offset?:number}} [opts]
 * @returns {Promise<Array<{id:number,name:string,address:string,email:string,district3:boolean,comment:string,visibility:string,created_at:string}>>}
 */
async function listComments({ limit = 100, offset = 0 } = {}) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
  const off = Math.max(parseInt(offset, 10) || 0, 0);

  if (!ENABLE_DB) {
    // A couple of fake rows so the admin page renders against the stub.
    const sample = [
      { id: stubCount, name: 'Jane Neighbor', address: '123 Vallejo St', email: 'jane@example.com', district3: true, comment: 'Please keep our parking!', visibility: 'to-review', created_at: new Date().toISOString() },
      { id: stubCount - 1, name: 'Sam Local', address: '456 Vallejo St', email: 'sam@example.com', district3: false, comment: 'Opposed to the takeover.', visibility: 'public', created_at: new Date().toISOString() },
    ];
    return sample.slice(off, off + lim);
  }

  const sql = `
    SELECT id, name, address, email, district3, comment, visibility, created_at
    FROM comments
    ORDER BY created_at DESC, id DESC
    LIMIT $1 OFFSET $2`;
  const { rows } = await getPool().query(sql, [lim, off]);
  return rows;
}

/**
 * Public-safe list of comments flagged `visibility = 'public'`, for the
 * scrolling "from your neighbors" cards on the site. Returns ONLY non-PII
 * fields (name + comment) — never email or address.
 * @param {{limit?:number}} [opts]
 * @returns {Promise<Array<{id:number,name:string,comment:string,created_at:string}>>}
 */
async function listPublicComments({ limit = 60 } = {}) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 60, 1), 200);

  if (!ENABLE_DB) {
    return [
      { id: 1, name: 'Gina M.', comment: "North Beach is already known for its lack of parking — taking 20% away makes getting home even harder.", created_at: new Date().toISOString() },
      { id: 2, name: 'Sam L.', comment: 'Public street space should not be handed to SFPD without the neighborhood having a say.', created_at: new Date().toISOString() },
      { id: 3, name: 'A neighbor', comment: 'We already circle for 30–60 minutes looking for parking. This will only make it worse.', created_at: new Date().toISOString() },
    ];
  }

  const sql = `
    SELECT id, name, comment, created_at
    FROM comments
    WHERE visibility = 'public'
      AND comment IS NOT NULL
      AND length(trim(comment)) > 0
    ORDER BY created_at DESC, id DESC
    LIMIT $1`;
  const { rows } = await getPool().query(sql, [lim]);
  return rows;
}

/**
 * Health probe for the connection. Returns true when reachable.
 * @returns {Promise<boolean>}
 */
async function ping() {
  if (!ENABLE_DB) return false;
  await getPool().query('SELECT 1');
  return true;
}

async function close() {
  if (pool) await pool.end();
}

module.exports = {
  getPool, saveComment, updateCommentVisibility, getCommentCount,
  listComments, listPublicComments, ping, close,
  ENABLE_DB, VISIBILITIES, DEFAULT_VISIBILITY,
};
