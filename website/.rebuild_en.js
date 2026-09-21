// Matoo Power · en.json rebuild script v2
// More robust HTML parsing: parses each HTML line by line, tracks tag
// nesting properly to extract the immediate text content of each
// data-i18n element.

const fs = require('fs');
const path = require('path');

const websiteDir = __dirname;
const htmlFiles = fs.readdirSync(websiteDir)
  .filter(f => f.endsWith('.html') && !f.startsWith('admin'))
  .map(f => path.join(websiteDir, f));

const enJsonPath = path.join(websiteDir, 'i18n', 'en.json');
const existing = JSON.parse(fs.readFileSync(enJsonPath, 'utf-8'));

function flatten(obj, prefix = '', out = {}) {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        flatten(v, key, out);
      } else {
        out[key] = v;
      }
    }
  }
  return out;
}

function unflatten(flat, skipKeys = new Set()) {
  const out = {};
  for (const [k, v] of Object.entries(flat)) {
    if (skipKeys.has(k)) {
      out[k] = v;
      continue;
    }
    const parts = k.split('.');
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!(p in cur) || typeof cur[p] !== 'object' || Array.isArray(cur[p])) {
        cur[p] = {};
      }
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = v;
  }
  return out;
}

// Inline-block elements that can appear inside a data-i18n parent and whose
// inner text we DO want to include.
const INLINE_TAGS = new Set(['span', 'strong', 'em', 'b', 'i', 'a', 'small', 'code', 'br']);

// Block elements that should NOT be traversed into — they end the text content.
const BLOCK_TAGS = new Set(['div', 'section', 'article', 'main', 'aside', 'header', 'footer', 'nav', 'p', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'form', 'figure', 'figcaption', 'details', 'summary', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

// For each <tag data-i18n="X">...</tag>, find the matching </tag> by
// counting nested opens. Returns the text content with whitespace collapsed,
// or empty string if no text is found before the closing tag.
function extractTextForKey(html, openTagStart) {
  // openTagStart points at '<tagName'. Get the tag name.
  const tagNameMatch = html.slice(openTagStart).match(/^<([a-zA-Z][a-zA-Z0-9]*)/);
  if (!tagNameMatch) return '';
  const tagName = tagNameMatch[1].toLowerCase();
  if (BLOCK_TAGS.has(tagName) && tagName !== 'p' && tagName !== 'h1' && tagName !== 'h2' && tagName !== 'h3' && tagName !== 'h4' && tagName !== 'h5' && tagName !== 'h6' && tagName !== 'li' && tagName !== 'div') {
    // For truly container tags like div/section, just grab immediate text.
    // The current implementation below already handles this.
  }

  // Find the end of the opening tag
  const openEnd = html.indexOf('>', openTagStart);
  if (openEnd === -1) return '';
  // Self-closing? <br/> <img ... />
  if (html[openEnd - 1] === '/') return '';

  // Scan forward, maintaining depth for the same tag. Stop at matching close.
  let pos = openEnd + 1;
  let depth = 1;
  const openRe = new RegExp(`<${tagName}(\\s[^>]*)?>|<${tagName}\\s*/>`, 'gi');
  openRe.lastIndex = pos;
  while (depth > 0) {
    openRe.lastIndex = pos;
    const openMatch = openRe.exec(html);
    const closeRe = new RegExp(`</${tagName}\\s*>`, 'gi');
    closeRe.lastIndex = pos;
    const closeMatch = closeRe.exec(html);
    if (!closeMatch) return ''; // malformed
    if (openMatch && openMatch.index < closeMatch.index) {
      // It's a nested open (or self-closing, which doesn't change depth)
      if (!openMatch[0].endsWith('/>')) depth++;
      pos = openMatch.index + openMatch[0].length;
    } else {
      depth--;
      pos = closeMatch.index + closeMatch[0].length;
      if (depth === 0) {
        // pos is just past the matching </tagName>
        const inner = html.slice(openEnd + 1, closeMatch.index);
        // Collect text from inner, recursing into inline tags only.
        return extractText(inner);
      }
    }
  }
  return '';
}

// Recursively extract text from HTML, treating inline tags as transparent
// containers but stopping at block tags.
function extractText(s) {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '<') {
      // Find tag end
      const end = s.indexOf('>', i);
      if (end === -1) break;
      const tagFull = s.slice(i, end + 1);
      const tagNameMatch = tagFull.match(/^<\/([a-zA-Z][a-zA-Z0-9]*)/);
      if (tagNameMatch) {
        // closing tag — just skip, the recursion caller handles depth
        i = end + 1;
        continue;
      }
      const openNameMatch = tagFull.match(/^<([a-zA-Z][a-zA-Z0-9]*)/);
      const openName = openNameMatch ? openNameMatch[1].toLowerCase() : '';
      // Self-closing?
      if (tagFull.endsWith('/>')) {
        if (openName === 'br') out += ' ';
        i = end + 1;
        continue;
      }
      // Find matching close
      const closeIdx = findMatchingClose(s, openName, end + 1);
      if (closeIdx === -1) {
        i = end + 1;
        continue;
      }
      if (INLINE_TAGS.has(openName)) {
        // recurse to get inner text
        const inner = s.slice(end + 1, closeIdx);
        out += extractText(inner);
        i = closeIdx + openName.length + 3; // skip past </tagname>
      } else {
        // block-level — treat as line break
        out += ' ';
        i = end + 1;
      }
    } else {
      out += ch;
      i++;
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

function findMatchingClose(s, tagName, fromPos) {
  let depth = 1;
  const openRe = new RegExp(`<${tagName}(\\s[^>]*)?>|<${tagName}\\s*/>`, 'gi');
  const closeRe = new RegExp(`</${tagName}\\s*>`, 'gi');
  let pos = fromPos;
  while (depth > 0) {
    openRe.lastIndex = pos;
    closeRe.lastIndex = pos;
    const om = openRe.exec(s);
    const cm = closeRe.exec(s);
    if (!cm) return -1;
    if (om && om.index < cm.index) {
      if (!om[0].endsWith('/>')) depth++;
      pos = om.index + om[0].length;
    } else {
      depth--;
      pos = cm.index + cm[0].length;
      if (depth === 0) return cm.index;
    }
  }
  return -1;
}

// Scan all HTML files
const htmlDefaults = {};
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf-8');
  // Find each opening tag that has data-i18n
  const re = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const key = m[2];
    if (key in htmlDefaults) continue;
    const text = extractTextForKey(html, m.index);
    if (text) htmlDefaults[key] = { value: text, source: path.basename(file) };
  }
}

// Also pull text for keys referenced via data-i18n on <meta> tags and self-closing tags
// (which have no text content but should still be tracked as "no default text")
// — for now we record them in a separate list to count.
const allKeys = new Set();
for (const file of htmlFiles) {
  const re = /data-i18n="([^"]+)"/g;
  let m;
  while ((m = re.exec(file ? fs.readFileSync(file, 'utf-8') : '')) !== null) {
    allKeys.add(m[1]);
  }
}

