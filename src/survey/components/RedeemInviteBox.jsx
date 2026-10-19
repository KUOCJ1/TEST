import { useState } from 'react';
import { api } from '../api/client';
import { extractInviteCode } from '../utils/inviteCode';

/**
 * 「我有邀請碼」：已登入、但還沒入班的人輸入教練給的邀請碼（或貼上邀請連結）加入班級。
 * 邀請是寄給某個 Email 的，必須用那個 Email 的帳號登入才能兌換；Email 不符時後端會說明原因。
 */
export default function RedeemInviteBox({ onJoined }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const code = extractInviteCode(value);
    if (!code) { setError('請輸入邀請碼，或貼上邀請連結'); return; }
    setBusy(true);
    setError('');
    try {
      const joined = await api.redeemInvite(code);
      setValue('');
      setOpen(false);
      onJoined?.(joined);
    } catch (err) {
      setError(err.message || '加入失敗，請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="輸入邀請碼" className="mb-6">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-brass-600 underline underline-offset-2">
          有教練給的邀請碼？
        </button>
      ) : (
        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <label className="block text-sm font-semibold text-slate-700" htmlFor="invite-code">邀請碼或邀請連結</label>
          <p className="mt-0.5 text-xs text-slate-400">邀請是寄給某個 Email 的，請用該 Email 的帳號登入後再輸入。</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id="invite-code" value={value} onChange={(e) => { setValue(e.target.value); setError(''); }}
              autoComplete="off" className="input min-w-0 flex-1" placeholder="例如 ABCD2345EF"
            />
            <button type="submit" disabled={busy} className="btn-primary btn-sm disabled:opacity-50">{busy ? '加入中…' : '加入班級'}</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary btn-sm">取消</button>
          </div>
          {error && <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        </form>
      )}
    </section>
  );
}
