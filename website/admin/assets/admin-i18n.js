/* ============================================
 * Matoo Admin · Bilingual i18n engine
 *
 * Loads admin/i18n/en.json + zh.json via fetch(), applies
 * data-i18n="..." attribute bindings, supports {placeholder}
 * interpolation. Persists preference via localStorage.
 * ============================================ */
(function () {
  'use strict';

  var SUPPORTED = ['en', 'zh'];
  var DEFAULT = 'en';
  var STORAGE_KEY = 'matoo-admin-lang';
  var translations = { en: {}, zh: {} };
  var current = DEFAULT;

  function getByPath(obj, dotted) {
    if (!obj) return undefined;
    var parts = dotted.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function interpolate(template, params) {
    if (!params) return template;
    return String(template).replace(/\{(\w+)\}/g, function (_, key) {
      return params[key] != null ? String(params[key]) : ('{' + key + '}');
    });
  }

  function t(key, params) {
    var v = getByPath(translations[current], key);
    if (v == null) v = getByPath(translations[DEFAULT], key);
    if (v == null) return key;
    return interpolate(v, params);
  }

  function applyAll(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    scope.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
    });
    document.documentElement.setAttribute('lang', current);
    var titleKey = document.documentElement.getAttribute('data-i18n-title');
    if (titleKey) document.title = t(titleKey);
  }

  function setLang(lang, opts) {
    if (!SUPPORTED.includes(lang)) lang = DEFAULT;
    current = lang;
    if (!opts || opts.persist !== false) {
      try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
    }
    applyAll();
    document.dispatchEvent(new CustomEvent('admin-langchange', { detail: { lang: lang } }));
  }

  async function loadAll() {
    try {
      var results = await Promise.all([
        fetch('/admin/i18n/en.json', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }),
        fetch('/admin/i18n/zh.json', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }),
      ]);
      translations.en = results[0] || {};
      translations.zh = results[1] || {};
    } catch (_) {
      translations.en = {};
      translations.zh = {};
    }
  }

  async function init(opts) {
    opts = opts || {};
    await loadAll();
    var stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (_) {}
    // Resolution order:
    //   1. explicit opts.lang (e.g. ?lang=zh in URL)
    //   2. persisted user choice in localStorage
    //   3. browser navigator.language (zh-* → 'zh')
    //   4. hard-coded DEFAULT ('en')
    var lang = null;
    if (opts.lang && SUPPORTED.includes(opts.lang)) lang = opts.lang;
    if (!lang && SUPPORTED.includes(stored)) lang = stored;
    if (!lang) {
      var navLang = (typeof navigator !== 'undefined' && navigator.language) || '';
      if (/^zh\b/i.test(navLang)) lang = 'zh';
    }
    if (!lang) lang = DEFAULT;
    setLang(lang, { persist: false });
    return lang;
  }

  window.AdminI18n = {
    SUPPORTED: SUPPORTED,
    DEFAULT: DEFAULT,
    init: init,
    t: t,
    setLang: setLang,
    applyAll: applyAll,
    getLang: function () { return current; },
  };
})();