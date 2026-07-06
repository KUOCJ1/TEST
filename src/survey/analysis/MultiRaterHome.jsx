import { useEffect, useMemo, useState } from 'react';
import { Search, PenLine, CalendarClock, UserPlus, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';
import { getAssessment } from '../data/assessments/index.js';
import MultiRaterDashboard from './MultiRaterDashboard';
import { RATER_LABELS } from '../constants/raterTypes';

const OTHER_RATER_TYPES = ['manager', 'peer', 'subordinate'];

export default function MultiRaterHome({ user, initialAssessmentId, onRateOthers }) {
  const [assessments, setAssessments] = useState([]);
  const [members, setMembers] = useState([]);
  const [mySubs, setMySubs] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [selectedId, setSelectedId] = useState(initialAssessmentId ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([api.assessments(), api.groupMembers(), api.mySubmissions(), api.myGroups()])
      .then(([aList, mList, sList, gList]) => {
        if (!active) return;
        setAssessments(aList);
        setMembers(mList);
        setMySubs(sList);
        setMyGroups(gList);
      })
      .catch((e) => active && setError(e.message || '載入失敗'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const supported = useMemo(
    () => assessments.filter((a) => getAssessment(a.id)?.SUPPORTS_360),
    [assessments],
  );

  // initialAssessmentId／selectedId 可能承接自其他頁面（如「我的評量」當時選的評量），
  // 必須確認該評量確實支援 360，否則一律退回第一個支援 360 的評量，避免對不支援 360 的
  // 評量誤發起評測他人的流程。
  const activeId = (selectedId && supported.some((a) => a.id === selectedId))
    ? selectedId
    : supported[0]?.id ?? null;
  const myGroupForActive = myGroups.find((g) => g.assessmentId === activeId);

  // 已對哪些（受評者、關係）組合提交過評測（自己身為評分者）
  const ratedSet = useMemo(() => {
    const set = new Set();
    mySubs.forEach((s) => {
      if ((s.assessmentId ?? 'ai-competency') !== activeId) return;
      if ((s.raterType ?? 'self') === 'self') return;
      set.add(`${s.rateeId}:${s.raterType}`);
    });
    return set;
  }, [mySubs, activeId]);

  if (loading) return <p className="py-20 text-center text-slate-400">載入中…</p>;

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!supported.length) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-2xl bg-white px-6 py-12 shadow-lg shadow-slate-200/60">
          <UserPlus className="mx-auto h-12 w-12 text-brand-300" />
          <h2 className="mt-4 text-xl font-bold text-slate-800">目前沒有支援 360° 的評量</h2>
          <p className="mt-2 text-slate-500">此功能需搭配支援 360° 多元評測的題庫（如經贏®領導力九大構面行為評量）。</p>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h2 className="text-2xl font-extrabold text-slate-800">360° 評測</h2>
        <p className="mt-1 text-sm text-slate-500">
          除了自己填答，也可以評測您的主管、同儕或部屬，並在下方查看整合多方回饋的分析報告。
        </p>
      </header>

      {supported.length > 1 && (
        <div role="tablist" aria-label="選擇評量" className="mb-5 flex flex-wrap gap-2">
          {supported.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={activeId === a.id}
              onClick={() => setSelectedId(a.id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                activeId === a.id
                  ? 'bg-brand-600 text-white'
                  : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}

      {/* 評測他人 */}
      <section className="mb-6 rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7">
        <h3 className="mb-1 text-base font-bold text-slate-700">評測他人</h3>
        <p className="mb-4 text-xs text-slate-400">選擇一位同班成員與您的角色關係，開始為對方評測</p>

        {members.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-4 py-3 text-center text-sm text-slate-500">
            目前尚未加入任何班別，沒有可以評測的成員。
          </p>
        ) : (
          <div className="space-y-3">
            {members.map((m) => (
              <div key={m.id} className="rounded-xl border border-slate-200 px-4 py-3">
                <p className="mb-2 font-semibold text-slate-800">{m.name}</p>
                <div className="flex flex-wrap gap-2">
                  {OTHER_RATER_TYPES.map((t) => {
                    const done = ratedSet.has(`${m.id}:${t}`);
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={done}
                        onClick={() => onRateOthers(activeId, m.id, t)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                          done
                            ? 'cursor-not-allowed bg-emerald-50 text-emerald-600'
                            : 'border border-slate-300 text-slate-600 hover:border-brand-400 hover:text-brand-700'
                        }`}
                      >
                        {done && <CheckCircle2 className="h-3.5 w-3.5" />}
                        {RATER_LABELS[t]}{done ? '已完成' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 360° 多元視角分析 */}
      <section>
        <h3 className="mb-3 text-base font-bold text-slate-700">360° 多元視角分析</h3>
        {myGroupForActive && myGroupForActive.phase !== 'published' ? (
          <div className="rounded-2xl bg-white px-6 py-12 text-center shadow-lg shadow-slate-200/60">
            {myGroupForActive.phase === 'closed' ? (
              <>
                <Search className="mx-auto h-10 w-10 text-brand-300" />
                <p className="mt-4 text-lg font-bold text-slate-700">教練審閱中</p>
                <p className="mt-2 text-sm text-slate-500">
                  評測已結束，教練正在審閱整體成果。發佈後即可查看 360° 多元視角報告。
                </p>
              </>
            ) : myGroupForActive.phase === 'in_progress' ? (
              <>
                <PenLine className="mx-auto h-10 w-10 text-brand-300" />
                <p className="mt-4 text-lg font-bold text-slate-700">評測進行中</p>
                <p className="mt-2 text-sm text-slate-500">
                  評測尚未結束，360° 多元視角報告將於教練發佈後開放。
                </p>
              </>
            ) : (
              <>
                <CalendarClock className="mx-auto h-10 w-10 text-brand-300" />
                <p className="mt-4 text-lg font-bold text-slate-700">評測尚未開始</p>
                <p className="mt-2 text-sm text-slate-500">評測開始後方可查看 360° 多元視角報告。</p>
              </>
            )}
          </div>
        ) : (
          <MultiRaterDashboard rateeId={user.id} rateeName={user.name} assessmentId={activeId} />
        )}
      </section>
    </main>
  );
}
