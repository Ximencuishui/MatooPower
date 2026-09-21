// @Roles('admin') 装饰器：标记端点要求的角色
// 配合 RolesGuard 使用：未在白名单的角色 → 403 Forbidden

import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type AppRole = 'customer' | 'dealer' | 'admin' | 'support';

export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);