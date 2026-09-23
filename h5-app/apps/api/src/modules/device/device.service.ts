import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../../common/db/db';

export interface BindDeviceInput {
  skuId: string;
}

export interface HealthSnapshot {
  id: string;
  skuId: string;
  soh: number;
  soc: number;
  cycles: number;
  temp: number;
  volt: number;
  curr: number;
  fw: string;
  alarms: number;
  boundAt: string;
  lastSeenAt: string;
  online: boolean;
  trend: {
    socLast6h: number[];
    voltLast1h: number[];
  };
}

@Injectable()
export class DeviceService {
  constructor(private readonly db: DbService) {}

  async bind(userId: string, input: BindDeviceInput) {
    const sku = this.db.get<any>('SELECT * FROM Sku WHERE id = ?', input.skuId);
    if (!sku) throw new NotFoundException(`SKU ${input.skuId} 不存在`);

    const existing = this.db.get<any>(
      'SELECT * FROM Device WHERE skuId = ?',
      input.skuId,
    );
    if (existing && existing.userId !== userId) {
      throw new ConflictException('该 SKU 已被其他用户绑定');
    }
    if (existing && existing.userId === userId) {
      return existing;
    }

    const id = 'dev_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    this.db.run(
      `INSERT INTO Device (id, skuId, userId, soh, soc, cycles, temp, volt, curr, fw, alarms, lastSeenAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      id, sku.id, userId,
      100, 92, 12, 25, 13.3, 0.0, 'v1.2.5', 0,
    );
    return this.db.get('SELECT * FROM Device WHERE id = ?', id);
  }

  async listMine(userId: string) {
    return this.db.all<any>(
      `SELECT d.*, s.sku AS s_sku, s.modelName AS s_modelName, s.serial AS s_serial
       FROM Device d JOIN Sku s ON d.skuId = s.id
       WHERE d.userId = ? ORDER BY d.boundAt DESC`,
      userId,
    );
  }

  async getHealth(id: string, userId: string, opts: { asAdmin?: boolean } = {}): Promise<HealthSnapshot> {
    const dev = this.db.get<any>('SELECT * FROM Device WHERE id = ?', id);
    if (!dev) throw new NotFoundException(`device ${id} 不存在`);
    if (!opts.asAdmin && dev.userId !== userId) {
      throw new NotFoundException(`device ${id} 不存在`);
    }
    if (opts.asAdmin) {
      // admin 视角：不要写入 lastSeenAt (避免模拟 telemetry 污染其他用户)
      const soc = dev.soc ?? 80;
      const temp = dev.temp ?? 25;
      const volt = dev.volt ?? 13.0;
      const curr = dev.curr ?? 0;
      return {
        id: dev.id,
        skuId: dev.skuId,
        soh: dev.soh ?? 100,
        soc,
        cycles: dev.cycles ?? 0,
        temp,
        volt,
        curr,
        fw: dev.fw ?? 'unknown',
        alarms: dev.alarms ?? 0,
        boundAt: new Date(dev.boundAt).toISOString(),
        lastSeenAt: new Date(dev.lastSeenAt).toISOString(),
        online: dev.lastSeenAt ? (Date.now() - new Date(dev.lastSeenAt).getTime()) < 24 * 3600 * 1000 : false,
        trend: {
          socLast6h: this.synthSoc(dev.soc ?? 80),
          voltLast1h: this.synthVolt(dev.volt ?? 13.0),
        },
      };
    }

    const soc = this.jitter(dev.soc ?? 80, 3, 0, 100);
    const temp = this.jitter(dev.temp ?? 25, 1, 18, 45);
    const volt = this.jitter(dev.volt ?? 13.0, 0.1, 11.5, 14.6);
    const curr = this.jitter(dev.curr ?? 0, 0.5, -10, 10);

    this.db.run(
      `UPDATE Device SET soc = ?, temp = ?, volt = ?, curr = ?, lastSeenAt = CURRENT_TIMESTAMP WHERE id = ?`,
      Math.round(soc),
      Number(temp.toFixed(1)),
      Number(volt.toFixed(2)),
      Number(curr.toFixed(2)),
      id,
    );

    return {
      id: dev.id,
      skuId: dev.skuId,
      soh: dev.soh ?? 100,
      soc: Math.round(soc),
      cycles: dev.cycles ?? 0,
      temp: Number(temp.toFixed(1)),
      volt: Number(volt.toFixed(2)),
      curr: Number(curr.toFixed(2)),
      fw: dev.fw ?? 'unknown',
      alarms: dev.alarms ?? 0,
      boundAt: new Date(dev.boundAt).toISOString(),
      lastSeenAt: new Date().toISOString(),
      online: true,
      trend: {
        socLast6h: this.synthSoc(dev.soc ?? 80),
        voltLast1h: this.synthVolt(dev.volt ?? 13.0),
      },
    };
  }

  private jitter(v: number, range: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v + (Math.random() * 2 - 1) * range));
  }

  /**
   * 远程诊断（演示）
   * 返回诊断事件 + 模拟跑出来的建议
   */
  triggerDiagnostics(id: string, userId: string) {
    const dev = this.db.get<any>('SELECT * FROM Device WHERE id = ?', id);
    if (!dev) throw new NotFoundException(`device ${id} 不存在`);
    if (dev.userId !== userId) throw new ForbiddenException('无权诊断此设备');

    const findings: Array<{ code: string; severity: 'info' | 'warn' | 'critical'; message: string }> = [];

    if ((dev.soh ?? 100) < 90) findings.push({ code: 'SOH_LOW', severity: 'warn', message: `电池健康度 SOH 仅 ${dev.soh}%，建议减少深度放电。` });
    if ((dev.cycles ?? 0) > 1000) findings.push({ code: 'CYCLES_HIGH', severity: 'info', message: `已循环 ${dev.cycles} 次，属于正常老化范围。` });
    if ((dev.temp ?? 25) >= 30) findings.push({ code: 'TEMP_HIGH', severity: 'critical', message: `设备温度 ${dev.temp}°C 偏高，建议检查散热并降功率。` });
    if ((dev.alarms ?? 0) > 0) findings.push({ code: 'ALARM_ACTIVE', severity: 'warn', message: `有 ${dev.alarms} 条历史告警，请检查历史记录。` });
    if (findings.length === 0) findings.push({ code: 'ALL_OK', severity: 'info', message: '设备运行正常，未发现异常。' });

    return {
      deviceId: id,
      skuId: dev.skuId,
      startedAt: new Date().toISOString(),
      durationMs: 1200 + Math.floor(Math.random() * 600),
      summary: findings.some((f) => f.severity === 'critical')
        ? 'critical'
        : findings.some((f) => f.severity === 'warn')
          ? 'warn'
          : 'ok',
      findings,
      recommendation: findings.some((f) => f.severity === 'critical')
        ? '建议停止高功率作业并联系客服。'
        : findings.some((f) => f.severity === 'warn')
          ? '建议关注告警并优化使用习惯。'
          : '继续按现有方式使用。',
    };
  }

  private synthSoc(base: number): number[] {
    return Array.from({ length: 12 }, (_, i) =>
      Math.max(0, Math.min(100, Math.round(base - i * 1.5 + (Math.random() * 2 - 1)))),
    ).reverse();
  }

  private synthVolt(base: number): number[] {
    return Array.from({ length: 60 }, () => Number((base + (Math.random() * 0.2 - 0.1)).toFixed(2)));
  }
}