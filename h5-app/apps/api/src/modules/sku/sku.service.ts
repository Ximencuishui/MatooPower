import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DbService } from '../../common/db/db';
import { SkuEntity } from './entities/sku.entity';
import { QrSignerService } from './qr-signer.service';

interface SkuRow {
  id: string;
  sku: string;
  serial: string;
  batch: string;
  mfgDate: string;
  modelName: string;
  family: string;
  capacity: string;
  voltage: string;
  chemistry: string;
  cycles: string;
  warrantyMonthsWhole: number;
  warrantyMonthsCell: number | null;
  warrantyMonthsBms: number | null;
  warrantyMonthsParts: number | null;
  activated: number;
  activatedAt: string | null;
  activatedByUserId: string | null;
}

interface QrRow {
  qrId: string;
  signature: string;
  revoked: number;
  scanCount: number;
  lastScanAt: string | null;
}

@Injectable()
export class SkuService {
  constructor(private readonly db: DbService, private readonly qr: QrSignerService) {}

  /** 根据 sku id 查 SKU + 关联的 QR 签名 */
  async findOne(id: string): Promise<SkuEntity & { qr: { qrId: string; signature: string; revoked: boolean; scanCount: number; lastScanAt: string | null } | null }> {
    const sku = this.db.get<SkuRow>('SELECT * FROM Sku WHERE id = ?', id);
    if (!sku) throw new NotFoundException(`SKU ${id} 不存在`);

    const qr = this.db.get<QrRow>('SELECT qrId, signature, revoked, scanCount, lastScanAt FROM QrSignature WHERE qrId = ?', id);
    if (qr) {
      this.db.run(
        'UPDATE QrSignature SET scanCount = scanCount + 1, lastScanAt = CURRENT_TIMESTAMP WHERE qrId = ?',
        id,
      );
      qr.scanCount = qr.scanCount + 1;
      qr.lastScanAt = new Date().toISOString();
    }
    return this.toEntity(sku, qr ?? null);
  }

  /** 后台：列出所有 SKU */
  async listAll(): Promise<SkuEntity[]> {
    const rows = this.db.all<SkuRow>('SELECT * FROM Sku ORDER BY createdAt ASC');
    return rows.map((s) => this.toEntity(s, null));
  }

  /** 演示用：手动 seed 一个 SKU + 签发 QR */
  async seedDemoSku(input: {
    id: string;
    sku: string;
    serial: string;
    batch: string;
    mfgDate: string;
    modelName: string;
    family?: string;
    capacity?: string;
    voltage?: string;
    chemistry?: string;
    cycles?: string;
    warrantyMonthsWhole?: number;
    warrantyMonthsCell?: number;
    warrantyMonthsBms?: number;
    warrantyMonthsParts?: number;
  }): Promise<SkuEntity & { qr: any }> {
    const existing = this.db.get<{ id: string }>('SELECT id FROM Sku WHERE id = ?', input.id);
    if (!existing) {
      this.db.run(
        `INSERT INTO Sku (id, sku, serial, batch, mfgDate, modelName, family, capacity, voltage, chemistry, cycles, warrantyMonthsWhole, warrantyMonthsCell, warrantyMonthsBms, warrantyMonthsParts)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        input.id, input.sku, input.serial, input.batch,
        new Date(input.mfgDate).toISOString(),
        input.modelName,
        input.family ?? 'battery',
        input.capacity ?? '',
        input.voltage ?? '',
        input.chemistry ?? '',
        input.cycles ?? '',
        input.warrantyMonthsWhole ?? 36,
        input.warrantyMonthsCell ?? 60,
        input.warrantyMonthsBms ?? 36,
        input.warrantyMonthsParts ?? 12,
      );
    }
    const sku = this.db.get<SkuRow>('SELECT * FROM Sku WHERE id = ?', input.id);

    // 签发
    const nonce = randomBytes(6).toString('hex');
    const text = `${input.id}|${input.serial}|${input.batch}|${nonce}`;
    const sig = this.qr.signRaw(text);

    const existingQr = this.db.get<{ qrId: string }>('SELECT qrId FROM QrSignature WHERE qrId = ?', input.id);
    if (!existingQr) {
      this.db.run(
        'INSERT INTO QrSignature (id, qrId, skuId, signature) VALUES (?, ?, ?, ?)',
        'qr_' + randomBytes(8).toString('hex'), input.id, input.id, sig,
      );
    } else {
      this.db.run('UPDATE QrSignature SET signature = ?, revoked = 0 WHERE qrId = ?', sig, input.id);
    }

    const qr = this.db.get<QrRow>('SELECT qrId, signature, revoked, scanCount, lastScanAt FROM QrSignature WHERE qrId = ?', input.id);
    return this.toEntity(sku!, qr ?? null);
  }

  private toEntity(sku: SkuRow, qr: QrRow | null): SkuEntity & { qr: any } {
    return {
      id: sku.id,
      sku: sku.sku,
      serial: sku.serial,
      batch: sku.batch,
      mfgDate: new Date(sku.mfgDate).toISOString(),
      modelName: sku.modelName,
      family: sku.family,
      capacity: sku.capacity,
      voltage: sku.voltage,
      chemistry: sku.chemistry,
      cycles: sku.cycles,
      warranty: {
        whole: sku.warrantyMonthsWhole,
        cell: sku.warrantyMonthsCell ?? null,
        bms: sku.warrantyMonthsBms ?? null,
        parts: sku.warrantyMonthsParts ?? null,
      },
      activated: !!sku.activated,
      activatedAt: sku.activatedAt ? new Date(sku.activatedAt).toISOString() : null,
      activatedBy: sku.activatedByUserId ?? null,
      qr: qr
        ? {
            qrId: qr.qrId,
            signature: qr.signature,
            revoked: !!qr.revoked,
            scanCount: qr.scanCount,
            lastScanAt: qr.lastScanAt ? new Date(qr.lastScanAt).toISOString() : null,
          }
        : null,
    };
  }
}