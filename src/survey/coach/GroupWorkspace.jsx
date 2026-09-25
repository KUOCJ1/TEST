import { useEffect, useMemo, useState } from 'react';
import { FileText, Copy } from 'lucide-react';
import { api } from '../api/client';
import { getAssessment } from '../data/assessments/index.js';
import { aggregateStats, latestPerUser } from '../utils/analytics';
import PrintableReport from '../components/PrintableReport';
import BatchPrintableReport from '../components/BatchPrintableReport';
import GroupPrintableReport from '../components/GroupPrintableReport';
import GroupListPanel from './GroupListPanel';
import GroupOverviewSection from './GroupOverviewSection';
import GroupSettingsSection from './GroupSettingsSection';
import MemberDrawer from './MemberDrawer';
import CohortCompare from './CohortCompare';
import { useToast } from '../components/useToast';
import { useConfirm } from '../components/useConfirm';

// 教練後台「班級管理」主頁。這支元件原本超過 900 行，把「班別列表 + 建立班別」
// （GroupListPanel）、「總覽」分頁內容（GroupOverviewSection）、「成員與設定」
// 分頁內容（GroupSettingsSection）拆成獨立元件後（Sprint 5.6），這裡只剩下：
// 選中哪個班、班級明細資料的抓取／刷新、跨分頁共用的衍生資料（memberRows／
// groupStats／groupBenchmark），以及各個 modal（成員抽屜、PDF 報告、梯次比較）
// 的開關狀態。各分頁自己的表單輸入狀態已下放到對應的子元件裡，用
// key={groupDetail.group.id} 讓切換班別時自動重置，行為與拆分前一致。

const SECTIONS = [
  { id: 'overview', label: '總覽' },
  { id: 'settings', label: '成員與設定' },
];

