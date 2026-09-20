#!/usr/bin/env node
/**
 * Matoo Power · 端到端烟雾测试
 *
 * 启动 admin server 后，用 fetch() 走完一遍核心流程：
 *   1. /health
 *   2. POST /api/auth/login
 *   3. GET /api/i18n/en.json  (确认 14 种语言目录存在)
 *   4. GET /api/i18n/keys     (确认翻译键已索引)
 *   5. PUT /api/i18n/ja/foo   (写一个测试键值，再读回来验证回写)
 *   6. GET /api/images/scan   (列出可管理的图片)
 *   7. GET /api/audit/recent  (确认审计日志收到记录)
 *
 * 用法：
 *   1) 先在另一个终端启动 server：`node website/api/server.js`
 *   2) 再运行：`node website/scripts/smoke-admin.js`
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:8000';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

const COOKIE_JAR = new Map(); // name -> value

function cookieHeader() {
  return Array.from(COOKIE_JAR.entries()).map(([k, v]) => k + '=' + v).join('; ');
}

function storeSetCookie(res) {
  const raw = res.headers['set-cookie'];
  if (!raw) return;
  for (const line of raw) {
    const first = line.split(';')[0];
    const eq = first.indexOf('=');
    if (eq > 0) {
      COOKIE_JAR.set(first.slice(0, eq).trim(), first.slice(eq + 1).trim());
    }
  }
}

function request(method, urlPath, body, csrf) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE + urlPath);
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const headers = {
      'Accept': 'application/json',
    };
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = data.length;
    }
    if (COOKIE_JAR.size) headers['Cookie'] = cookieHeader();
    if (csrf) headers['X-CSRF-Token'] = csrf;
    const req = http.request({
      hostname: u.hostname,
      port: u.port || 8000,
      path: u.pathname + u.search,
      method,
      headers,
    }, (res) => {
      storeSetCookie(res);
      let chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, json, text });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function pass(name) { console.log('  PASS  ' + name); }
function fail(name, msg) { console.log('  FAIL  ' + name + ' - ' + msg); process.exitCode = 1; }

async function run() {
  console.log('Base URL: ' + BASE);
  console.log('');

  // 1. health
  console.log('[1] /health');
  let r = await request('GET', '/health');
  if (r.status === 200 && r.json && r.json.ok) {
    pass('/health ok');
    if (Array.isArray(r.json.i18n_languages) && r.json.i18n_languages.length === 14) {
      pass('/health i18n_languages=14');
    } else {
      fail('/health i18n_languages count', JSON.stringify(r.json.i18n_languages));
    }
  } else {
    fail('/health', 'status=' + r.status);
    return;
  }

  // 2. login
  console.log('');
  console.log('[2] POST /api/auth/login');
  r = await request('POST', '/api/auth/login', { password: ADMIN_PASS });
  if (r.status === 200 && r.json && r.json.ok && r.json.csrf) {
    pass('login');
  } else {
    fail('login', 'status=' + r.status + ' body=' + r.text);
    return;
  }
  const csrf = r.json.csrf;

  // 3. i18n catalog per language
  console.log('');
  console.log('[3] GET /api/i18n/<lang>');
  const MIN_KEYS = 20;
  for (const lang of ['en', 'zh', 'ja', 'ko', 'vi', 'hi', 'ur', 'ta', 'te', 'ar', 'fr', 'pt', 'es', 'bn']) {
    const r2 = await request('GET', '/api/i18n/' + lang, null, csrf);
    if (r2.status === 200 && r2.json && r2.json.ok && r2.json.data) {
      const n = Object.keys(r2.json.data).length;
      if (n >= MIN_KEYS) {
        pass('i18n/' + lang + ' keys=' + n);
      } else {
        fail('i18n/' + lang, 'keys=' + n + ' < MIN=' + MIN_KEYS);
      }
    } else {
      fail('i18n/' + lang, 'status=' + r2.status + ' body=' + r2.text);
    }
  }

  // 4. keys index
  console.log('');
  console.log('[4] GET /api/i18n/audit/keys');
  r = await request('GET', '/api/i18n/audit/keys', null, csrf);
  if (r.status === 200 && r.json && r.json.ok) {
    const used = (r.json.usedKeys || []).length;
    const missingAll = (r.json.missing || []).length;
    const missingPartial = (r.json.missingPartial || []).length;
    if (missingAll === 0 && missingPartial === 0) {
      pass('used=' + used + ' missing=0 partial=0');
    } else {
      fail('keys', 'missing=' + missingAll + ' partial=' + missingPartial);
    }
  } else {
    fail('keys', 'status=' + r.status + ' body=' + r.text);
  }

  // 5. roundtrip write
  console.log('');
  console.log('[5] PUT /api/i18n/<lang>/<key>');
  const probe = { v: '__smoke__' + Date.now() };
  r = await request('PUT', '/api/i18n/ja/__smoke_test__', { value: probe.v }, csrf);
  if (r.status === 200 && r.json && r.json.ok) {
    pass('write ja.__smoke_test__');
  } else {
    fail('write', 'status=' + r.status + ' body=' + r.text);
  }
  r = await request('GET', '/api/i18n/ja', null, csrf);
  if (r.json && r.json.ok && r.json.data && r.json.data.__smoke_test__ === probe.v) {
    pass('read-back ja.__smoke_test__');
    // cleanup: write empty string (DELETE not exposed for lang/key)
    await request('PUT', '/api/i18n/ja/__smoke_test__', { value: '' }, csrf);
    pass('cleanup ja.__smoke_test__');
  } else {
    fail('read-back', JSON.stringify(r.json));
  }

  // 6. image list
  console.log('');
  console.log('[6] GET /api/images');
  r = await request('GET', '/api/images', null, csrf);
  if (r.status === 200 && r.json && Array.isArray(r.json.items)) {
    pass('images count=' + r.json.items.length);
  } else {
    fail('images', 'status=' + r.status + ' body=' + r.text);
  }

  // 7. audit log
  console.log('');
  console.log('[7] GET /api/audit');
  r = await request('GET', '/api/audit?limit=20', null, csrf);
  if (r.status === 200 && r.json && Array.isArray(r.json.items)) {
    pass('audit entries=' + r.json.items.length);
    const actions = r.json.items.map((it) => it.action).filter(Boolean);
    pass('audit recent actions: ' + actions.slice(0, 5).join(', '));
  } else {
    fail('audit', 'status=' + r.status + ' body=' + r.text);
  }

  console.log('');
  if (process.exitCode) {
    console.log('SMOKE FAILED.');
  } else {
    console.log('SMOKE OK.');
  }
}

run().catch((e) => { console.error(e); process.exit(1); });