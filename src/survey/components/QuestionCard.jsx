import { memo } from 'react';
import { SCALE_LABELS } from '../data/questions';

// 反向計分題（question.reversed）刻意不在畫面上標示：反向題的作用是偵測「不看
// 題目內容、一律勾高分」這類敷衍作答傾向，若事先告訴受測者哪幾題是反向題，
// 這個機制就完全失效了。計分邏輯（utils/scoring.js）不受影響，正常反轉分數。
function QuestionCard({ number, question, value, onChange, invalid, inputRef, onAdvance }) {
  // 鍵盤快速作答：題目聚焦時按數字鍵直接選分並自動跳到下一題，不必逐一點滑鼠。
  const handleKeyDown = (e) => {
    const opt = SCALE_LABELS.find((o) => String(o.value) === e.key);
    if (!opt) return;
    e.preventDefault();
    onChange(question.id, opt.value);
    onAdvance?.(question.id);
  };

  return (
    <fieldset
      ref={inputRef}
      data-question-id={question.id}
      onKeyDown={handleKeyDown}
      className={`scroll-mt-28 rounded-xl border px-4 py-4 transition-colors ${
        invalid ? 'border-red-300 bg-red-50' : 'border-slate-100 bg-slate-50/60'
      }`}
    >
      <legend className="mb-3 block text-[15px] font-medium leading-relaxed text-slate-800">
        <span className="mr-1.5 font-semibold text-brass-600">{number}.</span>
        {question.text}
        {invalid && <span className="ml-2 text-sm font-medium text-red-500">（尚未作答）</span>}
      </legend>

      <div
        role="radiogroup"
        aria-label={question.text}
        className="flex flex-wrap gap-2 sm:gap-2.5"
      >
        {SCALE_LABELS.map((opt) => {
          const selected = Number(value) === opt.value;
          return (
            <label
              key={opt.value}
              className={`flex min-w-[58px] flex-1 cursor-pointer flex-col items-center rounded-lg border px-2 py-2 text-center transition-all focus-within:ring-2 focus-within:ring-brass-400 focus-within:ring-offset-1 sm:min-w-[72px] ${
                selected
                  ? 'border-brass-500 bg-ink-700 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-brass-300 hover:bg-brass-50'
              }`}
            >
              <input
                type="radio"
                name={question.id}
                value={opt.value}
                checked={selected}
                onChange={() => onChange(question.id, opt.value)}
                className="sr-only"
              />
              <span className="text-base font-bold leading-none">{opt.value}</span>
              <span className={`mt-1 text-[11px] leading-tight ${selected ? 'text-brass-50' : 'text-slate-400'}`}>
                {opt.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default memo(QuestionCard);
