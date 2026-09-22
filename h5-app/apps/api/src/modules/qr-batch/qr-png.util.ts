// v1.3 P0:QR PNG 生成工具(基于 qrcode 库)
// 输出: Buffer(PNG)+ rawPayload(payload + '|' + signature) 便于扫码头解析

import * as QRCode from 'qrcode';

export interface QrPngOptions {
  width?: number;        // 像素,默认 512
  margin?: number;       // 静默区,默认 2
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

export async function generateQrPng(text: string, opts: QrPngOptions = {}): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    width: opts.width ?? 512,
    margin: opts.margin ?? 2,
    errorCorrectionLevel: opts.errorCorrectionLevel ?? 'M',
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}