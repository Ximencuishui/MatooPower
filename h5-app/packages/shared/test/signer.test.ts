// Minimal sign/verify round-trip test for @matoo/shared.
// Run with: `npm test` (uses `node --test --import tsx test/`).
//
// Why `--import tsx`? Our package is ESM-only and written in TS. tsx
// transparently compiles & loads .ts under Node's test runner so we don't
// need a separate build step for tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sign as signPayload, verify as verifyPayload } from '../src/qr/signer.js';
import { encodeQrWithSecret, parseQr, verifyQr } from '../src/qr/format.js';

const SECRET = 'test-secret-do-not-use-in-prod';
const PAYLOAD = {
  skuId: 'MP-12V-100Ah',
  serial: 'SN-0001-XYZ',
  batch: 'BATCH-2024Q1',
};

test('sign + verify same payload → ok', async () => {
  const sig = await signPayload('hello world', SECRET);
  assert.equal(sig.length, 64);                    // 32 bytes hex
  assert.match(sig, /^[a-f0-9]{64}$/);
  assert.equal(await verifyPayload('hello world', sig, SECRET), true);
});

test('mutate 1 byte of payload → verify fails', async () => {
  const sig = await signPayload('hello world', SECRET);
  // extra char
  assert.equal(await verifyPayload('hello world!', sig, SECRET), false);
  // capitalisation change
  assert.equal(await verifyPayload('Hello world', sig, SECRET), false);
  // corrupted signature hex
  const corrupted = sig.slice(0, -1) + (sig.endsWith('0') ? '1' : '0');
  assert.equal(await verifyPayload('hello world', corrupted, SECRET), false);
  // non-hex signature
  assert.equal(await verifyPayload('hello world', 'not-a-hex-string', SECRET), false);
});

test('wrong secret → verify fails', async () => {
  const sig = await signPayload('payload-X', SECRET);
  assert.equal(await verifyPayload('payload-X', sig, 'not-the-secret'), false);
});

test('QR encode → parse → verify round-trip', async () => {
  const wire = await encodeQrWithSecret(PAYLOAD, SECRET);
  // Matoo:<skuId>:<serial>:<batch>:<hmacHex>
  assert.equal(wire.split(':').length, 5);
  assert.match(wire, /^Matoo:/);

  const parsed = parseQr(wire);
  assert.deepEqual(parsed, { ...PAYLOAD, hmacHex: parsed.hmacHex });

  const verified = await verifyQr(wire, SECRET);
  assert.deepEqual(verified, parsed);
});

test('QR with wrong secret → verifyQr throws', async () => {
  const wire = await encodeQrWithSecret(PAYLOAD, SECRET);
  await assert.rejects(verifyQr(wire, 'attacker-secret'));
});

test('QR with tampered SKU → verifyQr throws', async () => {
  const wire = await encodeQrWithSecret(PAYLOAD, SECRET);
  const tampered = wire.replace('MP-12V-100Ah', 'FAKE-12V-100Ah');
  await assert.rejects(verifyQr(tampered, SECRET));
});

test('QR parse rejects malformed strings', async () => {
  assert.throws(() => parseQr('not-a-matoo-qr'));
  assert.throws(() => parseQr('Matoo:a:b:c:short'));   // hmac too short
  assert.throws(() => parseQr('Matoo:a:b'));            // too few parts
});