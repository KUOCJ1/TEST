import { useEffect, useState } from 'react';
import { api } from '../api/client';
import ResultPanel from '../components/ResultPanel';
import TrendChart from '../components/charts/TrendChart';
import { CoachCommentPanel, GroupCommentPanel } from '../components/CoachCommentPanel';
import { computePercentile } from '../utils/analytics';
import { resultSummaryText, copyToClipboard, formatDate, formatDateShort } from '../utils/format';

export default function UserDashboard({ user, initialAssessmentId, onTakeSurvey }) {
  const [subs, setSubs] = useState(null);
  const [myGroups, setMyGroups] = useState([]);
  const [benchmark, setBenchmark] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedId, setSelectedId] = useState(initialAssessmentId ?? null);

  useEffect(() => {
    let active = true;
    Promise.all([api.mySubmissions(), api.myGroups()])
      .then(([list, groups]) => {
        if (!active) return;
        setSubs(list);
        setMyGroups(groups);
        if (!selectedId && list.length > 0) {
          setSelectedId(list[0].assessmentId ?? 'ai-competency');
        }
      })
      .catch((e) => active && (setError(e.message || '載入失敗'), setSubs([])));
    return () => { active = false; };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // 載入母體基準（百分位 / Benchmark），隨選取的評量變動。
  useEffect(() => {
    if (!subs?.length) return undefined;
    const ids = [...new Set(subs.map((s) => s.assessmentId ?? 'ai-competency'))];
    const id = selectedId ?? ids[0];
    let active = true;
    api.benchmark(id)
      .then((b) => active && setBenchmark(b))
      .catch(() => active && setBenchmark(null));
    return () => { active = false; };
  }, [selectedId, subs]);

  if (subs === null && !error) return <p className="py-20 text-center text-slate-400">載入中…</p>;

  if (!subs?.length) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-2xl bg-white px-6 py-12 shadow-lg shadow-slate-200/60">
          <p className="text-5xl">📊</p>
          <h2 className="mt-4 text-xl font-bold text-slate-800">尚無評測紀錄</h2>
          <p className="mt-2 text-slate-500">完成一次評測後，這裡就會顯示您的能力落點與構面分析。</p>
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </div>
      </div>
    );
  }

  const assessmentIds = [...new Set(subs.map((s) => s.assessmentId ?? 'ai-competency'))];
  const activeId = selectedId ?? assessmentIds[0];
  const filtered = subs.filter((s) => (s.assessmentId ?? 'ai-competency') === activeId);
  const latest = filtered[0];
  const oldest = filtered[filtered.length - 1];
  const myGroupForActive = myGroups.find((g) => g.assessmentId === activeId);

  const benchmarkForActive = benchmark?.assessmentId === activeId ? benchmark : null;
  const percentile = benchmarkForActive
    ? computePercentile(latest.result.total, benchmarkForActive.totals)
    : null;

  const handleCopy = async () => {
    const ok = await copyToClipboard(resultSummaryText(latest.result));
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => window.print();

  const trendPoints = [...filtered].reverse().map((s) => ({
    label: formatDateShort(s.createdAt),
    value: s.result.total,
  }));

  const hasTrend = filtered.length > 1;
  const dimProgress = hasTrend
    ? latest.result.dimensions.map((d) => {
        const firstDim = oldest.result.dimensions.find((fd) => fd.id === d.id);
        const delta = firstDim ? d.score - firstDim.score : null;
        return { ...d, firstScore: firstDim?.score ?? null, firstMax: firstDim?.max ?? d.max, delta };
      })
    : [];

  const printDate = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* Print-only report header */}
      <div className="mb-6 hidden border-b border-slate-200 pb-4 print:block">
        <p className="text-xs text-slate-400">全方位職能評測 · 個人評測報告</p>
        <h2 className="mt-0.5 text-xl font-bold text-slate-800">{user.name}</h2>
        <p className="text-sm text-slate-500">報告列印日期：{printDate}</p>
      </div>

      {/* Screen header */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800">我的能力分析</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {user.name}，共完成 {subs.length} 次評測
          </p>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
        >
          🖨️ 下載 PDF 報告
        </button>
      </header>

      {assessmentIds.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2 print:hidden">
          {assessmentIds.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedId(id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                activeId === id
                  ? 'bg-teal-600 text-white'
                  : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {subs.find((s) => (s.assessmentId ?? 'ai-competency') === id)?.result?.assessmentName ?? id}
            </button>
          ))}
        </div>
      )}

      {latest && (
        <>
          <ResultPanel
            result={latest.result}
            onRetake={() => onTakeSurvey(activeId)}
            onCopy={handleCopy}
            copied={copied}
            percentile={percentile}
            benchmarkDims={benchmarkForActive?.dimensionAverages ?? null}
          />

          <CoachCommentPanel comments={latest.comments} />
          <GroupCommentPanel group={myGroupForActive} />

          {hasTrend && (
            <section className="mt-6 rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7 print:hidden">
              <h3 className="mb-4 text-base font-bold text-slate-700">歷次總分趨勢</h3>
              <TrendChart
                points={trendPoints}
                min={latest.result.minScore}
                max={latest.result.maxScore}
              />
            </section>
          )}

          {hasTrend && (
            <section className="mt-6 rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7 print:hidden">
              <h3 className="mb-4 text-base font-bold text-slate-700">
                構面進步追蹤
                <span className="ml-2 text-sm font-normal text-slate-400">首次 vs 最新</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-4 text-left font-medium">構面</th>
                      <th className="py-2 pr-4 text-right font-medium">首次</th>
                      <th className="py-2 pr-4 text-right font-medium">最新</th>
                      <th className="py-2 text-right font-medium">變化</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dimProgress.map((d) => (
                      <tr key={d.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2.5 pr-4">
                          <span className="font-semibold" style={{ color: d.color }}>{d.subtitle}</span>
                          <span className="ml-2 text-xs text-slate-400">{d.name}</span>
                        </td>
                        <td className="py-2.5 pr-4 text-right text-slate-500">
                          {d.firstScore}/{d.firstMax}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-semibold text-slate-700">
                          {d.score}/{d.max}
                        </td>
                        <td className="py-2.5 text-right font-bold">
                          {d.delta === null || d.delta === 0 ? (
                            <span className="text-slate-400">—</span>
                          ) : d.delta > 0 ? (
                            <span className="text-emerald-600">+{d.delta} ↑</span>
                          ) : (
                            <span className="text-red-500">{d.delta} ↓</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="mt-6 rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7 print:hidden">
            <h3 className="mb-3 text-base font-bold text-slate-700">作答紀錄</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-medium">時間</th>
                    <th className="py-2 pr-3 font-medium">總分</th>
                    <th className="py-2 pr-3 font-medium">達成率</th>
                    <th className="py-2 font-medium">落點等級</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-3 text-slate-600">{formatDate(s.createdAt)}</td>
                      <td className="py-2.5 pr-3 font-semibold text-slate-700">{s.result.total}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{s.result.percent}%</td>
                      <td className="py-2.5">
                        <span
                          className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                          style={{ background: s.result.level.color }}
                        >
                          {s.result.level.badge}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
