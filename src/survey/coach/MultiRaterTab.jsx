import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { getAssessment } from '../data/assessments/index.js';
import { useAssessmentFilter } from '../hooks/useAssessmentFilter';
import MultiRaterDashboard from '../analysis/MultiRaterDashboard';
import InfoTip from '../components/InfoTip';
import { RATER_TYPES, RATER_LABELS } from '../constants/raterTypes';

const STRICT_NOTE = '此評量的評分者身分與個別分數對教練不公開；同儕與部屬各類滿 3 位才會單獨顯示，不足時併入他評合計。這裡只顯示回收份數，方便您提醒補足。';

const RATER_TIPS = {
  peer: '同儕與部屬評分在被評者端以匿名方式呈現，保護填答者隱私。',
  subordinate: '同儕與部屬評分在被評者端以匿名方式呈現，保護填答者隱私。',
};

export default function MultiRaterTab({ users, submissions }) {
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [search, setSearch] = useState('');

  const { assessmentIds, activeId: assessmentId, setSelectedId } =
    useAssessmentFilter(submissions);

  const filteredSubs = useMemo(
    () => submissions.filter((s) => (s.assessmentId ?? 'ai-competency') === assessmentId),
    [submissions, assessmentId],
  );

  const nonAdminUsers = useMemo(() => {
    const list = users.filter((u) => u.role !== 'admin');
    const q = search.trim().toLowerCase();
    return q ? list.filter((u) => u.name.toLowerCase().includes(q)) : list;
  }, [users, search]);

  // 每位受評者各類評分者的回收份數（嚴格隱私題庫的他評只剩計數用欄位，沒有身分與分數）。
  const countMap = useMemo(() => {
    const map = new Map();
    for (const u of nonAdminUsers) {
      const counts = {};
      for (const s of filteredSubs) {
        const rateeId = s.rateeId ?? s.userId;
        if (rateeId === u.id) counts[s.raterType ?? 'self'] = (counts[s.raterType ?? 'self'] ?? 0) + 1;
      }
      map.set(u.id, counts);
    }
    return map;
  }, [nonAdminUsers, filteredSubs]);
  const strict = Boolean(getAssessment(assessmentId)?.STRICT_RATER_PRIVACY);
  const threshold = getAssessment(assessmentId)?.RATER_TARGET?.threshold ?? 3;

  const selectedUser = selectedUserId ? users.find((u) => u.id === selectedUserId) : null;

  return (
    <div>
      {assessmentIds.length > 1 && (
        <div role="tablist" aria-label="選擇評量" className="mb-4 flex flex-wrap gap-2">
          {assessmentIds.map((id) => (
            <button key={id} type="button" role="tab" aria-selected={assessmentId === id} onClick={() => setSelectedId(id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                assessmentId === id ? 'bg-ink-700 text-white' : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}>
              {getAssessment(id)?.NAME ?? id}
            </button>
          ))}
        </div>
      )}

      {!getAssessment(assessmentId)?.SUPPORTS_360 && (
        <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
          此評量不支援 360° 多元評測。
        </p>
      )}

      {getAssessment(assessmentId)?.SUPPORTS_360 && (
        <>
          {strict && <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{STRICT_NOTE}</p>}
          <div className="mb-3 relative w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋學員姓名…"
              className="input py-1.5 pl-8 text-sm"
            />
          </div>
          <p className="mb-2 text-xs text-slate-400 sm:hidden">← 左右滑動可查看完整欄位</p>
          <div className="mb-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4 text-left font-medium">學員</th>
                  {RATER_TYPES.map((t) => (
                    <th key={t} className="py-2 px-2 text-center font-medium">
                      {RATER_LABELS[t]}
                      {RATER_TIPS[t] && <InfoTip text={RATER_TIPS[t]} />}
                    </th>
                  ))}
                  <th className="py-2 pl-4 text-center font-medium">查看分析</th>
                </tr>
              </thead>
              <tbody>
                {nonAdminUsers.map((u) => {
                  const counts = countMap.get(u.id) ?? {};
                  return (
                    <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="py-2.5 pr-4 font-semibold text-slate-700">{u.name}</td>
                      {RATER_TYPES.map((t) => (
                        <td key={t} className="py-2.5 px-2 text-center">
                          {strict && t !== 'self' && counts[t] ? (
                            // 嚴格隱私題庫：顯示回收份數，未達單獨顯示門檻者標示「不足」。
                            <span className={`text-xs font-semibold ${t === 'manager' || counts[t] >= threshold ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {counts[t]} 份{t !== 'manager' && counts[t] < threshold ? '（不足）' : ''}
                            </span>
                          ) : counts[t] ? (
                            <Check className="mx-auto h-4 w-4 text-emerald-500" />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      ))}
                      <td className="py-2.5 pl-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedUserId(selectedUserId === u.id ? null : u.id)}
                          className={`btn-sm ${
                            selectedUserId === u.id
                              ? 'btn bg-ink-700 text-white hover:bg-ink-900'
                              : 'btn-secondary'
                          }`}
                        >
                          {selectedUserId === u.id ? '收起' : '查看'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedUser && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <MultiRaterDashboard
                rateeId={selectedUser.id}
                rateeName={selectedUser.name}
                assessmentId={assessmentId}
                canDeanonymize={!strict}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
