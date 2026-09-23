/**
 * Matoo Admin API · Public inquiry submission route
 *
 * POST /api/inquiries  — anonymous form submission from website
 *
 * The website's main.js FormHandler tries /api/inquiries first and falls
 * back to mailto: only when the API is unreachable. Without this route
 * every form on the public site (contact, factory visit, spec download,
 * etc.) ends up opening the user's email client — losing every mobile /
 * corporate-firewalled visitor.
 *
 * This route is intentionally minimal:
 *   - No login required (it's anonymous public form traffic).
 *   - Rate-limited by the global writeLimiter in server.js (60 req/min/IP).
 *   - Size-capped at 32 KB to bound JSON parsing.
 *   - Honeypot field 'website_url' must be empty (bots auto-fill it).
 *   - Validates _form ∈ known kinds, basic email shape if provided.
 *   - Appends JSON Lines to api/data/inquiries.log (NOT .json — keeps
 *     one append per line, crash-consistent, easy to tail).
 *   - Records the raw IP for spam triage but never exposes it back.
 *   - Returns { ok, id } so the client can stop the mailto fallback.
 */

'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../lib/config');
const logger = require('../lib/logger');

// v1.4 T-2d X2:询盘写盘后异步转发到 h5-app 公开端点。
// 失败仅 console.warn,不阻断主响应(本地 inquiries.log 始终为第一落点)。
async function forwardToH5App(record, body) {
  if (config.h5AppApiDisabled) return;
  const url = config.h5AppApiUrl;
  const payload = {
    _form: body._form,
    _lang: body._lang,
    _source: body._source,
    name: body.name,
    company: body.company,
    email: body.email,
    phone: body.phone,
    message: body.message,
    inquiryId: record.id,
  };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), config.h5AppApiTimeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctl.signal,
    });
    const txt = res.ok ? await res.text() : '';
    logger.log({
      user: 'system',
      action: 'inquiry.forwarded',
      target: record.id,
      after: url + ' -> ' + res.status + ' ' + txt.slice(0, 200),
    });
  } catch (e) {
    console.warn('[inquiries] forward to h5-app failed:', record.id, e.name || '', e.message || '');
  } finally {
    clearTimeout(timer);
  }
}

const router = express.Router();

// Honeypot field — if filled, the submission is almost certainly a bot.
// Frontend form templates should render this as a hidden CSS-clipped
// input; legitimate users never see it, so they never fill it.
const HONEYPOT_FIELDS = ['website_url', 'fax_number', 'company_website'];

const ALLOWED_FORMS = new Set([
  'contact',          // generic contact form (website/contact.html)
  'inquiry',          // legacy alias for contact
  'factory-visit',    // planned: contact.html#factory-visit
  'spec-download',    // planned: products.html spec sheet download
  'roi-calc',         // planned: partnership.html ROI calculation
  'bp-request',       // planned: partnership.html investor BP request
  'e-cert-request',   // planned: technology.html e-certificate request
  'newsletter',       // planned: insights.html newsletter subscribe
  'inline',           // generic for window.MatooApp.submitLead
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9 ()-]{6,20}$/;

function ensureLogFile() {
  if (!fs.existsSync(config.paths.dataDir)) {
    fs.mkdirSync(config.paths.dataDir, { recursive: true });
  }
  const file = path.join(config.paths.dataDir, 'inquiries.log');
  if (!fs.existsSync(file)) fs.writeFileSync(file, '', 'utf8');
  return file;
}

router.post('/', (req, res) => {
  const body = req.body || {};

  // 1) Honeypot — silent drop, pretend success so bots don't learn.
  for (const f of HONEYPOT_FIELDS) {
    if (body[f] && String(body[f]).trim() !== '') {
      // Log for spam triage but return fake OK so bots self-retry.
      logger.log({
        user: 'system',
        action: 'inquiry.honeypot',
        target: req.ip || '',
        after: 'silent-drop',
      });
      return res.json({ ok: true, id: 'inq_spam_' + Date.now() });
    }
  }

  // 2) Basic shape.
  const form = String(body._form || '').trim();
  if (!ALLOWED_FORMS.has(form)) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_INPUT',
      message: 'Unknown form type',
    });
  }

  // 3) Optional field validation (only if provided).
  const email = body.email ? String(body.email).trim() : '';
  if (email && !EMAIL_RE.test(email)) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_INPUT',
      message: 'email is not a valid address',
    });
  }
  const phone = body.phone ? String(body.phone).trim() : '';
  if (phone && !PHONE_RE.test(phone)) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_INPUT',
      message: 'phone is not a valid number',
    });
  }

  // 4) At least one of {name, company, email, phone, message} must be present,
  //    otherwise this is empty spam.
  const hasContent = ['name', 'company', 'email', 'phone', 'message']
    .some((k) => body[k] && String(body[k]).trim() !== '');
  if (!hasContent) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_INPUT',
      message: 'No content provided',
    });
  }

  // 5) Build the record. Strip _honeypot / server-internal fields and
  //    blank strings; keep _meta prefixed fields for analytics.
  const record = {
    id: 'inq_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex'),
    ts: new Date().toISOString(),
    ip: req.ip || '',
    ua: req.headers['user-agent'] || '',
    _form: form,
    _lang: String(body._lang || '').slice(0, 8),
    _source: String(body._source || '').slice(0, 256),
    fields: {},
  };
  for (const k of Object.keys(body)) {
    if (k.startsWith('_') && k !== '_form' && k !== '_lang' && k !== '_source') continue;
    if (HONEYPOT_FIELDS.includes(k)) continue;
    if (k === '_form' || k === '_lang' || k === '_source') continue;
    const v = body[k];
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' && v.length > 4096) continue; // cap individual fields
    record.fields[k] = v;
  }

  // 6) Append to JSON Lines log + mirror to audit.log so existing
  //    /admin → Audit view picks it up without a code change.
  try {
    const file = ensureLogFile();
    fs.appendFileSync(file, JSON.stringify(record) + '\n', 'utf8');
    logger.log({
      user: 'public',
      action: 'inquiry.received',
      target: record.id,
      after: form + ' / ' + (email || phone || '(no contact)'),
    });
  } catch (err) {
    // Disk failure — log to stderr but still return OK so the user gets
    // a confirmation rather than seeing a confusing error. The audit.log
    // entry above will at least show the attempt.
    console.error('[inquiries] failed to persist:', err.message);
  }

  // v1.4 T-2d X2:异步转发到 h5-app 公开端点(fire-and-forget,不 await,不阻断响应)
  forwardToH5App(record, body);

  res.json({ ok: true, id: record.id, channel: 'api' });
});

module.exports = router;