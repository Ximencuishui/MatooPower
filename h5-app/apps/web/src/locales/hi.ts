// Hindi (hi) — demo placeholder
// 演示占位:仅基础 UI 字符串翻译,关键业务文案复用 en(通过 ...en 继承)
// 生产期由专业译员填充完整字典

import { en } from './en';

export const hi = {
  ...en, // fallback:未翻译字段全部继承 en
  app: {
    name: 'Matoo Power',
    tagline: 'उत्पाद जीवनचक्र सेवा और पुर्ज़े मंच',
  },
  tabs: { home: 'होम', devices: 'डिवाइस', shop: 'पुर्ज़े', profile: 'मैं', messages: 'संदेश' },
  common: {
    ...en.common,
    back: 'वापस',
    cancel: 'रद्द',
    save: 'सहेजें',
    lang: 'भाषा',
    networkErr: 'नेटवर्क त्रुटि',
    loading: 'लोड हो रहा है…',
    retry: 'पुनः प्रयास',
    goLogin: 'साइन इन',
    logout: 'साइन आउट',
  },
  scanEntry: {
    title: 'स्कैन',
    demoTip: 'प्रोटोटाइप: स्कैन सिम्युलेट करने के लिए नीचे के बटन का उपयोग करें',
    sectionNormal: 'सामान्य प्रवाह',
    demoUnactivated: 'सक्रिय नहीं SKU (पूर्ण सक्रियकरण)',
    demoActivated: 'सक्रिय SKU (वारंटी कार्ड)',
    sectionFail: 'विफलता प्रवाह',
    demoFake: 'नकली कोड',
    demoRevoked: 'प्रतिसंहृत बैच',
    demoNetwork: 'नेटवर्क त्रुटि',
    sectionExtra: 'अतिरिक्त प्रवाह',
    demoCompare: 'डिवाइस तुलना (कई SKU)',
    demoDealer: 'डीलर बैच सक्रियकरण',
  },
  home: {
    ...en.home,
    welcome: 'Matoo Power में आपका स्वागत है',
    welcomeDesc: 'स्कैन करके सत्यापित करें, वारंटी सक्रिय करें, डिवाइस बाँधें, पुर्ज़े खरीदें',
    scanBtn: 'QR स्कैन',
    myDevices: 'मेरे डिवाइस',
    viewAll: 'सभी देखें ›',
    services: 'सेवाएँ',
    sManual: 'उपयोग निर्देशिका',
    sVideo: 'इंस्टॉल वीडियो',
    sWarranty: 'वारंटी सक्रिय',
    sSupport: 'सहायता',
    sShop: 'पुर्ज़ों की दुकान',
    sBind: 'डिवाइस बाँधें',
    sCompare: 'तुलना',
    footer: 'डेमो प्रोटोटाइप · स्वतंत्र उत्पाद · app.matoopower.com',
  },
  auth: {
    ...en.auth,
    demoNote: 'डेमो: OTP API टर्मिनल लॉग में देखा जा सकता है।',
    codeSentHint: 'कोड जेनरेट हुआ (डेमो मोड में API टर्मिनल देखें)',
  },
  onboarding: {
    ...en.onboarding,
    step1Title: 'QR स्कैन करें',
    step1Desc: 'उत्पाद का QR स्कैन करके प्रामाणिकता और स्पेक देखें।',
    step2Title: 'वारंटी सक्रिय',
    step2Desc: 'खरीद जानकारी और इनवॉइस भरकर ई-वारंटी कार्ड सक्रिय करें।',
    step3Title: 'सेवा लें',
    step3Desc: 'स्मार्ट मॉड्यूल बाँधकर स्वास्थ्य डैशबोर्ड देखें।',
    next: 'अगला',
    start: 'शुरू करें',
    skip: 'छोड़ें',
  },
} as any;
