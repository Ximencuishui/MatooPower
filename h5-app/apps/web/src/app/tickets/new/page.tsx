'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { Spinner } from '@/components/Spinner';
import { useT } from '@/lib/i18n';
import { createTicket, listMyDevices } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { getSession } from '@/lib/api/auth-store';
import { toast, toastSuccess } from '@/components/Toast';
import type { DeviceDto, CreateTicketBody } from '@/lib/api/endpoints';

function NewTicketInner() {
  const { t } = useT();
  const router = useRouter();
  const sp = useSearchParams();

  const [type, setType] = useState<CreateTicketBody['type']>('general');
  const [severity, setSeverity] = useState<CreateTicketBody['severity']>('normal');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [deviceId, setDeviceId] = useState<string>(sp.get('deviceId') ?? '');
  const [devices, setDevices] = useState<DeviceDto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s?.token) { setError(t.ticket.needLogin); return; }
    listMyDevices().then((r) => setDevices(r.items)).catch(() => setDevices([]));
  }, [t.ticket.needLogin]);

  function submit() {
    setError(null);
    if (subject.trim().length < 3 || description.trim().length < 5) {
      setError(t.ticket.fillRequired);
      return;
    }
    setSubmitting(true);
    const body: CreateTicketBody = {
      type, severity, subject: subject.trim(), description: description.trim(),
      deviceId: deviceId || undefined,
    };
    createTicket(body)
      .then((r) => {
        toastSuccess(t.ticket.submit + ' ✓');
        router.push(`/tickets/${r.ticket.id}`);
      })
      .catch((e: unknown) => {
        const msg = e instanceof ApiError ? e.message : (e instanceof Error ? e.message : t.ticket.submitFailed);
        setError(msg);
        toast(msg, 'error');
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <PhoneShell>
      <TopBar title={t.ticket.newTitle} />
      <main className="flex-1 overflow-auto p-4 space-y-4">
        <div>
          <label className="label" htmlFor="t-type">{t.ticket.type}</label>
          <select id="t-type" className="input" value={type} onChange={(e) => setType(e.target.value as CreateTicketBody['type'])}>
            <option value="general">{t.ticket.typeGeneral}</option>
            <option value="warranty">{t.ticket.typeWarranty}</option>
            <option value="inquiry">{t.ticket.typeInquiry}</option>
            <option value="remote">{t.ticket.typeRemote}</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="t-severity">{t.ticket.severityLabel}</label>
          <select id="t-severity" className="input" value={severity} onChange={(e) => setSeverity(e.target.value as CreateTicketBody['severity'])}>
            <option value="low">{t.ticket.sevLow}</option>
            <option value="normal">{t.ticket.sevNormal}</option>
            <option value="high">{t.ticket.sevHigh}</option>
            <option value="urgent">{t.ticket.sevUrgent}</option>
          </select>
        </div>

        {devices.length > 0 && (
          <div>
            <label className="label" htmlFor="t-device">{t.ticket.relatedDevice}</label>
            <select id="t-device" className="input" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
              <option value="">—</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {(d.s_modelName ?? d.skuId).slice(0, 40)} · {d.s_serial ?? d.id}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label" htmlFor="t-subject">{t.ticket.subjectLabel}</label>
          <input id="t-subject" className="input" placeholder={t.ticket.subjectPh} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />
          <div className="text-[11px] text-slate-400 mt-1 text-right">{subject.length} / 120</div>
        </div>

        <div>
          <label className="label" htmlFor="t-desc">{t.ticket.descLabel}</label>
          <textarea id="t-desc" className="input min-h-[140px] py-2" placeholder={t.ticket.descPh} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
          <div className="text-[11px] text-slate-400 mt-1 text-right">{description.length} / 1000</div>
        </div>

        {error && <div role="alert" className="text-xs text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-300 p-3 rounded-xl">{error}</div>}

        <button onClick={submit} disabled={submitting} className="btn-primary inline-flex items-center justify-center gap-2">
          {submitting ? <Spinner size="sm" /> : null}
          {submitting ? t.common.loading : t.ticket.submit}
        </button>
      </main>
    </PhoneShell>
  );
}

function NewTicketFallback() {
  return (
    <PhoneShell>
      <TopBar title="…" />
      <main className="p-5 text-slate-400 text-sm">Loading…</main>
    </PhoneShell>
  );
}

export default function NewTicketPage() {
  return (
    <Suspense fallback={<NewTicketFallback />}>
      <NewTicketInner />
    </Suspense>
  );
}
