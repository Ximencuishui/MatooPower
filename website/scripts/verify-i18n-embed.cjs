// 检查 12 个 HTML 的 <script id="i18n-data"> 块是否嵌入全部 14 语种
const fs = require('fs');
const path = require('path');

const HTML_DIR = path.join(__dirname, '..');
const EXPECTED = ['en', 'zh', 'bn', 'ja', 'ko', 'vi', 'hi', 'ur', 'ta', 'te', 'ar', 'fr', 'pt', 'es'];

const files = fs.readdirSync(HTML_DIR).filter((f) => f.endsWith('.html')).sort();
console.log('expected langs (' + EXPECTED.length + '): ' + EXPECTED.join(','));
console.log('');
console.log('file                     embedded langs                                        status');
console.log('----                     --------------                                        ------');

let allOk = true;
for (const f of files) {
  const c = fs.readFileSync(path.join(HTML_DIR, f), 'utf8');
  const m = c.match(/<script id="i18n-data"[\s\S]*?<\/script>/);
  if (!m) {
    console.log(f.padEnd(25) + ' NO <script id="i18n-data"> block                          FAIL');
    allOk = false;
    continue;
  }
  const block = m[0];
  const langsFound = (block.match(/"([a-z]{2})":\s*\{/g) || []).map((s) => s.match(/"([a-z]{2})"/)[1]);
  const unique = Array.from(new Set(langsFound));
  const missing = EXPECTED.filter((l) => !unique.includes(l));
  const extra = unique.filter((l) => !EXPECTED.includes(l));
  const status = missing.length === 0 && unique.length === EXPECTED.length ? 'PASS' : 'FAIL';
  if (status !== 'PASS') allOk = false;
  const tail = missing.length ? ' missing=' + missing.join(',') : (extra.length ? ' extra=' + extra.join(',') : '');
  console.log(f.padEnd(25) + ' ' + unique.join(',').padEnd(50) + ' ' + status + tail);
}

console.log('');
console.log(allOk ? 'SUMMARY: all 12 HTML × 14 langs PASS' : 'SUMMARY: at least one file FAIL');
process.exit(allOk ? 0 : 1);
