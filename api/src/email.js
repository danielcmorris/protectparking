'use strict';

/**
 * Transactional email via Resend (https://resend.com).
 *
 * Calls Resend's HTTP API directly with the built-in fetch (Node >=20) so we
 * pull in no extra dependency. Sending is a no-op when RESEND_API_KEY is unset,
 * so local/dev and unconfigured environments never error or send.
 *
 * NOTE: this makes an outbound call to api.resend.com. Per project convention
 * we cap payload size and bound the request with a timeout so a slow/oversized
 * send can never hang or balloon the request.
 */

const config = require('./config');

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// Hard guardrails on outbound payloads.
const MAX_HTML_BYTES = 100 * 1024; // 100 KB of HTML is plenty for a notice.
const MAX_TEXT_BYTES = 50 * 1024;
const SEND_TIMEOUT_MS = 10000;

const enabled = Boolean(config.resendApiKey);

function bytes(s) {
  return Buffer.byteLength(s || '', 'utf8');
}

/**
 * Send one email through Resend.
 *
 * @param {object} opts
 * @param {string|string[]} opts.to    Recipient address(es).
 * @param {string} opts.subject        Subject line.
 * @param {string} [opts.html]         HTML body.
 * @param {string} [opts.text]         Plain-text body (recommended fallback).
 * @param {string} [opts.from]         Override sender; defaults to config.resendFrom.
 * @param {string} [opts.replyTo]      Optional Reply-To.
 * @returns {Promise<{ok:boolean, skipped?:boolean, id?:string, error?:string}>}
 *
 * Never throws — returns a result object so callers can fire-and-forget.
 */
async function sendEmail(opts) {
  if (!enabled) {
    return { ok: false, skipped: true, error: 'RESEND_API_KEY not set' };
  }

  const to = opts.to;
  const subject = opts.subject;
  if (!to || !subject) {
    return { ok: false, error: 'to and subject are required' };
  }
  if (bytes(opts.html) > MAX_HTML_BYTES || bytes(opts.text) > MAX_TEXT_BYTES) {
    return { ok: false, error: 'email body exceeds size limit' };
  }

  const payload = {
    from: opts.from || config.resendFrom,
    to: Array.isArray(to) ? to : [to],
    subject,
  };
  if (opts.html) payload.html = opts.html;
  if (opts.text) payload.text = opts.text;
  if (opts.replyTo) payload.reply_to = opts.replyTo;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const resp = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { ok: false, error: (data && data.message) || `resend HTTP ${resp.status}` };
    }
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'resend request timed out' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { sendEmail, enabled };
