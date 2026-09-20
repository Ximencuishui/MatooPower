import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../../common/db/db';

@Injectable()
export class AdminService {
  constructor(private readonly db: DbService) {}

  async listSkus() {
    return this.db.all('SELECT * FROM Sku ORDER BY createdAt ASC');
  }

  async listWarranties() {
    return this.db.all(
      `SELECT w.*, u.phone AS user_phone, u.displayName AS user_displayName,
              s.sku AS s_sku, s.modelName AS s_modelName, s.serial AS s_serial
       FROM Warranty w
       JOIN User u ON w.userId = u.id
       JOIN Sku s ON w.skuId = s.id
       ORDER BY w.createdAt DESC`,
    );
  }

  async listDevices() {
    return this.db.all(
      `SELECT d.*, u.phone AS user_phone,
              s.sku AS s_sku, s.modelName AS s_modelName, s.serial AS s_serial
       FROM Device d
       JOIN User u ON d.userId = u.id
       JOIN Sku s ON d.skuId = s.id
       ORDER BY d.boundAt DESC`,
    );
  }

  async listUsers() {
    return this.db.all(
      `SELECT u.id, u.phone, u.email, u.role, u.displayName, u.createdAt,
              (SELECT COUNT(*) FROM Warranty w WHERE w.userId = u.id) AS warrantyCount,
              (SELECT COUNT(*) FROM Device d WHERE d.userId = u.id) AS deviceCount
       FROM User u ORDER BY u.createdAt ASC`,
    );
  }

  async reviewWarranty(id: string, status: 'active' | 'pending' | 'expired' | 'rejected', notes?: string) {
    const w = this.db.get<{ id: string; reviewNotes: string | null }>('SELECT id, reviewNotes FROM Warranty WHERE id = ?', id);
    if (!w) throw new NotFoundException(`warranty ${id} 不存在`);
    this.db.run('UPDATE Warranty SET status = ?, reviewNotes = ? WHERE id = ?', status, notes ?? w.reviewNotes, id);
    return this.db.get('SELECT * FROM Warranty WHERE id = ?', id);
  }

  /** 平台概览 — 用于 admin 仪表盘 */
  async overview() {
    const skuTotal = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM Sku')?.c ?? 0;
    const skuActivated = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM Sku WHERE activated = 1')?.c ?? 0;
    const userTotal = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM User')?.c ?? 0;
    const userDealer = this.db.get<{ c: number }>("SELECT COUNT(*) AS c FROM User WHERE role = 'dealer'")?.c ?? 0;
    const warrantyActive = this.db.get<{ c: number }>("SELECT COUNT(*) AS c FROM Warranty WHERE status = 'active'")?.c ?? 0;
    const deviceTotal = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM Device')?.c ?? 0;
    const ticketOpen = this.db.get<{ c: number }>("SELECT COUNT(*) AS c FROM Ticket WHERE status IN ('open','in_progress','waiting_customer')")?.c ?? 0;
    const ticketUrgent = this.db.get<{ c: number }>("SELECT COUNT(*) AS c FROM Ticket WHERE severity IN ('high','urgent') AND status NOT IN ('resolved','closed')")?.c ?? 0;

    const firstOfMonth = new Date();
    firstOfMonth.setDate(1); firstOfMonth.setHours(0,0,0,0);
    const warrantyThisMonth = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM Warranty WHERE createdAt >= ?', firstOfMonth.toISOString())?.c ?? 0;
    const deviceThisMonth = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM Device WHERE boundAt >= ?', firstOfMonth.toISOString())?.c ?? 0;
    const ticketThisMonth = this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM Ticket WHERE createdAt >= ?', firstOfMonth.toISOString())?.c ?? 0;

    return {
      sku: { total: skuTotal, activated: skuActivated },
      user: { total: userTotal, dealer: userDealer },
      warranty: { active: warrantyActive, activeThisMonth: warrantyThisMonth },
      device: { total: deviceTotal, boundThisMonth: deviceThisMonth },
      ticket: { open: ticketOpen, urgent: ticketUrgent, newThisMonth: ticketThisMonth },
    };
  }
}