import { Bell, X, CheckCircle, Info } from 'lucide-react';

const TOAST_DURATION_MS = 6000;

const TYPE_CONFIG = {
  success: { icon: CheckCircle, bg: 'bg-emerald-100', text: 'text-emerald-600', bar: 'bg-emerald-500' },
  info:    { icon: Info,         bg: 'bg-blue-100',    text: 'text-blue-600',    bar: 'bg-blue-500' },
  default: { icon: Bell,         bg: 'bg-indigo-100',  text: 'text-indigo-600',  bar: 'bg-indigo-500' },
};

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  // Show newest first, cap at 4
  const visible = [...toasts].reverse().slice(0, 4);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-xs w-full">
      {visible.map(toast => {
        const cfg = TYPE_CONFIG[toast.type] ?? TYPE_CONFIG.default;
        const Icon = cfg.icon;
        return (
          <div
            key={toast.id}
            className="bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden animate-fade-in"
          >
            {/* Auto-dismiss progress bar */}
            <div
              className={`h-0.5 toast-progress ${cfg.bar}`}
              style={{ '--toast-duration': `${TOAST_DURATION_MS}ms` }}
            />
            <div className="px-4 py-3 flex items-start gap-3">
              <div className={`w-8 h-8 ${cfg.bg} rounded-full flex items-center justify-center shrink-0 mt-0.5`}>
                <Icon size={14} className={cfg.text} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{toast.title}</p>
                {toast.body && <p className="text-xs text-slate-500 mt-0.5">{toast.body}</p>}
                {toast.time && (
                  <p className={`text-xs mt-0.5 ${cfg.text}`}>開始時間：{toast.time}</p>
                )}
                {toast.action && (
                  <button
                    onClick={() => { toast.action.onClick(); onDismiss(toast.id); }}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 mt-1 underline"
                  >
                    {toast.action.label}
                  </button>
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
        );
      })}
    </div>
  );
}
