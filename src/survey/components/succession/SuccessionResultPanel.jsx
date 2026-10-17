import { forwardRef } from 'react';
import { Copy, Check, RotateCcw } from 'lucide-react';
import { badgeBg, dimTextStyle } from '../../utils/color';
import { SUCCESSION_READING, SUCCESSION_TEXT } from '../../utils/successionText.js';

function Bar({ value, color, label }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Number(value.toFixed(1))} aria-valuemin={1} aria-valuemax={5} aria-label={label}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, (value / 5) * 100))}%`, background: color }} />
    </div>
  );
}

/** 接班補充問卷的結果頁：四個面向的「傾向」與對話建議。沒有總分、排名或比較。 */
const SuccessionResultPanel = forwardRef(function SuccessionResultPanel({ result, onRetake, onCopy, copied, readOnly = false }, ref) {
  const { dimensions, level, assessmentName } = result;
  return (
    <section ref={ref} aria-live="polite" className="mt-8 scroll-mt-20 overflow-hidden rounded-md bg-paper-50 shadow-card ring-1 ring-paper-300">
      <div className="bg-ink-700 px-6 py-7 text-center text-paper-50">
        <p className="text-sm font-medium text-paper-50/75">{assessmentName ?? '接班補充問卷'}</p>
        {level && (
          <span className="mt-3 inline-block rounded-sm px-4 py-1.5 text-lg font-bold" style={{ background: badgeBg(level.color), color: '#fff' }}>
            {level.badge}<span className="ml-2 text-sm font-normal">{level.badgeEn}</span>
          </span>
        )}
      </div>
      <div className="px-5 py-6 sm:px-7">
        <div className="rounded-xl bg-white p-4 text-sm leading-relaxed text-slate-600 ring-1 ring-slate-100">
          <p className="mb-1 font-semibold text-slate-700">怎麼讀這份整理</p>
          <ul className="list-disc space-y-1 pl-5">{SUCCESSION_READING.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
        <div className="mt-6 space-y-5">
          {dimensions.map((d) => {
            const skipped = d.answered === 0;
            return (
              <article key={d.id} className="rounded-xl bg-white px-4 py-4 shadow-sm ring-1 ring-slate-100">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-bold dim-text" style={dimTextStyle(d.color)}>
                    {d.name}<span className="ml-2 text-xs font-normal text-slate-500">{d.subtitle}</span>
                  </h3>
                  {!skipped && <span className="rounded-full bg-paper-100 px-2.5 py-0.5 text-xs font-semibold text-ink-700 ring-1 ring-paper-300">傾向{d.rating.label}</span>}
                </div>
                {skipped ? (
                  <p className="mt-2 text-sm text-slate-500">您選擇不回答這個面向的題目，所以這裡不顯示內容。</p>
                ) : (
                  <>
                    <div className="mt-2"><Bar value={d.average} color={d.color} label={`${d.name} 平均`} /></div>
                    <p className="mt-3 text-sm leading-relaxed text-slate-700">{SUCCESSION_TEXT[d.id]?.[d.stance]}</p>
                  </>
                )}
              </article>
            );
          })}
        </div>
        {!readOnly && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row print:hidden">
            <button type="button" onClick={onCopy} className="btn-secondary flex-1">
              {copied ? <><Check className="h-4 w-4" /> 已複製</> : <><Copy className="h-4 w-4" /> 複製結果摘要</>}
            </button>
            <button type="button" onClick={onRetake} className="btn flex-1 bg-slate-700 text-white hover:bg-slate-800"><RotateCcw className="h-4 w-4" /> 重新填寫</button>
          </div>
        )}
      </div>
    </section>
  );
});

export default SuccessionResultPanel;
