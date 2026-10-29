import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { api } from '../api/client';
import { readJSON, writeJSON, removeKey } from '../utils/storage';
import ProgressBar from '../components/ProgressBar';
import QuickGoalButton from '../components/QuickGoalButton';
import {
  ID, NAME, NAME_EN, DIMENSIONS, ALL_QUESTIONS, LIKERT_LABELS, SKILL_LABELS,
  SECTION_A, SECTION_C, SECTION_D, SECTION_E,
} from '../data/assessments/ai-course-post.js';

// 課後學習成效問卷的作答畫面與結果頁。計分與驗證都在伺服器（server/src/lib/courseSurvey.js），
// 這裡只收答案、送出、顯示伺服器算好的結果。設計稿：docs/post-course-survey-design.md。

const draftKey = (userId) => `aiassess_draft_${userId}_${ID}_v1`;

/** 必填欄位（與伺服器的 requiredKeys 一致）。 */
function requiredKeys() {
  const keys = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9'];
  SECTION_A.modules.forEach((m) => keys.push(m.id));
  ALL_QUESTIONS.forEach((q) => keys.push(`${q.id}_before`, `${q.id}_now`));
  SECTION_C.forEach((c) => keys.push(c.id));
  SECTION_D.items.forEach((d) => keys.push(d.id));
  keys.push('d7');
  return keys;
}

const isAnswered = (v) => v !== undefined && v !== null && v !== '';

function ScaleRow({ name, label, value, onChange, min = 1, max = 5, labels = null, invalid }) {
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <fieldset data-key={name} className={`rounded-xl border p-3 ${invalid ? 'border-red-300 bg-red-50/50' : 'border-slate-200'}`} aria-invalid={invalid || undefined}>
      <legend className="px-1 text-sm font-medium text-slate-700">{label}</legend>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {values.map((v) => (
          <label
            key={v}
            className={`flex min-h-[2.5rem] min-w-[2.5rem] cursor-pointer items-center justify-center rounded-lg border px-2 text-sm font-semibold transition-colors ${
              value === v ? 'border-ink-700 bg-ink-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-brass-400'
            }`}
            title={labels?.[v - min]}
          >
            <input type="radio" className="sr-only" name={name} value={v} checked={value === v} onChange={() => onChange(v)} aria-label={labels ? `${v} ${labels[v - min]}` : String(v)} />
            {v}
          </label>
        ))}
      </div>
      {labels && <p className="mt-1 flex justify-between text-[11px] text-slate-400"><span>{labels[0]}</span><span>{labels[labels.length - 1]}</span></p>}
    </fieldset>
  );
}

