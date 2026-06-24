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
 * @param {{name:string,address:string,email:string,district3:boolean,comment:string}} entry
 * @returns {Promise<{id:number}>}
 */
async function saveComment(entry) {
  if (!ENABLE_DB) {
    stubCount += 1;
    return { id: stubCount };
  }

  const sql = `
    INSERT INTO comments (name, address, email, district3, comment)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id`;
  const { rows } = await getPool().query(sql, [
    entry.name, entry.address, entry.email, entry.district3, entry.comment,
  ]);
  return { id: rows[0].id };
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
 * @returns {Promise<Array<{id:number,name:string,address:string,email:string,district3:boolean,comment:string,created_at:string}>>}
 */
async function listComments({ limit = 100, offset = 0 } = {}) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
  const off = Math.max(parseInt(offset, 10) || 0, 0);

  if (!ENABLE_DB) {
    // A couple of fake rows so the admin page renders against the stub.
    const sample = [
      { id: stubCount, name: 'Jane Neighbor', address: '123 Vallejo St', email: 'jane@example.com', district3: true, comment: 'Please keep our parking!', created_at: new Date().toISOString() },
      { id: stubCount - 1, name: 'Sam Local', address: '456 Vallejo St', email: 'sam@example.com', district3: false, comment: 'Opposed to the takeover.', created_at: new Date().toISOString() },
    ];
    return sample.slice(off, off + lim);
  }

  const sql = `
    SELECT id, name, address, email, district3, comment, created_at
    FROM comments
    ORDER BY created_at DESC, id DESC
    LIMIT $1 OFFSET $2`;
  const { rows } = await getPool().query(sql, [lim, off]);
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

module.exports = { getPool, saveComment, getCommentCount, listComments, ping, close, ENABLE_DB };
