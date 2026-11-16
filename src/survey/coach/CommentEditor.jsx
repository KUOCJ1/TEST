import { useEffect, useRef, useState } from 'react';
import { X, Plus, Bookmark, BookmarkPlus, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { readJSON, writeJSON, uid } from '../utils/storage';
import { getAssessment } from '../data/assessments/index.js';
import { build360Report } from '../utils/report360.js';
import { buildCommentDraft, DRAFT_MARKER } from '../utils/commentDraft.js';

const draftKey = (id) => `aiassess_comment_draft_${id}_v1`;
const TEMPLATES_KEY = 'aiassess_comment_templates_v1';

// 評語範本（Sprint 28 起存在教練帳號上，換電腦也在）。舊版存在本機 localStorage：
// 第一次載入時若伺服器沒有範本、本機有，提示一鍵匯入。草稿（寫到一半的評語）仍只存本機。
const loadLocalTemplates = () => readJSON(TEMPLATES_KEY, []);

export default function CommentEditor({ submission, existingComment, onSaved, onCancel }) {
  const [text, setText] = useState(() => {
    if (existingComment?.text) return existingComment.text;
    return readJSON(draftKey(submission.id), {}).text ?? '';
  });
  const [tips, setTips] = useState(() => {
    if (existingComment?.tips?.length) return existingComment.tips;
    const d = readJSON(draftKey(submission.id), {});
    return d.tips?.length ? d.tips : [''];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState([]);
  const [localLegacy, setLocalLegacy] = useState([]);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [namingTemplate, setNamingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  useEffect(() => {
    let active = true;
    api.commentTemplates()
      .then((list) => { if (!active) return; setTemplates(list); if (list.length === 0) setLocalLegacy(loadLocalTemplates()); })
      .catch(() => { if (active) setTemplates(loadLocalTemplates()); });
    return () => { active = false; };
  }, []);

  const timerRef = useRef(null);
  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      writeJSON(draftKey(submission.id), { text, tips });
    }, 500);
    return () => clearTimeout(timerRef.current);
  }, [text, tips, submission.id]);

  // 離開（切換學員、關閉抽屜）時把最後 0.5 秒內還沒寫入的輸入補存起來；已儲存成評語就不補存。
  const latestRef = useRef({ text, tips });
  const savedRef = useRef(false);
  useEffect(() => { latestRef.current = { text, tips }; savedRef.current = false; }, [text, tips]);
  useEffect(() => {
    const id = submission.id;
    return () => {
      if (!savedRef.current && (latestRef.current.text || latestRef.current.tips?.some(Boolean))) {
        writeJSON(draftKey(id), latestRef.current);
      }
    };
  }, [submission.id]);

  const setTip = (i, v) => setTips((prev) => prev.map((t, j) => (j === i ? v : t)));
  const addTip = () => setTips((prev) => [...prev, '']);
  const removeTip = (i) => setTips((prev) => prev.filter((_, j) => j !== i));

  const persistTemplates = (list) => {
    setTemplates(list);
    api.saveCommentTemplates(list).then(setTemplates).catch(() => setError('範本儲存失敗，請稍後再試'));
  };

  const importLegacy = () => {
    persistTemplates(localLegacy);
    setLocalLegacy([]);
    try { localStorage.removeItem(TEMPLATES_KEY); } catch { /* ignore */ }
  };

  // 規則式草稿（肯定導向，不呼叫外部 AI）。有內容時先確認再覆蓋。
  const applyDraft = async () => {
    setDrafting(true);
    setConfirmOverwrite(false);
    try {
      let threeSixty = null;
      const cfg = getAssessment(submission.assessmentId);
      if (cfg?.SUPPORTS_360 && !cfg?.STRICT_RATER_PRIVACY) {
        try {
          const subs = await api.rateeSubmissions(submission.userId, submission.assessmentId);
          const rep = build360Report(subs, cfg);
          if (rep) threeSixty = { blind: rep.blind, hidden: rep.hidden };
        } catch { /* 沒有 360° 資料就只用自評 */ }
      }
      const d = buildCommentDraft(submission.result, { threeSixty });
      setText(d.text);
      setTips(d.tips.length ? d.tips : ['']);
    } finally { setDrafting(false); }
  };
  const hasContent = text.trim() !== '' || tips.some((t) => t.trim());
  const onDraftClick = () => (hasContent ? setConfirmOverwrite(true) : applyDraft());

  const applyTemplate = () => {
    const t = templates.find((x) => x.id === selectedTemplateId);
    if (!t) return;
    setText(t.text);
    setTips(t.tips.length ? t.tips : ['']);
  };

  const saveAsTemplate = () => {
    if (!templateName.trim() || !text.trim()) return;
    const template = { id: uid('tpl'), name: templateName.trim(), text, tips: tips.filter((t) => t.trim()) };
    persistTemplates([template, ...templates]);
    setTemplateName('');
    setNamingTemplate(false);
  };

  const removeTemplate = (id) => {
    persistTemplates(templates.filter((t) => t.id !== id));
    if (selectedTemplateId === id) setSelectedTemplateId('');
  };

  // 一鍵插入這位學員的最強／待強化構面名稱，不必自己回頭翻報告找怎麼稱呼。
  const insertDimension = (dim) => {
    if (!dim?.subtitle) return;
    setText((prev) => (prev ? `${prev}「${dim.subtitle}」` : `「${dim.subtitle}」`));
  };

  const handleSave = async () => {
    if (!text.trim()) { setError('請輸入評語內容'); return; }
    if (text.includes(DRAFT_MARKER)) { setError('這是系統草稿，請依你對這位學員的觀察修改後，刪除最上面「草稿」那一行再儲存。'); return; }
    setSaving(true);
    setError('');
    try {
      const comment = await api.upsertComment(submission.id, {
        text: text.trim(),
        tips: tips.filter((t) => t.trim()),
      });
      try { localStorage.removeItem(draftKey(submission.id)); } catch { /* ignore */ }
      savedRef.current = true;
      onSaved(comment);
    } catch (e) {
      setError(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const strongest = submission.result?.strongest;
  const weakest = submission.result?.weakest;

  return (
    <div className="mt-3 rounded-xl border border-brass-200 bg-brass-50 p-4">
      <p className="mb-2 text-sm font-semibold text-brass-600">
        {existingComment ? '編輯評語' : '新增評語'}
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-white/60 p-2">
        {templates.length > 0 && (
          <>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="input !w-auto !py-1.5 text-xs"
            >
              <option value="">選擇我的範本…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button type="button" onClick={applyTemplate} disabled={!selectedTemplateId} className="btn-secondary btn-sm">
              <Bookmark className="h-3.5 w-3.5" /> 套用
            </button>
            {selectedTemplateId && (
              <button
                type="button"
                onClick={() => removeTemplate(selectedTemplateId)}
                aria-label="刪除範本"
                className="btn-icon"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
        {namingTemplate ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="範本名稱"
              className="input !w-32 !py-1.5 text-xs"
            />
            <button type="button" onClick={saveAsTemplate} disabled={!templateName.trim() || !text.trim()} className="btn-primary btn-sm">
              儲存
            </button>
            <button type="button" onClick={() => setNamingTemplate(false)} className="btn-ghost btn-sm">取消</button>
          </div>
        ) : (
          <button type="button" onClick={() => setNamingTemplate(true)} className="btn-ghost btn-sm">
            <BookmarkPlus className="h-3.5 w-3.5" /> 另存為範本
          </button>
        )}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={onDraftClick} disabled={drafting} className="btn-secondary btn-sm">{drafting ? '產生中…' : '帶入草稿'}</button>
        {confirmOverwrite && (
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            會覆蓋目前的內容，確定嗎？
            <button type="button" onClick={applyDraft} className="btn-primary btn-sm">覆蓋</button>
            <button type="button" onClick={() => setConfirmOverwrite(false)} className="btn-ghost btn-sm">取消</button>
          </span>
        )}
        <span className="text-xs text-slate-400">依這位學員的結果組出草稿（肯定導向），只是起點，請依你的觀察修改。</span>
      </div>
      {localLegacy.length > 0 && (
        <p className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-white/60 px-3 py-2 text-xs text-slate-600">
          偵測到這台電腦上有 {localLegacy.length} 個舊的範本。
          <button type="button" onClick={importLegacy} className="btn-secondary btn-sm">匯入到我的帳號</button>
        </p>
      )}

      {(strongest || weakest) && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-400">快速插入：</span>
          {strongest && (
            <button type="button" onClick={() => insertDimension(strongest)} className="chip bg-emerald-50 text-emerald-600 hover:bg-emerald-100">
              最強：{strongest.subtitle}
            </button>
          )}
          {weakest && (
            <button type="button" onClick={() => insertDimension(weakest)} className="chip bg-amber-50 text-amber-600 hover:bg-amber-100">
              待強化：{weakest.subtitle}
            </button>
          )}
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="針對此學員的整體觀察與評語…"
        className="input"
      />

      <p className="mt-3 mb-1.5 text-xs font-semibold text-brass-600 uppercase tracking-wide">精進建議（最多 5 條）</p>
      <div className="space-y-2">
        {tips.map((tip, i) => (
          <div key={i} className="flex gap-2">
            <span className="mt-2 text-xs font-bold text-brass-600">{i + 1}.</span>
            <input
              type="text"
              value={tip}
              onChange={(e) => setTip(i, e.target.value)}
              placeholder={`建議 ${i + 1}`}
              className="input flex-1"
            />
            {tips.length > 1 && (
              <button type="button" onClick={() => removeTip(i)} aria-label="移除此建議" className="btn-icon">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {tips.length < 5 && (
          <button type="button" onClick={addTip} className="inline-flex items-center gap-1 text-xs font-semibold text-brass-600 hover:text-brass-700">
            <Plus className="h-3.5 w-3.5" /> 新增建議
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary btn-sm"
        >
          {saving ? '儲存中…' : '儲存評語'}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost btn-sm">
          取消
        </button>
      </div>
    </div>
  );
}
