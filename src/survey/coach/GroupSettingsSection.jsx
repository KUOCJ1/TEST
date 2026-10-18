import { useRef, useState } from 'react';
import { Target, Star, Download, Search, UserPlus, X } from 'lucide-react';
import { api } from '../api/client';
import { getAssessment } from '../data/assessments/index.js';
import { latestPerUser } from '../utils/analytics';
import { exportGroupCsv } from '../utils/csvExport';
import InfoTip from '../components/InfoTip';
import GroupTimelineCard from '../components/GroupTimelineCard';
import QrCodeCard from '../components/QrCodeCard';
import RaterInvitePanel from '../components/compass/RaterInvitePanel.jsx';

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
// 成員管理（目前成員＋搜尋加入＋CSV 匯出）、批量匯入名單。從 GroupWorkspace 拆出（Sprint
// 5.6）——這些欄位的輸入狀態只在這個分頁存在，切換到「總覽」分頁時本來就該
// 歸零，獨立成元件、由父層在切換班別時 key={group.id} 掛載，行為和拆分前一致。
export default function GroupSettingsSection({
  group, members, invites = [], users, patchedSubmissions, onGroupUpdated, refreshSubmissions, showToast,
}) {
  const [targetHeadcount, setTargetHeadcount] = useState(group.targetHeadcount == null ? '' : String(group.targetHeadcount));
  const [focusDims, setFocusDims] = useState(group.focusDimensionIds ?? []);
  const [dimNotes, setDimNotes] = useState(group.dimensionNotes ?? {});
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [selectedMembers, setSelectedMembers] = useState(group.memberIds ?? []);
  // 姓名／Email 的對照：目前班上的人，加上這次搜尋加入的人（搜尋結果點「加入」時補進來）。
  const [known, setKnown] = useState(() => Object.fromEntries((members ?? []).map((m) => [m.id, m])));
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null); // null＝還沒搜尋；[]＝沒有結果
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const searchTimer = useRef(null);
  const searchSeq = useRef(0);
  const [savingMembers, setSavingMembers] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [rosterText, setRosterText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const toggleFocus = (dimId) =>
    setFocusDims((prev) => (prev.includes(dimId) ? prev.filter((id) => id !== dimId) : [...prev, dimId]));
  const removeMember = (userId) => setSelectedMembers((prev) => prev.filter((id) => id !== userId));
  const addMember = (user) => {
    setKnown((prev) => ({ ...prev, [user.id]: user }));
    setSelectedMembers((prev) => (prev.includes(user.id) ? prev : [...prev, user.id]));
  };

  // 成員搜尋（Sprint 11）：不再一次列出全站名單。至少 2 個字才查、停手 300ms 後才送出，
  // 用序號丟掉過期的回應（慢的舊請求不能蓋掉新結果）。
  const SEARCH_MIN = 2;
  const handleQueryChange = (value) => {
    setQuery(value);
    setSearchError('');
    clearTimeout(searchTimer.current);
    const q = value.trim();
    if (q.length < SEARCH_MIN) { searchSeq.current += 1; setResults(null); setSearching(false); return; }
    setSearching(true);
    const seq = ++searchSeq.current;
    searchTimer.current = setTimeout(() => {
      api.coachUserSearch(q)
        .then((list) => { if (seq === searchSeq.current) { setResults(list); setSearching(false); } })
        .catch((e) => { if (seq === searchSeq.current) { setSearchError(e.message || '搜尋失敗'); setSearching(false); } });
    }, 300);
  };

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
      // 已有帳號的人不會被直接加入：教練送出的是「邀請」，對方接受後才成為成員。
      const invitedCount = selectedMembers.filter((id) => !(updated.memberIds ?? []).includes(id)).length;
      setSelectedMembers(updated.memberIds ?? []);
      await refreshSubmissions();
      showToast(invitedCount > 0 ? `已儲存；已送出 ${invitedCount} 份邀請，對方接受後才會加入班級` : '已儲存成員名單');
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

  const membersDirty = selectedMembers.length !== (group.memberIds ?? []).length
    || selectedMembers.some((id) => !(group.memberIds ?? []).includes(id));
  const candidates = (results ?? []).filter((u) => !selectedMembers.includes(u.id));
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

      {/* 嚴格隱私題庫（領導力羅盤）：他評必須先有邀請；教練可替班上的人安排評分者。 */}
      {getAssessment(group.assessmentId)?.STRICT_RATER_PRIVACY && (
        <div className="panel-secondary">
          <h3 className="mb-1 font-semibold text-slate-700">安排 360° 評分者</h3>
          <p className="mb-3 text-xs text-slate-400">
            受評者也可以自己邀請同班成員。這裡只列出誰被邀請，不顯示誰已完成，也看不到任何個別評分，以保護匿名。
          </p>
          <RaterInvitePanel
            assessmentId={group.assessmentId}
            groupId={group.id}
            members={members ?? []}
            rateeOptions={members ?? []}
          />
        </div>
      )}

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

        <p className="mb-1.5 text-xs font-semibold text-slate-600">
          目前成員（{selectedMembers.length}）
          {membersDirty && <span className="ml-2 font-semibold text-amber-700">· 有尚未儲存的變更</span>}
        </p>
        {selectedMembers.length === 0 ? (
          <p className="mb-3 rounded-lg bg-white px-3 py-3 text-sm text-slate-500">
            還沒有成員。用下方搜尋加入已註冊的人，或給學員報到 QR Code／匯入名單。
          </p>
        ) : (
          <ul className="mb-3 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg bg-white px-3">
            {selectedMembers.map((id) => {
              const m = known[id];
              return (
                <li key={id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-slate-700">{m?.name ?? '（未知用戶）'}</span>
                    {m?.disabled && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">已停用</span>}
                    <span className="ml-2 break-all text-xs text-slate-500">{m?.email}</span>
                  </div>
                  <button type="button" onClick={() => removeMember(id)} aria-label={`移除 ${m?.name ?? '成員'}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">
                    <X aria-hidden="true" className="h-3.5 w-3.5" /> 移除
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <label htmlFor="member-search" className="mb-1 block text-xs font-semibold text-slate-600">搜尋並加入已註冊的用戶</label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input id="member-search" type="search" value={query} onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="輸入姓名或 Email（至少 2 個字）" className="input py-1.5 pl-8 text-sm" autoComplete="off" />
          </div>
          <div aria-live="polite" className="mt-2 text-sm">
            {query.trim().length < SEARCH_MIN && (
              <p className="text-xs text-slate-500">為了保護用戶隱私，不會列出全部用戶；輸入至少 {SEARCH_MIN} 個字才會搜尋，一次最多顯示 10 筆。</p>
            )}
            {searching && <p className="text-xs text-slate-500">搜尋中…</p>}
            {searchError && <p role="alert" className="text-xs text-red-600">{searchError}</p>}
            {!searching && results && results.length === 0 && (
              <p className="text-xs text-slate-500">找不到符合的已註冊用戶。要邀請還沒註冊的人，請用下方「批量匯入名單」，或讓他掃報到 QR Code。</p>
            )}
            {!searching && results && results.length > 0 && candidates.length === 0 && (
              <p className="text-xs text-slate-500">符合的用戶都已經在這個班了。</p>
            )}
            {candidates.length > 0 && (
              <ul className="mt-1 divide-y divide-slate-100">
                {candidates.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <span className="font-medium text-slate-700">{u.name}</span>
                      <span className="ml-2 break-all text-xs text-slate-500">{u.email}</span>
                    </div>
                    <button type="button" onClick={() => addMember(u)} aria-label={`加入 ${u.name}`}
                      className="btn-secondary btn-sm shrink-0 whitespace-nowrap">
                      <UserPlus aria-hidden="true" className="h-3.5 w-3.5" /> 加入
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {invites.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="mb-1.5 flex items-center text-xs font-semibold text-blue-600">
              等待對方接受邀請
              <InfoTip text="已有帳號的人不能被直接加進班級，要由本人在『我的評量』接受邀請後才會成為成員。" />
            </p>
            <div className="flex flex-wrap gap-1.5">
              {invites.map((i) => (
                <span key={i.id} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                  {i.name}
                  <button type="button" aria-label={`取消對 ${i.name} 的邀請`} className="hover:text-red-500"
                    onClick={async () => { await api.coachCancelGroupInvite(group.id, i.id).catch(() => {}); await refreshSubmissions(); }}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

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

        <button type="button" onClick={handleSaveMembers} disabled={savingMembers || !membersDirty}
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
                已加入 {importResult.added} 位、已邀請 {importResult.invited ?? 0} 位現有用戶（對方接受後才加入）、{importResult.pending} 位列入待加入
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
