import { forwardRef } from 'react';
import { Copy, Check, RotateCcw, Info } from 'lucide-react';
import RadarChart from '../RadarChart';
import LearningResources from '../LearningResources';
import CompassGapSection from './CompassGapSection.jsx';
import { buildCompassNarrative, BAND_LABEL } from '../../utils/compassNarrative.js';
import { badgeBg, dimTextStyle } from '../../utils/color';
import {
  loopBalanceText, tensionLabel, tensionText, READING_GUIDE,
} from '../../utils/compassText.js';

const FORM_LABEL = { short: '精簡版', full: '完整版' };

function Bar({ value, color, label, max = 5 }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
      role="progressbar"
      aria-valuenow={Number(value.toFixed(1))}
      aria-valuemin={1}
      aria-valuemax={max}
      aria-label={label}
    >
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function TensionCard({ t, color }) {
  if (!t.available) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        <p className="font-semibold text-slate-700">{t.nameA} ↔ {t.nameB}</p>
        <p className="mt-1">這一組的有效作答不足，暫無法呈現。</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-bold text-slate-700">{t.nameA} ↔ {t.nameB}</p>
        <span className="rounded-full bg-paper-100 px-2.5 py-0.5 text-xs font-semibold text-ink-700 ring-1 ring-paper-300">
          {tensionLabel(t)}
        </span>
      </div>
      <div className="mt-3 space-y-2 text-sm">
        <div>
          <div className="mb-1 flex justify-between text-slate-600"><span>{t.nameA}</span><span className="font-semibold">{t.a.toFixed(1)}</span></div>
          <Bar value={t.a} color={color} label={`${t.nameA} 平均`} />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-slate-600"><span>{t.nameB}</span><span className="font-semibold">{t.b.toFixed(1)}</span></div>
          <Bar value={t.b} color={color} label={`${t.nameB} 平均`} />
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">平衡度 {Math.round(t.balance * 100)}%</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{tensionText(t)}</p>
      {t.lowConfidence && (
        <p className="mt-2 flex items-start gap-1 text-xs text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> 這一組題目較少，僅供參考。
        </p>
      )}
    </div>
  );
}

