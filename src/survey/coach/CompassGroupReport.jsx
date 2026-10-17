import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { buildCompassGroupReport, latestSelfByUser, FULL_MIN, BASIC_MIN } from '../utils/compassGroup.js';
import { TENSION_TYPE_LABEL } from '../utils/compassText.js';

function Row({ label, value, color }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm text-slate-600"><span>{label}</span><span className="font-semibold">{value.toFixed(1)}</span></div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Number(value.toFixed(1))} aria-valuemin={1} aria-valuemax={5} aria-label={`${label} 平均`}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color ?? '#2c5282' }} />
      </div>
    </div>
  );
}

/**
 * 班級組織診斷（雙環領導羅盤）。為保護個人，受評者不足 5 位時會逐級隱藏細節（規格第 8 節）。
 */
export default function CompassGroupReport({ group, members, submissions }) {
  const phases = useMemo(() => {
    const set = new Set(submissions.filter((s) => (s.raterType ?? 'self') === 'self' && s.result?.dimensions).map((s) => s.phase ?? 'pre'));
    return ['pre', 'post'].filter((p) => set.has(p));
  }, [submissions]);
  const [phase, setPhase] = useState(null);
  const activePhase = phase ?? (phases.includes('post') ? 'post' : phases[0] ?? 'pre');

  const report = useMemo(() => {
    const latest = latestSelfByUser(submissions, { phase: activePhase, assessmentId: group.assessmentId });
    return buildCompassGroupReport(latest.map((s) => s.result), members.length);
  }, [submissions, activePhase, group.assessmentId, members.length]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-slate-800">組織診斷</h3>
        {phases.length > 1 && (
          <div role="group" aria-label="階段" className="flex gap-1 text-sm">
            {phases.map((p) => (
              <button key={p} type="button" aria-pressed={activePhase === p} onClick={() => setPhase(p)}
                className={`rounded-full px-3 py-1 font-semibold ${activePhase === p ? 'bg-ink-700 text-white' : 'border border-slate-300 bg-white text-slate-600'}`}>
                {p === 'pre' ? '課前' : '課後'}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          這份報告描述的是「這群人的行為模式」，不是組織文化的診斷結論，也不會顯示任何個人的分數。
          為保護個人，完成人數不足 {FULL_MIN} 位時只顯示平均（{BASIC_MIN}–{FULL_MIN - 1} 位）或完成率（少於 {BASIC_MIN} 位）。
        </span>
      </p>

      <div className="rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-slate-100">
        已完成自評 <strong>{report.n}</strong> / {report.memberCount} 人（{Math.round(report.completion * 100)}%）
      </div>

      {report.tier === 'hidden' && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
          完成人數少於 {BASIC_MIN} 位，暫不顯示分數與統計，以保護個人。
        </p>
      )}

      {report.tier !== 'hidden' && (
        <>
          {report.tier === 'basic' && (
            <p className="rounded-lg border border-brass-200 bg-brass-50 px-3 py-2 text-xs text-ink-700">樣本少，僅供參考；完成人數達 {FULL_MIN} 位才會顯示分布與張力。</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {report.loops.map((l) => (
              <div key={l.id} className="rounded-xl bg-white px-4 py-3 ring-1 ring-slate-100"><Row label={`${l.name}平均`} value={l.average} /></div>
            ))}
          </div>
          <div className="space-y-3 rounded-xl bg-white px-4 py-4 ring-1 ring-slate-100">
            <p className="text-sm font-bold text-slate-700">八構面平均</p>
            {report.dimensions.map((d) => <Row key={d.id} label={d.name} value={d.average} color={d.color} />)}
          </div>
        </>
      )}

      {report.tier === 'full' && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-brass-200 bg-brass-50 px-4 py-3 text-sm text-ink-700">
              <p className="text-xs font-semibold text-brass-600">這群人最常展現</p>
              {report.extremes.top.map((d) => <p key={d.id} className="font-bold">{d.name}<span className="ml-2 text-xs font-normal">{d.average.toFixed(1)}</span></p>)}
            </div>
            <div className="rounded-xl border border-brass-200 bg-brass-50 px-4 py-3 text-sm text-ink-700">
              <p className="text-xs font-semibold text-brass-600">這群人相對較少展現</p>
              {report.extremes.bottom.map((d) => <p key={d.id} className="font-bold">{d.name}<span className="ml-2 text-xs font-normal">{d.average.toFixed(1)}</span></p>)}
            </div>
          </div>
          <div className="rounded-xl bg-white px-4 py-4 ring-1 ring-slate-100">
            <p className="text-sm font-bold text-slate-700">四組張力的取向分布</p>
            <p className="mt-1 text-xs text-slate-500">看的是這群人偏向哪一端、有多少人兼顧，不是分數高低。</p>
            <ul className="mt-3 space-y-3 text-sm">
              {report.tensions.map((t) => (
                <li key={t.id}>
                  <p className="font-semibold text-slate-700">{t.nameA} ↔ {t.nameB}<span className="ml-2 text-xs font-normal text-slate-500">平均 {t.averageA?.toFixed(1) ?? '—'} ／ {t.averageB?.toFixed(1) ?? '—'}（{t.respondents} 人）</span></p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {Object.entries(t.typeCounts).map(([type, c]) => {
                      const label = type === 'lean_a' ? `偏向${t.nameA}` : type === 'lean_b' ? `偏向${t.nameB}` : TENSION_TYPE_LABEL[type];
                      return `${label} ${c} 人`;
                    }).join('、') || '尚無資料'}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <p className="text-xs text-slate-400">自評與他評落差的群體分布需要伺服器彙整，目前尚未提供。</p>
    </div>
  );
}
