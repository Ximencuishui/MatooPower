import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { Public } from '../../common/guards/jwt-auth.guard';

@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** 演示期：申请 6 位 OTP，从后端日志读取 */
  @Public()
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
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and receive JWT' })
  async verifyOtp(@Body() body: VerifyOtpDto, @Req() req: Request) {
    const result = await this.auth.verifyOtp(body.phone, body.code, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    return { ok: true, ...result };
  }

  /** email + password 登录 */
  @Public()
  @Post('email/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email + password (demo accounts only)' })
  async emailLogin(@Body() body: LoginDto, @Req() req: Request) {
    const result = await this.auth.loginWithEmail(body.email, body.password, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    return { ok: true, ...result };
  }
}