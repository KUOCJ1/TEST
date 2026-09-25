import { useState } from 'react';
import { Target, Star, Download } from 'lucide-react';
import { api } from '../api/client';
import { getAssessment } from '../data/assessments/index.js';
import { latestPerUser } from '../utils/analytics';
import { exportGroupCsv } from '../utils/csvExport';
import InfoTip from '../components/InfoTip';
import GroupTimelineCard from '../components/GroupTimelineCard';
import QrCodeCard from '../components/QrCodeCard';

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

// 「成員與設定」分頁內容：報到 QR、開課時間軸、評量設定（目標人數／重點構面）、
// 成員管理（勾選＋CSV 匯出）、批量匯入名單。從 GroupWorkspace 拆出（Sprint
// 5.6）——這些欄位的輸入狀態只在這個分頁存在，切換到「總覽」分頁時本來就該
// 歸零，獨立成元件、由父層在切換班別時 key={group.id} 掛載，行為和拆分前一致。
export default function GroupSettingsSection({
  group, directory, users, patchedSubmissions, onGroupUpdated, refreshSubmissions, showToast,
}) {
  const [targetHeadcount, setTargetHeadcount] = useState(group.targetHeadcount == null ? '' : String(group.targetHeadcount));
  const [focusDims, setFocusDims] = useState(group.focusDimensionIds ?? []);
  const [dimNotes, setDimNotes] = useState(group.dimensionNotes ?? {});
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [selectedMembers, setSelectedMembers] = useState(group.memberIds ?? []);
  const [savingMembers, setSavingMembers] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [rosterText, setRosterText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const toggleFocus = (dimId) =>
    setFocusDims((prev) => (prev.includes(dimId) ? prev.filter((id) => id !== dimId) : [...prev, dimId]));
  const toggleMember = (userId) =>
    setSelectedMembers((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsError('');
    try {
      const updated = await api.updateGroup(group.id, {
        targetHeadcount: targetHeadcount === '' ? null : Number(targetHeadcount),
        focusDimensionIds: focusDims,
        dimensionNotes: Object.fromEntries(focusDims.map((id) => [id, (dimNotes[id] ?? '').trim()]).filter(([, v]) => v)),
      });
      onGroupUpdated(updated);
      showToast('已儲存評量設定');
    } catch (e) {
      setSettingsError(e.message || '儲存失敗');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveMembers = async () => {
    setSavingMembers(true);
    setMembersError('');
    try {
      const updated = await api.updateGroup(group.id, { memberIds: selectedMembers });
      onGroupUpdated(updated);
      await refreshSubmissions();
      showToast('已儲存成員名單');
    } catch (e) {
      setMembersError(e.message || '儲存失敗');
    } finally {
      setSavingMembers(false);
    }
  };

  const handleImportRoster = async () => {
    const entries = parseRoster(rosterText);
    if (entries.length === 0) { setImportResult({ error: '沒有可匯入的有效名單' }); return; }
    setImporting(true);
    setImportResult(null);
    try {
      const { group: updated, result } = await api.importRoster(group.id, entries);
      onGroupUpdated(updated);
      setSelectedMembers(updated.memberIds ?? []);
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

  const nonAdminUsers = directory.filter((u) => u.role !== 'admin');
  const dims = getAssessment(group.assessmentId)?.DIMENSIONS ?? [];

  return (
    <div className="space-y-5">
      <GroupTimelineCard group={group} onUpdated={onGroupUpdated} />

      <QrCodeCard group={group} onUpdated={onGroupUpdated} />

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

        {dims.length > 0 && (
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
        )}

        <button type="button" onClick={handleSaveSettings} disabled={savingSettings}
          className="btn-primary btn-sm mt-3">
          {savingSettings ? '儲存中…' : '儲存評量設定'}
        </button>
      </div>

      <div className="panel-secondary">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-700">成員管理</h3>
          <button type="button"
            onClick={() => exportGroupCsv(group, patchedSubmissions, users, getAssessment, latestPerUser)}
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

        {group.pendingMembers?.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="mb-1.5 flex items-center text-xs font-semibold text-amber-600">
              待加入（尚未註冊）
              <InfoTip text="Email 已登錄於班別，但該用戶尚未完成帳號註冊。待其註冊後自動加入本班，無需手動操作。" />
            </p>
            <div className="flex flex-wrap gap-1.5">
              {group.pendingMembers.map((p) => (
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
  );
}
