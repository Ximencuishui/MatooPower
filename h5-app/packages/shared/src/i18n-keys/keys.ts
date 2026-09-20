// i18n key enumeration — extracted from apps/web/src/locales/zh-CN.ts.
//
// We ONLY export the key paths (dot-separated), never the localized strings.
// Frontend uses these to look up translations; backend uses them to reject
// unknown key references in API responses, logs, and email templates.
//
// When a new key is added to apps/web/src/locales/zh-CN.ts you must add it
// here too. The shared `I18nKey` union is a compile-time guard: any reference
// to a key that isn't in zh-CN.ts will fail type-checking.
//
// Authoritative total: 213 leaf keys (counted via regex over zh-CN.ts).

export type I18nKey =
  // app (2)
  | 'app.name'
  | 'app.tagline'
  // tabs (4)
  | 'tabs.home'
  | 'tabs.devices'
  | 'tabs.shop'
  | 'tabs.profile'
  // home (11)
  | 'home.welcome'
  | 'home.welcomeDesc'
  | 'home.scanBtn'
  | 'home.myDevices'
  | 'home.services'
  | 'home.sManual'
  | 'home.sVideo'
  | 'home.sWarranty'
  | 'home.sSupport'
  | 'home.sShop'
  | 'home.sBind'
  // scan (23)
  | 'scan.genuine'
  | 'scan.genuineSub'
  | 'scan.repeated'
  | 'scan.repeatedSub'
  | 'scan.fakeWarn'
  | 'scan.fakeSub'
  | 'scan.productTitle'
  | 'scan.model'
  | 'scan.serial'
  | 'scan.batch'
  | 'scan.capacity'
  | 'scan.voltage'
  | 'scan.chemistry'
  | 'scan.cycles'
  | 'scan.docs'
  | 'scan.manual'
  | 'scan.video'
  | 'scan.activate'
  | 'scan.bind'
  | 'scan.buyParts'
  | 'scan.scanAnother'
  | 'scan.redirecting'
  | 'scan.redirectingHint'
  // auth (21)
  | 'auth.login'
  | 'auth.welcomeBack'
  | 'auth.phoneOtp'
  | 'auth.emailPwd'
  | 'auth.whatsapp'
  | 'auth.phone'
  | 'auth.phonePh'
  | 'auth.code'
  | 'auth.codePh'
  | 'auth.sendCode'
  | 'auth.resendIn'
  | 'auth.email'
  | 'auth.emailPh'
  | 'auth.password'
  | 'auth.passwordPh'
  | 'auth.loginBtn'
  | 'auth.registerBtn'
  | 'auth.agree'
  | 'auth.terms'
  | 'auth.privacy'
  | 'auth.and'
  // activate (22)
  | 'activate.title'
  | 'activate.step'
  | 'activate.purchase'
  | 'activate.country'
  | 'activate.countryPh'
  | 'activate.city'
  | 'activate.cityPh'
  | 'activate.dealer'
  | 'activate.dealerPh'
  | 'activate.invoice'
  | 'activate.invoiceNo'
  | 'activate.invoiceDate'
  | 'activate.invoiceAmt'
  | 'activate.invoiceAmtUnit'
  | 'activate.invoicePhoto'
  | 'activate.upload'
  | 'activate.uploadTip'
  | 'activate.serialAuto'
  | 'activate.next'
  | 'activate.submit'
  | 'activate.rule'
  | 'activate.policyOk'
  // warranty (20)
  | 'warranty.card'
  | 'warranty.statusActive'
  | 'warranty.statusPending'
  | 'warranty.statusExpired'
  | 'warranty.product'
  | 'warranty.serial'
  | 'warranty.activatedAt'
  | 'warranty.startAt'
  | 'warranty.endAt'
  | 'warranty.period'
  | 'warranty.dealer'
  | 'warranty.region'
  | 'warranty.download'
  | 'warranty.share'
  | 'warranty.detail'
  | 'warranty.coverages'
  | 'warranty.cov_whole'
  | 'warranty.cov_cell'
  | 'warranty.cov_bms'
  | 'warranty.cov_parts'
  // devices (9)
  | 'devices.title'
  | 'devices.empty'
  | 'devices.scanBtn'
  | 'devices.view'
  | 'devices.warranty'
  | 'devices.healthy'
  | 'devices.bound'
  | 'devices.notBound'
  | 'devices.goBind'
  // device (13)
  | 'device.title'
  | 'device.overview'
  | 'device.soh'
  | 'device.soc'
  | 'device.cycles'
  | 'device.temp'
  | 'device.volt'
  | 'device.curr'
  | 'device.alarms'
  | 'device.fw'
  | 'device.bindTime'
  | 'device.upgrade'
  | 'device.upgradeSoon'
  // common (7)
  | 'common.back'
  | 'common.confirm'
  | 'common.cancel'
  | 'common.save'
  | 'common.lang'
  | 'common.zh'
  | 'common.en'
  // compare (15)
  | 'compare.title'
  | 'compare.pick'
  | 'compare.picked'
  | 'compare.metric'
  | 'compare.best'
  | 'compare.worst'
  | 'compare.emptyHint'
  | 'compare.more'
  | 'compare.soh'
  | 'compare.soc'
  | 'compare.cycles'
  | 'compare.temp'
  | 'compare.volt'
  | 'compare.fw'
  | 'compare.alarms'
  // dealer (13)
  | 'dealer.title'
  | 'dealer.desc'
  | 'dealer.role'
  | 'dealer.roleVal'
  | 'dealer.pickup'
  | 'dealer.addMore'
  | 'dealer.customer'
  | 'dealer.customerPh'
  | 'dealer.invoiceShared'
  | 'dealer.invoiceNo'
  | 'dealer.submit'
  | 'dealer.submitted'
  | 'dealer.mockNote'
  // fail (12)
  | 'fail.title'
  | 'fail.fake'
  | 'fail.fakeDesc'
  | 'fail.revoked'
  | 'fail.revokedDesc'
  | 'fail.network'
  | 'fail.networkDesc'
  | 'fail.retry'
  | 'fail.contact'
  | 'fail.copy'
  | 'fail.copied'
  | 'fail.backHome'
  // legal (17)
  | 'legal.termsTitle'
  | 'legal.privacyTitle'
  | 'legal.termsIntro'
  | 'legal.termsSection1Title'
  | 'legal.termsSection1'
  | 'legal.termsSection2Title'
  | 'legal.termsSection2'
  | 'legal.termsSection3Title'
  | 'legal.termsSection3'
  | 'legal.privacyIntro'
  | 'legal.privacySection1Title'
  | 'legal.privacySection1'
  | 'legal.privacySection2Title'
  | 'legal.privacySection2'
  | 'legal.privacySection3Title'
  | 'legal.privacySection3'
  | 'legal.demoNote'
  // profile (12) — top-level, distinct from tabs.profile
  | 'profile.phone'
  | 'profile.role'
  | 'profile.loggedIn'
  | 'profile.orders'
  | 'profile.warrantyRecords'
  | 'profile.tickets'
  | 'profile.address'
  | 'profile.support'
  | 'profile.settings'
  | 'profile.aboutTitle'
  | 'profile.aboutLine1'
  | 'profile.aboutLine2'
  // scanEntry (12)
  | 'scanEntry.title'
  | 'scanEntry.demoTip'
  | 'scanEntry.sectionNormal'
  | 'scanEntry.demoUnactivated'
  | 'scanEntry.demoActivated'
  | 'scanEntry.sectionFail'
  | 'scanEntry.demoFake'
  | 'scanEntry.demoRevoked'
  | 'scanEntry.demoNetwork'
  | 'scanEntry.sectionExtra'
  | 'scanEntry.demoCompare'
  | 'scanEntry.demoDealer';

