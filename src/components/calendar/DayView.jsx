import { useRef, useEffect, useCallback } from 'react';
import { getEventsForDay, isToday, layoutDayEvents, formatDisplayTime, formatDateInput } from '../../utils/calendar';
import { getColorHex } from '../../utils/colors';
import { useCurrentMinute } from '../../hooks/useCurrentMinute';

const HOUR_HEIGHT = 60;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const TYPE_LABELS = { work: '工作', meeting: '會議', personal: '私人', reminder: '提醒' };

function EventBlock({ event, col, totalCols, onClick, currentUserId, onDragStart }) {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = Math.min(end.getHours() * 60 + end.getMinutes(), 24 * 60);
  const duration = Math.max(endMin - startMin, 20);

  const isOwn = event.creatorId === currentUserId;
  const isOtherPrivate = event.isPrivate && !isOwn;
  const draggable = !event.isRecurring && event.source !== 'google';
  const color = getColorHex(event.color);
  const colW = 100 / totalCols;

  return (
    <button
      draggable={draggable}
      onDragStart={draggable ? e => { e.stopPropagation(); onDragStart(event, e); } : undefined}
      onClick={e => { e.stopPropagation(); onClick(event); }}
      aria-label={isOtherPrivate ? '私人事項' : `${event.title}，${formatDisplayTime(event.startAt)} – ${formatDisplayTime(event.endAt)}`}
      style={{
        position: 'absolute',
        top: startMin,
        height: duration,
        left: `${col * colW}%`,
        width: `${colW - 1}%`,
        backgroundColor: isOtherPrivate ? '#f1f5f9' : color,
        color: isOtherPrivate ? '#94a3b8' : 'white',
        zIndex: 1,
        cursor: draggable ? 'grab' : 'pointer',
      }}
      className="rounded-lg text-left overflow-hidden px-2 py-1 hover:opacity-90 transition-opacity shadow-sm"
    >
      {isOtherPrivate ? (
        <div className="text-sm">🔒 私人事項</div>
      ) : (
        <div>
          <div className="text-sm font-semibold leading-tight truncate">{event.title}{event.source === 'google' && <span className="text-[9px] bg-white/30 rounded px-1">G</span>}</div>
          {duration >= 40 && (
            <div className="text-xs opacity-90 mt-0.5">
              {formatDisplayTime(event.startAt)} – {formatDisplayTime(event.endAt)}
            </div>
          )}
          {duration >= 60 && event.type && (
            <div className="text-xs opacity-75 mt-0.5">{TYPE_LABELS[event.type]}</div>
          )}
          {duration >= 70 && event.location && (
            <div className="text-xs opacity-75 truncate">📍 {event.location}</div>
          )}
          {duration >= 90 && event.tags?.length > 0 && (
            <div className="text-xs opacity-75 truncate">{event.tags.map(t => `#${t}`).join(' ')}</div>
          )}
        </div>
      )}
    </button>
  );
}

