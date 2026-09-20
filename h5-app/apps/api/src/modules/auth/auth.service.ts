import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
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

  /** 演示策略：生成 6 位数字验证码 → console.log + 落库 */
  async requestOtp(phone: string): Promise<{ sent: true; ttl: number }> {
    const ttl = Number(this.cfg.get('OTP_TTL_SECONDS') ?? 300);
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    const id = 'otp_' + randomBytes(8).toString('hex');

    this.db.run(
      'INSERT INTO OtpRequest (id, phone, code, expiresAt) VALUES (?, ?, ?, ?)',
      id, phone, code, expiresAt,
    );

    this.logger.warn(
      `📨 [OTP] phone=${phone} code=${code} ttl=${ttl}s (从后端终端读取验证码)`,
    );

    return { sent: true, ttl };
  }

  /** 校验 OTP → 找/建用户 → 发 JWT */
  async verifyOtp(
    phone: string,
    code: string,
    meta?: { userAgent?: string; ip?: string },
  ): Promise<{ token: string; user: { id: string; phone: string; role: string; displayName: string | null } }> {
    const otp = this.db.get<{ id: string; code: string; expiresAt: string }>(
      `SELECT id, code, expiresAt FROM OtpRequest
       WHERE phone = ? AND consumedAt IS NULL
       ORDER BY createdAt DESC LIMIT 1`,
      phone,
    );

    if (!otp) {
      throw new BadRequestException('OTP 不存在或已过期');
    }
    if (new Date(otp.expiresAt).getTime() < Date.now()) {
      throw new BadRequestException('OTP 已过期');
    }
    if (otp.code !== code) {
      throw new BadRequestException('OTP 错误');
    }

    this.db.run(
      'UPDATE OtpRequest SET consumedAt = CURRENT_TIMESTAMP WHERE id = ?',
      otp.id,
    );

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