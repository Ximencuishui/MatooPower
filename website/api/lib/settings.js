/**
 * Matoo Admin API · Site settings store
 *
 * Persists runtime-mutable site configuration to api/data/settings.json.
 * Read by both the Admin UI (read/write, requires auth) and the public
 * website via GET /api/settings (no auth, low cardinality).
 *
 * Schema is intentionally flat-by-group so the Admin form can render
 * straightforward <input> rows. Nested objects are allowed for
 * future expansion but the current surface stays simple.
 *
 * Concurrency: serialised via withLock() like i18n writes.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');

const SETTINGS_FILE = path.join(config.paths.dataDir, 'settings.json');
const BACKUP_DIR = path.join(config.paths.dataDir, '.bak');

/**
 * Default settings shape. New keys MUST be added here so a fresh
 * install (no settings.json on disk) boots with sensible values.
 *
 * - whatsapp.disabledInProd: keep wa.me links usable in local dev even
 *   when the configured number is the placeholder. Hard-disabled in prod.
 */
const DEFAULT_SETTINGS = {
  whatsapp: {
    number: 'WHATSAPP_PLACEHOLDER',
    defaultMessage: 'Hi Matoo Power, I have an inquiry from your website.',
    byRegion: {
      sea:   'WHATSAPP_PLACEHOLDER',  // South-East Asia
      mena:  'WHATSAPP_PLACEHOLDER',  // Middle East & North Africa
      sa:    'WHATSAPP_PLACEHOLDER',  // South Asia (BD/IN/PK/LK)
      africa:'WHATSAPP_PLACEHOLDER',  // Sub-Saharan Africa
      latam: 'WHATSAPP_PLACEHOLDER',  // Latin America
    },
    enabled: true,
    disabledInProd: true,
  },
  contact: {
    email: 'sales@matoopower.com',
    wechatId: 'MatooPower',
    wechatQrUrl: '/assets/qr-wechat.svg',
    phones: ['+65 0000 0000'],
    hqLine: 'Singapore · Shenzhen · Dhaka',
    address: {
      sg: '1 Raffles Place, #20-61, Singapore 048616',
      cn: '深圳市宝安区新安街道华美居商务大厦',
      bd: 'House 12, Road 7, Banani, Dhaka 1213',
    },
  },
  social: {
    facebook: 'https://www.facebook.com/MatooPower',
    linkedin: '',
    twitter: '',
    youtube: '',
    instagram: '',
  },
  legalEntity: {
    cn: '深圳华溢智能科技有限公司',
    sg: '新加坡华溢科技技术有限公司',
    cnRole: 'R&D · Manufacturing',
    sgRole: 'Brand · IP',
  },
  meta: {
    siteName: 'Matoo Power',
    tagline: 'Reliable Energy Storage for Emerging Markets',
    contactEmailForInquiries: 'sales@matoopower.com',
    responseSlaHours: 24,
  },
};

/**
 * Merge DEFAULTS into on-disk settings so newly added keys appear
 * without requiring an explicit migration step.
 */
function mergeDefaults(disk) {
  const out = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  if (!disk || typeof disk !== 'object') return out;
  for (const k1 of Object.keys(disk)) {
    if (out[k1] && typeof out[k1] === 'object' && !Array.isArray(out[k1])
        && typeof disk[k1] === 'object' && !Array.isArray(disk[k1])) {
      Object.assign(out[k1], disk[k1]);
    } else {
      out[k1] = disk[k1];
    }
  }
  return out;
}

function ensureFile() {
  if (!fs.existsSync(config.paths.dataDir)) {
    fs.mkdirSync(config.paths.dataDir, { recursive: true });
  }
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2) + '\n', 'utf8');
  }
}

function read() {
  ensureFile();
  const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
  const clean = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  let parsed;
  try { parsed = JSON.parse(clean); }
  catch (_) { parsed = {}; }
  return mergeDefaults(parsed);
}

/**
 * Atomic write: write to a tmp file then rename, so a crash mid-write
 * never leaves a half-written settings.json. Also keeps a single
 * rolling backup in data/.bak/settings.json.
 */
function write(next) {
  ensureFile();
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  // Backup current
  try {
    fs.copyFileSync(SETTINGS_FILE, path.join(BACKUP_DIR, 'settings.json'));
  } catch (_) { /* tolerate missing current */ }

  const merged = mergeDefaults(next);
  const tmp = SETTINGS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, SETTINGS_FILE);
  return merged;
}

/**
 * Compute a shallow diff between before/after for the audit log.
 * Returns a flat array of "a.b: old -> new" entries, only for changed leaves.
 */
