import { useMemo, useState, useEffect } from 'react';
import { api } from '../api/client';
import { getAssessment } from '../data/assessments/index.js';
import { aggregateStats } from '../utils/analytics';
import { latestPerUser } from '../utils/analytics';
import { exportGroupCsv } from '../utils/csvExport';
import RadarChart from '../components/RadarChart';
import GroupNarrativeReport from '../components/GroupNarrativeReport';

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
  const [rosterText, setRosterText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const assessmentIds = [...new Set(submissions.map((s) => s.assessmentId ?? 'ai-competency'))];

  useEffect(() => {
    api.coachGroups().then(setGroups).catch(() => {});
  }, []);

  const loadGroup = async (id) => {
    setSelectedGroupId(id);
    setError('');
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
    } catch (e) {
      setError(e.message || '建立失敗');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleSaveGroup = async () => {
    if (!selectedGroupId) return;
    setSavingGroup(true);
    setError('');
    try {
      const updated = await api.updateGroup(selectedGroupId, {
        memberIds: selectedMembers,
        groupComment: groupComment.trim(),
        groupTips: groupTips.filter((t) => t.trim()),
        targetHeadcount: targetHeadcount === '' ? null : Number(targetHeadcount),
        focusDimensionIds: focusDims,
        dimensionNotes: Object.fromEntries(focusDims.map((id) => [id, (dimNotes[id] ?? '').trim()]).filter(([, v]) => v)),
      });
      setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      setGroupDetail((prev) => prev ? { ...prev, group: updated } : prev);
    } catch (e) {
      setError(e.message || '儲存失敗');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (id) => {
    if (!window.confirm('確定刪除此班別？')) return;
    setError('');
    try {
      await api.deleteGroup(id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
      if (selectedGroupId === id) { setSelectedGroupId(null); setGroupDetail(null); }
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
      setGroups((prev) => prev.map((g) => (g.id === group.id ? group : g)));
      setGroupDetail((prev) => prev ? { ...prev, group } : prev);
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

  const nonAdminUsers = users.filter((u) => u.role !== 'admin');

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      {/* Left: group list */}
      <div className="lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-700">班別列表</h3>
          <button type="button" onClick={() => setCreating(true)}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
            + 建立班別
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {creating && (
          <div className="mb-3 rounded-xl border border-brand-200 bg-brand-50 p-3 space-y-2">
            <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="班別名稱（必填）"
              className="w-full rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            <input type="text" value={newCompany} onChange={(e) => setNewCompany(e.target.value)}
              placeholder="公司名稱（選填）"
              className="w-full rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            <select value={newAssessmentId} onChange={(e) => { setNewAssessmentId(e.target.value); setNewFocusDims([]); }}
              className="w-full rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-400">
              {assessmentIds.map((id) => (
                <option key={id} value={id}>{getAssessment(id)?.NAME ?? id}</option>
              ))}
            </select>
            <input type="number" min="0" value={newTarget} onChange={(e) => setNewTarget(e.target.value)}
              placeholder="目標人數（選填）"
              className="w-full rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            {newDims.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold text-brand-600">重點構面（選填）</p>
                <div className="flex flex-wrap gap-1.5">
                  {newDims.map((d) => (
                    <button key={d.id} type="button" onClick={() => toggleNewFocus(d.id)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        newFocusDims.includes(d.id)
                          ? 'bg-brand-600 text-white'
                          : 'bg-white text-slate-500 ring-1 ring-brand-200 hover:bg-brand-100'
                      }`}>
                      {newFocusDims.includes(d.id) ? '⭐ ' : ''}{d.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={handleCreateGroup} disabled={savingGroup}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                {savingGroup ? '建立中…' : '建立'}
              </button>
              <button type="button" onClick={() => { setCreating(false); setError(''); }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
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
                  ? 'border-brand-400 bg-brand-50'
                  : 'border-slate-200 bg-white hover:border-brand-200'
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
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g.id); }}
                  className="text-slate-300 hover:text-red-400 text-xs">✕</button>
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
            <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4">
              <h3 className="mb-3 font-semibold text-brand-700">🎯 評量設定</h3>

              <div className="mb-3 flex flex-wrap items-center gap-3">
                <label className="text-sm font-medium text-slate-600">目標人數</label>
                <input type="number" min="0" value={targetHeadcount} onChange={(e) => setTargetHeadcount(e.target.value)}
                  placeholder="未設定"
                  className="w-28 rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
                <span className="text-sm text-slate-500">
                  已加入 <span className="font-bold text-brand-700">{selectedMembers.length}</span>
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
                    <p className="mb-1.5 text-xs font-semibold text-brand-600">重點構面（可複選）</p>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {dims.map((d) => (
                        <button key={d.id} type="button" onClick={() => toggleFocus(d.id)}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                            focusDims.includes(d.id)
                              ? 'bg-brand-600 text-white'
                              : 'bg-white text-slate-500 ring-1 ring-brand-200 hover:bg-brand-100'
                          }`}>
                          {focusDims.includes(d.id) ? '⭐ ' : ''}{d.name}
                        </button>
                      ))}
                    </div>
                    {focusDims.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-brand-600">重點構面內容</p>
                        {focusDims.map((id) => {
                          const dim = dims.find((d) => d.id === id);
                          if (!dim) return null;
                          return (
                            <div key={id}>
                              <label className="mb-0.5 block text-xs font-medium text-slate-600">⭐ {dim.name}</label>
                              <textarea rows={2} value={dimNotes[id] ?? ''}
                                onChange={(e) => setDimNotes((prev) => ({ ...prev, [id]: e.target.value }))}
                                placeholder={`針對「${dim.name}」的培訓目標…`}
                                className="w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
              <p className="mt-2 text-xs text-slate-400">設定變更後，請點最下方「儲存班級設定」一併儲存。</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-slate-700">成員管理</h3>
                <button type="button"
                  onClick={() => exportGroupCsv(groupDetail.group, groupDetail.submissions, users, getAssessment, latestPerUser)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  ⬇ 匯出班級成績 CSV
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {nonAdminUsers.map((u) => (
                  <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50">
                    <input type="checkbox" checked={selectedMembers.includes(u.id)} onChange={() => toggleMember(u.id)}
                      className="accent-brand-600" />
                    <span className="text-sm font-medium text-slate-700">{u.name}</span>
                    <span className="text-xs text-slate-400">{u.email}</span>
                  </label>
                ))}
              </div>

              {groupDetail.group.pendingMembers?.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="mb-1.5 text-xs font-semibold text-amber-600">待加入（尚未註冊）</p>
                  <div className="flex flex-wrap gap-1.5">
                    {groupDetail.group.pendingMembers.map((p) => (
                      <span key={p.email} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        {p.name ? `${p.name} ` : ''}{p.email}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-1 font-semibold text-slate-700">批量匯入名單</h3>
              <p className="mb-2 text-xs text-slate-400">每行一筆，格式：<code className="rounded bg-slate-100 px-1">姓名,Email</code> 或僅 Email。</p>
              <textarea value={rosterText} onChange={(e) => setRosterText(e.target.value)} rows={4}
                placeholder={'王小明,ming@company.com\n李小華,hua@company.com'}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" onClick={handleImportRoster} disabled={importing}
                  className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                  {importing ? '匯入中…' : '匯入名單'}
                </button>
                <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
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

            <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
              <h3 className="mb-2 font-semibold text-brand-700">班級整體評語</h3>
              <textarea value={groupComment} onChange={(e) => setGroupComment(e.target.value)} rows={4}
                placeholder="針對本班整體觀察與評語…"
                className="w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />

              <p className="mt-3 mb-1.5 text-xs font-semibold text-brand-600 uppercase tracking-wide">班級精進建議</p>
              <div className="space-y-2">
                {groupTips.map((tip, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="mt-2 text-xs font-bold text-brand-400">{i + 1}.</span>
                    <input type="text" value={tip} onChange={(e) => setGroupTips((prev) => prev.map((t, j) => j === i ? e.target.value : t))}
                      placeholder={`班級建議 ${i + 1}`}
                      className="flex-1 rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                    />
                    {groupTips.length > 1 && (
                      <button type="button" onClick={() => setGroupTips((prev) => prev.filter((_, j) => j !== i))}
                        className="text-slate-400 hover:text-red-500">✕</button>
                    )}
                  </div>
                ))}
                {groupTips.length < 5 && (
                  <button type="button" onClick={() => setGroupTips((prev) => [...prev, ''])}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-800">+ 新增建議</button>
                )}
              </div>

              <button type="button" onClick={handleSaveGroup} disabled={savingGroup}
                className="mt-4 rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                {savingGroup ? '儲存中…' : '儲存班級設定'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
