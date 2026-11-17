import { useEffect, useState } from 'react';
import { CalendarPlus, MessageSquareReply, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { formatDate, formatDay, toDateInputValue } from '../utils/format';
import { useConfirm } from '../components/useConfirm';

// 教練會談與會後反思（Sprint 40）：建立一對一／團隊會談 → 學員各自收到「會後反思」待填（四題、預設 3 天內）
// → 這裡看繳交狀況與全文、回一句話。反思全文只有這場會談的教練看得到；班級報告只放彙總。
const STATUS = { submitted: ['已繳交', 'bg-emerald-50 text-emerald-700'], pending: ['未繳', 'bg-slate-100 text-slate-600'], overdue: ['逾期未繳', 'bg-amber-50 text-amber-800'] };
const today = () => toDateInputValue(new Date());

function NewSessionForm({ group, members, prefill, onCreated, onCancel, showToast }) {
  const [type, setType] = useState(prefill?.userId ? 'one-on-one' : 'team');
  const [title, setTitle] = useState(prefill?.title ?? '');
  const [date, setDate] = useState(today());
  const [focus, setFocus] = useState(prefill?.focus ?? '');
  const [ids, setIds] = useState(prefill?.userId ? [prefill.userId] : members.map((m) => m.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toggle = (id) => setIds((cur) => (type === 'one-on-one' ? [id] : cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const setKind = (k) => { setType(k); if (k === 'one-on-one') setIds((cur) => cur.slice(0, 1)); };

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const s = await api.createSession(group.id, { type, title, focus, sessionDate: new Date(`${date}T12:00:00`).toISOString(), participantIds: ids });
      showToast?.(`已建立會談，${s.participants.length} 位學員會收到會後反思`);
      onCreated(s);
    } catch (e) { setError(e.message || '建立失敗'); } finally { setBusy(false); }
  };

  return (
    <section aria-label="建立會談" className="mb-5 rounded-xl border border-brass-200 bg-brass-50 px-4 py-4">
      <h4 className="font-bold text-ink-700">建立會談</h4>
      <fieldset className="mt-3">
        <legend className="text-sm font-medium text-slate-700">類型</legend>
        <div className="mt-1 flex gap-4 text-sm">
          {[['one-on-one', '一對一教練'], ['team', '團隊教練']].map(([k, l]) => (
            <label key={k} className="flex items-center gap-1.5"><input type="radio" name="session-type" checked={type === k} onChange={() => setKind(k)} />{l}</label>
          ))}
        </div>
      </fieldset>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_11rem]">
        <label className="text-sm font-medium text-slate-700">主題
          <input className="input mt-1" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="例如：授權與交辦（第一次）" />
        </label>
        <label className="text-sm font-medium text-slate-700">會談日期
          <input type="date" className="input mt-1" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <label className="mt-3 block text-sm font-medium text-slate-700">本次焦點（學員填反思時看得到，選填）
        <textarea className="input mt-1" rows={2} maxLength={500} value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="例如：延續報告裡「人才發展」偏低的部分，練習一對一回饋" />
      </label>
      <fieldset className="mt-3">
        <legend className="text-sm font-medium text-slate-700">參與學員（{ids.length}）</legend>
        <div className="mt-1 flex max-h-48 flex-wrap gap-2 overflow-y-auto">
          {members.map((m) => (
            <label key={m.id} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${ids.includes(m.id) ? 'border-ink-700/40 bg-white' : 'border-slate-200 bg-white/60 text-slate-500'}`}>
              <input type={type === 'one-on-one' ? 'radio' : 'checkbox'} name="session-member" checked={ids.includes(m.id)} onChange={() => toggle(m.id)} />{m.name}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mt-3 text-xs text-slate-500">建立後，參與的學員會在「我的學習」看到「會後反思」待填（四題：收穫、行動、需要的支持、對這次會談的回饋），期限是會談後 3 天，第 2 天還沒交會收到一封提醒信。反思全文只有你看得到。</p>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn-primary" disabled={busy || !title.trim() || ids.length === 0} onClick={submit}>{busy ? '建立中…' : '建立會談'}</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>取消</button>
      </div>
    </section>
  );
}

function ReplyBox({ session, participant, onSaved }) {
  const [text, setText] = useState(participant.reflection?.coachReply?.text ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
      <label className="sr-only" htmlFor={`reply-${session.id}-${participant.userId}`}>回覆 {participant.name}</label>
      <input id={`reply-${session.id}-${participant.userId}`} className="input flex-1" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="回一句話（學員看得到）" />
      <button type="button" className="btn-secondary btn-sm shrink-0" disabled={busy} onClick={async () => { setBusy(true); try { onSaved(await api.replyReflection(session.id, participant.userId, text)); } finally { setBusy(false); } }}>
        <MessageSquareReply className="h-4 w-4" aria-hidden="true" /> {participant.reflection?.coachReply ? '更新回覆' : '回覆'}
      </button>
    </div>
  );
}

export default function CoachingSessionsSection({ group, members, prefill = null, onPrefillUsed, showToast }) {
  const [sessions, setSessions] = useState(null);
  const [creating, setCreating] = useState(Boolean(prefill));
  const [error, setError] = useState('');
  const confirm = useConfirm();
  const active = members.filter((m) => !m.excluded);

  useEffect(() => {
    let alive = true;
    api.groupSessions(group.id).then((s) => alive && setSessions(s)).catch((e) => alive && setError(e.message || '載入失敗'));
    return () => { alive = false; };
  }, [group.id]);

  const replace = (s) => setSessions((cur) => cur.map((x) => (x.id === s.id ? s : x)));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-serif text-lg font-bold text-ink-700">教練會談與會後反思</h3>
          <p className="text-sm text-slate-500">一對一或團隊教練之後，讓學員留下收穫、行動與回饋；你的評語會出現在學員的反思頁，作為這次會談的起點。</p>
        </div>
        {!creating && <button type="button" className="btn-primary btn-sm" onClick={() => setCreating(true)}><CalendarPlus className="h-4 w-4" aria-hidden="true" /> 建立會談</button>}
      </div>

      {creating && (
        <NewSessionForm
          key={prefill?.userId ?? 'new'}
          group={group}
          members={active}
          prefill={prefill}
          showToast={showToast}
          onCancel={() => { setCreating(false); onPrefillUsed?.(); }}
          onCreated={(s) => { setSessions((cur) => [s, ...(cur ?? [])]); setCreating(false); onPrefillUsed?.(); }}
        />
      )}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {sessions === null ? null : sessions.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">還沒有會談紀錄。做完一對一或團隊教練後，在這裡建立一筆，學員就會收到會後反思。</p>
      ) : (
        <ul className="space-y-4">
          {sessions.map((s) => {
            const done = s.participants.filter((p) => p.status === 'submitted').length;
            return (
              <li key={s.id} className="rounded-xl bg-white px-4 py-4 ring-1 ring-paper-300">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-brass-600">{s.typeLabel}・{formatDay(s.sessionDate)}・期限 {formatDay(s.dueAt)}</p>
                    <h4 className="font-serif font-bold text-slate-900">{s.title}</h4>
                    {s.focus && <p className="mt-0.5 text-sm text-slate-500">焦點：{s.focus}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-600">已繳 {done}／{s.participants.length}</span>
                    {done === 0 && (
                      <button type="button" aria-label={`刪除會談「${s.title}」`} className="btn-icon" onClick={async () => {
                        if (!(await confirm({ title: '刪除這場會談？', message: '學員的會後反思待辦也會一起移除。', confirmLabel: '刪除', danger: true }))) return;
                        await api.deleteSession(s.id); setSessions((cur) => cur.filter((x) => x.id !== s.id));
                      }}><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                </div>
                <ul className="mt-3 divide-y divide-slate-100">
                  {s.participants.map((p) => {
                    const [label, tone] = STATUS[p.status];
                    const r = p.reflection;
                    return (
                      <li key={p.userId} className="py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-800">{p.name}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}{r?.late ? '（逾期繳交）' : ''}</span>
                          {r && <span className="text-xs text-slate-400">{formatDate(r.updatedAt ?? r.submittedAt)}</span>}
                        </div>
                        {r && (
                          <details className="mt-1.5">
                            <summary className="cursor-pointer text-sm font-semibold text-ink-700">看反思內容（對會談的回饋 {r.rating}／5）</summary>
                            <dl className="mt-2 space-y-2 text-sm">
                              <div><dt className="font-semibold text-slate-600">收穫／覺察</dt><dd className="whitespace-pre-wrap text-slate-800">{r.insight}</dd></div>
                              <div><dt className="font-semibold text-slate-600">要做的一個行動</dt><dd className="whitespace-pre-wrap text-slate-800">{r.action}{r.goalId ? '（已設成發展目標）' : ''}</dd></div>
                              {r.support && <div><dt className="font-semibold text-slate-600">需要的支持</dt><dd className="whitespace-pre-wrap text-slate-800">{r.support}</dd></div>}
                              <div><dt className="font-semibold text-slate-600">對這次會談</dt><dd className="text-slate-800">{r.rating}／5{r.ratingNote ? `：${r.ratingNote}` : ''}</dd></div>
                            </dl>
                            <ReplyBox session={s} participant={p} onSaved={replace} />
                          </details>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
