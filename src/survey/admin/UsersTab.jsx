import { useState } from 'react';
import { Check } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/useToast';

export default function UsersTab({ users, onUserChanged }) {
  const [error, setError] = useState('');
  const [roleChanging, setRoleChanging] = useState(null);
  const [resetGenerating, setResetGenerating] = useState(null);
  const [resetInfo, setResetInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const showToast = useToast();

  const handleRoleToggle = async (u) => {
    setRoleChanging(u.id);
    setError('');
    try {
      const newRole = u.role === 'coach' ? 'user' : 'coach';
      const updated = await api.setUserRole(u.id, newRole);
      onUserChanged(updated);
      showToast(newRole === 'coach' ? `已將 ${u.name} 設為教練` : `已取消 ${u.name} 的教練身份`);
    } catch (e) {
      setError(e.message || '操作失敗');
    } finally {
      setRoleChanging(null);
    }
  };

  const handleGenerateReset = async (u) => {
    setResetGenerating(u.id);
    setError('');
    try {
      const info = await api.generateResetToken(u.id);
      const url = `${window.location.origin}${window.location.pathname}?reset=${info.token}`;
      setResetInfo({ name: u.name, email: u.email, url, hours: info.expiresInHours });
      setCopied(false);
    } catch (e) {
      setError(e.message || '產生失敗');
    } finally {
      setResetGenerating(null);
    }
  };

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <section className="rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60">
        <h3 className="mb-4 text-base font-bold text-slate-700">用戶角色管理</h3>
        <p className="mb-2 text-xs text-slate-400 sm:hidden">← 左右滑動可查看完整欄位</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-medium">姓名</th>
                <th className="py-2 pr-3 font-medium">Email</th>
                <th className="py-2 pr-3 font-medium">目前角色</th>
                <th className="py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.filter((u) => u.role !== 'admin').map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-slate-700">{u.name}</td>
                  <td className="py-2.5 pr-3 text-slate-500">{u.email}</td>
                  <td className="py-2.5 pr-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      u.role === 'coach'
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {u.role === 'coach' ? '教練' : '一般用戶'}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={roleChanging === u.id}
                        onClick={() => handleRoleToggle(u)}
                        className={`btn-sm ${u.role === 'coach' ? 'btn-secondary' : 'btn bg-brand-100 text-brand-700 hover:bg-brand-200'}`}
                      >
                        {roleChanging === u.id ? '…' : u.role === 'coach' ? '取消教練身份' : '設為教練'}
                      </button>
                      <button
                        type="button"
                        disabled={resetGenerating === u.id}
                        onClick={() => handleGenerateReset(u)}
                        className="btn-secondary btn-sm"
                      >
                        {resetGenerating === u.id ? '產生中…' : '產生重設連結'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {resetInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setResetInfo(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="reset-dialog-title" className="text-lg font-bold text-slate-800">密碼重設連結</h3>
            <p className="mt-1 text-sm text-slate-500">
              給 <span className="font-semibold">{resetInfo.name}</span>（{resetInfo.email}）。
              此連結 {resetInfo.hours} 小時內有效，請複製後私下交給該使用者，他可自行設定新密碼。
            </p>
            <textarea
              readOnly
              value={resetInfo.url}
              onFocus={(e) => e.target.select()}
              className="input mt-3 bg-slate-50"
              rows={3}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard?.writeText(resetInfo.url);
                    setCopied(true);
                    showToast('已複製連結');
                  } catch {
                    setCopied(false);
                  }
                }}
                className="btn-primary"
              >
                {copied ? <><Check className="h-4 w-4" /> 已複製</> : '複製連結'}
              </button>
              <button
                type="button"
                onClick={() => setResetInfo(null)}
                className="btn-ghost"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
