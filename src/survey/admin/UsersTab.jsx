import { useMemo, useState } from 'react';
import { Check, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/useToast';

export default function UsersTab({ users, onUserChanged }) {
  const [error, setError] = useState('');
  const [roleChanging, setRoleChanging] = useState(null);
  const [resetGenerating, setResetGenerating] = useState(null);
  const [resetInfo, setResetInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const showToast = useToast();

  // 用戶量一大（累積到兩三百人），整張表沒有搜尋、排序就只能靠瀏覽器 Ctrl-F（A-02）。
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = users.filter((u) => u.role !== 'admin');
    if (q) list = list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => dir * String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? '')));
  }, [users, search, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sortIcon = (column) =>
    sortKey === column ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null;

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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-700">用戶角色管理</h3>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋姓名或 Email…"
              className="input w-56 py-1.5 pl-8 text-sm"
            />
          </div>
        </div>
        <p className="mb-2 text-xs text-slate-400 sm:hidden">← 左右滑動可查看完整欄位</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-medium">
                  <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1 hover:text-slate-700">
                    姓名 {sortIcon('name')}
                  </button>
                </th>
                <th className="py-2 pr-3 font-medium">
                  <button type="button" onClick={() => toggleSort('email')} className="inline-flex items-center gap-1 hover:text-slate-700">
                    Email {sortIcon('email')}
                  </button>
                </th>
                <th className="py-2 pr-3 font-medium">
                  <button type="button" onClick={() => toggleSort('role')} className="inline-flex items-center gap-1 hover:text-slate-700">
                    目前角色 {sortIcon('role')}
                  </button>
                </th>
                <th className="py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-slate-400">查無符合的用戶，請調整搜尋條件</td></tr>
              )}
              {rows.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-slate-700">{u.name}</td>
                  <td className="py-2.5 pr-3 text-slate-500">{u.email}</td>
                  <td className="py-2.5 pr-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      u.role === 'coach'
                        ? 'bg-brass-100 text-brass-600'
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
                        className={`btn-sm ${u.role === 'coach' ? 'btn-secondary' : 'btn bg-brass-100 text-brass-600 hover:bg-brass-200'}`}
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
