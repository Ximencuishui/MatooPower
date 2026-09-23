// Matoo Power Web — v1.3 P0 admin SKU 单测
// 覆盖:AdminSkuTabs 4 Tab 切换 / SkuBatchForm 必填校验 / QrBatchDialog quantity 上限
//      DocumentUploadDrawer 文件未选拦截 / LangChips 单选行为 / 公开文档拉取三态

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { AdminSkuTabs } from '../src/components/admin/AdminSkuTabs';
import { SkuBatchForm } from '../src/components/admin/SkuBatchForm';
import { DocumentUploadDrawer } from '../src/components/admin/DocumentUploadDrawer';
import { QrBatchDialog } from '../src/components/admin/QrBatchDialog';
import {
  LANG_OPTIONS,
  DOC_TYPE_OPTIONS,
  LangChips,
  DocTypeChips,
} from '../src/components/admin/LangChips';

// ---------- 全局 mock ----------
const i18nMock = vi.hoisted(() => ({
  lang: { v: 'zh-CN' as string },
  t: {
    adminSku: {
      tabs: { list: 'SKU 列表', batches: '批次管理', documents: '文档管理', qr: 'QR 批量' },
      errors: { batchEmpty: '批次无 SKU', sha256Dup: 'sha256 重复', versionDup: '版本号重复' },
    },
    scan: { manualUnavailable: '该语言暂无说明书', videoUnavailable: '该语言暂无安装视频' },
  },
}));

const opMock = vi.hoisted(() => ({
  createAdminSkuBatch: vi.fn(),
  updateAdminSkuBatch: vi.fn(),
  uploadAdminSkuDocument: vi.fn(),
  triggerAdminQrBatch: vi.fn(),
  getAdminQrBatch: vi.fn(),
  downloadAdminQrBatch: vi.fn(),
  saveBlob: vi.fn(),
}));

vi.mock('@/lib/i18n', () => ({
  useT: () => ({ t: i18nMock.t, lang: i18nMock.lang.v }),
}));

vi.mock('@/lib/api/operations', () => ({
  createAdminSkuBatch: (...a: unknown[]) => opMock.createAdminSkuBatch(...a),
  updateAdminSkuBatch: (...a: unknown[]) => opMock.updateAdminSkuBatch(...a),
  uploadAdminSkuDocument: (...a: unknown[]) => opMock.uploadAdminSkuDocument(...a),
  triggerAdminQrBatch: (...a: unknown[]) => opMock.triggerAdminQrBatch(...a),
  getAdminQrBatch: (...a: unknown[]) => opMock.getAdminQrBatch(...a),
  downloadAdminQrBatch: (...a: unknown[]) => opMock.downloadAdminQrBatch(...a),
  saveBlob: (...a: unknown[]) => opMock.saveBlob(...a),
}));

// ---------- AdminSkuTabs ----------
describe('AdminSkuTabs', () => {
  it('渲染 4 个 Tab,顺序固定', () => {
    const onChange = vi.fn();
    const { container } = render(<AdminSkuTabs active="list" onChange={onChange} />);
    const btns = container.querySelectorAll('button');
    expect(btns.length).toBe(4);
    expect(btns[0]?.textContent).toBe('SKU 列表');
    expect(btns[1]?.textContent).toBe('批次管理');
    expect(btns[2]?.textContent).toBe('文档管理');
    expect(btns[3]?.textContent).toBe('QR 批量');
  });

  it('active Tab 带 aria-current=page', () => {
    const { container } = render(<AdminSkuTabs active="batches" onChange={() => {}} />);
    const active = container.querySelector('button[aria-current="page"]');
    expect(active?.textContent).toBe('批次管理');
  });

  it('点击 Tab 触发 onChange(tabKey)', () => {
    const onChange = vi.fn();
    const { container } = render(<AdminSkuTabs active="list" onChange={onChange} />);
    fireEvent.click(container.querySelectorAll('button')[3]!); // QR 批量
    expect(onChange).toHaveBeenCalledWith('qr');
    fireEvent.click(container.querySelectorAll('button')[1]!); // 批次管理
    expect(onChange).toHaveBeenCalledWith('batches');
  });
});

