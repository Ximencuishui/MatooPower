// v1.4 T-2d X4:OTP 投递抽象层
// 演示期：ConsoleOtpDelivery → pino warn 日志（含验证码，仅供开发调试）
// 生产期：HttpWebhookOtpDelivery → 调用任意 SMS provider webhook（Twilio Functions / 阿里云 / 自建网关）
//
// 设计目标：
// - 零新增 npm 依赖（只用 Node 22+ 内置 fetch）
// - 生产期硬阻断 ConsoleOtpDelivery，避免漏出验证码
// - 渠道由 OTP_DELIVERY 环境变量切换，运行时根据 env 即时选择

import { Logger } from '@nestjs/common';

export interface OtpDeliveryArgs {
  phone: string;
  code: string;
  ttlSeconds: number;
}

export interface OtpDeliveryResult {
  ok: boolean;
  channel: string;
  error?: string;
}

/** 投递渠道接口 */
export interface OtpDelivery {
  readonly channel: string;
  deliver(args: OtpDeliveryArgs): Promise<OtpDeliveryResult>;
}

/** 演示模式：写日志。生产期默认禁止（需要显式开关） */
export class ConsoleOtpDelivery implements OtpDelivery {
  readonly channel = 'console';

  constructor(private readonly logger: Logger) {}

  async deliver({ phone, code, ttlSeconds }: OtpDeliveryArgs): Promise<OtpDeliveryResult> {
    const allowInProd = process.env.OTP_ALLOW_CONSOLE_IN_PROD === '1';
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd && !allowInProd) {
      // 生产期硬阻断：明确抛错而不是悄悄 log，避免验证码外泄到生产日志
      throw new Error(
        '[OtpDelivery] ConsoleOtpDelivery 不允许在 NODE_ENV=production 使用。' +
          '生产期应配 OTP_DELIVERY=http-webhook + OTP_WEBHOOK_URL=<SMS 网关>。' +
          '如需紧急启用调试模式,请显式设 OTP_ALLOW_CONSOLE_IN_PROD=1。',
      );
    }
    this.logger.warn(
      `📨 [OTP-${isProd ? 'PROD-OVERRIDE' : 'DEV'}] phone=${phone} code=${code} ttl=${ttlSeconds}s (从后端终端读取)`,
    );
    return { ok: true, channel: this.channel };
  }
}

/** 生产模式:HTTP webhook,通用对接任何 SMS provider
 *  - OTP_WEBHOOK_URL:网关 URL(必填)
 *  - OTP_WEBHOOK_TOKEN:Bearer token(可选,用于 HMAC 鉴权)
 *  - OTP_WEBHOOK_TIMEOUT_MS:超时(默认 5000ms)
 *  请求体:{ phone, code, ttl }
 *  期望 2xx = ok,其它 = fail(由网关代发短信) */
export class HttpWebhookOtpDelivery implements OtpDelivery {
  readonly channel = 'http-webhook';

  async deliver({ phone, code, ttlSeconds }: OtpDeliveryArgs): Promise<OtpDeliveryResult> {
    const url = process.env.OTP_WEBHOOK_URL;
    if (!url) {
      return {
        ok: false,
        channel: this.channel,
        error: 'OTP_WEBHOOK_URL 未配置,无法投递验证码',
      };
    }
    const timeoutMs = Number(process.env.OTP_WEBHOOK_TIMEOUT_MS ?? 5000);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const token = process.env.OTP_WEBHOOK_TOKEN;
    if (token) headers.authorization = 'Bearer ' + token;
    const src = process.env.OTP_WEBHOOK_SOURCE ?? 'matoo-h5-app';
    headers['x-otp-source'] = src;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone, code, ttl: ttlSeconds, source: src }),
        signal: ctl.signal,
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        return {
          ok: false,
          channel: url,
          error: `HTTP ${res.status}: ${txt.slice(0, 200)}`,
        };
      }
      return { ok: true, channel: url };
    } catch (e: any) {
      return {
        ok: false,
        channel: url,
        error: e?.name === 'AbortError' ? `timeout ${timeoutMs}ms` : (e?.message ?? String(e)),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** 工厂:根据 OTP_DELIVERY 环境变量选择渠道 */
export function createOtpDelivery(logger: Logger): OtpDelivery {
  const choice = (process.env.OTP_DELIVERY ?? 'console').toLowerCase();
  switch (choice) {
    case 'http-webhook':
    case 'http':
    case 'webhook':
      return new HttpWebhookOtpDelivery();
    case 'console':
      return new ConsoleOtpDelivery(logger);
    default:
      // 未知值默认 console,显式日志提示
      logger.warn(
        `[OtpDelivery] 未识别的 OTP_DELIVERY='${choice}',回退到 console。生产期推荐 http-webhook。`,
      );
      return new ConsoleOtpDelivery(logger);
  }
}