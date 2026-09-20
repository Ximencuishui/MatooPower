// QR payload format:
//   Matoo:<skuId>:<serial>:<batch>:<hmacHex>
//
// The HMAC covers everything *before* it:
//   payload = `${skuId}:${serial}:${batch}`
// `hmacHex` is the 64-character lowercase hex of HMAC-SHA256(payload, secret).

import { sign, verify } from './signer.js';

export const QR_PREFIX = 'Matoo';

export interface QrPayload {
  skuId: string;
  serial: string;
  batch: string;
  hmacHex: string;
}

/** Compute the canonical HMAC input for a QR payload (everything before hmac). */
export function qrInput(p: Omit<QrPayload, 'hmacHex'>): string {
  return `${p.skuId}:${p.serial}:${p.batch}`;
}

/** Encode a payload into the wire string `Matoo:skuId:serial:batch:hmacHex`. */
export async function encodeQr(payload: QrPayload): Promise<string> {
  return `${QR_PREFIX}:${payload.skuId}:${payload.serial}:${payload.batch}:${payload.hmacHex}`;
}

/**
 * Convenience: encode a payload by computing the HMAC on the fly with the given secret.
 */
export async function encodeQrWithSecret(
  p: Omit<QrPayload, 'hmacHex'>,
  secret: string,
): Promise<string> {
  const hmacHex = await sign(qrInput(p), secret);
  return encodeQr({ ...p, hmacHex });
}

/**
 * Parse a QR string. Throws if the prefix is wrong or the HMAC isn't 64-hex.
 * Does NOT verify the signature (use {@link verifyQr} for that).
 */
export function parseQr(raw: string): QrPayload {
  const parts = raw.split(':');
  if (parts.length !== 5) {
    throw new Error(`qr: expected 5 ':'-separated parts, got ${parts.length}`);
  }
  const [prefix, skuId, serial, batch, hmacHex] = parts as [string, string, string, string, string];
  if (prefix !== QR_PREFIX) {
    throw new Error(`qr: bad prefix "${prefix}"`);
  }
  if (!/^[a-f0-9]{64}$/i.test(hmacHex)) {
    throw new Error('qr: hmacHex must be 64-char hex');
  }
  return { skuId, serial, batch, hmacHex: hmacHex.toLowerCase() };
}

/**
 * Parse + verify a QR string. Returns the parsed payload on success, throws on failure.
 *
 * Performs constant-time HMAC verification via `verify()` so a wrong-secret
 * attacker cannot measure timing differences between valid/invalid QR codes.
 */
export async function verifyQr(raw: string, secret: string): Promise<QrPayload> {
  const payload = parseQr(raw);
  const ok = await verify(qrInput(payload), payload.hmacHex, secret);
  if (!ok) throw new Error('qr: signature mismatch');
  return payload;
}