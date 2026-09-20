// 二维码 HMAC 签发 + 验签服务
// 签发格式：{skuId}|{serial}|{batch}|{nonce}
// 算法：HMAC-SHA256(secret, payload) -> hex

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'crypto';

export interface SignPayload {
  skuId: string;
  serial: string;
  batch: string;
  nonce?: string;
}

export interface VerifyResult {
  ok: boolean;
  reason?: 'INVALID_FORMAT' | 'REVOKED' | 'BAD_SIGNATURE' | 'UNKNOWN_QR';
}

@Injectable()
export class QrSignerService {
  private readonly secret: string;

  constructor(cfg: ConfigService) {
    this.secret = cfg.get<string>('QR_HMAC_SECRET') ?? 'dev-only-secret-change-me';
  }

  /** 签发一组二维码内容（payload + signature 二元组） */
  sign(payload: SignPayload): { payload: string; signature: string; qrId: string } {
    const nonce = payload.nonce ?? randomBytes(6).toString('hex');
    const text = `${payload.skuId}|${payload.serial}|${payload.batch}|${nonce}`;
    const signature = createHmac('sha256', this.secret).update(text).digest('hex');
    // qrId = skuId + ':' + nonce（演示期 demo sku 一码一签）
    const qrId = `${payload.skuId}:${nonce}`;
    return { payload: text, signature, qrId };
  }

  /** 仅计算签名（用于 seed.ts 等已知 payload 的场景） */
  signRaw(text: string): string {
    return createHmac('sha256', this.secret).update(text).digest('hex');
  }

  /**
   * 验签 + 验 qrId：传入 qrId（payload 字符串）与 signature（hex），返回 ok 与原因
   * 这是本地纯函数层面的验签——实际产品应在 DB 关联 QrSignature 表
   */
  verify(qrId: string, signature: string): VerifyResult {
    if (!qrId || !signature) return { ok: false, reason: 'INVALID_FORMAT' };
    // payload = qrId 本身（演示期约定：qrId 内含 SKU|serial|batch|nonce）
    const expected = createHmac('sha256', this.secret).update(qrId).digest('hex');
    if (expected !== signature) return { ok: false, reason: 'BAD_SIGNATURE' };
    return { ok: true };
  }
}