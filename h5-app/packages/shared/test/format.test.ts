// QR format 层边界测试(@matoo/shared)
// Run with: `npm test` (uses `node --test --import tsx test/`).
//
// 与 signer.test.ts 的分工:本文件只测 format.ts 的编解码/校验边界,
// 不重复 signer 层的往返用例(signer.test.ts 已覆盖 round-trip 与篡改拒绝)。
// 覆盖:
//   1. qrInput 规范拼装(skuId:serial:batch,无前缀无 hmac)
//   2. qrInput 值内含冒号 → 不转义(契约:parseQr 将因段数超限失败)
//   3. encodeQr 原样输出 hmacHex(不改变大小写)
//   4. parseQr 正常 5 段字段提取
//   5. parseQr 大写 hmac → 归一化为小写
//   6. parseQr 段数不足(4 段) → 抛错
//   7. parseQr 段数超限(值内冒号,6 段) → 抛错
//   8. parseQr 前缀错误 → 抛错
//   9. parseQr hmac 长度 63/65 → 抛错
//  10. parseQr hmac 64 位但含非 hex 字符 → 抛错
//  11. parseQr 空字段接受(行为契约:Matoo::b:c:… 合法)
//  12. verifyQr 成功链路 + 返回 hmac 小写
//  13. verifyQr 原样大写 hmac → 验签前归一化,仍可验过
//  14. verifyQr 篡改 → "signature mismatch"

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { qrInput, encodeQr, parseQr, verifyQr, encodeQrWithSecret } from '../src/qr/format.js';

const SECRET = 'test-secret-do-not-use-in-prod';
const HEX64 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

test('qrInput:skuId:serial:batch 规范拼装,不含前缀与 hmac', () => {
  assert.equal(qrInput({ skuId: 'MP-12V', serial: 'SN-1', batch: 'B-1' }), 'MP-12V:SN-1:B-1');
  assert.equal(qrInput({ skuId: 'a', serial: 'b', batch: 'c' }), 'a:b:c');
});

test('qrInput:字段值内含冒号 → 原样保留(不转义,交由 parse 层抛错)', () => {
  assert.equal(qrInput({ skuId: 'A:B', serial: 'c', batch: 'd' }), 'A:B:c:d');
});

test('encodeQr:按 Matoo:<skuId>:<serial>:<batch>:<hmacHex> 原样输出', async () => {
  const wire = await encodeQr({
    skuId: 'a', serial: 'b', batch: 'c', hmacHex: HEX64.toUpperCase(),
  });
  assert.equal(wire, `Matoo:a:b:c:${HEX64.toUpperCase()}`);
});

test('parseQr:正常 5 段提取字段', () => {
  const p = parseQr(`Matoo:sku-9:SN-2:B3:${HEX64}`);
  assert.deepEqual(p, { skuId: 'sku-9', serial: 'SN-2', batch: 'B3', hmacHex: HEX64 });
});

test('parseQr:大写 hmac → 归一化为小写', () => {
  const p = parseQr(`Matoo:sku-9:SN-2:B3:${HEX64.toUpperCase()}`);
  assert.equal(p.hmacHex, HEX64);
});

test('parseQr:段数不足(4 段) → 抛错', () => {
  assert.throws(() => parseQr(`Matoo:sku-9:SN-2:${HEX64}`), /expected 5/);
});

test('parseQr:值内冒号溢出字段(6 段) → 抛错', () => {
  assert.throws(() => parseQr(`Matoo:sku:9:SN-2:B3:${HEX64}`), /expected 5/);
});

test('parseQr:前缀错误 → 抛错', () => {
  assert.throws(() => parseQr(`Natoo:sku-9:SN-2:B3:${HEX64}`), /bad prefix/);
});

test('parseQr:hmac 长度 63/65 → 抛错', () => {
  assert.throws(() => parseQr(`Matoo:a:b:c:${HEX64.slice(1)}`));
  assert.throws(() => parseQr(`Matoo:a:b:c:${HEX64}0`));
});

test('parseQr:hmac 64 位但含非 hex 字符 → 抛错', () => {
  const bad = `g${HEX64.slice(1)}`;   // 末尾 'g' 非法
  assert.throws(() => parseQr(`Matoo:a:b:c:${bad}`), /64-char hex/);
});

test('parseQr:空字段接受(skuId="") → 行为契约', () => {
  const p = parseQr(`Matoo::SN-2:B3:${HEX64}`);
  assert.equal(p.skuId, '');
  assert.equal(p.serial, 'SN-2');
});

test('verifyQr:encodeQrWithSecret → 验签成功,payload 还原且 hmac 小写', async () => {
  const wire = await encodeQrWithSecret({ skuId: 'MP-12V-100Ah', serial: 'SN-0001-XYZ', batch: 'BATCH-2024Q1' }, SECRET);
  const payload = await verifyQr(wire, SECRET);
  assert.equal(payload.skuId, 'MP-12V-100Ah');
  assert.equal(payload.serial, 'SN-0001-XYZ');
  assert.equal(payload.batch, 'BATCH-2024Q1');
  assert.match(payload.hmacHex, /^[a-f0-9]{64}$/);
});

test('verifyQr:原样 hmac 大写 → 常量时间验签前先归一化,仍可验过', async () => {
  const wire = await encodeQrWithSecret({ skuId: 'a', serial: 'b', batch: 'c' }, SECRET);
  const uppercase = `Matoo:a:b:c:${wire.split(':')[4]!.toUpperCase()}`;
  const payload = await verifyQr(uppercase, SECRET);
  assert.equal(payload.hmacHex, wire.split(':')[4]!.toLowerCase());
});

test('verifyQr:篡改 hmac → "signature mismatch"', async () => {
  const wire = await encodeQrWithSecret({ skuId: 'a', serial: 'b', batch: 'c' }, SECRET);
  const parts = wire.split(':');
  parts[4] = 'f'.repeat(64);
  await assert.rejects(verifyQr(parts.join(':'), SECRET), /signature mismatch/);
});