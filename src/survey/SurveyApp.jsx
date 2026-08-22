import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Check } from 'lucide-react';
import { getAssessment } from './data/assessments/index.js';
import { answeredCount, buildResult, isComplete, unansweredQuestionIds } from './utils/scoring';
import { readJSON, writeJSON } from './utils/storage';
import { resultSummaryText, copyToClipboard } from './utils/format';
import { api } from './api/client';
import ProgressBar from './components/ProgressBar';
import QuestionCard from './components/QuestionCard';
import ResultPanel from './components/ResultPanel';

const ORDINALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const draftKey = (userId, assessmentId) => `aiassess_draft_${userId}_${assessmentId}_v2`;

export default function SurveyApp({ user = { id: 'guest', name: '訪客' }, assessmentId = 'ai-competency', rateeId, raterType, rateeName, onSubmitted }) {
  const config = useMemo(() => getAssessment(assessmentId), [assessmentId]);
  const navigate = useNavigate();

  const storageKey = useMemo(() => draftKey(user.id, assessmentId), [user.id, assessmentId]);
  const [answers, setAnswers] = useState(() => readJSON(storageKey, {}));
  const [phase, setPhase] = useState('pre');
  // 這個評量若屬於某個班別，班別本身已經知道現在是課前還是課後——不必再讓學員自己
  // 選（S-04）。autoPhase 非 null 時代表已判定並鎖定，只顯示結果供確認；仍在載入
  // 或本來就不屬於任何班別（例如自主重測）時維持原本可手動切換的行為。
  const [autoPhase, setAutoPhase] = useState(null);
  const [result, setResult] = useState(null);
  const [invalidIds, setInvalidIds] = useState([]);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const questionRefs = useRef({});
  const resultRef = useRef(null);

  const answered = useMemo(() => (config ? answeredCount(answers, config) : 0), [answers, config]);

  useEffect(() => {
    if (raterType && raterType !== 'self') return undefined; // 評測他人與課前/課後無關，維持手動
    let active = true;
    Promise.all([api.myGroups(), api.mySubmissions()])
      .then(([groups, subs]) => {
        if (!active) return;
        const group = groups.find((g) => (g.assessmentId ?? 'ai-competency') === assessmentId);
        if (!group) return; // 不屬於任何班別：系統無從判斷，保留手動切換
        const done = new Set(
          subs
            .filter((s) => (s.raterType ?? 'self') === 'self' && s.groupId === group.id)
            .map((s) => s.phase ?? 'pre'),
        );
        const derived = done.has('pre') && !done.has('post') ? 'post' : 'pre';
        setAutoPhase(derived);
        setPhase(derived);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [assessmentId, raterType]);

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
      await api.createSubmission({ answers, result: r, assessmentId, phase, rateeId: rateeId || user.id, raterType: raterType || 'self' });
      setResult(r);
      onSubmitted?.(r);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
    } catch (e) {
      setSubmitError(e.message || '送出失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  }, [answers, config, assessmentId, phase, rateeId, raterType, onSubmitted, user.id]);

  const handleRetake = useCallback(() => {
    if (!window.confirm('確定要重新作答嗎？目前畫面上的作答內容將被清空（先前已送出的紀錄不受影響）。')) return;
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

  // 送出後先停在這頁看結果，使用者按下去才離開——不要一送出就被導頁，
  // 讓自己的分數／落點連一眼都看不到。
  const isRatingOthers = raterType && raterType !== 'self';
  const handleContinue = useCallback(() => {
    navigate(isRatingOthers ? '/360' : `/analysis/${assessmentId}`);
  }, [navigate, isRatingOthers, assessmentId]);

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
              <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                · <RefreshCw className="h-3 w-3" /> 標示題目為反向計分
              </span>
            )}
          </span>
        </div>

        {raterType && raterType !== 'self' && rateeName && (
          <div className="mt-4 rounded-xl border border-brass-200 bg-brass-50 px-4 py-3 text-sm">
            <span className="font-semibold text-brass-600">您正在評估「{rateeName}」</span>
            <span className="ml-1 text-brass-600">的領導力行為表現</span>
          </div>
        )}

        {autoPhase ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5">
            <span className="text-sm font-medium text-slate-500">本次填答屬於：</span>
            <span className="rounded-full bg-ink-700 px-4 py-1.5 text-sm font-semibold text-white shadow-sm">
              {autoPhase === 'post' ? '課後複測' : '課前評測'}
            </span>
            <span className="text-xs text-slate-400">依所屬班別目前階段自動判定</span>
          </div>
        ) : (
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
                    ? 'bg-ink-700 text-white shadow-sm'
                    : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
            <span className="text-xs text-slate-400">課後複測可在「我的分析」看到學習增益</span>
          </div>
        )}

        <ProgressBar answered={answered} total={TOTAL_QUESTIONS} />
        {answered > 0 && !result && (
          <p className="mt-1 flex items-center justify-end gap-1 text-xs text-slate-400">
            <Check className="h-3 w-3" /> 作答進度已自動儲存於本機，離開後可繼續填寫
          </p>
        )}

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
            <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              還有 {invalidIds.length} 題尚未作答，已為您標示並捲動至第一題，請補齊後再送出。
            </p>
          )}
          {submitError && (
            <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {submitError}
            </p>
          )}

          <p className="mt-4 text-center text-xs text-slate-400">
            {autoPhase
              ? `將以「${phase === 'post' ? '課後複測' : '課前評測'}」身份送出。`
              : `將以「${phase === 'post' ? '課後複測' : '課前評測'}」身份送出，如需變更請至上方調整。`}
          </p>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary mt-2 w-full py-3.5 text-lg"
          >
            {submitting ? '送出中…' : '送出評測，立即查看落點分析'}
          </button>
        </form>

        {result && (
          <>
            <ResultPanel
              ref={resultRef}
              result={result}
              onRetake={handleRetake}
              onCopy={handleCopy}
              copied={copied}
            />
            <div className="mt-6 flex justify-center">
              <button type="button" onClick={handleContinue} className="btn-primary px-7 py-3 text-base">
                {isRatingOthers ? '返回 360° 評測 →' : '查看完整分析 →'}
              </button>
            </div>
          </>
        )}
      </div>

      <footer className="mt-6 text-center text-xs text-slate-400">本評測結果僅供自我檢視與學習路徑參考。</footer>
    </main>
  );
}
