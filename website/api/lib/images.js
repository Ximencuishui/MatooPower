/**
 * Matoo Admin API · Image utilities
 *
 * - Path safety / traversal hardening
 * - MIME magic-bytes validation (real file type, not just extension)
 * - srcset / multi-size awareness
 * - Optional sharp integration (graceful degradation if missing)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');

const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg']);
const MAGIC = [
    { ext: '.jpg', bytes: [0xff, 0xd8, 0xff] },
    { ext: '.png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
    { ext: '.webp', bytes: null, check: (b) => b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP' },
    { ext: '.gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  ];

function extOf(name) {
  return path.extname(name).toLowerCase();
}

function isSafeAssetPath(rel) {
  if (typeof rel !== 'string' || rel.length === 0 || rel.length > 512) return false;
  if (rel.includes('..') || rel.includes('\\') || path.isAbsolute(rel)) return false;
  if (rel.startsWith('/') || rel.startsWith('./')) return false;
  return /^[A-Za-z0-9_.\-/@]+$/.test(rel);
}

function resolveAssetPath(rel) {
  if (!isSafeAssetPath(rel)) {
    const err = new Error('Invalid asset path: ' + rel);
    err.code = 'INVALID_INPUT';
    err.httpStatus = 400;
    throw err;
  }
  const full = path.resolve(config.paths.assetsDir, rel);
  // Defense in depth: ensure resolved path still lives inside assetsDir
  const inside = full.startsWith(config.paths.assetsDir + path.sep) || full === config.paths.assetsDir;
  if (!inside) {
    const err = new Error('Asset path escapes assets directory');
    err.code = 'INVALID_INPUT';
    err.httpStatus = 400;
    throw err;
  }
  return full;
}

function detectMagic(buffer, ext) {
  if (ext === '.svg') {
    const head = buffer.slice(0, 256).toString('utf8').trimStart();
    if (head.startsWith('<svg') || head.startsWith('<?xml')) return true;
    return false;
  }
  for (const rule of MAGIC) {
    if (rule.ext !== ext) continue;
    if (rule.check) return rule.check(buffer);
    if (rule.bytes && buffer.length >= rule.bytes.length) {
      let ok = true;
      for (let i = 0; i < rule.bytes.length; i++) {
        if (buffer[i] !== rule.bytes[i]) { ok = false; break; }
      }
      if (ok) return true;
    }
  }
  return false;
}

function isAllowedExt(name) {
  return ALLOWED_EXTS.has(extOf(name));
}

function listAssets() {
  if (!fs.existsSync(config.paths.assetsDir)) return [];
  const out = [];
  walk(config.paths.assetsDir, '', out);
  return out;
}

function walk(dir, prefix, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue; // skip .archive etc
    const childRel = prefix ? prefix + '/' + entry.name : entry.name;
    const childFull = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(childFull, childRel, out);
    } else if (entry.isFile() && isAllowedExt(entry.name)) {
      const stat = fs.statSync(childFull);
      out.push({
        path: childRel,
        size: stat.size,
        mtime: stat.mtime.toISOString(),
      });
    }
  }
}

function baseFromSized(name) {
  // Strip known size suffixes like @1200, @800, @480, @1920
  return name.replace(/@\d{3,4}(?=\.[^.]+$)/, '');
}

function listVariants(rel) {
  const ext = extOf(rel);
  const base = rel.slice(0, rel.length - ext.length);
  const dir = config.paths.assetsDir;
  const out = [];
  if (!fs.existsSync(dir)) return out;
  walk(dir, '', out);
  return out
    .filter((it) => {
      const e = extOf(it.path);
      if (e !== ext) return false;
      const b = it.path.slice(0, it.path.length - e.length);
      return b === base || b.startsWith(base + '@');
    })
    .map((it) => it.path);
}

function ensureArchiveDir() {
  const arch = path.join(config.paths.assetsDir, '.archive');
  if (!fs.existsSync(arch)) fs.mkdirSync(arch, { recursive: true });
  return arch;
}

function archiveAsset(rel) {
  const full = resolveAssetPath(rel);
  const arch = ensureArchiveDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(arch, stamp + '__' + path.basename(rel));
  fs.copyFileSync(full, target);
  return path.relative(config.paths.assetsDir, target);
}

/**
 * Optional sharp integration. If sharp is not installed (or disabled),
 * the upload still succeeds but no @480/@800/@1200 variants are produced.
 */
async function maybeGenerateVariants(originalFull, baseName) {
  if (!config.sharpEnabled) return [];
  let sharp;
  try { sharp = require('sharp'); } catch (_) {
    console.warn('[images] sharp not installed, skipping multi-size generation.');
    return [];
  }
  const ext = extOf(originalFull).toLowerCase();
  if (ext === '.svg') return []; // SVG is vector; no resize

  const widths = [480, 800, 1200];
  const outputs = [];
  const dir = path.dirname(originalFull);
  for (const w of widths) {
    const target = path.join(dir, baseName + '@' + w + ext);
    try {
      await sharp(originalFull).resize({ width: w, withoutEnlargement: true }).toFile(target);
    } catch (err) {
      console.warn('[images] failed to generate', target, err.message);
    }
  }
  return outputs;
}

module.exports = {
  ALLOWED_EXTS,
  isAllowedExt,
  isSafeAssetPath,
  resolveAssetPath,
  detectMagic,
  listAssets,
  listVariants,
  baseFromSized,
  archiveAsset,
  maybeGenerateVariants,
};