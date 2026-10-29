import { useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { api } from '../api/client';
import { SECTION_A, SECTION_C, SECTION_D } from '../data/assessments/ai-course-post.js';

const COURSE_ID = 'ai-course-post';

/** 班級是否附加了課後問卷。 */
const hasCourseSurvey = (group) => (group?.extraAssessmentIds ?? []).includes(COURSE_ID);

/** 「成員與設定」裡的開關：把課後學習成效問卷附加到這個班（學員的評量清單才會出現它）。 */
export function CourseSurveyToggle({ group, onGroupUpdated, showToast }) {
  const [error, setError] = useState('');
  const attached = hasCourseSurvey(group);
  const change = async (checked) => {
    setError('');
    try {
      const next = checked ? [...(group.extraAssessmentIds ?? []), COURSE_ID] : (group.extraAssessmentIds ?? []).filter((id) => id !== COURSE_ID);
      const updated = await api.updateGroup(group.id, { extraAssessmentIds: next });
      onGroupUpdated?.(updated);
      showToast?.(checked ? '已附加課後學習成效問卷' : '已移除課後學習成效問卷');
    } catch (e) {
      setError(e.message || '儲存失敗');
    }
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={attached} onChange={(e) => change(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-ink-700" />
        <span>
          <span className="font-semibold text-slate-700">附加「課後學習成效問卷」</span>
          <span className="block text-xs text-slate-500">
            勾選後，本班成員的「我的評量」會出現這份問卷（約 12–15 分鐘）。需在班級開放期間內作答，每人一次；承辦與教練只看完成率與彙總，看不到個人答案。
          </span>
        </span>
      </label>
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

const Stat = ({ label, value, sub }) => (
  <div className="rounded-xl bg-slate-50 px-4 py-3">
    <p className="text-xs text-slate-500">{label}</p>
    <p className="text-xl font-extrabold text-slate-800">{value}</p>
    {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
  </div>
);

/** 「總覽」分頁的課後問卷彙總：完成率永遠顯示；少於 3 人時不顯示任何彙總（避免回推個人）。 */
export default function CourseSurveyPanel({ group }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const attached = hasCourseSurvey(group);

  useEffect(() => {
    if (!attached) return undefined;
    let active = true;
    api.getCourseSurveySummary(group.id)
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message || '讀取失敗'));
    return () => { active = false; };
  }, [group.id, attached]);

  if (!attached) return null;
  if (error) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">課後問卷：{error}</p>;
  if (!data) return <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-400 ring-1 ring-slate-100">課後問卷載入中…</p>;

  const mean = (s) => (s && !s.hidden ? s.mean : '—');
  return (
    <section aria-label="課後學習成效問卷" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <h3 className="mb-3 flex items-center gap-1.5 font-extrabold text-slate-800"><ClipboardCheck className="h-4 w-4 text-brass-600" /> 課後學習成效問卷</h3>
      <div className="mb-3">
        <div className="mb-1 flex justify-between text-sm"><span className="text-slate-600">完成率</span><span className="font-semibold text-slate-800">{data.completed} / {data.expected} 人（{data.completionRate}%）</span></div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={data.completionRate} aria-valuemin={0} aria-valuemax={100} aria-label="課後問卷完成率">
          <div className="h-full rounded-full bg-ink-700" style={{ width: `${data.completionRate}%` }} />
        </div>
      </div>

      {data.hidden ? (
        <p className="text-sm text-slate-500">完成人數少於 {data.minN} 人，為避免回推個人答案，彙總暫不顯示。</p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="整體滿意度（1–5）" value={mean(data.satisfaction.a8)} />
            <Stat label="推薦度 NPS" value={data.nps.score} sub={`推薦者 ${data.nps.promoters}、貶損者 ${data.nps.detractors}`} />
            <Stat label="同意收追蹤信" value={`${data.followUp?.consented ?? data.followUpConsent} 人`} sub={data.followUp?.due30 ? `30 天 ${data.followUp.due30}／60 天 ${data.followUp.due60}` : undefined} />
            <Stat label="下週五前完成衝刺（1–5）" value={mean(data.commitment.d1)} />
          </div>

          <div>
            <h4 className="mb-1 text-sm font-bold text-slate-700">各構面：課前（回溯）→ 現在</h4>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500"><th className="py-1">構面</th><th>課前</th><th>現在</th><th>進步</th><th>有進步的人數</th></tr></thead>
              <tbody>
                {data.dimensions.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100"><td className="py-1.5 font-medium text-slate-700">{d.name}</td><td>{d.before}</td><td className="font-semibold">{d.now}</td><td className="font-semibold text-emerald-600">{d.gain > 0 ? `+${d.gain}` : d.gain}</td><td>{d.improved} / {data.completed}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h4 className="mb-1 text-sm font-bold text-slate-700">各單元對學員的幫助（1–5）</h4>
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {SECTION_A.modules.map((m, i) => <li key={m.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5"><span>{m.text}</span><span className="font-semibold">{mean(data.modules[i])}</span></li>)}
            </ul>
          </div>

          <div>
            <h4 className="mb-1 text-sm font-bold text-slate-700">情境檢核：答對人數（決定要補強什麼）</h4>
            <ul className="space-y-1 text-sm">
              {SECTION_C.map((c, i) => {
                const r = data.sjt.find((x) => x.id === c.id);
                return <li key={c.id} className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-1.5"><span>C{i + 1} {c.text}</span><span className="shrink-0 font-semibold">{r?.correct} / {r?.n}</span></li>;
              })}
            </ul>
          </div>

          <div>
            <h4 className="mb-1 text-sm font-bold text-slate-700">最可能的阻礙（人數）</h4>
            <p className="flex flex-wrap gap-2 text-sm">
              {SECTION_D.barriers.map((b) => <span key={b.id} className="rounded-full bg-slate-100 px-3 py-1">{b.text} <strong>{data.barriers[b.id] ?? 0}</strong></span>)}
            </p>
          </div>

          {[['e1', '最有價值的收穫'], ['e2', '希望調整或加強'], ['e3', '工作上最想用 AI 解決的痛點'], ['d6', '承諾的第一個一週衝刺']].map(([key, title]) => (
            <details key={key} className="rounded-xl border border-slate-200 px-4 py-2">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">{title}（{data.openText[key].length} 則，不附姓名）</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">{data.openText[key].map((t, i) => <li key={`${i}-${t}`}>{t}</li>)}</ul>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
