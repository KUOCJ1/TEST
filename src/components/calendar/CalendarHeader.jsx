import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { MONTH_NAMES, getWeekDays, formatWeekTitle, formatDayTitle, formatDateInput } from '../../utils/calendar';

const VIEWS = [
  { id: 'month', label: '月' },
  { id: 'week',  label: '週' },
  { id: 'day',   label: '日' },
];

function getTitle(view, date) {
  if (view === 'month') return `${date.getFullYear()} 年 ${MONTH_NAMES[date.getMonth()]}`;
  if (view === 'week')  return formatWeekTitle(getWeekDays(date));
  return formatDayTitle(date);
}

const NAV_LABELS = {
  month: ['上個月', '下個月'],
  week:  ['上一週', '下一週'],
  day:   ['前一天', '下一天'],
};

export default function CalendarHeader({ currentDate, view, onPrev, onNext, onToday, onViewChange, onAddEvent, onNavigate }) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef(null);
  const [prevLabel, nextLabel] = NAV_LABELS[view] ?? ['上一個時段', '下一個時段'];

  function handleTitleClick() {
    setShowPicker(true);
    setTimeout(() => pickerRef.current?.showPicker?.(), 50);
  }

  function handlePickerChange(e) {
    if (!e.target.value) return;
    onNavigate?.(new Date(e.target.value + (view === 'month' ? '-01' : '')));
    setShowPicker(false);
  }

  const pickerValue = view === 'month'
    ? `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
    : formatDateInput(currentDate);

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white shrink-0 gap-2 flex-wrap">
      {/* Left: nav + title */}
      <div className="flex items-center gap-1.5 min-w-0">
        <button
          onClick={onToday}
          className="px-3 py-2 sm:py-1.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shrink-0"
        >
          今天
        </button>
        <button
          onClick={onPrev}
          aria-label={prevLabel}
          className="p-2.5 sm:p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={onNext}
          aria-label={nextLabel}
          className="p-2.5 sm:p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronRight size={18} />
        </button>
        <div className="relative ml-1">
          <button
            onClick={handleTitleClick}
            className="text-base font-semibold text-slate-800 hover:text-indigo-600 transition-colors truncate"
            title="點擊跳轉日期"
          >
            {getTitle(view, currentDate)}
          </button>
          <input
            ref={pickerRef}
            type={view === 'month' ? 'month' : 'date'}
            value={pickerValue}
            onChange={handlePickerChange}
            onBlur={() => setShowPicker(false)}
            aria-label="跳轉到指定日期"
            aria-hidden="true"
            tabIndex={-1}
            className="absolute opacity-0 pointer-events-none top-0 left-0"
            style={{ width: 1, height: 1 }}
          />
        </div>
      </div>

      {/* Right: view switcher + add button */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => onViewChange(v.id)}
              aria-pressed={view === v.id}
              className={`px-3 py-2 sm:py-1.5 text-sm font-medium transition-colors ${
                view === v.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <button
          onClick={onAddEvent}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2.5 sm:py-1.5 rounded-xl transition-colors shadow-sm"
        >
          <Plus size={15} />
          <span className="hidden sm:inline">新增</span>
        </button>
      </div>
    </div>
  );
}
