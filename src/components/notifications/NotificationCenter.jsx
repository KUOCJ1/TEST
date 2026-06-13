import { useState, useEffect } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { formatDisplayTime } from '../../utils/calendar';

function countdown(reminderTime) {
  const ms = reminderTime - new Date();
  if (ms <= 0) return '即將提醒';
  const h = Math.floor(ms / 3600000);
  if (h >= 24) return `${Math.ceil(h / 24)} 天後提醒`;
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h} 小時後提醒`;
  return `${m || 1} 分鐘後提醒`;
}

function ReminderLabel({ minutes }) {
  const m = Number(minutes);
  const label = m >= 10080 ? '1 週前' : m >= 2880 ? '2 天前' : m >= 1440 ? '1 天前' : m >= 60 ? `${m / 60} 小時前` : `${m} 分鐘前`;
  return (
    <span className="text-[10px] text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full mt-1 inline-block">
      {label}
    </span>
  );
}

export default function NotificationCenter({ permission, requestPermission, upcomingReminders }) {
  const [open, setOpen] = useState(false);
  const count = upcomingReminders.length;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="通知"
        className="relative p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
      >
        {permission === 'denied' ? <BellOff size={18} /> : <Bell size={18} />}
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold pointer-events-none">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl w-72 z-20 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-800">提醒通知</span>
              <button onClick={() => setOpen(false)} aria-label="關閉通知" className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Permission banner */}
            {permission === 'default' && (
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
                <p className="text-xs text-amber-700 mb-2">啟用瀏覽器通知，事件提醒時收到系統彈窗。</p>
                <button
                  onClick={requestPermission}
                  className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                >
                  啟用通知
                </button>
              </div>
            )}
            {permission === 'denied' && (
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                <p className="text-xs text-slate-500">瀏覽器通知已被封鎖，請在瀏覽器設定中允許此網站的通知。</p>
              </div>
            )}
            {permission === 'granted' && (
              <div className="px-4 py-2 bg-green-50 border-b border-green-100">
                <p className="text-xs text-green-600">✓ 瀏覽器通知已啟用</p>
              </div>
            )}

            {/* Reminder list */}
            <div className="max-h-64 overflow-y-auto">
              {upcomingReminders.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <Bell size={22} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">48 小時內沒有待提醒事件</p>
                </div>
              ) : (
                upcomingReminders.map(({ event, reminderTime, minutes }) => (
                  <div key={`${event.id}_${event.reminder}`} className="px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <p className="text-sm font-medium text-slate-800 truncate">{event.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatDisplayTime(event.startAt)} · {countdown(reminderTime)}
                    </p>
                    <ReminderLabel minutes={minutes} />
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
