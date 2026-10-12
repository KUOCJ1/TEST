import { useId } from 'react';
import { RotateCcw } from 'lucide-react';

/**
 * 單一可編輯欄位：顯示目前值、剩餘字數、「已修改」標記與內建原文，可單欄還原。
 * `value` 是目前輸入框的值（覆寫值，沒有覆寫時是內建原文）；`modified` 表示有覆寫。
 */
export function EditableField({ label, value, builtin, max, multiline, onChange, compact = false }) {
  const id = useId();
  const modified = value !== builtin;
  const over = value.length > max;
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <div className={compact ? '' : 'mt-3'}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-semibold text-slate-600">{label}</label>
        <span className="flex items-center gap-2 text-xs">
          {modified && <span className="chip bg-brass-100 text-brass-700">已修改</span>}
          <span className={over ? 'font-semibold text-red-600' : 'text-slate-500'} aria-live="polite">
            {value.length} / {max}
          </span>
        </span>
      </div>
      <Tag
        id={id}
        className="input text-sm"
        value={value}
        rows={multiline ? Math.min(6, Math.max(2, Math.ceil(value.length / 38))) : undefined}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={over || undefined}
      />
      {modified && (
        <div className="mt-1 flex items-start justify-between gap-3 text-xs text-slate-500">
          <p className="min-w-0"><span className="font-semibold">內建原文：</span>{builtin}</p>
          <button
            type="button"
            onClick={() => onChange(builtin)}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-semibold text-brass-700 hover:underline"
          >
            <RotateCcw aria-hidden="true" className="h-3 w-3" /> 還原原文
          </button>
        </div>
      )}
    </div>
  );
}

/** 可收合的區段，標題旁顯示該區段已修改的欄位數。 */
export function Section({ title, hint, modifiedCount = 0, defaultOpen = false, children }) {
  return (
    <details open={defaultOpen} className="panel-secondary group rounded-xl">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-400">
        <span className="font-semibold text-slate-700">{title}</span>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          {modifiedCount > 0 && <span className="chip bg-brass-100 text-brass-700">{modifiedCount} 處已修改</span>}
          {hint}
        </span>
      </summary>
      <div className="border-t border-slate-100 px-4 pb-4">{children}</div>
    </details>
  );
}

/**
 * 一組相關欄位（一個構面、一個子能力的三段評語…）。用 div + role="group" 而不是
 * fieldset／legend：legend 預設會坐在 fieldset 的邊框線上，邊框穿過標題文字很難看。
 */
export function Group({ title, children, className = '' }) {
  return (
    <div role="group" aria-label={title} className={`mt-4 border-t border-slate-100 pt-3 first:mt-1 first:border-0 first:pt-0 ${className}`}>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {children}
    </div>
  );
}
