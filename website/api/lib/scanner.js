/**
 * Matoo Admin API · HTML reference scanner
 *
 * Walks every *.html under the website root and extracts:
 *   - data-i18n attribute usage
 *   - <img src> and srcset references
 * Used to surface "where is this translation key used" and
 * "which pages reference this image" in the admin UI.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');

function listHtmlFiles() {
  const out = [];
  for (const entry of fs.readdirSync(config.paths.websiteRoot, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      out.push(path.join(config.paths.websiteRoot, entry.name));
    }
  }
  return out;
}

function scanHtmlFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const baseName = path.basename(file);

  const i18nKeys = new Set();
  const imageRefs = new Set();

  // data-i18n="..."
  const i18nRegex = /\sdata-i18n="([^"]+)"/g;
  let m;
  while ((m = i18nRegex.exec(text)) !== null) i18nKeys.add(m[1]);

  // <link rel="icon|apple-touch-icon|..." href|imagesrc="...">
  // and any other element carrying an asset URL.
  const linkRegex = /<link\b[^>]*>/gi;
  while ((m = linkRegex.exec(text)) !== null) {
    const tag = m[0];
    const hrefMatch = /\b(?:href|imagesrc)="([^"]+)"/.exec(tag);
    if (hrefMatch) imageRefs.add(normalizeImageRef(hrefMatch[1]));
  }

  // <meta property="og:image|twitter:image" content="...">
  const metaRegex = /<meta\b[^>]*>/gi;
  while ((m = metaRegex.exec(text)) !== null) {
    const tag = m[0];
    const contentMatch = /\bcontent="([^"]+)"/.exec(tag);
    if (!contentMatch) continue;
    // Only consider og/twitter image meta tags
    if (!/\bproperty="og:image/.test(tag) && !/\bname="twitter:image/.test(tag)) continue;
    imageRefs.add(normalizeImageRef(contentMatch[1]));
  }

  // <img src="..."> and srcset="..."
  const srcRegex = /<img\b[^>]*>/gi;
  while ((m = srcRegex.exec(text)) !== null) {
    const tag = m[0];
    const srcMatch = /src="([^"]+)"/.exec(tag);
    if (srcMatch) imageRefs.add(normalizeImageRef(srcMatch[1]));
    const srcsetMatch = /srcset="([^"]+)"/.exec(tag);
    if (srcsetMatch) {
      for (const piece of srcsetMatch[1].split(',')) {
        const url = piece.trim().split(/\s+/)[0];
        if (url) imageRefs.add(normalizeImageRef(url));
      }
    }
  }

  return {
    file: baseName,
    i18nKeys: Array.from(i18nKeys),
    images: Array.from(imageRefs),
  };
}

function normalizeImageRef(url) {
  // Strip query/hash, leading slashes, and the well-known /assets/ mount
  // prefix so references line up with the keys returned by listAssets().
  // HTML uses web paths like /assets/foo.jpg; listAssets() returns the
  // path relative to the assets root (foo.jpg). We pick the latter.
  let s = url.split('#')[0].split('?')[0];
  if (s.startsWith('/')) s = s.slice(1);
  if (s.startsWith('assets/')) s = s.slice('assets/'.length);
  if (s.startsWith('./')) s = s.slice(2);
  return s;
}

function buildKeyIndex() {
  const files = listHtmlFiles();
  const usedKeys = new Map(); // key -> Set<file>
  const usedImages = new Map(); // image -> Set<file>
  for (const f of files) {
    const scan = scanHtmlFile(f);
    for (const k of scan.i18nKeys) {
      if (!usedKeys.has(k)) usedKeys.set(k, new Set());
      usedKeys.get(k).add(scan.file);
    }
    for (const img of scan.images) {
      if (!usedImages.has(img)) usedImages.set(img, new Set());
      usedImages.get(img).add(scan.file);
    }
  }
  return { usedKeys, usedImages };
}

module.exports = { scanHtmlFile, listHtmlFiles, buildKeyIndex };