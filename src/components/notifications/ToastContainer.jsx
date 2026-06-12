import { Bell, X } from 'lucide-react';

const TOAST_DURATION_MS = 6000;

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  // Show newest first, cap at 4
  const visible = [...toasts].reverse().slice(0, 4);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-xs w-full">
      {visible.map(toast => (
        <div
          key={toast.id}
          className="bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden animate-fade-in"
        >
          {/* Auto-dismiss progress bar */}
          <div
            className="h-0.5 bg-indigo-500 toast-progress"
            style={{ '--toast-duration': `${TOAST_DURATION_MS}ms` }}
          />
          <div className="px-4 py-3 flex items-start gap-3">
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <Bell size={14} className="text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{toast.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{toast.body}</p>
              {toast.time && (
                <p className="text-xs text-indigo-500 mt-0.5">開始時間：{toast.time}</p>
              )}
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-slate-300 hover:text-slate-600 transition-colors shrink-0 mt-0.5"
              aria-label="關閉通知"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
