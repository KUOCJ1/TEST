import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { MONTH_NAMES } from '../../utils/calendar';

export default function CalendarHeader({ currentDate, onPrev, onNext, onToday, onAddEvent }) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
      <div className="flex items-center gap-2">
        <button
          onClick={onToday}
          className="px-3 py-1.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          今天
        </button>
        <div className="flex items-center">
          <button
            onClick={onPrev}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={onNext}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <h2 className="text-lg font-semibold text-slate-800 ml-1">
          {year} 年 {MONTH_NAMES[month]}
        </h2>
      </div>

      <button
        onClick={onAddEvent}
        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors shadow-sm"
      >
        <Plus size={16} />
        新增事件
      </button>
    </div>
  );
}
