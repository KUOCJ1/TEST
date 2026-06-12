import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { MONTH_NAMES, getWeekDays, formatWeekTitle, formatDayTitle } from '../../utils/calendar';

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

export default function CalendarHeader({ currentDate, view, onPrev, onNext, onToday, onViewChange, onAddEvent }) {
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
          className="p-2.5 sm:p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={onNext}
          className="p-2.5 sm:p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronRight size={18} />
        </button>
        <h2 className="text-base font-semibold text-slate-800 ml-1 truncate">
          {getTitle(view, currentDate)}
        </h2>
      </div>

      {/* Right: view switcher + add button */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => onViewChange(v.id)}
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
