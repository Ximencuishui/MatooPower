// Matoo Power · i18n Audit v2
// More precise: distinguishes legitimate </tag> from malformed /tag>

const fs = require('fs');
const path = require('path');

const websiteDir = __dirname;
const htmlFiles = fs.readdirSync(websiteDir)
  .filter(f => f.endsWith('.html'))
  .map(f => path.join(websiteDir, f));

const i18nDir = path.join(websiteDir, 'i18n');
const jsonFiles = fs.readdirSync(i18nDir)
  .filter(f => f.endsWith('.json'))
  .map(f => path.join(i18nDir, f));

const lines = [];
const log = (s) => lines.push(s);

// ============================================================================
// 1. HTML TAG INTEGRITY (precise check)
// ============================================================================
log('==========================================================');
log(' 1. HTML TAG INTEGRITY (precise: malformed /tag> vs valid </tag>)');
log('==========================================================');

// Find "/tag>" that is NOT preceded by "<" — i.e., the closing slash
// has no opening angle bracket. This catches the original bug.
const malformedCloseRegex = /(?<![<a-zA-Z\/!])\/(div|span|a|p|h[1-6]|section|article|nav|header|footer|main|aside|ul|ol|li|table|tr|td|th|form|label|button|figure|figcaption|details|summary)(?=[^a-zA-Z])/g;

let badCount = 0;
for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  const linesInFile = content.split(/\r?\n/);
  for (let i = 0; i < linesInFile.length; i++) {
    const line = linesInFile[i];
    let m;
    const re = new RegExp(malformedCloseRegex.source, 'g');
    while ((m = re.exec(line)) !== null) {
      const start = Math.max(0, m.index - 20);
      const end = Math.min(line.length, m.index + m[0].length + 20);
      log(`  MALFORMED CLOSE  ${path.basename(file)}:${(i+1).toString().padStart(4)}  ${m[0]}  |  ...${line.slice(start, end)}...`);
      badCount++;
    }
  }
}
if (badCount === 0) log('  (no malformed closing tags found)');
log('');

// Also check for literal "<" characters in text content (inside script/i18n blocks)
// These are not necessarily bugs but flag for review.
log('  Note: literal "<" inside <script id="i18n-data"> JSON is expected (escaped).');
log('');

// ============================================================================
// 2. EXTRACT data-i18n REFERENCES
// ============================================================================
log('==========================================================');
log(' 2. EXTRACT data-i18n REFERENCES FROM HTML');
log('==========================================================');

const allRefs = new Set();
const perFileRefs = {};

for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  const matches = [...content.matchAll(/data-i18n="([^"]+)"/g)];
  const keys = [...new Set(matches.map(m => m[1]))].sort();
  perFileRefs[path.basename(file)] = keys;
  for (const k of keys) allRefs.add(k);
  log(`  ${path.basename(file).padEnd(28)} ${String(keys.length).padStart(4)} unique keys`);
}

log('');
log(`  TOTAL unique i18n keys referenced by HTML: ${allRefs.size}`);
log('');

// ============================================================================
// 3. PER-LANGUAGE JSON COVERAGE (key counts)
// ============================================================================
log('==========================================================');
log(' 3. PER-LANGUAGE JSON KEY COUNTS');
log('==========================================================');

function flatten(obj, prefix = '') {
  const out = [];
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        out.push(...flatten(v, key));
      } else {
        out.push(key);
      }
    }
  }
  return out;
}

const jsonKeys = {};
for (const jf of jsonFiles) {
  const code = path.basename(jf, '.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(jf, 'utf-8'));
    jsonKeys[code] = [...new Set(flatten(parsed))].sort();
  } catch (e) {
    log(`  ERROR parsing ${path.basename(jf)}: ${e.message}`);
    jsonKeys[code] = [];
  }
}

const enSet = new Set(jsonKeys['en']);
for (const code of Object.keys(jsonKeys).sort()) {
  const lang = jsonKeys[code];
  const langSet = new Set(lang);
  const missingFromEn = jsonKeys['en'].filter(k => !langSet.has(k));
  const extraVsEn = lang.filter(k => !enSet.has(k));
  log(`  ${code.padEnd(8)} has ${String(lang.length).padStart(3)} keys | missing-from-en ${String(missingFromEn.length).padStart(3)} | extra-vs-en ${String(extraVsEn.length).padStart(3)}`);
}
log('');

// ============================================================================
// 4. KEYS REFERENCED IN HTML BUT MISSING FROM JSON(en)  -- SHOULD BE 0
// ============================================================================
log('==========================================================');
log(' 4. KEYS REFERENCED IN HTML BUT MISSING FROM JSON(en)');
log('==========================================================');
const htmlRefsSorted = [...allRefs].sort();
const missingInEn = htmlRefsSorted.filter(k => !enSet.has(k));
if (missingInEn.length === 0) {
  log('  (none — every HTML-referenced key exists in en.json)');
} else {
  for (const k of missingInEn) log(`  MISSING in en: ${k}`);
}
log('');

// ============================================================================
// 5. ORPHAN KEYS PER LANGUAGE (JSON has but HTML never uses)
// ============================================================================
log('==========================================================');
log(' 5. ORPHAN KEYS PER LANGUAGE (in JSON, never referenced by HTML)');
log('==========================================================');
for (const code of Object.keys(jsonKeys).sort()) {
  const orphans = jsonKeys[code].filter(k => !allRefs.has(k));
  log(`  ${code.padEnd(8)} orphan: ${String(orphans.length).padStart(3)}  (${orphans.slice(0, 6).join(', ')}${orphans.length > 6 ? ', ...' : ''})`);
}
log('');

// ============================================================================
// 6. PER-LANGUAGE MISSING KEYS (keys HTML uses, that lang is missing)
// ============================================================================
log('==========================================================');
log(' 6. PER-LANGUAGE: HTML-USED KEYS MISSING IN EACH LANG');
log('==========================================================');
for (const code of Object.keys(jsonKeys).sort()) {
  if (code === 'en') continue;
  const langSet = new Set(jsonKeys[code]);
  const missing = htmlRefsSorted.filter(k => !langSet.has(k));
  log(`  ${code.padEnd(8)} ${String(missing.length).padStart(3)} missing  (${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ` ... (+${missing.length - 8})` : ''})`);
}
log('');

// ============================================================================
// 7. SUSPICIOUS KEY NAMES
// ============================================================================
log('==========================================================');
log(' 7. SUSPICIOUS KEY NAMES (truncated / hash-suffix / non-ASCII)');
log('==========================================================');
const suspiciousPatterns = [
  { name: 'hash-suffix', regex: /_[a-z0-9]{5,}$/ },
  { name: 'chinese-in-key', regex: /[\u4e00-\u9fff]/ },
  { name: 'trailing-underscore-number', regex: /_[0-9]+$/ },
];
const suspiciousFound = new Set();
for (const k of htmlRefsSorted) {
  for (const sp of suspiciousPatterns) {
    if (sp.regex.test(k)) {
      suspiciousFound.add(`  ${sp.name.padEnd(28)} ${k}`);
      break;
    }
  }
}
if (suspiciousFound.size === 0) {
  log('  (none)');
} else {
  for (const s of [...suspiciousFound].sort()) log(s);
}
log('');

const report = lines.join('\n');
fs.writeFileSync(path.join(websiteDir, '.audit_full.out'), report);
console.log(report);
