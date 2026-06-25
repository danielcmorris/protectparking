'use strict';

const crypto = require('crypto');
const express = require('express');
const db = require('../db');
const config = require('../config');
const { sendEmail } = require('../email');

const router = express.Router();

// Confirmation email sent to a new signup. Kept plain and short. Failures are
// logged but never block the signup response.
async function sendSignupConfirmation(entry, log) {
  if (!entry.email) return;
  const name = entry.name || 'neighbor';
  const text =
    `Hi ${name},\n\n` +
    `Thanks for standing with us to protect parking in our neighborhood. ` +
    `Your name has been added to the list.\n\n` +
    `We'll be in touch with next steps.\n\n` +
    `— protectparking.com\n\n` +
    `This is an unmonitored address; please don't reply to this email.`;
  const html =
    `<p>Hi ${name},</p>` +
    `<p>Thanks for standing with us to protect parking in our neighborhood. ` +
    `Your name has been added to the list.</p>` +
    `<p>We'll be in touch with next steps.</p>` +
    `<p>— <a href="https://protectparking.com">protectparking.com</a></p>` +
    `<p style="color:#888;font-size:12px">This is an unmonitored address; please don't reply to this email.</p>`;

  const result = await sendEmail({
    to: entry.email,
    subject: 'Thanks for protecting our parking',
    text,
    html,
  });
  if (!result.ok && !result.skipped) {
    (log || console.error)(`signup confirmation email failed: ${result.error}`);
  }
}

// Constant-time compare of the supplied admin token against the configured one.
function tokenOk(supplied) {
  const expected = config.adminToken;
  if (!expected) return false;
  const a = Buffer.from(String(supplied || ''));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Guard for the PII-bearing admin endpoints.
function requireAdmin(req, res, next) {
  if (!config.adminToken) {
    return res.status(503).json({ ok: false, error: 'admin listing disabled (ADMIN_TOKEN not set)' });
  }
  const supplied = req.get('x-admin-token') || (req.query.token || '');
  if (!tokenOk(supplied)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  return next();
}

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

  // Visibility is caller-supplied but clamped to the allowed set; anything
  // unknown (or omitted) falls back to the default ('to-review').
  const visibility = db.VISIBILITIES.includes(body.visibility) ? body.visibility : db.DEFAULT_VISIBILITY;

  const entry = {
    name: str(body.name, LIMITS.name),
    address: str(body.address, LIMITS.address),
    email,
    district3: body.district3 === true || body.district3 === 'on',
    comment: str(body.comment, LIMITS.comment),
    visibility,
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
    // Best-effort confirmation email; never fail the signup if it errors.
    await sendSignupConfirmation(entry, req.log).catch((e) => (req.log || console.error)(e));
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

/**
 * GET /api/comments/public
 * Public, non-authenticated feed of comments flagged `visibility = 'public'`.
 * Returns only name + comment (no PII) for the scrolling cards on the site.
 */
router.get('/comments/public', async (req, res) => {
  try {
    const rows = await db.listPublicComments({ limit: req.query.limit });
    return res.json({ ok: true, count: rows.length, comments: rows, stub: !db.ENABLE_DB });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'failed to read public comments' });
  }
});

/**
 * GET /api/comments
 * Admin-only listing of submissions (contains PII). Requires a valid
 * admin token via the `x-admin-token` header or `?token=` query param.
 */
router.get('/comments', requireAdmin, async (req, res) => {
  try {
    const rows = await db.listComments({ limit: req.query.limit, offset: req.query.offset });
    return res.json({ ok: true, count: rows.length, comments: rows, stub: !db.ENABLE_DB });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'failed to read comments' });
  }
});

/**
 * PATCH /api/comments/:id/visibility
 * Admin-only. Set a single comment's visibility to private | to-review | public.
 * Body: { visibility: string }
 */
router.patch('/comments/:id/visibility', requireAdmin, async (req, res) => {
  const visibility = (req.body && req.body.visibility) || '';
  if (!db.VISIBILITIES.includes(visibility)) {
    return res.status(400).json({ ok: false, error: `visibility must be one of: ${db.VISIBILITIES.join(', ')}` });
  }
  try {
    const updated = await db.updateCommentVisibility(req.params.id, visibility);
    if (!updated) return res.status(404).json({ ok: false, error: 'comment not found' });
    return res.json({ ok: true, id: updated.id, visibility: updated.visibility, stub: !db.ENABLE_DB });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'failed to update visibility' });
  }
});

module.exports = router;
