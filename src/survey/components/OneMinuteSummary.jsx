import { Timer } from 'lucide-react';
import { buildOneMinute } from '../utils/oneMinute.js';

// 結果頁「一分鐘看懂」：三句話＋一個往下的提示。詳細的圖表與敘事都還在下面，這裡只做收斂。
export default function OneMinuteSummary({ result, config, nextHint = true }) {
  const s = buildOneMinute(result, config);
  if (!s) return null;
  return (
    <section aria-label="一分鐘看懂" className="mx-5 mt-5 rounded-xl border border-ink-700/15 bg-white px-5 py-4 print:hidden sm:mx-7">
      <h3 className="flex items-center gap-1.5 font-serif text-lg font-bold text-ink-700"><Timer className="h-5 w-5" aria-hidden="true" /> 一分鐘看懂</h3>
      <dl className="mt-2 space-y-2.5">
        {s.lines.map((l) => (
          <div key={l.label} className="grid gap-0.5 sm:grid-cols-[6.5rem_1fr] sm:gap-3">
            <dt className="text-sm font-semibold text-brass-600">{l.label}</dt>
            <dd className="leading-relaxed text-slate-700">{l.text}</dd>
          </div>
        ))}
      </dl>
      {nextHint && s.focus && <p className="mt-3 text-sm text-slate-500">想看細節？下面有雷達圖、強弱項與完整敘事；或直接從下面「選一件事」開始。</p>}
    </section>
  );
}
