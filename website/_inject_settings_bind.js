#!/usr/bin/env node
/**
 * Matoo Power · Add data-settings-bind hooks to footer contact items.
 *
 * Idempotent. Adds data-settings-bind="contact.email" etc. to known
 * footer <li> rows so SiteSettings.renderFooter() can find them.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

// Mapping: current i18n key → settings-bind target
const BINDS = [
  { i18n: 'body.index.salesmatoopower',   bind: 'contact.email' },
  { i18n: 'body.index.whatsapp_65_xxx',   bind: 'contact.whatsapp' },
  { i18n: 'body.index.singapore_shen',    bind: 'contact.hqLine' },
  // Per-page variants use body.<page>.* keys
];

// Footer's WhatsApp URL: <a href="https://wa.me/WHATSAPP_PLACEHOLDER">
// We don't tag the URL itself; the WhatsAppLinks rewriter already handles
// href rewrites via window.MATOO_SETTINGS promoted above.

// Facebook: already has data-platform="facebook"
const FB_RE = /(<a class="footer-social-icon" data-platform="facebook")(?![^>]*data-settings-bind)/;

// WeChat QR image + id
const WECHAT_IMG_RE = /(<img src="\/assets\/qr-wechat\.svg" alt="WeChat QR code")(?![^>]*data-settings-bind)/;
const WECHAT_ID_RE  = /(<span class="wechat-popover-id" data-i18n="footer\.wechat_id">)([^<]*)(<\/span>)/;

// Legal entity line at footer-bottom (some pages have data-i18n key with CJK name)
const LEGAL_RE = /(<span data-i18n="body\.index\.深圳华溢智能科技有限公司_rd"[^>]*>)([^<]*)(<\/span>)/;

function patch(html) {
  let next = html;
  let changes = 0;

  // Per-page i18n keys for sales / whatsapp / hq
  const perPage = [
    'products','technology','manufacturing','partnership','insights',
    'about','contact','privacy','cookies','terms','configurator',
    'index',
  ];
  for (const p of perPage) {
    for (const m of BINDS) {
      const key = m.i18n.replace('body.index.', 'body.' + p + '.');
      // Match <li data-i18n="..."> OR <li data-i18n="..." ...>
      const re = new RegExp('(<li\\s+data-i18n="' + key.replace(/\./g, '\\.') + '")(?![^>]*data-settings-bind)');
      if (re.test(next)) {
        next = next.replace(re, '$1 data-settings-bind="' + m.bind + '"');
        changes++;
      }
    }
  }

  // Facebook
  if (FB_RE.test(next) && !/data-settings-bind="social\.facebook"/.test(next)) {
    next = next.replace(FB_RE, '$1 data-settings-bind="social.facebook"');
    changes++;
  }

  // WeChat QR img
  if (WECHAT_IMG_RE.test(next) && !/data-settings-bind="contact\.wechatQrUrl"/.test(next)) {
    next = next.replace(WECHAT_IMG_RE, '$1 data-settings-bind="contact.wechatQrUrl"');
    changes++;
  }

  // WeChat id text: the data-i18n attr is already on the opening tag.
  // Add data-settings-bind into the opening tag itself.
  const WECHAT_ID_TAG_RE = /<span class="wechat-popover-id" data-i18n="footer\.wechat_id">/g;
  if (WECHAT_ID_TAG_RE.test(next) && !/data-settings-bind="contact\.wechatId"/.test(next)) {
    next = next.replace(WECHAT_ID_TAG_RE, '<span class="wechat-popover-id" data-i18n="footer.wechat_id" data-settings-bind="contact.wechatId">');
    changes++;
  }

  // Legal entity: replace the wrapping span with one that carries data-settings-bind.
  if (LEGAL_RE.test(next) && !/data-settings-bind="legalEntity\.full"/.test(next)) {
    next = next.replace(LEGAL_RE, '<span data-settings-bind="legalEntity.full">$2</span>');
    changes++;
  }

  return { html: next, changes };
}

let total = 0;
for (const f of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (!f.isFile() || !f.name.toLowerCase().endsWith('.html')) continue;
  const fp = path.join(ROOT, f.name);
  const before = fs.readFileSync(fp, 'utf8');
  const r = patch(before);
  if (r.changes > 0) {
    fs.writeFileSync(fp, r.html, 'utf8');
    console.log('[ok]   ' + f.name + ' (' + r.changes + ')');
    total += r.changes;
  } else {
    console.log('[skip] ' + f.name);
  }
}
console.log('');
console.log('Total edits: ' + total);
