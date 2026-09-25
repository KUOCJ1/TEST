import { useState } from 'react';
import { Scale, X } from 'lucide-react';
import { api } from '../api/client';
import { getAssessment } from '../data/assessments/index.js';
import { aggregateStats } from '../utils/analytics';
import RadarChart from '../components/RadarChart';
import LevelDistribution from '../components/charts/LevelDistribution';

/**
 * 比較兩個梯次（Sprint 4 驗收條件 4.6）：只能選同一套題庫的兩個班級——不同
 * 題庫的構面完全不同，疊在同一張雷達圖上比較沒有意義。
 */
export default function CohortCompare({ groups, onClose }) {
  const [assessmentId, setAssessmentId] = useState(groups[0]?.assessmentId ?? '');
  const [groupAId, setGroupAId] = useState('');
  const [groupBId, setGroupBId] = useState('');
  const [result, setResult] = useState(null); // { a: {group, stats}, b: {...} }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const candidateGroups = groups.filter((g) => g.assessmentId === assessmentId);
  const config = getAssessment(assessmentId);

  const handleCompare = async () => {
    if (!groupAId || !groupBId || groupAId === groupBId) {
      setError('請選擇兩個不同的班級');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [{ group: groupA, submissions: subsA }, { group: groupB, submissions: subsB }] = await Promise.all([
        api.getGroup(groupAId),
        api.getGroup(groupBId),
      ]);
      setResult({
        a: { group: groupA, stats: aggregateStats(subsA, config) },
        b: { group: groupB, stats: aggregateStats(subsB, config) },
      });
    } catch (e) {
      setError(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="比較梯次"
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-lg font-bold text-slate-800">
            <Scale className="h-5 w-5 text-brass-500" /> 比較梯次
          </h3>
          <button type="button" onClick={onClose} aria-label="關閉" className="btn-icon">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500" htmlFor="cohort-assessment">題庫</label>
            <select
              id="cohort-assessment"
              value={assessmentId}
              onChange={(e) => { setAssessmentId(e.target.value); setGroupAId(''); setGroupBId(''); setResult(null); }}
              className="input"
            >
              {[...new Set(groups.map((g) => g.assessmentId))].map((id) => (
                <option key={id} value={id}>{getAssessment(id)?.NAME ?? id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500" htmlFor="cohort-a">梯次 A</label>
            <select id="cohort-a" value={groupAId} onChange={(e) => setGroupAId(e.target.value)} className="input">
              <option value="">選擇班級</option>
              {candidateGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500" htmlFor="cohort-b">梯次 B</label>
            <select id="cohort-b" value={groupBId} onChange={(e) => setGroupBId(e.target.value)} className="input">
              <option value="">選擇班級</option>
              {candidateGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>

        {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <button type="button" onClick={handleCompare} disabled={loading} className="btn-primary btn-sm mb-5">
          {loading ? '載入中…' : '開始比較'}
        </button>

        {result && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {[result.a, result.b].map(({ group, stats }) => (
                <div key={group.id} className="rounded-xl bg-slate-50 px-4 py-3 text-center">
                  <p className="font-semibold text-slate-700">{group.name}</p>
                  <p className="text-xs text-slate-400">{stats.respondents} 人作答</p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-800">
                    {stats.avgTotal}
                    <span className="ml-1 text-sm font-normal text-slate-400">平均總分</span>
                  </p>
                </div>
              ))}
            </div>

            <div className="flex justify-center">
              <RadarChart
                dimensions={result.a.stats.dimensionAverages}
                compare={result.b.stats.dimensionAverages}
                compareLabel={result.b.group.name}
              />
            </div>
            <p className="text-center text-xs text-slate-400">
              實線：{result.a.group.name} ・ 虛線：{result.b.group.name}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {[result.a, result.b].map(({ group, stats }) => (
                <div key={group.id}>
                  <p className="mb-2 text-center text-xs font-semibold text-slate-500">{group.name} 落點分布</p>
                  <LevelDistribution distribution={stats.levelDistribution} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
