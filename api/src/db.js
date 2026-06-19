'use strict';

/**
 * Postgres data-access layer.
 *
 * ⚠️  STUB — not wired up yet.
 * The Pool wiring and SQL are sketched here for reference, but every function
 * currently short-circuits with in-memory/canned behavior so the server runs
 * with no database present. Flip ENABLE_DB (or just finish the TODOs) when the
 * Postgres instance and schema (see db/schema.sql) are provisioned.
 */

const config = require('./config');

// Toggle to true once a real DATABASE_URL + schema exist.
const ENABLE_DB = false;

let pool = null;

function getPool() {
  if (!ENABLE_DB) return null;
  if (!pool) {
    // const { Pool } = require('pg');
    // pool = new Pool({
    //   connectionString: config.databaseUrl,
    //   max: 5,
    //   idleTimeoutMillis: 30000,
    //   connectionTimeoutMillis: 5000,
    // });
    throw new Error('DB pool requested but not implemented yet');
  }
  return pool;
}

// In-memory fallback so the stub behaves while the DB is not connected.
let stubCount = 1284;

/**
 * Persist one comment/contact submission.
 * @param {{name:string,address:string,email:string,district3:boolean,comment:string}} entry
 * @returns {Promise<{id:number}>}
 */
async function saveComment(entry) {
  if (!ENABLE_DB) {
    // STUB: pretend we inserted a row.
    stubCount += 1;
    return { id: stubCount };
  }

  // TODO(real impl):
  // const sql = `
  //   INSERT INTO comments (name, address, email, district3, comment)
  //   VALUES ($1, $2, $3, $4, $5)
  //   RETURNING id`;
  // const { rows } = await getPool().query(sql, [
  //   entry.name, entry.address, entry.email, entry.district3, entry.comment,
  // ]);
  // return { id: rows[0].id };
  throw new Error('saveComment not implemented yet');
}

/**
 * Count of submissions, used to power the "neighbors have spoken up" tally.
 * @returns {Promise<number>}
 */
async function getCommentCount() {
  if (!ENABLE_DB) {
    // STUB: canned count.
    return stubCount;
  }

  // TODO(real impl):
  // const { rows } = await getPool().query('SELECT COUNT(*)::int AS n FROM comments');
  // return rows[0].n;
  throw new Error('getCommentCount not implemented yet');
}

/**
 * Health probe for the connection. Returns true when reachable.
 * @returns {Promise<boolean>}
 */
async function ping() {
  if (!ENABLE_DB) return false; // no DB wired yet
  // await getPool().query('SELECT 1');
  // return true;
  throw new Error('ping not implemented yet');
}

async function close() {
  if (pool) await pool.end();
}

module.exports = { getPool, saveComment, getCommentCount, ping, close, ENABLE_DB };
