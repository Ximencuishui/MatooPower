#!/usr/bin/env node
/**
 * Matoo Power · Inject follow_linkedin/follow_twitter/follow_youtube/follow_instagram
 * i18n keys into all 14 languages. Idempotent.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const I18N_DIR = path.join(__dirname, 'i18n');

const TRANSLATIONS = {
  en: { follow_linkedin: 'Follow Matoo Power on LinkedIn', follow_twitter: 'Follow Matoo Power on Twitter / X', follow_youtube: 'Subscribe Matoo Power on YouTube', follow_instagram: 'Follow Matoo Power on Instagram' },
  zh: { follow_linkedin: '在 LinkedIn 关注 Matoo Power', follow_twitter: '在 Twitter / X 关注 Matoo Power', follow_youtube: '在 YouTube 订阅 Matoo Power', follow_instagram: '在 Instagram 关注 Matoo Power' },
  bn: { follow_linkedin: 'LinkedIn-এ Matoo Power অনুসরণ করুন', follow_twitter: 'Twitter / X-এ Matoo Power অনুসরণ করুন', follow_youtube: 'YouTube-এ Matoo Power সাবস্ক্রাইব করুন', follow_instagram: 'Instagram-এ Matoo Power অনুসরণ করুন' },
  ja: { follow_linkedin: 'LinkedIn で Matoo Power をフォロー', follow_twitter: 'Twitter / X で Matoo Power をフォロー', follow_youtube: 'YouTube で Matoo Power を購読', follow_instagram: 'Instagram で Matoo Power をフォロー' },
  ko: { follow_linkedin: 'LinkedIn에서 Matoo Power 팔로우', follow_twitter: 'Twitter / X에서 Matoo Power 팔로우', follow_youtube: 'YouTube에서 Matoo Power 구독', follow_instagram: 'Instagram에서 Matoo Power 팔로우' },
  vi: { follow_linkedin: 'Theo dõi Matoo Power trên LinkedIn', follow_twitter: 'Theo dõi Matoo Power trên Twitter / X', follow_youtube: 'Đăng ký Matoo Power trên YouTube', follow_instagram: 'Theo dõi Matoo Power trên Instagram' },
  hi: { follow_linkedin: 'LinkedIn पर Matoo Power को फॉलो करें', follow_twitter: 'Twitter / X पर Matoo Power को फॉलो करें', follow_youtube: 'YouTube पर Matoo Power सब्सक्राइब करें', follow_instagram: 'Instagram पर Matoo Power को फॉलो करें' },
  ur: { follow_linkedin: 'LinkedIn پر Matoo Power کو فالو کریں', follow_twitter: 'Twitter / X پر Matoo Power کو فالو کریں', follow_youtube: 'YouTube پر Matoo Power سبسکرائب کریں', follow_instagram: 'Instagram پر Matoo Power کو فالو کریں' },
  ta: { follow_linkedin: 'LinkedIn இல் Matoo Power-ஐப் பின்தொடருங்கள்', follow_twitter: 'Twitter / X இல் Matoo Power-ஐப் பின்தொடருங்கள்', follow_youtube: 'YouTube இல் Matoo Power-ஐ சந்தா செய்க', follow_instagram: 'Instagram இல் Matoo Power-ஐப் பின்தொடருங்கள்' },
  te: { follow_linkedin: 'LinkedInలో Matoo Powerని అనుసరించండి', follow_twitter: 'Twitter / Xలో Matoo Powerని అనుసరించండి', follow_youtube: 'YouTubeలో Matoo Powerని సబ్‌స్క్రయిబ్ చేయండి', follow_instagram: 'Instagramలో Matoo Powerని అనుసరించండి' },
  ar: { follow_linkedin: 'تابع Matoo Power على LinkedIn', follow_twitter: 'تابع Matoo Power على Twitter / X', follow_youtube: 'اشترك في Matoo Power على YouTube', follow_instagram: 'تابع Matoo Power على Instagram' },
  fr: { follow_linkedin: 'Suivre Matoo Power sur LinkedIn', follow_twitter: 'Suivre Matoo Power sur Twitter / X', follow_youtube: 'S\'abonner à Matoo Power sur YouTube', follow_instagram: 'Suivre Matoo Power sur Instagram' },
  pt: { follow_linkedin: 'Siga Matoo Power no LinkedIn', follow_twitter: 'Siga Matoo Power no Twitter / X', follow_youtube: 'Inscreva-se no Matoo Power no YouTube', follow_instagram: 'Siga Matoo Power no Instagram' },
  es: { follow_linkedin: 'Sigue a Matoo Power en LinkedIn', follow_twitter: 'Sigue a Matoo Power en Twitter / X', follow_youtube: 'Suscríbete a Matoo Power en YouTube', follow_instagram: 'Sigue a Matoo Power en Instagram' },
};

function readJsonBOM(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
}
function writeJsonBOM(file, content) {
  fs.writeFileSync(file, '\ufeff' + content, 'utf8');
}

let total = 0, skipped = 0;
for (const [lang, tr] of Object.entries(TRANSLATIONS)) {
  const file = path.join(I18N_DIR, lang + '.json');
  if (!fs.existsSync(file)) { console.log('[miss] ' + lang); continue; }
  let json;
  try { json = JSON.parse(readJsonBOM(file)); }
  catch (e) { console.log('[err]  ' + lang + ': ' + e.message); continue; }

  if (!json.footer) json.footer = {};
  if (json.footer.follow_linkedin) { console.log('[skip] ' + lang); skipped++; continue; }

  Object.assign(json.footer, tr);
  // Stable key order: append at end of footer block
  const ordered = {};
  for (const k of Object.keys(json.footer)) ordered[k] = json.footer[k];
  json.footer = ordered;

  writeJsonBOM(file, JSON.stringify(json, null, 2) + '\n');
  console.log('[ok]   ' + lang);
  total++;
}
console.log('');
console.log('Updated: ' + total + ' | Skipped: ' + skipped);
