import { useEffect, useState } from 'react';
import { Trash2, Plus, Star, Scale, ChevronDown, MoreHorizontal, Check } from 'lucide-react';
import { api } from '../api/client';
import { getAssessment, REGISTRY } from '../data/assessments/index.js';
import PhaseBadge from '../components/PhaseBadge';
import { useIsMobile } from '../hooks/useIsMobile';

// 左側「班別列表」欄位：班別清單 + 建立班別表單。從 GroupWorkspace 拆出
// （Sprint 5.6）——建立/刪除班別的狀態與邏輯只有這裡用得到，獨立成元件後
// GroupWorkspace 不必再管這塊表單的所有輸入欄位。
export default function GroupListPanel({
  groups, setGroups, selectedGroupId, onSelectGroup, onGroupDeleted,
  showToast, confirm, onCompareCohorts,
}) {
  const [creating, setCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newAssessmentId, setNewAssessmentId] = useState('ai-competency');
  // 專案範本（管理員維護）：選了範本，評量就鎖定成範本的評量，不能另選（避免客戶專案選錯評量）。
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newFocusDims, setNewFocusDims] = useState([]);
  const [savingGroup, setSavingGroup] = useState(false);
  const [error, setError] = useState('');
  // 手機：班別列表不佔第一屏，改成頂部「目前班級」按鈕，點開是底部彈出的清單（含建立班別、比較梯次、⋯ 刪除）。
  const mobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuId, setMenuId] = useState(null);
  useEffect(() => {
    if (!sheetOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setSheetOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetOpen]);
  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  // 建立班別時可選的題庫：全部「已啟用」的題庫。以前是從現有班別用過的題庫湊出來的，
  // 所以第一次建班只看得到 AI 職能、沒用過的題庫永遠選不到。載入前／載入失敗時退回
  // 全部內建題庫，不讓下拉選單空掉。
  const [enabledIds, setEnabledIds] = useState(null);
  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => api.assessments())
      .then((list) => { if (active) setEnabledIds(list.map((a) => a.id)); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    Promise.resolve(api.coachProjectTemplates?.())
      .then((list) => { if (active && Array.isArray(list)) setTemplates(list); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  const assessmentIds = Object.keys(REGISTRY).filter((id) => !REGISTRY[id].CLASS_ONLY && (!enabledIds || enabledIds.includes(id)));
  // 預設的 ai-competency 若被管理者停用就不在選項裡，改用第一個可選的，避免畫面顯示 A、實際送出 B。
  const template = templates.find((t) => t.id === templateId) ?? null;
  const selectedId = template ? template.assessmentId : (assessmentIds.includes(newAssessmentId) ? newAssessmentId : (assessmentIds[0] ?? newAssessmentId));
  const newDims = getAssessment(selectedId)?.DIMENSIONS ?? [];
  const toggleNewFocus = (dimId) =>
    setNewFocusDims((prev) => (prev.includes(dimId) ? prev.filter((id) => id !== dimId) : [...prev, dimId]));

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) { setError('請輸入班別名稱'); return; }
    setSavingGroup(true);
    setError('');
    try {
      const group = await api.createGroup({
        name: newGroupName.trim(),
        companyName: newCompany.trim(),
        assessmentId: selectedId,
        ...(template && { templateId: template.id }),
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
      setTemplateId('');
      onSelectGroup(group.id);
      showToast('已建立班別');
    } catch (e) {
      setError(e.message || '建立失敗');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (id) => {
    if (!(await confirm('確定刪除此班別？此操作無法復原。'))) return;
    setError('');
    try {
      await api.deleteGroup(id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
      onGroupDeleted(id);
      showToast('已刪除班別');
    } catch (e) {
      setError(e.message || '刪除失敗');
    }
  };

  return (
    <div className="min-w-0">
      {/* 欄寬固定 16rem（見 GroupWorkspace）：標題與按鈕在同一列放不下，會被擠成
          「班別列／表」「建立班／別」，所以大螢幕時按鈕移到標題下方、各占一半。 */}
      {mobile && (
        <>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            className="mb-3 flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 text-left"
          >
            <span className="min-w-0">
              <span className="block text-xs text-slate-400">目前班級</span>
              <span className="block truncate font-semibold text-slate-800">{selectedGroup ? selectedGroup.name : (groups.length ? '選擇班級' : '尚無班別')}</span>
            </span>
            <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
          </button>
          {sheetOpen && (
            <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setSheetOpen(false)}>
              <div
                role="dialog"
                aria-modal="true"
                aria-label="切換班級"
                className="animate-slide-up max-h-[80dvh] w-full overflow-y-auto rounded-t-2xl bg-white px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-700">切換班級</h3>
                  <button type="button" onClick={() => setSheetOpen(false)} className="btn-ghost btn-sm">關閉</button>
                </div>
                <div className="mb-3 flex gap-2">
                  <button type="button" onClick={() => { setSheetOpen(false); setCreating(true); }} className="btn-primary flex-1">
                    <Plus className="h-4 w-4" /> 建立班別
                  </button>
                  {groups.length >= 2 && (
                    <button type="button" onClick={() => { setSheetOpen(false); onCompareCohorts(); }} className="btn-secondary flex-1">
                      <Scale className="h-4 w-4" /> 比較梯次
                    </button>
                  )}
                </div>
                {groups.length === 0 && <p className="py-4 text-center text-sm text-slate-400">尚無班別</p>}
                <div className="space-y-2">
                  {groups.map((g) => (
                    <div key={g.id}>
                      <div className="flex items-stretch gap-1">
                        <button
                          type="button"
                          onClick={() => { setSheetOpen(false); setMenuId(null); onSelectGroup(g.id); }}
                          aria-current={selectedGroupId === g.id ? 'true' : undefined}
                          className={`flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left ${
                            selectedGroupId === g.id ? 'border-brass-400 bg-brass-50' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-slate-800">{g.name}</span>
                            <span className="block truncate text-xs text-slate-400">
                              {getAssessment(g.assessmentId)?.NAME ?? g.assessmentId} · {g.memberIds.length} 人
                            </span>
                          </span>
                          {selectedGroupId === g.id && <Check className="h-4 w-4 shrink-0 text-brass-600" aria-hidden="true" />}
                        </button>
                        {/* 刪除收進「⋯」：不再是緊貼卡片的小圖示，避免選班級時誤觸。 */}
                        <button
                          type="button"
                          onClick={() => setMenuId(menuId === g.id ? null : g.id)}
                          aria-label={`${g.name} 的更多操作`}
                          aria-expanded={menuId === g.id}
                          className="btn-icon h-auto w-11 self-stretch"
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
                      </div>
                      {menuId === g.id && (
                        <button type="button" onClick={() => handleDeleteGroup(g.id)} className="btn-danger mt-1 w-full">
                          <Trash2 className="h-4 w-4" /> 刪除班別
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
      <div className={`mb-3 flex flex-wrap items-center justify-between gap-2 ${mobile ? 'hidden' : ''}`}>
        <h3 className="whitespace-nowrap font-semibold text-slate-700">班別列表</h3>
        <div className="flex gap-2 lg:w-full">
          {groups.length >= 2 && (
            <button type="button" onClick={onCompareCohorts} className="btn-secondary btn-sm whitespace-nowrap lg:flex-1">
              <Scale className="h-3.5 w-3.5" /> <span className="sr-only sm:not-sr-only">比較梯次</span>
            </button>
          )}
          <button type="button" onClick={() => setCreating(true)} className="btn-primary btn-sm whitespace-nowrap lg:flex-1">
            <Plus className="h-3.5 w-3.5" /> 建立班別
          </button>
        </div>
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
          {templates.length > 0 && (
            <select aria-label="專案範本" value={templateId}
              onChange={(e) => {
                const next = templates.find((t) => t.id === e.target.value);
                setTemplateId(e.target.value);
                setNewFocusDims([]);
                if (next && !newCompany.trim()) setNewCompany(next.clientName ?? '');
              }}
              className="input">
              <option value="">不使用專案範本（自選評量）</option>
              {templates.map((t) => <option key={t.id} value={t.id}>專案範本：{t.name}</option>)}
            </select>
          )}
          <select aria-label="評量題庫" value={selectedId} disabled={!!template}
            onChange={(e) => { setNewAssessmentId(e.target.value); setNewFocusDims([]); }}
            className="input disabled:cursor-not-allowed disabled:opacity-70">
            {(template ? [template.assessmentId] : assessmentIds).map((id) => (
              <option key={id} value={id}>{getAssessment(id)?.NAME ?? id}</option>
            ))}
          </select>
          {template && <p className="text-xs text-brass-600">使用專案範本「{template.name}」：評量已鎖定{template.exclusive ? '，學員只會看到本班評量' : ''}{template.extraAssessmentIds.length ? '，並附加課後問卷' : ''}。</p>}
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

      {groups.length === 0 && !creating && !mobile && (
        <p className="text-sm text-slate-400 py-4 text-center">尚無班別，請點右上角「建立班別」</p>
      )}

      <div className={`space-y-2 ${mobile ? 'hidden' : ''}`}>
        {groups.map((g) => (
          <div key={g.id}
            className={`cursor-pointer rounded-xl border px-4 py-3 transition-colors ${
              selectedGroupId === g.id
                ? 'border-brass-400 bg-brass-50'
                : 'border-slate-200 bg-white hover:border-brass-200'
            }`}
            onClick={() => onSelectGroup(g.id)}
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
  );
}
