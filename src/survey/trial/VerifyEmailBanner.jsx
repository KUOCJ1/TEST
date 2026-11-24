import { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../auth/useAuth';

// 試用帳號還沒驗證 Email 時的提醒。不擋使用：驗證是為了確認信箱是本人的，
// 驗證後若教練已用這個 Email 邀請你，系統會自動幫你加入班級（見 server/src/lib/emailVerification.js）。
export default function VerifyEmailBanner() {
  const { user } = useAuth();
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [message, setMessage] = useState('');
  if (!user || !user.trial || user.emailVerified) return null;

  const resend = async () => {
    setState('sending');
    try {
      const r = await api.resendVerifyEmail();
      setState('sent');
      setMessage(r?.alreadyVerified ? '信箱已經驗證過了。' : `已寄到 ${user.email}，請收信（也看看垃圾信件匣）。`);
    } catch (e) {
      setState('error');
      setMessage(e?.message || '寄送失敗，請稍後再試。');
    }
  };

  return (
    <div className="mx-auto mt-3 flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-brass-50 px-4 py-2 text-sm text-slate-700" role="status">
      <MailCheck className="h-4 w-4 flex-none text-brass-600" aria-hidden="true" />
      <span className="flex-1">
        請到信箱點驗證連結，確認 {user.email} 是你的 Email。{message && <span className="ml-1 text-slate-500">{message}</span>}
      </span>
      <button type="button" className="btn-secondary btn-sm" onClick={resend} disabled={state === 'sending' || state === 'sent'}>
        {state === 'sending' ? '寄送中…' : state === 'sent' ? '已寄出' : '重寄驗證信'}
      </button>
    </div>
  );
}
