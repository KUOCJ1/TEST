import { useState } from 'react';
import { Eye, Plus, X } from 'lucide-react';
import { api } from '../api/client';
import RadarChart from '../components/RadarChart';
import DimensionHeatmap from '../components/DimensionHeatmap';
import GroupNarrativeReport from '../components/GroupNarrativeReport';
import GroupGainReport from './GroupGainReport';
import ProgressPanel from './ProgressPanel';

// 「總覽」分頁內容：KPI 卡、班級雷達圖、能力熱力圖、成員比較表、班級敘事報告、
// 學習成效面板、班級整體評語表單。從 GroupWorkspace 拆出（Sprint 5.6）——
// 班級整體評語的編輯狀態（groupComment/groupTips）只有這裡用得到，故整段隨表單
// 一起搬過來；父層在切換班別時用 key={group.id} 讓這裡的表單狀態自動重置，
// 沿用本檔案原本 GroupTimelineCard／QrCodeCard 已經在用的作法。
export default function GroupOverviewSection({
  group, directory, groupStats, memberRows, strongestWeakest, commentedCount,
  submissions, onGroupUpdated, showToast, confirm, onOpenMember,
}) {
  const [groupComment, setGroupComment] = useState(group.groupComment ?? '');
  const [groupTips, setGroupTips] = useState(group.groupTips?.length ? group.groupTips : ['']);
  const [savingComment, setSavingComment] = useState(false);
  const [commentError, setCommentError] = useState('');

  const handleSaveComment = async () => {
    setSavingComment(true);
    setCommentError('');
    try {
      const updated = await api.updateGroup(group.id, {
        groupComment: groupComment.trim(),
        groupTips: groupTips.filter((t) => t.trim()),
      });
      onGroupUpdated(updated);
      showToast('已儲存評語與建議');
    } catch (e) {
      setCommentError(e.message || '儲存失敗');
    } finally {
      setSavingComment(false);
    }
  };

  return (
    <div className="space-y-5">
      <ProgressPanel
        group={group}
        members={directory}
        submissions={submissions}
        onGroupUpdated={onGroupUpdated}
        showToast={showToast}
        confirm={confirm}
      />

      {groupStats && groupStats.respondents === 0 ? (
        <div className="rounded-xl bg-white px-6 py-12 text-center text-slate-400 shadow-sm ring-1 ring-slate-100">
          此班別尚無成員完成作答，待有作答資料後即可查看分析。
        </div>
      ) : groupStats && (
        <>
          {/* KPI row：完成度是主數字，其餘為支撐數字，避免四格全部等重。
              panel-primary 讓這一列在視覺上明確比下面的圖表／表格更重。 */}
          <div className="panel-primary">
            <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">已填答</p>
                <p className="mt-1 text-3xl font-extrabold text-slate-800">
                  {groupStats.respondents}
                  <span className="ml-1 text-base font-semibold text-slate-400">/{group.memberIds.length} 人</span>
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">已寫評語</p>
                <p className="mt-1 text-3xl font-extrabold text-brass-600">
                  {commentedCount}
                  <span className="ml-1 text-base font-semibold text-slate-400">/{memberRows.length} 人</span>
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">平均總分</p>
                <p className="mt-1 text-xl font-bold text-slate-700">{groupStats.avgTotal}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">平均達成率</p>
                <p className="mt-1 text-xl font-bold text-slate-700">{groupStats.avgPercent}%</p>
              </div>
              {strongestWeakest && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">最強／待強化</p>
                  <p className="mt-1 text-sm font-bold text-emerald-600">{strongestWeakest.strongest.subtitle}</p>
                  <p className="text-sm font-bold text-amber-600">{strongestWeakest.weakest.subtitle}</p>
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <h4 className="mb-2 text-center font-semibold text-slate-700">班級整體能力雷達</h4>
            <p className="mb-3 text-center text-xs text-slate-400">{groupStats.respondents} 人作答平均</p>
            <div className="flex justify-center">
              <RadarChart dimensions={groupStats.dimensionAverages} />
            </div>
          </div>

          <DimensionHeatmap dimensions={groupStats.dimensionAverages} memberRows={memberRows} />

          {/* Member table：達成率加長條、總分加「與班平均差距」，純數字表格
              不容易一眼掃描的問題（V-01）。 */}
          <div className="panel">
            <h4 className="mb-3 font-semibold text-slate-700">成員比較</h4>
            <p className="mb-2 text-xs text-slate-400 sm:hidden">← 左右滑動可查看完整欄位</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-medium">#</th>
                    <th className="py-2 pr-3 font-medium">姓名</th>
                    <th className="py-2 pr-3 font-medium">總分（與班平均差距）</th>
                    <th className="py-2 pr-3 font-medium">達成率</th>
                    <th className="py-2 pr-3 font-medium">落點等級</th>
                    <th className="py-2 pr-3 font-medium">評語</th>
                    <th className="py-2 font-medium">報告</th>
                  </tr>
                </thead>
                <tbody>
                  {memberRows.map((r, i) => {
                    const diff = groupStats ? r.total - groupStats.avgTotal : null;
                    return (
                      <tr key={r.userId} className="border-b border-slate-100 last:border-0">
                        <td className="py-2.5 pr-3 text-slate-400">{i + 1}</td>
                        <td className="py-2.5 pr-3 font-medium text-slate-700">{r.name}</td>
                        <td className="py-2.5 pr-3">
                          <span className="font-semibold text-slate-700">{r.total}</span>
                          {diff != null && diff !== 0 && (
                            <span className={`ml-1.5 text-xs font-semibold ${diff > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {diff > 0 ? `▲ +${diff}` : `▽ ${diff}`}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${r.percent}%`, background: r.level.color }}
                              />
                            </div>
                            <span className="text-slate-600">{r.percent}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span
                            className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                            style={{ background: r.level.color }}
                          >
                            {r.level.badge}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          {r.hasMyComment ? (
                            <span className="text-xs font-semibold text-emerald-600">已寫</span>
                          ) : (
                            <span className="text-xs text-amber-600">未寫</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          <button type="button" onClick={() => onOpenMember(i)} className="btn-secondary btn-sm">
                            <Eye className="h-3.5 w-3.5" /> 查看
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {memberRows.length >= 2 && (
            <GroupNarrativeReport
              results={memberRows.map((r) => r.submission.result)}
              assessmentId={group.assessmentId}
              focusDimensionIds={group.focusDimensionIds ?? []}
            />
          )}
        </>
      )}

      <GroupGainReport group={group} submissions={submissions} />

      {/* 班級整體評語（教練撰寫，學員在分析頁看得到） */}
      <div className="rounded-xl border border-brass-200 bg-brass-50 p-4">
        <h3 className="mb-2 font-semibold text-brass-600">班級整體評語</h3>

        {commentError && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {commentError}
          </p>
        )}

        <textarea value={groupComment} onChange={(e) => setGroupComment(e.target.value)} rows={4}
          placeholder="針對本班整體觀察與評語…"
          className="input"
        />

        <p className="mt-3 mb-1.5 text-xs font-semibold text-brass-600 uppercase tracking-wide">班級精進建議</p>
        <div className="space-y-2">
          {groupTips.map((tip, i) => (
            <div key={i} className="flex gap-2">
              <span className="mt-2 text-xs font-bold text-brass-400">{i + 1}.</span>
              <input type="text" value={tip} onChange={(e) => setGroupTips((prev) => prev.map((t, j) => j === i ? e.target.value : t))}
                placeholder={`班級建議 ${i + 1}`}
                className="input flex-1"
              />
              {groupTips.length > 1 && (
                <button type="button" onClick={() => setGroupTips((prev) => prev.filter((_, j) => j !== i))}
                  aria-label="移除此建議"
                  className="btn-icon">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {groupTips.length < 5 && (
            <button type="button" onClick={() => setGroupTips((prev) => [...prev, ''])}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brass-600 hover:text-brass-700">
              <Plus className="h-3.5 w-3.5" /> 新增建議
            </button>
          )}
        </div>

        <button type="button" onClick={handleSaveComment} disabled={savingComment}
          className="btn-primary mt-4">
          {savingComment ? '儲存中…' : '儲存評語與建議'}
        </button>
      </div>
    </div>
  );
}
