import { useEffect, useRef, useState } from 'react';
import { X, Copy } from 'lucide-react';
import RadarChart from '../components/RadarChart';
import { buildClassroomSummary, classroomOutline } from '../utils/classroom.js';
import { getAssessment } from '../data/assessments/index.js';
import { useToast } from '../components/useToast';

// 課堂模式：全螢幕、大字、只有班級彙總（沒有姓名、沒有個人分數）。給教練在教室投影或用平板帶討論。
// 完成人數不足時不顯示任何數字（utils/classroom.js）。Esc 或右上角關閉。
export default function ClassroomMode({ group, groupStats, onClose }) {
  const config = getAssessment(group.assessmentId);
  const summary = buildClassroomSummary(groupStats, group.assessmentId, { profileMode: Boolean(config?.PROFILE_MODE) });
  const closeRef = useRef(null);
  const showToast = useToast();
  const [wide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const copyOutline = async () => {
    try { await navigator.clipboard.writeText(classroomOutline(group.name, summary)); showToast('已複製討論大綱'); } catch { showToast('無法複製，請手動選取', 'error'); }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="課堂模式" className="fixed inset-0 z-[70] overflow-y-auto bg-ink-900 text-paper-50">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-10 sm:py-10">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-wide text-brass-200">課堂模式・只顯示班級彙總</p>
            <h2 className="mt-1 font-serif text-3xl font-bold sm:text-5xl">{group.name}</h2>
            {summary.available && <p className="mt-2 text-lg text-paper-200 sm:text-2xl">{summary.respondents} 位同學完成&emsp;平均 {summary.avgPercent}%</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {summary.available && (
              <button type="button" onClick={copyOutline} aria-label="複製討論大綱" className="btn-secondary btn-sm !border-paper-200/40 !bg-transparent !text-paper-50 hover:!bg-white/10">
                <Copy className="h-4 w-4" /> <span className="hidden sm:inline">複製討論大綱</span>
              </button>
            )}
            <button ref={closeRef} type="button" onClick={onClose} aria-label="離開課堂模式" className="btn-icon !h-11 !w-11 !text-paper-50 hover:!bg-white/10">
              <X className="h-6 w-6" />
            </button>
          </div>
        </header>

        {!summary.available ? (
          <p role="status" className="rounded-2xl bg-white/10 px-6 py-10 text-center text-xl leading-relaxed">{summary.reason}</p>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <section aria-label="班級整體能力雷達" className="rounded-3xl bg-paper-50 px-3 py-6 text-slate-800">
              <div className="flex flex-col items-center">
                <RadarChart dimensions={summary.dimensions} size={wide ? 420 : 280} presentation />
              </div>
            </section>

            <div className="space-y-6">
              {!summary.profileMode && (
                <section aria-label="優勢與待加強" className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white/10 px-5 py-4">
                    <h3 className="text-lg font-bold text-brass-200">這班的優勢</h3>
                    <ul className="mt-2 space-y-1.5 text-xl sm:text-2xl">
                      {summary.strongest.map((d) => <li key={d.id} className="flex justify-between gap-3"><span>{d.label}</span><strong>{d.percent}%</strong></li>)}
                    </ul>
                  </div>
                  <div className="rounded-2xl bg-white/10 px-5 py-4">
                    <h3 className="text-lg font-bold text-brass-200">最值得一起練習</h3>
                    <ul className="mt-2 space-y-1.5 text-xl sm:text-2xl">
                      {summary.weakest.map((d) => <li key={d.id} className="flex justify-between gap-3"><span>{d.label}</span><strong>{d.percent}%</strong></li>)}
                    </ul>
                  </div>
                </section>
              )}

              <section aria-label="落點分布" className="rounded-2xl bg-white/10 px-5 py-4">
                <h3 className="mb-3 text-lg font-bold text-brass-200">大家的落點</h3>
                <ul className="space-y-2.5 text-lg sm:text-xl">
                  {summary.levelDistribution.map((l) => (
                    <li key={l.id}>
                      <div className="flex justify-between gap-3"><span>{l.badge}</span><span>{l.count} 人（{l.share}%）</span></div>
                      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full" style={{ width: `${l.share}%`, background: l.color }} /></div>
                    </li>
                  ))}
                </ul>
              </section>

              {summary.prompts.length > 0 && (
                <section aria-label="討論題" className="rounded-2xl bg-brass-200 px-5 py-4 text-ink-900">
                  <h3 className="text-lg font-bold">討論題</h3>
                  <ol className="mt-2 list-decimal space-y-3 pl-6 text-xl sm:text-2xl">
                    {summary.prompts.map((p) => (
                      <li key={p.dimension}>
                        {p.question}
                        {p.activity && <p className="mt-1 text-base font-normal opacity-80 sm:text-lg">活動：{p.activity}</p>}
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
