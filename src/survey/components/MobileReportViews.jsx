import RadarChart from './RadarChart';
import ResultPanel from './ResultPanel';
import GroupNarrativeReport from './GroupNarrativeReport';
import { formatDate } from '../utils/format';
import { badgeBg, dimTextStyle } from '../utils/color';
import { dimLabel } from '../utils/dimensionLabel';
import { badgeText } from '../utils/levelBadge';
import { useState } from 'react';
import { RATER_LABELS } from '../constants/raterTypes';

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

export function GroupReadView({ group, stats, rows, results, config, date, summary = null, prePostChapter = null, courseSummary = null, showRanking = true }) {
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

      {summary && stats.respondents > 0 && (
        <section className="mt-6 space-y-3" aria-label="管理者摘要">
          <h3 className="font-bold text-slate-700">給管理者的一頁摘要</h3>
          <p className="text-sm text-slate-600">參與率 {summary.participation}%（{summary.respondents}／{summary.memberCount} 人）{summary.change ? `；課前課後平均變化 ${summary.change.meanDelta > 0 ? '+' : ''}${summary.change.meanDelta} 分（${summary.change.n} 人配對）` : ''}</p>
          <ListCard title="三個優勢構面" tone="border-emerald-200 bg-emerald-50 read-card-ok" items={summary.strengths.map((d) => ({ id: d.id, name: dimLabel(d), v: `${d.percent}%` }))} valueKey="v" empty="資料不足" />
          <ListCard title="三個優先發展構面" tone="border-brass-200 bg-brass-50 read-card-dev" items={summary.priorities.map((d) => ({ id: d.id, name: dimLabel(d), v: `${d.percent}%` }))} valueKey="v" empty="資料不足" />
          {summary.nextSteps.length > 0 && (
            <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm leading-relaxed text-slate-600">
              <p className="mb-1 font-bold text-slate-800">建議的下一步</p>
              {summary.nextSteps.map((x) => <p key={x.dim} className="mt-1"><strong>{x.dim}：</strong>{x.action}</p>)}
            </div>
          )}
        </section>
      )}

      {prePostChapter && (
        <section className="mt-6" aria-label="課前課後比較">
          <h3 className="mb-1 font-bold text-slate-700">課前課後比較</h3>
          <p className="mb-2 text-xs text-slate-500">只比較兩次都有作答的 {prePostChapter.n} 人（描述性比較）。平均 {prePostChapter.preTotal} → {prePostChapter.postTotal}（{prePostChapter.delta > 0 ? '+' : ''}{prePostChapter.delta} 分）；進步 {prePostChapter.improved}、持平 {prePostChapter.same}、退步 {prePostChapter.declined} 人。</p>
          <ul className="space-y-1.5 text-sm">
            {prePostChapter.dimensions.map((d) => (
              <li key={d.id} className="flex items-baseline justify-between gap-3">
                <span className="font-semibold text-slate-700">{dimLabel(d)}</span>
                <span className="shrink-0 text-slate-600">{d.pre.toFixed(1)} → {d.post.toFixed(1)}（{d.delta > 0 ? '+' : ''}{d.delta}）</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results.length >= 2 && (
        <section className="mt-6">
          <GroupNarrativeReport results={results} assessmentId={group.assessmentId} focusDimensionIds={group.focusDimensionIds ?? []} />
        </section>
      )}

      {courseSummary && (
        <section className="mt-6" aria-label="課後問卷">
          <h3 className="mb-1 font-bold text-slate-700">課後學習成效問卷</h3>
          <p className="text-sm text-slate-600">已完成 {courseSummary.completed}／{courseSummary.expected} 人（{courseSummary.completionRate}%）；推薦指數 NPS {courseSummary.nps?.score ?? '—'}。</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {(courseSummary.dimensions ?? []).map((d) => (
              <li key={d.id} className="flex items-baseline justify-between gap-3"><span className="font-semibold text-slate-700">{d.name}</span><span className="shrink-0 text-slate-600">{d.before} → {d.now}（{d.gain > 0 ? '+' : ''}{d.gain}）</span></li>
            ))}
          </ul>
        </section>
      )}

      {showRanking && rows.length > 0 && (
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
                  {badgeText(r.level.badge)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

const f1 = (n) => (typeof n === 'number' ? n.toFixed(1) : '—');
const signed = (n) => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1));
const KIND_LABEL = { blind: '自評高於他評', hidden: '他評高於自評' };

function ListCard({ title, tone, items, valueKey, empty }) {
  return (
    <section className={`rounded-xl border px-4 py-3 ${tone}`}>
      <h4 className="mb-2 text-sm font-bold text-slate-800">{title}</h4>
      {items.length === 0 ? <p className="text-xs text-slate-500">{empty}</p> : (
        <ul className="space-y-1.5 text-sm">
          {items.map((d) => (
            <li key={d.id} className="flex items-baseline justify-between gap-3">
              <span className="font-semibold text-slate-700">{d.name}</span>
              <span className="shrink-0 text-slate-600">
                {valueKey === 'gap' ? `自 ${f1(d.self)}／他 ${f1(d.others)}（${signed(d.gap)}）` : f1(d[valueKey])}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// 360° 閱讀版：整體評價、自評 vs 他評、各構面、發展建議、討論題。圖表細節（各群組橫條、子能力排名）請看 A4 原版。
export function ThreeSixtyReadView({ report: r, name, date }) {
  const basisKey = r.basis === 'others' ? 'others' : 'self';
  const dims = r.dimensions ?? [];
  const pct = (v) => (typeof v === 'number' ? Math.round((v / 5) * 100) : 0);
  const radarSelf = dims.map((d) => ({ id: d.id, name: d.name, subtitle: d.subtitle, color: d.color, percent: pct(d.self ?? d.others) }));
  const radarCompare = r.hasSelf && r.hasOthers ? dims.map((d) => ({ id: d.id, percent: pct(d.others) })) : null;
  const counts = ['manager', 'peer', 'subordinate'].filter((t) => r.counts[t]).map((t) => `${RATER_LABELS[t]} ${r.counts[t]} 位`);
  return (
    <div className="px-4 pb-8 pt-5">
      <Header kind="360° 完整回饋報告" title={name} sub={`${r.assessmentName} · ${date}`} />
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-slate-100">
          <p className="text-xs text-slate-400">自評</p>
          <p className="text-lg font-extrabold text-slate-800">{r.self ? r.self.total : '—'}</p>
          <p className="text-xs text-slate-500">{r.self ? badgeText(r.self.level?.badge ?? '') : '尚無自評'}</p>
        </div>
        <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-slate-100">
          <p className="text-xs text-slate-400">他評（平均）</p>
          <p className="text-lg font-extrabold text-slate-800">{r.othersSummary ? r.othersSummary.total : '—'}</p>
          <p className="text-xs text-slate-500">{r.othersSummary ? badgeText(r.othersSummary.level?.badge ?? '') : '尚無他評'}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">評分者：{r.hasSelf ? '自評 1 份' : '無自評'}{counts.map((c) => `、${c}`).join('')}</p>

      {r.summaryText && <p className="mt-5 text-sm leading-relaxed text-slate-700">{r.summaryText}</p>}

      <div className="mt-4 space-y-3">
        <ListCard title={r.basis === 'others' ? '他人眼中的三大強項' : '三大強項（自評）'} tone="border-emerald-200 bg-emerald-50 read-card-ok" items={r.strengths} valueKey={basisKey} empty="資料不足" />
        <ListCard title="優先發展的三個構面" tone="border-brass-200 bg-brass-50 read-card-dev" items={r.develop} valueKey={basisKey} empty="資料不足" />
        {r.hasSelf && r.hasOthers && (
          <>
            <ListCard title="可能的盲點（自評高於他評）" tone="border-red-200 bg-red-50 read-card-blind" items={r.blind} valueKey="gap" empty="沒有明顯高估的構面" />
            <ListCard title="被低估的優勢（他評高於自評）" tone="border-sky-200 bg-sky-50 read-card-hidden" items={r.hidden} valueKey="gap" empty="沒有明顯低估的構面" />
          </>
        )}
      </div>

      <section className="mt-6" aria-label="各構面雷達">
        <h3 className="mb-2 text-center font-bold text-slate-700">各構面：自評與他評</h3>
        <div className="flex justify-center"><RadarChart dimensions={radarSelf} compare={radarCompare} compareLabel="他評" friendly /></div>
      </section>

      <section className="mt-6 space-y-3" aria-label="構面詳述">
        <h3 className="font-bold text-slate-700">各構面詳述</h3>
        {dims.map((d) => (
          <article key={d.id} className="rounded-xl border border-slate-100 bg-white px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <h4 className="font-bold text-slate-800"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: d.color }} />{d.name}</h4>
              <span className="shrink-0 text-sm text-slate-600">自 {f1(d.self)}／他 {f1(d.others)}</span>
            </div>
            {d.gap != null && KIND_LABEL[d.kind] && <p className="mt-1 text-xs font-semibold text-slate-500">{KIND_LABEL[d.kind]} {signed(d.gap)}</p>}
            {r.dimTexts?.[d.id] && <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-800">{r.dimTexts[d.id]}</p>}
            {r.narratives?.[d.id] && <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{r.narratives[d.id]}</p>}
          </article>
        ))}
      </section>

      {r.plan?.length > 0 && (
        <section className="mt-6 space-y-3" aria-label="發展建議">
          <h3 className="font-bold text-slate-700">發展建議</h3>
          {r.plan.map((p) => (
            <article key={p.id} className="rounded-xl border border-slate-100 bg-white px-4 py-3">
              <p className="text-xs font-semibold text-brass-600">{p.horizon}</p>
              <h4 className="mb-1 font-bold text-slate-800">{p.title}</h4>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-600">{p.actions.map((a) => <li key={a}>{a}</li>)}</ul>
            </article>
          ))}
        </section>
      )}
      <p className="mt-6 text-xs leading-relaxed text-slate-400">
        360° 回饋反映「他人觀察到的行為頻率與感受」，不是能力的絕對評定；評分者以類別呈現，不列姓名。各群組橫條與子能力排名請看「A4 原版」。
      </p>
    </div>
  );
}

function BatchMember({ m, benchmark }) {
  const [open, setOpen] = useState(false);
  const res = m.submission.result;
  return (
    <li className="rounded-xl border border-slate-100 bg-white">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="min-w-0">
          <span className="font-semibold text-slate-800">{m.name}</span>
          <span className="ml-2 text-sm text-slate-500">{res.total} 分</span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-ink-700">{open ? '收合' : '展開'}</span>
      </button>
      {open && (
        <div className="border-t border-slate-100">
          <PersonalReadView result={res} benchmark={benchmark} user={{ name: m.name, email: m.email }} submittedAt={m.submission.createdAt} comments={m.submission.comments} />
        </div>
      )}
    </li>
  );
}

// 批次報告閱讀版：成員清單，點開才載入該員個人閱讀版（避免一次渲染整班）。
export function BatchReadView({ members, benchmark }) {
  return (
    <div className="px-4 pb-8 pt-5">
      <Header kind="整班個人報告（批次）" title={`共 ${members.length} 份`} sub="點選成員展開個人報告；要整批列印請用上方按鈕（印出的是 A4 版）。" />
      <ol className="space-y-2">
        {members.map((m) => <BatchMember key={m.submission.id} m={m} benchmark={benchmark} />)}
      </ol>
    </div>
  );
}
