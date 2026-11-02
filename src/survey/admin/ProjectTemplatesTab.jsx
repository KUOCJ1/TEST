import { useEffect, useState } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { api } from '../api/client';
import { getAssessment, REGISTRY } from '../data/assessments/index.js';
import { useConfirm } from '../components/useConfirm';

// 專案範本：客戶專案開班用的固定組合（評量、附加課後問卷、是否專屬班級）。
// 教練開班選範本後，評量就鎖定，不能另選、也不能事後改成別份——避免客戶專案選錯評量。
const COURSE_ID = 'ai-course-post';
const EMPTY = { name: '', clientName: '', assessmentId: '', withCourseSurvey: false, exclusive: false, notes: '' };

// 可以當班級主要評量的評量（課後問卷只能附加）。
const mainAssessments = Object.entries(REGISTRY).filter(([, c]) => !c.CLASS_ONLY).map(([id, c]) => ({ id, name: c.NAME }));

export default function ProjectTemplatesTab() {
  const confirm = useConfirm();
  const [templates, setTemplates] = useState(null);
  const [form, setForm] = useState(null); // null＝不顯示表單；{ id?, ...欄位 }
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let active = true;
    api.adminProjectTemplates()
      .then((list) => active && setTemplates(list))
      .catch((e) => active && setError(e.message || '載入失敗'));
    return () => { active = false; };
  }, []);

  const startNew = () => { setForm({ ...EMPTY, assessmentId: mainAssessments[0]?.id ?? '' }); setError(''); setMsg(''); };
  const startEdit = (t) => {
    setForm({ id: t.id, name: t.name, clientName: t.clientName, assessmentId: t.assessmentId, withCourseSurvey: t.extraAssessmentIds.includes(COURSE_ID), exclusive: t.exclusive, notes: t.notes });
    setError(''); setMsg('');
  };

  const save = async () => {
    setError('');
    const payload = {
      name: form.name, clientName: form.clientName, assessmentId: form.assessmentId,
      extraAssessmentIds: form.withCourseSurvey ? [COURSE_ID] : [], exclusive: form.exclusive, notes: form.notes,
    };
    try {
      const saved = form.id ? await api.updateProjectTemplate(form.id, payload) : await api.createProjectTemplate(payload);
      setTemplates((prev) => (form.id ? prev.map((t) => (t.id === saved.id ? saved : t)) : [...prev, saved]));
      setForm(null);
      setMsg(form.id ? '已更新範本' : '已建立範本');
    } catch (e) {
      setError(e.message || '儲存失敗');
    }
  };

  const remove = async (t) => {
    if (!(await confirm(`確定刪除範本「${t.name}」？已經用它開的班不受影響（評量不再鎖定）。`))) return;
    try {
      await api.deleteProjectTemplate(t.id);
      setTemplates((prev) => prev.filter((x) => x.id !== t.id));
      setMsg('已刪除範本');
    } catch (e) {
      setError(e.message || '刪除失敗');
    }
  };

  if (templates === null && !error) return <p className="py-10 text-center text-slate-400">載入中…</p>;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-700">專案範本</h3>
        {!form && <button type="button" onClick={startNew} className="btn-primary btn-sm"><Plus className="h-3.5 w-3.5" /> 新增範本</button>}
      </div>
      <p className="mb-4 text-xs text-slate-500">客戶專案用範本開班：評量固定，教練開班時選範本就好，不會選錯評量。</p>

      {error && <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {msg && <p role="status" className="mb-3 text-sm text-emerald-600">{msg}</p>}

      {form && (
        <div className="mb-5 space-y-3 rounded-xl border border-brass-200 bg-brass-50/50 p-4">
          <label className="block text-xs font-semibold text-slate-600">範本名稱
            <input className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例如：森永高階教練 360" />
          </label>
          <label className="block text-xs font-semibold text-slate-600">客戶名稱（開班時預設帶入公司名稱）
            <input className="input mt-1" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
          </label>
          <label className="block text-xs font-semibold text-slate-600">評量（固定）
            <select className="input mt-1" value={form.assessmentId} onChange={(e) => setForm({ ...form, assessmentId: e.target.value })}>
              {mainAssessments.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" className="mt-1 accent-ink-700" checked={form.withCourseSurvey} onChange={(e) => setForm({ ...form, withCourseSurvey: e.target.checked })} />
            <span>附加「課後學習成效問卷」</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" className="mt-1 accent-ink-700" checked={form.exclusive} onChange={(e) => setForm({ ...form, exclusive: e.target.checked })} />
            <span>專屬班級（成員只會看到本班的評量）</span>
          </label>
          <label className="block text-xs font-semibold text-slate-600">備註（選填）
            <textarea className="input mt-1" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={save} className="btn-primary btn-sm">{form.id ? '儲存變更' : '建立範本'}</button>
            <button type="button" onClick={() => setForm(null)} className="btn-ghost btn-sm">取消</button>
          </div>
        </div>
      )}

      {templates?.length === 0 && !form && <p className="text-sm text-slate-400">還沒有範本。</p>}
      <ul className="space-y-2">
        {(templates ?? []).map((t) => (
          <li key={t.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-slate-800">{t.name}{t.clientName && <span className="ml-2 text-xs font-normal text-slate-400">{t.clientName}</span>}</p>
              <p className="text-xs text-slate-500">
                {getAssessment(t.assessmentId)?.NAME ?? t.assessmentId}
                {t.extraAssessmentIds.length > 0 && '・附加課後問卷'}
                {t.exclusive && '・專屬班級'}
              </p>
              {t.notes && <p className="mt-1 text-xs text-slate-400">{t.notes}</p>}
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button type="button" onClick={() => startEdit(t)} className="btn-secondary btn-sm" aria-label={`編輯範本 ${t.name}`}><Pencil className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => remove(t)} className="btn-secondary btn-sm text-red-500" aria-label={`刪除範本 ${t.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
