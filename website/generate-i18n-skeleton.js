#!/usr/bin/env node
/**
 * Matoo Power · i18n skeleton generator
 *
 * Generates skeleton JSON for every supported language by cloning
 * the English file structure. Existing translations are preserved;
 * only missing keys are backfilled from en.json.
 *
 * Usage (from website/):
 *   node generate-i18n-skeleton.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const i18nDir = path.join(__dirname, 'i18n');
const enFile = path.join(i18nDir, 'en.json');

if (!fs.existsSync(enFile)) {
  console.error('[error] en.json missing');
  process.exit(1);
}

const LANGUAGES = [
  { code: 'ja', label: '日本語',     note: 'Japanese — skeleton, all values still English. To translate, run an AI pass and overwrite via admin UI.' },
  { code: 'ko', label: '한국어',     note: 'Korean — skeleton, all values still English.' },
  { code: 'vi', label: 'Tiếng Việt', note: 'Vietnamese — skeleton, all values still English.' },
  { code: 'hi', label: 'हिन्दी',    note: 'Hindi — skeleton, all values still English.' },
  { code: 'ur', label: 'اردو',      note: 'Urdu (RTL) — skeleton, all values still English.' },
  { code: 'ta', label: 'தமிழ்',     note: 'Tamil — skeleton, all values still English.' },
  { code: 'te', label: 'తెలుగు',    note: 'Telugu — skeleton, all values still English.' },
  { code: 'ar', label: 'العربية',   note: 'Arabic (RTL) — skeleton, all values still English.' },
  { code: 'fr', label: 'Français',  note: 'French — skeleton, all values still English.' },
  { code: 'pt', label: 'Português', note: 'Portuguese — skeleton, all values still English.' },
  { code: 'es', label: 'Español',   note: 'Spanish — skeleton, all values still English.' },
];

function readJson(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const clean = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return JSON.parse(clean);
}

function writeJson(file, data) {
  const json = JSON.stringify(data, null, 2) + '\n';
  // UTF-8 with BOM (matches existing i18n/*.json files)
  fs.writeFileSync(file, '\ufeff' + json, 'utf8');
}

function flatten(obj, prefix, out) {
  out = out || {};
  prefix = prefix || '';
  if (!obj || typeof obj !== 'object') return out;
  for (const k of Object.keys(obj)) {
    const p = prefix ? prefix + '.' + k : k;
    const v = obj[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, p, out);
    } else {
      out[p] = v;
    }
  }
  return out;
}

function hasPath(obj, dotted) {
  const parts = dotted.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return false;
    if (!(p in cur)) return false;
    cur = cur[p];
  }
  return true;
}

function setPath(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== 'object') cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

const en = readJson(enFile);
const enFlat = flatten(en);

let count = 0;
for (const lang of LANGUAGES) {
  const file = path.join(i18nDir, lang.code + '.json');
  let existing = {};
  if (fs.existsSync(file)) {
    try { existing = readJson(file); }
    catch (e) {
      console.warn('[warn] ' + lang.code + '.json parse error, will overwrite:', e.message);
      existing = {};
    }
  }

  // _meta
  existing._meta = {
    lang: lang.code,
    label: lang.label,
    version: '0.1',
    note: lang.note,
  };

  // Backfill missing keys
  let added = 0;
  for (const k of Object.keys(enFlat)) {
    if (!hasPath(existing, k)) {
      setPath(existing, k, enFlat[k]);
      added++;
    }
  }

  writeJson(file, existing);
  console.log('[ok] ' + lang.code + '  ' + lang.label + '  (added ' + added + ' keys)');
  count++;
}

console.log('');
console.log('Generated ' + count + ' skeleton files. Open admin UI to translate.');