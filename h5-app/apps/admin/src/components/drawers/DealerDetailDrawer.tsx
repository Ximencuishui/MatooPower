// Admin 经销商详情 Drawer —— 含价格表 + 成员 + 启停操作
'use client';

import { useEffect, useState } from 'react';
import { Drawer } from '@/components/Drawer';
import { PageLoading } from '@/components/PageLoading';
import { ErrorBlock } from '@/components/ErrorBlock';
import {
  getDealer,
  activateDealer,
  suspendDealer,
  addDealerPrice,
  removeDealerPrice,
  type DealerItem,
  type DealerPriceListItem,
} from '@/lib/api/operations';

interface DealerDetail extends DealerItem {
  priceList: DealerPriceListItem[];
  members: Array<{ id: string; phone: string | null; displayName: string | null; role: string }>;
}

interface Props {
  dealerId: string | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

export function DealerDetailDrawer({ dealerId, open, onClose, onChanged }: Props) {
  const [detail, setDetail] = useState<DealerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const [newSkuId, setNewSkuId] = useState('');
  const [newPriceCents, setNewPriceCents] = useState('');
  const [addingPrice, setAddingPrice] = useState(false);

  async function refresh() {
    if (!dealerId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await getDealer(dealerId);
      setDetail(r.dealer as DealerDetail);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open || !dealerId) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dealerId]);

  async function handleToggleStatus() {
    if (!detail || busy) return;
    setBusy(true);
    try {
      if (detail.status === 'active') {
        await suspendDealer(detail.id);
      } else {
        await activateDealer(detail.id);
      }
      await refresh();
      onChanged?.();
    } catch (e) {
      alert('操作失败: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddPrice() {
    if (!detail || !newPriceCents || !newSkuId || addingPrice) return;
    setAddingPrice(true);
    try {
      await addDealerPrice(detail.id, {
        skuId: newSkuId.trim(),
        priceCents: Number(newPriceCents),
      });
      setNewSkuId('');
      setNewPriceCents('');
      await refresh();
    } catch (e) {
      alert('加价失败: ' + (e as Error).message);
    } finally {
      setAddingPrice(false);
    }
  }

  async function handleRemovePrice(priceId: string) {
    if (!detail) return;
    if (!confirm('确定删除该价格？')) return;
    try {
      await removeDealerPrice(detail.id, priceId);
      await refresh();
    } catch (e) {
      alert('删除价格失败: ' + (e as Error).message);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="经销商详情" subtitle={dealerId ?? ''} width="lg">
      {loading && !detail && <PageLoading />}
      {error && <ErrorBlock error={error} onRetry={refresh} />}
      {detail && (
        <div className="space-y-5">
          <section>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold">{detail.companyName}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {detail.country} ·{' '}
                  <span className="chip chip-blue">{detail.tier}</span>{' '}
                  <span
                    className={`chip ${
                      detail.status === 'active' ? 'chip-green' : 'chip-red'
                    }`}
                  >
                    {detail.status === 'active' ? '启用' : '停用'}
                  </span>
                </p>
              </div>
              <button
                onClick={handleToggleStatus}
                disabled={busy}
                className={detail.status === 'active' ? 'btn-ghost' : 'btn-primary'}
              >
                {detail.status === 'active' ? '停用' : '启用'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Row label="邮箱" value={detail.contactEmail ?? '—'} />
              <Row label="电话" value={detail.contactPhone ?? '—'} />
              <Row label="备注" value={detail.note ?? '—'} />
              <Row label="创建时间" value={new Date(detail.createdAt).toLocaleString('zh-CN')} />
            </div>
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              价格表 ({detail.priceList.length})
            </h4>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="table-th">SKU</th>
                    <th className="table-th">单价</th>
                    <th className="table-th">币种</th>
                    <th className="table-th">生效</th>
                    <th className="table-th"></th>
                  </tr>
                </thead>
                <tbody>
                  {detail.priceList.length === 0 && (
                    <tr>
                      <td className="table-td text-center text-slate-400" colSpan={5}>
                        暂无价格
                      </td>
                    </tr>
                  )}
                  {detail.priceList.map((p) => (
                    <tr key={p.id}>
                      <td className="table-td font-mono text-xs">
                        {p.skuSku ?? p.skuId}
                      </td>
                      <td className="table-td">
                        {(p.priceCents / 100).toFixed(2)}
                      </td>
                      <td className="table-td">{p.currency}</td>
                      <td className="table-td text-xs text-slate-500">
                        {new Date(p.effectiveFrom).toLocaleDateString('zh-CN')}
                        {p.effectiveTo
                          ? ` - ${new Date(p.effectiveTo).toLocaleDateString('zh-CN')}`
                          : ' - ∞'}
                      </td>
                      <td className="table-td text-right">
                        <button
                          onClick={() => handleRemovePrice(p.id)}
                          className="text-xs text-rose-600 hover:underline"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={newSkuId}
                onChange={(e) => setNewSkuId(e.target.value)}
                placeholder="SKU ID"
                className="input max-w-[200px]"
              />
              <input
                value={newPriceCents}
                onChange={(e) => setNewPriceCents(e.target.value)}
                placeholder="单价 (分)"
                type="number"
                className="input max-w-[140px]"
              />
              <button
                onClick={handleAddPrice}
                disabled={addingPrice || !newSkuId || !newPriceCents}
                className="btn-secondary"
              >
                {addingPrice ? '添加中…' : '添加价格'}
              </button>
            </div>
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              成员 ({detail.members.length})
            </h4>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="table-th">用户 ID</th>
                    <th className="table-th">名称</th>
                    <th className="table-th">手机号</th>
                    <th className="table-th">角色</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.members.length === 0 && (
                    <tr>
                      <td className="table-td text-center text-slate-400" colSpan={4}>
                        暂无成员
                      </td>
                    </tr>
                  )}
                  {detail.members.map((m) => (
                    <tr key={m.id}>
                      <td className="table-td font-mono text-xs">{m.id}</td>
                      <td className="table-td">{m.displayName ?? '—'}</td>
                      <td className="table-td font-mono text-xs">{m.phone ?? '—'}</td>
                      <td className="table-td">
                        <span className="chip chip-purple">{m.role}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </Drawer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[11px] uppercase tracking-wide text-slate-500 min-w-[64px]">
        {label}
      </span>
      <span className="text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  );
}