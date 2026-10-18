import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { RATER_LABELS } from '../../constants/raterTypes';

const TYPES = [
  { id: 'peer', label: RATER_LABELS.peer, desc: '同等職級的同事' },
  { id: 'subordinate', label: RATER_LABELS.subordinate, desc: '直接向你報告的人' },
  { id: 'manager', label: RATER_LABELS.manager, desc: '你的直屬主管' },
];

/**
 * 邀請同班成員評測某位受評者（領導力羅盤等嚴格隱私題庫：沒有邀請就不能評）。
 * 受評者本人使用時只需 members；教練使用時再帶 rateeOptions（選擇替誰安排）與 groupId。
 * 這裡只顯示「邀請了誰與身分」，不顯示誰已經完成——否則受評者能推出誰評了什麼，匿名就失效。
 */
export default function RaterInvitePanel({ assessmentId, members, rateeOptions = null, groupId = null }) {
  const [rateeId, setRateeId] = useState(rateeOptions?.[0]?.id ?? '');
  const [raterUserId, setRaterUserId] = useState('');
  const [raterType, setRaterType] = useState('peer');
  const [invited, setInvited] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    const load = groupId
      ? api.groupRaterInvites(groupId)
      : api.raterInvitesMine().then((d) => d.invited.filter((i) => i.assessmentId === assessmentId));
    return load.then(setInvited).catch(() => setInvited([]));
  }, [groupId, assessmentId]);

  useEffect(() => { reload(); }, [reload]);

  const visible = rateeOptions ? invited.filter((i) => i.rateeId === rateeId) : invited;
  const invitedIds = new Set(visible.map((i) => i.raterUserId));
  const candidates = members.filter((m) => m.id !== rateeId && !invitedIds.has(m.id));

  const send = async () => {
    if (!raterUserId) { setError('請先選擇要邀請的成員'); return; }
    setBusy(true);
    setError('');
    try {
      await api.createRaterInvite({
        assessmentId, raterUserId, raterType, ...(rateeOptions && { rateeId }), ...(groupId && { groupId }),
      });
      setRaterUserId('');
      await reload();
    } catch (e) {
      setError(e.message || '邀請失敗，請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id) => {
    setError('');
    try { await api.deleteRaterInvite(id); await reload(); } catch (e) { setError(e.message || '撤回失敗'); }
  };

  return (
    <div className="space-y-3">
      {rateeOptions && (
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-slate-700">替誰安排評分者</span>
          <select value={rateeId} onChange={(e) => setRateeId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2">
            {rateeOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
      )}

      {members.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
          你還沒有可以邀請的同班成員。加入班級後（或班上有其他成員時）就能在這裡邀請。
        </p>
      ) : (
        <div className="rounded-xl border border-slate-200 px-4 py-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-slate-700">邀請誰</span>
              <select value={raterUserId} onChange={(e) => { setRaterUserId(e.target.value); setError(''); }} className="w-full rounded-lg border border-slate-300 px-3 py-2">
                <option value="">請選擇同班成員</option>
                {candidates.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-slate-700">對方是{rateeOptions ? '受評者' : '你'}的…</span>
              <select value={raterType} onChange={(e) => setRaterType(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2">
                {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}（{t.desc}）</option>)}
              </select>
            </label>
          </div>
          <button type="button" onClick={send} disabled={busy} className="btn-primary btn-sm mt-3 disabled:opacity-50">
            {busy ? '送出中…' : '送出邀請'}
          </button>
        </div>
      )}

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {visible.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm" aria-label="已發出的邀請">
          {visible.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-slate-700"><strong>{i.raterName}</strong><span className="ml-3">{RATER_LABELS[i.raterType]}</span></span>
              <button type="button" onClick={() => revoke(i.id)} className="text-xs font-semibold text-red-500 hover:underline">撤回</button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-400">
        為了保護匿名，這裡不會顯示對方是否已經完成。被邀請的人會在「360° 評測」看到「等你評測的人」。
      </p>
    </div>
  );
}

/** 評分者看到的「等你評測的人」：只列出自己收到的邀請。 */
export function InvitationsToRate({ assessmentId, onRate }) {
  const [list, setList] = useState(null);
  useEffect(() => {
    let active = true;
    api.raterInvitesMine()
      .then((d) => active && setList(d.toRate.filter((i) => i.assessmentId === assessmentId)))
      .catch(() => active && setList([]));
    return () => { active = false; };
  }, [assessmentId]);

  if (list === null) return <p className="text-sm text-slate-400">載入中…</p>;
  if (list.length === 0) {
    return (
      <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
        目前沒有人邀請你評測。領導力羅盤的他評需要<strong>受評者本人或教練</strong>邀請，收到邀請後會顯示在這裡。
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {list.map((i) => (
        <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3">
          <span className="text-sm text-slate-700"><strong>{i.rateeName}</strong><span className="ml-3">你的身分：{RATER_LABELS[i.raterType]}</span></span>
          <button type="button" onClick={() => onRate(i.rateeId, i.raterType, i.rateeName)} className="btn-primary btn-sm">開始評測</button>
        </li>
      ))}
    </ul>
  );
}
