#!/usr/bin/env node
/**
 * Rollback bad data-settings-bind injection that put attributes after `>`.
 * Safe to run multiple times.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

const RE_LI  = /(<li\s+data-i18n="[^"]+")>\s*data-settings-bind="[^"]+"/g;
const RE_WID = /(<span class="wechat-popover-id" data-i18n="footer\.wechat_id">)\s*data-settings-bind="contact\.wechatId"(<\/span>)/g;

let total = 0;
for (const f of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (!f.isFile() || !f.name.toLowerCase().endsWith('.html')) continue;
  const fp = path.join(ROOT, f.name);
  const before = fs.readFileSync(fp, 'utf8');
  let h = before;
  h = h.replace(RE_LI, '$1>');
  h = h.replace(RE_WID, '$1$2');
  if (h !== before) {
    fs.writeFileSync(fp, h, 'utf8');
    console.log('[undo] ' + f.name);
    total++;
  } else {
    console.log('[skip] ' + f.name);
  }
}
console.log('');
console.log('Fixed: ' + total);
