// 彙整可用性測試的觀察紀錄（docs/ux-test/usability-record-template.csv 的格式）：
// 每個任務的完成率、平均耗時、錯誤次數，以及依嚴重度與出現次數排序的問題清單。
// 用法：node scripts/analyze-usability.mjs <紀錄.csv 或資料夾...> [--out 檔案]
// ⚠️ 5 位受測者的樣本很小，結果用來「找出問題」，不是做統計推論；完成率門檻是建議值，不是標準。
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCsv } from './analyze-compass-review.mjs'

export const THRESHOLDS = { successRate: 0.8 }
const RESULT = { 完成: 'pass', 協助後完成: 'assisted', 失敗: 'fail' }
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const num = (v) => { const n = Number(v); return v !== '' && Number.isFinite(n) ? n : null }

/** @param {object[]} rows 每列：一位受測者在一個任務上的觀察 */
export function analyzeUsability(rows) {
  const tasks = new Map()
  rows.forEach((r) => {
    const task = r['任務']; if (!task) return
    if (!tasks.has(task)) tasks.set(task, { task, runs: [], issues: [] })
    const t = tasks.get(task)
    const result = RESULT[r['結果']] ?? null
    t.runs.push({ who: r['受測者代號'], role: r['角色'], device: r['裝置'], result, seconds: num(r['耗時秒']), errors: num(r['錯誤次數']) ?? 0 })
    const issue = r['卡關描述']
    if (issue) t.issues.push({ who: r['受測者代號'], text: issue, quote: r['原話'] ?? '', severity: num(r['嚴重度']) ?? 0 })
  })
  const out = [...tasks.values()].map((t) => {
    const n = t.runs.length
    const count = (k) => t.runs.filter((x) => x.result === k).length
    const unaided = n ? count('pass') / n : null
    const times = t.runs.map((x) => x.seconds).filter((x) => x !== null)
    return {
      task: t.task, participants: n,
      pass: count('pass'), assisted: count('assisted'), fail: count('fail'),
      unaidedRate: unaided, medianSeconds: median(times),
      errors: t.runs.reduce((a, x) => a + x.errors, 0),
      belowThreshold: unaided !== null && unaided < THRESHOLDS.successRate,
      issues: t.issues,
    }
  })
  // 問題清單：同一描述出現越多人、嚴重度越高越前面
  const grouped = new Map()
  out.forEach((t) => t.issues.forEach((i) => {
    const key = `${t.task}｜${i.text}`
    if (!grouped.has(key)) grouped.set(key, { task: t.task, text: i.text, people: new Set(), maxSeverity: 0, quotes: [] })
    const g = grouped.get(key); g.people.add(i.who); g.maxSeverity = Math.max(g.maxSeverity, i.severity); if (i.quote) g.quotes.push(`${i.who}：${i.quote}`)
  }))
  const issues = [...grouped.values()].map((g) => ({ ...g, people: g.people.size }))
    .sort((a, b) => b.maxSeverity - a.maxSeverity || b.people - a.people)
  return { tasks: out, issues }
}

export function renderUsabilityReport({ tasks, issues }) {
  const pct = (v) => (v === null ? '—' : `${Math.round(v * 100)}%`)
  const lines = ['# 可用性測試彙整', '', '| 任務 | 人數 | 獨立完成 | 協助後完成 | 失敗 | 獨立完成率 | 耗時中位數(秒) | 錯誤次數 |', '|---|---|---|---|---|---|---|---|']
  tasks.forEach((t) => lines.push(`| ${t.task}${t.belowThreshold ? ' ⚠️' : ''} | ${t.participants} | ${t.pass} | ${t.assisted} | ${t.fail} | ${pct(t.unaidedRate)} | ${t.medianSeconds ?? '—'} | ${t.errors} |`))
  lines.push('', `⚠️ = 獨立完成率低於 ${pct(THRESHOLDS.successRate)}（建議門檻，非標準）。樣本很小，用來找問題，不是統計推論。`, '', '## 問題清單（嚴重度高、人數多的在前）', '')
  if (!issues.length) lines.push('沒有記錄到問題。')
  else {
    lines.push('| 嚴重度 | 人數 | 任務 | 問題 | 原話 |', '|---|---|---|---|---|')
    issues.forEach((i) => lines.push(`| ${i.maxSeverity || '—'} | ${i.people} | ${i.task} | ${i.text} | ${i.quotes.join('；') || '—'} |`))
  }
  return lines.join('\n')
}

function csvFiles(inputs) {
  return inputs.flatMap((p) => (statSync(p).isDirectory() ? readdirSync(p).filter((f) => f.toLowerCase().endsWith('.csv')).sort().map((f) => join(p, f)) : [p]))
}

function main(argv) {
  const outIdx = argv.indexOf('--out')
  const files = csvFiles(argv.filter((a, i) => !a.startsWith('--') && i !== outIdx + 1))
  if (!files.length) { console.error('用法：node scripts/analyze-usability.mjs <紀錄.csv 或資料夾...> [--out 檔案]'); process.exit(1) }
  const report = renderUsabilityReport(analyzeUsability(files.flatMap((f) => parseCsv(readFileSync(f, 'utf8')))))
  if (outIdx >= 0) { writeFileSync(argv[outIdx + 1], report); console.log(`已寫入 ${argv[outIdx + 1]}`) } else console.log(report)
}

if (process.argv[1] && process.argv[1].endsWith('analyze-usability.mjs')) main(process.argv.slice(2))
