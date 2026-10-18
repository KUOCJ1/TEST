import { useState } from 'react';
import { api } from '../api/client';

/**
 * 教練邀請你加入班級：本人接受後才會成為成員（教練不能直接把已有帳號的人加進班級）。
 * 接受之後班級的教練就看得到你在這個班的作答；婉拒則什麼都不會發生。
 */
export default function GroupInvites({ invites, onChanged }) {
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  if (!invites?.length) return null;

  const respond = async (id, accept) => {
    setBusyId(id);
    setError('');
    try {
      await (accept ? api.acceptGroupInvite(id) : api.declineGroupInvite(id));
      onChanged?.();
    } catch (e) {
      setError(e.message || '處理失敗，請稍後再試');
    } finally {
      setBusyId('');
    }
  };

  return (
    <section aria-label="班級邀請" className="mb-6 space-y-3">
      {invites.map((i) => (
        <div key={i.id} className="rounded-2xl border border-brass-200 bg-brass-50 px-5 py-4">
          <p className="font-bold text-slate-800">{i.coachName || '教練'}邀請你加入「{i.groupName}」{i.companyName ? `（${i.companyName}）` : ''}</p>
          <p className="mt-1 text-sm text-slate-600">
            接受後，這個班的教練可以看到你在這個班的作答與成績，同班成員只看得到你的姓名。婉拒不會有任何影響。
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busyId === i.id} onClick={() => respond(i.id, true)} className="btn-primary btn-sm disabled:opacity-50">接受邀請</button>
            <button type="button" disabled={busyId === i.id} onClick={() => respond(i.id, false)} className="btn-secondary btn-sm disabled:opacity-50">婉拒</button>
          </div>
        </div>
      ))}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
