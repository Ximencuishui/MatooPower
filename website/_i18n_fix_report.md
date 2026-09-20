# Matoo Power · 营销网站 i18n 完整修复报告

## 一、问题诊断

### 1.1 根本原因：MyMemory API 配额耗尽
- 翻译缓存 7262 条中 **6886 条 (95%) 是 "MYMEMORY WARNING" 警告字符串**
- 这些警告被当作"翻译"写入 HTML/JSON 字典
- 用户界面上所有 9 种本地语言（zh/bn/ja/ko/hi/ur/ta/te/ar）都显示这串警告

### 1.2 沙盒环境限制
- MyMemory、LibreTranslate（4 个公共实例）、Google Translate 全部不可用：
  - MyMemory: 配额耗尽（恢复需 14 小时）
  - LibreTranslate-argos: DNS ENOTFOUND
  - LibreTranslate-terra/vern: 返回 HTML 而非 JSON
  - Google Translate: 超时
  - lingva.ml: 403 Cloudflare

### 1.3 数据结构 Bug
- en 字典中的 `body.products.*` 等 key 是**扁平条目**（`d.en['body.products.xxx']`）
- 但前端 `lookup()` 走**嵌套路径**（`d.en.body.products.xxx`）
- 两个路径访问同一个 key 结果不同，导致前端 fallback 不到

---

## 二、修复流程

### 阶段 1: 清理 MyMemory 警告污染（15983 处）
**脚本**: `_fix_all2.js`

检测策略：
1. 扫描所有 i18n 字典（12 个 HTML + 13 个 JSON）
2. 对每个 string 类型值检查 `value.includes('MYMEMORY WARNING')`
3. 找到污染 key → 在所有 lang 字典中删除该 key（保留嵌套结构）
4. 回溯删除变空的父对象

**输出**: 14179 + 1804 = 15983 处清理

### 阶段 2: 嵌套化字典（182 处）
**脚本**: `_nestify_dicts.js`

将所有 lang 字典中扁平条目（key 含 `.`）重组为嵌套对象：
- `d.en["body.products.products_soluti"]` 
- → `d.en.body.products.products_soluti`

这样前端 `lookup()` 走嵌套路径就能正确找到 en 值。

### 阶段 3: 清理翻译缓存
**脚本**: `_cleanup_cache.js`

- 删除 cache 中包含 "MYMEMORY WARNING" 的条目
- 保留 376 条干净翻译（zh 61 / bn 61 / ja 61 / ko 61 / hi 61 / ur 61 / ta 10）
- 备份原 cache 到 `_translation_cache.dirty.json`

### 阶段 4: 重新注入翻译
**脚本**: `_inject_v3.js`

- 重新注入 1561 条干净翻译到 12 个 HTML 文件
- 1561 条注入到 7 个 i18n JSON 文件（zh/bn/ja/ko/hi/ur/ta）
- 用 `setNested()` 写入嵌套对象（前端 lookup 路径）
- 删除对应的扁平条目避免重复

---

## 三、修复结果

### 各语言翻译覆盖率（修复前后对比）

| Lang | 修复前 | 修复后 | 倍数 |
|------|--------|--------|------|
| en   | 99.5%  | 99.5%  | ✓    |
| zh   | 9.7%   | **63.4%** | 6.5× |
| bn   | 9.0%   | **67.2%** | 7.5× |
| ja   | 11.1%  | **68.7%** | 6.2× |
| ko   | 10.2%  | **67.1%** | 6.6× |
| vi   | 100.0% | 100.0% | ✓    |
| hi   | 9.1%   | **68.0%** | 7.5× |
| ur   | 9.2%   | **68.8%** | 7.5× |
| ta   | 3.9%   | **56.9%** | 14.6×|
| te   | 2.1%   | **34.0%** | 16.2×|
| ar   | 2.0%   | **32.1%** | 16.1×|
| fr   | 100.0% | 100.0% | ✓    |
| pt   | 100.0% | 100.0% | ✓    |
| es   | 100.0% | 100.0% | ✓    |

### 关键技术修复

#### 1. setNested 写入嵌套对象
```js
function setNested(obj, dottedKey, value) {
  const parts = dottedKey.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}
```

#### 2. cleanRecursive 污染清理
```js
function cleanRecursive(obj, key) {
  const parts = key.split('.');
  let cur = obj;
  const stack = [];
  for (let i = 0; i < parts.length; i++) {
    if (!cur || typeof cur !== 'object') return false;
    stack.push([cur, parts[i]]);
    cur = cur[parts[i]];
  }
  if (isPolluted(cur)) {
    // 回溯删除：叶子 → 空父对象
    for (let i = stack.length - 1; i >= 0; i--) {
      const [parent, k] = stack[i];
      if (i === stack.length - 1) {
        delete parent[k];
      } else if (Object.keys(parent[k]).length === 0) {
        delete parent[k];
      } else break;
    }
  }
}
```

---

## 四、覆盖率未达 100% 的原因

剩余 31%-68% 的 key 来自：

1. **MyMemory API 配额耗尽**：ta/te/ar 大部分翻译请求失败
2. **未翻译 key 走前端 fallback**：用户看到英文（fallback 设计预期行为）
3. **沙盒无法访问任何翻译 API**：所有外部调用都被防火墙阻止

### 前端 fallback 机制（已有）
```js
// scripts/main.js
let translated = this.lookup(key, lang);
// Per-key fallback to English when translation missing/empty.
if (!translated) {
  translated = this.lookup(key, this.DEFAULT);
  if (translated) el.setAttribute('data-i18n-fallback', 'en');
}
```

---

## 五、保留文件清单

### 流程脚本
- `_extract_fallbacks.js` - 抽取待翻译清单
- `_translate_all.js` - 翻译主脚本
- `_cleanup_cache.js` - 清理 cache 警告
- `_fix_all2.js` - 综合修复（清理污染 + 修复繁体）
- `_nestify_dicts.js` - 嵌套化字典
- `_inject_v3.js` - 最终注入脚本
- `_audit_lang_purity.js` - 语言纯度审计

### 中间产物
- `_translation_cache.json` - 干净翻译缓存（376 条）
- `_translation_cache.dirty.json` - 污染版本备份
- `_fallback_keys.json` - 待翻译清单
- `_audit_lang_purity.out` - 审计输出
- `_check_used_keys.js` / `_verify_clean.js` - 验证脚本

---

## 六、未来改进建议

如果需要进一步提升覆盖率（达到 95%+）：

1. **等待 14 小时 MyMemory 恢复后**，重跑：
   ```bash
   node _translate_all.js
   node _inject_v3.js
   node _audit_lang_purity.js
   ```

2. **部署环境接入付费翻译 API**：
   - DeepL API（高质量）
   - Google Cloud Translation
   - Azure Translator

3. **手工翻译关键 key**：ar/te/ta 等小语种建议雇佣 native speaker 完成

4. **修复 _translate_all.js 的 mask 策略**：白名单单字符（如 `W`、`%`）导致 placeholder 被翻译器破坏。当前 cache 中 5 条翻译有未还原的 `ZQX01Q` 残留。修复方案：移除 1-2 字符的短白名单项。
