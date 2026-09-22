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

  // P0-1 v1.2:登录成功同时种 httpOnly cookie
  // - httpOnly:防 XSS 窃取
  // - sameSite=strict:防 CSRF(同站内请求才带 cookie,跨站表单/链接跳转不带)
  // - secure:仅生产(localhost http 下浏览器不存 Secure cookie,演示期放行)
  // - maxAge:与 JWT 默认 7d 对齐
  // - path=/:全站可用,前端 fetch credentials: 'include' 自动发送
  // body 仍返回 token 兼容演示期前端 localStorage,Phase 2 可移除
  private setJwtCookie(res: Response, token: string) {
    res.cookie(MATOO_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  // P0-1 v1.2:清除 cookie(同样配置以确保浏览器匹配 + 删除)
  private clearJwtCookie(res: Response) {
    res.clearCookie(MATOO_COOKIE, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
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
    // P0-1 双通道:Set-Cookie httpOnly + body token(演示期兼容)
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
    // P0-1 双通道:Set-Cookie httpOnly + body token(演示期兼容)
    this.setJwtCookie(res, result.token);
    return { ok: true, ...result };
  }

  // P0-1 v1.2:登出端点 — 清 cookie(即便调用方没带 cookie,也保证 Set-Cookie 头正确)
  // 同时返回 ok:true 给前端做兜底清除 localStorage
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout (clears httpOnly cookie)' })
  async logout(@Res({ passthrough: true }) res: Response) {
    this.clearJwtCookie(res);
    return { ok: true };
  }
}