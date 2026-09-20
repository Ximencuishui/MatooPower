/**
 * Matoo Admin API · Auth routes
 */
'use strict';

const express = require('express');
const config = require('../lib/config');
const {
  ensureAdmin,
  verifyPassword,
  checkLoginLock,
  recordFailedLogin,
  recordSuccessLogin,
  createSession,
  destroySession,
  verifySession,
} = require('../lib/auth');
const logger = require('../lib/logger');

const router = express.Router();
const SESSION_COOKIE = 'matoo_admin';

function readSessionToken(req) {
  return req.cookies ? req.cookies[SESSION_COOKIE] : null;
}

/**
 * Reduce a User-Agent string to "Browser/MAJOR" for compact logging.
 * Falls back to 'unknown' if no known signature is found. We only log
 * this short token (no full UA) to keep audit.log compact.
 */
function shortUA(req) {
  const ua = (req.headers && req.headers['user-agent']) || '';
  if (!ua) return 'unknown';
  // Order matters: Edge before Chrome, Chrome before Safari, etc.
  let m =
    ua.match(/Edg(?:e|A|iOS)?\/(\d+)/) ||
    ua.match(/OPR\/(\d+)/) ||
    ua.match(/Firefox\/(\d+)/) ||
    ua.match(/Chrome\/(\d+)/) ||
    ua.match(/Safari\/(\d+)/);
  if (!m) return 'other';
  // Normalise browser family.
  const fam = /Edg/.test(m[0])
    ? 'Edge'
    : /OPR/.test(m[0])
    ? 'Opera'
    : /Firefox/.test(m[0])
    ? 'Firefox'
    : /Chrome/.test(m[0])
    ? 'Chrome'
    : 'Safari';
  return fam + '/' + m[1];
}

function clientTag(req) {
  const ip = req.ip || '';
  const ua = shortUA(req);
  return ip + '@' + ua;
}

function setSessionCookie(res, token, maxAgeMs) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: false, // localhost http; production should run behind HTTPS proxy
    maxAge: maxAgeMs,
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

function csrfTokenFor(token) {
  const crypto = require('crypto');
  // Derive a stable CSRF token from the session token via HMAC.
  // Even if the cookie leaks over XSS-less attacks, the strict
  // sameSite + httpOnly cookie reduces risk; this header token
  // guards against CSRF on state-changing endpoints.
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 32);
}

router.post('/login', (req, res) => {
  const admin = ensureAdmin();
  try {
    checkLoginLock(admin);
    const { password } = req.body || {};
    if (typeof password !== 'string' || password.length === 0 || password.length > 256) {
      recordFailedLogin(admin);
      return res.status(400).json({ ok: false, code: 'INVALID_INPUT', message: 'Password required' });
    }
    if (!verifyPassword(password, admin.salt, admin.hash)) {
      recordFailedLogin(admin);
      logger.log({ user: 'admin', action: 'auth.fail', target: clientTag(req) });
      return res.status(401).json({ ok: false, code: 'UNAUTHORIZED', message: 'Invalid password' });
    }
    recordSuccessLogin(admin);
    const { token } = createSession();
    setSessionCookie(res, token, 48 * 60 * 60 * 1000);
    logger.log({ user: 'admin', action: 'auth.login', target: clientTag(req), after: 'ok' });
    res.json({ ok: true, csrf: csrfTokenFor(token) });
  } catch (err) {
    if (err.httpStatus) {
      return res.status(err.httpStatus).json({ ok: false, code: err.code, message: err.message });
    }
    res.status(500).json({ ok: false, code: 'STORAGE_ERROR', message: err.message });
  }
});

router.post('/logout', (req, res) => {
  const token = readSessionToken(req);
  if (token) destroySession(token);
  clearSessionCookie(res);
  logger.log({ user: 'admin', action: 'auth.logout', target: clientTag(req) });
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  const token = readSessionToken(req);
  const meta = verifySession(token);
  if (!meta) return res.status(401).json({ ok: false, code: 'UNAUTHORIZED' });
  res.json({ ok: true, user: 'admin', csrf: csrfTokenFor(token) });
});

/**
 * Middleware factory: require valid session + matching CSRF for mutating verbs.
 */
function requireAuth(method) {
  return function (req, res, next) {
    const token = readSessionToken(req);
    const meta = verifySession(token);
    if (!meta) return res.status(401).json({ ok: false, code: 'UNAUTHORIZED' });
    req.session = meta;
    if (method === 'write') {
      const headerToken = req.get('X-CSRF-Token') || '';
      if (headerToken !== csrfTokenFor(token)) {
        return res.status(403).json({ ok: false, code: 'FORBIDDEN', message: 'CSRF token mismatch' });
      }
    }
    next();
  };
}

module.exports = { router, requireAuth, readSessionToken, setSessionCookie, clearSessionCookie };