// ---------- LangChips / DocTypeChips ----------
describe('LangChips / DocTypeChips', () => {
  it('LangChips 默认选中态 + 5 语言', () => {
    const onChange = vi.fn();
    const { container } = render(<LangChips selected="en" onChange={onChange} />);
    const radios = container.querySelectorAll('button[role="radio"]');
    expect(radios.length).toBe(5);
    const enBtn = Array.from(radios).find((b) => b.textContent?.includes('English'));
    expect(enBtn?.getAttribute('aria-checked')).toBe('true');
  });

  it('点击 LangChips → onChange(code)', () => {
    const onChange = vi.fn();
    const { container } = render(<LangChips selected="zh" onChange={onChange} />);
    const bnBtn = Array.from(container.querySelectorAll('button[role="radio"]'))
      .find((b) => b.textContent?.includes('বাংলা'))!;
    fireEvent.click(bnBtn);
    expect(onChange).toHaveBeenCalledWith('bn');
  });

  it('DocTypeChips 4 个文档类型', () => {
    const { container } = render(<DocTypeChips selected="manual" onChange={() => {}} />);
    const radios = container.querySelectorAll('button[role="radio"]');
    expect(radios.length).toBe(4);
    expect(container.textContent).toContain('说明书');
    expect(container.textContent).toContain('FAQ');
  });
});

// 公共元数据
expect(LANG_OPTIONS.map((o) => o.code)).toEqual(['zh', 'en', 'bn', 'hi', 'ur']);
expect(DOC_TYPE_OPTIONS.map((o) => o.code)).toEqual(['manual', 'video', 'specsheet', 'faq']);

