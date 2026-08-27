import { useEffect, useMemo, useState } from 'react';
import {
  Trash2, Download, Target, Star, Plus, X, FileText, Eye, Copy,
} from 'lucide-react';
import { api } from '../api/client';
import { getAssessment } from '../data/assessments/index.js';
import { aggregateStats, latestPerUser } from '../utils/analytics';
import { exportGroupCsv } from '../utils/csvExport';
import RadarChart from '../components/RadarChart';
import DimensionHeatmap from '../components/DimensionHeatmap';
import GroupNarrativeReport from '../components/GroupNarrativeReport';
import PrintableReport from '../components/PrintableReport';
import BatchPrintableReport from '../components/BatchPrintableReport';
import GroupPrintableReport from '../components/GroupPrintableReport';
import InfoTip from '../components/InfoTip';
import PhaseBadge from '../components/PhaseBadge';
import GroupTimelineCard from '../components/GroupTimelineCard';
import QrCodeCard from '../components/QrCodeCard';
import MemberDrawer from './MemberDrawer';
import { useToast } from '../components/useToast';
import { useConfirm } from '../components/useConfirm';

function parseRoster(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[,\t]/).map((p) => p.trim());
      if (parts.length >= 2) return { name: parts[0], email: parts[1] };
      return { name: '', email: parts[0] };
    })
    .filter((e) => e.email);
}

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
  const [creating, setCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newAssessmentId, setNewAssessmentId] = useState('ai-competency');
  const [newTarget, setNewTarget] = useState('');
  const [newFocusDims, setNewFocusDims] = useState([]);
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupComment, setGroupComment] = useState('');
  const [groupTips, setGroupTips] = useState(['']);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [targetHeadcount, setTargetHeadcount] = useState('');
  const [focusDims, setFocusDims] = useState([]);
  const [dimNotes, setDimNotes] = useState({});
  const [error, setError] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [savingMembers, setSavingMembers] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [rosterText, setRosterText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [commentPatch, setCommentPatch] = useState({});
  const [drawerIndex, setDrawerIndex] = useState(null);
  const [showGroupReport, setShowGroupReport] = useState(false);
  const [pdfMemberIndex, setPdfMemberIndex] = useState(null);
  const [showBatchReport, setShowBatchReport] = useState(false);
  const showToast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    api.coachGroups().then(setGroups).catch(() => {});
    api.coachDirectory().then(setDirectory).catch(() => setDirectory([]));
  }, []);

  const assessmentIds = [...new Set(groups.map((g) => g.assessmentId ?? 'ai-competency'))];

  const loadGroup = async (id) => {
    setSelectedGroupId(id);
    setSection('overview');
    setError('');
    setSettingsError('');
    setMembersError('');
    setCommentError('');
    setCommentPatch({});
    try {
      const { group, submissions: subs } = await api.getGroup(id);
      setGroupDetail({ group, submissions: subs });
      setGroupComment(group.groupComment ?? '');
      setGroupTips(group.groupTips?.length ? group.groupTips : ['']);
      setSelectedMembers(group.memberIds ?? []);
      setTargetHeadcount(group.targetHeadcount == null ? '' : String(group.targetHeadcount));
      setFocusDims(group.focusDimensionIds ?? []);
      setDimNotes(group.dimensionNotes ?? {});
    } catch (e) {
      setError(e.message || '載入失敗');
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) { setError('請輸入班別名稱'); return; }
    setSavingGroup(true);
    setError('');
    try {
      const group = await api.createGroup({
        name: newGroupName.trim(),
        companyName: newCompany.trim(),
        assessmentId: newAssessmentId,
        memberIds: [],
        targetHeadcount: newTarget === '' ? null : Number(newTarget),
        focusDimensionIds: newFocusDims,
      });
      setGroups((prev) => [group, ...prev]);
      setCreating(false);
      setNewGroupName('');
      setNewCompany('');
      setNewTarget('');
      setNewFocusDims([]);
      loadGroup(group.id);
      showToast('已建立班別');
    } catch (e) {
      setError(e.message || '建立失敗');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleGroupUpdated = (updated) => {
    setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    setGroupDetail((prev) => (prev ? { ...prev, group: updated } : prev));
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

  const handleSaveSettings = async () => {
    if (!selectedGroupId) return;
    setSavingSettings(true);
    setSettingsError('');
    try {
      const updated = await api.updateGroup(selectedGroupId, {
        targetHeadcount: targetHeadcount === '' ? null : Number(targetHeadcount),
        focusDimensionIds: focusDims,
        dimensionNotes: Object.fromEntries(focusDims.map((id) => [id, (dimNotes[id] ?? '').trim()]).filter(([, v]) => v)),
      });
      handleGroupUpdated(updated);
      showToast('已儲存評量設定');
    } catch (e) {
      setSettingsError(e.message || '儲存失敗');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveMembers = async () => {
    if (!selectedGroupId) return;
    setSavingMembers(true);
    setMembersError('');
    try {
      const updated = await api.updateGroup(selectedGroupId, { memberIds: selectedMembers });
      handleGroupUpdated(updated);
      await refreshSubmissions();
      showToast('已儲存成員名單');
    } catch (e) {
      setMembersError(e.message || '儲存失敗');
    } finally {
      setSavingMembers(false);
    }
  };

  const handleSaveComment = async () => {
    if (!selectedGroupId) return;
    setSavingComment(true);
    setCommentError('');
    try {
      const updated = await api.updateGroup(selectedGroupId, {
        groupComment: groupComment.trim(),
        groupTips: groupTips.filter((t) => t.trim()),
      });
      handleGroupUpdated(updated);
      showToast('已儲存評語與建議');
    } catch (e) {
      setCommentError(e.message || '儲存失敗');
    } finally {
      setSavingComment(false);
    }
  };

  const handleDeleteGroup = async (id) => {
    if (!(await confirm('確定刪除此班別？此操作無法復原。'))) return;
    setError('');
    try {
      await api.deleteGroup(id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
      if (selectedGroupId === id) { setSelectedGroupId(null); setGroupDetail(null); }
      showToast('已刪除班別');
    } catch (e) {
      setError(e.message || '刪除失敗');
    }
  };

  const toggleMember = (userId) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const toggleSetter = (setter) => (dimId) =>
    setter((prev) => (prev.includes(dimId) ? prev.filter((id) => id !== dimId) : [...prev, dimId]));
  const toggleNewFocus = toggleSetter(setNewFocusDims);
  const toggleFocus = toggleSetter(setFocusDims);

  const newDims = getAssessment(newAssessmentId)?.DIMENSIONS ?? [];

  const handleImportRoster = async () => {
    const entries = parseRoster(rosterText);
    if (entries.length === 0) { setImportResult({ error: '沒有可匯入的有效名單' }); return; }
    setImporting(true);
    setImportResult(null);
    try {
      const { group, result } = await api.importRoster(selectedGroupId, entries);
      handleGroupUpdated(group);
      setSelectedMembers(group.memberIds ?? []);
      await refreshSubmissions();
      setImportResult(result);
      setRosterText('');
    } catch (e) {
      setImportResult({ error: e.message || '匯入失敗' });
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setRosterText(String(ev.target?.result ?? ''));
    reader.readAsText(file);
    e.target.value = '';
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
  const nonAdminUsers = directory.filter((u) => u.role !== 'admin');
  const pdfMember = pdfMemberIndex != null ? memberRows[pdfMemberIndex] : null;

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      {/* Left: group list */}
      {/* min-w-0：grid item 預設 min-width:auto，手機版沒有 lg:grid-cols-5 時仍會被
          底下熱力圖表格等內容的最小內容寬度撐開，導致整個頁面被推出可視範圍橫向
          捲動，而不是表格自己的 overflow-x-auto 生效（F-04）。 */}
      <div className="min-w-0 lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-700">班別列表</h3>
          <button type="button" onClick={() => setCreating(true)} className="btn-primary btn-sm">
            <Plus className="h-3.5 w-3.5" /> 建立班別
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {creating && (
          <div className="mb-3 rounded-xl border border-brass-200 bg-brass-50 p-3 space-y-2">
            <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="班別名稱（必填）"
              className="input"
            />
            <input type="text" value={newCompany} onChange={(e) => setNewCompany(e.target.value)}
              placeholder="公司名稱（選填）"
              className="input"
            />
            <select value={newAssessmentId} onChange={(e) => { setNewAssessmentId(e.target.value); setNewFocusDims([]); }}
              className="input">
              {(assessmentIds.length ? assessmentIds : ['ai-competency']).map((id) => (
                <option key={id} value={id}>{getAssessment(id)?.NAME ?? id}</option>
              ))}
            </select>
            <input type="number" min="0" value={newTarget} onChange={(e) => setNewTarget(e.target.value)}
              placeholder="目標人數（選填）"
              className="input"
            />
            {newDims.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold text-brass-600">重點構面（選填）</p>
                <div className="flex flex-wrap gap-1.5">
                  {newDims.map((d) => (
                    <button key={d.id} type="button" onClick={() => toggleNewFocus(d.id)}
                      className={`chip gap-1 transition-colors ${
                        newFocusDims.includes(d.id)
                          ? 'bg-ink-700 text-white'
                          : 'bg-white text-slate-500 ring-1 ring-brass-200 hover:bg-brass-100'
                      }`}>
                      <Star className="h-3 w-3" fill={newFocusDims.includes(d.id) ? 'currentColor' : 'none'} />
                      {d.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={handleCreateGroup} disabled={savingGroup} className="btn-primary btn-sm">
                {savingGroup ? '建立中…' : '建立'}
              </button>
              <button type="button" onClick={() => { setCreating(false); setError(''); }} className="btn-ghost btn-sm">
                取消
              </button>
            </div>
          </div>
        )}

        {groups.length === 0 && !creating && (
          <p className="text-sm text-slate-400 py-4 text-center">尚無班別，請點右上角「建立班別」</p>
        )}

        <div className="space-y-2">
          {groups.map((g) => (
            <div key={g.id}
              className={`cursor-pointer rounded-xl border px-4 py-3 transition-colors ${
                selectedGroupId === g.id
                  ? 'border-brass-400 bg-brass-50'
                  : 'border-slate-200 bg-white hover:border-brass-200'
              }`}
              onClick={() => loadGroup(g.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">{g.name}</p>
                  {g.companyName && <p className="text-xs text-slate-400">{g.companyName}</p>}
                  <p className="mt-0.5 text-xs text-slate-400">
                    {getAssessment(g.assessmentId)?.NAME ?? g.assessmentId} · {g.memberIds.length} 人
                  </p>
                  <div className="mt-1.5">
                    <PhaseBadge phase={g.phase} />
                  </div>
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g.id); }}
                  aria-label="刪除班別"
                  className="shrink-0 rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: group detail */}
      <div className="min-w-0 lg:col-span-3">
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
              <div className="space-y-5">
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
                            <span className="ml-1 text-base font-semibold text-slate-400">/{groupDetail.group.memberIds.length} 人</span>
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
                                    <button type="button" onClick={() => setDrawerIndex(i)} className="btn-secondary btn-sm">
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
                        assessmentId={groupDetail.group.assessmentId}
                        focusDimensionIds={groupDetail.group.focusDimensionIds ?? []}
                      />
                    )}
                  </>
                )}

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
            )}

            {section === 'settings' && (
              <div className="space-y-5">
                <GroupTimelineCard key={`timeline-${groupDetail.group.id}`} group={groupDetail.group} onUpdated={handleGroupUpdated} />

                <QrCodeCard key={`qr-${groupDetail.group.id}`} group={groupDetail.group} onUpdated={handleGroupUpdated} />

                <div className="rounded-xl border border-brass-200 bg-brass-50/50 p-4">
                  <h3 className="mb-3 flex items-center gap-1.5 font-semibold text-brass-600">
                    <Target className="h-4 w-4" /> 評量設定
                  </h3>

                  {settingsError && (
                    <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                      {settingsError}
                    </p>
                  )}

                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <label className="text-sm font-medium text-slate-600">目標人數</label>
                    <input type="number" min="0" value={targetHeadcount} onChange={(e) => setTargetHeadcount(e.target.value)}
                      placeholder="未設定"
                      className="input w-28"
                    />
                    <span className="text-sm text-slate-500">
                      已加入 <span className="font-bold text-brass-600">{selectedMembers.length}</span>
                      {targetHeadcount !== '' && Number(targetHeadcount) > 0 && (
                        <> / 目標 {targetHeadcount} 人
                          <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            selectedMembers.length >= Number(targetHeadcount)
                              ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {selectedMembers.length >= Number(targetHeadcount)
                              ? '已達標' : `尚缺 ${Number(targetHeadcount) - selectedMembers.length} 人`}
                          </span>
                        </>
                      )}
                    </span>
                  </div>

                  {(() => {
                    const dims = getAssessment(groupDetail.group.assessmentId)?.DIMENSIONS ?? [];
                    if (dims.length === 0) return null;
                    return (
                      <>
                        <p className="mb-1.5 text-xs font-semibold text-brass-600">重點構面（可複選）</p>
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {dims.map((d) => (
                            <button key={d.id} type="button" onClick={() => toggleFocus(d.id)}
                              className={`chip gap-1 transition-colors ${
                                focusDims.includes(d.id)
                                  ? 'bg-ink-700 text-white'
                                  : 'bg-white text-slate-500 ring-1 ring-brass-200 hover:bg-brass-100'
                              }`}>
                              <Star className="h-3 w-3" fill={focusDims.includes(d.id) ? 'currentColor' : 'none'} />
                              {d.name}
                            </button>
                          ))}
                        </div>
                        {focusDims.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-brass-600">重點構面內容</p>
                            {focusDims.map((id) => {
                              const dim = dims.find((d) => d.id === id);
                              if (!dim) return null;
                              return (
                                <div key={id}>
                                  <label className="mb-0.5 flex items-center gap-1 text-xs font-medium text-slate-600">
                                    <Star className="h-3 w-3" fill="currentColor" /> {dim.name}
                                  </label>
                                  <textarea rows={2} value={dimNotes[id] ?? ''}
                                    onChange={(e) => setDimNotes((prev) => ({ ...prev, [id]: e.target.value }))}
                                    placeholder={`針對「${dim.name}」的培訓目標…`}
                                    className="input"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}

                  <button type="button" onClick={handleSaveSettings} disabled={savingSettings}
                    className="btn-primary btn-sm mt-3">
                    {savingSettings ? '儲存中…' : '儲存評量設定'}
                  </button>
                </div>

                <div className="panel-secondary">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-700">成員管理</h3>
                    <button type="button"
                      onClick={() => exportGroupCsv(groupDetail.group, patchedSubmissions, users, getAssessment, latestPerUser)}
                      className="btn-secondary btn-sm">
                      <Download className="h-3.5 w-3.5" /> 匯出班級成績 CSV
                    </button>
                  </div>

                  {membersError && (
                    <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                      {membersError}
                    </p>
                  )}

                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {nonAdminUsers.map((u) => (
                      <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50">
                        <input type="checkbox" checked={selectedMembers.includes(u.id)} onChange={() => toggleMember(u.id)}
                          className="accent-ink-700" />
                        <span className="text-sm font-medium text-slate-700">{u.name}</span>
                        <span className="text-xs text-slate-400">{u.email}</span>
                      </label>
                    ))}
                  </div>

                  {groupDetail.group.pendingMembers?.length > 0 && (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <p className="mb-1.5 flex items-center text-xs font-semibold text-amber-600">
                        待加入（尚未註冊）
                        <InfoTip text="Email 已登錄於班別，但該用戶尚未完成帳號註冊。待其註冊後自動加入本班，無需手動操作。" />
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {groupDetail.group.pendingMembers.map((p) => (
                          <span key={p.email} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                            {p.name ? `${p.name} ` : ''}{p.email}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <button type="button" onClick={handleSaveMembers} disabled={savingMembers}
                    className="btn-primary btn-sm mt-3">
                    {savingMembers ? '儲存中…' : '儲存成員名單'}
                  </button>
                </div>

                <div className="panel-secondary">
                  <h3 className="mb-1 font-semibold text-slate-700">批量匯入名單</h3>
                  <p className="mb-2 text-xs text-slate-400">每行一筆，格式：<code className="rounded bg-slate-100 px-1">姓名,Email</code> 或僅 Email。</p>
                  <textarea value={rosterText} onChange={(e) => setRosterText(e.target.value)} rows={4}
                    placeholder={'王小明,ming@company.com\n李小華,hua@company.com'}
                    className="input"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={handleImportRoster} disabled={importing}
                      className="btn-primary btn-sm">
                      {importing ? '匯入中…' : '匯入名單'}
                    </button>
                    <label className="btn-secondary btn-sm cursor-pointer">
                      上傳 CSV 檔
                      <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>
                  {importResult && (
                    <div className="mt-2 text-xs">
                      {importResult.error ? (
                        <p className="text-red-500">{importResult.error}</p>
                      ) : (
                        <p className="text-emerald-600">
                          已加入 {importResult.added} 位現有用戶、{importResult.pending} 位列入待加入
                          {importResult.invalid?.length > 0 && (
                            <span className="text-amber-600">；{importResult.invalid.length} 筆 Email 格式錯誤已略過</span>
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
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
    </div>
  );
}
