import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { REGISTRY } from '../data/assessments/index.js';
import { getBuiltinContent } from '../data/assessments/overrides.js';
import { useToast } from '../components/useToast';
import { useConfirm } from '../components/useConfirm';
import { useContent } from '../content/useContent';
import LoadingState from '../components/LoadingState';
import { formatDate } from '../utils/format';
import { EditableField, Group, Section } from './ContentFields';
import {
  LIMITS, normalizeEdits, emptyEdits, getEdit, setEdit, countEdits, sameEdits, findOverLimit,
} from './contentEdits';

const IDS = Object.keys(REGISTRY);
const storeKey = (id) => `content-edits:${id}`;
// 編輯到一半換分頁、換題庫都不該洗掉：未存檔的編輯暫存在 sessionStorage（關掉分頁即清除）。
// 這是便利功能，不能因為瀏覽器擋儲存就壞掉，所以全部 try/catch。
const readStored = (id) => { try { const raw = sessionStorage.getItem(storeKey(id)); return raw ? JSON.parse(raw) : null; } catch { return null; } };
const writeStored = (id, edits) => { try { if (edits) sessionStorage.setItem(storeKey(id), JSON.stringify(edits)); else sessionStorage.removeItem(storeKey(id)); } catch { /* ignore */ } };

const baseOf = (rec) => normalizeEdits(rec?.draft?.overrides ?? rec?.published?.overrides);

/**
 * 管理後台「題庫內容」分頁（Sprint 10）：改構面／子能力名稱、題目、評語與等級說明的**文字**。
 * 草稿 → 預覽 → 發佈，歷史可還原。題數、反向題、分數門檻不在這裡（會影響計分）。
 */
export default function ContentEditorTab() {
  const [assessmentId, setAssessmentId] = useState(IDS[0]);
  return (
    <div className="space-y-4">
      <div className="panel-secondary rounded-xl p-4">
        <h3 className="font-semibold text-slate-700">題庫內容</h3>
        <p className="mt-1 text-sm text-slate-600">
          修改構面名稱、題目、評語與等級說明的文字。改完先<strong>儲存草稿</strong>，用<strong>預覽</strong>在自己的畫面確認，
          再<strong>發佈</strong>——發佈後所有學員與教練立刻看到新文字，也可以隨時還原到之前的版本。
        </p>
        <p className="mt-2 text-sm text-slate-600">
          <strong>不能在這裡修改</strong>：題目數量、新增或刪除題目、反向題、分數門檻與等級區間、風格型題庫（DISC、識己®）的風格內容。
          這些會影響計分，仍需由工程師修改程式碼。<strong>已經送出的作答分數與等級完全不受影響</strong>。
        </p>
        <div className="mt-3 max-w-md">
          <label htmlFor="content-assessment" className="mb-1 block text-xs font-semibold text-slate-600">選擇題庫</label>
          <select id="content-assessment" className="input" value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)}>
            {IDS.map((id) => <option key={id} value={id}>{REGISTRY[id].NAME}</option>)}
          </select>
        </div>
      </div>
      <ContentEditor key={assessmentId} assessmentId={assessmentId} />
    </div>
  );
}

