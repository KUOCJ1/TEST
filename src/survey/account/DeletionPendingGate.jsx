import { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { formatDate } from '../utils/format';
import { downloadMyData } from './downloadMyData';

// 已申請刪除帳號（Sprint 39）：等待期間登入只看到這一頁——取消刪除、下載資料或登出。
export default function DeletionPendingGate() {
  const { user, cancelDeletion, logout } = useAuth();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const base = import.meta.env.BASE_URL;
  const run = async (key, fn) => { setBusy(key); setError(''); try { await fn(); } catch (e) { setError(e.message || '操作失敗，請稍後再試'); } finally { setBusy(''); } };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-md bg-paper-50 p-6 shadow-card ring-1 ring-paper-300 sm:p-8">
        <img src={`${base}favicon.svg`} alt="" className="mb-4 h-12 w-12" />
        <h1 className="font-serif text-2xl font-bold tracking-tight text-ink-700">帳號已排定刪除</h1>
        <p className="mt-3 leading-relaxed text-slate-700">
          {user?.name}，你的帳號將在 <strong>{formatDate(user?.deletionScheduledFor)}</strong> 永久刪除。在那之前取消，一切會恢復原狀（班級、作答、目標都會回來）。
        </p>
        {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary px-6 py-2.5" disabled={busy !== ''} onClick={() => run('cancel', cancelDeletion)}>
            {busy === 'cancel' ? '處理中…' : '取消刪除，繼續使用'}
          </button>
          <button type="button" className="btn-secondary" disabled={busy !== ''} onClick={() => run('download', downloadMyData)}>
            {busy === 'download' ? '準備中…' : '下載我的資料'}
          </button>
          <button type="button" className="btn-ghost" disabled={busy !== ''} onClick={logout}>登出</button>
        </div>
      </div>
    </main>
  );
}
