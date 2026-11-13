import RadarChart from './RadarChart';
import ResultPanel from './ResultPanel';
import GroupNarrativeReport from './GroupNarrativeReport';
import { formatDate } from '../utils/format';
import { badgeBg, dimTextStyle } from '../utils/color';
import { dimLabel } from '../utils/dimensionLabel';

// 手機上的「閱讀版」報告（手機 App 化 M6）。
// 手機螢幕上把整份 A4 報告縮到 390px 寬，字級只剩一半，要雙指放大才讀得到（M3 的縮放預覽）。
// 閱讀版改成單欄、正常字級，內容沿用畫面上本來就是響應式的元件（個人：ResultPanel；班級：GroupNarrativeReport），
// 不另寫一套計分或敘事。列印／存 PDF 仍然是原本的 A4 版面（見 PrintableReport／GroupPrintableReport）。
// 閱讀版沒有 A4 版獨有的「執行摘要」「發展計畫」頁；要看完整文件用工具列的「看 A4 原版」。

function Header({ kind, title, sub }) {
  return (
    <header className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{kind}</p>
      <h2 className="mt-0.5 text-xl font-extrabold text-slate-800">{title}</h2>
      {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
    </header>
  );
}

export function PersonalReadView({ result, benchmark, percentile, user, submittedAt, comments = [] }) {
  return (
    <div className="px-4 pb-8 pt-5">
      <Header
        kind="個人評測報告"
        title={user?.name ?? '受測者'}
        sub={`${result.assessmentName ?? ''}${submittedAt ? ` · 評測日期 ${formatDate(submittedAt)}` : ''}`}
      />
      <ResultPanel
        result={result}
        readOnly
        percentile={percentile}
        benchmarkDims={benchmark?.dimensionAverages ?? null}
      />
      {comments.length > 0 && (
        <section className="mt-6" aria-label="指導教練回饋">
          <h3 className="mb-2 font-bold text-slate-700">指導教練回饋</h3>
          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="rounded-xl border border-brass-200 bg-brass-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
                <p className="mb-1 flex justify-between text-xs font-semibold text-brass-600">
                  <span>{c.coachName ?? '教練'}</span>
                  {c.updatedAt && <span>{formatDate(c.updatedAt)}</span>}
                </p>
                <p className="whitespace-pre-wrap">{c.text}</p>
                {c.tips?.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {c.tips.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function GroupReadView({ group, stats, rows, results, config, date }) {
  const dims = stats?.dimensionAverages ?? [];
  const sorted = [...dims].sort((a, b) => b.percent - a.percent);
  return (
    <div className="px-4 pb-8 pt-5">
      <Header
        kind="班級整體分析報告"
        title={group.name}
        sub={`${group.companyName ? `${group.companyName} · ` : ''}${config?.NAME ?? group.assessmentId} · ${date}`}
      />

      <dl className="grid grid-cols-2 gap-2" aria-label="班級關鍵數字">
        {[
          ['已填答', `${stats.respondents}／${group.memberIds?.length ?? rows.length} 人`],
          ['平均總分', stats.respondents > 0 ? String(stats.avgTotal) : '—'],
          ['平均達成率', stats.respondents > 0 ? `${stats.avgPercent}%` : '—'],
          ['最強／待強化', sorted.length ? `${dimLabel(sorted[0])}／${dimLabel(sorted[sorted.length - 1])}` : '—'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white px-4 py-3 ring-1 ring-slate-100">
            <dt className="text-xs text-slate-400">{label}</dt>
            <dd className="mt-0.5 text-lg font-extrabold text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>

      {stats.respondents > 0 && (
        <>
          <section className="mt-6" aria-label="班級整體能力雷達">
            <h3 className="mb-2 text-center font-bold text-slate-700">班級整體能力雷達</h3>
            <div className="flex justify-center"><RadarChart dimensions={dims} friendly /></div>
          </section>

          <section className="mt-6 space-y-3" aria-label="各構面平均">
            <h3 className="font-bold text-slate-700">各構面平均</h3>
            {sorted.map((d) => (
              <div key={d.id}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold dim-text" style={dimTextStyle(d.color)}>{dimLabel(d)}</span>
                  <span className="shrink-0 font-semibold text-slate-600">{d.percent}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${d.percent}%`, background: d.color }} />
                </div>
              </div>
            ))}
          </section>
        </>
      )}

      {results.length >= 2 && (
        <section className="mt-6">
          <GroupNarrativeReport results={results} assessmentId={group.assessmentId} focusDimensionIds={group.focusDimensionIds ?? []} />
        </section>
      )}

      {rows.length > 0 && (
        <section className="mt-6" aria-label="成員排名">
          <h3 className="mb-2 font-bold text-slate-700">成員排名</h3>
          <ol className="space-y-2">
            {rows.map((r, i) => (
              <li key={r.userId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3">
                <span className="min-w-0">
                  <span className="mr-2 text-sm text-slate-400">{i + 1}</span>
                  <span className="font-semibold text-slate-800">{r.name}</span>
                  <span className="ml-2 text-sm text-slate-500">{r.total} 分</span>
                </span>
                <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style={{ background: badgeBg(r.level.color) }}>
                  {r.level.badge}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
