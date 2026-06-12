import { useCallback, useMemo, useRef, useState } from 'react';
import { DIMENSIONS, TOTAL_QUESTIONS } from './data/questions';
import {
  answeredCount,
  buildResult,
  isComplete,
  unansweredQuestionIds,
} from './utils/scoring';
import ProgressBar from './components/ProgressBar';
import QuestionCard from './components/QuestionCard';
import ResultPanel from './components/ResultPanel';

const STORAGE_KEY = 'ai-assessment-answers-v1';

function loadAnswers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAnswers(answers) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
  } catch {
    /* localStorage 不可用時靜默忽略 */
  }
}

let questionCounter = 0;
const QUESTION_NUMBER = {};
DIMENSIONS.forEach((d) =>
  d.questions.forEach((q) => {
    QUESTION_NUMBER[q.id] = ++questionCounter;
  }),
);

export default function SurveyApp() {
  const [answers, setAnswers] = useState(loadAnswers);
  const [result, setResult] = useState(null);
  const [invalidIds, setInvalidIds] = useState([]);
  const [copied, setCopied] = useState(false);

  const questionRefs = useRef({});
  const resultRef = useRef(null);

  const answered = useMemo(() => answeredCount(answers), [answers]);

  const handleChange = useCallback((qid, value) => {
    setAnswers((prev) => {
      const next = { ...prev, [qid]: value };
      saveAnswers(next);
      return next;
    });
    setInvalidIds((prev) => (prev.length ? prev.filter((id) => id !== qid) : prev));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!isComplete(answers)) {
      const missing = unansweredQuestionIds(answers);
      setInvalidIds(missing);
      const first = questionRefs.current[missing[0]];
      if (first?.scrollIntoView) {
        first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    setInvalidIds([]);
    setResult(buildResult(answers));
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
  }, [answers]);

  const handleRetake = useCallback(() => {
    setAnswers({});
    saveAnswers({});
    setResult(null);
    setInvalidIds([]);
    setCopied(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    const lines = [
      'AI 全方位職能實戰課前評測 — 結果摘要',
      `總得分：${result.total} / ${result.maxScore}（達成率 ${result.percent}%）`,
      `落點等級：${result.level.badge}（${result.level.badgeEn}）`,
      '',
      '各構面得分：',
      ...result.dimensions.map(
        (d) => `・${d.subtitle}（${d.name}）：${d.score}/${d.max}  ${d.percent}%  ${d.rating.label}`,
      ),
      '',
      `最強構面：${result.strongest.subtitle}  優先強化：${result.weakest.subtitle}`,
    ];
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }, [result]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl bg-white px-5 py-7 shadow-lg shadow-slate-200/60 sm:px-8">
        <header className="text-center">
          <h1 className="text-2xl font-extrabold text-slate-800 sm:text-3xl">
            AI 全方位職能實戰課前評測
          </h1>
          <p className="mt-2 text-sm text-slate-400">AI Competency Pre-course Assessment</p>
        </header>

        <div className="mt-5 rounded-xl bg-slate-50 p-4 text-[15px] leading-relaxed text-slate-600">
          歡迎填寫本評測系統。本問卷旨在評估您目前的 AI 工具應用現況與數位思維落點，共
          <strong className="text-slate-700"> {TOTAL_QUESTIONS} 題</strong>，請依真實狀況勾選。
          <br />
          <span className="mt-1 inline-block font-medium text-slate-700">
            評分標準：1 分（從未如此／極度不熟）～ 5 分（總是如此／精通應用）
          </span>
        </div>

        <ProgressBar answered={answered} total={TOTAL_QUESTIONS} />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          {DIMENSIONS.map((dim) => (
            <section key={dim.id} className="mt-7 first:mt-2">
              <h2
                className="rounded-lg px-4 py-2.5 text-[15px] font-bold text-white"
                style={{ background: dim.color }}
              >
                {['一', '二', '三', '四', '五', '六'][dim.index - 1]}、{dim.name}
                <span className="ml-1 font-normal opacity-90">（{dim.subtitle}）</span>
              </h2>
              <div className="mt-3 space-y-3">
                {dim.questions.map((q) => (
                  <QuestionCard
                    key={q.id}
                    number={QUESTION_NUMBER[q.id]}
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

          <button
            type="submit"
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-3.5 text-lg font-bold text-white shadow-md transition-all hover:from-teal-600 hover:to-teal-700 active:scale-[0.99]"
          >
            送出評測，立即查看落點分析
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

      <footer className="mt-6 text-center text-xs text-slate-400">
        本評測結果僅供課前自我檢視與學習路徑參考。
      </footer>
    </main>
  );
}