function diff(before, after) {
  const out = [];
  function walk(b, a, prefix) {
    if (b === a) return;
    if (typeof b !== typeof a) {
      out.push(prefix + ': ' + JSON.stringify(b) + ' -> ' + JSON.stringify(a));
      return;
    }
    if (b && typeof b === 'object' && !Array.isArray(b)) {
      const keys = new Set([...Object.keys(b || {}), ...Object.keys(a || {})]);
      keys.forEach((k) => walk(b ? b[k] : undefined, a ? a[k] : undefined, prefix ? prefix + '.' + k : k));
      return;
    }
    out.push(prefix + ': ' + JSON.stringify(b) + ' -> ' + JSON.stringify(a));
  }
  walk(before, after, '');
  return out;
}

/**
 * Serialize concurrent writers with a per-file promise chain.
 */
let writeChain = Promise.resolve();
function withLock(fn) {
  const next = writeChain.then(fn, fn);
  writeChain = next.catch(() => {});
  return next;
}

/**
 * Validate phone/whatsapp number: digits only, length 7-15 (E.164 max).
 * Empty string is allowed (= use placeholder).
 */
function isValidNumber(s) {
  if (typeof s !== 'string') return false;
  if (s === '') return true;
  if (s === 'WHATSAPP_PLACEHOLDER') return true; // sentinel
  return /^\d{7,15}$/.test(s);
}

/**
 * Allowed hostnames per social platform. Operators are expected to paste
 * a real profile/company URL — we reject anything else to avoid
 * accidentally pointing a user to a phishing clone, an unrelated site,
 * or a misspelled domain (e.g. "twitter.co" or "linkedln.com").
 *
 * Empty string is always allowed (= hide the icon).
 * Whitelist is matched against the URL's hostname only; the path is free.
 * Subdomains are accepted via the "*" sentinel which compiles to a regex
 * that matches the listed domain or any subdomain of it.
 */
const SOCIAL_HOST_WHITELIST = {
  facebook:   ['facebook.com', 'fb.com', 'fb.me'],
  linkedin:   ['linkedin.com', 'lnkd.in'],
  twitter:    ['twitter.com', 'x.com', 't.co'],
  youtube:    ['youtube.com', 'youtu.be', 'yt.be'],
  instagram:  ['instagram.com', 'instagr.am'],
};

function isValidSocialUrl(platform, url) {
  if (typeof url !== 'string') return { ok: false, reason: 'not-a-string' };
  if (url === '') return { ok: true }; // empty = hide icon, always OK
  let parsed;
  try { parsed = new URL(url); }
  catch (_) { return { ok: false, reason: 'malformed-url' }; }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'wrong-protocol:' + parsed.protocol };
  }
  const allowed = SOCIAL_HOST_WHITELIST[platform];
  if (!allowed) return { ok: true }; // unknown platform: pass through (defensive)
  const host = parsed.hostname.toLowerCase();
  for (const dom of allowed) {
    if (host === dom || host.endsWith('.' + dom)) return { ok: true };
  }
  return {
    ok: false,
    reason: 'host-not-allowed:' + host,
    hint: allowed.join(', '),
  };
}

function validate(settings) {
  const errors = [];
  if (!settings || typeof settings !== 'object') {
    errors.push('settings must be an object');
    return errors;
  }
  if (settings.whatsapp) {
    if (!isValidNumber(settings.whatsapp.number || '')) {
      errors.push('whatsapp.number must be digits only (7-15) or placeholder');
    }
    if (settings.whatsapp.byRegion && typeof settings.whatsapp.byRegion === 'object') {
      for (const [k, v] of Object.entries(settings.whatsapp.byRegion)) {
        if (!isValidNumber(v || '')) {
          errors.push('whatsapp.byRegion.' + k + ' must be digits only or placeholder');
        }
      }
    }
  }
  if (settings.contact && settings.contact.email) {
    // Permissive email check; full RFC parsing is overkill for an internal CMS
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.contact.email)) {
      errors.push('contact.email looks invalid: ' + settings.contact.email);
    }
  }
  if (settings.meta && settings.meta.responseSlaHours != null) {
    const n = Number(settings.meta.responseSlaHours);
    if (!Number.isFinite(n) || n < 0 || n > 720) {
      errors.push('meta.responseSlaHours must be a number 0..720');
    }
  }
  // Per-platform social URL whitelist
  if (settings.social && typeof settings.social === 'object') {
    for (const [platform, url] of Object.entries(settings.social)) {
      const r = isValidSocialUrl(platform, url);
      if (!r.ok) {
        const hintSuffix = r.hint ? ' — allowed: ' + r.hint : '';
        errors.push('social.' + platform + ' invalid: ' + r.reason + hintSuffix);
      }
    }
  }
  return errors;
}

module.exports = {
  DEFAULT_SETTINGS,
  read,
  write: function (next) { return withLock(() => write(next)); },
  diff,
  validate,
  SETTINGS_FILE,
};
