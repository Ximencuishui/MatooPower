#!/usr/bin/env node
/**
 * Matoo Power · Backfill missing i18n keys with English fallback values
 *
 * For each main HTML page, parse the embedded <script id="i18n-data">
 * block, and for every language (except en), fill in any key whose en
 * counterpart exists but is missing locally. The English string is used
 * as the fallback so the UI never shows blank placeholders. Real
 * translations are out of scope here.
 *
 * Also writes the same fallbacks into the standalone i18n/<lang>.json
 * files so the runtime fallback (i18n/<lang>.json) stays aligned with
 * the inline block.
 *
 * Idempotent: second pass finds nothing to change.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname);
const SUPPORTED = ['en','zh','bn','ja','ko','vi','hi','ur','ta','te','ar','fr','pt','es'];
const HTML_FILES = [
  'index.html', 'products.html', 'technology.html', 'manufacturing.html',
  'partnership.html', 'insights.html', 'about.html', 'contact.html',
  'privacy.html', 'cookies.html', 'terms.html', 'configurator.html',
];

function flatKeys(o, prefix = '', out = []) {
  if (!o || typeof o !== 'object') return out;
  for (const [k, v] of Object.entries(o)) {
    if (k === '_meta') continue;
    const f = prefix ? prefix + '.' + k : k;
    if (typeof v === 'string') out.push(f);
    else if (v && typeof v === 'object') flatKeys(v, f, out);
  }
  return out;
}

function getNested(obj, dotted) {
  const parts = dotted.split('.');
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function setNested(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

// ------- HTML inline blocks -------
let htmlFilled = 0;
let htmlTouched = 0;
console.log('--- Phase 1: backfill inline i18n-data blocks ---');
for (const f of HTML_FILES) {
  const full = path.join(ROOT, f);
  if (!fs.existsSync(full)) continue;
  const html = fs.readFileSync(full, 'utf8');
  const re = /<script id="i18n-data"([^>]*)>([\s\S]*?)<\/script>/;
  const m = html.match(re);
  if (!m) continue;
  let dict;
  try { dict = JSON.parse(m[2]); }
  catch (e) {
    console.error('  [parse-error] ' + f + ' ' + e.message);
    continue;
  }
  if (!dict.en) continue;
  const enKeys = new Set(flatKeys(dict.en));
  let filled = 0;
  for (const lang of SUPPORTED) {
    if (lang === 'en') continue;
    const target = dict[lang] || (dict[lang] = {});
    const have = new Set(flatKeys(target));
    for (const k of enKeys) {
      if (have.has(k)) continue;
      const enVal = getNested(dict.en, k);
      if (typeof enVal === 'string') {
        setNested(target, k, enVal);
        filled++;
      }
    }
  }
  if (filled > 0) {
    const newJson = JSON.stringify(dict, null, 2);
    const newBlock = '<script id="i18n-data"' + m[1] + '>' + newJson + '</script>';
    // IMPORTANT: use function form to avoid $N backreference interpretation.
    const newHtml = html.replace(re, function () { return newBlock; });
    fs.writeFileSync(full, newHtml, 'utf8');
    htmlTouched++;
    htmlFilled += filled;
    console.log('  [fill] ' + f + ' +' + filled);
  }
}
console.log('HTML: ' + htmlTouched + ' pages touched, ' + htmlFilled + ' keys backfilled.\n');

// ------- Standalone i18n JSON files -------
// Aggregate the union of all inline en keys across the 12 pages, then
// ensure each language JSON contains every one of them with at least the
// English fallback. This is needed because some admin/utility scripts
// read /i18n/<lang>.json directly.
console.log('--- Phase 2: backfill standalone i18n/<lang>.json ---');
const unionEn = new Set();
for (const f of HTML_FILES) {
  const full = path.join(ROOT, f);
  if (!fs.existsSync(full)) continue;
  const html = fs.readFileSync(full, 'utf8');
  const m = html.match(/<script id="i18n-data"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) continue;
  try {
    const dict = JSON.parse(m[1]);
    if (dict.en) for (const k of flatKeys(dict.en)) unionEn.add(k);
  } catch {}
}
console.log('  union of en keys across all pages: ' + unionEn.size);

let jsonFilled = 0;
let jsonTouched = 0;
for (const lang of SUPPORTED) {
  const file = path.join(ROOT, 'i18n', lang + '.json');
  if (!fs.existsSync(file)) continue;
  let json;
  try { json = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { console.error('  [parse-error] ' + lang + '.json'); continue; }
  const have = new Set(flatKeys(json));
  let filled = 0;
  // We do not know en-values from the JSON layer here, so we read them
  // from the first HTML block that has them.
  const sampleHtml = (() => {
    for (const f of HTML_FILES) {
      const full = path.join(ROOT, f);
      if (!fs.existsSync(full)) continue;
      const html = fs.readFileSync(full, 'utf8');
      const m = html.match(/<script id="i18n-data"[^>]*>([\s\S]*?)<\/script>/);
      if (!m) continue;
      try { const d = JSON.parse(m[1]); if (d.en) return d; } catch {}
    }
    return null;
  })();
  for (const k of unionEn) {
    if (have.has(k)) continue;
    if (lang === 'en') continue;
    if (!sampleHtml) continue;
    const enVal = getNested(sampleHtml.en, k);
    if (typeof enVal === 'string') {
      setNested(json, k, enVal);
      filled++;
    }
  }
  if (filled > 0) {
    const out = JSON.stringify(json, null, 2) + '\n';
    fs.writeFileSync(file, out, 'utf8');
    jsonTouched++;
    jsonFilled += filled;
    console.log('  [fill] i18n/' + lang + '.json +' + filled);
  }
}
console.log('JSON: ' + jsonTouched + ' files touched, ' + jsonFilled + ' keys backfilled.\n');

console.log('Total backfilled: ' + (htmlFilled + jsonFilled) + ' keys.');
