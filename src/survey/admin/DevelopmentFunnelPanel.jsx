import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { api } from '../api/client';

const pct = (n, d) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—');

/**
 * 發展閉環漏斗（Sprint 20）：只有彙總數字，沒有任何個人內容。回答「看完報告之後，有多少人真的
 * 訂了目標、動手做、持續記錄、回來複測」，用來判斷發展功能有沒有用、哪一步流失最多。
 */
export default function DevelopmentFunnelPanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [retention, setRetention] = useState(null);

  useEffect(() => {
    let active = true;
    // 附加面板：任何失敗（含 API 不存在）都只影響自己，不能讓整個統計頁壞掉。
    Promise.resolve().then(() => api.adminDevelopmentFunnel())
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message || '載入失敗'));
    Promise.resolve().then(() => api.adminRetention()).then((r) => active && setRetention(r.groups)).catch(() => {});
    return () => { active = false; };
  }, []);

  if (error) return <p className="mt-6 text-sm text-red-500">{error}</p>;
  if (!data) return null;

  const steps = [
    ['完成過評測的人', data.assessedUsers, data.assessedUsers],
    ['訂了發展目標的人', data.usersWithGoal, data.assessedUsers],
    ['目標總數', data.goals, null],
    ['其中有行動被完成', data.goalsWithDoneAction, data.goals],
    ['其中有追蹤紀錄', data.goalsWithCheckin, data.goals],
    ['其中在檢視日前後一週內複測', data.goalsRetestedInTime, data.goals],
    ['其中已標記達成', data.goalsAchieved, data.goals],
  ];

  return (
    <section aria-label="發展閉環漏斗" className="mt-8 rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7">
      <h3 className="mb-1 flex items-center gap-1.5 text-base font-bold text-slate-700">
        <Target className="h-4 w-4 text-brass-500" /> 發展閉環漏斗
      </h3>
      <p className="mb-4 text-xs text-slate-400">只有彙總數字，看不到任何人的目標內容。目標預設私密，學員可以選擇把個別目標分享給教練。</p>
      <table className="w-full text-sm">
        <tbody>
          {steps.map(([label, n, base]) => (
            <tr key={label} className="border-t border-slate-100">
              <th scope="row" className="py-2 text-left font-normal text-slate-600">{label}</th>
              <td className="py-2 text-right font-semibold text-slate-700">{n}</td>
              <td className="w-16 py-2 text-right text-xs text-slate-400">{base == null ? '' : pct(n, base)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {retention && retention.length > 0 && (
        <div className="mt-5">
          <h4 className="mb-1 text-sm font-bold text-slate-700">報告後回訪比例（各班）</h4>
          <p className="mb-2 text-xs text-slate-400">成員最新一次自評之後 7／30 天內，至少有一天回來登入的比例。只記「哪一天有來」，不記看了什麼；視窗還沒走完或符合人數少於 3 位時顯示「—」。</p>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-400"><th className="py-1 font-normal">班級</th><th className="py-1 text-right font-normal">7 天</th><th className="py-1 text-right font-normal">30 天</th></tr></thead>
            <tbody>
              {retention.map((g) => (
                <tr key={g.id} className="border-t border-slate-100">
                  <th scope="row" className="py-1.5 text-left font-normal text-slate-600">{g.name}</th>
                  {[g.d7, g.d30].map((r, i) => (
                    <td key={i} className="py-1.5 text-right font-semibold text-slate-700">{r.hidden ? '—' : `${r.rate}%（${r.returned}/${r.eligible}）`}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-400">
        分享給教練的目標 {data.goalsShared} 個；曾延後檢視日的目標 {data.goalsSnoozed} 個。
      </p>
    </section>
  );
}
