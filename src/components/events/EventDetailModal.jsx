import { X, Clock, Tag, Lock, User } from 'lucide-react';
import { getColorHex } from '../../utils/colors';
import { formatDisplayTime } from '../../utils/calendar';

const TYPE_LABELS = { work: '工作', meeting: '會議', personal: '私人', reminder: '提醒' };

export default function EventDetailModal({ isOpen, onClose, event, onEdit }) {
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
            {event.type && (
              <span className="text-xs text-slate-500 mt-0.5 block">
                {TYPE_LABELS[event.type] || event.type}
              </span>
            )}
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
              <p className="text-sm text-slate-600 pl-[22px]">{event.description}</p>
            )}
          </div>
        )}

        {isPrivate && (
          <p className="px-5 pb-4 text-sm text-slate-400">此事項已設為私人，內容不對外顯示。</p>
        )}

        {/* Edit button — only for own events */}
        {onEdit && !isPrivate && (
          <div className="border-t border-slate-100 px-5 py-3 flex justify-end">
            <button
              onClick={onEdit}
              className="px-4 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              編輯
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
