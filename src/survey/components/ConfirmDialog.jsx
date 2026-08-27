import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmContext } from './useConfirm';

/**
 * 全站共用的確認對話框 Provider，架構比照 ToastProvider：一個 Context 提供
 * 一支函式，實際的浮層由 Provider 自己在樹底掛出來，呼叫端不必各自管理彈窗
 * 開關狀態。設計成回傳 Promise<boolean>，讓呼叫端可以維持原本
 * `if (!window.confirm(...)) return;` 的寫法，只需要多加一個 await。
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);

  const confirm = useCallback((message, options = {}) => {
    const opts = typeof message === 'string' ? { message, ...options } : message;
    return new Promise((resolve) => {
      setState({
        message: opts.message,
        title: opts.title ?? null,
        confirmLabel: opts.confirmLabel ?? '確定',
        cancelLabel: opts.cancelLabel ?? '取消',
        danger: opts.danger ?? true,
        resolve,
      });
    });
  }, []);

  const close = useCallback((result) => {
    setState((prev) => {
      prev?.resolve(result);
      return null;
    });
  }, []);

  // 危險操作預設把焦點放在「取消」，避免鍵盤使用者不小心按下 Enter 就確認掉。
  useEffect(() => {
    if (!state) return undefined;
    (state.danger ? cancelRef : confirmRef).current?.focus();
    const handleKey = (e) => {
      if (e.key === 'Escape') close(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [state, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 print:hidden"
          onClick={() => close(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={state.title ? 'confirm-dialog-title' : undefined}
            aria-describedby="confirm-dialog-message"
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {state.title && (
              <h3 id="confirm-dialog-title" className="text-base font-bold text-slate-800">
                {state.title}
              </h3>
            )}
            <p
              id="confirm-dialog-message"
              className={`text-sm leading-relaxed text-slate-600 ${state.title ? 'mt-2' : ''}`}
            >
              {state.message}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button ref={cancelRef} type="button" onClick={() => close(false)} className="btn-secondary btn-sm">
                {state.cancelLabel}
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={() => close(true)}
                className={state.danger ? 'btn-danger btn-sm' : 'btn-primary btn-sm'}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