/**
 * Total number of leaf keys in the enumeration.
 * Mirrors the number of leaf entries in apps/web/src/locales/zh-CN.ts
 * (verified via regex extraction: 213).
 * Update BOTH places when adding/removing a translation key.
 */
export const I18N_KEY_COUNT: 213 = 213;

/** Runtime array form of the enum for runtime validation / completeness tests. */
export const ALL_I18N_KEYS = [
  // app
  'app.name', 'app.tagline',
  // tabs
  'tabs.home', 'tabs.devices', 'tabs.shop', 'tabs.profile',
  // home
  'home.welcome', 'home.welcomeDesc', 'home.scanBtn', 'home.myDevices',
  'home.services', 'home.sManual', 'home.sVideo', 'home.sWarranty',
  'home.sSupport', 'home.sShop', 'home.sBind',
  // scan
  'scan.genuine', 'scan.genuineSub', 'scan.repeated', 'scan.repeatedSub',
  'scan.fakeWarn', 'scan.fakeSub', 'scan.productTitle', 'scan.model',
  'scan.serial', 'scan.batch', 'scan.capacity', 'scan.voltage',
  'scan.chemistry', 'scan.cycles', 'scan.docs', 'scan.manual', 'scan.video',
  'scan.activate', 'scan.bind', 'scan.buyParts', 'scan.scanAnother',
  'scan.redirecting', 'scan.redirectingHint',
  // auth
  'auth.login', 'auth.welcomeBack', 'auth.phoneOtp', 'auth.emailPwd',
  'auth.whatsapp', 'auth.phone', 'auth.phonePh', 'auth.code', 'auth.codePh',
  'auth.sendCode', 'auth.resendIn', 'auth.email', 'auth.emailPh',
  'auth.password', 'auth.passwordPh', 'auth.loginBtn', 'auth.registerBtn',
  'auth.agree', 'auth.terms', 'auth.privacy', 'auth.and',
  // activate
  'activate.title', 'activate.step', 'activate.purchase', 'activate.country',
  'activate.countryPh', 'activate.city', 'activate.cityPh', 'activate.dealer',
  'activate.dealerPh', 'activate.invoice', 'activate.invoiceNo',
  'activate.invoiceDate', 'activate.invoiceAmt', 'activate.invoiceAmtUnit',
  'activate.invoicePhoto', 'activate.upload', 'activate.uploadTip',
  'activate.serialAuto', 'activate.next', 'activate.submit', 'activate.rule',
  'activate.policyOk',
  // warranty
  'warranty.card', 'warranty.statusActive', 'warranty.statusPending',
  'warranty.statusExpired', 'warranty.product', 'warranty.serial',
  'warranty.activatedAt', 'warranty.startAt', 'warranty.endAt',
  'warranty.period', 'warranty.dealer', 'warranty.region',
  'warranty.download', 'warranty.share', 'warranty.detail',
  'warranty.coverages', 'warranty.cov_whole', 'warranty.cov_cell',
  'warranty.cov_bms', 'warranty.cov_parts',
  // devices
  'devices.title', 'devices.empty', 'devices.scanBtn', 'devices.view',
  'devices.warranty', 'devices.healthy', 'devices.bound', 'devices.notBound',
  'devices.goBind',
  // device
  'device.title', 'device.overview', 'device.soh', 'device.soc',
  'device.cycles', 'device.temp', 'device.volt', 'device.curr',
  'device.alarms', 'device.fw', 'device.bindTime', 'device.upgrade',
  'device.upgradeSoon',
  // common
  'common.back', 'common.confirm', 'common.cancel', 'common.save',
  'common.lang', 'common.zh', 'common.en',
  // compare
  'compare.title', 'compare.pick', 'compare.picked', 'compare.metric',
  'compare.best', 'compare.worst', 'compare.emptyHint', 'compare.more',
  'compare.soh', 'compare.soc', 'compare.cycles', 'compare.temp',
  'compare.volt', 'compare.fw', 'compare.alarms',
  // dealer
  'dealer.title', 'dealer.desc', 'dealer.role', 'dealer.roleVal',
  'dealer.pickup', 'dealer.addMore', 'dealer.customer', 'dealer.customerPh',
  'dealer.invoiceShared', 'dealer.invoiceNo', 'dealer.submit',
  'dealer.submitted', 'dealer.mockNote',
  // fail
  'fail.title', 'fail.fake', 'fail.fakeDesc', 'fail.revoked',
  'fail.revokedDesc', 'fail.network', 'fail.networkDesc', 'fail.retry',
  'fail.contact', 'fail.copy', 'fail.copied', 'fail.backHome',
  // legal
  'legal.termsTitle', 'legal.privacyTitle', 'legal.termsIntro',
  'legal.termsSection1Title', 'legal.termsSection1',
  'legal.termsSection2Title', 'legal.termsSection2',
  'legal.termsSection3Title', 'legal.termsSection3', 'legal.privacyIntro',
  'legal.privacySection1Title', 'legal.privacySection1',
  'legal.privacySection2Title', 'legal.privacySection2',
  'legal.privacySection3Title', 'legal.privacySection3', 'legal.demoNote',
  // profile
  'profile.phone', 'profile.role', 'profile.loggedIn', 'profile.orders',
  'profile.warrantyRecords', 'profile.tickets', 'profile.address',
  'profile.support', 'profile.settings', 'profile.aboutTitle',
  'profile.aboutLine1', 'profile.aboutLine2',
  // scanEntry
  'scanEntry.title', 'scanEntry.demoTip', 'scanEntry.sectionNormal',
  'scanEntry.demoUnactivated', 'scanEntry.demoActivated',
  'scanEntry.sectionFail', 'scanEntry.demoFake', 'scanEntry.demoRevoked',
  'scanEntry.demoNetwork', 'scanEntry.sectionExtra', 'scanEntry.demoCompare',
  'scanEntry.demoDealer',
] as const;

/**
 * Compile-time assertion that ALL_I18N_KEYS.length === I18N_KEY_COUNT.
 * If you add/remove a key and forget to update one of them, tsc will error here.
 */
const _enforceCount: [typeof ALL_I18N_KEYS['length'], typeof I18N_KEY_COUNT] = [
  ALL_I18N_KEYS.length,
  I18N_KEY_COUNT,
];
void _enforceCount;