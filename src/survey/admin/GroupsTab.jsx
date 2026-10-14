import { useId, useState } from 'react';
import GroupTimelineCard from '../components/GroupTimelineCard';
import { useConfirm } from '../components/useConfirm';
import { useToast } from '../components/useToast';
import { api } from '../api/client';

// 每個班別卡片下方的「負責教練」列（Sprint 11）：管理者以前看不到每班是誰在帶，教練離職或
// 換人時也沒辦法處理。轉移後原教練就看不到這個班（教練只看得到自己名下的班別）。
function CoachRow({ group, coaches, onUpdated }) {
  const id = useId();
  const confirm = useConfirm();
  const showToast = useToast();
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const options = coaches.filter((c) => c.id !== group.coachId);

  const transfer = async () => {
    const to = coaches.find((c) => c.id === target);
    if (!to) return;
    const ok = await confirm({
      title: '轉移班別',
      message: `把「${group.name}」從 ${group.coachName || '原教練'} 轉給 ${to.name}？轉移後原教練就看不到這個班；班級成員與成績都不會變。`,
      confirmLabel: '轉移',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      const updated = await api.transferGroup(group.id, to.id);
      onUpdated(updated);
      setTarget('');
      showToast(`已將「${group.name}」轉給 ${to.name}`);
    } catch (e) {
      setError(e.message || '轉移失敗');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-700">負責教練：</span>{group.coachName || '（未知）'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={id} className="sr-only">把「{group.name}」轉給</label>
          <select id={id} value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy || options.length === 0} className="input w-auto py-1.5 pr-8 text-sm">
            <option value="">{options.length === 0 ? '沒有其他可轉移的教練' : '轉給其他教練…'}</option>
            {options.map((c) => <option key={c.id} value={c.id}>{c.name}（{c.email}）</option>)}
          </select>
          <button type="button" className="btn-secondary btn-sm whitespace-nowrap" disabled={!target || busy} onClick={transfer}>
            {busy ? '轉移中…' : '轉移班別'}
          </button>
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function GroupsTab({ groups, users = [], onGroupUpdated }) {
  // 可以接手班別的人：有效（未停用）的教練與管理者。
  const coaches = users.filter((u) => (u.role === 'coach' || u.role === 'admin') && !u.disabled);

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl bg-white px-6 py-12 text-center text-slate-500 shadow-lg shadow-slate-200/60">
        目前尚無班別。請至「教練後台 → 班級」建立班別後，即可在此設定時間軸與發佈。
      </div>
    );
  }

  return (
    <section>
      <p className="mb-4 text-sm text-slate-500">
        設定各班別的施測開始／截止日期、發佈成果，並可在教練離職或換人時把班別轉給其他教練。
      </p>
      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.id}>
            <GroupTimelineCard group={g} onUpdated={onGroupUpdated} showHeader />
            <CoachRow group={g} coaches={coaches} onUpdated={onGroupUpdated} />
          </div>
        ))}
      </div>
    </section>
  );
}
