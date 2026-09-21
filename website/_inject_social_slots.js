#!/usr/bin/env node
/**
 * Matoo Power · Inject 4 extra social icon slots (LinkedIn, Twitter, YouTube, Instagram)
 * into the footer-social-row of every HTML page.
 *
 * Each slot is rendered with display:none by default — SiteSettings.renderFooter()
 * in main.js shows them only when the corresponding settings.social.* URL is set.
 *
 * Idempotent: skips if any of the 4 markers is already present.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

const SLOTS = [
  {
    platform: 'linkedin',
    icon: 'icon-linkedin.svg',
    labelKey: 'footer.follow_linkedin',
    color: '#0A66C2',
  },
  {
    platform: 'twitter',
    icon: 'icon-twitter.svg',
    labelKey: 'footer.follow_twitter',
    color: '#000000',
  },
  {
    platform: 'youtube',
    icon: 'icon-youtube.svg',
    labelKey: 'footer.follow_youtube',
    color: '#FF0000',
  },
  {
    platform: 'instagram',
    icon: 'icon-instagram.svg',
    labelKey: 'footer.follow_instagram',
    color: '#E1306C',
  },
];

const MARKER = 'data-platform="linkedin"'; // first new slot, use as sentinel

function buildSlotsHtml() {
  return SLOTS.map((s) => {
    return [
      '              <!-- ' + s.platform + ' (controlled by settings.social.' + s.platform + ') -->',
      '              <a class="footer-social-icon" data-platform="' + s.platform + '" data-settings-bind="social.' + s.platform + '"',
      '                 href="#" target="_blank" rel="noopener"',
      '                 style="display:none;"',
      '                 data-i18n-aria-label="' + s.labelKey + '"',
      '                 aria-label="' + s.platform + '">',
      '                <img src="/assets/' + s.icon + '" alt="" width="20" height="20" loading="lazy">',
      '              </a>',
    ].join('\n');
  }).join('\n');
}

function patch(html) {
  if (html.indexOf(MARKER) !== -1) return { html, changes: 0 };
  // Insert after the </span> that closes the WeChat trigger.
  const re = /(              <\/span>\n            <\/div>\n          <\/div>\n        <\/div>\n)/;
  if (!re.test(html)) return { html, changes: 0 };
  const block = buildSlotsHtml() + '\n';
  const next = html.replace(re, block + '$1');
  return { html: next, changes: 1 };
}

let total = 0;
for (const f of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (!f.isFile() || !f.name.toLowerCase().endsWith('.html')) continue;
  const fp = path.join(ROOT, f.name);
  const before = fs.readFileSync(fp, 'utf8');
  const r = patch(before);
  if (r.changes > 0) {
    fs.writeFileSync(fp, r.html, 'utf8');
    console.log('[ok]   ' + f.name);
    total++;
  } else {
    console.log('[skip] ' + f.name);
  }
}
console.log('');
console.log('Injected: ' + total);
