import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Trash2, Lock, MapPin, Link, RefreshCw, AlertTriangle, Users } from 'lucide-react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useCalendar } from '../../context/CalendarContext';
import { EVENT_COLORS, EVENT_TYPES, REMINDER_OPTIONS, getTypeDefaultColor, getColorHex } from '../../utils/colors';
import { FREQ_OPTIONS } from '../../utils/recurrence';
import { findConflicts } from '../../utils/conflicts';
import { formatDateInput, formatTimeInput, combineDatetime } from '../../utils/calendar';

const DEFAULT_FORM = {
  title: '',
  type: 'work',
  color: 'blue',
  startDate: '',
  startTime: '09:00',
  endDate: '',
  endTime: '10:00',
  isAllDay: false,
  isPrivate: false,
  tags: '',
  description: '',
  reminder: '',
  location: '',
  url: '',
  attendees: '',
  recurrenceFreq: '',
  recurrenceUntil: '',
};

function buildForm(event, initialDate, copyFrom) {
  if (copyFrom) {
    const start = new Date(copyFrom.startAt);
    const end = new Date(copyFrom.endAt);
    return {
      title: `${copyFrom.title} (複製)`,
      type: copyFrom.type || 'work',
      color: copyFrom.color || 'blue',
      startDate: formatDateInput(start),
      startTime: formatTimeInput(copyFrom.startAt),
      endDate: formatDateInput(end),
      endTime: formatTimeInput(copyFrom.endAt),
      isAllDay: copyFrom.isAllDay || false,
      isPrivate: false,
      tags: (copyFrom.tags || []).join(', '),
      description: copyFrom.description || '',
      reminder: copyFrom.reminder || '',
      location: copyFrom.location || '',
      url: copyFrom.url || '',
      attendees: (copyFrom.attendees || []).join(', '),
      recurrenceFreq: '',
      recurrenceUntil: '',
    };
  }
  if (event) {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    return {
      title: event.title,
      type: event.type,
      color: event.color,
      startDate: formatDateInput(start),
      startTime: formatTimeInput(event.startAt),
      endDate: formatDateInput(end),
      endTime: formatTimeInput(event.endAt),
      isAllDay: event.isAllDay,
      isPrivate: event.isPrivate,
      tags: (event.tags || []).join(', '),
      description: event.description || '',
      reminder: event.reminder || '',
      location: event.location || '',
      url: event.url || '',
      attendees: (event.attendees || []).join(', '),
      recurrenceFreq: event.recurrence?.freq || '',
      recurrenceUntil: event.recurrence?.until || '',
    };
  }
  const base = initialDate || new Date();
  const dateStr = formatDateInput(base);
  return { ...DEFAULT_FORM, startDate: dateStr, endDate: dateStr };
}

