/* ============================================
 * Matoo Admin · Main workspace script
 *
 * Light, dependency-free vanilla JS. Handles:
 *   - View switching (translations / images / keys / audit)
 *   - i18n read & edit
 *   - Image list & management
 *   - Audit log rendering
 *   - Toast notifications
 * ============================================ */
(function () {
  'use strict';

  // ---------- Session / CSRF helpers ----------
  var CSRF = null;
  var state = {
    view: 'i18n',
    lang: 'en',
    i18n: { en: {}, zh: {}, bn: {} },
    keyAudit: null,
    currentKey: null,
    currentValue: null,
    images: [],
    imageRefs: {},
  };

  function setStatus(text, kind) {
    var el = document.getElementById('status');
    el.textContent = text;
    el.className = 'status' + (kind ? (' ' + kind) : '');
  }

  function toast(msg, kind) {
    var host = document.getElementById('toast-host');
    var t = document.createElement('div');
    t.className = 'toast' + (kind ? (' ' + kind) : '');
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(function () { t.remove(); }, 2500);
  }

  async function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({}, opts.headers || {});
    if (CSRF) headers['X-CSRF-Token'] = CSRF;
    var res = await fetch(path, {
      method: opts.method || 'GET',
      headers: headers,
      credentials: 'same-origin',
      body: opts.body,
    });
    var data = await res.json().catch(function () { return {}; });
    if (res.status === 401) {
      window.location.href = '/admin/';
      return;
    }
    if (!res.ok) {
      throw new Error(data.message || ('HTTP ' + res.status));
    }
    return data;
  }

  // ---------- Boot ----------
  async function boot() {
    // Init bilingual i18n before anything else
    if (window.AdminI18n) {
      await window.AdminI18n.init();
    }
    try {
      var me = await api('/api/auth/me');
      CSRF = me.csrf;
    } catch (e) {
      window.location.href = '/admin/';
      return;
    }
    bindGlobal();
    // Initial sync of lang-switcher active state — the admin-langchange
    // event fired during boot() was emitted before bindGlobal() ran.
    syncLangSwitcher();
    switchView('i18n');
  }

  function bindGlobal() {
    document.querySelectorAll('.nav-tabs [data-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchView(btn.getAttribute('data-view'));
      });
    });
    var logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', doLogout);

    // Bind admin language switcher (EN / ZH)
    var langSwitch = document.getElementById('lang-switch');
    if (langSwitch) {
      langSwitch.addEventListener('click', function (e) {
        var b = e.target.closest('[data-lang]');
        if (!b) return;
        var lang = b.getAttribute('data-lang');
        langSwitch.querySelectorAll('button').forEach(function (x) {
          x.classList.toggle('active', x === b);
        });
        window.AdminI18n.setLang(lang);
      });
    }

    // Re-localize template-injected content when language flips
    document.addEventListener('admin-langchange', function () {
      window.AdminI18n.applyAll();
      // Sync sidebar lang-switcher active state (init() does not touch it)
      syncLangSwitcher();
      // Refresh dynamic strings that depend on i18n
      if (state.view === 'i18n') renderKeyList();
    });
  }

  function syncLangSwitcher() {
    var langSwitch = document.getElementById('lang-switch');
    if (!langSwitch || !window.AdminI18n) return;
    var lang = window.AdminI18n.getLang();
    langSwitch.querySelectorAll('button[data-lang]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === lang);
    });
  }

  async function doLogout() {
    await api('/api/auth/logout', { method: 'POST' });
    window.location.href = '/admin/';
  }

  // ---------- View switcher ----------
  function switchView(name) {
    state.view = name;
    document.querySelectorAll('.nav-tabs [data-view]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === name);
    });
    var titles = {
      i18n: 'i18n.title',
      images: 'images.title',
      keys: 'keys.title',
      overview: 'overview.title',
      audit: 'audit.title',
    };
    var viewTitleEl = document.getElementById('view-title');
    if (viewTitleEl) {
      // Bind via data-i18n so language switches re-apply automatically.
      viewTitleEl.setAttribute('data-i18n', titles[name] || name);
      viewTitleEl.textContent = window.AdminI18n ? window.AdminI18n.t(titles[name] || name) : (titles[name] || name);
    }

    var root = document.getElementById('view-root');
    root.innerHTML = '';
    var tpl = document.getElementById('tpl-' + name);
    if (!tpl) return;
    root.appendChild(tpl.content.cloneNode(true));
    // Localize the freshly injected template before binding behaviour
    if (window.AdminI18n) window.AdminI18n.applyAll();
    var init = views[name];
    if (init) init();
  }

  var views = {};

  // ---------- I18N View ----------
  views.i18n = function () {
    var langPills = document.getElementById('lang-pills');
    langPills.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-lang]');
      if (!btn) return;
      state.lang = btn.getAttribute('data-lang');
      langPills.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('active', b === btn);
      });
      renderKeyList();
    });
    document.getElementById('key-search').addEventListener('input', renderKeyList);
    document.getElementById('reload-btn').addEventListener('click', loadI18n);

    loadI18n();
  };

  async function loadI18n() {
    setStatus('loading…', 'saving');
    try {
      var res = await api('/api/i18n');
      state.i18n = res.data || { en: {}, zh: {}, bn: {} };
      // Lazy load key audit in background
      api('/api/i18n/audit/keys').then(function (r) { state.keyAudit = r; renderKeyList(); });
      renderKeyList();
      setStatus('ready');
    } catch (e) {
      setStatus('error', 'error');
      toast(e.message, 'error');
    }
  }

  function flatten(obj, prefix, out) {
    out = out || [];
    prefix = prefix || '';
    if (!obj || typeof obj !== 'object') return out;
    for (var k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      if (k === '_meta') continue;
      var path = prefix ? prefix + '.' + k : k;
      var v = obj[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        flatten(v, path, out);
      } else {
        out.push({ key: path, value: v });
      }
    }
    return out;
  }

  function getByPath(obj, dotted) {
    var parts = dotted.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function renderKeyList() {
    var list = document.getElementById('key-list');
    if (!list) return;
    var search = (document.getElementById('key-search').value || '').toLowerCase();
    var lang = state.lang;
    var keys = flatten(state.i18n[lang] || {});
    if (search) {
      keys = keys.filter(function (it) { return it.key.toLowerCase().indexOf(search) !== -1; });
    }
    var missing = (state.keyAudit && state.keyAudit.missing) || [];
    var missingSet = {};
    missing.forEach(function (m) { missingSet[m.key] = true; });

    // Group by top-level prefix
    var sections = {};
    keys.forEach(function (it) {
      var top = it.key.split('.')[0];
      if (!sections[top]) sections[top] = [];
      sections[top].push(it);
    });

    list.innerHTML = '';
    Object.keys(sections).sort().forEach(function (top) {
      var head = document.createElement('div');
      head.className = 'section';
      head.textContent = top;
      list.appendChild(head);
      sections[top].forEach(function (it) {
        var btn = document.createElement('button');
        btn.className = 'item' + (state.currentKey === it.key ? ' active' : '');
        btn.setAttribute('data-key', it.key);

        var html = '';
        if (missingSet[it.key]) html += '<span class="badge missing">missing</span>';
        html += '<span>' + escapeHtml(it.key) + '</span>';
        html += '<span class="meta">' + escapeHtml(truncate(String(it.value || ''), 60)) + '</span>';
        btn.innerHTML = html;

        btn.addEventListener('click', function () {
          state.currentKey = it.key;
          state.currentValue = String(it.value || '');
          renderKeyList();
          renderEditor();
        });
        list.appendChild(btn);
      });
    });

    if (keys.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'section';
      empty.textContent = 'No keys';
      list.appendChild(empty);
    }
  }

  function renderEditor() {
    var pane = document.getElementById('editor-pane');
    if (!state.currentKey) {
      pane.innerHTML = '<div class="empty">Select a key to edit.</div>';
      return;
    }
    var key = state.currentKey;
    var lang = state.lang;
    var refs = (state.keyAudit && state.keyAudit.usedKeys || []).find(function (k) { return k.key === key; });
    var refsHtml = '<span class="ref">no HTML references</span>';
    if (refs && refs.files && refs.files.length) {
      refsHtml = refs.files.map(function (f) { return '<a href="/' + f + '" target="_blank">' + f + '</a>'; }).join('');
    }

    var enVal = state.currentValue; // placeholder
    var otherLangs = ['en', 'zh', 'bn'].filter(function (l) { return l !== lang; });
    var othersHtml = otherLangs.map(function (l) {
      var v = getByPath(state.i18n[l], key);
      return '<div style="margin-bottom:12px;">' +
             '<strong style="font-size:var(--fs-xs);color:var(--color-slate-400);text-transform:uppercase;">' + l + '</strong>' +
             '<div style="margin-top:4px;padding:8px;background:var(--color-slate-50);border-radius:var(--radius-md);font-size:var(--fs-sm);color:var(--color-slate-700);min-height:36px;">' +
             escapeHtml(v == null ? '(not translated)' : String(v)) +
             '</div></div>';
    }).join('');

    pane.innerHTML = '' +
      '<div class="head">' +
        '<div class="key">' + escapeHtml(key) + '</div>' +
        '<div class="ref">Used in: ' + refsHtml + '</div>' +
      '</div>' +
      '<div class="body">' +
        '<div class="col">' +
          '<h3>Edit · ' + lang + '</h3>' +
          '<textarea class="textarea" id="edit-area" spellcheck="false">' + escapeHtml(state.currentValue) + '</textarea>' +
        '</div>' +
        '<div class="col">' +
          '<h3>Other languages</h3>' + othersHtml +
        '</div>' +
      '</div>' +
      '<div class="foot">' +
        '<span class="info">Auto-saves on blur. Press Ctrl+S to save now.</span>' +
        '<div>' +
          '<button class="btn btn-ghost" id="cancel-edit">Cancel</button>' +
          '<button class="btn btn-primary" id="save-edit">Save</button>' +
        '</div>' +
      '</div>';

    var area = document.getElementById('edit-area');
    area.addEventListener('input', function () {
      state.currentValue = area.value;
      setStatus('unsaved', 'saving');
    });
    area.addEventListener('blur', function () { saveCurrent(); });
    area.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveCurrent();
      }
    });

    document.getElementById('save-edit').addEventListener('click', saveCurrent);
    document.getElementById('cancel-edit').addEventListener('click', function () {
      var original = getByPath(state.i18n[state.lang], state.currentKey);
      area.value = original == null ? '' : String(original);
      state.currentValue = area.value;
    });

    area.focus();
  }

  async function saveCurrent() {
    if (!state.currentKey) return;
    var key = state.currentKey;
    var lang = state.lang;
    var value = state.currentValue;
    if (typeof value !== 'string') return;
    setStatus('saving…', 'saving');
    try {
      await api('/api/i18n/' + lang + '/' + encodeURIComponent(key), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: value }),
      });
      // Update local cache
      var parts = key.split('.');
      var cur = state.i18n[lang];
      for (var i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
      setStatus('saved', 'saved');
      toast('Saved · ' + key, 'success');
      renderKeyList();
    } catch (e) {
      setStatus('error', 'error');
      toast('Save failed: ' + e.message, 'error');
    }
  }

  // ---------- Images View ----------
  views.images = function () {
    var input = document.getElementById('upload-input');
    var drop = document.getElementById('dropzone');
    var search = document.getElementById('img-search');
    document.getElementById('reload-images-btn').addEventListener('click', loadImages);

    input.addEventListener('change', function (e) {
      var files = Array.from(e.target.files || []);
      uploadFiles(files);
      input.value = '';
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('active'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('active'); });
    });
    drop.addEventListener('drop', function (e) {
      var dt = e.dataTransfer;
      if (!dt) return;
      var files = Array.from(dt.files || []);
      uploadFiles(files);
    });
    search.addEventListener('input', renderImages);

    loadImages();
  };

  async function loadImages() {
    setStatus('loading…', 'saving');
    try {
      var res = await api('/api/images');
      state.images = res.items || [];
      state.imageRefs = res.references || {};
      renderImages();
      setStatus('ready');
    } catch (e) {
      setStatus('error', 'error');
      toast(e.message, 'error');
    }
  }

  function renderImages() {
    var grid = document.getElementById('img-grid');
    if (!grid) return;
    var search = (document.getElementById('img-search').value || '').toLowerCase();
    grid.innerHTML = '';
    var items = state.images.slice().sort(function (a, b) { return a.path.localeCompare(b.path); });
    if (search) items = items.filter(function (it) { return it.path.toLowerCase().indexOf(search) !== -1; });
    if (items.length === 0) {
      grid.innerHTML = '<p style="color:var(--color-slate-400);font-size:var(--fs-sm);">No images.</p>';
      return;
    }
    items.forEach(function (it) {
      var refs = state.imageRefs[it.path] || [];
      var card = document.createElement('div');
      card.className = 'img-card';
      var isSvg = /\.svg$/i.test(it.path);
      // The API returns paths relative to /assets/ (e.g. "factory-assembly.jpg").
      // The site serves them under /assets/, so prefix when rendering.
      var thumbUrl = '/assets/' + it.path;
      var thumbContent = isSvg
        ? '<img src="' + thumbUrl + '" alt="">'
        : '<img src="' + thumbUrl + '" alt="" loading="lazy" onerror="this.outerHTML=\'<div class=placeholder>no preview</div>\'">';
      card.innerHTML =
        '<div class="thumb">' + thumbContent + '</div>' +
        '<div class="info">' +
          '<div class="name">' + escapeHtml(it.path) + '</div>' +
          '<div class="meta">' + formatSize(it.size) + ' · ' + it.mtime.slice(0, 10) + '</div>' +
          (refs.length
            ? '<div class="refs">' + refs.slice(0, 4).map(function (r) { return '<span class="ref-tag">' + r + '</span>'; }).join('') + (refs.length > 4 ? '<span class="ref-tag">+' + (refs.length - 4) + '</span>' : '') + '</div>'
            : '<div class="refs" style="color:var(--color-warning);">unused</div>') +
        '</div>' +
        '<div class="ops">' +
          '<button class="btn btn-sm replace-btn">Replace</button>' +
          '<button class="btn btn-sm btn-danger delete-btn">Delete</button>' +
        '</div>';

      card.querySelector('.replace-btn').addEventListener('click', function () { openReplace(it); });
      card.querySelector('.delete-btn').addEventListener('click', function () { confirmDelete(it); });
      grid.appendChild(card);
    });
  }

  function uploadFiles(files) {
    if (!files.length) return;
    var p = Promise.resolve();
    files.forEach(function (f) {
      p = p.then(function () {
        var fd = new FormData();
        fd.append('file', f);
        fd.append('filename', f.name);
        setStatus('uploading ' + f.name, 'saving');
        return fetch('/api/images/upload?replace=true', {
          method: 'POST',
          body: fd,
          credentials: 'same-origin',
          headers: CSRF ? { 'X-CSRF-Token': CSRF } : {},
        }).then(function (r) { return r.json(); }).then(function (data) {
          if (!data.ok) throw new Error(data.message || 'Upload failed');
          toast('Uploaded · ' + data.path, 'success');
        });
      });
    });
    p.then(function () {
      setStatus('ready');
      loadImages();
    }).catch(function (err) {
      setStatus('error', 'error');
      toast('Upload failed: ' + err.message, 'error');
    });
  }

  function openReplace(item) {
    var fd = new FormData();
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.jpg,.jpeg,.png,.webp,.svg';
    inp.addEventListener('change', function () {
      if (!inp.files || !inp.files[0]) return;
      var fd = new FormData();
      fd.append('file', inp.files[0]);
      fd.append('path', item.path);
      setStatus('replacing ' + item.path, 'saving');
      fetch('/api/images/replace', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
        headers: CSRF ? { 'X-CSRF-Token': CSRF } : {},
      }).then(function (r) { return r.json(); }).then(function (data) {
        if (!data.ok) throw new Error(data.message || 'Replace failed');
        toast('Replaced · ' + data.path, 'success');
        setStatus('ready');
        loadImages();
      }).catch(function (err) {
        setStatus('error', 'error');
        toast('Replace failed: ' + err.message, 'error');
      });
    });
    inp.click();
  }

  function confirmDelete(item) {
    var refs = state.imageRefs[item.path] || [];
    var msg = refs.length
      ? 'This image is referenced by ' + refs.length + ' page(s):\n\n' + refs.join(', ') + '\n\nDelete anyway?'
      : 'Delete ' + item.path + '?';
    if (!window.confirm(msg)) return;
    setStatus('deleting…', 'saving');
    api('/api/images/' + encodeURIComponent(item.path) + '?force=true', { method: 'DELETE' }).then(function () {
      toast('Deleted', 'success');
      setStatus('ready');
      loadImages();
    }).catch(function (err) {
      setStatus('error', 'error');
      toast('Delete failed: ' + err.message, 'error');
    });
  }

  // ---------- Keys View ----------
  views.keys = function () {
    var list = document.getElementById('keys-list');
    setStatus('loading…', 'saving');
    api('/api/i18n/audit/keys').then(function (r) {
      state.keyAudit = r;
      list.innerHTML = '';
      var missing = r.missing || [];
      if (!missing.length) {
        list.innerHTML = '<div class="audit-item"><div></div><div></div><div style="color:var(--color-success);">All keys are translated ✓</div></div>';
        setStatus('ready');
        return;
      }
      missing.forEach(function (it) {
        var row = document.createElement('div');
        row.className = 'audit-item';
        row.innerHTML =
          '<div class="action i18n">missing</div>' +
          '<div class="target">' + escapeHtml(it.key) + '</div>' +
          '<div>' + (it.usedIn || []).map(function (f) { return '<span class="ref-tag">' + f + '</span>'; }).join('') + '</div>';
        list.appendChild(row);
      });
      setStatus(missing.length + ' missing', 'error');
    }).catch(function (e) {
      toast(e.message, 'error');
      setStatus('error', 'error');
    });
  };

  // ---------- Overview View ----------
  views.overview = function () {
    var ovState = { range: '24h' };
    var rangeTabs = document.getElementById('ov-range');
    var reloadBtn = document.getElementById('ov-reload');

    rangeTabs.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-range]');
      if (!btn) return;
      ovState.range = btn.getAttribute('data-range');
      rangeTabs.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('active', b === btn);
      });
      load();
    });
    reloadBtn.addEventListener('click', load);
    load();

    function load() {
      setStatus('loading…', 'saving');
      Promise.all([
        api('/api/analytics/summary?range=' + ovState.range),
        api('/api/analytics/logins?range=' + ovState.range),
      ]).then(function (res) {
        renderKpis(res[0].data, res[1].data);
        renderSpark('ov-spark-views', res[0].data.byDay, 'views', 'visitors');
        renderSpark('ov-spark-logins', res[1].data.byDay, 'logins', 'fails');
        renderTop('ov-top-pages', res[0].data.topPages, 'path');
        renderTop('ov-top-langs', res[0].data.topLangs, 'lang');
        renderTop('ov-top-ua', res[0].data.uaClasses, 'uaClass');
        renderTop('ov-top-fails', res[1].data.topFailIps, 'ip');
        renderTimeline('ov-recent-logins', res[1].data.recentLogins);
        setStatus('ready');
      }).catch(function (err) {
        setStatus('error', 'error');
        toast(err.message, 'error');
      });
    }

    function renderKpis(s, l) {
      var host = document.getElementById('ov-kpis');
      var lfailRate = (l.failRate * 100).toFixed(1) + '%';
      host.innerHTML = '' +
        kpiCard('overview.kpi.views', s.totalViews, s.uniquePages + ' pages') +
        kpiCard('overview.kpi.visitors', s.uniqueVisitors, 'unique') +
        kpiCard('overview.kpi.logins', l.totalLogins, l.totalFails + ' fail') +
        kpiCard('overview.kpi.failRate', lfailRate, 'of attempts', 'warn');
    }

    function kpiCard(labelKey, value, sub, kind) {
      return '<div class="kpi' + (kind ? (' kpi-' + kind) : '') + '">' +
        '<div class="kpi-label" data-i18n="' + labelKey + '">' + escapeHtml(labelKey) + '</div>' +
        '<div class="kpi-value">' + escapeHtml(String(value)) + '</div>' +
        '<div class="kpi-sub">' + escapeHtml(sub) + '</div>' +
        '</div>';
    }

    function renderTop(id, list, keyName) {
      var el = document.getElementById(id);
      if (!el) return;
      if (!list || !list.length) {
        el.innerHTML = '<li class="top-empty" data-i18n="overview.empty">No data in this range.</li>';
        if (window.AdminI18n) window.AdminI18n.applyAll(el);
        return;
      }
      var max = list[0].count || 1;
      el.innerHTML = list.map(function (it) {
        var pct = Math.max(6, Math.round((it.count / max) * 100));
        var label = it[keyName] || it.key || it.ip || '—';
        return '<li>' +
          '<span class="top-label" title="' + escapeHtml(label) + '">' + escapeHtml(label) + '</span>' +
          '<span class="top-bar"><span class="top-fill" style="width:' + pct + '%"></span></span>' +
          '<span class="top-count">' + escapeHtml(String(it.count)) + '</span>' +
          '</li>';
      }).join('');
    }

    function renderTimeline(id, list) {
      var el = document.getElementById(id);
      if (!el) return;
      if (!list || !list.length) {
        el.innerHTML = '<div class="timeline-empty" data-i18n="overview.empty">No data in this range.</div>';
        if (window.AdminI18n) window.AdminI18n.applyAll(el);
        return;
      }
      el.innerHTML = list.slice(0, 12).map(function (it) {
        var ts = (it.ts || '').replace('T', ' ').slice(0, 19);
        var target = it.target || '';
        var ok = it.action === 'auth.login';
        return '<div class="timeline-row">' +
          '<span class="dot ' + (ok ? 'ok' : 'fail') + '"></span>' +
          '<span class="ts">' + escapeHtml(ts) + '</span>' +
          '<span class="who">' + escapeHtml(target) + '</span>' +
          '</div>';
      }).join('');
    }

    function renderSpark(hostId, rows, primaryKey, secondaryKey) {
      var host = document.getElementById(hostId);
      if (!host) return;
      var data = rows || [];
      if (!data.length) {
        host.innerHTML = '<div class="sparkline-empty" data-i18n="overview.empty">No data in this range.</div>';
        if (window.AdminI18n) window.AdminI18n.applyAll(host);
        return;
      }
      var w = 600;
      var h = 80;
      var padX = 8;
      var padY = 10;
      var innerW = w - padX * 2;
      var innerH = h - padY * 2;
      var max = 0;
      data.forEach(function (d) {
        if (d[primaryKey] > max) max = d[primaryKey];
        if (d[secondaryKey] > max) max = d[secondaryKey];
      });
      if (max <= 0) max = 1;
      function x(i) { return padX + (data.length === 1 ? innerW / 2 : (i * innerW) / (data.length - 1)); }
      function y(v) { return padY + innerH - (v / max) * innerH; }
      var pts1 = data.map(function (d, i) { return x(i) + ',' + y(d[primaryKey]); }).join(' ');
      var pts2 = data.map(function (d, i) { return x(i) + ',' + y(d[secondaryKey]); }).join(' ');
      var area = 'M ' + x(0) + ',' + (padY + innerH) + ' L ' + pts1.split(' ').join(' L ') + ' L ' + x(data.length - 1) + ',' + (padY + innerH) + ' Z';
      var labels = data.map(function (d, i) {
        if (data.length <= 6) return '<text x="' + x(i) + '" y="' + (h - 2) + '" class="ax">' + escapeHtml(d.date.slice(5)) + '</text>';
        var step = Math.ceil(data.length / 6);
        if (i % step !== 0 && i !== data.length - 1) return '';
        return '<text x="' + x(i) + '" y="' + (h - 2) + '" class="ax">' + escapeHtml(d.date.slice(5)) + '</text>';
      }).join('');
      host.innerHTML =
        '<svg class="sparkline" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
          '<path d="' + area + '" class="area" />' +
          '<polyline points="' + pts2 + '" class="line secondary" />' +
          '<polyline points="' + pts1 + '" class="line primary" />' +
          labels +
        '</svg>' +
        '<div class="legend">' +
          '<span><i class="sw primary"></i>' + escapeHtml(primaryKey) + '</span>' +
          '<span><i class="sw secondary"></i>' + escapeHtml(secondaryKey) + '</span>' +
        '</div>';
    }
  };

  // ---------- Audit View ----------
  views.audit = function () {
    var filter = document.getElementById('audit-filter');
    document.getElementById('reload-audit-btn').addEventListener('click', loadAudit);
    filter.addEventListener('change', loadAudit);
    loadAudit();
  };

  function loadAudit() {
    var action = document.getElementById('audit-filter').value;
    var url = '/api/audit?limit=300' + (action ? '&action=' + action : '');
    var list = document.getElementById('audit-list');
    setStatus('loading…', 'saving');
    api(url).then(function (r) {
      list.innerHTML = '';
      var items = r.items || [];
      if (!items.length) {
        list.innerHTML = '<div class="audit-item"><div></div><div></div><div style="color:var(--color-slate-400);">No activity yet.</div></div>';
        setStatus('ready');
        return;
      }
      items.forEach(function (it) {
        var row = document.createElement('div');
        row.className = 'audit-item';
        var action = it.action || '';
        var actionClass = action.split('.')[0] || '';
        var diffHtml = '';
        if (it.before != null || it.after != null) {
          diffHtml = '<div class="diff">';
          if (it.before != null) diffHtml += '<span class="del">' + escapeHtml(truncate(String(it.before), 80)) + '</span> ';
          if (it.after != null) diffHtml += '<span class="ins">' + escapeHtml(truncate(String(it.after), 80)) + '</span>';
          diffHtml += '</div>';
        }
        row.innerHTML =
          '<div class="ts">' + (it.ts || '').replace('T', ' ').slice(0, 19) + '</div>' +
          '<div class="action ' + escapeHtml(actionClass) + '">' + escapeHtml(action) + '</div>' +
          '<div><div class="target">' + escapeHtml(it.target || '') + '</div>' + diffHtml + '</div>';
        list.appendChild(row);
      });
      setStatus(items.length + ' entries');
    }).catch(function (e) {
      toast(e.message, 'error');
      setStatus('error', 'error');
    });
  }

  // ---------- Helpers ----------
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function formatSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB';
    return (b / 1024 / 1024).toFixed(1) + ' MB';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();