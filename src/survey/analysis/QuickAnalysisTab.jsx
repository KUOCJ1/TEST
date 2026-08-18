import { useEffect, useMemo, useState } from 'react';
import { FileText, X, Eye } from 'lucide-react';
import { api } from '../api/client';
import { getAssessment } from '../data/assessments/index.js';
import { aggregateStats, latestPerUser, computePercentile } from '../utils/analytics';
import RadarChart from '../components/RadarChart';
import GroupNarrativeReport from '../components/GroupNarrativeReport';
import ResultPanel from '../components/ResultPanel';
import PrintableReport from '../components/PrintableReport';
import GroupPrintableReport from '../components/GroupPrintableReport';
import PhaseBadge from '../components/PhaseBadge';
import { CoachCommentPanel, GroupCommentPanel } from '../components/CoachCommentPanel';

export default function QuickAnalysisTab({ users }) {
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [groupDetail, setGroupDetail] = useState(null); // { group, submissions }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [showGroupReport, setShowGroupReport] = useState(false);
  const [showMemberReport, setShowMemberReport] = useState(false);

  useEffect(() => {
    api.coachGroups().then(setGroups).catch(() => {});
  }, []);

  const loadGroup = async (id) => {
    setSelectedGroupId(id);
    setSelectedMemberId(null);
    setError('');
    setLoading(true);
    try {
      const detail = await api.getGroup(id);
      setGroupDetail(detail);
    } catch (e) {
      setError(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  };

  const config = groupDetail ? getAssessment(groupDetail.group.assessmentId) : null;

  const memberRows = useMemo(() => {
    if (!groupDetail || !config) return [];
    const latest = latestPerUser(groupDetail.submissions);
    return latest
      .map((s) => {
        const u = users.find((x) => x.id === s.userId);
        return {
          submission: s,
          userId: s.userId,
          name: u?.name ?? s.userName ?? '（已移除）',
          email: u?.email ?? '—',
          total: s.result.total,
          percent: s.result.percent,
          level: s.result.level,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [groupDetail, config, users]);

  const groupStats = useMemo(() => {
    if (!groupDetail || !config) return null;
    return aggregateStats(groupDetail.submissions, config);
  }, [groupDetail, config]);

  const groupBenchmark = useMemo(() => {
    if (!groupStats) return null;
    return { ...groupStats, totals: memberRows.map((r) => r.total), count: groupStats.respondents };
  }, [groupStats, memberRows]);

  const strongestWeakest = useMemo(() => {
    if (!groupStats?.dimensionAverages?.length) return null;
    const sorted = [...groupStats.dimensionAverages].sort((a, b) => b.percent - a.percent);
    return { strongest: sorted[0], weakest: sorted[sorted.length - 1] };
  }, [groupStats]);

  const selectedMember = memberRows.find((r) => r.userId === selectedMemberId) ?? null;
  const selectedMemberPercentile = selectedMember && groupBenchmark?.totals?.length >= 2
    ? computePercentile(selectedMember.total, groupBenchmark.totals)
    : null;

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      {/* Left: group list */}
      <div className="lg:col-span-2">
        <h3 className="mb-3 font-semibold text-slate-700">選擇班別</h3>

        {error && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {groups.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-400">尚無班別可供分析</p>
        )}

        <div className="space-y-2">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => loadGroup(g.id)}
              className={`block w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                selectedGroupId === g.id
                  ? 'border-brass-400 bg-brass-50'
                  : 'border-slate-200 bg-white hover:border-brass-200'
              }`}
            >
              <p className="font-semibold text-slate-800">{g.name}</p>
              {g.companyName && <p className="text-xs text-slate-400">{g.companyName}</p>}
              <p className="mt-0.5 text-xs text-slate-400">
                {getAssessment(g.assessmentId)?.NAME ?? g.assessmentId} · {g.memberIds.length} 人
              </p>
              <div className="mt-1.5">
                <PhaseBadge phase={g.phase} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: analysis */}
      <div className="lg:col-span-3">
        {loading && (
          <div className="flex items-center justify-center py-20 text-slate-400">載入中…</div>
        )}

        {!loading && !groupDetail && (
          <div className="flex items-center justify-center py-20 text-slate-400">
            選擇左側班別以查看快速分析
          </div>
        )}

        {!loading && groupDetail && !config && (
          <div className="flex items-center justify-center py-20 text-slate-400">
            找不到此班別對應的評量設定，無法產生分析。
          </div>
        )}

        {!loading && groupDetail && config && groupStats && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-700">{groupDetail.group.name} · 快速分析</h3>
                <p className="text-xs text-slate-400">{config.NAME}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowGroupReport(true)}
                disabled={groupStats.respondents === 0}
                className="btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileText className="h-3.5 w-3.5" /> 產出班級專業分析報告
              </button>
            </div>

            {groupStats.respondents === 0 ? (
              <div className="rounded-xl bg-white px-6 py-12 text-center text-slate-400 shadow-sm ring-1 ring-slate-100">
                此班別尚無成員完成作答，待有作答資料後即可查看分析。
              </div>
            ) : (
              <>
                {/* KPI row */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: '已填答人數', value: groupStats.respondents, suffix: `/${groupDetail.group.memberIds.length}` },
                    { label: '平均總分', value: groupStats.avgTotal },
                    { label: '平均達成率', value: groupStats.avgPercent, suffix: '%' },
                  ].map((k) => (
                    <div key={k.label} className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{k.label}</p>
                      <p className="mt-1 text-2xl font-extrabold text-slate-800">
                        {k.value}
                        {k.suffix && <span className="ml-1 text-sm font-semibold text-slate-400">{k.suffix}</span>}
                      </p>
                    </div>
                  ))}
                  {strongestWeakest && (
                    <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">最強／待強化</p>
                      <p className="mt-1 text-sm font-bold text-emerald-600">{strongestWeakest.strongest.subtitle}</p>
                      <p className="text-sm font-bold text-amber-600">{strongestWeakest.weakest.subtitle}</p>
                    </div>
                  )}
                </div>

                {/* Radar */}
                <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <h4 className="mb-2 text-center font-semibold text-slate-700">班級整體能力雷達</h4>
                  <p className="mb-3 text-center text-xs text-slate-400">{groupStats.respondents} 人作答平均</p>
                  <div className="flex justify-center">
                    <RadarChart dimensions={groupStats.dimensionAverages} />
                  </div>
                </div>

                {/* Member comparison table */}
                <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <h4 className="mb-3 font-semibold text-slate-700">成員比較</h4>
                  <p className="mb-2 text-xs text-slate-400 sm:hidden">← 左右滑動可查看完整欄位</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2 pr-3 font-medium">#</th>
                          <th className="py-2 pr-3 font-medium">姓名</th>
                          <th className="py-2 pr-3 font-medium">總分</th>
                          <th className="py-2 pr-3 font-medium">達成率</th>
                          <th className="py-2 pr-3 font-medium">落點等級</th>
                          <th className="py-2 font-medium">分析</th>
                        </tr>
                      </thead>
                      <tbody>
                        {memberRows.map((r, i) => (
                          <tr key={r.userId} className="border-b border-slate-100 last:border-0">
                            <td className="py-2.5 pr-3 text-slate-400">{i + 1}</td>
                            <td className="py-2.5 pr-3 font-medium text-slate-700">{r.name}</td>
                            <td className="py-2.5 pr-3 font-semibold text-slate-700">{r.total}</td>
                            <td className="py-2.5 pr-3 text-slate-600">{r.percent}%</td>
                            <td className="py-2.5 pr-3">
                              <span
                                className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                                style={{ background: r.level.color }}
                              >
                                {r.level.badge}
                              </span>
                            </td>
                            <td className="py-2.5">
                              <button
                                type="button"
                                onClick={() => setSelectedMemberId(r.userId)}
                                className="btn-secondary btn-sm"
                              >
                                <Eye className="h-3.5 w-3.5" /> 查看
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <GroupCommentPanel group={groupDetail.group} />

                {memberRows.length >= 2 && (
                  <GroupNarrativeReport
                    results={memberRows.map((r) => r.submission.result)}
                    assessmentId={groupDetail.group.assessmentId}
                    focusDimensionIds={groupDetail.group.focusDimensionIds ?? []}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Member drill-down modal */}
      {selectedMember && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8 print:hidden"
          onClick={() => setSelectedMemberId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-2xl rounded-2xl bg-slate-50 p-5 shadow-xl sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{selectedMember.name}</h3>
                <p className="text-sm text-slate-500">{selectedMember.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowMemberReport(true)}
                  className="btn-secondary btn-sm"
                >
                  <FileText className="h-3.5 w-3.5" /> 產出個人專業報告
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMemberId(null)}
                  aria-label="關閉"
                  className="btn-icon"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <ResultPanel
              result={selectedMember.submission.result}
              percentile={selectedMemberPercentile}
              benchmarkDims={groupStats?.dimensionAverages ?? null}
              focusDimensionIds={groupDetail?.group.focusDimensionIds ?? []}
              readOnly
            />

            <CoachCommentPanel comments={selectedMember.submission.comments} />
          </div>
        </div>
      )}

      {/* Individual professional report */}
      {showMemberReport && selectedMember && (
        <PrintableReport
          result={selectedMember.submission.result}
          benchmark={groupBenchmark}
          user={{ name: selectedMember.name, email: selectedMember.email }}
          submittedAt={selectedMember.submission.createdAt}
          comments={selectedMember.submission.comments}
          onClose={() => setShowMemberReport(false)}
        />
      )}

      {/* Group professional report */}
      {showGroupReport && groupDetail && (
        <GroupPrintableReport
          group={groupDetail.group}
          submissions={groupDetail.submissions}
          users={users}
          onClose={() => setShowGroupReport(false)}
        />
      )}
    </div>
  );
}
