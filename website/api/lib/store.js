/**
 * Matoo Admin API · File store
 *
 * Encapsulates safe, serializable reads/writes against the website's
 * i18n JSON files and assets/ directory. All writes go through a
 * single in-process mutex per file to avoid torn writes.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');

// All front-end languages. Each has its own i18n/<lang>.json file.
// Note: this is only what the admin UI offers for translation editing;
// the frontend lang-switcher in scripts/main.js has the same set.
const SUPPORTED_LANGS = [
  'en', // English (default)
  'zh', // 中文
  'bn', // বাংলা (Bangla)
  'ja', // 日本語 (Japanese)
  'ko', // 한국어 (Korean)
  'vi', // Tiếng Việt (Vietnamese)
  'hi', // हिन्दी (Hindi)
  'ur', // اردو (Urdu)         — RTL
  'ta', // தமிழ் (Tamil)
  'te', // తెలుగు (Telugu)
  'ar', // العربية (Arabic)    — RTL
  'fr', // Français (French)
  'pt', // Português (Portuguese)
  'es', // Español (Spanish)
];
const RTL_LANGS = new Set(['ur', 'ar']);

function isSafeKey(key) {
  // Translation keys are dotted paths like "hero.title". No slashes,
  // no traversal sequences.
  if (typeof key !== 'string' || key.length === 0 || key.length > 256) return false;
  return /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/.test(key);
}

function isSupportedLang(lang) {
  return SUPPORTED_LANGS.includes(lang);
}

function isRtlLang(lang) {
  return RTL_LANGS.has(lang);
}

function i18nFilePath(lang) {
  if (!isSupportedLang(lang)) {
    const err = new Error('Unsupported language: ' + lang);
    err.code = 'INVALID_INPUT';
    err.httpStatus = 400;
    throw err;
  }
  return path.join(config.paths.i18nDir, lang + '.json');
}

const i18nLocks = new Map();
function withLock(key, fn) {
  const prev = i18nLocks.get(key) || Promise.resolve();
  const next = prev.then(fn, fn);
  i18nLocks.set(key, next.catch(() => {}));
  return next;
}

function readI18n(lang) {
  const file = i18nFilePath(lang);
  if (!fs.existsSync(file)) return {};
  const raw = fs.readFileSync(file, 'utf8');
  // Strip UTF-8 BOM if present (PowerShell writers often add one)
  const clean = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return JSON.parse(clean);
}

function writeI18n(lang, data) {
  const file = i18nFilePath(lang);
  const json = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(file, json, 'utf8');
}

function ensureBackupDir() {
  if (!fs.existsSync(config.paths.i18nBackupDir)) {
    fs.mkdirSync(config.paths.i18nBackupDir, { recursive: true });
  }
}

function backupI18n(lang) {
  ensureBackupDir();
  const file = i18nFilePath(lang);
  if (!fs.existsSync(file)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(config.paths.i18nBackupDir, `${lang}.${stamp}.json`);
  fs.copyFileSync(file, target);
  // Keep last 50 backups per lang
  pruneBackups(lang, 50);
  return target;
}

function pruneBackups(lang, keep) {
  ensureBackupDir();
  const all = fs
    .readdirSync(config.paths.i18nBackupDir)
    .filter((f) => f.startsWith(lang + '.') && f.endsWith('.json'))
    .sort()
    .reverse();
  for (const old of all.slice(keep)) {
    try { fs.unlinkSync(path.join(config.paths.i18nBackupDir, old)); } catch (_) {}
  }
}

function getByPath(obj, dottedKey) {
  const parts = dottedKey.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function setByPath(obj, dottedKey, value) {
  const parts = dottedKey.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== 'object') cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function deleteByPath(obj, dottedKey) {
  const parts = dottedKey.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur == null || typeof cur !== 'object') return false;
    cur = cur[parts[i]];
  }
  if (cur && typeof cur === 'object' && parts[parts.length - 1] in cur) {
    delete cur[parts[parts.length - 1]];
    return true;
  }
  return false;
}

function flattenKeys(obj, prefix, out) {
  out = out || [];
  prefix = prefix || '';
  if (!obj || typeof obj !== 'object') return out;
  for (const k of Object.keys(obj)) {
    if (k === '_meta') continue;
    const path = prefix ? prefix + '.' + k : k;
    const v = obj[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flattenKeys(v, path, out);
    } else {
      out.push(path);
    }
  }
  return out;
}

function updateTranslation(lang, key, value) {
  if (!isSafeKey(key)) {
    const err = new Error('Invalid translation key');
    err.code = 'INVALID_INPUT';
    err.httpStatus = 400;
    throw err;
  }
  if (typeof value !== 'string') {
    const err = new Error('Translation value must be a string');
    err.code = 'INVALID_INPUT';
    err.httpStatus = 400;
    throw err;
  }
  if (value.length > 16 * 1024) {
    const err = new Error('Translation value too long (max 16 KB)');
    err.code = 'INVALID_INPUT';
    err.httpStatus = 400;
    throw err;
  }
  return withLock('i18n:' + lang, () => {
    const data = readI18n(lang);
    const before = getByPath(data, key);
    setByPath(data, key, value);
    backupI18n(lang);
    writeI18n(lang, data);
    return { before, after: value };
  });
}

function restoreBackup(lang, backupName) {
  if (!isSupportedLang(lang)) {
    const err = new Error('Unsupported language: ' + lang);
    err.code = 'INVALID_INPUT';
    err.httpStatus = 400;
    throw err;
  }
  if (!/^[A-Za-z0-9._-]+\.json$/.test(backupName) || !backupName.startsWith(lang + '.')) {
    const err = new Error('Invalid backup file');
    err.code = 'INVALID_INPUT';
    err.httpStatus = 400;
    throw err;
  }
  const src = path.join(config.paths.i18nBackupDir, backupName);
  if (!fs.existsSync(src)) {
    const err = new Error('Backup not found');
    err.code = 'NOT_FOUND';
    err.httpStatus = 404;
    throw err;
  }
  backupI18n(lang); // snapshot current first
  fs.copyFileSync(src, i18nFilePath(lang));
  return true;
}

function listBackups(lang) {
  if (!isSupportedLang(lang)) return [];
  ensureBackupDir();
  return fs
    .readdirSync(config.paths.i18nBackupDir)
    .filter((f) => f.startsWith(lang + '.') && f.endsWith('.json'))
    .sort()
    .reverse();
}

module.exports = {
  SUPPORTED_LANGS,
  RTL_LANGS,
  isSafeKey,
  isSupportedLang,
  isRtlLang,
  readI18n,
  writeI18n,
  backupI18n,
  restoreBackup,
  listBackups,
  updateTranslation,
  flattenKeys,
  getByPath,
  setByPath,
  deleteByPath,
};