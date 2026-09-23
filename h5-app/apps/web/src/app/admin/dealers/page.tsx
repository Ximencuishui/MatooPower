'use client';
// P1-2 v1.4:经销商管理(admin 后台) — 列表 + 详情 + 创建/编辑/暂停 + 专属价格
// i18n 完整(走 adminDealers 字典键)

import { useEffect, useState } from 'react';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar, AdminBreadcrumb } from '@/components/TopBar';
import { LangSwitch } from '@/components/LangSwitch';
import { PageLoading } from '@/components/Spinner';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { Drawer } from '@/components/Drawer';
import { Confirm } from '@/components/Confirm';
import { useT } from '@/lib/i18n';
import {
  listAdminDealers,
  getAdminDealer,
  createAdminDealer,
  updateAdminDealer,
  suspendAdminDealer,
  activateAdminDealer,
  addAdminDealerPrice,
  removeAdminDealerPrice,
} from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { useRequireRole, RoleGuardView } from '@/hooks/useRequireRole';
import { useAbortedFetch } from '@/hooks/useAbortedFetch';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { toastError, toastSuccess } from '@/components/Toast';
import type { AdminDealerItem, AdminDealerDetail } from '@/lib/api/operations';

type Mode = 'list' | 'create' | 'edit';

