#!/usr/bin/env node
/**
 * Matoo Power · Inject Social block into Footer
 *
 * Adds a new "Follow Us / Connect" footer column (between Company and Contact)
 * with Facebook icon-link and WeChat icon-trigger that opens a QR popover.
 *
 * Safe to re-run: checks for existing 'data-social-injected' marker and skips.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SOCIAL_MARKER = 'data-social-injected="true"';
const MARKER_COMMENT = '<!-- social-injected -->';

// Two target patterns:
//   1) Full 4-col footer with Company column -> insert before Contact column
//   2) Footer without Company column -> insert before Contact column anyway
const SOCIAL_BLOCK = [
  '        <div class="footer-col" data-social-injected="true">',
  '          <h4 data-i18n="footer.follow_us">Follow Us</h4>',
  '          <div class="footer-social">',
  '            <div class="footer-social-row">',
  '              <!-- Facebook -->',
  '              <a class="footer-social-icon" data-platform="facebook"',
  '                 href="https://www.facebook.com/MatooPower"',
  '                 target="_blank" rel="noopener"',
  '                 data-i18n-aria-label="footer.follow_facebook"',
  '                 aria-label="Follow Matoo Power on Facebook">',
  '                <img src="/assets/icon-facebook.svg" alt="" width="20" height="20" loading="lazy">',
  '              </a>',
  '              <!-- WeChat trigger (opens QR popover on hover/focus/click) -->',
  '              <span class="wechat-trigger">',
  '                <button type="button" class="footer-social-icon" data-platform="wechat"',
  '                        data-wechat-toggle aria-haspopup="dialog" aria-expanded="false"',
  '                        data-i18n-aria-label="footer.follow_wechat"',
  '                        aria-label="WeChat official account">',
  '                  <img src="/assets/icon-wechat.svg" alt="" width="20" height="20" loading="lazy">',
  '                </button>',
  '                <span class="wechat-popover" role="dialog" aria-modal="false" aria-label="WeChat QR code">',
  '                  <img src="/assets/qr-wechat.svg" alt="WeChat QR code" width="160" height="160" loading="lazy">',
  '                  <span class="wechat-popover-label" data-i18n="footer.wechat_scan">Scan to add on WeChat</span>',
  '                  <span class="wechat-popover-id" data-i18n="footer.wechat_id">MatooPower</span>',
  '                </span>',
  '              </span>',
  '            </div>',
  '          </div>',
  '        </div>',
  '',
].join('\n');

// Match the start of the Contact footer column (with optional preceding whitespace)
// and insert the social block right before it.
const CONTACT_COL_RE = /(\s*)(<div class="footer-col">\s*<h4 data-i18n="footer\.contact">Contact<\/h4>)/;

function listHtml() {
  const out = [];
  for (const f of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (f.isFile() && f.name.toLowerCase().endsWith('.html')) out.push(path.join(ROOT, f.name));
  }
  return out;
}

let total = 0;
let skipped = 0;
let noMatch = 0;
for (const f of listHtml()) {
  const html = fs.readFileSync(f, 'utf8');

  if (html.indexOf(SOCIAL_MARKER) !== -1) {
    console.log('[skip] ' + path.basename(f) + ' (already injected)');
    skipped++;
    continue;
  }

  const m = html.match(CONTACT_COL_RE);
  if (!m) {
    console.log('[warn] ' + path.basename(f) + ' (no Contact column found)');
    noMatch++;
    continue;
  }

  const next = html.replace(CONTACT_COL_RE, '\n' + MARKER_COMMENT + '\n' + SOCIAL_BLOCK + m[2]);
  if (next === html) {
    console.log('[skip] ' + path.basename(f) + ' (no change)');
    skipped++;
    continue;
  }
  fs.writeFileSync(f, next, 'utf8');
  console.log('[ok]   ' + path.basename(f));
  total++;
}
console.log('');
console.log('Injected: ' + total + ' | Skipped: ' + skipped + ' | No match: ' + noMatch);
