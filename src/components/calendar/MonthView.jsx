import { memo } from 'react';
import { DAY_NAMES, getMonthCalendarDays, getEventsForDay, isToday } from '../../utils/calendar';
import { getColorHex } from '../../utils/colors';
import { useIsMobile } from '../../hooks/useIsMobile';

const MAX_VISIBLE = 3;

const EventPill = memo(function EventPill({
  event, onClick, currentUserId,
  selectMode, selected, onToggleSelect,
  onDragStart,
}) {
  const isOwn = event.creatorId === currentUserId;
  const isOtherPrivate = event.isPrivate && !isOwn;
  const color = getColorHex(event.color);

  function handleClick(e) {
    e.stopPropagation();
    if (selectMode) {
      onToggleSelect(event.id);
    } else {
      onClick(event);
    }
  }

  if (isOtherPrivate) {
    return (
      <button
        onClick={handleClick}
        draggable={false}
        className="w-full text-left text-xs px-1.5 py-0.5 rounded truncate flex items-center gap-1 bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors"
      >
        {selectMode && (
          <input type="checkbox" checked={selected} readOnly className="mr-1 shrink-0" />
        )}
        <span className="shrink-0">🔒</span>
        <span className="truncate">私人事項</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      draggable={!selectMode && !event.isRecurring}
      onDragStart={e => {
        e.stopPropagation();
        onDragStart(e, event);
      }}
      className={`w-full text-left text-xs px-1.5 py-0.5 rounded truncate text-white font-medium hover:opacity-90 transition-opacity flex items-center gap-1 ${
        selected ? 'ring-2 ring-white ring-offset-1' : ''
      }`}
      style={{ backgroundColor: selected ? '#4f46e5' : color }}
    >
      {selectMode && (
        <input type="checkbox" checked={selected} readOnly className="mr-0.5 shrink-0" onClick={e => e.stopPropagation()} />
      )}
      {!isOwn && event.creatorName && (
        <span className="opacity-75 shrink-0">{event.creatorName.charAt(0)}·</span>
      )}
      <span className="truncate">
        {event.title}
        {event.source === 'google' && <span className="text-[8px] opacity-60 ml-0.5">G</span>}
        {event.isRecurring && <span className="text-[8px] opacity-60 ml-0.5">↩</span>}
      </span>
    </button>
  );
});

const DayCell = memo(function DayCell({
  day, events, onDayClick, onEventClick, currentUserId, compact,
  selectMode, selectedIds, onToggleSelect,
  onDragStart, onDrop,
}) {
  const today = isToday(day.date);
  const visible = events.slice(0, MAX_VISIBLE);
  const overflow = events.length - MAX_VISIBLE;

  function handleDragOver(e) { e.preventDefault(); }
  function handleDrop(e) { e.preventDefault(); onDrop(e, day.date); }

  return (
    <div
      onClick={() => !selectMode && onDayClick(day.date)}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`min-h-[72px] sm:min-h-[100px] p-1 border-b border-r border-slate-100 transition-colors ${
        !day.isCurrentMonth ? 'bg-slate-50/60' : 'bg-white'
      } ${!selectMode ? 'cursor-pointer hover:bg-slate-50/80' : ''}`}
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
              selectMode={selectMode}
              selected={selectedIds.has(event.recurringBaseId || event.id)}
              onToggleSelect={onToggleSelect}
              onDragStart={onDragStart}
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
});

export default function MonthView({
  currentDate, events, onDayClick, onEventClick, currentUserId,
  selectMode, selectedIds, onToggleSelect,
  onMoveEvent,
}) {
  const isMobile = useIsMobile();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const days = getMonthCalendarDays(year, month);

  function handleDragStart(e, event) {
    e.dataTransfer.setData('eventId', event.recurringBaseId || event.id);
    e.dataTransfer.setData('originalDate', event.startAt);
  }

  function handleDrop(e, targetDate) {
    const eventId = e.dataTransfer.getData('eventId');
    const originalDate = e.dataTransfer.getData('originalDate');
    if (!eventId || !originalDate) return;
    onMoveEvent?.(eventId, new Date(originalDate), targetDate);
  }

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
              selectMode={selectMode}
              selectedIds={selectedIds || new Set()}
              onToggleSelect={onToggleSelect}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
            />
          );
        })}
      </div>
    </div>
  );
}
