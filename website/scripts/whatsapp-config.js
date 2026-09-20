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
 */
window.MATOO_WHATSAPP = {
  number: 'WHATSAPP_PLACEHOLDER',         // <-- Replace before deploy
  defaultMessage: 'Hi Matoo Power, I have an inquiry from your website.',
};
