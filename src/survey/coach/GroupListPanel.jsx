import { useState } from 'react';
import { Trash2, Plus, Star, Scale } from 'lucide-react';
import { api } from '../api/client';
import { getAssessment } from '../data/assessments/index.js';
import PhaseBadge from '../components/PhaseBadge';

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
  const [newTarget, setNewTarget] = useState('');
  const [newFocusDims, setNewFocusDims] = useState([]);
  const [savingGroup, setSavingGroup] = useState(false);
  const [error, setError] = useState('');

  const assessmentIds = [...new Set(groups.map((g) => g.assessmentId ?? 'ai-competency'))];
  const newDims = getAssessment(newAssessmentId)?.DIMENSIONS ?? [];
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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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
