import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { getAssessment } from '../data/assessments/index.js';
import { aggregateStats, latestPerUser } from '../utils/analytics';
import RadarChart from '../components/RadarChart';
import { formatDate } from '../utils/format';

// 解析貼上或上傳的名單文字（每行：姓名,Email 或僅 Email）。
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

// 匯出班級成績 CSV（含各構面分數與教練評語）。
function exportGroupCsv(group, submissions, users) {
  const config = getAssessment(group.assessmentId);
  const dimHeaders = (config?.DIMENSIONS ?? []).map((d) => d.subtitle);
  const header = ['姓名', 'Email', '作答時間', '總分', '達成率', '落點等級', ...dimHeaders, '教練評語'];
  const latest = latestPerUser(submissions);
  const rows = latest.map((s) => {
    const u = users.find((x) => x.id === s.userId);
    const dims = (config?.DIMENSIONS ?? []).map((d) => s.result?.dimensions?.find((x) => x.id === d.id)?.score ?? '');
    const comment = s.comments?.[0]?.text ?? '';
    return [u?.name ?? s.userName, u?.email ?? '', formatDate(s.createdAt), s.result?.total, `${s.result?.percent}%`, s.result?.level?.badge, ...dims, comment];
  });
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${group.name}-成績-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── 評語編輯器 ────────────────────────────────────────────────
function CommentEditor({ submission, existingComment, onSaved, onCancel }) {
  const [text, setText] = useState(existingComment?.text ?? '');
  const [tips, setTips] = useState(existingComment?.tips?.length ? existingComment.tips : ['']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setTip = (i, v) => setTips((prev) => prev.map((t, j) => (j === i ? v : t)));
  const addTip = () => setTips((prev) => [...prev, '']);
  const removeTip = (i) => setTips((prev) => prev.filter((_, j) => j !== i));

  const handleSave = async () => {
    if (!text.trim()) { setError('請輸入評語內容'); return; }
    setSaving(true);
    setError('');
    try {
      const comment = await api.upsertComment(submission.id, {
        text: text.trim(),
        tips: tips.filter((t) => t.trim()),
      });
      onSaved(comment);
    } catch (e) {
      setError(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-4">
      <p className="mb-2 text-sm font-semibold text-violet-700">
        {existingComment ? '編輯評語' : '新增評語'}
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="針對此學員的整體觀察與評語…"
        className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
      />

      <p className="mt-3 mb-1.5 text-xs font-semibold text-violet-600 uppercase tracking-wide">精進建議（最多 5 條）</p>
      <div className="space-y-2">
        {tips.map((tip, i) => (
          <div key={i} className="flex gap-2">
            <span className="mt-2 text-xs font-bold text-violet-400">{i + 1}.</span>
            <input
              type="text"
              value={tip}
              onChange={(e) => setTip(i, e.target.value)}
              placeholder={`建議 ${i + 1}`}
              className="flex-1 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
            {tips.length > 1 && (
              <button type="button" onClick={() => removeTip(i)} className="text-slate-400 hover:text-red-500">✕</button>
            )}
          </div>
        ))}
        {tips.length < 5 && (
          <button type="button" onClick={addTip} className="text-xs font-semibold text-violet-600 hover:text-violet-800">
            + 新增建議
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
        >
          {saving ? '儲存中…' : '儲存評語'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
          取消
        </button>
      </div>
    </div>
  );
}

// ── 個人評語 Tab ──────────────────────────────────────────────
function IndividualTab({ users, submissions, currentUserId }) {
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('ai-competency');
  const [editingSubId, setEditingSubId] = useState(null);
  const [commentPatch, setCommentPatch] = useState({});

  const localSubs = useMemo(
    () => submissions.map((s) => (commentPatch[s.id] ? { ...s, comments: commentPatch[s.id] } : s)),
    [submissions, commentPatch],
  );

  const assessmentIds = [...new Set(localSubs.map((s) => s.assessmentId ?? 'ai-competency'))];

  const filteredSubs = localSubs.filter((s) => (s.assessmentId ?? 'ai-competency') === selectedAssessmentId);
  const latestByUser = latestPerUser(filteredSubs);

  const rows = latestByUser.map((s) => {
    const user = users.find((u) => u.id === s.userId);
    const all = s.comments ?? [];
    const myComment = all.find((c) => c.coachId === currentUserId) ?? null;
    const otherComments = all.filter((c) => c.coachId !== currentUserId);
    return { sub: s, user, myComment, otherComments };
  }).sort((a, b) => (b.sub.result?.total ?? 0) - (a.sub.result?.total ?? 0));

  const patchComments = useCallback((subId, updater) => {
    setCommentPatch((prev) => {
      const base = localSubs.find((s) => s.id === subId)?.comments ?? [];
      return { ...prev, [subId]: updater(base) };
    });
  }, [localSubs]);

  const handleCommentSaved = (subId, comment) => {
    patchComments(subId, (prev) => {
      const others = prev.filter((c) => c.coachId !== comment.coachId);
      return [comment, ...others];
    });
    setEditingSubId(null);
  };

  const handleDelete = async (subId, commentId) => {
    if (!window.confirm('確定刪除此評語？')) return;
    try {
      await api.deleteComment(subId, commentId);
      patchComments(subId, (prev) => prev.filter((c) => c.id !== commentId));
    } catch (e) {
      alert(e.message || '刪除失敗');
    }
  };

  return (
    <div>
      {assessmentIds.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {assessmentIds.map((id) => (
            <button key={id} type="button" onClick={() => setSelectedAssessmentId(id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                selectedAssessmentId === id ? 'bg-teal-600 text-white' : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {getAssessment(id)?.NAME ?? id}
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="py-8 text-center text-slate-400">此評量尚無作答資料。</p>
      ) : (
        <div className="space-y-3">
          {rows.map(({ sub, user, myComment, otherComments }) => (
            <div key={sub.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-semibold text-slate-800">{user?.name ?? sub.userName}</span>
                <span className="text-sm text-slate-400">{user?.email ?? ''}</span>
                <span className="font-bold text-teal-700">{sub.result?.total} / {sub.result?.maxScore}</span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                  style={{ background: sub.result?.level?.color }}
                >
                  {sub.result?.level?.badge}
                </span>
                <span className="text-xs text-slate-400">{formatDate(sub.createdAt)}</span>
                <div className="ml-auto flex gap-2">
                  {myComment ? (
                    <>
                      <button type="button" onClick={() => setEditingSubId(editingSubId === sub.id ? null : sub.id)}
                        className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100">
                        ✏ 編輯評語
                      </button>
                      <button type="button" onClick={() => handleDelete(sub.id, myComment.id)}
                        className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-500 hover:bg-red-100">
                        刪除
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setEditingSubId(editingSubId === sub.id ? null : sub.id)}
                      className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100">
                      + 新增評語
                    </button>
                  )}
                </div>
              </div>

              {myComment && editingSubId !== sub.id && (
                <div className="mt-2 rounded-lg border-l-4 border-violet-400 bg-violet-50 px-3 py-2">
                  <p className="text-xs font-semibold text-violet-600">我的評語</p>
                  <p className="text-sm text-slate-700">{myComment.text}</p>
                  {myComment.tips?.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {myComment.tips.map((t, i) => (
                        <li key={i} className="text-xs text-slate-600">・{t}</li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1 text-xs text-slate-400">更新於 {formatDate(myComment.updatedAt)}</p>
                </div>
              )}

              {otherComments?.length > 0 && (
                <div className="mt-2 space-y-2">
                  {otherComments.map((c) => (
                    <div key={c.id} className="rounded-lg border-l-4 border-slate-300 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-semibold text-slate-500">其他教練：{c.coachName}</p>
                      <p className="text-sm text-slate-700">{c.text}</p>
                      {c.tips?.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {c.tips.map((t, i) => (
                            <li key={i} className="text-xs text-slate-600">・{t}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {editingSubId === sub.id && (
                <CommentEditor
                  submission={sub}
                  existingComment={myComment}
                  onSaved={(c) => handleCommentSaved(sub.id, c)}
                  onCancel={() => setEditingSubId(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 班別管理 Tab ──────────────────────────────────────────────
function GroupTab({ users, submissions }) {
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [groupDetail, setGroupDetail] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newAssessmentId, setNewAssessmentId] = useState('ai-competency');
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupComment, setGroupComment] = useState('');
  const [groupTips, setGroupTips] = useState(['']);
  const [selectedMembers, setSelectedMembers] = useState([]);
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
    try {
      const { group, submissions: subs } = await api.getGroup(id);
      setGroupDetail({ group, submissions: subs });
      setGroupComment(group.groupComment ?? '');
      setGroupTips(group.groupTips?.length ? group.groupTips : ['']);
      setSelectedMembers(group.memberIds ?? []);
    } catch (e) {
      alert(e.message || '載入失敗');
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
      });
      setGroups((prev) => [group, ...prev]);
      setCreating(false);
      setNewGroupName('');
      setNewCompany('');
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
    try {
      const updated = await api.updateGroup(selectedGroupId, {
        memberIds: selectedMembers,
        groupComment: groupComment.trim(),
        groupTips: groupTips.filter((t) => t.trim()),
      });
      setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      setGroupDetail((prev) => prev ? { ...prev, group: updated } : prev);
    } catch (e) {
      alert(e.message || '儲存失敗');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (id) => {
    if (!window.confirm('確定刪除此班別？')) return;
    try {
      await api.deleteGroup(id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
      if (selectedGroupId === id) { setSelectedGroupId(null); setGroupDetail(null); }
    } catch (e) {
      alert(e.message || '刪除失敗');
    }
  };

  const toggleMember = (userId) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

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
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700">
            + 建立班別
          </button>
        </div>

        {creating && (
          <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50 p-3 space-y-2">
            <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="班別名稱（必填）"
              className="w-full rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
            <input type="text" value={newCompany} onChange={(e) => setNewCompany(e.target.value)}
              placeholder="公司名稱（選填）"
              className="w-full rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
            <select value={newAssessmentId} onChange={(e) => setNewAssessmentId(e.target.value)}
              className="w-full rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-violet-400">
              {assessmentIds.map((id) => (
                <option key={id} value={id}>{getAssessment(id)?.NAME ?? id}</option>
              ))}
            </select>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={handleCreateGroup} disabled={savingGroup}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
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
                  ? 'border-violet-400 bg-violet-50'
                  : 'border-slate-200 bg-white hover:border-violet-200'
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
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-slate-700">成員管理</h3>
                <button type="button" onClick={() => exportGroupCsv(groupDetail.group, groupDetail.submissions, users)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  ⬇ 匯出班級成績 CSV
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {nonAdminUsers.map((u) => (
                  <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50">
                    <input type="checkbox" checked={selectedMembers.includes(u.id)} onChange={() => toggleMember(u.id)}
                      className="accent-violet-600" />
                    <span className="text-sm font-medium text-slate-700">{u.name}</span>
                    <span className="text-xs text-slate-400">{u.email}</span>
                  </label>
                ))}
              </div>

              {groupDetail.group.pendingMembers?.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="mb-1.5 text-xs font-semibold text-amber-600">待加入（尚未註冊，註冊後自動入班）</p>
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

            {/* 批量匯入名單 */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-1 font-semibold text-slate-700">批量匯入名單</h3>
              <p className="mb-2 text-xs text-slate-400">每行一筆，格式：<code className="rounded bg-slate-100 px-1">姓名,Email</code> 或僅 Email。可直接貼上或上傳 CSV。</p>
              <textarea value={rosterText} onChange={(e) => setRosterText(e.target.value)} rows={4}
                placeholder={'王小明,ming@company.com\n李小華,hua@company.com'}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" onClick={handleImportRoster} disabled={importing}
                  className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
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

            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
              <h3 className="mb-2 font-semibold text-violet-700">班級整體評語</h3>
              <textarea value={groupComment} onChange={(e) => setGroupComment(e.target.value)} rows={4}
                placeholder="針對本班整體觀察與評語…"
                className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />

              <p className="mt-3 mb-1.5 text-xs font-semibold text-violet-600 uppercase tracking-wide">班級精進建議</p>
              <div className="space-y-2">
                {groupTips.map((tip, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="mt-2 text-xs font-bold text-violet-400">{i + 1}.</span>
                    <input type="text" value={tip} onChange={(e) => setGroupTips((prev) => prev.map((t, j) => j === i ? e.target.value : t))}
                      placeholder={`班級建議 ${i + 1}`}
                      className="flex-1 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                    />
                    {groupTips.length > 1 && (
                      <button type="button" onClick={() => setGroupTips((prev) => prev.filter((_, j) => j !== i))}
                        className="text-slate-400 hover:text-red-500">✕</button>
                    )}
                  </div>
                ))}
                {groupTips.length < 5 && (
                  <button type="button" onClick={() => setGroupTips((prev) => [...prev, ''])}
                    className="text-xs font-semibold text-violet-600 hover:text-violet-800">+ 新增建議</button>
                )}
              </div>

              <button type="button" onClick={handleSaveGroup} disabled={savingGroup}
                className="mt-4 rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
                {savingGroup ? '儲存中…' : '儲存班級設定'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 主元件 ───────────────────────────────────────────────────
export default function CoachDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('individual');
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.coachOverview()
      .then(setOverview)
      .catch((e) => setError(e.message || '載入失敗'));
  }, []);

  if (!overview && !error) return <p className="py-20 text-center text-slate-400">載入中…</p>;
  if (error) return <p className="py-20 text-center text-red-500">{error}</p>;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-5">
        <h2 className="text-2xl font-extrabold text-slate-800">教練後台</h2>
        <p className="mt-1 text-sm text-slate-500">
          為學員撰寫評語與精進建議，並管理班別整體評量。
        </p>
      </header>

      <div className="mb-5 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm font-semibold w-fit">
        {[
          { id: 'individual', label: '個人評語' },
          { id: 'group', label: '班別管理' },
        ].map(({ id, label }) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={`rounded-md px-4 py-1.5 transition-colors ${
              tab === id ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7">
        {tab === 'individual' && (
          <IndividualTab users={overview.users} submissions={overview.submissions} currentUserId={user.id} />
        )}
        {tab === 'group' && (
          <GroupTab users={overview.users} submissions={overview.submissions} />
        )}
      </div>
    </main>
  );
}
