import { useMemo, useState, useEffect } from 'react';
import { X, Trash2, Download, Target, Star, Plus } from 'lucide-react';
import { api } from '../api/client';
import { getAssessment } from '../data/assessments/index.js';
import { aggregateStats } from '../utils/analytics';
import { latestPerUser } from '../utils/analytics';
import { exportGroupCsv } from '../utils/csvExport';
import RadarChart from '../components/RadarChart';
import GroupNarrativeReport from '../components/GroupNarrativeReport';
import InfoTip from '../components/InfoTip';
import PhaseBadge from '../components/PhaseBadge';
import GroupTimelineCard from '../components/GroupTimelineCard';
import QrCodeCard from '../components/QrCodeCard';
import { useToast } from '../components/useToast';

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

export default function GroupTab({ users, submissions }) {
  // 「加入成員」的可選名單來自 /coach/directory（僅姓名與 Email，不含成績），
  // 與 users（僅自己班級成員，含成績）分開，才能在收斂成績可見範圍的同時
  // 仍讓教練把尚未加入的人加進班別。
  const [directory, setDirectory] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [groupDetail, setGroupDetail] = useState(null);
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
  const showToast = useToast();

  const assessmentIds = [...new Set(submissions.map((s) => s.assessmentId ?? 'ai-competency'))];

  useEffect(() => {
    api.coachGroups().then(setGroups).catch(() => {});
    api.coachDirectory().then(setDirectory).catch(() => setDirectory([]));
  }, []);

  const loadGroup = async (id) => {
    setSelectedGroupId(id);
    setError('');
    setSettingsError('');
    setMembersError('');
    setCommentError('');
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
    if (!window.confirm('確定刪除此班別？此操作無法復原。')) return;
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

  const groupStats = useMemo(() => {
    if (!groupDetail) return null;
    const config = getAssessment(groupDetail.group.assessmentId);
    if (!config) return null;
    return aggregateStats(groupDetail.submissions, config);
  }, [groupDetail]);

  const nonAdminUsers = directory.filter((u) => u.role !== 'admin');

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      {/* Left: group list */}
      <div className="lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-700">班別列表</h3>
          <button type="button" onClick={() => setCreating(true)}
            className="btn-primary btn-sm">
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
              {assessmentIds.map((id) => (
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
              <button type="button" onClick={handleCreateGroup} disabled={savingGroup}
                className="btn-primary btn-sm">
                {savingGroup ? '建立中…' : '建立'}
              </button>
              <button type="button" onClick={() => { setCreating(false); setError(''); }}
                className="btn-ghost btn-sm">
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
      <div className="lg:col-span-3">
        {!groupDetail ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            選擇左側班別以查看詳情
          </div>
        ) : (
          <div className="space-y-5">
            <GroupTimelineCard key={groupDetail.group.id} group={groupDetail.group} onUpdated={handleGroupUpdated} />

            <QrCodeCard key={groupDetail.group.id} group={groupDetail.group} onUpdated={handleGroupUpdated} />

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

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-slate-700">成員管理</h3>
                <button type="button"
                  onClick={() => exportGroupCsv(groupDetail.group, groupDetail.submissions, users, getAssessment, latestPerUser)}
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

            <div className="rounded-xl border border-slate-200 bg-white p-4">
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
                      ✓ 已加入 {importResult.added} 位現有用戶、{importResult.pending} 位列入待加入
                      {importResult.invalid?.length > 0 && (
                        <span className="text-amber-600">；{importResult.invalid.length} 筆 Email 格式錯誤已略過</span>
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>

            {groupStats && groupStats.respondents > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="mb-2 text-center font-semibold text-slate-700">班級整體能力雷達</h3>
                <p className="mb-3 text-center text-xs text-slate-400">{groupStats.respondents} 人作答平均</p>
                <div className="flex justify-center">
                  <RadarChart dimensions={groupStats.dimensionAverages} />
                </div>
              </div>
            )}

            {groupDetail && groupDetail.submissions.length >= 2 && (
              <GroupNarrativeReport
                results={groupDetail.submissions.map((s) => s.result).filter(Boolean)}
                assessmentId={groupDetail.group.assessmentId}
                focusDimensionIds={groupDetail.group.focusDimensionIds ?? []}
              />
            )}

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
      </div>
    </div>
  );
}
