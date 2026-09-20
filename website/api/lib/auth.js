/**
 * Matoo Admin API · Auth helpers
 *
 * - Persistent admin credentials stored in api/data/admin.json
 *   (password hash + salt, never plaintext).
 * - Sessions stored in api/data/sessions.json (cookie token → meta).
 * - Onboarding: if no admin.json and no ADMIN_PASSWORD env, generate
 *   a random 8-char password and print to console.
 *
 * NOTE: We deliberately avoid bcrypt/scrypt native bindings so the
 * backend installs without compilers. We use Node's built-in scrypt
 * (available since v10).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

const SESSION_TTL_MS = 48 * 60 * 60 * 1000;
const FLUSH_INTERVAL_MS = 30 * 1000;

// In-memory session cache: { token -> { sig, createdAt, expiresAt } }.
// On every mutating call we mark the cache DIRTY and the background
// flusher persists it at most every FLUSH_INTERVAL_MS. This turns
// `verifySession` from O(disk-write) per request into O(1) amortised.
// Worst-case data loss on hard crash: at most FLUSH_INTERVAL_MS of
// session churn (a few hundred KB of JSON).
const sessionCache = Object.create(null); // token -> meta
let sessionCacheDirty = false;
let sessionCacheLoaded = false;
let flushTimer = null;

function ensureDataDir() {
  if (!fs.existsSync(config.paths.dataDir)) {
    fs.mkdirSync(config.paths.dataDir, { recursive: true });
  }
}

function loadAdmin() {
  ensureDataDir();
  if (!fs.existsSync(config.paths.adminFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(config.paths.adminFile, 'utf8'));
  } catch (_) {
    return null;
  }
}

function saveAdmin(admin) {
  ensureDataDir();
  fs.writeFileSync(config.paths.adminFile, JSON.stringify(admin, null, 2), 'utf8');
}

function ensureSessionSecret() {
  if (config.sessionSecret) return config.sessionSecret;
  const file = path.join(config.paths.dataDir, 'session.secret');
  if (fs.existsSync(file)) {
    const stored = fs.readFileSync(file, 'utf8').trim();
    if (stored) return stored;
  }
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(file, secret, 'utf8');
  return secret;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto
    .scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 })
    .toString('hex');
  return { salt, hash: derived };
}

function verifyPassword(password, salt, expectedHash) {
  const derived = crypto
    .scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 })
    .toString('hex');
  const a = Buffer.from(derived, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function generatePassword() {
  // Avoid easily-confused chars (0/o, 1/l/i)
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function ensureAdmin() {
  let admin = loadAdmin();
  if (admin) return admin;

  let password = config.adminPassword;
  if (!password) {
    password = generatePassword();
    console.log('');
    console.log('==============================================================');
    console.log(' Matoo Admin · FIRST RUN');
    console.log(' No admin password configured. Generated a random one:');
    console.log('');
    console.log('   ADMIN PASSWORD: ' + password);
    console.log('');
    console.log(' Stored in api/data/admin.json. To rotate, delete that file');
    console.log(' and restart, or set ADMIN_PASSWORD in api/.env.');
    console.log('==============================================================');
    console.log('');
  }
  const { salt, hash } = hashPassword(password);
  admin = {
    username: 'admin',
    salt,
    hash,
    createdAt: new Date().toISOString(),
    failedAttempts: 0,
    lockedUntil: null,
  };
  saveAdmin(admin);
  return admin;
}

function loadSessions() {
  // Back-compat shim: now a no-op (loadSessionsFromDisk is called lazily).
  // Kept as an export for any external caller that may rely on it.
  ensureSessionCacheLoaded();
  return sessionCache;
}

function loadSessionsFromDisk() {
  ensureDataDir();
  if (!fs.existsSync(config.paths.sessionsFile)) return {};
  try {
    return JSON.parse(fs.readFileSync(config.paths.sessionsFile, 'utf8'));
  } catch (_) {
    return {};
  }
}

function ensureSessionCacheLoaded() {
  if (sessionCacheLoaded) return;
  const fromDisk = loadSessionsFromDisk();
  for (const [token, meta] of Object.entries(fromDisk)) {
    sessionCache[token] = meta;
  }
  sessionCacheLoaded = true;
}

function flushSessionsNow() {
  if (!sessionCacheDirty) return;
  try {
    ensureDataDir();
    fs.writeFileSync(
      config.paths.sessionsFile,
      JSON.stringify(sessionCache, null, 2),
      'utf8'
    );
    sessionCacheDirty = false;
  } catch (err) {
    // Don't crash the request loop on disk failure; we'll retry next flush.
    console.error('[auth] failed to flush sessions:', err.message);
  }
}

function markDirty() {
  sessionCacheDirty = true;
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushSessionsNow();
    }, FLUSH_INTERVAL_MS);
    // Don't keep the process alive just for flushing.
    if (flushTimer.unref) flushTimer.unref();
  }
}

// Best-effort flush on exit so we don't lose recent churn.
function installExitHooks() {
  const flush = () => { flushSessionsNow(); };
  process.once('beforeExit', flush);
  process.once('SIGINT', () => { flush(); process.exit(0); });
  process.once('SIGTERM', () => { flush(); process.exit(0); });
}

function pruneSessionsInMemory() {
  const now = Date.now();
  let changed = false;
  for (const token of Object.keys(sessionCache)) {
    if (sessionCache[token].expiresAt < now) {
      delete sessionCache[token];
      changed = true;
    }
  }
  if (changed) markDirty();
  return sessionCache;
}

function createSession() {
  ensureSessionCacheLoaded();
  pruneSessionsInMemory();
  const token = crypto.randomBytes(32).toString('hex');
  const secret = ensureSessionSecret();
  const sig = crypto.createHmac('sha256', secret).update(token).digest('hex').slice(0, 16);
  sessionCache[token] = {
    sig,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  markDirty();
  // Persist immediately on create so a crash within seconds doesn't lose
  // the freshly-issued token (cheap; happens once per login).
  flushSessionsNow();
  return { token, sig };
}

function destroySession(token) {
  ensureSessionCacheLoaded();
  if (sessionCache[token]) {
    delete sessionCache[token];
    markDirty();
    flushSessionsNow();
  }
}

function verifySession(token) {
  if (!token) return null;
  ensureSessionCacheLoaded();
  pruneSessionsInMemory();
  const meta = sessionCache[token];
  if (!meta) return null;
  const secret = ensureSessionSecret();
  const sig = crypto.createHmac('sha256', secret).update(token).digest('hex').slice(0, 16);
  if (sig !== meta.sig) return null;
  // Slide expiration — mutate in place, defer persist to background timer.
  meta.expiresAt = Date.now() + SESSION_TTL_MS;
  markDirty();
  return meta;
}

function checkLoginLock(admin) {
  if (admin.lockedUntil && new Date(admin.lockedUntil).getTime() > Date.now()) {
    const seconds = Math.ceil((new Date(admin.lockedUntil).getTime() - Date.now()) / 1000);
    const err = new Error('Too many failed attempts. Try again in ' + seconds + 's.');
    err.code = 'RATE_LIMITED';
    err.httpStatus = 429;
    throw err;
  }
  // Reset lock if expired
  if (admin.lockedUntil && new Date(admin.lockedUntil).getTime() <= Date.now()) {
    admin.failedAttempts = 0;
    admin.lockedUntil = null;
    saveAdmin(admin);
  }
}

function recordFailedLogin(admin) {
  admin.failedAttempts = (admin.failedAttempts || 0) + 1;
  if (admin.failedAttempts >= 5) {
    admin.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    admin.failedAttempts = 0;
  }
  saveAdmin(admin);
}

function recordSuccessLogin(admin) {
  admin.failedAttempts = 0;
  admin.lockedUntil = null;
  saveAdmin(admin);
}

module.exports = {
  ensureAdmin,
  hashPassword,
  verifyPassword,
  generatePassword,
  checkLoginLock,
  recordFailedLogin,
  recordSuccessLogin,
  createSession,
  destroySession,
  verifySession,
  loadSessions,        // back-compat (returns in-memory map; do not mutate)
  flushSessionsNow,    // force a synchronous flush
  ensureSessionCacheLoaded,
  installExitHooks,    // call once at boot
};