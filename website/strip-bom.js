#!/usr/bin/env node
/**
 * Matoo Power · Strip UTF-8 BOM from all i18n JSON files
 *
 * Some skeleton generators and PowerShell writers accidentally emit a
 * UTF-8 BOM at the start of JSON files. Node's JSON.parse rejects the
 * BOM, so the admin API can fail to read them. Strip in place.
 *
 * Idempotent.
 */
'use strict';

const fs = require('fs');
const { SUPPORTED_LANGS, fileFor } = require('./_lib/i18n-file');

let touched = 0;
for (const lang of SUPPORTED_LANGS) {
  const file = fileFor(lang);
  if (!fs.existsSync(file)) continue;
  const buf = fs.readFileSync(file);
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    fs.writeFileSync(file, buf.slice(3));
    touched++;
    console.log('[ok]   ' + lang);
  } else {
    console.log('[skip] ' + lang);
  }
}
console.log('');
console.log('Stripped BOM from ' + touched + ' files.');