function Section({ title, hint, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-extrabold text-slate-800">{title}</h2>
      {hint && <p className="mb-3 mt-1 text-sm text-slate-500">{hint}</p>}
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function CoursePostSurvey({ user = { id: 'guest', name: '訪客' }, onSubmitted }) {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState(() => readJSON(draftKey(user.id), {}));
  const [invalid, setInvalid] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [done, setDone] = useState(null); // { result, preDimensions }

  const keys = useMemo(() => requiredKeys(), []);
  const answered = keys.filter((k) => isAnswered(answers[k])).length;

  // 已經交過就直接顯示結果，不要讓人再填一次才被擋下。
  useEffect(() => {
    let active = true;
    api.mySubmissions()
      .then((subs) => {
        if (!active) return;
        const mine = subs.find((s) => s.assessmentId === ID);
        if (mine) setDone({ result: mine.result, preDimensions: preDimensionsOf(subs), fresh: false });
      })
      .catch(() => {})
      .finally(() => active && setChecking(false));
    return () => { active = false; };
  }, []);

  const set = useCallback((key, value) => {
    setAnswers((prev) => {
      const next = { ...prev, [key]: value };
      writeJSON(draftKey(user.id), next);
      return next;
    });
    setInvalid((prev) => (prev.length ? prev.filter((k) => k !== key) : prev));
  }, [user.id]);

  const toggleBarrier = (id) => {
    const cur = answers.d5 ?? [];
    set('d5', cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

  const submit = async () => {
    const missing = keys.filter((k) => !isAnswered(answers[k]));
    if (missing.length > 0) {
      setInvalid(missing);
      setError(`還有 ${missing.length} 題沒有作答，已為您標示。`);
      requestAnimationFrame(() => document.querySelector(`[data-key="${missing[0]}"]`)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }));
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const sub = await api.createSubmission({ assessmentId: ID, answers });
      removeKey(draftKey(user.id));
      let subs = [];
      try { subs = await api.mySubmissions(); } catch { /* 沒有課前結果也能顯示 */ }
      setDone({ result: sub.result, preDimensions: preDimensionsOf(subs), fresh: true, commitment: answers.d6 });
      onSubmitted?.(sub.result);
      window.scrollTo?.({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e.message || '送出失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) return <p className="py-20 text-center text-slate-400">載入中…</p>;
  if (done) return <ResultView {...done} onBack={() => navigate('/home')} />;

  return (
    <div className="card">
      <ProgressBar answered={answered} total={keys.length} />
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-800">{NAME}</h1>
        <p lang="en" className="text-xs text-slate-400">{NAME_EN}</p>
        <p className="mt-2 text-sm text-slate-500">
          這不是考試。請依實際感受作答，約 12–15 分鐘。主辦單位只會看到完成人數與整體彙總，看不到個人答案。
        </p>
      </header>

      <Section title="A 課程體驗" hint="1 非常不同意 … 5 非常同意">
        {SECTION_A.items.map((it) => (
          <ScaleRow key={it.id} name={it.id} label={it.text} value={answers[it.id]} onChange={(v) => set(it.id, v)} labels={LIKERT_LABELS} invalid={invalid.includes(it.id)} />
        ))}
        <ScaleRow name="a9" label={SECTION_A.recommend.text} value={answers.a9} onChange={(v) => set('a9', v)} min={0} max={10} invalid={invalid.includes('a9')} />
        <p className="pt-2 text-sm font-semibold text-slate-600">{SECTION_A.modulesTitle}</p>
        {SECTION_A.modules.map((m) => (
          <ScaleRow key={m.id} name={m.id} label={m.text} value={answers[m.id]} onChange={(v) => set(m.id, v)} invalid={invalid.includes(m.id)} />
        ))}
      </Section>

      <Section title="B 我學到了什麼：課前的我 vs 現在的我" hint="每一項請評兩次。1 完全不會 2 聽過但不會做 3 有範例或協助才能做 4 能獨立做到 5 能教別人">
        {DIMENSIONS.flatMap((d) => d.questions).map((q, idx) => (
          <div key={q.id} className="rounded-xl border border-slate-200 p-3">
            <p className="mb-2 text-sm font-semibold text-slate-700">B{idx + 1} 我能{q.text}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <ScaleRow name={`${q.id}_before`} label="上課前的我" value={answers[`${q.id}_before`]} onChange={(v) => set(`${q.id}_before`, v)} labels={SKILL_LABELS} invalid={invalid.includes(`${q.id}_before`)} />
              <ScaleRow name={`${q.id}_now`} label="現在的我" value={answers[`${q.id}_now`]} onChange={(v) => set(`${q.id}_now`, v)} labels={SKILL_LABELS} invalid={invalid.includes(`${q.id}_now`)} />
            </div>
          </div>
        ))}
      </Section>

      <Section title="C 情境檢核" hint="每題選一個最適合的做法。作答後會顯示解析；主辦單位只看全體答對人數。">
        {SECTION_C.map((c, idx) => (
          <fieldset key={c.id} data-key={c.id} className={`rounded-xl border p-3 ${invalid.includes(c.id) ? 'border-red-300 bg-red-50/50' : 'border-slate-200'}`}>
            <legend className="px-1 text-sm font-semibold text-slate-700">C{idx + 1} {c.text}</legend>
            <div className="mt-1 space-y-1.5">
              {c.options.map((o) => (
                <label key={o.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${answers[c.id] === o.id ? 'border-ink-700 bg-ink-700/5' : 'border-slate-200 hover:border-brass-400'}`}>
                  <input type="radio" name={c.id} value={o.id} checked={answers[c.id] === o.id} onChange={() => set(c.id, o.id)} className="mt-1 accent-ink-700" />
                  <span>{o.text}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </Section>

      <Section title="D 接下來我會怎麼用" hint="1 非常不同意 … 5 非常同意">
        {SECTION_D.items.map((it) => (
          <ScaleRow key={it.id} name={it.id} label={it.text} value={answers[it.id]} onChange={(v) => set(it.id, v)} labels={LIKERT_LABELS} invalid={invalid.includes(it.id)} />
        ))}
        <fieldset className="rounded-xl border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium text-slate-700">最可能阻礙我的是（可複選，可不選）</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {SECTION_D.barriers.map((b) => (
              <label key={b.id} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
                <input type="checkbox" checked={(answers.d5 ?? []).includes(b.id)} onChange={() => toggleBarrier(b.id)} className="accent-ink-700" />
                {b.text}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="d6" className="mb-1 block text-sm font-medium text-slate-700">{SECTION_D.commitment.text}（可不填）</label>
          <textarea id="d6" rows={3} maxLength={500} value={answers.d6 ?? ''} onChange={(e) => set('d6', e.target.value)} placeholder={SECTION_D.commitment.placeholder} className="input" />
        </div>
        <fieldset data-key="d7" className={`rounded-xl border p-3 ${invalid.includes('d7') ? 'border-red-300 bg-red-50/50' : 'border-slate-200'}`}>
          <legend className="px-1 text-sm font-medium text-slate-700">{SECTION_D.followUp.text}</legend>
          <p className="mb-2 text-xs text-slate-500">{SECTION_D.followUp.note}</p>
          <div className="flex gap-2">
            {[['yes', '同意'], ['no', '不同意']].map(([v, text]) => (
              <label key={v} className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-4 py-1.5 text-sm ${answers.d7 === v ? 'border-ink-700 bg-ink-700 text-white' : 'border-slate-200'}`}>
                <input type="radio" className="sr-only" name="d7" value={v} checked={answers.d7 === v} onChange={() => set('d7', v)} />
                {text}
              </label>
            ))}
          </div>
        </fieldset>
      </Section>

      <Section title="E 開放回饋（可不填）">
        {SECTION_E.map((e) => (
          <div key={e.id}>
            <label htmlFor={e.id} className="mb-1 block text-sm font-medium text-slate-700">{e.text}</label>
            <textarea id={e.id} rows={3} maxLength={1000} value={answers[e.id] ?? ''} onChange={(ev) => set(e.id, ev.target.value)} className="input" />
          </div>
        ))}
      </Section>

      {error && <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <button type="button" onClick={submit} disabled={submitting} className="btn-primary w-full disabled:opacity-60">
        {submitting ? '送出中…' : '送出問卷'}
      </button>
    </div>
  );
}

/** 課前評測（ai-competency）最新一筆的構面平均，用來和課後回溯自評對照。 */
function preDimensionsOf(subs) {
  const pre = (subs ?? [])
    .filter((s) => s.assessmentId === 'ai-competency' && (s.raterType ?? 'self') === 'self')
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
  return Object.fromEntries((pre?.result?.dimensions ?? []).map((d) => [d.id, d.average]));
}

function ResultView({ result, preDimensions, fresh, commitment, onBack }) {
  const [consent, setConsent] = useState(Boolean(result?.course?.followUpConsent));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const sjt = result?.course?.sjt ?? [];
  const hasPre = Object.keys(preDimensions ?? {}).length > 0;

  const changeConsent = async (next) => {
    setBusy(true);
    setMsg('');
    try {
      await api.setCourseFollowUp(next);
      setConsent(next);
      setMsg(next ? '已同意，30 天與 60 天後會寄追蹤問卷。' : '已撤回，不會再寄追蹤信。');
    } catch (e) {
      setMsg(e.message || '更新失敗，請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" data-testid="course-post-result">
      <div className="mb-5 flex items-start gap-3">
        <span className="rounded-full bg-emerald-50 p-2 text-emerald-600"><Check className="h-5 w-5" /></span>
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">{fresh ? '感謝您的填答' : '您已完成這份問卷'}</h1>
          <p className="text-sm text-slate-500">{result?.level?.desc}</p>
        </div>
      </div>

      <h2 className="mb-2 font-extrabold text-slate-800">課前的我 vs 現在的我</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-2">構面</th>
              {hasPre && <th className="px-2">課前評測</th>}
              <th className="px-2">課前（回溯）</th>
              <th className="px-2">現在</th>
              <th className="px-2">進步</th>
            </tr>
          </thead>
          <tbody>
            {(result?.dimensions ?? []).map((d) => (
              <tr key={d.id} className="border-b border-slate-100">
                <td className="py-2 pr-2 font-medium text-slate-700">{d.name}</td>
                {hasPre && <td className="px-2 text-slate-500">{preDimensions[d.id] ?? '—'}</td>}
                <td className="px-2 text-slate-500">{d.before}</td>
                <td className="px-2 font-semibold text-slate-800">{d.average}</td>
                <td className={`px-2 font-semibold ${d.gain > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{d.gain > 0 ? `+${d.gain}` : d.gain}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasPre && <p className="mt-2 text-xs text-slate-400">「課前評測」是您先前做的 48 題習慣評測；「課前（回溯）」是您今天回頭評估當時的自己。兩者的差距也是一種資訊：上完課才知道原本不知道自己不會什麼。</p>}

      <h2 className="mb-2 mt-6 font-extrabold text-slate-800">情境檢核 {result?.total ?? 0} / {result?.maxScore ?? 6}</h2>
      <ul className="space-y-3">
        {SECTION_C.map((c, idx) => {
          const r = sjt.find((s) => s.id === c.id);
          const mine = c.options.find((o) => o.id === r?.answer);
          const right = c.options.find((o) => o.id === r?.correctAnswer);
          return (
            <li key={c.id} className="rounded-xl border border-slate-200 p-3 text-sm">
              <p className="flex items-start gap-2 font-semibold text-slate-700">
                {r?.correct ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="答對" /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-label="再想想" />}
                C{idx + 1} {c.text}
              </p>
              {!r?.correct && <p className="mt-1 text-slate-500">您選的：{mine?.text}</p>}
              <p className="mt-1 text-slate-600">建議做法：{right?.text}</p>
              <p className="mt-1 text-xs text-slate-500">{c.explain}</p>
            </li>
          );
        })}
      </ul>

      {fresh && commitment?.trim() && (
        <div className="mt-6 rounded-xl bg-brass-50/60 p-4">
          <p className="mb-1 text-sm font-semibold text-slate-700">您承諾的第一個一週衝刺</p>
          <p className="mb-2 text-sm text-slate-600">{commitment}</p>
          <QuickGoalButton assessmentId="ai-competency" text={commitment} label="訂成我的發展目標（只有我看得到）" />
        </div>
      )}

      <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm">
        <p className="font-semibold text-slate-700">30／60 天後的追蹤問卷：{consent ? '已同意' : '不寄送'}</p>
        <button type="button" disabled={busy} onClick={() => changeConsent(!consent)} className="btn-secondary btn-sm mt-2">
          {consent ? '撤回同意' : '改為同意'}
        </button>
        {msg && <p role="status" className="mt-2 text-xs text-slate-500">{msg}</p>}
      </div>

      <button type="button" onClick={onBack} className="btn-primary mt-6 w-full">回到我的評量</button>
    </div>
  );
}
