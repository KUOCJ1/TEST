import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, FileText, Users, AlertCircle } from 'lucide-react';
import { api } from '../api/client';
import { getAssessment } from '../data/assessments/index.js';
import ResultPanel from '../components/ResultPanel';
import PrintableReport from '../components/PrintableReport';
import TrendChart from '../components/charts/TrendChart';
import JourneyTimeline from '../components/JourneyTimeline';
import GoalPanel from '../components/GoalPanel';
import { CoachCommentPanel, GroupCommentPanel } from '../components/CoachCommentPanel';
import { computePercentile } from '../utils/analytics';
import { buildJourneyNarrative } from '../utils/narrative';
import { resultSummaryText, copyToClipboard, formatDateShort } from '../utils/format';
import InfoTip from '../components/InfoTip';
import LoadingState from '../components/LoadingState';

export default function UserDashboard({ user, initialAssessmentId, onTakeSurvey, onResultLoad }) {
  const navigate = useNavigate();
  const [subs, setSubs] = useState(null);
  const [myGroups, setMyGroups] = useState([]);
  const [benchmark, setBenchmark] = useState(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedId, setSelectedId] = useState(initialAssessmentId ?? null);
  const [showReport, setShowReport] = useState(false);
  const [viewingSubId, setViewingSubId] = useState(null);
  const benchmarkCache = useRef({});
  const [retryKey, setRetryKey] = useState(0);
  const loadData = useCallback(() => { setError(''); setRetryKey((k) => k + 1); }, []);

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
      .catch((e) => active && setError(e.message || '載入失敗'));
    return () => { active = false; };
  }, [retryKey]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Notify parent of the currently displayed result for ChatBot context.
  useEffect(() => {
    if (!subs?.length || !onResultLoad) return;
    const activeId = selectedId ?? [...new Set(subs.map((s) => s.assessmentId ?? 'ai-competency'))][0];
    const latest = subs.filter((s) => (s.assessmentId ?? 'ai-competency') === activeId)[0];
    if (latest?.result) onResultLoad(latest.result);
  }, [subs, selectedId, onResultLoad]);

  // Benchmark fetch with in-memory cache per assessment id.
  useEffect(() => {
    if (!subs?.length) return undefined;
    const ids = [...new Set(subs.map((s) => s.assessmentId ?? 'ai-competency'))];
    const id = selectedId ?? ids[0];
    if (!id) return undefined;
    if (benchmarkCache.current[id]) {
      setBenchmark(benchmarkCache.current[id]);
      return undefined;
    }
    let active = true;
    setBenchmarkLoading(true);
    api.benchmark(id)
      .then((b) => {
        if (!active) return;
        benchmarkCache.current[id] = b;
        setBenchmark(b);
      })
      .catch(() => active && setBenchmark(null))
      .finally(() => active && setBenchmarkLoading(false));
    return () => { active = false; };
  }, [selectedId, subs]);

  if (subs === null && !error) return <LoadingState />;

  if (subs === null && error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-2xl bg-white px-6 py-12 shadow-lg shadow-slate-200/60">
          <AlertCircle className="mx-auto h-12 w-12 text-red-300" />
          <h2 className="mt-4 text-xl font-bold text-slate-800">載入失敗</h2>
          <p className="mt-2 text-slate-500">{error}</p>
          <button type="button" onClick={loadData} className="btn-secondary mt-4">
            重試
          </button>
        </div>
      </div>
    );
  }

  if (!subs?.length) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-2xl bg-white px-6 py-12 shadow-lg shadow-slate-200/60">
          <BarChart3 className="mx-auto h-12 w-12 text-brass-300" />
          <h2 className="mt-4 text-xl font-bold text-slate-800">尚無評測紀錄</h2>
          <p className="mt-2 text-slate-500">完成一次評測後，這裡就會顯示您的能力落點與構面分析。</p>
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

  const supports360 = !!getAssessment(activeId)?.SUPPORTS_360;

  const benchmarkForActive = benchmark?.assessmentId === activeId ? benchmark : null;
  const percentile = benchmarkForActive
    ? computePercentile(latest.result.total, benchmarkForActive.totals)
    : null;
  const isBenchmarkLoading = benchmarkLoading && !benchmarkForActive;

  const handleCopy = async () => {
    const ok = await copyToClipboard(resultSummaryText(latest.result));
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2500);
  };

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

  // 課前 / 課後追蹤：優先採用明確標記的期別，否則退回「最早 vs 最新」。
  // filtered 為新到舊排序，故由尾端往前找最早的課前作答。
  const preSub = [...filtered].reverse().find((s) => s.phase === 'pre') ?? oldest;
  const postSub = filtered.find((s) => s.phase === 'post') ?? (hasTrend ? latest : null);
  const hasGain = preSub && postSub && preSub.id !== postSub.id;
  const labelledPhase = filtered.some((s) => s.phase === 'pre' || s.phase === 'post');
  const gain = hasGain
    ? {
        total: postSub.result.total - preSub.result.total,
        dims: postSub.result.dimensions
          .map((d) => {
            const pre = preSub.result.dimensions.find((p) => p.id === d.id);
            return { id: d.id, subtitle: d.subtitle, color: d.color, delta: pre ? d.score - pre.score : 0 };
          })
          .sort((a, b) => b.delta - a.delta),
      }
    : null;
  const topGain = gain?.dims?.[0] ?? null;

  const journeyNarrative = buildJourneyNarrative(filtered);

  // 歷史紀錄可點開：預設看最新一筆，但點時間軸上任一節點就改看那一筆（S-03）。
  const viewingSub = viewingSubId ? filtered.find((s) => s.id === viewingSubId) : null;
  const reportSub = viewingSub ?? (showReport ? latest : null);
  const closeReport = () => { setShowReport(false); setViewingSubId(null); };

  return (
    <>
    {reportSub && (
      <PrintableReport
        result={reportSub.result}
        benchmark={benchmarkForActive}
        user={user}
        submittedAt={reportSub.createdAt}
        comments={reportSub.comments}
        onClose={closeReport}
      />
    )}
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">

      {/* Screen header */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800">我的能力分析</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {user.name}，共完成 {subs.length} 次評測
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* 三種報告（個人分析／360°／PDF）互不相通，這裡先接上到 360° 的路
              （S-02），PDF 匯出維持原樣。 */}
          {supports360 && (
            <button
              type="button"
              onClick={() => navigate(`/360/${activeId}`)}
              className="btn-secondary"
            >
              <Users className="h-4 w-4" /> 前往 360° 評測
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowReport(true)}
            className="btn-secondary"
          >
            <FileText className="h-4 w-4" /> 產出 PDF 報告
          </button>
        </div>
      </header>

      {assessmentIds.length > 1 && (
        <div role="tablist" aria-label="選擇評量" className="mb-5 flex flex-wrap gap-2 print:hidden">
          {assessmentIds.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeId === id}
              onClick={() => setSelectedId(id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                activeId === id
                  ? 'bg-ink-700 text-white'
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
          {isBenchmarkLoading && (
            <p className="mb-3 text-center text-xs text-slate-400">正在載入母體基準…</p>
          )}
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

          <JourneyTimeline narrative={journeyNarrative} submissions={filtered} onSelect={setViewingSubId} />

          <GoalPanel assessmentId={activeId} weakestDimension={latest.result.weakest} />

          {gain && (
            <section className="mt-6 rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7">
              <h3 className="mb-1 flex items-center text-base font-bold text-slate-700">
                學習增益
                <InfoTip text="第一次作答為「課前」基準，最新一次為「課後」，兩者相減即為學習成長幅度。可多次重測持續追蹤。" />
              </h3>
              <p className="mb-4 text-xs text-slate-400">
                {labelledPhase ? '課前評測' : '首次'} → {labelledPhase ? '課後複測' : '最新'}
                （{formatDateShort(preSub.createdAt)} → {formatDateShort(postSub.createdAt)}）
              </p>
              <div className="flex flex-wrap items-stretch gap-3">
                <div className="flex-1 rounded-xl bg-slate-50 px-4 py-3 text-center">
                  <p className="text-xs text-slate-400">課前總分</p>
                  <p className="mt-0.5 text-2xl font-extrabold text-slate-700">{preSub.result.total}</p>
                </div>
                <div className="flex items-center text-xl font-bold text-slate-300">→</div>
                <div className="flex-1 rounded-xl bg-slate-50 px-4 py-3 text-center">
                  <p className="text-xs text-slate-400">課後總分</p>
                  <p className="mt-0.5 text-2xl font-extrabold text-slate-700">{postSub.result.total}</p>
                </div>
                <div
                  className={`flex-1 rounded-xl px-4 py-3 text-center ${
                    gain.total > 0 ? 'bg-emerald-50' : gain.total < 0 ? 'bg-red-50' : 'bg-slate-50'
                  }`}
                >
                  <p className="text-xs text-slate-400">整體增益</p>
                  <p
                    className={`mt-0.5 text-2xl font-extrabold ${
                      gain.total > 0 ? 'text-emerald-600' : gain.total < 0 ? 'text-red-500' : 'text-slate-500'
                    }`}
                  >
                    {gain.total > 0 ? `+${gain.total}` : gain.total}
                  </p>
                </div>
              </div>
              {topGain && topGain.delta > 0 && (
                <p className="mt-4 text-sm text-slate-500">
                  進步最多的構面是
                  <span className="mx-1 font-bold" style={{ color: topGain.color }}>{topGain.subtitle}</span>
                  （+{topGain.delta} 分），持續保持！
                </p>
              )}
            </section>
          )}

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
        </>
      )}
    </main>
    </>
  );
}
