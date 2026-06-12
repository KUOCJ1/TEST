import { X, Clock, Tag, Lock, User, Users, ExternalLink, MapPin, Link, RefreshCw, Copy, Download } from 'lucide-react';
import { exportToIcs } from '../../utils/ics';
import { getColorHex } from '../../utils/colors';
import { formatDisplayTime } from '../../utils/calendar';
import { FREQ_OPTIONS } from '../../utils/recurrence';

const TYPE_LABELS = { work: '工作', meeting: '會議', personal: '私人', reminder: '提醒' };

function freqLabel(freq) {
  return FREQ_OPTIONS.find(o => o.value === freq)?.label || freq;
}

function exportSingleEvent(event) {
  const content = exportToIcs([event]);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.title.replace(/[^\w一-鿿]/g, '_')}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EventDetailModal({ isOpen, onClose, event, onEdit, onCopy }) {
  if (!isOpen || !event) return null;

  const color = getColorHex(event.color);
  const isPrivate = event.isPrivate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Color bar */}
        <div className="h-1.5 w-full" style={{ backgroundColor: color }} />

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-4 pb-2">
          <div className="flex-1">
            {isPrivate ? (
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-slate-400 shrink-0" />
                <h2 className="text-lg font-semibold text-slate-500">私人事項</h2>
              </div>
            ) : (
              <h2 className="text-lg font-semibold text-slate-800">{event.title}</h2>
            )}

            <div className="flex flex-wrap gap-1.5 mt-1">
              {event?.source === 'google' && (
                <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                  <span className="w-3.5 h-3.5 rounded bg-red-500 text-white text-[8px] flex items-center justify-center font-bold">G</span>
                  Google 行事曆
                </span>
              )}
              {event.isRecurring && (
                <span className="inline-flex items-center gap-1 text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full">
                  <RefreshCw size={10} />
                  {freqLabel(event.recurrence?.freq)}
                </span>
              )}
              {event.type && (
                <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-100 rounded-full">
                  {TYPE_LABELS[event.type] || event.type}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 ml-3 shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        {!isPrivate && (
          <div className="px-5 pb-4 space-y-3">
            {/* Time */}
            <div className="flex items-start gap-2.5">
              <Clock size={15} className="text-slate-400 mt-0.5 shrink-0" />
              <div className="text-sm text-slate-700">
                {event.isAllDay ? (
                  <span>全天</span>
                ) : (
                  <span>{formatDisplayTime(event.startAt)} – {formatDisplayTime(event.endAt)}</span>
                )}
                <span className="text-slate-400 ml-1">
                  {new Date(event.startAt).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Creator */}
            {event.creatorName && (
              <div className="flex items-center gap-2.5">
                <User size={15} className="text-slate-400 shrink-0" />
                <span className="text-sm text-slate-600">{event.creatorName}</span>
              </div>
            )}

            {/* Location */}
            {event.location && (
              <div className="flex items-start gap-2.5">
                <MapPin size={15} className="text-slate-400 mt-0.5 shrink-0" />
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(event.location)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-indigo-600 hover:underline break-all"
                >
                  {event.location}
                </a>
              </div>
            )}

            {/* URL */}
            {event.url && (
              <div className="flex items-start gap-2.5">
                <Link size={15} className="text-slate-400 mt-0.5 shrink-0" />
                <a
                  href={event.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-indigo-600 hover:underline break-all"
                >
                  {event.url.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}

            {/* Attendees */}
            {event.attendees?.length > 0 && (
              <div className="flex items-start gap-2.5">
                <Users size={15} className="text-slate-400 mt-0.5 shrink-0" />
                <div className="flex flex-wrap gap-1.5">
                  {event.attendees.map(email => {
                    const initials = email.split('@')[0].slice(0, 2).toUpperCase();
                    return (
                      <span
                        key={email}
                        title={email}
                        className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full"
                      >
                        <span className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                          {initials}
                        </span>
                        {email}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tags */}
            {event.tags?.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Tag size={15} className="text-slate-400 shrink-0" />
                {event.tags.map(tag => (
                  <span key={tag} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            {event.description && (
              <p className="text-sm text-slate-600 pl-[22px] whitespace-pre-wrap">{event.description}</p>
            )}
          </div>
        )}

        {isPrivate && (
          <p className="px-5 pb-4 text-sm text-slate-400">此事項已設為私人，內容不對外顯示。</p>
        )}

        {/* Footer */}
        {!isPrivate && (
          <div className="border-t border-slate-100 px-5 py-3 flex justify-between items-center gap-3">
            <div className="flex items-center gap-2">
              {event?.htmlLink && (
                <a
                  href={event.htmlLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <ExternalLink size={13} />
                  在 Google 開啟
                </a>
              )}
              {event?.source !== 'google' && (
                <>
                  <button
                    onClick={() => exportSingleEvent(event)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    title="匯出為 .ics"
                  >
                    <Download size={13} />
                  </button>
                  {onCopy && (
                    <button
                      onClick={onCopy}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="複製事件"
                    >
                      <Copy size={13} />
                      複製
                    </button>
                  )}
                </>
              )}
            </div>
            {onEdit && event?.source !== 'google' && (
              <button
                onClick={onEdit}
                className="px-4 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                編輯
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
