/* ============================================
 * Matoo Admin · Login logic
 * ============================================ */
(function () {
  'use strict';

  var form = document.getElementById('login-form');
  var input = document.getElementById('password');
  var btn = document.getElementById('submit-btn');
  var btnLabel = btn.querySelector('[data-i18n]') || btn;
  var errEl = document.getElementById('error');
  var langSwitch = document.getElementById('lang-switch');

  function showError(msg) {
    errEl.textContent = msg;
    errEl.hidden = false;
  }
  function clearError() {
    errEl.hidden = true;
    errEl.textContent = '';
  }

  // Init i18n first so all static strings are localized
  window.AdminI18n.init().then(function () {
    // Bind language switcher
    if (langSwitch) {
      langSwitch.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-lang]');
        if (!btn) return;
        var lang = btn.getAttribute('data-lang');
        langSwitch.querySelectorAll('button').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        window.AdminI18n.setLang(lang);
      });
    }
  });

  // Re-localize error messages when language changes
  document.addEventListener('admin-langchange', function () {
    if (!errEl.hidden && errEl.textContent) {
      // Re-localize network errors by re-running last action only if user retries
    }
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearError();
    btn.disabled = true;
    btnLabel.textContent = window.AdminI18n.t('login.submitting');

    try {
      var res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password: input.value })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.ok) {
        showError(data.message || (window.AdminI18n.t('login.errorDefault') + ' (HTTP ' + res.status + ')'));
        btn.disabled = false;
        btnLabel.textContent = window.AdminI18n.t('login.submit');
        return;
      }
      window.location.href = '/admin/app.html';
    } catch (err) {
      showError('Network error: ' + err.message);
      btn.disabled = false;
      btnLabel.textContent = window.AdminI18n.t('login.submit');
    }
  });
})();