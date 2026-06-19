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

module.exports = { getPool, saveComment, getCommentCount, ping, close, ENABLE_DB };
