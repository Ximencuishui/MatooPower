#!/usr/bin/env node
/**
 * Matoo Power · Remove legacy insights.newsletter_sub orphan
 *
 * After the HTML was updated to bind insights.section2_sub instead,
 * newsletter_sub is no longer used by any page. Remove the residual
 * entries from any language files that still carry it.
 *
 * Idempotent.
 */
'use strict';

const { forEachLang } = require('./_lib/i18n-file');

const KEY = 'insights.newsletter_sub';
let total = 0;

forEachLang(({ lang, json }) => {
  if (!json.insights || typeof json.insights.newsletter_sub !== 'string') return;
  delete json.insights.newsletter_sub;
  total++;
  console.log('[ok]   ' + lang);
});

console.log('');
console.log('Removed ' + KEY + ' from ' + total + ' files.');