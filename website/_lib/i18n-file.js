#!/usr/bin/env node
/**
 * Matoo Power · i18n file toolkit (shared by all maintenance scripts)
 *
 * Centralises the patterns the per-language scripts repeat:
 *   - Resolving the website root and i18n directory.
 *   - Listing/reading/writing each <lang>.json.
 *   - Iterating over all 14 supported languages.
 *   - Nested-key deletion that cleans up empty parents.
 *   - Indented 2-space write with trailing newline, no BOM.
 *
 * Each script keeps its own argv/UX; this module is the data layer only.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SUPPORTED_LANGS = [
  'en', 'zh', 'bn', 'ja', 'ko', 'vi', 'hi', 'ur', 'ta', 'te', 'ar', 'fr', 'pt', 'es',
];

const WEBSITE_ROOT = path.resolve(__dirname, '..');
const I18N_DIR = path.join(WEBSITE_ROOT, 'i18n');

function listFiles() {
  if (!fs.existsSync(I18N_DIR)) return [];
  return fs.readdirSync(I18N_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(I18N_DIR, f));
}

function fileFor(lang) {
  return path.join(I18N_DIR, lang + '.json');
}

function readFile(file) {
  const raw = fs.readFileSync(file, 'utf8');
  // Strip UTF-8 BOM if a non-strip-bom editor added one back.
  const clean = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return JSON.parse(clean);
}

function writeFile(file, obj) {
  const json = JSON.stringify(obj, null, 2) + '\n';
  fs.writeFileSync(file, json, 'utf8');
}

function writeIfChanged(file, newObj) {
  const oldJson = fs.existsSync(file)
    ? fs.readFileSync(file, 'utf8').replace(/^\ufeff/, '')
    : null;
  const newJson = JSON.stringify(newObj, null, 2) + '\n';
  if (oldJson === newJson) return false;
  fs.writeFileSync(file, newJson, 'utf8');
  return true;
}

/**
 * Iterate over every supported language file.
 * callback receives ({ lang, file, json }) and may mutate json in place.
 * Returns { touched, total }.
 */
function forEachLang(callback) {
  let touched = 0;
  let total = 0;
  for (const lang of SUPPORTED_LANGS) {
    const file = fileFor(lang);
    if (!fs.existsSync(file)) continue;
    let json;
    try { json = readFile(file); }
    catch (e) { console.error('[err]  ' + lang + '.json — ' + e.message); continue; }
    total++;
    if (callback({ lang, file, json }) !== false) {
      if (writeIfChanged(file, json)) touched++;
    }
  }
  return { touched, total };
}

/**
 * Delete a dotted key from a nested object. Only deletes the leaf when
 * it is a string (never kills an entire nested group). Cleans up any
 * parent objects that become empty after the deletion.
 *
 * Returns true if something was removed.
 */
function deleteNested(obj, dottedKey) {
  const parts = dottedKey.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur || typeof cur !== 'object' || !(parts[i] in cur)) return false;
    cur = cur[parts[i]];
  }
  if (!cur || typeof cur !== 'object' || !(parts[parts.length - 1] in cur)) return false;
  if (typeof cur[parts[parts.length - 1]] !== 'string') return false;
  delete cur[parts[parts.length - 1]];
  // Clean up empty nested objects so JSON stays minimal
  for (let i = parts.length - 1; i > 0; i--) {
    const parent = (function climb(o, p) {
      let x = o;
      for (let j = 0; j < p - 1; j++) x = x[parts[j]];
      return x;
    })(obj, i);
    const key = parts[i - 1];
    if (parent[key] && typeof parent[key] === 'object' && Object.keys(parent[key]).length === 0) {
      delete parent[key];
    } else {
      break;
    }
  }
  return true;
}

module.exports = {
  SUPPORTED_LANGS,
  WEBSITE_ROOT,
  I18N_DIR,
  listFiles,
  fileFor,
  readFile,
  writeFile,
  writeIfChanged,
  forEachLang,
  deleteNested,
};