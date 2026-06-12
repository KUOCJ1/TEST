import { DAY_NAMES, getMonthCalendarDays, getEventsForDay, isToday } from '../../utils/calendar';
import { getColorHex } from '../../utils/colors';
import { useIsMobile } from '../../hooks/useIsMobile';

const MAX_VISIBLE = 3;

function EventPill({ event, onClick, currentUserId }) {
  const isOwn = event.creatorId === currentUserId;
  const isOtherPrivate = event.isPrivate && !isOwn;
  const color = getColorHex(event.color);

  if (isOtherPrivate) {
    return (
      <button
        onClick={e => { e.stopPropagation(); onClick(event); }}
        className="w-full text-left text-xs px-1.5 py-0.5 rounded truncate flex items-center gap-1 bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors"
      >
        <span className="shrink-0">🔒</span>
        <span className="truncate">私人事項</span>
      </button>
    );
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(event); }}
      className="w-full text-left text-xs px-1.5 py-0.5 rounded truncate text-white font-medium hover:opacity-90 transition-opacity"
      style={{ backgroundColor: color }}
    >
      {!isOwn && event.creatorName && (
        <span className="opacity-75 mr-1">{event.creatorName.charAt(0)}·</span>
      )}
      {event.title}{event.source === 'google' && <span className="text-[8px] opacity-60">G</span>}
    </button>
  );
}

function DayCell({ day, events, onDayClick, onEventClick, currentUserId, compact }) {
  const today = isToday(day.date);
  const visible = events.slice(0, MAX_VISIBLE);
  const overflow = events.length - MAX_VISIBLE;

  return (
    <div
      onClick={() => onDayClick(day.date)}
      className={`min-h-[72px] sm:min-h-[100px] p-1 border-b border-r border-slate-100 cursor-pointer hover:bg-slate-50/80 transition-colors ${
        !day.isCurrentMonth ? 'bg-slate-50/60' : 'bg-white'
      }`}
    >
      <div className="flex justify-end mb-1">
        <span className={`w-7 h-7 flex items-center justify-center text-sm font-medium rounded-full transition-colors ${
          today
            ? 'bg-indigo-600 text-white'
            : day.isCurrentMonth
            ? 'text-slate-700 hover:bg-slate-100'
            : 'text-slate-300'
        }`}>
          {day.date.getDate()}
        </span>
      </div>
      {compact ? (
        <div className="flex flex-wrap gap-0.5 mt-1 px-1">
          {events.slice(0, 5).map(e => (
            <div key={e.id} className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getColorHex(e.color) }} />
          ))}
        </div>
      ) : (
        <div className="space-y-0.5">
          {visible.map(event => (
            <EventPill
              key={event.id}
              event={event}
              onClick={onEventClick}
              currentUserId={currentUserId}
            />
          ))}
          {overflow > 0 && (
            <button
              onClick={e => { e.stopPropagation(); onDayClick(day.date); }}
              className="w-full text-left text-xs text-indigo-500 px-1.5 hover:underline"
            >
              + {overflow} 更多
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function MonthView({ currentDate, events, onDayClick, onEventClick, currentUserId }) {
  const isMobile = useIsMobile();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const days = getMonthCalendarDays(year, month);

  return (
    <div className="flex-1 overflow-auto min-h-0">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-white sticky top-0 z-10">
        {DAY_NAMES.map((name, i) => (
          <div
            key={name}
            className={`py-2 text-center text-xs font-semibold uppercase tracking-wide ${
              i === 0 || i === 6 ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map(day => {
          const dayEvents = getEventsForDay(events, day.date);
          return (
            <DayCell
              key={day.date.toISOString()}
              day={day}
              events={dayEvents}
              onDayClick={onDayClick}
              onEventClick={onEventClick}
              currentUserId={currentUserId}
              compact={isMobile}
            />
          );
        })}
      </div>
    </div>
  );
}
