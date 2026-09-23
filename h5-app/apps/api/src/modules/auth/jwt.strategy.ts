// JWT 策略：解析 Bearer token 或 httpOnly cookie（P0-8 双通道过渡）
// Phase 1（演示期）：Authorization header 为主（现有前端 localStorage 方案）
//                  + Set-Cookie httpOnly（生产期 XSS 防护通道，先铺路）
// Phase 2（生产期）：移除 body token，全 cookie（见 ACCEPTANCE-V2-REPORT §5.1b）
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export const MATOO_COOKIE = 'matoo_token';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(cfg: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // cookie 回退通道（需要 main.ts/helpers 挂 cookie-parser）
        (req) => req?.cookies?.[MATOO_COOKIE] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: cfg.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // 挂到 req.user：{ sub, role, phone?, email? }
    return payload;
  }
}