function ContentEditor({ assessmentId }) {
  const cfg = REGISTRY[assessmentId];
  const builtin = getBuiltinContent(assessmentId);
  const showToast = useToast();
  const confirm = useConfirm();
  const { previewDraft, stopPreview, previewing, reload } = useContent();

  const [content, setContent] = useState(null);
  const [edits, setEdits] = useState(emptyEdits);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [note, setNote] = useState('');

  const base = baseOf(content);
  const dirty = Boolean(content) && !sameEdits(edits, base);
  const hasDraft = Boolean(content?.draft);
  const overLimit = findOverLimit(edits);
  const modifiedCount = countEdits(edits);

  const load = useCallback(() => api.adminAssessmentContent(assessmentId)
    .then((rec) => {
      const stored = readStored(assessmentId);
      setContent(rec);
      if (stored && !sameEdits(stored, baseOf(rec))) { setEdits(normalizeEdits(stored)); setRestored(true); }
      else setEdits(baseOf(rec));
    })
    .catch((e) => setError(e.message || '載入失敗')), [assessmentId]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (next) => {
    setEdits(next);
    writeStored(assessmentId, sameEdits(next, base) ? null : next);
  };
  const adopt = (rec, nextEdits) => { setContent(rec); setEdits(nextEdits); writeStored(assessmentId, null); setRestored(false); };

  const run = async (fn, failMessage) => {
    setBusy(true); setError('');
    try { return await fn(); } catch (e) { setError(e.message || failMessage); return null; } finally { setBusy(false); }
  };

  const saveDraft = () => run(async () => {
    const rec = await api.adminSaveContentDraft(assessmentId, edits);
    adopt(rec, baseOf(rec));
    showToast('已儲存草稿');
    return rec;
  }, '儲存失敗');

  const preview = async () => {
    const rec = dirty ? await saveDraft() : content;
    if (!rec) return;
    previewDraft(assessmentId, rec.draft?.overrides ?? edits);
    showToast('預覽中：到「我的評量」或開始作答頁就能看到新文字');
  };

  const discard = async () => {
    const msg = hasDraft ? '確定丟棄草稿？草稿與未儲存的編輯都會消失（已發佈的內容不受影響）。' : '確定放棄未儲存的編輯？';
    if (!(await confirm({ title: '丟棄修改', message: msg, confirmLabel: '丟棄', danger: true }))) return;
    await run(async () => {
      const rec = hasDraft ? await api.adminDiscardContentDraft(assessmentId) : content;
      adopt(rec, baseOf(rec));
      if (previewing) stopPreview();
    }, '丟棄失敗');
  };

  const publish = () => run(async () => {
    const rec = await api.adminPublishContent(assessmentId, note);
    adopt(rec, baseOf(rec));
    setPublishing(false); setNote('');
    await reload(); // 重抓已發佈內容並套用，也會結束預覽
    showToast(`已發佈版本 ${rec.published.version}`);
  }, '發佈失敗');

  const rollback = async (version) => {
    const label = version === 0 ? '內建原文' : `版本 ${version}`;
    if (!(await confirm({ title: '還原', message: `確定還原成${label}？會以新版本發佈，所有學員與教練立刻看到。`, confirmLabel: '還原' }))) return;
    await run(async () => {
      const rec = await api.adminRollbackContent(assessmentId, version);
      adopt(rec, baseOf(rec));
      await reload();
      showToast(`已還原成${label}`);
    }, '還原失敗');
  };

  if (!content) return error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : <LoadingState />;

  // 目前輸入框要顯示的值：有覆寫用覆寫，否則內建原文。
  const val = (group, id, field, original) => getEdit(edits, group, id, field) ?? original;
  const on = (group, id, field, original) => (v) => update(setEdit(edits, group, id, field, v, original));
  const count = (...groups) => countEdits(Object.fromEntries(groups.map((g) => [g, edits[g]])));
  const number = Object.fromEntries(cfg.ALL_QUESTIONS.map((q, i) => [q.id, i + 1]));
  const published = content.published;
  const levels = cfg.PROFILE_MODE ? [] : (cfg.LEVELS ?? []);
  const commentaryIds = Object.keys(builtin.commentary);

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {restored && (
        <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          已還原你上次尚未儲存的編輯。
        </p>
      )}

      <div className="panel-secondary space-y-1 rounded-xl p-4 text-sm text-slate-600">
        <p>
          <span className="font-semibold text-slate-700">目前生效：</span>
          {published
            ? `版本 ${published.version}（${formatDate(published.publishedAt)}${published.publishedByName ? `，${published.publishedByName}` : ''}）— ${published.note}`
            : '內建原文（還沒有發佈過任何修改）'}
        </p>
        <p>
          <span className="font-semibold text-slate-700">草稿：</span>
          {hasDraft ? `有（${formatDate(content.draft.updatedAt)} 儲存）` : '無'}
          {dirty && <span className="ml-2 font-semibold text-amber-700">· 另有尚未儲存的編輯</span>}
          <span className="ml-2">· 目前編輯中共 {modifiedCount} 處與內建原文不同</span>
        </p>
        {overLimit && <p role="alert" className="font-semibold text-red-600">有欄位超過字數上限，請先縮短才能儲存。</p>}
        <div className="flex flex-wrap gap-2 pt-2">
          <button type="button" className="btn-primary btn-sm whitespace-nowrap" disabled={!dirty || busy || Boolean(overLimit)} onClick={saveDraft}>儲存草稿</button>
          <button type="button" className="btn-secondary btn-sm whitespace-nowrap" disabled={busy || Boolean(overLimit) || (!dirty && !hasDraft)} onClick={preview}>預覽草稿</button>
          <button type="button" className="btn-secondary btn-sm whitespace-nowrap" disabled={busy || dirty || !hasDraft} onClick={() => setPublishing(true)} title={dirty ? '請先儲存草稿' : undefined}>發佈…</button>
          <button type="button" className="btn-ghost btn-sm whitespace-nowrap" disabled={busy || (!dirty && !hasDraft)} onClick={discard}>{hasDraft ? '丟棄草稿' : '放棄編輯'}</button>
        </div>
        {dirty && <p className="text-xs text-slate-500">發佈前要先儲存草稿。</p>}
        {publishing && (
          <div className="mt-3 rounded-lg border border-brass-200 bg-brass-50 p-3">
            <label htmlFor="content-note" className="mb-1 block text-xs font-semibold text-slate-700">發佈備註（必填，讓之後看歷史時知道改了什麼）</label>
            <input id="content-note" className="input text-sm" maxLength={LIMITS.note} value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：修正第 3 題錯字" />
            <p className="mt-2 text-xs text-slate-600">發佈後，所有學員與教練會立刻看到新文字（已作答的分數不受影響）。</p>
            <div className="mt-2 flex gap-2">
              <button type="button" className="btn-primary btn-sm whitespace-nowrap" disabled={busy || !note.trim()} onClick={publish}>確認發佈</button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setPublishing(false)}>取消</button>
            </div>
          </div>
        )}
      </div>

      <Section title="構面與子能力名稱" modifiedCount={count('dimensions', 'subDimensions')} defaultOpen>
        {cfg.DIMENSIONS.map((d) => {
          const b = builtin.dimensions[d.id];
          return (
            <Group key={d.id} title={`構面：${b.name}`}>
              <div className="grid gap-x-4 sm:grid-cols-2">
                <EditableField label="構面名稱" max={LIMITS.dimensionName} builtin={b.name} value={val('dimensions', d.id, 'name', b.name)} onChange={on('dimensions', d.id, 'name', b.name)} />
                {typeof b.subtitle === 'string' && (
                  <EditableField label="副標" max={LIMITS.dimensionSubtitle} builtin={b.subtitle} value={val('dimensions', d.id, 'subtitle', b.subtitle)} onChange={on('dimensions', d.id, 'subtitle', b.subtitle)} />
                )}
              </div>
              {(d.subDimensions ?? []).length > 0 && (
                <div className="grid gap-x-4 sm:grid-cols-2">
                  {d.subDimensions.map((sd) => {
                    const sb = builtin.subDimensions[sd.id];
                    return (
                      <EditableField key={sd.id} label={`子能力：${sb.name}`} max={LIMITS.subDimensionName} builtin={sb.name} value={val('subDimensions', sd.id, 'name', sb.name)} onChange={on('subDimensions', sd.id, 'name', sb.name)} />
                    );
                  })}
                </div>
              )}
            </Group>
          );
        })}
      </Section>

      <Section title="題目文字" modifiedCount={count('questions')} hint={`共 ${cfg.ALL_QUESTIONS.length} 題`}>
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <strong>反向題</strong>（標示「反向題」）的意思是「同意程度越高、分數越低」。改寫反向題時，句子必須<strong>維持反向的語意</strong>，
          否則學員的分數會被算反——系統不會替你檢查。
        </p>
        {cfg.DIMENSIONS.map((d) => (
          <div key={d.id} className="mt-4">
            <h4 className="text-sm font-semibold text-slate-700">{builtin.dimensions[d.id].name}</h4>
            {d.questions.map((q) => {
              const original = builtin.questions[q.id];
              return (
                <EditableField
                  key={q.id}
                  multiline
                  label={`第 ${number[q.id]} 題${q.reversed ? '（反向題）' : ''}`}
                  max={LIMITS.question}
                  builtin={original}
                  value={val('questions', q.id, null, original)}
                  onChange={on('questions', q.id, null, original)}
                />
              );
            })}
          </div>
        ))}
      </Section>

      {commentaryIds.length > 0 && (
        <Section title="子能力評語" modifiedCount={count('commentary')} hint="報告中依分數區間顯示">
          <p className="mt-3 text-xs text-slate-500">
            每個子能力有三段評語，依該子能力平均分數顯示：高（≥ 4.5）、中（3.5–4.49）、低（&lt; 3.5）。
          </p>
          {commentaryIds.map((subId) => {
            const name = builtin.subDimensions[subId]?.name ?? subId;
            return (
              <Group key={subId} title={name}>
                {[['high', '高分評語（平均 ≥ 4.5）'], ['mid', '中間評語（3.5–4.49）'], ['low', '待加強評語（< 3.5）']].map(([field, label]) => (
                  <EditableField
                    key={field}
                    multiline
                    label={label}
                    max={LIMITS.commentary}
                    builtin={builtin.commentary[subId][field]}
                    value={val('commentary', subId, field, builtin.commentary[subId][field])}
                    onChange={on('commentary', subId, field, builtin.commentary[subId][field])}
                  />
                ))}
              </Group>
            );
          })}
        </Section>
      )}

      {levels.length > 0 && (
        <Section title="落點等級說明" modifiedCount={count('levels')} hint="徽章與分數區間不能改">
          {levels.map((l) => (
            <Group key={l.id} title={`${l.badge}（${l.min}–${l.max} 分）`}>
              <EditableField multiline label="等級說明" max={LIMITS.levelText} builtin={builtin.levels[l.id].desc} value={val('levels', l.id, 'desc', builtin.levels[l.id].desc)} onChange={on('levels', l.id, 'desc', builtin.levels[l.id].desc)} />
              <EditableField multiline label="發展建議" max={LIMITS.levelText} builtin={builtin.levels[l.id].advice} value={val('levels', l.id, 'advice', builtin.levels[l.id].advice)} onChange={on('levels', l.id, 'advice', builtin.levels[l.id].advice)} />
            </Group>
          ))}
        </Section>
      )}

      <Section title="發佈歷史" hint={`最近 ${content.history.length} 筆`}>
        {content.history.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">還沒有發佈過。</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {content.history.map((h) => {
              const current = published?.version === h.version;
              return (
                <li key={h.version} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-700">
                      版本 {h.version} · {h.kind === 'rollback' ? '還原' : '發佈'}
                      {current && <span className="chip ml-2 bg-emerald-100 text-emerald-800">目前生效</span>}
                    </p>
                    <p className="text-xs text-slate-500">{formatDate(h.publishedAt)}{h.publishedByName ? ` · ${h.publishedByName}` : ''} · {h.note}</p>
                  </div>
                  {!current && (
                    <button type="button" className="btn-secondary btn-sm whitespace-nowrap" disabled={busy} onClick={() => rollback(h.version)}>還原到此版本</button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {published && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <button type="button" className="btn-secondary btn-sm whitespace-nowrap" disabled={busy} onClick={() => rollback(0)}>全部還原成內建原文</button>
            <p className="mt-1 text-xs text-slate-500">以新版本發佈一份「空的覆寫」，歷史紀錄不會被刪除。歷史只保留最近 20 筆。</p>
          </div>
        )}
      </Section>
    </div>
  );
}
