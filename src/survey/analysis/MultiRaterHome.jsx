import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, PenLine, CalendarClock, UserPlus, CheckCircle2, ChartColumn } from 'lucide-react';
import { api } from '../api/client';
import { getAssessment } from '../data/assessments/index.js';
import MultiRaterDashboard from './MultiRaterDashboard';
import { RATER_LABELS } from '../constants/raterTypes';
import { resolveActiveAssessmentId } from '../utils/multiRaterHome';
import LoadingState from '../components/LoadingState';
import ManagerShareToggle from '../components/compass/ManagerShareToggle.jsx';
import RaterInvitePanel, { InvitationsToRate } from '../components/compass/RaterInvitePanel.jsx';

const OTHER_RATER_TYPES = ['manager', 'peer', 'subordinate'];

export default function MultiRaterHome({ user, initialAssessmentId, onRateOthers }) {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState([]);
  const [members, setMembers] = useState([]);
  const [mySubs, setMySubs] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [selectedId, setSelectedId] = useState(initialAssessmentId ?? null);
  const [dashboardKey, setDashboardKey] = useState(0);
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

  const activeId = resolveActiveAssessmentId(selectedId, supported);
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

  if (loading) return <LoadingState />;

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
          <UserPlus className="mx-auto h-12 w-12 text-brass-300" />
          <h2 className="mt-4 text-xl font-bold text-slate-800">目前沒有支援 360° 的評量</h2>
          <p className="mt-2 text-slate-500">此功能需搭配支援 360° 多元評測的題庫（如經贏®領導力九大構面行為評量），請洽詢您的教練或平台管理者。</p>
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
        <p className="mt-2 text-sm text-slate-500">
          360° 是請別人也回答同一份評量，讓您看見「自己眼中的自己」和「別人眼中的您」有什麼落差。
          評分對象限定為<strong className="text-slate-700">同一個班級</strong>的成員。
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
                  ? 'bg-ink-700 text-white'
                  : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}

      {/* 嚴格隱私題庫（領導力羅盤）：他評須先被邀請；一邊邀請別人評我，一邊處理收到的邀請 */}
      {getAssessment(activeId)?.STRICT_RATER_PRIVACY && (
        <>
          <section className="mb-6 rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7">
            <h3 className="mb-1 text-base font-bold text-slate-700">邀請別人評我</h3>
            <p className="mb-4 text-xs text-slate-400">
              從同班成員中挑選評分者並說明對方是你的主管、同儕或部屬。每位評分者只會收到一次邀請，你看不到對方填了什麼。
            </p>
            <RaterInvitePanel assessmentId={activeId} members={members} />
          </section>
          <section className="mb-6 rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7">
            <h3 className="mb-1 text-base font-bold text-slate-700">等你評測的人</h3>
            <p className="mb-4 text-xs text-slate-400">別人邀請你評測他們時會出現在這裡，身分（主管／同儕／部屬）由邀請決定。</p>
            <InvitationsToRate assessmentId={activeId} onRate={(rateeId, t, name) => onRateOthers(activeId, rateeId, t, name)} />
          </section>
        </>
      )}

      {/* 評測他人 */}
      {!getAssessment(activeId)?.STRICT_RATER_PRIVACY && (
      <section className="mb-6 rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7">
        <h3 className="mb-1 text-base font-bold text-slate-700">評測他人</h3>
        <p className="mb-4 text-xs text-slate-400">選擇一位同班成員與您的角色關係，開始為對方評測</p>

        {members.length === 0 ? (
          <div className="rounded-lg bg-slate-50 px-4 py-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-700">您目前還沒有可以評測的對象</p>
            <p className="mt-1">因為您尚未加入任何班級（或班上還沒有其他成員）。加入班級的方式：</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>向您的教練索取班級的<strong>報到 QR Code 或連結</strong>，掃描後登入即自動加入；</li>
              <li>或請教練／平台管理者直接把您的 Email 加入班級。</li>
            </ol>
            <p className="mt-2 text-slate-500">在那之前，您仍然可以自己作答並查看分析。</p>
          </div>
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
                        onClick={() => onRateOthers(activeId, m.id, t, m.name)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                          done
                            ? 'cursor-not-allowed bg-emerald-50 text-emerald-600'
                            : 'border border-slate-300 text-slate-600 hover:border-brass-400 hover:text-brass-600'
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
      )}

      {/* 360° 多元視角分析 */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-slate-700">360° 多元視角分析</h3>
          {/* 360° 報告原本是座孤島，沒有回個人分析的路（S-02），這裡補上。 */}
          <button
            type="button"
            onClick={() => navigate(`/analysis/${activeId}`)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brass-600 hover:text-brass-700 hover:underline"
          >
            <ChartColumn className="h-3.5 w-3.5" /> 查看我的個人分析報告
          </button>
        </div>
        {myGroupForActive && myGroupForActive.phase !== 'published' ? (
          <div className="rounded-2xl bg-white px-6 py-12 text-center shadow-lg shadow-slate-200/60">
            {myGroupForActive.phase === 'closed' ? (
              <>
                <Search className="mx-auto h-10 w-10 text-brass-300" />
                <p className="mt-4 text-lg font-bold text-slate-700">教練審閱中</p>
                <p className="mt-2 text-sm text-slate-500">
                  評測已結束，教練正在審閱整體成果。發佈後即可查看 360° 多元視角報告。
                </p>
              </>
            ) : myGroupForActive.phase === 'in_progress' ? (
              <>
                <PenLine className="mx-auto h-10 w-10 text-brass-300" />
                <p className="mt-4 text-lg font-bold text-slate-700">評測進行中</p>
                <p className="mt-2 text-sm text-slate-500">
                  評測尚未結束，360° 多元視角報告將於教練發佈後開放。
                </p>
              </>
            ) : (
              <>
                <CalendarClock className="mx-auto h-10 w-10 text-brass-300" />
                <p className="mt-4 text-lg font-bold text-slate-700">評測尚未開始</p>
                <p className="mt-2 text-sm text-slate-500">評測開始後方可查看 360° 多元視角報告。</p>
              </>
            )}
          </div>
        ) : (
          <>
            {getAssessment(activeId)?.STRICT_RATER_PRIVACY && (
              <>
                <p className="mb-3 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  建議邀請的評分者：同儕 2–3 位、部屬 2–3 位，另有上級 1–2 位，合計約 10 位（含自評）。
                  為保護匿名，同一類評分者達 3 位才會單獨顯示，不足時併入「他評合計」，合計也要 3 位以上才會顯示。
                </p>
                <ManagerShareToggle user={user} onChanged={() => setDashboardKey((k) => k + 1)} />
              </>
            )}
            <MultiRaterDashboard key={dashboardKey} rateeId={user.id} rateeName={user.name} assessmentId={activeId} />
          </>
        )}
      </section>
    </main>
  );
}
