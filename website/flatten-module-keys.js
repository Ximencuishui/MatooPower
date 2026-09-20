#!/usr/bin/env node
/**
 * Matoo Power · Flatten module keys (modules.mod1 → mod1 etc.)
 *
 * In en.json the modules section is nested as `modules.mod1.title`
 * but index.html binds `data-i18n="mod1.title"`. Lift those nine keys
 * to the top level in all 14 language files so the flat lookup works.
 *
 * Idempotent: if the flat key already exists, the nested value wins.
 */
'use strict';

const { forEachLang } = require('./_lib/i18n-file');

const MODULE_KEYS = ['title', 'desc', 'cta'];

let totalTouched = 0;

forEachLang(({ lang, json }) => {
  const modules = json.modules || {};
  let modified = false;
  for (let i = 1; i <= 3; i++) {
    const mod = modules['mod' + i];
    if (!mod) continue;
    for (const sub of MODULE_KEYS) {
      if (typeof mod[sub] !== 'string') continue;
      const flatKey = 'mod' + i + '.' + sub;
      if (json[flatKey] !== mod[sub]) {
        json[flatKey] = mod[sub];
        modified = true;
      }
    }
  }
  if (modified) {
    totalTouched++;
    console.log('[ok]   ' + lang);
  }
});

console.log('');
console.log('Flattened ' + totalTouched + ' files.');