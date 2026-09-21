import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { Public } from '../../common/guards/jwt-auth.guard';
import { MATOO_COOKIE } from './jwt.strategy';

@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // P0-8 Phase 1：登录成功同时种 httpOnly cookie（httpOnly 防 XSS 窃取；
  // sameSite=lax 防 CSRF；Secure 仅生产（localhost http 下浏览器不存 Secure cookie）；
  // maxAge 与 JWT 默认 7d 对齐。body 仍返回 token 兼容演示期前端，Phase 2 移除）
  private setJwtCookie(res: Response, token: string) {
    res.cookie(MATOO_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  /** 演示期：申请 6 位 OTP，从后端日志读取 */
  @Public()
  // P0-5 OTP 申请 5/min/IP（防短信轰炸）
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a 6-digit OTP via phone' })
  @ApiResponse({ status: 200, description: 'OTP generated and logged to server console (demo mode)' })
  async requestOtp(@Body() body: RequestOtpDto) {
    const ttl = await this.auth.requestOtp(body.phone);
    return { ok: true, phone: body.phone, ...ttl };
  }

  /** 校验 OTP → 返回 JWT */
  @Public()
  // P0-5 校验尝试 10/min/IP（防暴力破解）
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and receive JWT' })
  async verifyOtp(
    @Body() body: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.verifyOtp(body.phone, body.code, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    // P0-8 双通道：Set-Cookie httpOnly + body token（Phase 1）
    this.setJwtCookie(res, result.token);
    return { ok: true, ...result };
  }

  /** email + password 登录 */
  @Public()
  // P0-5 登录尝试 10/min/IP
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('email/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email + password (demo accounts only)' })
  async emailLogin(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.loginWithEmail(body.email, body.password, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    // P0-8 双通道：Set-Cookie httpOnly + body token（Phase 1）
    this.setJwtCookie(res, result.token);
    return { ok: true, ...result };
  }
}