const CompassResultPanel = forwardRef(function CompassResultPanel(
  { result, onRetake, onCopy, copied, readOnly = false, gaps = null },
  ref,
) {
  const { dimensions, loops = [], tensions = [], aiProfile = null, assessmentName, level, form } = result;
  const colors = Object.fromEntries(dimensions.map((d) => [d.id, d.color]));
  // 雷達圖用四字中文名稱當軸標籤（英文動詞留在構面卡片的副標）。
  const radarDims = dimensions.map((d) => ({ ...d, subtitle: d.name }));
  const answered = dimensions.filter((d) => d.answered > 0);
  const byAvg = [...answered].sort((a, b) => b.average - a.average);
  const top = byAvg.slice(0, 3);
  const bottom = byAvg.length > 3 ? byAvg.slice(-3).reverse() : [];
  const allSubs = answered.flatMap((d) => (d.subs ?? []).filter((s) => s.answered > 0).map((s) => ({ ...s, dim: d })));
  const subTop = [...allSubs].sort((a, b) => b.average - a.average).slice(0, 3);
  const subBottom = allSubs.length > 6 ? [...allSubs].sort((a, b) => a.average - b.average).slice(0, 3) : [];
  const balanceText = loopBalanceText(loops);
  const learningDims = bottom.slice(0, 3);
  const narrative = buildCompassNarrative(result);

  const sections = [
    { id: 'section-loops', label: '兩個環' },
    { id: 'section-radar', label: '八構面' },
    { id: 'section-tensions', label: '張力' },
    ...(aiProfile ? [{ id: 'section-ai', label: '人機協作' }] : []),
    { id: 'section-highlights', label: '常用與待發展' },
    ...(narrative.length ? [{ id: 'section-narrative', label: '解讀' }] : []),
  ];

  return (
    <section
      ref={ref}
      aria-live="polite"
      className="mt-8 scroll-mt-20 overflow-hidden rounded-md bg-paper-50 shadow-card ring-1 ring-paper-300"
    >
      <div className="bg-ink-700 px-6 py-7 text-center text-paper-50">
        <p className="text-sm font-medium text-paper-50/75">
          {assessmentName ?? '雙環領導羅盤'}
          {form && <span className="ml-2 rounded-sm bg-paper-50/20 px-2 py-0.5 text-xs">{FORM_LABEL[form] ?? form}</span>}
        </p>
        {level && (
          <span className="mt-3 inline-block rounded-sm px-4 py-1.5 text-lg font-bold" style={{ background: badgeBg(level.color), color: '#fff' }}>
            {level.badge}
            {level.badgeEn && <span className="ml-2 text-sm font-normal">{level.badgeEn}</span>}
          </span>
        )}
      </div>

      <nav
        aria-label="報告章節導覽"
        className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-paper-300 bg-paper-50/95 px-5 py-2 text-xs backdrop-blur sm:px-7 print:hidden"
      >
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 transition-colors hover:border-brass-300 hover:text-ink-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-400"
          >
            {s.label}
          </a>
        ))}
      </nav>

      <div className="px-5 py-6 sm:px-7">
        <div className="rounded-xl bg-white p-4 text-sm leading-relaxed text-slate-600 ring-1 ring-slate-100">
          <p className="mb-1 font-semibold text-slate-700">怎麼讀這份報告</p>
          <ul className="list-disc space-y-1 pl-5">
            {READING_GUIDE.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>

        <div id="section-loops" className="mt-6 scroll-mt-14">
          <h3 className="mb-3 text-base font-bold text-slate-700">快環與永環</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {loops.map((l) => (
              <div key={l.id} className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
                <div className="flex items-baseline justify-between">
                  <p className="font-bold text-slate-700">
                    {l.name}
                    <span className="ml-2 text-xs font-semibold text-slate-500">{l.id === 'fast' ? 'FAST' : 'LAST'}</span>
                  </p>
                  <span className="font-semibold text-slate-700">{l.average.toFixed(1)}</span>
                </div>
                <div className="mt-2"><Bar value={l.average} color="#2c5282" label={`${l.name} 平均`} /></div>
                <p className="mt-2 text-xs text-slate-500">
                  {l.id === 'fast' ? '看清、定向、配置、帶動：反應要快' : '學習、穩住、育才、留能：培育要久'}
                </p>
              </div>
            ))}
          </div>
          {balanceText && <p className="mt-3 rounded-md bg-paper-50 p-3 text-sm leading-relaxed text-slate-700 ring-1 ring-paper-300">{balanceText}</p>}
        </div>

        <div id="section-radar" className="mt-6 scroll-mt-14 flex flex-col items-center">
          <h3 className="mb-2 text-base font-bold text-slate-700">8 大構面雷達圖</h3>
          <RadarChart dimensions={radarDims} />
        </div>

        <div className="mt-6 space-y-4">
          {dimensions.map((d) => (
            <div key={d.id}>
              <div className="mb-1 flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0 font-medium text-slate-700">
                  <span className="font-semibold dim-text" style={dimTextStyle(d.color)}>{d.name}</span>
                  <span className="ml-2 text-xs text-slate-500">{d.subtitle}</span>
                </span>
                <span className="shrink-0 whitespace-nowrap font-semibold text-slate-600">
                  {d.answered > 0 ? d.average.toFixed(1) : '—'}
                  <span className="ml-2 whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{d.rating.label}</span>
                </span>
              </div>
              <Bar value={d.average} color={d.color} label={`${d.name} 平均`} />
              {d.subs?.length > 0 && (
                <ul className="mt-1.5 grid gap-x-4 gap-y-0.5 text-xs text-slate-500 sm:grid-cols-2">
                  {d.subs.map((s) => (
                    <li key={s.id} className="flex justify-between">
                      <span>{s.name}</span><span>{s.answered > 0 ? s.average.toFixed(1) : '—'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div id="section-tensions" className="mt-8 scroll-mt-14">
          <h3 className="text-base font-bold text-slate-700">四組張力</h3>
          <p className="mt-1 text-xs text-slate-500">兩端都有價值、常需取捨的行為。看的是取向與平衡，不是分數高低。</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {tensions.map((t) => <TensionCard key={t.id} t={t} color={colors[t.dimensionId] ?? '#2c5282'} />)}
          </div>
        </div>

        {aiProfile && (
          <div id="section-ai" className="mt-8 scroll-mt-14">
            <h3 className="text-base font-bold text-slate-700">人機協作剖面</h3>
            <p className="mt-1 text-xs text-slate-500">散布在各構面、與 AI 及自動化工具協作相關的題目（共 {aiProfile.count} 題）。</p>
            <div className="mt-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
              <div className="flex justify-between text-sm font-semibold text-slate-700">
                <span>整體平均</span><span>{aiProfile.average.toFixed(1)}</span>
              </div>
              <div className="mt-2"><Bar value={aiProfile.average} color="#2c5282" label="人機協作整體平均" /></div>
              <ul className="mt-3 space-y-1 text-xs text-slate-600">
                {aiProfile.byDimension.map((b) => (
                  <li key={b.id} className="flex justify-between"><span>{b.name}（{b.count} 題）</span><span>{b.average.toFixed(1)}</span></li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-slate-500">人機協作是一種工作方式的變化，不是另一種能力。分數低代表目前較少這樣做，不代表不適合。</p>
            </div>
          </div>
        )}

        <div id="section-highlights" className="mt-8 scroll-mt-14">
          <h3 className="text-base font-bold text-slate-700">常用的與相對較少的行為</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-brass-200 bg-brass-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-brass-600">最常展現的構面</p>
              <ul className="mt-1 space-y-0.5 text-sm text-ink-700">
                {top.map((d) => <li key={d.id}><span className="font-bold">{d.name}</span><span className="ml-2 text-xs">平均 {d.average.toFixed(1)}</span></li>)}
              </ul>
              {subTop.length > 0 && <p className="mt-2 text-xs text-slate-600">具體行為：{subTop.map((s) => s.name).join('、')}</p>}
            </div>
            {bottom.length > 0 && (
              <div className="rounded-xl border border-brass-200 bg-brass-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-brass-600">相對較少展現的構面</p>
                <ul className="mt-1 space-y-0.5 text-sm text-ink-700">
                  {bottom.map((d) => <li key={d.id}><span className="font-bold">{d.name}</span><span className="ml-2 text-xs">平均 {d.average.toFixed(1)}</span></li>)}
                </ul>
                {subBottom.length > 0 && <p className="mt-2 text-xs text-slate-600">可從這些行為開始：{subBottom.map((s) => s.name).join('、')}</p>}
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500">「相對較少」是和您自己的其他構面比較，並非與他人比較。</p>
        </div>

        {narrative.length > 0 && (
          <div id="section-narrative" className="mt-8 scroll-mt-14">
            <h3 className="text-base font-bold text-slate-700">各構面的解讀</h3>
            <p className="mt-1 text-xs text-slate-500">依您的行為頻率撰寫；同一份結果每次看到的內容相同。</p>
            <div className="mt-3 space-y-4">
              {narrative.map((n) => (
                <article key={n.id} className="rounded-xl bg-white px-4 py-4 shadow-sm ring-1 ring-slate-100">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="font-bold dim-text" style={dimTextStyle(colors[n.id])}>{n.name}</h4>
                    <span className="rounded-full bg-paper-100 px-2.5 py-0.5 text-xs font-semibold text-ink-700 ring-1 ring-paper-300">{BAND_LABEL[n.band]}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{n.intro}</p>
                  {n.subs.length > 0 && (
                    <dl className="mt-3 space-y-3 border-t border-slate-100 pt-3 text-sm">
                      {n.subs.map((s) => (
                        <div key={s.id}>
                          <dt className="font-semibold text-slate-700">{s.name}<span className="ml-2 text-xs font-normal text-slate-500">{BAND_LABEL[s.band]}</span></dt>
                          <dd className="mt-0.5 leading-relaxed text-slate-600">{s.text}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}

        <CompassGapSection gaps={gaps} colors={colors} />

        <LearningResources assessmentId={result.assessmentId} dimensions={learningDims} />

        {!readOnly && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row print:hidden">
            <button type="button" onClick={onCopy} className="btn-secondary flex-1">
              {copied ? <><Check className="h-4 w-4" /> 已複製結果摘要</> : <><Copy className="h-4 w-4" /> 複製結果摘要</>}
            </button>
            <button type="button" onClick={onRetake} className="btn flex-1 bg-slate-700 text-white hover:bg-slate-800">
              <RotateCcw className="h-4 w-4" /> 重新評測
            </button>
          </div>
        )}
      </div>
    </section>
  );
});

export default CompassResultPanel;
