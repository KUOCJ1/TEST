import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Copy } from 'lucide-react';
import { api } from '../api/client';
import { getAssessment } from '../data/assessments/index.js';
import PhaseBadge from '../components/PhaseBadge';
import { formatDay } from '../utils/format';
import { pickDefaultGroup } from '../utils/groups';
import { aggregateStats, latestPerUser } from '../utils/analytics';
import PrintableReport from '../components/PrintableReport';
import CompassGroupReport from './CompassGroupReport.jsx';
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
// 雙環領導羅盤的班級多一個「組織診斷」分頁（依 REPORT 旗標判斷，其他評量不受影響）。
const DIAGNOSIS_SECTION = { id: 'diagnosis', label: '組織診斷' };

// 選中班別的標題列（Sprint 11）：以前右側直接是「總覽／成員與設定」分頁，看不出現在看的是哪個班。
function GroupHeader({ group, memberCount }) {
  const assessmentName = getAssessment(group.assessmentId)?.NAME ?? group.assessmentId;
  const range = group.startDate
    ? `${formatDay(group.startDate)} – ${group.endDate ? formatDay(group.endDate) : '未設定截止日'}`
    : '尚未設定施測日期';
  return (
    <div className="mb-4 border-b border-slate-100 pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-bold text-slate-800">{group.name}</h3>
        <PhaseBadge phase={group.phase} />
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {group.companyName && <>{group.companyName} · </>}{assessmentName} · {memberCount} 人 · {range}
      </p>
    </div>
  );
}

export default function GroupWorkspace({ users, currentUserId }) {
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
  const detailRef = useRef(null);

  const loadGroup = async (id) => {
    setSelectedGroupId(id);
    setSection('overview');
    setError('');
    setCommentPatch({});
    try {
      const { group, submissions: subs, members } = await api.getGroup(id);
      setGroupDetail({ group, submissions: subs, members: members ?? [] });
    } catch (e) {
      setError(e.message || '載入失敗');
    }
  };

  // 進頁面自動選一個班（Sprint 11）：以前右側是一大片空白，要自己點才有內容。優先選
  // 「進行中」的班（多個時選最近更新的），沒有就選最新建立的。
  useEffect(() => {
    let active = true;
    api.coachGroups()
      .then((list) => {
        if (!active) return;
        setGroups(list);
        const pick = pickDefaultGroup(list);
        if (pick) loadGroup(pick.id);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // 使用者「自己點」班別時，窄螢幕（詳情排在清單下方）要自動捲到詳情，否則看起來沒反應。
  const handleSelectGroup = async (id) => {
    await loadGroup(id);
    if (typeof window === 'undefined' || !window.matchMedia?.('(max-width: 1023px)').matches) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }));
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
      const { submissions: subs, members } = await api.getGroup(selectedGroupId);
      setGroupDetail((prev) => (prev ? { ...prev, submissions: subs, members: members ?? prev.members } : prev));
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
    <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
      {/* 班別列表用固定窄欄（Sprint 8）：以前左右 2:3 分，列表大半空白，右側成員比較表
          卻窄到要橫向捲動才看得到「查看」按鈕。 */}
      {/* Left: group list */}
      {/* min-w-0：grid item 預設 min-width:auto，手機版沒有 lg:grid-cols-5 時仍會被
          底下熱力圖表格等內容的最小內容寬度撐開，導致整個頁面被推出可視範圍橫向
          捲動，而不是表格自己的 overflow-x-auto 生效（F-04）。 */}
      <GroupListPanel
        groups={groups}
        setGroups={setGroups}
        selectedGroupId={selectedGroupId}
        onSelectGroup={handleSelectGroup}
        onGroupDeleted={handleGroupDeleted}
        showToast={showToast}
        confirm={confirm}
        onCompareCohorts={() => setShowCohortCompare(true)}
      />

      {/* Right: group detail */}
      <div ref={detailRef} className="min-w-0 scroll-mt-20">
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
            <GroupHeader group={groupDetail.group} memberCount={groupDetail.members.length} />
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm font-semibold">
                {(getAssessment(groupDetail.group.assessmentId)?.REPORT === 'compass' ? [SECTIONS[0], DIAGNOSIS_SECTION, SECTIONS[1]] : SECTIONS).map((s) => (
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
              {section === 'overview' && groupStats && groupStats.respondents > 0 && getAssessment(groupDetail.group.assessmentId)?.REPORT !== 'compass' && (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBatchReport(true)}
                    className="btn-secondary btn-sm"
                  >
                    <Copy className="h-3.5 w-3.5" /> <span className="sr-only sm:not-sr-only">批次匯出個人報告</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGroupReport(true)}
                    className="btn-primary btn-sm"
                  >
                    <FileText className="h-3.5 w-3.5" /> <span className="sr-only sm:not-sr-only">產出班級專業分析報告</span>
                  </button>
                </div>
              )}
            </div>

            {section === 'overview' && (
              <GroupOverviewSection
                key={`overview-${groupDetail.group.id}`}
                group={groupDetail.group}
                members={groupDetail.members}
                groupStats={groupStats}
                memberRows={memberRows}
                strongestWeakest={strongestWeakest}
                commentedCount={commentedCount}
                submissions={patchedSubmissions}
                onGroupUpdated={handleGroupUpdated}
                showToast={showToast}
                confirm={confirm}
                onOpenMember={setDrawerIndex}
              />
            )}

            {section === 'diagnosis' && (
              <CompassGroupReport
                key={`diagnosis-${groupDetail.group.id}`}
                group={groupDetail.group}
                members={groupDetail.members}
                submissions={patchedSubmissions}
              />
            )}

            {section === 'settings' && (
              <GroupSettingsSection
                key={`settings-${groupDetail.group.id}`}
                group={groupDetail.group}
                members={groupDetail.members}
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
