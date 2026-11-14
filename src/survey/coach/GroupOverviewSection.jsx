import { useState } from 'react';
import { AlertTriangle, Eye, FileText, Plus, X } from 'lucide-react';
import { api } from '../api/client';
import RadarChart from '../components/RadarChart';
import DimensionHeatmap from '../components/DimensionHeatmap';
import GroupNarrativeReport from '../components/GroupNarrativeReport';
import GroupGainReport from './GroupGainReport';
import PrePostAnalysis from './PrePostAnalysis';
import ThreeSixtyReport from '../components/ThreeSixtyReport.jsx';
import { supportsPrePost } from '../utils/prePost.js';
import { getAssessment } from '../data/assessments/index.js';
import ProgressPanel from './ProgressPanel';
import SharedGoalsPanel from './SharedGoalsPanel';
import CourseSurveyPanel from './CourseSurveyPanel';
import { useIsMobile } from '../hooks/useIsMobile';
import LevelBadge from '../components/LevelBadge';
import { dimLabel } from '../utils/dimensionLabel';

// 「總覽」分頁內容：KPI 卡、班級雷達圖、能力熱力圖、成員比較表、班級敘事報告、
// 學習成效面板、班級整體評語表單。從 GroupWorkspace 拆出（Sprint 5.6）——
// 班級整體評語的編輯狀態（groupComment/groupTips）只有這裡用得到，故整段隨表單
// 一起搬過來；父層在切換班別時用 key={group.id} 讓這裡的表單狀態自動重置，
// 沿用本檔案原本 GroupTimelineCard／QrCodeCard 已經在用的作法。
function MemberCards({ memberRows, groupStats, has360, sortBy, setSortBy, onOpenMember, onReport360, config }) {
  // 排序只改顯示順序；onOpenMember 要用原本在 memberRows 的索引（抽屜靠它定位成員）。
  const items = memberRows.map((r, i) => ({ r, i }));
  if (sortBy === 'name') items.sort((a, b) => a.r.name.localeCompare(b.r.name, 'zh-Hant'));
  return (
    <div className="panel">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="font-semibold text-slate-700">成員比較</h4>
        <div role="group" aria-label="排序" className="flex gap-1 rounded-lg bg-slate-100 p-1 text-xs font-semibold">
          {[['score', '分數高→低'], ['name', '姓名']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={sortBy === id}
              onClick={() => setSortBy(id)}
              className={`rounded-md px-3 ${sortBy === id ? 'bg-white text-ink-700 shadow-sm' : 'text-slate-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <ul className="space-y-2">
        {items.map(({ r, i }) => {
          const diff = Math.round((r.total - groupStats.avgTotal) * 10) / 10;
          return (
            <li key={r.userId} className="rounded-xl border border-slate-100 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800">{r.name}</p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    <span className="font-semibold">{r.total} 分</span>
                    {diff !== 0 && (
                      <span className={`ml-1.5 text-xs font-semibold ${diff > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>{diff > 0 ? `▲ +${diff}` : `▽ ${diff}`}</span>
                    )}
                    <span className="ml-2 text-xs text-slate-400">達成率 {r.percent}%</span>
                  </p>
                </div>
                <LevelBadge level={r.level} config={config} className="shrink-0" />
              </div>
              {has360 && (
                <p className="mt-1 text-xs text-slate-500">
                  {r.others
                    ? <>他評平均 {r.others.avgTotal}（{r.others.count} 人）{(() => { const gap = Math.round((r.total - r.others.avgTotal) * 10) / 10; return gap === 0 ? '' : `・自評${gap > 0 ? '高' : '低'} ${Math.abs(gap)}`; })()}</>
                    : '尚無他評'}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <span className={`text-xs font-semibold ${r.hasMyComment ? 'text-emerald-600' : 'text-amber-600'}`}>{r.hasMyComment ? '評語已寫' : '評語未寫'}</span>
                <span className="flex-1" />
                {r.others && (
                  <button type="button" onClick={() => onReport360(r)} className="btn-secondary btn-sm" aria-label={`產出 ${r.name} 的 360° 完整報告`}>
                    <FileText className="h-3.5 w-3.5" /> 360° 報告
                  </button>
                )}
                <button type="button" onClick={() => onOpenMember(i)} className="btn-secondary btn-sm" aria-label={`查看 ${r.name} 的報告`}>
                  <Eye className="h-3.5 w-3.5" /> 查看
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MobileKpis({ group, members, groupStats }) {
  const expected = members.length || group.memberIds.length;
  const done = groupStats.respondents;
  const rate = expected > 0 ? Math.round((done / expected) * 100) : 0;
  const pending = Math.max(0, expected - done);
  const tiles = [
    { label: '完成率', value: `${rate}%`, strong: true },
    { label: '已作答／應作答', value: `${done}／${expected}` },
    { label: '平均總分', value: done > 0 ? String(groupStats.avgTotal) : '—' },
    { label: '未完成', value: `${pending} 人`, warn: pending > 0 },
  ];
  return (
    <dl className="grid grid-cols-2 gap-2" aria-label="班級關鍵數字">
      {tiles.map((t) => (
        <div key={t.label} className={`rounded-xl px-4 py-3 ring-1 ${t.strong ? 'ring-transparent' : 'bg-white ring-slate-100'}`} style={t.strong ? { background: '#1f5d4a', color: '#ffffff' } : undefined}>
          <dt className={`text-xs ${t.strong ? '' : 'text-slate-500'}`} style={t.strong ? { color: '#cfe5d6' } : undefined}>{t.label}</dt>
          <dd className={`font-serif mt-0.5 text-2xl font-bold tabular-nums ${t.strong ? '' : t.warn ? 'text-amber-600' : 'text-slate-900'}`}>{t.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function GroupOverviewSection({
  group, members, groupStats, memberRows, strongestWeakest, commentedCount,
  submissions, onGroupUpdated, showToast, confirm, onOpenMember, pendingInviteCount = 0, sharedGoals = [], warnings = [],
}) {
  const has360 = memberRows.some((r) => r.others);
  const mobile = useIsMobile();
  const [sortBy, setSortBy] = useState('score'); // 手機成員卡片的排序：score 分數高→低｜name 姓名
  const [report360, setReport360] = useState(null); // { id, name }：要產出 360° 完整報告的受評者
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
      {/* 手機第一屏：四個數字（完成率、已作答／應作答、平均、未完成人數），其餘往下捲。 */}
      {mobile && groupStats && <MobileKpis group={group} members={members} groupStats={groupStats} />}

      <ProgressPanel
        group={group}
        members={members}
        submissions={submissions}
        onGroupUpdated={onGroupUpdated}
        showToast={showToast}
        confirm={confirm}
        pendingInviteCount={pendingInviteCount}
      />

      {warnings.length > 0 && (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-amber-800"><AlertTriangle className="h-4 w-4" /> 請先確認這個班的資料</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">
            {warnings.map((w) => <li key={w.code}>{w.message}</li>)}
          </ul>
        </div>
      )}

      {report360 && <ThreeSixtyReport rateeId={report360.id} rateeName={report360.name} assessmentId={group.assessmentId} groupName={group.name} onClose={() => setReport360(null)} />}

      <CourseSurveyPanel group={group} />

      {groupStats && groupStats.respondents === 0 ? (
        <div className="rounded-xl bg-white px-6 py-12 text-center text-slate-400 shadow-sm ring-1 ring-slate-100">
          此班別尚無成員完成作答，待有作答資料後即可查看分析。
        </div>
      ) : groupStats && (
        <>
          {/* KPI 列（榕光 D4）：「已填答」是主數字（品牌深綠色塊），其餘為支撐數字。
              宋體大數字＋等寬數字，一眼先看到「這班現在怎麼樣」。 */}
          <div role="group" aria-label="班級統計" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div className="surface-hero col-span-2 lg:col-span-1">
              <p className="text-xs font-medium" style={{ color: '#cfe5d6' }}>已填答</p>
              <p className="font-serif mt-1 text-4xl font-bold leading-none tabular-nums">
                {groupStats.respondents}
                <span className="ml-1 text-base font-semibold" style={{ color: '#cfe5d6' }}>/{group.memberIds.length} 人</span>
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,.2)' }} aria-hidden="true">
                <div className="h-full rounded-full" style={{ width: `${group.memberIds.length ? Math.min(100, Math.round((groupStats.respondents / group.memberIds.length) * 100)) : 0}%`, background: '#f2b544' }} />
              </div>
            </div>
            <div className="surface">
              <p className="text-xs font-medium text-slate-500">已寫評語</p>
              <p className="font-serif mt-1 text-3xl font-bold tabular-nums text-brass-500">
                {commentedCount}
                <span className="ml-1 text-sm font-semibold text-slate-500">/{memberRows.length} 人</span>
              </p>
            </div>
            <div className="surface">
              <p className="text-xs font-medium text-slate-500">平均總分</p>
              <p className="font-serif mt-1 text-3xl font-bold tabular-nums text-slate-900">{groupStats.avgTotal}</p>
            </div>
            <div className="surface">
              <p className="text-xs font-medium text-slate-500">平均達成率</p>
              <p className="font-serif mt-1 text-3xl font-bold tabular-nums text-slate-900">{groupStats.avgPercent}%</p>
            </div>
            {strongestWeakest && (
              <div className="surface col-span-2 lg:col-span-1">
                <p className="text-xs font-medium text-slate-500">最強／待強化</p>
                <p className="mt-1 text-sm font-bold text-ink-700">{dimLabel(strongestWeakest.strongest)}</p>
                <p className="text-sm font-bold text-brass-500">{dimLabel(strongestWeakest.weakest)}</p>
              </div>
            )}
          </div>

          <div className="panel">
            <h4 className="mb-2 text-center font-semibold text-slate-700">班級整體能力雷達</h4>
            <p className="mb-3 text-center text-xs text-slate-400">{groupStats.respondents} 人作答平均</p>
            <div className="flex justify-center">
              <RadarChart dimensions={groupStats.dimensionAverages} friendly />
            </div>
          </div>

          {mobile ? (
            <details className="panel">
              <summary className="tap cursor-pointer font-semibold text-slate-700">構面 × 成員熱力圖（展開後可左右滑動，成員姓名固定在左側）</summary>
              <div className="mt-2 -mx-4"><DimensionHeatmap dimensions={groupStats.dimensionAverages} memberRows={memberRows} bare /></div>
            </details>
          ) : (
            <DimensionHeatmap dimensions={groupStats.dimensionAverages} memberRows={memberRows} />
          )}

          {/* Member table：達成率加長條、總分加「與班平均差距」，純數字表格
              不容易一眼掃描的問題（V-01）。 */}
          {mobile ? (
            <MemberCards
              memberRows={memberRows}
              groupStats={groupStats}
              has360={has360}
              sortBy={sortBy}
              setSortBy={setSortBy}
              onOpenMember={onOpenMember}
              onReport360={(r) => setReport360({ id: r.userId, name: r.name })}
              config={getAssessment(group.assessmentId)}
            />
          ) : (
          <div className="panel">
            <h4 className="mb-3 font-semibold text-slate-700">成員比較</h4>
            <p className="mb-2 text-xs text-slate-400 sm:hidden">← 左右滑動可查看完整欄位</p>
            {/* 窄欄位時整張表橫向捲動，而不是把姓名、徽章擠成逐字直排（Sprint 8 稽核）；
                捲動區可用鍵盤聚焦，才能用方向鍵捲動。 */}
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="成員比較表">
              <table className="w-full whitespace-nowrap text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-medium">#</th>
                    <th className="py-2 pr-3 font-medium">姓名</th>
                    <th className="py-2 pr-3 font-medium">總分（與班平均）</th>
                    <th className="py-2 pr-3 font-medium">達成率</th>
                    <th className="py-2 pr-3 font-medium">落點等級</th>
                    {has360 && <th className="py-2 pr-3 font-medium">他評（平均總分）</th>}
                    <th className="py-2 pr-3 font-medium">評語</th>
                    <th className="py-2 font-medium">報告</th>
                  </tr>
                </thead>
                <tbody>
                  {memberRows.map((r, i) => {
                    // 平均總分是小數，直接相減會出現 +5.700000000000003 這種浮點誤差。
                    const diff = groupStats ? Math.round((r.total - groupStats.avgTotal) * 10) / 10 : null;
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
                          <LevelBadge level={r.level} config={getAssessment(group.assessmentId)} />
                        </td>
                        {has360 && (
                          <td className="py-2.5 pr-3">
                            {r.others ? (
                              <>
                                <span className="font-semibold text-slate-700">{r.others.avgTotal}</span>
                                <span className="ml-1.5 text-xs text-slate-500">
                                  （{r.others.count} 人
                                  {r.others.byType.manager ? `：主管 ${r.others.byType.manager}` : ''}
                                  {r.others.byType.peer ? `、同儕 ${r.others.byType.peer}` : ''}
                                  {r.others.byType.subordinate ? `、部屬 ${r.others.byType.subordinate}` : ''}）
                                </span>
                                {(() => {
                                  const gap = Math.round((r.total - r.others.avgTotal) * 10) / 10;
                                  return gap === 0 ? null : (
                                    <span className={`ml-1.5 text-xs font-semibold ${gap > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                      自評{gap > 0 ? '高' : '低'} {Math.abs(gap)}
                                    </span>
                                  );
                                })()}
                              </>
                            ) : (
                              <span className="text-xs text-slate-400">尚無他評</span>
                            )}
                          </td>
                        )}
                        <td className="py-2.5 pr-3">
                          {r.hasMyComment ? (
                            <span className="text-xs font-semibold text-emerald-600">已寫</span>
                          ) : (
                            <span className="text-xs text-amber-600">未寫</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          <div className="flex gap-1.5">
                            <button type="button" onClick={() => onOpenMember(i)} className="btn-secondary btn-sm" aria-label={`查看 ${r.name} 的報告`}>
                              <Eye className="h-3.5 w-3.5" /> 查看
                            </button>
                            {r.others && (
                              <button type="button" onClick={() => setReport360({ id: r.userId, name: r.name })} className="btn-secondary btn-sm" aria-label={`產出 ${r.name} 的 360° 完整報告`}>
                                <FileText className="h-3.5 w-3.5" /> 360° 報告
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {memberRows.length >= 2 && (
            <GroupNarrativeReport
              results={memberRows.map((r) => r.submission.result)}
              assessmentId={group.assessmentId}
              focusDimensionIds={group.focusDimensionIds ?? []}
            />
          )}
        </>
      )}

      {/* 一般題庫：前測分布＋前後測比較（含落點變化、構面差異、個人變化）；風格型題庫維持原本的風格分布變化。 */}
      <PrePostAnalysis group={group} submissions={submissions} members={members} />
      {!supportsPrePost(getAssessment(group.assessmentId)) && <GroupGainReport group={group} submissions={submissions} />}

      <SharedGoalsPanel goals={sharedGoals} />

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
              <span className="mt-2 text-xs font-bold text-brass-600">{i + 1}.</span>
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
