import { memo } from 'react';
import { SCALE_LABELS as DEFAULT_SCALE } from '../data/questions';

// 反向計分題（question.reversed）刻意不在畫面上標示：反向題的作用是偵測「不看
// 題目內容、一律勾高分」這類敷衍作答傾向，若事先告訴受測者哪幾題是反向題，
// 這個機制就完全失效了。計分邏輯（utils/scoring.js）不受影響，正常反轉分數。
//
// 版面（Sprint 8 驗收條件 8.5）：5 個選項在任何寬度都是等寬一排（以前手機上會
// 4 個一排、「5」單獨掉到第二排變成全寬按鈕）。手機寬度放不下每格的文字標籤，
// 只在量表兩端顯示「非常不同意／非常同意」——每個選項的完整標籤仍以 sr-only
// 保留給螢幕報讀器。觸控目標高度 ≥ 48px。
function QuestionCard({ number, question, text, scale, naLabel, naValue, value, onChange, invalid, inputRef, onAdvance }) {
  const SCALE_LABELS = scale ?? DEFAULT_SCALE;
  const answered = value != null && value !== '';

  // 鍵盤快速作答：題目聚焦時按數字鍵直接選分並自動跳到下一題，不必逐一點滑鼠。
  const handleKeyDown = (e) => {
    const opt = SCALE_LABELS.find((o) => String(o.value) === e.key);
    if (!opt) return;
    e.preventDefault();
    onChange(question.id, opt.value);
    onAdvance?.(question.id, { viaKeyboard: true });
  };

  // 第一次作答這題時自動帶到下一個未答題；回頭改答案則留在原地。
  const choose = (v) => {
    onChange(question.id, v);
    if (!answered) onAdvance?.(question.id);
  };

  const first = SCALE_LABELS[0];
  const last = SCALE_LABELS[SCALE_LABELS.length - 1];

  return (
    <fieldset
      ref={inputRef}
      data-question-id={question.id}
      onKeyDown={handleKeyDown}
      className={`question-card scroll-mt-28 rounded-xl border px-4 py-4 shadow-card transition-colors ${
        invalid ? 'border-red-300 bg-red-50' : answered ? 'border-transparent bg-white' : 'border-ink-700/10 bg-paper-50'
      }`}
    >
      {/* legend 預設會「坐在」fieldset 的上邊框線上、文字被邊框切過；float + w-full 讓它
          回到卡片內容區（下方選項用 clear-both 接在它後面）。 */}
      <legend className="float-left mb-4 w-full p-0 text-base font-medium leading-relaxed text-slate-900">
        <span className="font-serif mr-1.5 font-bold text-ink-700">{number}.</span>
        {text ?? question.text}
        {invalid && <span className="ml-2 text-sm font-medium text-red-600">（尚未作答）</span>}
      </legend>

      <div role="radiogroup" aria-label={text ?? question.text} className="clear-both grid grid-cols-5 gap-1.5 sm:gap-2.5">
        {SCALE_LABELS.map((opt) => {
          const selected = Number(value) === opt.value;
          return (
            <label
              key={opt.value}
              className={`flex min-h-[52px] cursor-pointer flex-col items-center justify-center rounded-xl border-[1.5px] px-1 py-2 text-center transition-all duration-150 focus-within:ring-2 focus-within:ring-ink-700 focus-within:ring-offset-2 active:scale-[0.96] ${
                selected
                  ? 'border-ink-700 bg-ink-700 text-white shadow-cta'
                  : 'border-slate-300 bg-paper-100 text-slate-700 hover:border-ink-700/50 hover:bg-ink-700/5'
              }`}
            >
              <input
                type="radio"
                name={question.id}
                value={opt.value}
                checked={selected}
                onChange={() => choose(opt.value)}
                className="sr-only"
              />
              <span className="text-lg font-bold leading-none">{opt.value}</span>
              <span className={`sr-only mt-1 text-xs leading-tight sm:not-sr-only sm:text-[11px] sm:whitespace-nowrap ${selected ? 'text-white/90' : 'text-slate-500'}`}>
                {opt.label}
              </span>
            </label>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-slate-500 sm:hidden" aria-hidden="true">
        <span>{first.label}</span>
        <span>{last.label}</span>
      </div>
      {naLabel && (
        // 他評版中較難觀察的題目才提供「無法判斷」：不計分、不算缺漏。
        <label
          className={`mt-2 flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-ink-700 ${
            value === naValue
              ? 'border-ink-700 bg-ink-700 font-semibold text-white'
              : 'border-dashed border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <input
            type="radio"
            name={question.id}
            value={naValue}
            checked={value === naValue}
            onChange={() => choose(naValue)}
            className="sr-only"
          />
          {naLabel}
        </label>
      )}
    </fieldset>
  );
}

export default memo(QuestionCard);
