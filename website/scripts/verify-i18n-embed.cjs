// 检查 12 个 HTML 的 <script id="i18n-data"> 块是否嵌入全部 14 语种 + JSON 合法
const fs = require('fs');
const path = require('path');

const HTML_DIR = path.join(__dirname, '..');
const EXPECTED = ['en', 'zh', 'bn', 'ja', 'ko', 'vi', 'hi', 'ur', 'ta', 'te', 'ar', 'fr', 'pt', 'es'];

const files = fs.readdirSync(HTML_DIR).filter((f) => f.endsWith('.html')).sort();
console.log('expected langs (' + EXPECTED.length + '): ' + EXPECTED.join(','));
console.log('');
console.log('file                     embed-status  json-valid  langs-count  result');
console.log('----                     ------------  ----------  -----------  ------');

let allOk = true;
for (const f of files) {
  const c = fs.readFileSync(path.join(HTML_DIR, f), 'utf8');
  const m = c.match(/<script id="i18n-data"[\s\S]*?<\/script>/);
  if (!m) {
    console.log(f.padEnd(25) + ' NO block'.padEnd(13) + ' n/a'.padEnd(11) + ' 0'.padEnd(13) + ' FAIL');
    allOk = false;
    continue;
  }
  // 提取 JSON 内容(script 标签内的文本,不计开闭标签本身)
  const inner = m[0]
    .replace(/^<script id="i18n-data"[^>]*>/, '')
    .replace(/<\/script>$/, '');

  let data = null;
  let jsonValid = false;
  try {
    data = JSON.parse(inner);
    jsonValid = true;
  } catch (e) {
    jsonValid = false;
  }

  if (!jsonValid) {
    console.log(f.padEnd(25) + ' yes'.padEnd(13) + ' INVALID'.padEnd(11) + ' 0'.padEnd(13) + ' FAIL');
    allOk = false;
    continue;
  }

  // 顶层必须是对象,且每个值是对象(语言字典)
  const langs = Object.keys(data);
  const allObjs = langs.every((l) => data[l] && typeof data[l] === 'object' && !Array.isArray(data[l]));
  const missing = EXPECTED.filter((l) => !langs.includes(l));
  const extra = langs.filter((l) => !EXPECTED.includes(l));
  const ok = missing.length === 0 && extra.length === 0 && allObjs;
  if (!ok) allOk = false;
  const tail = missing.length ? ' missing=' + missing.join(',') : (extra.length ? ' extra=' + extra.join(',') : (allObjs ? '' : ' (non-obj values)'));
  console.log(f.padEnd(25) + ' yes'.padEnd(13) + ' OK'.padEnd(11) + (langs.length + '/' + EXPECTED.length).padEnd(13) + (ok ? 'PASS' : 'FAIL') + tail);
}

console.log('');
console.log(allOk ? 'SUMMARY: all 12 HTML × 14 langs × valid JSON PASS' : 'SUMMARY: at least one file FAIL');
process.exit(allOk ? 0 : 1);
