import { useState } from 'react';
import { api } from '../api/client';

export default function ResetPasswordPage({ token, onDone }) {
  const [pw, setPw] = useState({ next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const submit = async (e) => {
    e.preventDefault();
    if (pw.next.length < 6) { setMsg({ type: 'err', text: '新密碼至少需 6 碼' }); return; }
    if (pw.next !== pw.confirm) { setMsg({ type: 'err', text: '兩次輸入的新密碼不一致' }); return; }
    setBusy(true);
    setMsg({ type: '', text: '' });
    try {
      await api.resetPassword({ token, newPassword: pw.next });
      setMsg({ type: 'ok', text: '✓ 密碼已重設，請使用新密碼登入。' });
      setTimeout(() => onDone(), 1800);
    } catch (err) {
      setMsg({ type: 'err', text: err.message || '重設失敗' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold text-slate-800 sm:text-3xl">重設密碼</h1>
          <p className="mt-2 text-sm text-slate-400">設定您的新密碼以重新登入</p>
        </header>

        <div className="rounded-2xl bg-white px-6 py-7 shadow-lg shadow-slate-200/60">
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-600">新密碼</span>
              <input type="password" className="input" autoComplete="new-password" placeholder="至少 6 碼"
                value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-600">確認新密碼</span>
              <input type="password" className="input" autoComplete="new-password"
                value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />
            </label>

            {msg.text && (
              <p className={`rounded-lg px-3 py-2 text-sm font-medium ${
                msg.type === 'err' ? 'border border-red-200 bg-red-50 text-red-600' : 'border border-brand-200 bg-brand-50 text-brand-700'
              }`}>{msg.text}</p>
            )}

            <button type="submit" disabled={busy}
              className="w-full rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2.5 font-bold text-white shadow-md transition-all hover:from-brand-600 hover:to-brand-700 disabled:opacity-60">
              {busy ? '處理中…' : '重設密碼'}
            </button>

            <button type="button" onClick={onDone}
              className="w-full rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700">
              返回登入
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
