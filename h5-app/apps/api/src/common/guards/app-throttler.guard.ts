// P0-5 全局限流守卫（@nestjs/throttler）
//
// - 生产/开发环境：正常执行限流（默认 100 req/min/IP；敏感端点用 @Throttle 收紧）
// - 测试环境（NODE_ENV=test）：直接放行，避免 e2e 用例集中执行时被 5/min 的 OTP
//   限流误伤（jest 同进程复用同一 app 实例与内存存储）
// - 注册方式：app.module providers APP_GUARD（DI 注入 options/storage/reflector，
//   不手写构造参数，与 @nestjs/throttler v6.7 构造签名解耦）

import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') {
      return true;
    }
    return super.canActivate(context);
  }
}