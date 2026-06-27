import { memo } from 'react';
import { SCALE_LABELS } from '../data/questions';

function QuestionCard({ number, question, value, onChange, invalid, inputRef }) {
  return (
    <fieldset
      ref={inputRef}
      data-question-id={question.id}
      className={`scroll-mt-28 rounded-xl border px-4 py-4 transition-colors ${
        invalid ? 'border-red-300 bg-red-50' : 'border-slate-100 bg-slate-50/60'
      }`}
    >
      <legend className="mb-3 block text-[15px] font-medium leading-relaxed text-slate-800">
        <span className="mr-1.5 font-semibold text-blue-600">{number}.</span>
        {question.text}
        {question.reversed && (
          <span
            className="ml-1.5 align-middle text-xs font-semibold text-amber-600"
            title="反向計分題：分數會反轉計算"
          >
            🔄
          </span>
        )}
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
              className={`flex min-w-[58px] flex-1 cursor-pointer flex-col items-center rounded-lg border px-2 py-2 text-center transition-all sm:min-w-[72px] ${
                selected
                  ? 'border-brand-500 bg-brand-500 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50'
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
              <span className={`mt-1 text-[11px] leading-tight ${selected ? 'text-brand-50' : 'text-slate-400'}`}>
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
