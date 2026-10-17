import { GAP_TEXT } from '../../utils/compassText.js';
import { dimTextStyle } from '../../utils/color';

/**
 * 自評與他評落差。gaps 為 computeGaps() 的回傳值。
 * 他評者不足時只顯示說明，不顯示任何數字（匿名門檻，規格 7.2）。
 */
export default function CompassGapSection({ gaps, colors = {} }) {
  if (!gaps) return null;
  if (!gaps.available) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-700">自評與他評的落差</p>
        <p className="mt-1">
          目前回覆的他評者不足 {gaps.minRaters} 位，為保護評分者的匿名，暫不顯示他評結果。
          {typeof gaps.raters === 'number' && gaps.raters > 0 ? `（已完成 ${gaps.raters} 位）` : ''}
        </p>
      </div>
    );
  }
  const rows = gaps.dimensions.filter((d) => d.gap !== null);
  const notable = rows.filter((d) => d.type !== 'aligned');
  return (
    <div className="mt-6">
      <h3 className="text-base font-bold text-slate-700">自評與他評的落差</h3>
      <p className="mt-1 text-xs text-slate-500">依 {gaps.raters} 位他評者的平均（個別回答與身分不會顯示）。落差是對話的起點，不是對錯的判決。</p>
      <ul className="mt-3 space-y-2">
        {rows.map((d) => (
          <li key={d.id} className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold dim-text" style={dimTextStyle(colors[d.id])}>{d.name}</span>
              <span className="text-slate-600">
                自評 {d.self.toFixed(1)}，他評 {d.others.toFixed(1)}，
                <span className={d.type === 'aligned' ? 'text-slate-500' : 'font-semibold text-ink-700'}>
                  {GAP_TEXT[d.type]}（{d.gap > 0 ? '+' : ''}{d.gap.toFixed(1)}）
                </span>
              </span>
            </div>
          </li>
        ))}
      </ul>
      {notable.length === 0 && <p className="mt-3 text-sm text-slate-600">各構面的自評與他評大致一致。</p>}
    </div>
  );
}
