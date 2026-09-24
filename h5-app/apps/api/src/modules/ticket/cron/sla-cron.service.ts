// v1.5 #P0-4:SLA 自动升级 cron
// - 不用 @nestjs/schedule(避免新增依赖),采用 NestJS lifecycle + setInterval 实现
// - 间隔:TICKET_SLA_CRON_INTERVAL_MS(默认 5 分钟)
// - 单实例内 useLock 防并发;多实例部署需后续引入 Redis 分布式锁
// - 服务进程关闭时清理 interval,避免遗留 timer
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { TicketService } from '../ticket.service';

@Injectable()
export class SlaCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlaCronService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly ticketSvc: TicketService) {}

  onModuleInit() {
    // 测试环境禁用,避免 e2e 跳秒与断言时间漂移
    if (process.env.NODE_ENV === 'test') {
      this.logger.log('SLA cron disabled (NODE_ENV=test)');
      return;
    }
    if (process.env.SLA_CRON_DISABLED === '1') {
      this.logger.log('SLA cron disabled (SLA_CRON_DISABLED=1)');
      return;
    }
    const intervalMs = Number(process.env.TICKET_SLA_CRON_INTERVAL_MS ?? 5 * 60_000);
    this.timer = setInterval(() => this.tickSafe(), intervalMs);
    // 不阻止进程退出
    if (this.timer.unref) this.timer.unref();
    this.logger.log(`SLA cron scheduled every ${intervalMs}ms`);
    // 启动后 15s 内立刻跑一次(让演示期数据快速 SLA 升级)
    setTimeout(() => this.tickSafe(), 15_000).unref?.();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tickSafe() {
    if (this.running) return;
    this.running = true;
    try {
      const r = this.ticketSvc.runSlaSweep();
      if (r.upgraded > 0) {
        this.logger.log(`SLA sweep upgraded ${r.upgraded} ticket(s)`);
      } else if (r.error) {
        this.logger.warn(`SLA sweep error: ${r.error}`);
      }
    } catch (e) {
      this.logger.error('SLA sweep crashed', e as Error);
    } finally {
      this.running = false;
    }
  }
}
