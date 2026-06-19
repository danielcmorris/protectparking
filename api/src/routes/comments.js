'use strict';

const express = require('express');
const db = require('../db');

const router = express.Router();

// Basic guardrails on field sizes (mirrors the schema and keeps payloads small).
const LIMITS = { name: 200, address: 300, email: 320, comment: 5000 };

function str(v, max) {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

function validate(body) {
  const errors = [];
  const email = str(body.email, LIMITS.email);
  if (!email) errors.push('email is required');
  // Loose shape check; real validation happens server-side once DB is wired.
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('email is invalid');

  const entry = {
    name: str(body.name, LIMITS.name),
    address: str(body.address, LIMITS.address),
    email,
    district3: body.district3 === true || body.district3 === 'on',
    comment: str(body.comment, LIMITS.comment),
  };
  return { entry, errors };
}

/**
 * POST /api/comments
 * Save a contact/comment submission.
 */
router.post('/comments', async (req, res) => {
  const { entry, errors } = validate(req.body || {});
  if (errors.length) {
    return res.status(400).json({ ok: false, errors });
  }

  try {
    const result = await db.saveComment(entry);
    return res.status(201).json({ ok: true, id: result.id, stub: !db.ENABLE_DB });
  } catch (err) {
    req.log ? req.log(err) : console.error(err);
    return res.status(500).json({ ok: false, error: 'failed to save comment' });
  }
});

/**
 * GET /api/comments/count
 * Returns the running tally for the pledge counter.
 */
router.get('/comments/count', async (_req, res) => {
  try {
    const count = await db.getCommentCount();
    return res.json({ ok: true, count, stub: !db.ENABLE_DB });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'failed to read count' });
  }
});

module.exports = router;
