// 演示 SKU 与演示账号数据。原型阶段不接后端，所有"激活/绑定"等动作在内存中维护。

export type QrState = 'genuine' | 'repeated' | 'fake' | 'revoked' | 'network';

export type Sku = {
  id: string;
  sku: string;
  serial: string;
  batch: string;
  mfgDate: string;
  modelName: string;
  family: 'battery' | 'controller' | 'panel';
  capacity: string;
  voltage: string;
  chemistry: string;
  cycles: string;
  warranty: {
    whole: number;
    batch: 'cell' | 'bms' | 'parts';
    cell?: number;
    bms?: number;
    parts?: number;
  };
  activated: boolean;
  activatedAt?: string;
  activatedBy?: string;
  manual: { title: string; size: string; lang: string }[];
  video: { title: string; duration: string; lang: string }[];
  compatibleParts: string[];
};

const BASE: Omit<Sku, 'id' | 'serial' | 'activated' | 'activatedAt' | 'activatedBy'> = {
  sku: 'MAT-12V200Ah',
  batch: 'B202408-A',
  mfgDate: '2024-08-12',
  modelName: 'Matoo Power 12V 200Ah LiFePO4 Battery',
  family: 'battery',
  capacity: '200 Ah / 2560 Wh',
  voltage: '12.8 V',
  chemistry: 'LiFePO4 (A-grade)',
  cycles: '≥ 6000 @ 80% DoD',
  warranty: { whole: 36, batch: 'cell', cell: 60, bms: 36, parts: 12 },
  manual: [
    { title: 'User Manual (EN)', size: '3.2 MB', lang: 'en' },
    { title: '使用说明书 (中文)', size: '3.0 MB', lang: 'zh' },
    { title: 'ব্যবহার নির্দেশিকা (বাংলা)', size: '3.1 MB', lang: 'bn' },
  ],
  video: [
    { title: 'Install Video (EN)', duration: '04:32', lang: 'en' },
    { title: '安装视频 (中文)', duration: '04:18', lang: 'zh' },
  ],
  compatibleParts: ['XT90 Cable', 'Smart BMS Display', 'Solar Charge Controller 20A'],
};

export const SKU_DB: Record<string, Sku> = {
  'MATO-MAT12200-DEMO0001': {
    ...BASE,
    id: 'MATO-MAT12200-DEMO0001',
    serial: 'SN24B0801A0001',
    activated: false,
  } as Sku,
  'MATO-MAT12200-DEMO0002': {
    ...BASE,
    id: 'MATO-MAT12200-DEMO0002',
    serial: 'SN24B0801A0002',
    activated: true,
    activatedAt: '2025-01-14 10:23',
    activatedBy: '+880-DEMO-0001',
  } as Sku,
  'MATO-MAT12200-DEMO0003': {
    ...BASE,
    id: 'MATO-MAT12200-DEMO0003',
    serial: 'SN24B0801A0003',
    batch: 'B202408-B',
    activated: true,
    activatedAt: '2024-12-05 09:11',
    activatedBy: '+91-DEMO-0002',
  } as Sku,
  'MATO-MAT12300-DEMO0004': {
    ...BASE,
    id: 'MATO-MAT12300-DEMO0004',
    sku: 'MAT-12V300Ah',
    modelName: 'Matoo Power 12V 300Ah LiFePO4 Battery',
    capacity: '300 Ah / 3840 Wh',
    serial: 'SN24B0801A0004',
    activated: true,
    activatedAt: '2024-09-20 16:02',
    activatedBy: '+880-DEMO-0003',
  } as Sku,
};

// 给的 id 不存在时 / 命中特定 key 时返回不同场景
export function lookupQr(id: string): { kind: QrState; sku?: Sku; msg?: string } {
  if (id === 'FAKE-CODE-0000') {
    return { kind: 'fake', msg: '签名校验失败 · 服务器拒绝响应' };
  }
  if (id === 'REVOKED-CODE-0000') {
    return { kind: 'revoked', msg: '批次 B202408-C 已撤销（防窜货风控）' };
  }
  if (id === 'NETERR-CODE-0000') {
    return { kind: 'network', msg: '网络异常 · 服务器响应超时' };
  }
  const sku = SKU_DB[id];
  if (!sku) return { kind: 'fake', msg: '此码不存在于 Matoo Power 产品库' };
  if (sku.activated) return { kind: 'repeated', sku };
  return { kind: 'genuine', sku };
}

