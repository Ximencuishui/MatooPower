// JWT 策略：解析 Bearer token 或 httpOnly cookie（P0-8 双通道过渡）
// Phase 1（演示期）：Authorization header 为主（现有前端 localStorage 方案）
//                  + Set-Cookie httpOnly（生产期 XSS 防护通道，先铺路）
// Phase 2（生产期）：移除 body token，全 cookie（见 ACCEPTANCE-V2-REPORT §5.1b）
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DbService } from '../../common/db/db';

export const MATOO_COOKIE = 'matoo_token';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    cfg: ConfigService,
    private readonly db: DbService,
  ) {
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

  /**
   * v1.5 #P1-3:除验证 token 签名/有效期外,依据 User.isActive=0 视为悬浮账号
   * - GDPR 软删后默认 isActive=0(删除逻辑里同步置 0),拒绝访问
   * - admin 手动 suspend 的用户同样拒绝
   * - query 走 SQLite 主键索引,二次求性能可忽略;后续要走缓存可加 Redis
   */
  async validate(payload: any) {
    if (!payload?.sub) return payload;
    const u = this.db.get<{ isActive: number; deletedAt: string | null; role: string; dealerId: string | null }>(
      'SELECT isActive, deletedAt, role, dealerId FROM User WHERE id = ?',
      payload.sub,
    );
    if (!u) throw new UnauthorizedException('账户不存在');
    if (u.deletedAt) throw new UnauthorizedException('账户已被注销');
    if (u.isActive === 0) {
      throw new UnauthorizedException('账户已被停用');
    }
    return { ...payload, role: u.role, dealerId: u.dealerId };
  }
}