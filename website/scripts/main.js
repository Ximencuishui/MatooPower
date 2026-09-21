/**
 * Matoo Power · Main JavaScript
 * 极简原生 JS，弱网友好，无依赖
 *
 * NOTE: Loads whatsapp-config.js BEFORE this file in HTML.
 * Example: <script src="/scripts/whatsapp-config.js"></script>
 *          <script src="/scripts/main.js"></script>
 */

(function () {
  'use strict';

  /* ============================================
   * 0. WhatsApp Link Rewriter · 占位符替换
   *    Replaces wa.me/WHATSAPP_PLACEHOLDER with the
   *    real number from window.MATOO_WHATSAPP.number.
   *
   * P0 fix: only operates on `wa.me/` hrefs and the masked footer text.
   * Never touches i18n data or arbitrary text content, so it cannot
   * corrupt translations like "World Bank" -> "W...orld Bank".
   * ============================================ */
  const WhatsAppLinks = {
    PLACEHOLDER: 'WHATSAPP_PLACEHOLDER',
    // Footer ships with this friendly masked number.
    // Once the real number is configured we replace it.
    FOOTER_MASK: /WhatsApp:\s*\+\d+\s*X+\s*\d?\s*X*/g,
    // P0 fix: placeholder wa.me links are NOT yet safe to click. In production,
    // hide them visually + disable, so a customer cannot tap a broken link.
    HIDE_DISABLED_LINK_CSS: 'matoo-wa-disabled',

    isLocalDev() {
      return location.hostname === 'localhost'
          || location.hostname === '127.0.0.1'
          || location.protocol === 'file:';
    },

    init() {
      const cfg = window.MATOO_WHATSAPP;
      if (!cfg || !cfg.number) return;

      // Skip rewrite if placeholder is still the literal "WHATSAPP_PLACEHOLDER".
      // In production, disable the link entirely (safer than a broken wa.me link).
      if (cfg.number === this.PLACEHOLDER) {
        if (this.isLocalDev()) {
          console.warn('[Matoo] WhatsApp number is still a placeholder. Edit scripts/whatsapp-config.js before deploy.');
        }
        const placeholderLinks = document.querySelectorAll('a[href*="wa.me/' + this.PLACEHOLDER + '"]');
        placeholderLinks.forEach((a) => {
          // P0: visually hide in production, leave functional only in local dev.
          const inProd = !this.isLocalDev() && cfg.disabledInProd !== false;
          if (inProd) {
            a.setAttribute('aria-disabled', 'true');
            a.setAttribute('tabindex', '-1');
            a.classList.add(this.HIDE_DISABLED_LINK_CSS);
            a.setAttribute('title', 'WhatsApp contact is being configured.');
          } else {
            a.setAttribute('href', '#');
            a.setAttribute('aria-disabled', 'true');
          }
          a.addEventListener('click', (e) => { e.preventDefault(); });
        });
        return;
      }

      const number = cfg.number;
      const formatted = this.formatDisplayNumber(number);
      let rewrittenLinks = 0;
      let rewrittenText = 0;

      // 1) Rewrite wa.me/WHATSAPP_PLACEHOLDER links. Strict selector:
      //    only <a> with href starting with "https://wa.me/" or "//wa.me/".
      const WAME_PATTERN = /^(https?:)?\/\/wa\.me\/[A-Za-z0-9_]+/;
      document.querySelectorAll('a[href]').forEach((a) => {
        const href = a.getAttribute('href') || '';
        if (href.indexOf('wa.me/' + this.PLACEHOLDER) === -1) return;
        if (!WAME_PATTERN.test(href.replace('wa.me/' + this.PLACEHOLDER, 'wa.me/' + number))) return;
        a.setAttribute('href', href.replace('wa.me/' + this.PLACEHOLDER, 'wa.me/' + number));
        a.removeAttribute('aria-disabled');
        a.removeAttribute('tabindex');
        a.classList.remove(this.HIDE_DISABLED_LINK_CSS);
        rewrittenLinks++;
      });

      // 2) Rewrite footer text "WhatsApp: +65 XXXX XXXX" -> "WhatsApp: +65 9123 4567"
      //    Use TreeWalker so we only touch text nodes, not HTML attributes.
      //    P0 fix: skip text nodes inside <script> blocks (i18n data, JSON-LD)
      //    to avoid corrupting translation strings like "World Bank".
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          let p = node.parentNode;
          while (p) {
            if (p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE' || p.nodeName === 'NOSCRIPT') {
              return NodeFilter.FILTER_REJECT;
            }
            p = p.parentNode;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      let node;
      while ((node = walker.nextNode())) {
        if (!this.FOOTER_MASK.test(node.nodeValue)) continue;
        node.nodeValue = node.nodeValue.replace(this.FOOTER_MASK, 'WhatsApp: ' + formatted);
        rewrittenText++;
      }

      if (rewrittenLinks > 0 || rewrittenText > 0) {
        console.info('[Matoo] Rewrote ' + rewrittenLinks + ' WhatsApp link(s) and ' +
                    rewrittenText + ' footer text node(s) with configured number.');
      }
    },

    /**
     * Format the configured E.164 number into a friendly display string.
     * Example: '6591234567' -> '+65 9123 4567' (assumes 8-digit subscriber)
     * Falls back to the raw number when format cannot be inferred.
     */
    formatDisplayNumber(number) {
      if (!number) return '';
      const digits = String(number).replace(/\D/g, '');
      // Assume 8-digit subscriber number after country code
      if (digits.length >= 10) {
        const cc = '+' + digits.slice(0, digits.length - 8);
        const a = digits.slice(-8, -4);
        const b = digits.slice(-4);
        return cc + ' ' + a + ' ' + b;
      }
      return '+' + digits;
    },
  };
  /* ============================================
   * 1. Language Switcher · 语言切换
   *
   * Supported: 14 languages including RTL (ur, ar).
   * Missing translation keys fall back to English.
   * ============================================ */
  const LangSwitcher = {
    STORAGE_KEY: 'matoo-lang',
    DEFAULT: 'en',
    // All 14 languages with their native display label and writing direction.
    // `rtl: true` marks languages whose page layout must flip.
    SUPPORTED: [
      { code: 'en', label: 'English',   dir: 'ltr', channel: 'whatsapp' },
      { code: 'zh', label: '中文',      dir: 'ltr', channel: 'wechat' },
      { code: 'bn', label: 'বাংলা',     dir: 'ltr', channel: 'whatsapp' },
      { code: 'ja', label: '日本語',    dir: 'ltr', channel: 'whatsapp' },
      { code: 'ko', label: '한국어',    dir: 'ltr', channel: 'whatsapp' },
      { code: 'vi', label: 'Tiếng Việt', dir: 'ltr', channel: 'whatsapp' },
      { code: 'hi', label: 'हिन्दी',    dir: 'ltr', channel: 'whatsapp' },
      { code: 'ur', label: 'اردو',      dir: 'rtl', channel: 'whatsapp' },
      { code: 'ta', label: 'தமிழ்',     dir: 'ltr', channel: 'whatsapp' },
      { code: 'te', label: 'తెలుగు',    dir: 'ltr', channel: 'whatsapp' },
      { code: 'ar', label: 'العربية',   dir: 'rtl', channel: 'whatsapp' },
      { code: 'fr', label: 'Français',  dir: 'ltr', channel: 'whatsapp' },
      { code: 'pt', label: 'Português', dir: 'ltr', channel: 'whatsapp' },
      { code: 'es', label: 'Español',   dir: 'ltr', channel: 'whatsapp' },
    ],
    translations: {},
    fallbackTranslations: {}, // English as fallback source

    init() {
      const switcher = document.querySelector('[data-lang-switcher]');
      if (!switcher) return;

      this.loadTranslations();
      this.bindEvents(switcher);
      this.applyStoredLang();
    },

    loadTranslations() {
      // i18n 文件由构建步骤注入或按需加载
      // 此处提供 i18n 字符串的存储位置
      const data = document.getElementById('i18n-data');
      if (data && data.textContent) {
        try {
          const parsed = JSON.parse(data.textContent);
          this.translations = parsed;
          // English is the canonical fallback. If a target language is missing
          // entirely, fall back per-key to English.
          this.fallbackTranslations = parsed.en || {};
        } catch (e) {
          console.warn('i18n data parse error:', e);
        }
      }
    },

    isSupported(code) {
      return this.SUPPORTED.some(function (s) { return s.code === code; });
    },
    meta(code) {
      return this.SUPPORTED.find(function (s) { return s.code === code; }) || this.SUPPORTED[0];
    },

    bindEvents(switcher) {
      const toggle = switcher.querySelector('.lang-toggle');
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = switcher.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(isOpen));
      });

      // 点击外部关闭
      document.addEventListener('click', () => {
        switcher.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });

      // 选择语言
      switcher.querySelectorAll('[data-lang]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const lang = btn.getAttribute('data-lang');
          this.setLang(lang);
        });
      });
    },

    applyStoredLang() {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const code = this.isSupported(stored) ? stored : this.DEFAULT;
      this.setLang(code, false);
    },

    setLang(lang, persist) {
      if (!this.isSupported(lang)) return;

      const meta = this.meta(lang);
      document.documentElement.setAttribute('lang', lang);
      // Set RTL for Urdu / Arabic (visual layout flips).
      document.documentElement.setAttribute('dir', meta.dir);
      if (persist) localStorage.setItem(this.STORAGE_KEY, lang);

      // 更新 aria-checked 与显示文字
      const labels = {};
      this.SUPPORTED.forEach(function (s) { labels[s.code] = s.label; });
      document.querySelectorAll('[data-lang]').forEach(function (btn) {
        btn.setAttribute('aria-checked', String(btn.getAttribute('data-lang') === lang));
      });
      const currentLangEl = document.querySelector('[data-current-lang]');
      if (currentLangEl) currentLangEl.textContent = labels[lang];

      // 替换翻译文本（如果有 i18n 数据）
      const dict = this.translations[lang];
      if (dict) {
        document.querySelectorAll('[data-i18n]').forEach((el) => {
          const key = el.getAttribute('data-i18n');
          let translated = this.lookup(key, lang);
          // Per-key fallback to English when translation missing/empty.
          if (!translated) {
            translated = this.lookup(key, this.DEFAULT);
            if (translated) el.setAttribute('data-i18n-fallback', 'en');
            else el.removeAttribute('data-i18n-fallback');
          } else {
            el.removeAttribute('data-i18n-fallback');
          }
          if (translated) el.textContent = translated;
        });
      }

      // 根据语言切换即时通讯入口
      this.updateContactChannels(lang, meta.channel);

      // 触发自定义事件
      window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang: lang, dir: meta.dir } }));
    },

    lookup(key, lang) {
      const parts = key.split('.');
      const dict = this.translations[lang];
      if (!dict) return null;
      let result = dict;
      for (const part of parts) {
        if (result && typeof result === 'object') result = result[part];
        else return null;
      }
      // Treat empty string as missing so the fallback kicks in.
      if (result === '' || result == null) return null;
      return result;
    },

    updateContactChannels(lang, channel) {
      // channel = 'wechat' for Chinese, 'whatsapp' otherwise.
      const want = channel || (lang === 'zh' ? 'wechat' : 'whatsapp');
      document.querySelectorAll('[data-channel]').forEach((el) => {
        const channels = el.getAttribute('data-channel').split(',').map((s) => s.trim());
        el.hidden = !channels.includes(want);
      });
    },
  };

  /* ============================================
   * 2. Mobile Navigation · 移动端导航
   * ============================================ */
  const MobileNav = {
    init() {
      const toggle = document.querySelector('.mobile-nav-toggle');
      const nav = document.querySelector('.site-nav');
      if (!toggle || !nav) return;

      toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!expanded));
        nav.classList.toggle('open');

        // 简单展开式：移动端直接堆叠到 header 下方
        if (nav.classList.contains('open')) {
          nav.style.cssText = `
            display: flex;
            flex-direction: column;
            position: absolute;
            top: 72px; left: 0; right: 0;
            background: white;
            padding: 16px 24px;
            border-bottom: 1px solid var(--color-slate-200);
            box-shadow: var(--shadow-lg);
            gap: 12px;
            align-items: stretch;
          `;
        } else {
          nav.style.cssText = '';
        }
      });
    },
  };

  /* ============================================
   * 3. Form Handling · 表单处理
   *    Real submission via mailto: fallback.
   *    The user's email client opens with a pre-filled
   *    lead email to sales@matoopower.com. Until a real
   *    backend is hooked up, this guarantees no leads
   *    are silently dropped.
   * ============================================ */
  const FormHandler = {
    SALES_EMAIL: 'sales@matoopower.com',
    API_ENDPOINT: '/api/inquiries',  // Set when real backend is wired up

    init() {
      document.querySelectorAll('form[data-form]').forEach((form) => this.bindForm(form));
    },

    bindForm(form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!this.validate(form)) return;

        const submitBtn = form.querySelector('[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        const data = Object.fromEntries(new FormData(form).entries());
        data._form = form.getAttribute('data-form');
        data._lang = document.documentElement.lang;
        data._source = window.location.pathname;
        data._timestamp = new Date().toISOString();
        data._userAgent = navigator.userAgent;

        this.submit(data).then((response) => {
          this.showSuccess(form, response);
          form.reset();
        }).catch((err) => {
          this.showError(form, err.message);
        }).finally(() => {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        });
      });
    },

    validate(form) {
      let valid = true;
      form.querySelectorAll('[required]').forEach((field) => {
        const value = field.value.trim();
        const errorEl = field.parentElement.querySelector('.form-error');
        if (errorEl) errorEl.remove();

        if (!value) {
          this.markError(field, 'This field is required');
          valid = false;
        } else if (field.type === 'email' && !this.isEmail(value)) {
          this.markError(field, 'Please enter a valid email');
          valid = false;
        }
      });
      return valid;
    },

    markError(field, message) {
      field.style.borderColor = 'var(--color-error)';
      const error = document.createElement('div');
      error.className = 'form-error';
      error.style.cssText = 'color: var(--color-error); font-size: var(--fs-xs); margin-top: 4px;';
      error.textContent = message;
      field.parentElement.appendChild(error);
    },

    isEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    },

    /**
     * Real submission path:
     *   1. Try POST /api/inquiries (when backend is deployed)
     *   2. Fall back to opening user's email client (mailto:) with
     *      pre-filled lead email to sales@matoopower.com
     */
    async submit(data) {
      // 1) Try real API first
      try {
        const res = await fetch(this.API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          return { ok: true, channel: 'api', id: json.id || ('api-' + Date.now()) };
        }
      } catch (e) {
        // Network failure or 404 → fall through to mailto
        console.info('[Form] API unavailable, falling back to mailto:', e.message);
      }

      // 2) mailto: fallback — opens user's email client
      return this.submitViaMailto(data);
    },

    submitViaMailto(data) {
      const subject = '[Matoo Inquiry] ' + (data._form || 'contact') + ' from ' + (data.name || data.company || 'Website Visitor');
      const lines = [
        'New inquiry from matoopower.com',
        '',
        '--- Form ---',
        'Type: ' + (data._form || 'contact'),
        'Language: ' + (data._lang || 'en'),
        'Page: ' + (data._source || '/'),
        'Submitted: ' + (data._timestamp || new Date().toISOString()),
        '',
        '--- Contact ---',
      ];
      Object.keys(data).forEach((k) => {
        if (k.startsWith('_')) return;
        lines.push(k + ': ' + data[k]);
      });
      const body = encodeURIComponent(lines.join('\n'));
      const mailtoUrl = 'mailto:' + this.SALES_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + body;
      // Open in a new tab to avoid blocking current page
      window.open(mailtoUrl, '_blank', 'noopener');
      return Promise.resolve({ ok: true, channel: 'mailto', id: 'mailto-' + Date.now() });
    },

    showSuccess(form, response) {
      const successEl = form.querySelector('[data-form-success]') || this.createSuccessEl(form, response);
      successEl.hidden = false;
      successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    showError(form, message) {
      alert('Submission failed: ' + message + '\nPlease try again or email us directly at ' + this.SALES_EMAIL);
    },

    createSuccessEl(form, response) {
      const el = document.createElement('div');
      el.setAttribute('data-form-success', '');
      el.setAttribute('role', 'alert');
      el.style.cssText = `
        margin-top: 16px;
        padding: 16px;
        background: var(--color-matoo-50);
        border-radius: var(--radius-md);
        color: var(--color-matoo-700);
        text-align: center;
      `;
      const channelNote = response && response.channel === 'mailto'
        ? 'Your email client should have opened with the inquiry pre-filled.<br>'
        : '';
      el.innerHTML = `
        <strong>✓ Thank you for your inquiry!</strong><br>
        ${channelNote}Our team will respond within 24 hours.<br>
        <a href="https://wa.me/WHATSAPP_PLACEHOLDER" style="color: var(--color-matoo-600); font-weight: 600;">
          💬 Or chat with us on WhatsApp
        </a>
      `;
      form.appendChild(el);
      return el;
    },
  };

  /* ============================================
   * 4. Smooth Anchor Scroll · 平滑滚动
   * ============================================ */
  const SmoothScroll = {
    init() {
      document.querySelectorAll('a[href^="#"]').forEach((link) => {
        link.addEventListener('click', (e) => {
          const href = link.getAttribute('href');
          if (href === '#' || href.length < 2) return;
          const target = document.querySelector(href);
          if (!target) return;
          e.preventDefault();
          const offset = 80; // header height
          const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
          window.scrollTo({ top, behavior: 'smooth' });
        });
      });
    },
  };

  /* ============================================
   * 5. Lazy Image Loader · 图片懒加载兜底
   * ============================================ */
  const LazyLoad = {
    init() {
      if ('loading' in HTMLImageElement.prototype) return;
      // 老浏览器兜底：使用 IntersectionObserver
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) { img.src = img.dataset.src; img.removeAttribute('data-src'); }
            observer.unobserve(img);
          }
        });
      });
      document.querySelectorAll('img[data-src]').forEach((img) => observer.observe(img));
    },
  };

  /* ============================================
   * 5a. SiteSettings · 站点配置（由 Admin 后台控制）
   *    Asynchronously fetches /api/settings and rewrites footer /
   *    social / WhatsApp links + WeChat QR on every page.
   *
   *    Runs in parallel with i18n — i18n fallback paints first,
   *    then SiteSettings overwrites with backend-sourced values.
   *    Failures are silent (catch + warn) so the site stays usable
   *    if the API is unreachable.
   * ============================================ */
  const SiteSettings = {
    state: null,

    /**
     * Decide which WhatsApp number to show based on either:
     *   1) an explicit <body data-region="sea|mena|sa|africa|latam"> hint
     *   2) navigator.language → coarse region mapping
     *   3) fallback to whatsapp.number
     */
    pickWhatsAppNumber(s) {
      if (!s || !s.whatsapp || s.whatsapp.enabled === false) return null;
      const byRegion = s.whatsapp.byRegion || {};
      const explicit = (document.body.getAttribute('data-region') || '').toLowerCase();
      const navLang = (navigator.language || '').toLowerCase();
      let region = explicit;
      if (!region) {
        if (/^zh|^en-(sg|ph|my|th|vn|id|sg)/.test(navLang)) region = 'sea';
        else if (/^ar|^fa/.test(navLang)) region = 'mena';
        else if (/^bn|^hi|^ur|^ta|^te/.test(navLang)) region = 'sa';
        else if (/^(sw|en-ng|en-ke|fr|pt|am)/.test(navLang)) region = 'africa';
        else if (/^es|^pt-br/.test(navLang)) region = 'latam';
      }
      const candidate = (region && byRegion[region]) || s.whatsapp.number;
      if (!candidate || candidate === 'WHATSAPP_PLACEHOLDER') return null;
      return candidate;
    },

    /**
     * Inject `data-i18n="..."` fallback values that match what the
     * backend currently serves. The frontend i18n already paints
     * defaults; SiteSettings only needs to overwrite key slots.
     */
    renderFooter(s) {
      if (!s || !s.contact) return;

      // Email line(s): any element with data-settings-bind="contact.email"
      document.querySelectorAll('[data-settings-bind="contact.email"]').forEach(function (el) {
        el.textContent = '✉ ' + s.contact.email;
      });

      // Phone / WhatsApp line: pick number, format display
      const number = this.pickWhatsAppNumber(s);
      if (number) {
        const formatted = WhatsAppLinks.formatDisplayNumber(number);
        document.querySelectorAll('[data-settings-bind="contact.whatsapp"]').forEach(function (el) {
          el.textContent = '💬 WhatsApp: ' + formatted;
        });
      }

      // HQ line
      document.querySelectorAll('[data-settings-bind="contact.hqLine"]').forEach(function (el) {
        el.textContent = '📍 ' + s.contact.hqLine;
      });

      // Social URLs
      if (s.social) {
        document.querySelectorAll('[data-settings-bind="social.facebook"]').forEach(function (a) {
          if (s.social.facebook) a.setAttribute('href', s.social.facebook);
        });
        document.querySelectorAll('[data-settings-bind="social.linkedin"]').forEach(function (a) {
          if (s.social.linkedin) { a.setAttribute('href', s.social.linkedin); a.style.display = ''; }
          else { a.style.display = 'none'; }
        });
        document.querySelectorAll('[data-settings-bind="social.twitter"]').forEach(function (a) {
          if (s.social.twitter) { a.setAttribute('href', s.social.twitter); a.style.display = ''; }
          else { a.style.display = 'none'; }
        });
        document.querySelectorAll('[data-settings-bind="social.youtube"]').forEach(function (a) {
          if (s.social.youtube) { a.setAttribute('href', s.social.youtube); a.style.display = ''; }
          else { a.style.display = 'none'; }
        });
        document.querySelectorAll('[data-settings-bind="social.instagram"]').forEach(function (a) {
          if (s.social.instagram) { a.setAttribute('href', s.social.instagram); a.style.display = ''; }
          else { a.style.display = 'none'; }
        });
      }

      // WeChat QR
      if (s.contact.wechatQrUrl) {
        document.querySelectorAll('[data-settings-bind="contact.wechatQrUrl"]').forEach(function (img) {
          img.setAttribute('src', s.contact.wechatQrUrl);
        });
      }
      if (s.contact.wechatId) {
        document.querySelectorAll('[data-settings-bind="contact.wechatId"]').forEach(function (el) {
          el.textContent = s.contact.wechatId;
        });
      }

      // Legal entity names
      if (s.legalEntity) {
        document.querySelectorAll('[data-settings-bind="legalEntity.full"]').forEach(function (el) {
          if (s.legalEntity.cn && s.legalEntity.sg) {
            el.textContent = s.legalEntity.cn + ' (' + (s.legalEntity.cnRole || '') + ') · ' +
                             s.legalEntity.sg + ' (' + (s.legalEntity.sgRole || '') + ')';
          }
        });
      }
    },

    async load() {
      try {
        var res = await fetch('/api/settings', { credentials: 'omit' });
        if (!res.ok) return;
        var json = await res.json();
        if (!json || !json.ok) return;
        this.state = json.data;
        // Expose for downstream consumers (e.g. WhatsAppLinks).
        window.MATOO_SETTINGS = this.state;
        this.renderFooter(this.state);
        // Re-run WhatsApp rewriter now that backend number is known.
        if (this.state.whatsapp) {
          // Promote the active number to window.MATOO_WHATSAPP so the
          // existing rewrite path picks it up on next paint.
          window.MATOO_WHATSAPP = Object.assign({}, window.MATOO_WHATSAPP || {}, {
            number: this.state.whatsapp.number || 'WHATSAPP_PLACEHOLDER',
            defaultMessage: this.state.whatsapp.defaultMessage,
            disabledInProd: this.state.whatsapp.disabledInProd !== false,
          });
          WhatsAppLinks.init();
        }
      } catch (e) {
        // Silent: site already paints sensible defaults from i18n.
        // Surface in dev consoles only.
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
          console.warn('[Matoo] settings fetch failed:', e.message);
        }
      }
    },
  };

  /* ============================================
   * 5b. WeChat QR Trigger · 微信二维码弹层
   *    Hover opens on desktop; tap toggles on touch.
   *    Click outside or Escape closes. ARIA-compatible.
   * ============================================ */
  const WeChatTrigger = {
    init() {
      const triggers = document.querySelectorAll('[data-wechat-toggle]');
      if (triggers.length === 0) return;

      const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

      triggers.forEach((btn) => {
        const popover = btn.parentElement.querySelector('.wechat-popover');
        if (!popover) return;

        const open = () => {
          // Close other open popovers first (single-open behavior).
          document.querySelectorAll('.wechat-popover.is-open').forEach((p) => {
            if (p !== popover) {
              p.classList.remove('is-open');
              const t = p.parentElement.querySelector('[data-wechat-toggle]');
              if (t) t.setAttribute('aria-expanded', 'false');
            }
          });
          popover.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
        };
        const close = () => {
          popover.classList.remove('is-open');
          btn.setAttribute('aria-expanded', 'false');
        };
        const toggle = () => {
          if (popover.classList.contains('is-open')) close(); else open();
        };

        if (isTouch) {
          // Touch devices: click toggles (hover CSS doesn't fire reliably).
          btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggle(); });
        } else {
          // Desktop: hover is handled by CSS; click still toggles for keyboard users.
          btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggle(); });
        }

        // Close on outside click
        document.addEventListener('click', (e) => {
          if (!popover.classList.contains('is-open')) return;
          if (popover.contains(e.target) || btn.contains(e.target)) return;
          close();
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && popover.classList.contains('is-open')) {
            close();
            btn.focus();
          }
        });
      });
    },
  };

  /* ============================================
   * Bootstrap · 启动
   * ============================================ */
  function init() {
    // SiteSettings loads async; it re-runs WhatsAppLinks.init() when ready.
    // The first WhatsAppLinks.init() call below is a no-op if no number is
    // configured yet (placeholder mode), which is the safe default.
    WhatsAppLinks.init();
    LangSwitcher.init();
    MobileNav.init();
    FormHandler.init();
    SmoothScroll.init();
    LazyLoad.init();
    WeChatTrigger.init();
    SiteSettings.load();
  }


  /* ============================================
   * Public API -> window.MatooApp
   *   Exposed so inline page scripts (e.g. downloadSpec
   *   on products.html) can submit leads without
   *   duplicating the mailto fallback logic.
   * ============================================ */
  window.MatooApp = {
    /**
     * Submit a lead. Returns { ok, channel, id }.
     * Tries /api/inquiries first; falls back to mailto.
     * @param {object} data - Lead fields (without _meta prefix)
     * @param {object} meta - Optional overrides (form, source, lang)
     */
    submitLead: function (data, meta) {
      const payload = Object.assign({}, data);
      payload._form = (meta && meta.form) || payload._form || 'inline';
      payload._lang = (meta && meta.lang) || document.documentElement.lang || 'en';
      payload._source = (meta && meta.source) || window.location.pathname;
      payload._timestamp = new Date().toISOString();
      payload._userAgent = navigator.userAgent;
      return FormHandler.submit(payload);
    },
    /**
     * Open the user's mail client with a pre-filled lead
     * email to sales@matoopower.com.
     */
    submitViaMailto: function (data, meta) {
      const payload = Object.assign({}, data);
      payload._form = (meta && meta.form) || payload._form || 'inline';
      payload._source = (meta && meta.source) || window.location.pathname;
      payload._timestamp = new Date().toISOString();
      return FormHandler.submitViaMailto(payload);
    },
    /**
     * The configured sales WhatsApp number, or null if
     * the placeholder has not been replaced yet.
     */
    whatsappNumber: function () {
      const cfg = window.MATOO_WHATSAPP;
      if (!cfg || !cfg.number || cfg.number === 'WHATSAPP_PLACEHOLDER') return null;
      return cfg.number;
    },
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
