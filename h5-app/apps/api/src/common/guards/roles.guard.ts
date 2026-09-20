// RolesGuard：基于 @Roles() 装饰器的角色鉴权
// 必须挂在 JwtAuthGuard 之后（顺序：JwtAuthGuard → RolesGuard）
// CurrentUser.decorator 已经把 req.user 注入为 AuthUser { sub, role, ... }

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, AppRole } from '../decorators/roles.decorator';
import { AuthUser } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // 没有 @Roles() 装饰器 = 不限角色
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    if (!user) {
      // JwtAuthGuard 应已保证有 user；如果仍然没有说明配置错误
      throw new ForbiddenException('未登录');
    }
    if (!required.includes(user.role as AppRole)) {
      throw new ForbiddenException(`需要角色: ${required.join(', ')}（当前: ${user.role}）`);
    }
    return true;
  }
}