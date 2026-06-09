import { DAY_NAMES, getMonthCalendarDays, getEventsForDay, isSameDay, isToday } from '../../utils/calendar';
import { getColorHex } from '../../utils/colors';

const MAX_VISIBLE = 3;

function EventPill({ event, onClick }) {
  const color = getColorHex(event.color);

  if (event.isPrivate) {
    return (
      <button
        onClick={e => { e.stopPropagation(); onClick(event); }}
        className="w-full text-left text-xs px-1.5 py-0.5 rounded truncate flex items-center gap-1"
        style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}
      >
        <span>🔒</span>
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
      {event.isAllDay ? '' : ''}
      <span className="truncate">{event.title}</span>
    </button>
  );
}

function DayCell({ day, events, onDayClick, onEventClick }) {
  const today = isToday(day.date);
  const visible = events.slice(0, MAX_VISIBLE);
  const overflow = events.length - MAX_VISIBLE;

  return (
    <div
      onClick={() => onDayClick(day.date)}
      className={`min-h-[100px] p-1 border-b border-r border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${
        !day.isCurrentMonth ? 'bg-slate-50/60' : ''
      }`}
    >
      <div className="flex justify-end mb-1">
        <span
          className={`w-7 h-7 flex items-center justify-center text-sm font-medium rounded-full ${
            today
              ? 'bg-indigo-600 text-white'
              : day.isCurrentMonth
              ? 'text-slate-700'
              : 'text-slate-300'
          }`}
        >
          {day.date.getDate()}
        </span>
      </div>
      <div className="space-y-0.5">
        {visible.map(event => (
          <EventPill key={event.id} event={event} onClick={onEventClick} />
        ))}
        {overflow > 0 && (
          <button
            onClick={e => { e.stopPropagation(); onDayClick(day.date); }}
            className="w-full text-left text-xs text-indigo-600 px-1.5 hover:underline"
          >
            + {overflow} 更多
          </button>
        )}
      </div>
    </div>
  );
}

export default function MonthView({ currentDate, events, onDayClick, onEventClick }) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const days = getMonthCalendarDays(year, month);

  return (
    <div className="flex-1 overflow-auto">
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
            />
          );
        })}
      </div>
    </div>
  );
}
