import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomInt, randomBytes } from 'crypto';
import { DbService } from '../../common/db/db';

interface UserRow {
  id: string;
  phone: string | null;
  email: string | null;
  passwordHash: string | null;
  role: string;
  displayName: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
    private readonly db: DbService,
  ) {}

  /** P0-9：统计窗口内（默认 15 分钟）失败次数 */
  private countRecentFails(phone: string, lockMinutes: number): number {
    return this.db.get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM OtpAttempt
       WHERE phone = ? AND ok = 0
       AND createdAt >= datetime('now', ?)`,
      phone, `-${lockMinutes} minutes`,
    )?.c ?? 0;
  }

  /** P0-9：落一条验证尝试审计行（ok=1 成功 / ok=0 失败） */
  private recordOtpAttempt(phone: string, ok: boolean) {
    this.db.run(
      'INSERT INTO OtpAttempt (id, phone, ok) VALUES (?, ?, ?)',
      'otpa_' + randomBytes(8).toString('hex'), phone, ok ? 1 : 0,
    );
  }

  /** 演示策略：生成 6 位数字验证码 → console.log + 落库 */
  async requestOtp(phone: string): Promise<{ sent: true; ttl: number }> {
    const ttl = Number(this.cfg.get('OTP_TTL_SECONDS') ?? 300);
    // 演示期可设 DEV_FIXED_OTP=123456 跳过随机码，调试更顺手；生产必须留空
    const fixed = this.cfg.get<string>('DEV_FIXED_OTP');
    const code = fixed && fixed.trim().length > 0
      ? fixed.trim().padStart(6, '0').slice(-6)
      : String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    const id = 'otp_' + randomBytes(8).toString('hex');

    this.db.run(
      'INSERT INTO OtpRequest (id, phone, code, expiresAt) VALUES (?, ?, ?, ?)',
      id, phone, code, expiresAt,
    );

    if (fixed && fixed.trim().length > 0) {
      this.logger.warn(`📨 [OTP-DEV] phone=${phone} code=${code} (固定调试码,来自 DEV_FIXED_OTP)`);
    } else {
      this.logger.warn(
        `📨 [OTP] phone=${phone} code=${code} ttl=${ttl}s (从后端终端读取验证码)`,
      );
    }

    return { sent: true, ttl };
  }

  /** 校验 OTP → 找/建用户 → 发 JWT */
  async verifyOtp(
    phone: string,
    code: string,
    meta?: { userAgent?: string; ip?: string },
  ): Promise<{ token: string; user: { id: string; phone: string; role: string; displayName: string | null } }> {
    // P0-9 账户级锁定：15 分钟窗口内失败 ≥ OTP_MAX_FAILS(5) → 429（锁定优先于 code 校验）
    // 与 P0-5 的 IP 级限流（5/min 全端点）互补：此为本 phone 维度爆破防护
    const maxFails = Number(this.cfg.get('OTP_MAX_FAILS') ?? 5);
    const lockMinutes = Number(this.cfg.get('OTP_LOCK_MINUTES') ?? 15);
    const fails = this.countRecentFails(phone, lockMinutes);
    if (fails >= maxFails) {
      throw new ThrottlerException('OTP 验证失败次数过多，账户已锁定，请稍后再试');
    }

    const otp = this.db.get<{ id: string; code: string; expiresAt: string }>(
      `SELECT id, code, expiresAt FROM OtpRequest
       WHERE phone = ? AND consumedAt IS NULL
       ORDER BY createdAt DESC LIMIT 1`,
      phone,
    );

    if (!otp) {
      this.recordOtpAttempt(phone, false);
      throw new BadRequestException('OTP 不存在或已过期');
    }
    if (new Date(otp.expiresAt).getTime() < Date.now()) {
      this.recordOtpAttempt(phone, false);
      throw new BadRequestException('OTP 已过期');
    }
    if (otp.code !== code) {
      this.recordOtpAttempt(phone, false);
      const rest = maxFails - fails - 1;
      throw new BadRequestException(
        rest > 0 ? `OTP 错误（剩余 ${rest} 次机会）` : 'OTP 错误',
      );
    }

    this.db.run(
      'UPDATE OtpRequest SET consumedAt = CURRENT_TIMESTAMP WHERE id = ?',
      otp.id,
    );
    // 成功：清零失败计数（删除窗口内失败记录）+ 落一条成功审计行
    this.db.run('DELETE FROM OtpAttempt WHERE phone = ? AND ok = 0', phone);
    this.recordOtpAttempt(phone, true);

    // 找/建用户
    let user = this.db.get<UserRow>('SELECT * FROM User WHERE phone = ?', phone);
    if (!user) {
      const id = 'usr_' + randomBytes(8).toString('hex');
      this.db.run(
        "INSERT INTO User (id, phone, role) VALUES (?, ?, 'customer')",
        id, phone,
      );
      user = this.db.get<UserRow>('SELECT * FROM User WHERE id = ?', id);
    }
    if (!user) throw new BadRequestException('用户创建失败');

    const payload = { sub: user.id, role: user.role, phone: user.phone };
    const token = await this.jwt.signAsync(payload, {
      expiresIn: this.cfg.get('JWT_EXPIRES_IN') ?? '7d',
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    this.db.run(
      'INSERT INTO Session (id, userId, token, expiresAt, userAgent, ip) VALUES (?, ?, ?, ?, ?, ?)',
      'ses_' + randomBytes(8).toString('hex'),
      user.id, token, expiresAt,
      meta?.userAgent ?? null, meta?.ip ?? null,
    );

    return {
      token,
      user: {
        id: user.id,
        phone: user.phone ?? phone,
        role: user.role,
        displayName: user.displayName,
      },
    };
  }

  /** email + password 登录 */
  async loginWithEmail(
    email: string,
    password: string,
    meta?: { userAgent?: string; ip?: string },
  ): Promise<{ token: string; user: { id: string; email: string; role: string; displayName: string | null } }> {
    const user = this.db.get<UserRow>('SELECT * FROM User WHERE email = ?', email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('邮箱或密码错误');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const payload = { sub: user.id, role: user.role, email: user.email };
    const token = await this.jwt.signAsync(payload, {
      expiresIn: this.cfg.get('JWT_EXPIRES_IN') ?? '7d',
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    this.db.run(
      'INSERT INTO Session (id, userId, token, expiresAt, userAgent, ip) VALUES (?, ?, ?, ?, ?, ?)',
      'ses_' + randomBytes(8).toString('hex'),
      user.id, token, expiresAt,
      meta?.userAgent ?? null, meta?.ip ?? null,
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email ?? email,
        role: user.role,
        displayName: user.displayName,
      },
    };
  }
}