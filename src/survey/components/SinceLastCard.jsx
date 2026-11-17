import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { buildGrowthEvents, summarizeSince } from '../utils/growthTimeline';
import { formatDate } from '../utils/format';

/**
 * 複測前的「回頭看這段時間」（Sprint 43）：只在本人已有前一次自評、且這次是課後複測時出現。
 * 全是本人自己的資料；沒有紀錄也不責備，提醒憑印象作答即可。載入失敗就不顯示。
 */
export default function SinceLastCard({ assessmentId, enabled }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    Promise.all([
      api.mySubmissions().catch(() => []),
      api.myGoals?.().catch(() => []),
      api.myPractice?.().catch(() => null),
      api.myReflections?.().catch(() => []),
    ]).then(([subs, goals, practice, sessions]) => {
      if (!active) return;
      const mine = (subs ?? []).filter((s) => (s.raterType ?? 'self') === 'self' && (s.assessmentId ?? 'ai-competency') === assessmentId);
      if (mine.length === 0) return;
      const since = mine.map((s) => s.createdAt).sort().at(-1);
      const events = buildGrowthEvents({ goals: goals ?? [], practice: practice ?? null, sessions: sessions ?? [], assessmentId });
      setData({ since, summary: summarizeSince(events, since) });
    });
    return () => { active = false; };
  }, [assessmentId, enabled]);

  if (!enabled || !data) return null;
  const { since, summary } = data;
  return (
    <section data-testid="since-last" className="mt-4 rounded-xl border border-brass-200 bg-brass-50 px-4 py-3 text-sm text-slate-700">
      <h3 className="font-semibold text-slate-800">作答前，先回頭看這段時間</h3>
      {summary.total > 0 ? (
        <>
          <p className="mt-1">自從 {formatDate(since)} 上次評測，你{summary.parts.join('、')}。</p>
          {summary.latest && <p className="mt-1 text-xs text-slate-500">最近一件：{summary.latest.title}{summary.latest.detail ? `（${summary.latest.detail}）` : ''}</p>}
          <p className="mt-1 text-xs text-slate-500">作答時想想：這些事讓你的做法有什麼不一樣？</p>
        </>
      ) : (
        <p className="mt-1">自從 {formatDate(since)} 上次評測，還沒有留下紀錄也沒關係，憑你這段時間的實際做法如實作答就好。</p>
      )}
    </section>
  );
}