// Merge
const existingFlat = flatten(existing);
const merged = {};
let fromExisting = 0;
let fromHtml = 0;
let empty = 0;
const emptyList = [];
for (const k of allKeys) {
  if (k in existingFlat) {
    merged[k] = existingFlat[k];
    fromExisting++;
  } else if (k in htmlDefaults) {
    merged[k] = htmlDefaults[k].value;
    fromHtml++;
  } else {
    merged[k] = '';
    empty++;
    emptyList.push(k);
  }
}

const skip = new Set(['_meta.label', '_meta.lang', '_meta.version', '_meta.note']);
const rebuilt = unflatten(merged, skip);
const final = {
  _meta: {
    ...existing._meta,
    note: 'Rebuilt from HTML defaults + existing translations. Authoritative English source.',
    version: '2.0',
  },
  ...rebuilt,
};

// Write with explicit UTF-8 BOM-free encoding
const out = JSON.stringify(final, null, 2) + '\n';
const outPath = path.join(websiteDir, 'i18n', 'en.rebuilt.json');
fs.writeFileSync(outPath, out, { encoding: 'utf-8' });

console.log('=========================================');
console.log(' en.json rebuild v2 summary');
console.log('=========================================');
console.log(`  HTML files scanned:        ${htmlFiles.length}`);
console.log(`  Unique i18n keys in HTML:  ${allKeys.size}`);
console.log(`  Keys from existing en.json: ${fromExisting}  (existing translation kept)`);
console.log(`  Keys extracted from HTML:  ${fromHtml}  (default English text)`);
console.log(`  Keys with empty value:     ${empty}  (need manual fill)`);
console.log('');
console.log(`  Output: ${outPath}`);
console.log('');
if (empty > 0) {
  console.log('  All empty keys (need manual fill):');
  for (const k of emptyList) console.log(`    - ${k}`);
}

// Sanity-check some specific keys
console.log('');
console.log('  Sanity check on key extractions:');
const checks = [
  'body.index.matoo_power_rel',
  'body.about.about',
  'body.privacy.privacy_policy',
  'nav.products',
  'hero.title',
];
for (const k of checks) {
  const v = merged[k] || '(empty)';
  console.log(`    ${k}: ${v.length > 80 ? v.slice(0, 80) + '...' : v}`);
}
