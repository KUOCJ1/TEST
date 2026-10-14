import { useMemo, useState } from 'react';
import { Check, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { useConfirm } from '../components/useConfirm';
import { useToast } from '../components/useToast';

const ROLE_LABEL = { user: '一般用戶', coach: '教練', admin: '管理者' };
const ROLE_BADGE = {
  user: 'bg-slate-100 text-slate-600',
  coach: 'bg-brass-100 text-brass-700',
  admin: 'bg-ink-700 text-white',
};
const FILTERS = [
  ['all', '全部'], ['user', '一般用戶'], ['coach', '教練'], ['admin', '管理者'], ['disabled', '已停用'],
];
const ROLE_HELP = [
  ['一般用戶', '填答評量、看自己的報告、設定發展目標、使用「我的學習」。'],
  ['教練', '一般用戶的全部功能，加上教練後台：管理自己的班級與成員、看班級成績、寫評語、寄催交信。只看得到自己班上的學員。'],
  ['管理者', '教練的全部功能（可看所有班別），加上管理後台：開關題庫、修改題庫文字、管理用戶角色、停用帳號、轉移班別、看系統狀態。權限很大，請謹慎指定。'],
];

// 角色變更前的確認內文：說清楚「這個動作的後果」，尤其是對方會被登出——以前一鍵生效、
// 也沒提醒，被改的人會在下一次操作時莫名其妙被登出。
function roleChangeMessage(u, role) {
  const logout = '對方目前的登入會立即失效，重新登入後新權限才生效。';
  if (role === 'admin') {
    return `將「${u.name}」設為管理者？管理者可以修改題庫內容、管理所有用戶與班別、停用帳號，權限很大。${logout}`;
  }
  if (u.role === 'admin') {
    return `「${u.name}」將不再是管理者，改為${ROLE_LABEL[role]}，無法再進管理後台。${logout}`;
  }
  if (role === 'coach') return `將「${u.name}」設為教練？對方可以使用教練後台建立與管理班級。${logout}`;
  return `取消「${u.name}」的教練身份？對方無法再使用教練後台；他名下的班級仍保留，可在「班別與發佈」轉給其他教練。${logout}`;
}

export default function UsersTab({ users, onUserChanged }) {
  const { user: me } = useAuth();
  const confirm = useConfirm();
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [resetGenerating, setResetGenerating] = useState(null);
  const [resetInfo, setResetInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const showToast = useToast();

  const counts = useMemo(() => ({
    all: users.length,
    user: users.filter((u) => u.role === 'user').length,
    coach: users.filter((u) => u.role === 'coach').length,
    admin: users.filter((u) => u.role === 'admin').length,
    disabled: users.filter((u) => u.disabled).length,
  }), [users]);

  // 用戶量一大（累積到兩三百人），整張表沒有搜尋、排序就只能靠瀏覽器 Ctrl-F（A-02）。
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = users.filter((u) => (filter === 'all' ? true : filter === 'disabled' ? u.disabled : u.role === filter));
    if (q) list = list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => dir * String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? '')));
  }, [users, search, filter, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };
  const sortIcon = (column) =>
    sortKey === column ? (sortDir === 'asc' ? <ChevronUp aria-hidden="true" className="h-3 w-3" /> : <ChevronDown aria-hidden="true" className="h-3 w-3" />) : null;

  const run = async (u, fn, okMessage) => {
    setBusyId(u.id);
    setError('');
    try {
      const updated = await fn();
      onUserChanged(updated);
      showToast(okMessage);
    } catch (e) {
      setError(e.message || '操作失敗');
    } finally {
      setBusyId(null);
    }
  };

  const handleRoleChange = async (u, role) => {
    if (role === u.role) return;
    const ok = await confirm({
      title: role === 'admin' ? '設為管理者' : '變更角色',
      message: roleChangeMessage(u, role),
      confirmLabel: '確定變更',
      danger: role === 'admin' || u.role === 'admin',
    });
    if (!ok) return;
    await run(u, () => api.setUserRole(u.id, role), `已將 ${u.name} 設為${ROLE_LABEL[role]}`);
  };

  const handleDisabledToggle = async (u) => {
    const disabling = !u.disabled;
    const ok = await confirm({
      title: disabling ? '停用帳號' : '重新啟用帳號',
      message: disabling
        ? `停用「${u.name}」？對方會立即被登出、無法再登入；作答紀錄與班級資料都會保留，之後可以重新啟用。`
        : `重新啟用「${u.name}」？對方可以再次登入。`,
      confirmLabel: disabling ? '停用' : '重新啟用',
      danger: disabling,
    });
    if (!ok) return;
    await run(u, () => api.setUserDisabled(u.id, disabling), disabling ? `已停用 ${u.name}` : `已重新啟用 ${u.name}`);
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
        <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <section className="rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-700">用戶與權限</h3>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label="搜尋姓名或 Email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋姓名或 Email…"
              className="input w-full py-1.5 pl-8 text-sm sm:w-56"
            />
          </div>
        </div>

        <details className="mb-4 rounded-lg bg-slate-50 px-4 py-3 text-sm">
          <summary className="cursor-pointer font-semibold text-slate-700">各角色能做什麼？</summary>
          <dl className="mt-3 space-y-2">
            {ROLE_HELP.map(([name, text]) => (
              <div key={name}>
                <dt className="font-semibold text-slate-700">{name}</dt>
                <dd className="text-slate-600">{text}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-slate-600">
            <strong>停用帳號</strong>：對方無法登入、現有登入立即失效、不再收通知信；作答紀錄與班級資料保留，可隨時重新啟用。
          </p>
        </details>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div role="group" aria-label="依角色篩選" className="flex flex-wrap gap-1.5">
            {FILTERS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
                className={`chip whitespace-nowrap transition-colors ${
                  filter === id ? 'bg-ink-700 text-white' : 'bg-paper-200 text-ink-600 hover:bg-paper-300'
                }`}
              >
                {label}（{counts[id]}）
              </button>
            ))}
          </div>
          <div role="group" aria-label="排序" className="flex items-center gap-1 text-xs text-slate-500">
            排序：
            {[['name', '姓名'], ['email', 'Email'], ['role', '角色']].map(([key, label]) => (
              <button key={key} type="button" onClick={() => toggleSort(key)} aria-pressed={sortKey === key}
                className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-semibold hover:text-slate-700 ${sortKey === key ? 'text-slate-800' : ''}`}>
                {label} {sortIcon(key)}
              </button>
            ))}
          </div>
        </div>

        {/* 同一份 DOM 用 CSS 切換版面：桌機是一列一人的表格式排列，手機是卡片；以前手機版
            用橫向捲動的表格，欄位被擠成一字一行幾乎無法操作。 */}
        {rows.length === 0 ? (
          <p className="py-6 text-center text-slate-400">查無符合的用戶，請調整搜尋或篩選條件</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((u) => {
              const isMe = u.id === me?.id;
              const busy = busyId === u.id;
              return (
                <li key={u.id} className="flex flex-col gap-2 py-3 sm:grid sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_20.5rem] sm:items-center sm:gap-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-slate-700">
                      <span className="truncate">{u.name}</span>
                      {isMe && <span className="text-xs font-normal text-slate-500">（你自己）</span>}
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE[u.role] ?? ROLE_BADGE.user}`}>
                        {ROLE_LABEL[u.role] ?? u.role}
                      </span>
                      {u.disabled && <span className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">已停用</span>}
                    </p>
                    <p className="truncate text-sm text-slate-500 sm:hidden">{u.email}</p>
                  </div>
                  <p className="hidden truncate text-sm text-slate-500 sm:block">{u.email}</p>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <label className="sr-only" htmlFor={`role-${u.id}`}>變更 {u.name} 的角色</label>
                    <select
                      id={`role-${u.id}`}
                      value={u.role}
                      disabled={busy || isMe}
                      title={isMe ? '不能修改自己的角色' : undefined}
                      onChange={(e) => handleRoleChange(u, e.target.value)}
                      className="input w-auto py-1.5 pr-8 text-sm"
                    >
                      {Object.entries(ROLE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <button
                      type="button"
                      disabled={busy || isMe}
                      title={isMe ? '不能停用自己的帳號' : undefined}
                      onClick={() => handleDisabledToggle(u)}
                      className={`btn-sm whitespace-nowrap ${u.disabled ? 'btn-secondary' : 'btn-danger'}`}
                      aria-label={`${u.disabled ? '重新啟用' : '停用'} ${u.name}`}
                    >
                      {u.disabled ? '重新啟用' : '停用'}
                    </button>
                    <button
                      type="button"
                      disabled={resetGenerating === u.id}
                      onClick={() => handleGenerateReset(u)}
                      className="btn-secondary btn-sm whitespace-nowrap"
                      aria-label={`產生 ${u.name} 的重設連結`}
                    >
                      {resetGenerating === u.id ? '產生中…' : '產生重設連結'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
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