// 给的 id 不存在时，模拟伪造码场景
export type DemoDevice = {
  id: string;
  skuId: string;
  product: string;
  serial: string;
  imageBg: string;
  warrantyEnd: string;
  warrantyStatus: 'active' | 'pending' | 'expired';
  bound: boolean;
  soh?: number;
  soc?: number;
  cycles?: number;
  temp?: number;
  volt?: number;
  curr?: number;
  fw?: string;
  alarms?: number;
};

export const DEMO_DEVICES: DemoDevice[] = [
  {
    id: 'dev-1',
    skuId: 'MATO-MAT12200-DEMO0002',
    product: 'Matoo Power 12V 200Ah LiFePO4',
    serial: 'SN24B0801A0002',
    imageBg: 'from-matoo-light to-white',
    warrantyEnd: '2028-01-14',
    warrantyStatus: 'active' as const,
    bound: true,
    soh: 98,
    soc: 84,
    cycles: 312,
    temp: 26,
    volt: 13.1,
    curr: 0.0,
    fw: 'v1.2.4',
    alarms: 0,
  },
  {
    id: 'dev-2',
    skuId: 'MATO-MAT12200-DEMO0003',
    product: 'Matoo Power 12V 200Ah LiFePO4',
    serial: 'SN24B0801A0003',
    imageBg: 'from-sky-50 to-white',
    warrantyEnd: '2027-12-05',
    warrantyStatus: 'active' as const,
    bound: true,
    soh: 91,
    soc: 62,
    cycles: 1240,
    temp: 31,
    volt: 12.9,
    curr: 4.6,
    fw: 'v1.2.3',
    alarms: 2,
  },
  {
    id: 'dev-3',
    skuId: 'MATO-MAT12300-DEMO0004',
    product: 'Matoo Power 12V 300Ah LiFePO4',
    serial: 'SN24B0801A0004',
    imageBg: 'from-amber-50 to-white',
    warrantyEnd: '2027-09-20',
    warrantyStatus: 'active' as const,
    bound: true,
    soh: 99,
    soc: 100,
    cycles: 88,
    temp: 24,
    volt: 13.4,
    curr: 0.0,
    fw: 'v1.2.5',
    alarms: 0,
  },
  {
    id: 'dev-4',
    skuId: 'MATO-MAT12200-DEMO0001',
    product: 'Matoo Power 12V 200Ah LiFePO4',
    serial: 'SN24B0801A0001',
    imageBg: 'from-matoo-light to-white',
    warrantyEnd: '—',
    warrantyStatus: 'pending' as const,
    bound: false,
  },
];

// 演示配件（商城静态占位）
export const DEMO_PARTS = [
  { id: 'p-1', name: 'XT90 高电流连接线', price: 18, img: 'bg-amber-100' },
  { id: 'p-2', name: 'Smart BMS 蓝牙显示器', price: 36, img: 'bg-sky-100' },
  { id: 'p-3', name: '20A 太阳能控制器', price: 52, img: 'bg-emerald-100' },
  { id: 'p-4', name: '安德森插头 (50A, 红色)', price: 6, img: 'bg-rose-100' },
];

// 经销商代激活：演示批量场景
export const DEALER_DEMO_BATCH = [
  { qrId: 'MATO-MAT12200-DEMO0001', serial: 'SN24B0801A0001', sku: 'MAT-12V200Ah' },
  { qrId: 'MATO-MAT12300-DEMO0004', serial: 'SN24B0801A0004', sku: 'MAT-12V300Ah' },
  { qrId: 'MATO-MAT12200-DEMO0003', serial: 'SN24B0801A0003', sku: 'MAT-12V200Ah' },
  { qrId: 'MATO-MAT12200-DEMO0002', serial: 'SN24B0801A0002', sku: 'MAT-12V200Ah' },
  { qrId: 'MATO-MAT12200-DEMO0005', serial: 'SN24B0801A0005', sku: 'MAT-12V200Ah' }, // 演示：未入库
];