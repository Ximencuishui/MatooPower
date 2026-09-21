#!/usr/bin/env node
/**
 * Matoo Power · Inject social.* keys into all i18n/*.json files
 *
 * Idempotent: skips files that already have footer.follow_us.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, 'i18n');

const TRANSLATIONS = {
  en: { follow_us: 'Follow Us', follow_facebook: 'Follow Matoo Power on Facebook', follow_wechat: 'WeChat official account', wechat_scan: 'Scan to add on WeChat', wechat_id: 'MatooPower' },
  zh: { follow_us: '关注我们', follow_facebook: '在 Facebook 关注 Matoo Power', follow_wechat: '微信公众号', wechat_scan: '扫码添加微信', wechat_id: 'MatooPower' },
  bn: { follow_us: 'আমাদের অনুসরণ করুন', follow_facebook: 'Facebook-এ Matoo Power অনুসরণ করুন', follow_wechat: 'WeChat অফিসিয়াল অ্যাকাউন্ট', wechat_scan: 'WeChat-এ যোগ করতে স্ক্যান করুন', wechat_id: 'MatooPower' },
  ja: { follow_us: 'フォローする', follow_facebook: 'Facebookで Matoo Power をフォロー', follow_wechat: 'WeChat 公式アカウント', wechat_scan: 'スキャンして WeChat で追加', wechat_id: 'MatooPower' },
  ko: { follow_us: '팔로우하기', follow_facebook: 'Facebook에서 Matoo Power 팔로우', follow_wechat: 'WeChat 공식 계정', wechat_scan: 'WeChat 추가를 위해 스캔', wechat_id: 'MatooPower' },
  vi: { follow_us: 'Theo dõi', follow_facebook: 'Theo dõi Matoo Power trên Facebook', follow_wechat: 'Tài khoản chính thức WeChat', wechat_scan: 'Quét để thêm trên WeChat', wechat_id: 'MatooPower' },
  hi: { follow_us: 'हमें फॉलो करें', follow_facebook: 'Facebook पर Matoo Power को फॉलो करें', follow_wechat: 'WeChat आधिकारिक खाता', wechat_scan: 'WeChat पर जोड़ने के लिए स्कैन करें', wechat_id: 'MatooPower' },
  ur: { follow_us: 'ہمیں فالو کریں', follow_facebook: 'Facebook پر Matoo Power کو فالو کریں', follow_wechat: 'WeChat سرکاری اکاؤنٹ', wechat_scan: 'WeChat پر شامل کرنے کے لیے اسکین کریں', wechat_id: 'MatooPower' },
  ta: { follow_us: 'எங்களைப் பின்தொடருங்கள்', follow_facebook: 'Facebook இல் Matoo Power-ஐப் பின்தொடருங்கள்', follow_wechat: 'WeChat அதிகாரப்பூர்வ கணக்கு', wechat_scan: 'WeChat இல் சேர்க்க ஸ்கேன் செய்க', wechat_id: 'MatooPower' },
  te: { follow_us: 'మమ్మల్ని అనుసరించండి', follow_facebook: 'Facebookలో Matoo Powerని అనుసరించండి', follow_wechat: 'WeChat అధికారిక ఖాతా', wechat_scan: 'WeChatలో జోడించడానికి స్కాన్ చేయండి', wechat_id: 'MatooPower' },
  ar: { follow_us: 'تابعنا', follow_facebook: 'تابع Matoo Power على Facebook', follow_wechat: 'حساب WeChat الرسمي', wechat_scan: 'امسح للإضافة على WeChat', wechat_id: 'MatooPower' },
  fr: { follow_us: 'Nous suivre', follow_facebook: 'Suivre Matoo Power sur Facebook', follow_wechat: 'Compte officiel WeChat', wechat_scan: 'Scannez pour ajouter sur WeChat', wechat_id: 'MatooPower' },
  pt: { follow_us: 'Siga-nos', follow_facebook: 'Siga Matoo Power no Facebook', follow_wechat: 'Conta oficial WeChat', wechat_scan: 'Escaneie para adicionar no WeChat', wechat_id: 'MatooPower' },
  es: { follow_us: 'Síguenos', follow_facebook: 'Sigue a Matoo Power en Facebook', follow_wechat: 'Cuenta oficial de WeChat', wechat_scan: 'Escanea para agregar en WeChat', wechat_id: 'MatooPower' },
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
  const raw = readJsonBOM(file);
  let json;
  try { json = JSON.parse(raw); }
  catch (e) { console.log('[err]  ' + lang + ': ' + e.message); continue; }

  if (!json.footer) json.footer = {};
  if (json.footer.follow_us) { console.log('[skip] ' + lang); skipped++; continue; }

  Object.assign(json.footer, tr);
  // Stable key order
  const ordered = {};
  for (const k of Object.keys(json.footer)) ordered[k] = json.footer[k];
  json.footer = ordered;

  writeJsonBOM(file, JSON.stringify(json, null, 2) + '\n');
  console.log('[ok]   ' + lang);
  total++;
}
console.log('');
console.log('Updated: ' + total + ' | Skipped: ' + skipped);