export default function AdminDealersPage() {
  const { t } = useT();
  const { formatDate, formatNumber } = useLocaleFormat();
  const guard = useRequireRole(['admin']);

  const [items, setItems] = useState<AdminDealerItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<AdminDealerDetail | null>(null);
  const [mode, setMode] = useState<Mode>('list');
  const [formData, setFormData] = useState({
    companyName: '', country: 'BD', tier: 'silver' as 'silver' | 'gold' | 'platinum',
    contactEmail: '', contactPhone: '', note: '',
  });

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  useAbortedFetch((signal) => {
    if (guard.status !== 'ok') return;
    setError(null);
    listAdminDealers(
      { q: debouncedSearch.trim() || undefined, pageSize: 100 },
      { signal },
    )
      .then((r) => { setItems(r.items); setTotal(r.total); })
      .catch((e) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e);
      });
  }, [debouncedSearch, guard.status, reloadKey]);

  if (guard.status !== 'ok') {
    return <RoleGuardView state={guard} title={t.dealerAdmin.title} />;
  }

  const reload = () => setReloadKey((k) => k + 1);

  const openDetail = async (id: string) => {
    try {
      const r = await getAdminDealer(id);
      setSelected(r.dealer);
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : String(e));
    }
  };

  const onCreate = async () => {
    try {
      const r = await createAdminDealer({
        companyName: formData.companyName,
        country: formData.country,
        tier: formData.tier,
        contactEmail: formData.contactEmail || undefined,
        contactPhone: formData.contactPhone || undefined,
        note: formData.note || undefined,
      });
      toastSuccess(t.dealerAdmin.addTitle);
      setMode('list');
      setFormData({ companyName: '', country: 'BD', tier: 'silver', contactEmail: '', contactPhone: '', note: '' });
      reload();
      openDetail(r.dealer.id);
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : String(e));
    }
  };

  const onEdit = async (id: string) => {
    try {
      await updateAdminDealer(id, {
        companyName: formData.companyName || undefined,
        tier: formData.tier,
        contactEmail: formData.contactEmail || undefined,
        contactPhone: formData.contactPhone || undefined,
        note: formData.note || undefined,
      });
      toastSuccess(t.dealerAdmin.editTitle);
      setMode('list');
      reload();
      openDetail(id);
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : String(e));
    }
  };

  const onSuspend = async (id: string) => {
    try {
      await suspendAdminDealer(id);
      toastSuccess(t.dealerAdmin.actions_suspend);
      reload();
      openDetail(id);
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : String(e));
    }
  };

  const onActivate = async (id: string) => {
    try {
      await activateAdminDealer(id);
      toastSuccess(t.dealerAdmin.actions_activate);
      reload();
      openDetail(id);
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : String(e));
    }
  };

  const onAddPrice = async (dealerId: string, skuId: string, priceCents: number) => {
    try {
      await addAdminDealerPrice(dealerId, { skuId, priceCents });
      toastSuccess(t.dealerAdmin.price_add);
      openDetail(dealerId);
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : String(e));
    }
  };

  const onRemovePrice = async (dealerId: string, priceId: string) => {
    try {
      await removeAdminDealerPrice(dealerId, priceId);
      toastSuccess(t.dealerAdmin.price_remove);
      openDetail(dealerId);
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : String(e));
    }
  };

  return (
    <PhoneShell>
      <TopBar
        title={t.dealerAdmin.title}
        leftExtra={<AdminBreadcrumb />}
        right={<LangSwitch />}
      />
      <main className="flex-1 overflow-auto pb-6">
        <section className="px-4 mt-3">
          <div className="card p-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{t.adminUsers.total}</span>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {formatNumber(total)}
              </span>
            </div>
            <button
              onClick={() => setMode('create')}
              className="btn-primary text-sm w-full mt-2"
            >
              + {t.dealerAdmin.addTitle}
            </button>
          </div>
        </section>

        <div className="px-4 mt-3">
          <form onSubmit={(e) => e.preventDefault()} className="relative">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.adminUsers.searchPh}
              dir="auto"
              className="input pr-9"
              aria-label="search dealers"
            />
          </form>
        </div>

        <section className="px-4 mt-3 space-y-2">
          {error != null && !items && (
            <ErrorBlock
              error={error}
              onRetry={reload}
              showLoginLink={error instanceof ApiError && error.status === 401}
              loginNext="/admin/dealers"
            />
          )}
          {!error && !items && <PageLoading />}
          {!error && items && items.length === 0 && (
            <EmptyState icon="🏢" title={t.dealerAdmin.empty} />
          )}
          {items?.map((d) => (
            <button
              key={d.id}
              onClick={() => openDetail(d.id)}
              className="card p-3 w-full text-left"
            >
              <div className="flex items-start gap-2">
                <div className="w-9 h-9 rounded-full bg-matoo-light dark:bg-slate-700 flex items-center justify-center text-matoo-dark dark:text-matoo-light text-sm font-semibold flex-shrink-0">
                  {d.companyName.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{d.companyName}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {d.country} · {t.dealerAdmin[`tier_${d.tier}` as keyof typeof t.dealerAdmin]}
                    {' · '}
                    {formatDate(d.createdAt)}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {d.memberCount ?? 0} users · {d.priceListCount ?? 0} prices
                  </div>
                </div>
                <span className={`chip text-[10px] ${d.status === 'active' ? 'chip-green' : 'chip-gray'}`}>
                  {d.status === 'active' ? t.dealerAdmin.status_active : t.dealerAdmin.status_suspended}
                </span>
              </div>
            </button>
          ))}
        </section>
      </main>

      {/* 创建 / 编辑 Drawer */}
      <Drawer
        open={mode !== 'list'}
        onClose={() => setMode('list')}
        title={mode === 'create' ? t.dealerAdmin.addTitle : t.dealerAdmin.editTitle}
      >
        <div className="p-4 space-y-3 text-sm">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              {t.dealerAdmin.company}
            </label>
            <input
              className="input"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              disabled={mode === 'edit'}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                {t.dealerAdmin.country}
              </label>
              <input
                className="input"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                disabled={mode === 'edit'}
                maxLength={3}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                {t.dealerAdmin.tier}
              </label>
              <select
                className="input"
                value={formData.tier}
                onChange={(e) => setFormData({ ...formData, tier: e.target.value as any })}
              >
                <option value="silver">{t.dealerAdmin.tier_silver}</option>
                <option value="gold">{t.dealerAdmin.tier_gold}</option>
                <option value="platinum">{t.dealerAdmin.tier_platinum}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              {t.dealerAdmin.contact}
            </label>
            <input
              className="input"
              type="email"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              placeholder="email"
            />
            <input
              className="input mt-2"
              type="tel"
              value={formData.contactPhone}
              onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
              placeholder="phone"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              Note
            </label>
            <textarea
              className="input min-h-[60px]"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button onClick={() => setMode('list')} className="btn-secondary text-sm">
              {t.common.cancel}
            </button>
            <button
              onClick={() => (mode === 'create' ? onCreate() : selected && onEdit(selected.id))}
              className="btn-primary text-sm"
              disabled={!formData.companyName.trim()}
            >
              {t.common.save}
            </button>
          </div>
        </div>
      </Drawer>

      {/* 详情 Drawer */}
      <Drawer
        open={!!selected && mode === 'list'}
        onClose={() => setSelected(null)}
        title={selected?.companyName ?? ''}
      >
        {selected && (
          <div className="p-4 space-y-3 text-sm">
            <div className="card p-3 space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">{t.dealerAdmin.tier}</span>
                <span className="font-semibold">{t.dealerAdmin[`tier_${selected.tier}` as keyof typeof t.dealerAdmin]}</span>
              </div>
              <div className="flex justify-between"><span className="text-slate-500">{t.dealerAdmin.country}</span>
                <span className="font-mono">{selected.country}</span>
              </div>
              <div className="flex justify-between"><span className="text-slate-500">{t.dealerAdmin.status}</span>
                <span className={`chip text-[10px] ${selected.status === 'active' ? 'chip-green' : 'chip-gray'}`}>
                  {selected.status === 'active' ? t.dealerAdmin.status_active : t.dealerAdmin.status_suspended}
                </span>
              </div>
              <div className="flex justify-between"><span className="text-slate-500">{t.dealerAdmin.contact}</span>
                <span className="truncate max-w-[60%]">{selected.contactEmail ?? '—'}</span>
              </div>
            </div>

            {/* 专属价格表 */}
            <div className="card p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">{t.dealerAdmin.priceListTitle}</h4>
                <PriceAddInline onAdd={(skuId, priceCents) => onAddPrice(selected.id, skuId, priceCents)} t={t.dealerAdmin} />
              </div>
              {selected.priceList.length === 0 && (
                <div className="text-xs text-slate-500 dark:text-slate-400 py-2">
                  {t.dealerAdmin.priceListEmpty}
                </div>
              )}
              {selected.priceList.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs py-1 border-t border-slate-100 dark:border-slate-800">
                  <div className="truncate">
                    <span className="font-mono">{p.skuSku ?? p.skuId}</span>
                    <span className="ml-2">{(p.priceCents / 100).toFixed(2)} {p.currency}</span>
                  </div>
                  <button
                    onClick={() => onRemovePrice(selected.id, p.id)}
                    className="text-red-500 dark:text-red-400 text-[10px] underline"
                  >
                    {t.dealerAdmin.price_remove}
                  </button>
                </div>
              ))}
            </div>

            {/* 操作区 */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => {
                  setFormData({
                    companyName: selected.companyName,
                    country: selected.country,
                    tier: selected.tier,
                    contactEmail: selected.contactEmail ?? '',
                    contactPhone: selected.contactPhone ?? '',
                    note: selected.note ?? '',
                  });
                  setMode('edit');
                }}
                className="btn-secondary text-sm"
              >
                {t.dealerAdmin.editTitle}
              </button>
              {selected.status === 'active' ? (
                <Confirm
                  destructive
                  trigger={(open) => (
                    <button onClick={open} className="btn-ghost text-red-500 text-sm">
                      {t.dealerAdmin.actions_suspend}
                    </button>
                  )}
                  title={t.dealerAdmin.actions_suspend}
                  description={selected.companyName}
                  confirmLabel={t.dealerAdmin.actions_suspend}
                  onConfirm={() => onSuspend(selected.id)}
                />
              ) : (
                <button onClick={() => onActivate(selected.id)} className="btn-primary text-sm">
                  {t.dealerAdmin.actions_activate}
                </button>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </PhoneShell>
  );
}

function PriceAddInline({
  onAdd,
  t,
}: {
  onAdd: (skuId: string, priceCents: number) => void;
  t: any;
}) {
  const [open, setOpen] = useState(false);
  const [skuId, setSkuId] = useState('');
  const [price, setPrice] = useState('');

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs underline text-matoo">
        + {t.price_add}
      </button>
    );
  }
  return (
    <div className="flex gap-1 items-center text-[10px]">
      <input
        className="input w-20 px-1 py-0.5 text-[10px]"
        placeholder="SKU id"
        value={skuId}
        onChange={(e) => setSkuId(e.target.value)}
      />
      <input
        className="input w-16 px-1 py-0.5 text-[10px]"
        type="number"
        placeholder="cents"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <button
        onClick={() => {
          const cents = Math.round(Number(price) * 100);
          if (skuId && cents > 0) {
            onAdd(skuId, cents);
            setSkuId(''); setPrice(''); setOpen(false);
          }
        }}
        className="btn-primary px-2 py-0.5 text-[10px]"
      >
        ✓
      </button>
      <button onClick={() => setOpen(false)} className="text-slate-400 px-1">×</button>
    </div>
  );
}