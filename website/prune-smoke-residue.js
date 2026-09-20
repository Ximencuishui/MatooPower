#!/usr/bin/env node
/**
 * Matoo Power · Clean __smoke_test__ residue
 *
 * The smoke-admin.js probe writes a __smoke_test__ key into one of the
 * language files. Although the probe tries to clear it with an empty
 * string, the server keeps it (string keys can be empty but not removed).
 *
 * This script removes it on demand from every language file that has it.
 */
'use strict';

const { forEachLang } = require('./_lib/i18n-file');

const KEY = '__smoke_test__';
let total = 0;

forEachLang(({ lang, json }) => {
  if (typeof json[KEY] !== 'string') return;
  delete json[KEY];
  total++;
  console.log('[ok]   ' + lang);
});

console.log('');
console.log('Removed ' + KEY + ' from ' + total + ' files.');