export default function GroupWorkspace({ users, currentUserId }) {
  const [directory, setDirectory] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [groupDetail, setGroupDetail] = useState(null);
  const [section, setSection] = useState('overview');
  const [error, setError] = useState('');
  const [commentPatch, setCommentPatch] = useState({});
  const [drawerIndex, setDrawerIndex] = useState(null);
  const [showGroupReport, setShowGroupReport] = useState(false);
  const [pdfMemberIndex, setPdfMemberIndex] = useState(null);
  const [showBatchReport, setShowBatchReport] = useState(false);
  const [showCohortCompare, setShowCohortCompare] = useState(false);
  const showToast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    api.coachGroups().then(setGroups).catch(() => {});
    api.coachDirectory().then(setDirectory).catch(() => setDirectory([]));
  }, []);

  const loadGroup = async (id) => {
    setSelectedGroupId(id);
    setSection('overview');
    setError('');
    setCommentPatch({});
    try {
      const { group, submissions: subs } = await api.getGroup(id);
      setGroupDetail({ group, submissions: subs });
    } catch (e) {
      setError(e.message || '載入失敗');
    }
  };

  const handleGroupUpdated = (updated) => {
    setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    setGroupDetail((prev) => (prev ? { ...prev, group: updated } : prev));
  };

  const handleGroupDeleted = (id) => {
    if (selectedGroupId === id) { setSelectedGroupId(null); setGroupDetail(null); }
  };

  // 舊資料（groupId 為 null 的作答）是靠「目前成員名單」反查歸屬的，改成員名單
  // 後如果不重新抓一次 submissions，剛加入、之前就已作答過的人不會馬上出現在
  // 總覽的分析裡——要等下次重新選這個班別才會刷新，很容易被誤會成「沒抓到資料」。
  const refreshSubmissions = async () => {
    if (!selectedGroupId) return;
    try {
      const { submissions: subs } = await api.getGroup(selectedGroupId);
      setGroupDetail((prev) => (prev ? { ...prev, submissions: subs } : prev));
      setCommentPatch({});
    } catch {
      // 靜默失敗即可：使用者仍看得到已儲存的名單，只是分析要等下次重新整理。
    }
  };

  // 把新存的評語就地套用到目前的 submissions，畫面不必重新整個抓一次班級資料。
  const patchedSubmissions = useMemo(() => {
    if (!groupDetail) return [];
    if (Object.keys(commentPatch).length === 0) return groupDetail.submissions;
    return groupDetail.submissions.map((s) => (commentPatch[s.id] ? { ...s, comments: commentPatch[s.id] } : s));
  }, [groupDetail, commentPatch]);

  const handleCommentSaved = (subId, comment) => {
    setCommentPatch((prev) => {
      const base = patchedSubmissions.find((s) => s.id === subId)?.comments ?? [];
      const others = base.filter((c) => c.coachId !== comment.coachId);
      return { ...prev, [subId]: [comment, ...others] };
    });
    showToast('已儲存評語');
  };

  const config = groupDetail ? getAssessment(groupDetail.group.assessmentId) : null;

  const memberRows = useMemo(() => {
    if (!groupDetail || !config) return [];
    const latest = latestPerUser(patchedSubmissions);
    // 這個班的全部作答（不只最新一筆）依人分組，讓抽屜能顯示個人歷程趨勢，
    // 而不是只看得到單次成績——教練端本來看不到學員的成長軌跡。
    const historyByUser = new Map();
    for (const s of patchedSubmissions) {
      const list = historyByUser.get(s.userId) ?? [];
      list.push(s);
      historyByUser.set(s.userId, list);
    }
    for (const list of historyByUser.values()) {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // 新到舊
    }
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
          history: historyByUser.get(s.userId) ?? [s],
          hasMyComment: (s.comments ?? []).some((c) => c.coachId === currentUserId),
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [groupDetail, config, patchedSubmissions, users, currentUserId]);

  const groupStats = useMemo(() => {
    if (!groupDetail || !config) return null;
    return aggregateStats(patchedSubmissions, config);
  }, [groupDetail, config, patchedSubmissions]);

  const groupBenchmark = useMemo(() => {
    if (!groupStats) return null;
    return { ...groupStats, totals: memberRows.map((r) => r.total), count: groupStats.respondents };
  }, [groupStats, memberRows]);

  const strongestWeakest = useMemo(() => {
    if (!groupStats?.dimensionAverages?.length) return null;
    const sorted = [...groupStats.dimensionAverages].sort((a, b) => b.percent - a.percent);
    return { strongest: sorted[0], weakest: sorted[sorted.length - 1] };
  }, [groupStats]);

  const commentedCount = memberRows.filter((r) => r.hasMyComment).length;
  const pdfMember = pdfMemberIndex != null ? memberRows[pdfMemberIndex] : null;

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      {/* Left: group list */}
      {/* min-w-0：grid item 預設 min-width:auto，手機版沒有 lg:grid-cols-5 時仍會被
          底下熱力圖表格等內容的最小內容寬度撐開，導致整個頁面被推出可視範圍橫向
          捲動，而不是表格自己的 overflow-x-auto 生效（F-04）。 */}
      <GroupListPanel
        groups={groups}
        setGroups={setGroups}
        selectedGroupId={selectedGroupId}
        onSelectGroup={loadGroup}
        onGroupDeleted={handleGroupDeleted}
        showToast={showToast}
        confirm={confirm}
        onCompareCohorts={() => setShowCohortCompare(true)}
      />

      {/* Right: group detail */}
      <div className="min-w-0 lg:col-span-3">
        {error && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        {!groupDetail ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            選擇左側班別以查看詳情
          </div>
        ) : (
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm font-semibold">
                {SECTIONS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-current={section === s.id ? 'page' : undefined}
                    onClick={() => setSection(s.id)}
                    className={`rounded-md px-4 py-1.5 transition-colors ${
                      section === s.id ? 'bg-white text-brass-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {section === 'overview' && groupStats && groupStats.respondents > 0 && (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBatchReport(true)}
                    className="btn-secondary btn-sm"
                  >
                    <Copy className="h-3.5 w-3.5" /> <span className="hidden sm:inline">批次匯出個人報告</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGroupReport(true)}
                    className="btn-primary btn-sm"
                  >
                    <FileText className="h-3.5 w-3.5" /> <span className="hidden sm:inline">產出班級專業分析報告</span>
                  </button>
                </div>
              )}
            </div>

            {section === 'overview' && (
              <GroupOverviewSection
                key={`overview-${groupDetail.group.id}`}
                group={groupDetail.group}
                groupStats={groupStats}
                memberRows={memberRows}
                strongestWeakest={strongestWeakest}
                commentedCount={commentedCount}
                submissions={patchedSubmissions}
                onGroupUpdated={handleGroupUpdated}
                showToast={showToast}
                onOpenMember={setDrawerIndex}
              />
            )}

            {section === 'settings' && (
              <GroupSettingsSection
                key={`settings-${groupDetail.group.id}`}
                group={groupDetail.group}
                directory={directory}
                users={users}
                patchedSubmissions={patchedSubmissions}
                onGroupUpdated={handleGroupUpdated}
                refreshSubmissions={refreshSubmissions}
                showToast={showToast}
              />
            )}
          </div>
        )}
      </div>

      {drawerIndex != null && memberRows[drawerIndex] && (
        <MemberDrawer
          members={memberRows}
          selectedIndex={drawerIndex}
          onSelectIndex={setDrawerIndex}
          onClose={() => setDrawerIndex(null)}
          groupBenchmark={groupBenchmark}
          focusDimensionIds={groupDetail?.group.focusDimensionIds ?? []}
          currentUserId={currentUserId}
          onCommentSaved={handleCommentSaved}
          onExportPdf={() => setPdfMemberIndex(drawerIndex)}
        />
      )}

      {pdfMember && (
        <PrintableReport
          result={pdfMember.submission.result}
          benchmark={groupBenchmark}
          user={{ name: pdfMember.name, email: pdfMember.email }}
          submittedAt={pdfMember.submission.createdAt}
          comments={pdfMember.submission.comments}
          onClose={() => setPdfMemberIndex(null)}
        />
      )}

      {showGroupReport && groupDetail && (
        <GroupPrintableReport
          group={groupDetail.group}
          submissions={patchedSubmissions}
          users={users}
          onClose={() => setShowGroupReport(false)}
        />
      )}

      {showBatchReport && memberRows.length > 0 && (
        <BatchPrintableReport
          members={memberRows}
          benchmark={groupBenchmark}
          onClose={() => setShowBatchReport(false)}
        />
      )}

      {showCohortCompare && (
        <CohortCompare groups={groups} onClose={() => setShowCohortCompare(false)} />
      )}
    </div>
  );
}
