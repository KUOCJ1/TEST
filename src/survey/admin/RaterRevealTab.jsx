import { useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { api } from '../api/client';
import { REGISTRY } from '../data/assessments/index.js';
import { RATER_LABELS } from '../constants/raterTypes';
import { formatDate } from '../utils/format';

const STRICT = Object.values(REGISTRY).filter((c) => c.STRICT_RATER_PRIVACY);
const MIN_REASON = 5;

/**
 * 管理員還原嚴格隱私題庫（領導力羅盤）的評分者身分。只有管理員能用，必須填理由（至少 5 個字），
 * 每次查看都會寫入稽核紀錄；教練與受評者永遠看不到這些資訊。
 */
export default function RaterRevealTab({ users }) {
  const [assessmentId, setAssessmentId] = useState(STRICT[0]?.ID ?? '');
  const [filter, setFilter] = useState('');
  const [rateeId, setRateeId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const candidates = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return users
      .filter((u) => u.role !== 'admin' && (!q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)))
      .slice(0, 50);
  }, [users, filter]);

  if (STRICT.length === 0) {
    return <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">目前沒有需要還原身分的評量。</p>;
  }

  const reveal = async () => {
    setError('');
    setData(null);
    if (!rateeId) { setError('請先選擇受評者'); return; }
    if (reason.trim().length < MIN_REASON) { setError(`請填寫理由（至少 ${MIN_REASON} 個字）`); return; }
    setBusy(true);
    try {
      setData(await api.revealRaters(rateeId, { assessmentId, reason: reason.trim() }));
    } catch (e) {
      setError(e.message || '查詢失敗');
    } finally {
      setBusy(false);
    }
  };

  const raters = (data?.submissions ?? []).filter((s) => s.raterType !== 'self');

  return (
    <section aria-label="身分還原" className="space-y-4">
      <div role="note" className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p>
          這個功能會顯示「誰評了這位受評者」與個別分數。只在有正當理由時使用（例如申訴或不當評分調查）；
          <strong>每次查看都會留下稽核紀錄</strong>（操作者、受評者、理由），無法刪除。
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {STRICT.length > 1 && (
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-slate-700">評量</span>
            <select value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2">
              {STRICT.map((c) => <option key={c.ID} value={c.ID}>{c.NAME}</option>)}
            </select>
          </label>
        )}
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-slate-700">搜尋受評者（姓名或 Email）</span>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-semibold text-slate-700">受評者</span>
          <select value={rateeId} onChange={(e) => setRateeId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2">
            <option value="">請選擇</option>
            {candidates.map((u) => <option key={u.id} value={u.id}>{u.name}（{u.email}）</option>)}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-semibold text-slate-700">還原理由（必填，至少 {MIN_REASON} 個字）</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500}
            className="w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
      </div>

      <button type="button" onClick={reveal} disabled={busy} className="btn-primary btn-sm disabled:opacity-50">
        {busy ? '查詢中…' : '還原並查看（會留下稽核紀錄）'}
      </button>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {data && (
        raters.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-4 py-4 text-sm text-slate-600">{data.ratee?.name} 目前沒有任何他評。這次查詢已記錄。</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <caption className="px-3 py-2 text-left text-xs text-slate-500">{data.ratee?.name} 的他評（共 {raters.length} 筆）</caption>
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr><th className="px-3 py-2">評分者</th><th className="px-3 py-2">身分</th><th className="px-3 py-2">階段</th><th className="px-3 py-2">時間</th><th className="px-3 py-2">各構面平均</th></tr>
              </thead>
              <tbody>
                {raters.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2 font-semibold text-slate-700">{s.userName}</td>
                    <td className="px-3 py-2">{RATER_LABELS[s.raterType] ?? s.raterType}</td>
                    <td className="px-3 py-2">{s.phase === 'post' ? '課後' : s.phase === 'pre' ? '課前' : '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2">{formatDate(s.createdAt)}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {(s.result?.dimensions ?? []).map((d) => `${d.subtitle ?? d.name} ${Number(d.average ?? 0).toFixed(1)}`).join('、')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </section>
  );
}
