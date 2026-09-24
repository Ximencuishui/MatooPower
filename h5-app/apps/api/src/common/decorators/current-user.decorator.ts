// 从 JWT 验证后的 request.user 中取出当前用户
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  sub: string;
  role: 'customer' | 'dealer' | 'admin' | 'support';
  phone?: string;
  email?: string;
  /** v1.5 #P1-5:经销商归属 Dealer.id(供 dealer-pickup 隔离使用) */
  dealerId?: string | null;
  /** v1.5 #P1-3:实时 role 来自 User 表(避免 token 过期前角色被改) */
  iat?: number;
  exp?: number;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthUser;
  },
);