export default function DayView({ currentDate, events, onEventClick, onSlotClick, onMoveEvent, currentUserId }) {
  const scrollRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR_HEIGHT;
  }, []);

  const dayEvents = getEventsForDay(events, currentDate);
  const timedEvents = dayEvents.filter(e => !e.isAllDay);
  const allDayEvents = dayEvents.filter(e => e.isAllDay);
  const layouts = layoutDayEvents(timedEvents);

  const today = isToday(currentDate);
  const currentMinute = useCurrentMinute();

  function handleGridClick(e) {
    if (dragRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const totalMinutes = Math.floor(y);
    const hour = Math.floor(totalMinutes / 60);
    const min = Math.floor((totalMinutes % 60) / 30) * 30;
    const d = new Date(currentDate);
    d.setHours(Math.min(hour, 23), min, 0, 0);
    onSlotClick(d);
  }

  const handleEventDragStart = useCallback((event, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = { event, offsetPx: e.clientY - rect.top };
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  function handleGridDrop(e) {
    if (!dragRef.current || !onMoveEvent) return;
    e.preventDefault();
    const { event, offsetPx } = dragRef.current;
    dragRef.current = null;
    const rect = e.currentTarget.getBoundingClientRect();
    const rawMin = Math.max(0, e.clientY - rect.top - offsetPx);
    const snapped = Math.round(rawMin / 15) * 15;
    const hour = Math.min(23, Math.floor(snapped / 60));
    const min = snapped % 60;
    const duration = new Date(event.endAt) - new Date(event.startAt);
    const newStart = new Date(currentDate);
    newStart.setHours(hour, min, 0, 0);
    const newEnd = new Date(newStart.getTime() + duration);
    onMoveEvent(event.id, newStart.toISOString(), newEnd.toISOString());
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="border-b border-slate-200 px-4 py-2 bg-white flex flex-wrap gap-1.5 shrink-0">
          <span className="text-xs text-slate-400 self-center mr-1 shrink-0">全天</span>
          {allDayEvents.map(event => {
            const isOwn = event.creatorId === currentUserId;
            const isOtherPrivate = event.isPrivate && !isOwn;
            return (
              <button
                key={event.id}
                onClick={() => onEventClick(event)}
                aria-label={`${isOtherPrivate ? '私人事項' : event.title}，全天`}
                style={{ backgroundColor: isOtherPrivate ? '#f1f5f9' : getColorHex(event.color) }}
                className="text-xs px-2 py-0.5 rounded text-white font-medium hover:opacity-90 truncate max-w-xs"
              >
                {isOtherPrivate ? '🔒 私人' : event.title}
              </button>
            );
          })}
        </div>
      )}

      {/* Scrollable time grid */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="flex" style={{ minHeight: 24 * HOUR_HEIGHT }}>
          {/* Hour labels */}
          <div className="w-16 shrink-0 border-r border-slate-100 relative" style={{ height: 24 * HOUR_HEIGHT }}>
            {HOURS.map(h => (
              <div
                key={h}
                className="absolute right-2 text-xs text-slate-400 -translate-y-1/2"
                style={{ top: h * HOUR_HEIGHT }}
              >
                {h > 0 && `${String(h).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {/* Event column */}
          <div
            className="flex-1 relative cursor-pointer"
            style={{ height: 24 * HOUR_HEIGHT }}
            onClick={handleGridClick}
            onDragOver={e => e.preventDefault()}
            onDrop={handleGridDrop}
          >
            {HOURS.map(h => (
              <div key={h} className="absolute w-full border-t border-slate-100" style={{ top: h * HOUR_HEIGHT }} />
            ))}
            {HOURS.map(h => (
              <div key={`${h}h`} className="absolute w-full border-t border-slate-50" style={{ top: h * HOUR_HEIGHT + 30 }} />
            ))}

            {/* Current time */}
            {today && (
              <div className="absolute w-full pointer-events-none z-10" style={{ top: currentMinute }}>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-red-500 -ml-1.5 shrink-0" />
                  <div className="flex-1 border-t-2 border-red-500" />
                </div>
              </div>
            )}

            {layouts.map(({ event, col, totalCols }) => (
              <EventBlock
                key={event.id}
                event={event}
                col={col}
                totalCols={totalCols}
                onClick={onEventClick}
                currentUserId={currentUserId}
                onDragStart={handleEventDragStart}
              />
            ))}

            {timedEvents.length === 0 && allDayEvents.length === 0 && (
              <div
                className="absolute left-0 right-0 flex flex-col items-center pointer-events-none select-none text-center"
                style={{ top: 660 }}
              >
                <span className="text-4xl mb-2">📅</span>
                <p className="text-sm text-slate-400">這天還沒有行程</p>
                <p className="text-xs text-slate-300 mt-1">點擊時間格新增事件</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