export default function EventModal({ isOpen, onClose, onSave, onDelete, event, initialDate, copyFrom }) {
  const [form, setForm] = useState(() => buildForm(event, initialDate, copyFrom));
  const [error, setError] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const tagsRef = useRef(null);
  const isMobile = useIsMobile();
  const { events } = useCalendar();

  const allTags = useMemo(
    () => [...new Set(events.flatMap(e => e.tags || []))].sort(),
    [events]
  );

  useEffect(() => {
    if (isOpen) {
      setForm(buildForm(event, initialDate, copyFrom));
      setError('');
    }
  }, [isOpen, event, initialDate, copyFrom]);

  function set(field, value) {
    setForm(f => {
      const next = { ...f, [field]: value };
      if (field === 'type') next.color = getTypeDefaultColor(value);
      if (field === 'startDate' && next.endDate < value) next.endDate = value;
      return next;
    });
    setError('');
  }

  const endBeforeStart = !form.isAllDay &&
    form.startDate && form.endDate && form.startTime && form.endTime &&
    new Date(combineDatetime(form.endDate, form.endTime)) <
    new Date(combineDatetime(form.startDate, form.startTime));

  const conflicts = useMemo(() => {
    if (form.isAllDay || !form.startDate || !form.startTime || !form.endDate || !form.endTime) return [];
    if (endBeforeStart) return [];
    const candidate = {
      startAt: combineDatetime(form.startDate, form.startTime),
      endAt: combineDatetime(form.endDate, form.endTime),
      isAllDay: false,
    };
    return findConflicts(events, candidate, event?.id);
  }, [form.startDate, form.startTime, form.endDate, form.endTime, form.isAllDay, events, event?.id, endBeforeStart]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return setError('請輸入標題');
    if (endBeforeStart) return setError('結束時間不可早於開始時間');

    const startAt = form.isAllDay
      ? new Date(`${form.startDate}T00:00:00`).toISOString()
      : combineDatetime(form.startDate, form.startTime);
    const endAt = form.isAllDay
      ? new Date(`${form.endDate}T23:59:59`).toISOString()
      : combineDatetime(form.endDate, form.endTime);

    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
    const attendees = form.attendees.split(',').map(t => t.trim()).filter(Boolean);
    const recurrence = form.recurrenceFreq
      ? { freq: form.recurrenceFreq, until: form.recurrenceUntil || null }
      : null;

    onSave({
      title: form.title.trim(),
      type: form.type,
      color: form.color,
      startAt,
      endAt,
      isAllDay: form.isAllDay,
      isPrivate: form.isPrivate,
      tags,
      description: form.description.trim(),
      reminder: form.reminder,
      location: form.location.trim(),
      url: form.url.trim(),
      attendees,
      recurrence,
    });
  }

  if (!isOpen) return null;

  const isEditing = !!event;

  return (
    <div className={isMobile ? 'fixed inset-0 z-50 flex items-end' : 'fixed inset-0 z-50 flex items-center justify-center p-4'}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-modal-title"
        className={isMobile
          ? 'relative bg-white rounded-t-2xl shadow-2xl w-full max-h-[92vh] overflow-y-auto animate-slide-up'
          : 'relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 id="event-modal-title" className="text-lg font-semibold text-slate-800">
            {isEditing ? '編輯事件' : '新增事件'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="關閉">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Title */}
          <div>
            <input
              type="text"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="事件標題"
              className="w-full text-lg font-medium border-0 border-b-2 border-slate-200 focus:border-indigo-500 focus:outline-none pb-1 bg-transparent"
              autoFocus
            />
          </div>

          {/* Type + Color */}
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">類型</label>
              <div className="flex gap-2 flex-wrap">
                {EVENT_TYPES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => set('type', t.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      form.type === t.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">顏色</label>
              <div className="grid grid-cols-6 gap-1.5">
                {EVENT_COLORS.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => set('color', c.id)}
                    title={c.label}
                    style={{ backgroundColor: c.hex }}
                    className={`w-7 h-7 rounded-lg transition-all ${
                      form.color === c.id
                        ? 'scale-110 ring-2 ring-offset-1 ring-slate-400'
                        : 'hover:scale-105 hover:ring-1 hover:ring-slate-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => set('isAllDay', !form.isAllDay)}
              className={`w-10 h-5 rounded-full transition-colors relative ${
                form.isAllDay ? 'bg-indigo-600' : 'bg-slate-200'
              }`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                form.isAllDay ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
            <span className="text-sm text-slate-700">全天事件</span>
          </div>

          {/* Date / Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">開始</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => set('startDate', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              {!form.isAllDay && (
                <input
                  type="time"
                  value={form.startTime}
                  onChange={e => set('startTime', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mt-2"
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">結束</label>
              <input
                type="date"
                value={form.endDate}
                onChange={e => set('endDate', e.target.value)}
                min={form.startDate}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              {!form.isAllDay && (
                <input
                  type="time"
                  value={form.endTime}
                  onChange={e => set('endTime', e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 mt-2 ${
                    endBeforeStart
                      ? 'border-red-400 bg-red-50 focus:ring-red-400'
                      : 'border-slate-200 focus:ring-indigo-500'
                  }`}
                />
              )}
            </div>
          </div>

          {/* Conflict warning */}
          {conflicts.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">
                與「{conflicts[0].title}」時間重疊
                {conflicts.length > 1 && `，及另外 ${conflicts.length - 1} 個事件`}
              </p>
            </div>
          )}

          {/* Recurrence */}
          <div className="flex items-center gap-3">
            <RefreshCw size={14} className="text-slate-400 shrink-0" />
            <select
              value={form.recurrenceFreq}
              onChange={e => set('recurrenceFreq', e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {FREQ_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {form.recurrenceFreq && (
              <>
                <span className="text-xs text-slate-500 shrink-0">結束於</span>
                <input
                  type="date"
                  value={form.recurrenceUntil}
                  min={form.startDate}
                  onChange={e => set('recurrenceUntil', e.target.value)}
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </>
            )}
          </div>

          {/* Location */}
          <div className="relative">
            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={form.location}
              onChange={e => set('location', e.target.value)}
              placeholder="新增地點"
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* URL */}
          <div className="relative">
            <Link size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="url"
              value={form.url}
              onChange={e => set('url', e.target.value)}
              placeholder="相關連結 https://..."
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Attendees */}
          <div className="relative">
            <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={form.attendees}
              onChange={e => set('attendees', e.target.value)}
              placeholder="參與者 Email（以逗號分隔）"
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Tags */}
          <div className="relative">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              標籤 <span className="font-normal text-slate-400">（以逗號分隔）</span>
            </label>
            <input
              ref={tagsRef}
              type="text"
              value={form.tags}
              onChange={e => {
                set('tags', e.target.value);
                const lastPart = e.target.value.split(',').pop().trim().toLowerCase();
                if (lastPart.length >= 1) {
                  setTagSuggestions(allTags.filter(t =>
                    t.toLowerCase().startsWith(lastPart) &&
                    !e.target.value.split(',').map(x => x.trim()).includes(t)
                  ).slice(0, 6));
                } else {
                  setTagSuggestions([]);
                }
              }}
              onBlur={() => setTimeout(() => setTagSuggestions([]), 200)}
              placeholder="例：行銷, 開發, 重要"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {tagSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-10 mt-1 overflow-hidden">
                {tagSuggestions.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault();
                      const parts = form.tags.split(',');
                      parts[parts.length - 1] = ` ${tag}`;
                      set('tags', parts.join(',').replace(/^,\s*/, '') + ', ');
                      setTagSuggestions([]);
                      tagsRef.current?.focus();
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reminder */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">提前提醒</label>
            <select
              value={form.reminder}
              onChange={e => set('reminder', e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {REMINDER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">說明</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="新增說明..."
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Private */}
          <div className="flex items-center gap-3 py-2 px-3 bg-slate-50 rounded-xl">
            <button
              type="button"
              onClick={() => set('isPrivate', !form.isPrivate)}
              className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${
                form.isPrivate ? 'bg-slate-600' : 'bg-slate-200'
              }`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                form.isPrivate ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
            <div className="flex items-center gap-1.5">
              <Lock size={14} className="text-slate-500" />
              <span className="text-sm text-slate-700">私人事項</span>
              <span className="text-xs text-slate-400">（共享後僅自己可見內容）</span>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            {isEditing ? (
              <button
                type="button"
                onClick={() => onDelete(event.id)}
                className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors"
              >
                <Trash2 size={15} />
                刪除
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                style={{ backgroundColor: getColorHex(form.color) }}
                className="px-5 py-2 text-sm text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
              >
                {isEditing ? '儲存' : '新增'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
