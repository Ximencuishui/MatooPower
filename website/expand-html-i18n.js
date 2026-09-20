#!/usr/bin/env node
/**
 * Matoo Power · HTML hreflang & lang-switcher expander
 *
 * For every *.html under website/ (excluding admin/) that hasn't been
 * updated yet:
 *   - Replace the existing <link rel="alternate" hreflang=...> block
 *     with the full 14-language set (en, zh, bn, ja, ko, vi, hi, ur,
 *     ta, te, ar, fr, pt, es, x-default).
 *   - Replace the existing .lang-menu dropdown entries with the full
 *     14-language set, marked with aria-checked accordingly.
 *   - The <html lang="..."> attribute is left as-is; the front-end JS
 *     will swap it at runtime based on stored preference.
 *
 * Idempotent: re-running on already-updated files does nothing.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ur', label: 'اردو' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'ar', label: 'العربية' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
  { code: 'es', label: 'Español' },
];

function listHtml() {
  return fs.readdirSync(ROOT)
    .filter((f) => f.toLowerCase().endsWith('.html'))
    .map((f) => path.join(ROOT, f));
}

function buildHreflangBlock() {
  const lines = LANGS.map((l) => `  <link rel="alternate" hreflang="${l.code}" href="/${l.code}/">`);
  lines.push(`  <link rel="alternate" hreflang="x-default" href="/">`);
  return '<!-- hreflang -->\n' + lines.join('\n');
}

function buildLangMenuBlock() {
  const items = LANGS.map((l, i) =>
    `            <button role="menuitemradio" aria-checked="${i === 0 ? 'true' : 'false'}" data-lang="${l.code}">${l.label}</button>`
  ).join('\n');
  return `          <div class="lang-menu" role="menu">\n${items}\n          </div>`;
}

function expandHreflang(html) {
  // Match: optional `<!-- hreflang -->` comment followed by contiguous
  // <link rel="alternate" hreflang=...> lines + the x-default line.
  const re = /(?:<!-- hreflang -->\s*)?(?:[ \t]*<link rel="alternate" hreflang="[^"]+" href="[^"]*">\s*){1,}[ \t]*<link rel="alternate" hreflang="x-default"[^>]*>/;
  const m = html.match(re);
  if (!m) return null;
  return html.replace(re, buildHreflangBlock());
}

function injectHreflang(html) {
  // Inject the hreflang block just before the closing </head> when no
  // existing block can be replaced (e.g. configurator.html never had one).
  if (/hreflang=/.test(html)) return null;
  if (!/<\/head>/i.test(html)) return null;
  return html.replace(/([ \t]*)<\/head>/i, '\n' + buildHreflangBlock() + '\n$1</head>');
}

function expandLangMenu(html) {
  // Replace the existing <div class="lang-menu" role="menu">…</div> block
  const re = /<div class="lang-menu" role="menu">[\s\S]*?<\/div>/;
  if (!re.test(html)) return null;
  return html.replace(re, buildLangMenuBlock());
}

let updated = 0;
let skipped = 0;
for (const file of listHtml()) {
  const original = fs.readFileSync(file, 'utf8');
  let next = original;

  // hreflang — first try to replace the contiguous hreflang block;
  // if absent (e.g. configurator.html), inject one before </head>.
  const hrefLangHref = expandHreflang(next);
  if (hrefLangHref) next = hrefLangHref;
  const hrefLangInj = injectHreflang(next);
  if (hrefLangInj) next = hrefLangInj;

  // lang menu
  const menuReplaced = expandLangMenu(next);
  if (menuReplaced) next = menuReplaced;

  if (next !== original) {
    fs.writeFileSync(file, next, 'utf8');
    console.log('[ok]   ' + path.basename(file));
    updated++;
  } else {
    console.log('[skip] ' + path.basename(file));
    skipped++;
  }
}

console.log('');
console.log('Updated ' + updated + ' files, skipped ' + skipped + '.');