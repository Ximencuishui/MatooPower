// Urdu (ur) — demo placeholder
// 演示占位:仅基础 UI 字符串翻译,关键业务文案复用 en(通过 ...en 继承)
// 生产期由专业译员填充完整字典
// 注意:ur 是 RTL 语言,CSS 端需配 dir="rtl" 镜像(已在 i18n.tsx 处理)

import { en } from './en';

export const ur = {
  ...en, // fallback:未翻译字段全部继承 en
  app: {
    name: 'Matoo Power',
    tagline: 'پروڈکٹ لائف سائیکل سروس اور پرزہ مارکیٹ',
  },
  tabs: { home: 'گھر', devices: 'آلات', shop: 'پرزے', profile: 'میں', messages: 'پیغامات' },
  common: {
    ...en.common,
    back: 'واپس',
    cancel: 'منسوخ',
    save: 'محفوظ',
    lang: 'زبان',
    networkErr: 'نیٹ ورک خرابی',
    loading: 'لوڈ ہو رہا ہے…',
    retry: 'دوبارہ کوشش',
    goLogin: 'سائن ان',
    logout: 'سائن آؤٹ',
  },
  scanEntry: {
    title: 'سکین',
    demoTip: 'پروٹوٹائپ: سکین کی نقل کے لیے نیچے کے بٹن استعمال کریں',
    sectionNormal: 'عام بہاؤ',
    demoUnactivated: 'غیر فعال SKU (مکمل فعال)',
    demoActivated: 'فعال SKU (وارنٹی کارڈ)',
    sectionFail: 'ناکام بہاؤ',
    demoFake: 'جعلی کوڈ',
    demoRevoked: 'منسوخ بیچ',
    demoNetwork: 'نیٹ ورک خرابی',
    sectionExtra: 'اضافی بہاؤ',
    demoCompare: 'آلات کا موازنہ (متعدد SKU)',
    demoDealer: 'ڈیلر بلیک ایکٹیویشن',
  },
  home: {
    ...en.home,
    welcome: 'Matoo Power میں خوش آمدید',
    welcomeDesc: 'سکین کرکے تصدیق کریں، وارنٹی فعال کریں، آلہ باندھیں، پرزے خریدیں',
    scanBtn: 'QR سکین',
    myDevices: 'میرے آلات',
    viewAll: 'سب دیکھیں ›',
    services: 'خدمات',
    sManual: 'ہدایت نامہ',
    sVideo: 'انسٹال ویڈیو',
    sWarranty: 'وارنٹی فعال',
    sSupport: 'مدد',
    sShop: 'پرزوں کی دکان',
    sBind: 'آلہ باندھیں',
    sCompare: 'موازنہ',
    footer: 'ڈیمو پروٹوٹائپ · آزاد پروڈکٹ · app.matoopower.com',
  },
  auth: {
    ...en.auth,
    demoNote: 'ڈیمو: OTP API ٹرمینل لاگ میں دیکھا جا سکتا ہے۔',
    codeSentHint: 'کوڈ بن گیا (ڈیمو موڈ میں API ٹرمینل دیکھیں)',
  },
  onboarding: {
    ...en.onboarding,
    step1Title: 'QR سکین کریں',
    step1Desc: 'پروڈکٹ کا QR سکین کرکے تصدیق اور تفصیلات دیکھیں۔',
    step2Title: 'وارنٹی فعال کریں',
    step2Desc: 'خریداری کی معلومات اور انوائس بھرکر ای-وارنٹی کارڈ فعال کریں۔',
    step3Title: 'سروس سے لطف اٹھائیں',
    step3Desc: 'سمارٹ ماڈیول باندھ کر صحت ڈیش بورڈ دیکھیں۔',
    next: 'اگلا',
    start: 'شروع کریں',
    skip: 'چھوڑیں',
  },
} as any;
