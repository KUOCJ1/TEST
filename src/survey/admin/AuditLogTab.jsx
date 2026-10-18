import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { formatDate } from '../utils/format';
import LoadingState from '../components/LoadingState';

// 動作代碼對照白話名稱；沒列到的直接顯示代碼（新增動作時不用先改這裡才看得到）。
const ACTION_LABELS = {
  view_rater_identity: '還原評分者身分',
  create_group: '建立班級',
  delete_group: '刪除班級',
  change_group_members: '調整班級成員',
  import_roster: '匯入名單',
  accept_group_invite: '接受班級邀請',
  create_rater_invite: '發出評分邀請',
  revoke_rater_invite: '撤回評分邀請',
  create_comment: '新增評語',
  update_comment: '修改評語',
  delete_comment: '刪除評語',
  publish_group: '發佈班級報告',
  unpublish_group: '取消發佈',
  generate_join_code: '產生報到代碼',
  revoke_join_code: '撤銷報到代碼',
  send_reminders: '寄送催交信',
  toggle_assessment: '開關評量',
};

const DETAIL_SKIP = new Set(['id', 'ts', 'actor', 'actorEmail', 'action']);

function detailText(entry) {
  return Object.entries(entry)
    .filter(([k, v]) => !DETAIL_SKIP.has(k) && v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.length}]` : String(v)}`)
    .join(' · ');
}

/**
 * 管理後台「稽核紀錄」：只讀、只增不改。敏感操作（還原評分者身分、刪班、調整成員、評語…）都會留在這裡，
 * 不會隨系統日誌輪替消失。
 */
export default function AuditLogTab() {
  const [entries, setEntries] = useState([]);
  const [actions, setActions] = useState([]);
  const [action, setAction] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    api.adminAuditLog({ action })
      .then((d) => {
        if (!active) return;
        setEntries(d.entries);
        setActions(d.actions ?? []);
        setHasMore(Boolean(d.hasMore));
        setError('');
      })
      .catch((e) => active && setError(e.message || '載入失敗'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [action, tick]);

  const changeAction = (value) => { setLoading(true); setAction(value); };
  const refresh = () => { setLoading(true); setTick((t) => t + 1); };
  const loadMore = async () => {
    setLoading(true);
    try {
      const d = await api.adminAuditLog({ action, before: entries.at(-1)?.ts });
      setEntries((prev) => [...prev, ...d.entries]);
      setHasMore(Boolean(d.hasMore));
    } catch (e) {
      setError(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section aria-label="稽核紀錄" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600">
          動作
          <select value={action} onChange={(e) => changeAction(e.target.value)} className="ml-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">全部</option>
            {actions.map((a) => <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>)}
          </select>
        </label>
        <button type="button" onClick={refresh} className="btn-secondary btn-sm">重新整理</button>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {loading && entries.length === 0 && <LoadingState />}
      {!loading && entries.length === 0 && !error && <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">還沒有紀錄。</p>}

      {entries.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr><th className="px-3 py-2">時間</th><th className="px-3 py-2">操作者</th><th className="px-3 py-2">動作</th><th className="px-3 py-2">內容</th></tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-slate-100 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatDate(e.ts)} {String(e.ts).slice(11, 16)}</td>
                  <td className="px-3 py-2 text-slate-700">{e.actorEmail ?? e.actor ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">{ACTION_LABELS[e.action] ?? e.action}</td>
                  <td className="break-all px-3 py-2 text-xs text-slate-500">{detailText(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hasMore && (
        <button type="button" disabled={loading} onClick={loadMore} className="btn-secondary btn-sm disabled:opacity-50">
          {loading ? '載入中…' : '載入更多'}
        </button>
      )}
    </section>
  );
}
