import { useCallback, useMemo, useRef, useState } from 'react';
import { getAssessment } from './data/assessments/index.js';
import { answeredCount, buildResult, isComplete, unansweredQuestionIds } from './utils/scoring';
import { readJSON, writeJSON } from './utils/storage';
import { resultSummaryText, copyToClipboard } from './utils/format';
import { api } from './api/client';
import ProgressBar from './components/ProgressBar';
import QuestionCard from './components/QuestionCard';
import ResultPanel from './components/ResultPanel';

const ORDINALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const draftKey = (userId, assessmentId) => `aiassess_draft_${userId}_${assessmentId}`;

export default function SurveyApp({ user = { id: 'guest', name: '訪客' }, assessmentId = 'ai-competency', onSubmitted }) {
  const config = useMemo(() => getAssessment(assessmentId), [assessmentId]);

  const storageKey = useMemo(() => draftKey(user.id, assessmentId), [user.id, assessmentId]);
  const [answers, setAnswers] = useState(() => readJSON(storageKey, {}));
  const [phase, setPhase] = useState('pre');
  const [result, setResult] = useState(null);
  const [invalidIds, setInvalidIds] = useState([]);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const questionRefs = useRef({});
  const resultRef = useRef(null);

  const answered = useMemo(() => (config ? answeredCount(answers, config) : 0), [answers, config]);

  const handleChange = useCallback(
    (qid, value) => {
      setAnswers((prev) => {
        const next = { ...prev, [qid]: value };
        writeJSON(storageKey, next);
        return next;
      });
      setInvalidIds((prev) => (prev.length ? prev.filter((id) => id !== qid) : prev));
    },
    [storageKey],
  );

  const handleSubmit = useCallback(async () => {
    if (!config) return;
    if (!isComplete(answers, config)) {
      const missing = unansweredQuestionIds(answers, config);
      setInvalidIds(missing);
      const first = questionRefs.current[missing[0]];
      if (first?.scrollIntoView) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setInvalidIds([]);
    setSubmitError('');
    setSubmitting(true);
    const r = buildResult(answers, config);
    try {
      await api.createSubmission({ answers, result: r, assessmentId, phase });
      setResult(r);
      onSubmitted?.(r);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
    } catch (e) {
      setSubmitError(e.message || '送出失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  }, [answers, config, assessmentId, phase, onSubmitted]);

  const handleRetake = useCallback(() => {
    setAnswers({});
    writeJSON(storageKey, {});
    setResult(null);
    setInvalidIds([]);
    setCopied(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [storageKey]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    const ok = await copyToClipboard(resultSummaryText(result));
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2500);
  }, [result]);

  if (!config) {
    return <p className="py-20 text-center text-red-500">找不到評量設定（id: {assessmentId}）</p>;
  }

  const { DIMENSIONS, TOTAL_QUESTIONS } = config;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl bg-white px-5 py-7 shadow-lg shadow-slate-200/60 sm:px-8">
        <header className="text-center">
          <h1 className="text-2xl font-extrabold text-slate-800 sm:text-3xl">{config.NAME}</h1>
          <p className="mt-2 text-sm text-slate-400">{config.DESCRIPTION}</p>
        </header>

        <div className="mt-5 rounded-xl bg-slate-50 p-4 text-[15px] leading-relaxed text-slate-600">
          歡迎填寫本評測系統。共 <strong className="text-slate-700">{TOTAL_QUESTIONS} 題</strong>，請依真實狀況勾選。
          <br />
          <span className="mt-1 inline-block font-medium text-slate-700">
            評分標準：1 分（非常不同意）～ 5 分（非常同意）
            {DIMENSIONS.some((d) => d.questions.some((q) => q.reversed)) && (
              <span className="ml-2 text-amber-600">· 🔄 標示題目為反向計分</span>
            )}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-500">本次填答屬於：</span>
          {[
            { id: 'pre', label: '課前評測' },
            { id: 'post', label: '課後複測' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPhase(opt.id)}
              aria-pressed={phase === opt.id}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                phase === opt.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <span className="text-xs text-slate-400">課後複測可在「我的分析」看到學習增益</span>
        </div>

        <ProgressBar answered={answered} total={TOTAL_QUESTIONS} />

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          {DIMENSIONS.map((dim, di) => (
            <section key={dim.id} className="mt-7 first:mt-2">
              <h2
                className="rounded-lg px-4 py-2.5 text-[15px] font-bold text-white"
                style={{ background: dim.color }}
              >
                {ORDINALS[di] || di + 1}、{dim.name}
                <span className="ml-1 font-normal opacity-90">（{dim.subtitle}）</span>
              </h2>
              <div className="mt-3 space-y-3">
                {dim.questions.map((q, qi) => (
                  <QuestionCard
                    key={q.id}
                    number={DIMENSIONS.slice(0, di).reduce((s, d) => s + d.questions.length, 0) + qi + 1}
                    question={q}
                    value={answers[q.id]}
                    onChange={handleChange}
                    invalid={invalidIds.includes(q.id)}
                    inputRef={(el) => (questionRefs.current[q.id] = el)}
                  />
                ))}
              </div>
            </section>
          ))}

          {invalidIds.length > 0 && (
            <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              還有 {invalidIds.length} 題尚未作答，已為您標示並捲動至第一題，請補齊後再送出。
            </p>
          )}
          {submitError && (
            <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-3.5 text-lg font-bold text-white shadow-md transition-all hover:from-brand-600 hover:to-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? '送出中…' : '送出評測，立即查看落點分析'}
          </button>
        </form>

        {result && (
          <ResultPanel
            ref={resultRef}
            result={result}
            onRetake={handleRetake}
            onCopy={handleCopy}
            copied={copied}
          />
        )}
      </div>

      <footer className="mt-6 text-center text-xs text-slate-400">本評測結果僅供自我檢視與學習路徑參考。</footer>
    </main>
  );
}
