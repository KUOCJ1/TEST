import { useRef, useEffect, useCallback } from 'react';
import { getWeekDays, getEventsForDay, isToday, layoutDayEvents, formatDisplayTime } from '../../utils/calendar';
import { getColorHex } from '../../utils/colors';
import { useIsMobile } from '../../hooks/useIsMobile';

const HOUR_HEIGHT = 60;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

function getThreeDayWindow(date) {
  return [-1, 0, 1].map(offset => new Date(date.getTime() + offset * 86400000));
}

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
      className="rounded text-left overflow-hidden px-1.5 py-0.5 hover:opacity-90 transition-opacity"
    >
      {isOtherPrivate ? (
        <span className="text-xs">🔒</span>
      ) : (
        <div className="text-xs">
          <div className="font-medium leading-tight truncate">{event.title}{event.source === 'google' && <span className="text-[9px] bg-white/30 rounded px-1 ml-0.5">G</span>}</div>
          {duration >= 35 && (
            <div className="opacity-80 text-[10px]">{formatDisplayTime(event.startAt)}</div>
          )}
        </div>
      )}
    </button>
  );
}

export default function WeekView({ currentDate, events, onEventClick, onSlotClick, onMoveEvent, currentUserId }) {
  const scrollRef = useRef(null);
  const dragRef = useRef(null);
  const isMobile = useIsMobile();
  const weekDays = isMobile ? getThreeDayWindow(currentDate) : getWeekDays(currentDate);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR_HEIGHT;
  }, []);

  const now = new Date();
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const allEmpty = weekDays.every(day => getEventsForDay(events, day).length === 0);

  function handleColumnClick(e, day) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const totalMinutes = Math.floor(y);
    const hour = Math.floor(totalMinutes / 60);
    const min = Math.floor((totalMinutes % 60) / 30) * 30;
    const d = new Date(day);
    d.setHours(Math.min(hour, 23), min, 0, 0);
    onSlotClick(d);
  }

  const handleEventDragStart = useCallback((event, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = { event, offsetPx: e.clientY - rect.top };
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  function handleColumnDrop(e, day) {
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
    const newStart = new Date(day);
    newStart.setHours(hour, min, 0, 0);
    const newEnd = new Date(newStart.getTime() + duration);
    onMoveEvent(event.id, newStart.toISOString(), newEnd.toISOString());
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
      {/* Day column headers */}
      <div className="flex border-b border-slate-200 bg-white shrink-0">
        <div className="w-14 shrink-0 border-r border-slate-100" />
        {weekDays.map(day => {
          const today = isToday(day);
          return (
            <div key={day.toISOString()} className="flex-1 text-center py-2 border-l border-slate-100 min-w-0">
              <div className={`text-xs font-medium ${today ? 'text-indigo-500' : 'text-slate-400'}`}>
                {DAY_NAMES[day.getDay()]}
              </div>
              <div className={`text-xl font-semibold w-9 h-9 mx-auto flex items-center justify-center rounded-full ${
                today ? 'bg-indigo-600 text-white' : 'text-slate-700'
              }`}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="flex relative" style={{ minHeight: 24 * HOUR_HEIGHT }}>
          {/* Hour labels */}
          <div className="w-14 shrink-0 border-r border-slate-100 relative" style={{ height: 24 * HOUR_HEIGHT }}>
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

          {/* Day columns */}
          {weekDays.map(day => {
            const dayEvents = getEventsForDay(events, day).filter(e => !e.isAllDay);
            const layouts = layoutDayEvents(dayEvents);
            const todayLine = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className="flex-1 border-l border-slate-100 relative min-w-0 cursor-pointer hover:bg-slate-50/40"
                style={{ height: 24 * HOUR_HEIGHT }}
                onClick={e => handleColumnClick(e, day)}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleColumnDrop(e, day)}
              >
                {/* Hour grid lines */}
                {HOURS.map(h => (
                  <div key={h} className="absolute w-full border-t border-slate-100" style={{ top: h * HOUR_HEIGHT }} />
                ))}
                {/* 30-min lines */}
                {HOURS.map(h => (
                  <div key={`${h}h`} className="absolute w-full border-t border-slate-50" style={{ top: h * HOUR_HEIGHT + 30 }} />
                ))}

                {/* Current time indicator */}
                {todayLine && (
                  <div className="absolute w-full pointer-events-none z-10" style={{ top: currentMinute }}>
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                      <div className="flex-1 border-t-2 border-red-500" />
                    </div>
                  </div>
                )}

                {/* Events */}
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
              </div>
            );
          })}
          {allEmpty && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none ml-14">
              <div className="text-center -translate-y-12">
                <span className="text-4xl">📅</span>
                <p className="text-sm text-slate-400 mt-2">這週還沒有行程</p>
                <p className="text-xs text-slate-300 mt-1">點擊時間格新增事件</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
