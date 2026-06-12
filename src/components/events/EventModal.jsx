import { useState, useEffect } from 'react';
import { X, Trash2, Lock } from 'lucide-react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { EVENT_COLORS, EVENT_TYPES, REMINDER_OPTIONS, getTypeDefaultColor, getColorHex } from '../../utils/colors';
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
};

function buildForm(event, initialDate) {
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
    };
  }
  const base = initialDate || new Date();
  const dateStr = formatDateInput(base);
  return { ...DEFAULT_FORM, startDate: dateStr, endDate: dateStr };
}

export default function EventModal({ isOpen, onClose, onSave, onDelete, event, initialDate }) {
  const [form, setForm] = useState(() => buildForm(event, initialDate));
  const [error, setError] = useState('');
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isOpen) {
      setForm(buildForm(event, initialDate));
      setError('');
    }
  }, [isOpen, event, initialDate]);

  function set(field, value) {
    setForm(f => {
      const next = { ...f, [field]: value };
      // Auto-update color when type changes
      if (field === 'type') next.color = getTypeDefaultColor(value);
      // Auto-extend end date to match start date if end is before start
      if (field === 'startDate' && next.endDate < value) next.endDate = value;
      return next;
    });
    setError('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return setError('請輸入標題');

    const startAt = form.isAllDay
      ? new Date(`${form.startDate}T00:00:00`).toISOString()
      : combineDatetime(form.startDate, form.startTime);
    const endAt = form.isAllDay
      ? new Date(`${form.endDate}T23:59:59`).toISOString()
      : combineDatetime(form.endDate, form.endTime);

    if (new Date(endAt) < new Date(startAt)) return setError('結束時間不可早於開始時間');

    const tags = form.tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

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
    });
  }

  if (!isOpen) return null;

  const isEditing = !!event;

  return (
    <div className={isMobile ? 'fixed inset-0 z-50 flex items-end' : 'fixed inset-0 z-50 flex items-center justify-center p-4'}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={isMobile ? 'relative bg-white rounded-t-2xl shadow-2xl w-full max-h-[92vh] overflow-y-auto animate-slide-up' : 'relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto'}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">
            {isEditing ? '編輯事件' : '新增事件'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
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
          <div className="flex items-center gap-4">
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
              <div className="flex gap-1.5">
                {EVENT_COLORS.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => set('color', c.id)}
                    title={c.label}
                    style={{ backgroundColor: c.hex }}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      form.color === c.id ? 'scale-125 ring-2 ring-offset-1 ring-slate-400' : 'hover:scale-110'
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
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mt-2"
                />
              )}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              標籤 <span className="font-normal text-slate-400">（以逗號分隔）</span>
            </label>
            <input
              type="text"
              value={form.tags}
              onChange={e => set('tags', e.target.value)}
              placeholder="例：行銷, 開發, 重要"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
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
