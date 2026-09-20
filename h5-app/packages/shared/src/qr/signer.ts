// HMAC-SHA256 signer/verifier with dual runtime:
//   - Node.js  : built-in `node:crypto`
//   - Browser  : Web Crypto `crypto.subtle`
//
// We auto-pick on first call. Both paths return the same hex string so
// the QR payload format is interoperable across web & api.

export type Runtime = 'node' | 'browser';

export function getRuntime(): Runtime {
  // `globalThis.crypto` exists in Node 18+; check for subtle to disambiguate
  // from the (very different) `node:crypto` module surface.
  if (typeof globalThis !== 'undefined' && (globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle) {
    // In Node 20+, `globalThis.crypto.subtle` is exposed alongside node:crypto.
    // Use it: identical Web-Crypto semantics means web & node behave the same.
    return 'browser';
  }
  return 'node';
}

export interface Signer {
  runtime: Runtime;
  sign(payload: string, secret: string): Promise<string>;
  verify(payload: string, signatureHex: string, secret: string): Promise<boolean>;
}

// ---------- Node implementation (createHmac) ----------

import { createHmac, timingSafeEqual } from 'node:crypto';

const nodeSigner: Signer = {
  runtime: 'node',
  async sign(payload, secret) {
    return createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  },
  async verify(payload, signatureHex, secret) {
    // Reject anything that isn't exactly 64 lowercase hex chars to avoid
    // Buffer.from silently parsing partial hex and producing a shorter buffer.
    if (typeof signatureHex !== 'string' || !/^[a-f0-9]{64}$/.test(signatureHex)) {
      return false;
    }
    const expected = createHmac('sha256', secret).update(payload, 'utf8').digest();
    const provided = Buffer.from(signatureHex, 'hex');
    return timingSafeEqual(provided, expected);
  },
};

// ---------- Browser (Web Crypto subtle) implementation ----------

async function browserSign(payload: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return bufToHex(sig);
}

const browserSigner: Signer = {
  runtime: 'browser',
  sign: browserSign,
  async verify(payload, signatureHex, secret) {
    const expectedHex = await browserSign(payload, secret);
    return constantTimeEqualHex(expectedHex, signatureHex);
  },
};

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function bufToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += (bytes[i] ?? 0).toString(16).padStart(2, '0');
  return s;
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) {
    r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return r === 0;
}

// ---------- Public API ----------

let resolvedSigner: Signer | null = null;
function pick(): Signer {
  if (resolvedSigner) return resolvedSigner;
  // Prefer Node's createHmac when both runtimes are theoretically available
  // (e.g. Node 20+ exposes globalThis.crypto.subtle too). `node:crypto` is the
  // requested algorithm per spec, so it takes precedence.
  if (typeof process !== 'undefined' && (process as { versions?: { node?: string } }).versions?.node) {
    resolvedSigner = nodeSigner;
  } else {
    resolvedSigner = browserSigner;
  }
  return resolvedSigner;
}

/** Sign the payload with HMAC-SHA256 and return a lowercase hex string. */
export function sign(payload: string, secret: string): Promise<string> {
  return pick().sign(payload, secret);
}

/** Constant-time verification of an HMAC-SHA256 hex signature. */
export function verify(payload: string, signatureHex: string, secret: string): Promise<boolean> {
  return pick().verify(payload, signatureHex, secret);
}