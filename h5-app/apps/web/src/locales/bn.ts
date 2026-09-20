// Bengali (bn) — demo placeholder
// 演示占位:仅基础 UI 字符串翻译,关键业务文案复用 en(通过下方 ...en 继承)
// 生产期由专业译员填充完整字典

import { en } from './en';

export const bn = {
  ...en, // fallback:未翻译字段全部继承 en
  app: {
    name: 'Matoo Power',
    tagline: 'পণ্যের জীবনচক্র সেবা ও যন্ত্রাংশ প্ল্যাটফর্ম',
  },
  tabs: { home: 'হোম', devices: 'ডিভাইস', shop: 'যন্ত্রাংশ', profile: 'আমি', messages: 'বার্তা' },
  common: {
    ...en.common,
    back: 'ফিরে যান',
    cancel: 'বাতিল',
    save: 'সংরক্ষণ',
    lang: 'ভাষা',
    networkErr: 'নেটওয়ার্ক ত্রুটি',
    loading: 'লোড হচ্ছে…',
    retry: 'আবার চেষ্টা',
    goLogin: 'সাইন ইন',
    logout: 'সাইন আউট',
  },
  scanEntry: {
    title: 'স্ক্যান',
    demoTip: 'প্রোটোটাইপ: নিচের বোতাম ব্যবহার করে স্ক্যান সিমুলেট করুন',
    sectionNormal: 'স্বাভাবিক প্রবাহ',
    demoUnactivated: 'অ্যাক্টিভেটেড নয় এমন SKU (সম্পূর্ণ সক্রিয়করণ)',
    demoActivated: 'সক্রিয় SKU (ওয়ারেন্টি কার্ড)',
    sectionFail: 'ব্যর্থ প্রবাহ',
    demoFake: 'নকল কোড',
    demoRevoked: 'প্রত্যাহার করা ব্যাচ',
    demoNetwork: 'নেটওয়ার্ক ত্রুটি',
    sectionExtra: 'অতিরিক্ত প্রবাহ',
    demoCompare: 'ডিভাইস তুলনা (একাধিক SKU)',
    demoDealer: 'ডিলার বাল্ক সক্রিয়করণ',
  },
  home: {
    ...en.home,
    welcome: 'Matoo Power-এ স্বাগতম',
    welcomeDesc: 'স্ক্যান করে যাচাই, ওয়ারেন্টি সক্রিয়, ডিভাইস বাঁধুন, যন্ত্রাংশ কিনুন',
    scanBtn: 'QR স্ক্যান',
    myDevices: 'আমার ডিভাইস',
    viewAll: 'সব দেখুন ›',
    services: 'পরিষেবা',
    sManual: 'ব্যবহার নির্দেশিকা',
    sVideo: 'ইনস্টল ভিডিও',
    sWarranty: 'ওয়ারেন্টি সক্রিয়',
    sSupport: 'সহায়তা',
    sShop: 'যন্ত্রাংশের দোকান',
    sBind: 'ডিভাইস বাঁধুন',
    sCompare: 'তুলনা',
    footer: 'ডেমো প্রোটোটাইপ · স্বতন্ত্র পণ্য · app.matoopower.com',
  },
  auth: {
    ...en.auth,
    demoNote: 'ডেমো: OTP API টার্মিনাল লগে দেখা যাবে।',
    codeSentHint: 'কোড তৈরি হয়েছে (ডেমো মোডে API টার্মিনাল দেখুন)',
  },
  onboarding: {
    ...en.onboarding,
    step1Title: 'QR স্ক্যান করুন',
    step1Desc: 'পণ্যের QR কোড স্ক্যান করে সত্যতা যাচাই ও স্পেস দেখুন।',
    step2Title: 'ওয়ারেন্টি সক্রিয়',
    step2Desc: 'ক্রয় তথ্য ও ইনভয়েস পূরণ করে ই-ওয়ারেন্টি কার্ড সক্রিয় করুন।',
    step3Title: 'পরিষেবা উপভোগ',
    step3Desc: 'স্মার্ট মডিউল বেঁধে স্বাস্থ্য ড্যাশবোর্ড দেখুন।',
    next: 'পরবর্তী',
    start: 'শুরু করুন',
    skip: 'এড়িয়ে যান',
  },
} as any;
