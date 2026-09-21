// AuditInterceptor — 自动记录 admin/support 写操作(POST/PUT/PATCH/DELETE)到 AuditLog
// 挂载:在 AppModule 通过 APP_INTERCEPTOR 全局注册
// 策略:
//  - 只对 admin/support 用户生效(customer/dealer 写操作不进审计,减少噪音)
//  - 只记录成功(2xx)的写操作;失败由 AllExceptionsFilter 处理
//  - action 命名:<controller_method 或路由路径>.<HTTP方法小写>
//  - resource 命名:<resource>:<routeParam id>(如 'warranty:w-123')
//  - payload 取 body(不超过 4KB,过大只截断前缀)
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

const MAX_PAYLOAD = 4096;

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly audit: AuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    if (!req || !req.method) return next.handle();
    const method = String(req.method).toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next.handle();

    const user = req.user as { sub?: string; role?: string } | undefined;
    const role = user?.role;
    if (role !== 'admin' && role !== 'support') return next.handle();

    // 路由路径 / 资源
    const routePath = (req.route?.path as string | undefined) ?? req.path ?? '';
    const controller = ctx.getClass().name;       // e.g. 'AdminController'
    const handler = ctx.getHandler().name;        // e.g. 'review'
    const action = `${controller}.${handler}.${method.toLowerCase()}`;
    const params = (req.params ?? {}) as Record<string, string>;
    const idParam = params.id ?? params['*'];
    const resource = routePath
      ? `${routePath.replace(/^\//, '').replace(/\//g, ':')}${idParam ? ':' + idParam : ''}`
      : null;

    const ip =
      (req.headers && (req.headers['x-forwarded-for'] as string | undefined)) ||
      req.socket?.remoteAddress ||
      null;
    const userAgent = (req.headers && (req.headers['user-agent'] as string | undefined)) || null;

    const rawBody = req.body && Object.keys(req.body).length > 0 ? req.body : null;
    const bodyStr = rawBody ? JSON.stringify(rawBody) : null;
    const payload = bodyStr
      ? bodyStr.length > MAX_PAYLOAD
        ? bodyStr.slice(0, MAX_PAYLOAD) + '…(truncated)'
        : rawBody
      : null;

    return next.handle().pipe(
      tap({
        next: (val) => {
          const status = val?.__status ?? null; // 透传状态码占位（见下）
          // 普通响应没有显式 status,从 val 上拿不到也无所谓——只记 2xx（tap.next 在 controller 返回前触发）
          this.audit.write({
            actorUserId: user?.sub ?? null,
            actorRole: role ?? null,
            action,
            resource,
            payload: payload ?? (val && typeof val === 'object' ? { ok: val.ok } : null),
            ip,
            userAgent,
          });
          void status; // no-op
        },
        error: () => { /* 写操作失败不入审计（业务异常由 filter 记录日志） */ },
      }),
    );
  }
}