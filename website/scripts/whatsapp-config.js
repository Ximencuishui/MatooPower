/**
 * Matoo Power · WhatsApp Configuration
 * Single source of truth for the sales WhatsApp number.
 *
 * BEFORE DEPLOY: replace WHATSAPP_PLACEHOLDER below with the real number
 * in international format (digits only, with country code, no '+').
 *
 * Example: '6591234567'  (Singapore +65 9123 4567)
 *
 * The IIFE in main.js will rewrite all wa.me/WHATSAPP_PLACEHOLDER links
 * with this number on page load.
 *
 * NOTE: This file is read by scripts/main.js at IIFE init. It must remain
 * a synchronous script (NOT deferred) so window.MATOO_WHATSAPP is available
 * before main.js executes.
 */
(function () {
  'use strict';

  // Production number configured via deployment secret.
  // Falls back to placeholder if env var / build-time injection is unavailable.
  // CI pipeline should overwrite this line:
  //   sed -i "s/'WHATSAPP_PLACEHOLDER'/'<REAL_NUMBER>'/" scripts/whatsapp-config.js
  var number = (typeof process !== 'undefined' && process && process.env && process.env.MATOO_WHATSAPP_NUMBER)
    ? process.env.MATOO_WHATSAPP_NUMBER
    : 'WHATSAPP_PLACEHOLDER';

  window.MATOO_WHATSAPP = {
    number: number,
    defaultMessage: 'Hi Matoo Power, I have an inquiry from your website.',
    // P0 fix: hard-disable placeholder wa.me links in non-localhost
    // environments instead of leaving them as href="#". The rewriter
    // will set aria-disabled + pointer-events:none on the affected <a>.
    disabledInProd: true,
  };
})();
