import { useMemo } from 'react';
import { getColorHex } from '../../utils/colors';
import { formatDisplayTime, isSameDay } from '../../utils/calendar';
import { useCurrentMinute } from '../../hooks/useCurrentMinute';

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

export default function AgendaSidebar({ events, onEventClick, onNavigateDay }) {
  const minute = useCurrentMinute();

  const days = useMemo(() => {
    const result = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const date = new Date(today.getTime() + i * 86400000);
      const dayEvents = events
        .filter(e => {
          const start = new Date(e.startAt);
          const end = new Date(e.endAt);
          // Multi-day events appear on every day they span
          return isSameDay(start, date) || (start < date && end > date);
        })
        .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
      result.push({ date, events: dayEvents });
    }
    return result;
  }, [events, minute]);

  return (
    <div className="hidden lg:flex flex-col w-64 xl:w-72 border-l border-slate-200 bg-white shrink-0 overflow-y-auto">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">未來 7 天</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {days.map(({ date, events: dayEvts }) => {
          const todayFlag = isSameDay(date, new Date());
          const label = todayFlag
            ? '今天'
            : date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', weekday: 'short' });

          return (
            <div key={date.toISOString()} className="border-b border-slate-50 last:border-0">
              <button
                onClick={() => onNavigateDay?.(date)}
                aria-current={isSameDay(date, new Date()) ? 'date' : undefined}
                aria-label={`跳轉到 ${label}`}
                className={`w-full px-4 py-2 flex items-center gap-2 text-left transition-colors ${
                  isSameDay(date, new Date()) ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-slate-50'
                }`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                  isSameDay(date, new Date())
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-500'
                }`}>
                  {date.getDate()}
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-700">{DAY_NAMES[date.getDay()]}</span>
                  {(() => {
                    const today = new Date();
                    const tomorrow = new Date(today.getTime() + 86400000);
                    const dayAfter = new Date(today.getTime() + 2 * 86400000);
                    if (isSameDay(date, today)) return <span className="ml-1 text-xs text-indigo-500">今天</span>;
                    if (isSameDay(date, tomorrow)) return <span className="ml-1 text-xs text-slate-400">明天</span>;
                    if (isSameDay(date, dayAfter)) return <span className="ml-1 text-xs text-slate-400">後天</span>;
                    return null;
                  })()}
                </div>
              </button>

              {dayEvts.length === 0 ? (
                <p className="px-4 pb-2 text-xs text-slate-300">無行程</p>
              ) : (
                <div className="px-3 pb-2 space-y-1">
                  {dayEvts.slice(0, 4).map(e => (
                    <button
                      key={e.id}
                      onClick={() => onEventClick(e)}
                      aria-label={`${e.title}${e.isAllDay ? '，全天' : `，${formatDisplayTime(e.startAt)}`}`}
                      className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors group"
                    >
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: getColorHex(e.color) }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate group-hover:text-indigo-600">
                          {e.isRecurring && <span className="mr-0.5 opacity-60">↩</span>}
                          {e.title}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {e.isAllDay ? '全天' : (() => {
                            const dur = (new Date(e.endAt) - new Date(e.startAt)) / 60000;
                            const dStr = dur >= 60 ? `${Math.round(dur / 60 * 10) / 10}h` : `${dur}m`;
                            return `${formatDisplayTime(e.startAt)} · ${dStr}`;
                          })()}
                        </p>
                      </div>
                    </button>
                  ))}
                  {dayEvts.length > 4 && (
                    <p className="text-xs text-indigo-500 px-2">+ {dayEvts.length - 4} 個更多</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