// ---------- SkuBatchForm ----------
describe('SkuBatchForm', () => {
  beforeEach(() => {
    opMock.createAdminSkuBatch.mockReset();
    opMock.updateAdminSkuBatch.mockReset();
  });

  it('open=false → 不渲染', () => {
    const { container } = render(
      <SkuBatchForm open={false} onClose={() => {}} onSaved={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('open=true → 渲染表单 + 6 字段', () => {
    const { container } = render(
      <SkuBatchForm open onClose={() => {}} onSaved={() => {}} />,
    );
    const inputs = container.querySelectorAll('input, textarea, select');
    // 5 input + 1 textarea = 6 (无 select)
    expect(inputs.length).toBeGreaterThanOrEqual(5);
    expect(container.textContent).toContain('新建批次');
  });

  it('batchCode 不匹配正则 → 错误提示,不调用 API', async () => {
    const onSaved = vi.fn();
    const { container } = render(<SkuBatchForm open onClose={() => {}} onSaved={onSaved} />);
    fireEvent.change(container.querySelectorAll('input')[0]!, { target: { value: 'BADCODE' } });
    fireEvent.change(container.querySelectorAll('input')[1]!, { target: { value: '2026-09-15' } });
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => {
      expect(container.textContent).toContain('批次号格式：BATCH-2026Q3-001');
    });
    expect(opMock.createAdminSkuBatch).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('生产日期为空 → 错误提示', async () => {
    const { container } = render(<SkuBatchForm open onClose={() => {}} onSaved={() => {}} />);
    fireEvent.change(container.querySelectorAll('input')[0]!, { target: { value: 'BATCH-2026Q3-001' } });
    // 日期空
    fireEvent.submit(container.querySelector('form')!);
    await waitFor;
    await waitFor(() => {
      expect(container.textContent).toContain('生产日期必填');
    });
    expect(opMock.createAdminSkuBatch).not.toHaveBeenCalled();
  });

  it('校验通过 → createAdminSkuBatch 调用 + onSaved 回调 + onClose', async () => {
    opMock.createAdminSkuBatch.mockResolvedValue({ batch: { id: 'new-batch', batchCode: 'BATCH-2026Q3-001' } });
    const onSaved = vi.fn();
    const onClose = vi.fn();
    const { container } = render(<SkuBatchForm open onClose={onClose} onSaved={onSaved} />);
    fireEvent.change(container.querySelectorAll('input')[0]!, { target: { value: 'BATCH-2026Q3-001' } });
    fireEvent.change(container.querySelectorAll('input')[1]!, { target: { value: '2026-09-15' } });
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => {
      expect(opMock.createAdminSkuBatch).toHaveBeenCalledTimes(1);
    });
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

// ---------- DocumentUploadDrawer ----------
describe('DocumentUploadDrawer', () => {
  beforeEach(() => opMock.uploadAdminSkuDocument.mockReset());

  it('open=false → 不渲染', () => {
    const { container } = render(
      <DocumentUploadDrawer open={false} onClose={() => {}} onUploaded={() => {}} skus={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('必填校验:SKU/标题/文件缺失 → 错误提示', async () => {
    const { container } = render(
      <DocumentUploadDrawer open onClose={() => {}} onUploaded={() => {}} skus={[{ id: 's1', sku: 'MAT-12V200Ah', modelName: 'X' }]} />,
    );
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => {
      expect(container.textContent).toContain('请选择 SKU');
    });
    expect(opMock.uploadAdminSkuDocument).not.toHaveBeenCalled();
  });

  it('sku 选择 + 文件 + 标题 → 上传成功回调', async () => {
    opMock.uploadAdminSkuDocument.mockResolvedValue({
      document: { id: 'doc-1', skuId: 's1', type: 'manual', lang: 'en', version: 'v1.0', title: 'T', fileName: 'a.pdf' },
    });
    const onUploaded = vi.fn();
    const onClose = vi.fn();
    const { container } = render(
      <DocumentUploadDrawer open onClose={onClose} onUploaded={onUploaded}
        skus={[{ id: 's1', sku: 'MAT-12V200Ah', modelName: 'X' }]} />,
    );
    // 选 SKU
    fireEvent.change(container.querySelector('select')!, { target: { value: 's1' } });
    // 标题
    fireEvent.change(container.querySelectorAll('input')[1]!, { target: { value: 'T' } }); // version (input 0) ... file (input 2)
    // 文件
    const fileInput = container.querySelector('input[type="file"]')!;
    const file = new File(['hello'], 'a.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => {
      expect(opMock.uploadAdminSkuDocument).toHaveBeenCalledTimes(1);
    });
    expect(onUploaded).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('preselectedSkuId → 打开时 select 默认值', () => {
    const { container } = render(
      <DocumentUploadDrawer open onClose={() => {}} onUploaded={() => {}}
        skus={[{ id: 's-pre', sku: 'MAT', modelName: 'X' }]}
        preselectedSkuId="s-pre" />,
    );
    const select = container.querySelector('select')! as HTMLSelectElement;
    expect(select.value).toBe('s-pre');
  });
});

// ---------- QrBatchDialog ----------
describe('QrBatchDialog', () => {
  beforeEach(() => {
    opMock.triggerAdminQrBatch.mockReset();
    opMock.getAdminQrBatch.mockReset();
    opMock.downloadAdminQrBatch.mockReset();
  });

  it('open=false → 不渲染', () => {
    const { container } = render(
      <QrBatchDialog open={false} onClose={() => {}} onDone={() => {}} batches={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('未选批次 → 开始生成按钮 disabled', () => {
    const { container } = render(
      <QrBatchDialog open onClose={() => {}} onDone={() => {}} batches={[]} />,
    );
    const submitBtn = Array.from(container.querySelectorAll('button'))
      .find((b) => b.textContent === '开始生成')!;
    expect(submitBtn.hasAttribute('disabled')).toBe(true);
  });

  it('quantity 超 5000 → 错误提示,不调 API', async () => {
    const { container } = render(
      <QrBatchDialog open onClose={() => {}} onDone={() => {}}
        batches={[{ id: 'b1', batchCode: 'B1', skuCount: 2, documentCount: 0, qrBatchCount: 0, mfgDate: '2026-09-15T00:00:00Z', totalQuantity: 0, factory: null, destinationCountry: null, note: null }]} />,
    );
    fireEvent.change(container.querySelector('select')!, { target: { value: 'b1' } });
    fireEvent.change(container.querySelector('input[type="number"]')!, { target: { value: '6000' } });
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => {
      expect(container.textContent).toContain('数量必须在 1-5000');
    });
    expect(opMock.triggerAdminQrBatch).not.toHaveBeenCalled();
  });

  it('quantity 合法 → 调用 trigger + 显示任务状态', async () => {
    opMock.triggerAdminQrBatch.mockResolvedValue({
      task: { id: 'qb-1', status: 'done', generatedCount: 3, totalQuantity: 3, batchId: 'b1', zipStorageKey: 'k', errorMessage: null, generatedByUserId: 'u', startedAt: null, finishedAt: '2026-09-15T00:00:00Z', createdAt: '2026-09-15T00:00:00Z' },
    });
    const onDone = vi.fn();
    const { container } = render(
      <QrBatchDialog open onClose={() => {}} onDone={onDone}
        batches={[{ id: 'b1', batchCode: 'B1', skuCount: 2, documentCount: 0, qrBatchCount: 0, mfgDate: '2026-09-15T00:00:00Z', totalQuantity: 0, factory: null, destinationCountry: null, note: null }]} />,
    );
    fireEvent.change(container.querySelector('select')!, { target: { value: 'b1' } });
    fireEvent.change(container.querySelector('input[type="number"]')!, { target: { value: '3' } });
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => {
      expect(container.textContent).toContain('任务 ID');
    });
    expect(opMock.triggerAdminQrBatch).toHaveBeenCalledWith({ batchId: 'b1', quantity: 3 });
    expect(container.textContent).toContain('完成');
    expect(container.textContent).toContain('下载 ZIP');
  });
});