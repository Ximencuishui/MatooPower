#!/usr/bin/env node
/**
 * strip-bom.js · 移除 i18n/*.json 文件开头的 UTF-8 BOM (0xEF 0xBB 0xBF)
 *
 * PowerShell 写入文件时常常添加 BOM，server 端 store.js 已能 strip，但 BOM 仍
 * 会污染源码 diff 与外部工具（jq / IDE）。此脚本把 BOM 一次性抹掉，幂等：
 * 已无 BOM 的文件直接 [skip]，有 BOM 的 [ok]。
 *
 * 用法：`node scripts/strip-bom.js`
 * 退出码：成功返回 0；失败 1。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '..', 'i18n');
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

let ok = 0;
let skip = 0;
let fail = 0;

const files = fs.readdirSync(I18N_DIR).filter((f) => f.endsWith('.json')).sort();
for (const f of files) {
  const file = path.join(I18N_DIR, f);
  let buf;
  try {
    buf = fs.readFileSync(file);
  } catch (e) {
    console.log('[fail] ' + f + ' read error: ' + e.message);
    fail++;
    continue;
  }
  if (buf.length >= 3 && buf[0] === BOM[0] && buf[1] === BOM[1] && buf[2] === BOM[2]) {
    try {
      fs.writeFileSync(file, buf.slice(3));
      console.log('[ok]   ' + f + ' BOM stripped (' + buf.length + ' -> ' + (buf.length - 3) + ' bytes)');
      ok++;
    } catch (e) {
      console.log('[fail] ' + f + ' write error: ' + e.message);
      fail++;
    }
  } else {
    console.log('[skip] ' + f);
    skip++;
  }
}

console.log('');
console.log('summary: ok=' + ok + ' skip=' + skip + ' fail=' + fail);
process.exit(fail > 0 ? 1 : 0);
