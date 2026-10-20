import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api } from '../api/client';
import { parseRoster } from '../utils/roster';

/**
 * 成員核對與排除（掃碼報到「先收後審」用）：貼上客戶承辦給的名單，系統標出
 * 「已加入但不在名單上」「名單上還沒加入」的人；名單外或誤填的人可以「排除」——
 * 他的作答不再進這個班的報告、統計與匯出（資料不刪除，隨時可以恢復），也不再被催交。
 * 不貼名單也可以直接對任何成員排除／恢復。
 */
export default function MemberScreeningPanel({ group, members, onGroupUpdated, onChanged, showToast }) {
  const [text, setText] = useState('');
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const roster = useMemo(() => parseRoster(text), [text]);
  const rosterEmails = useMemo(() => new Set(roster.map((r) => r.email.toLowerCase())), [roster]);
  const memberEmails = useMemo(() => new Set(members.map((m) => (m.email ?? '').toLowerCase())), [members]);
  const hasRoster = roster.length > 0;
  const notJoined = roster.filter((r) => !memberEmails.has(r.email.toLowerCase()));
  const outsiders = hasRoster ? members.filter((m) => !rosterEmails.has((m.email ?? '').toLowerCase())) : [];

  const toggle = async (member, excluded) => {
    setBusyId(member.id);
    setError('');
    try {
      const updated = await api.setGroupExclusion(group.id, member.id, excluded);
      onGroupUpdated?.(updated);
      showToast?.(excluded ? `已排除 ${member.name}（不列入統計）` : `已恢復 ${member.name}`);
      await onChanged?.();
    } catch (e) {
      setError(e.message || '操作失敗，請稍後再試');
    } finally {
      setBusyId('');
    }
  };

  const status = (m) => {
    if (m.excluded) return { text: '已排除（不列入統計）', cls: 'bg-slate-100 text-slate-500' };
    if (!hasRoster) return null;
    return rosterEmails.has((m.email ?? '').toLowerCase())
      ? { text: '在名單上', cls: 'bg-emerald-50 text-emerald-700' }
      : { text: '不在名單上', cls: 'bg-amber-50 text-amber-700' };
  };

  return (
    <div className="panel-secondary" aria-label="成員核對與排除">
      <h3 className="mb-1 flex items-center gap-1.5 font-semibold text-slate-700">
        <ShieldCheck className="h-4 w-4 text-brass-500" /> 成員核對與排除
      </h3>
      <p className="mb-3 text-xs text-slate-400">
        掃碼報到的人是自己填 Email，沒有經過驗證。貼上客戶給的名單可以核對誰不在名單上；被排除的人，作答不會進這個班的報告、統計與匯出（不刪除資料，可恢復）。
      </p>

      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-slate-700">客戶的名單（選填，每行「姓名,Email」或只有 Email）</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="input" placeholder={'王小明,ming@company.com\nhua@company.com'} />
      </label>

      {hasRoster && (
        <p className="mt-2 text-xs text-slate-600" role="status">
          名單 {roster.length} 人：已加入 {roster.length - notJoined.length} 人、<strong>尚未加入 {notJoined.length} 人</strong>；
          已加入的成員中 <strong>{outsiders.length} 人不在名單上</strong>。
        </p>
      )}
      {error && <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      {members.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">目前還沒有成員。</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
          {members.map((m) => {
            const st = status(m);
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className={`truncate font-semibold ${m.excluded ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{m.name}</p>
                  <p className="truncate text-xs text-slate-400">{m.email}</p>
                  {st && <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs ${st.cls}`}>{st.text}</span>}
                </div>
                <button
                  type="button" disabled={busyId === m.id}
                  onClick={() => toggle(m, !m.excluded)}
                  aria-label={m.excluded ? `恢復 ${m.name}` : `排除 ${m.name}（不列入統計）`}
                  className="btn-secondary btn-sm disabled:opacity-50"
                >
                  {m.excluded ? '恢復' : '排除'}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {hasRoster && notJoined.length > 0 && (
        <details className="mt-3 text-xs text-slate-500">
          <summary className="cursor-pointer font-semibold">名單上還沒加入的人（{notJoined.length}）</summary>
          <ul className="mt-1 list-disc pl-5">
            {notJoined.map((r) => <li key={r.email}>{r.name ? `${r.name} ` : ''}{r.email}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
