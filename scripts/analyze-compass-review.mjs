// 彙整專家審題表（相關性／清晰度／像他牌題目）與認知前測紀錄，產出「哪些題要修」的清單。
// 輸入是 export-leadership-review-sheet.mjs 與 export-leadership-pretest-sheet.mjs 匯出、經專家與訪談者填寫後的 CSV。
//
// 用法：
//   node scripts/analyze-compass-review.mjs --experts <資料夾或多個CSV> --pretest <資料夾或多個CSV> [--out docs/leadership-new/review/analysis.md]
//   （--experts 與 --pretest 至少給一個；資料夾內只讀 .csv）
//
// ⚠️ 門檻（I-CVI ≥ 0.78 等）是常見的量表發展經驗法則，這裡「照一般說法實作」但沒有逐一查證原始文獻；
//    正式報告前請對照文獻，並依專家人數調整（人數少時通常要求更嚴格）。
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const CVI = { minExperts: 6, itemMin: 0.78, strictItemMin: 1.0, scaleAveMin: 0.9, rating: 3 }

/** 簡易 CSV 解析（支援雙引號、換行、雙引號跳脫、BOM）。 */
export function parseCsv(text) {
  const rows = []
  let row = []; let cell = ''; let inQ = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]
    if (inQ) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i += 1 } else inQ = false } else cell += ch
    } else if (ch === '"') inQ = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (ch !== '\r') cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  const [header, ...body] = rows.filter((r) => r.some((c) => c !== ''))
  if (!header) return []
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])))
}

const num = (v) => { const n = Number(v); return Number.isFinite(n) && v !== '' ? n : null }
const col = (row, prefix) => row[Object.keys(row).find((k) => k.startsWith(prefix))] ?? ''

/**
 * @param {Array<{expert: string, rows: object[]}>} sheets 每位專家一份
 * @returns {{items: object[], experts: number, sCviRelevance: number|null, sCviClarity: number|null, threshold: number}}
 */
export function analyzeExperts(sheets) {
  const experts = sheets.length
  const threshold = experts >= CVI.minExperts ? CVI.itemMin : CVI.strictItemMin
  const byItem = new Map()
  sheets.forEach(({ expert, rows }) => rows.forEach((r) => {
    const id = r['題號']
    if (!id) return
    if (!byItem.has(id)) byItem.set(id, { id, dimension: r['構面'], sub: r['子面向'], text: r['題目（自評版）'], rel: [], cla: [], similar: [], notes: [] })
    const it = byItem.get(id)
    const rel = num(col(r, '相關性')); const cla = num(col(r, '清晰度'))
    if (rel !== null) it.rel.push(rel)
    if (cla !== null) it.cla.push(cla)
    const sim = col(r, '像他牌題目')
    if (sim === '是' || sim === '不確定') it.similar.push({ expert, answer: sim })
    const note = col(r, '修改建議')
    if (note) it.notes.push(`${expert}：${note}`)
  }))
  const share = (arr) => (arr.length ? arr.filter((v) => v >= CVI.rating).length / arr.length : null)
  const items = [...byItem.values()].map((it) => {
    const iCviRel = share(it.rel); const iCviCla = share(it.cla)
    const reasons = []
    if (iCviRel === null) reasons.push('沒有任何專家評相關性')
    else if (iCviRel < threshold) reasons.push(`相關性 I-CVI ${iCviRel.toFixed(2)} < ${threshold}`)
    if (iCviCla !== null && iCviCla < threshold) reasons.push(`清晰度 I-CVI ${iCviCla.toFixed(2)} < ${threshold}`)
    if (it.similar.some((s) => s.answer === '是')) reasons.push('有專家指出像他牌題目')
    else if (it.similar.length) reasons.push('有專家不確定是否像他牌題目')
    return { ...it, iCviRel, iCviCla, reasons, revise: reasons.length > 0 }
  })
  const ave = (key) => { const v = items.map((i) => i[key]).filter((x) => x !== null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }
  return { items, experts, threshold, sCviRelevance: ave('iCviRel'), sCviClarity: ave('iCviCla') }
}

const MUST_FIX = ['A', 'B', 'C', 'G']
const CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']

/** 認知前測：依指引第 6 節的規則判定。每列一位受訪者對一題的紀錄。 */
export function analyzePretest(rows) {
  const byItem = new Map()
  rows.forEach((r) => {
    const id = r['題號']
    if (!id || !r['受訪者代號']) return
    if (!byItem.has(id)) byItem.set(id, { id, dimension: r['構面'], text: r['題目（自評版）'], respondents: new Set(), codes: Object.fromEntries(CODES.map((c) => [c, new Set()])), quotes: [], suggestions: [], paraphraseOff: 0 })
    const it = byItem.get(id)
    it.respondents.add(r['受訪者代號'])
    const codes = (col(r, '問題代碼').toUpperCase().match(/[A-I]/g) ?? [])
    codes.forEach((c) => it.codes[c].add(r['受訪者代號']))
    const para = col(r, '複述是否符合原意')
    if (para === '否' || para === '部分') it.paraphraseOff += 1
    const q = col(r, '原話摘錄'); if (q) it.quotes.push(`${r['受訪者代號']}：${q}`)
    const s = col(r, '建議修法'); if (s) it.suggestions.push(s)
  })
  const items = [...byItem.values()].map((it) => {
    const count = Object.fromEntries(CODES.map((c) => [c, it.codes[c].size]))
    const reasons = []
    const must = MUST_FIX.filter((c) => count[c] >= 2)
    if (must.length) reasons.push(`必改：${must.map((c) => `${c}×${count[c]}`).join('、')}`)
    const watch = MUST_FIX.filter((c) => count[c] === 1)
    if (!must.length && watch.length) reasons.push(`觀察：${watch.join('、')} 各 1 位，看第二輪是否重現`)
    if (count.D >= 2) reasons.push(`不適用 D×${count.D}：考慮改成不預設情境，或標註不適用`)
    if (count.E >= 2) reasons.push(`社會期許 E×${count.E}：評估改寫成兩難，或接受（反向題本來就偏社會期許）`)
    if (count.H >= 2) reasons.push(`無法觀察 H×${count.H}：他評版標為 observability: low，並確認有「無法判斷」`)
    return { id: it.id, dimension: it.dimension, text: it.text, respondents: it.respondents.size, count, paraphraseOff: it.paraphraseOff, quotes: it.quotes, suggestions: it.suggestions, reasons, mustFix: must.length > 0, watch: !must.length && watch.length > 0 }
  })
  return { items }
}

export function renderReport({ experts, pretest }) {
  const out = ['# 審題與前測分析', '']
  if (experts) {
    out.push(`## 專家內容效度（${experts.experts} 位專家）`, '',
      `- 門檻：I-CVI ≥ ${experts.threshold}（專家 ≥ ${CVI.minExperts} 位用 ${CVI.itemMin}，否則用 ${CVI.strictItemMin}）⚠️ 經驗法則，正式報告前請對照文獻`,
      `- S-CVI/Ave：相關性 ${experts.sCviRelevance?.toFixed(2) ?? '—'}、清晰度 ${experts.sCviClarity?.toFixed(2) ?? '—'}（常見要求 ≥ ${CVI.scaleAveMin}）`,
      `- 需要修的題目：${experts.items.filter((i) => i.revise).length} / ${experts.items.length}`, '')
    const flagged = experts.items.filter((i) => i.revise)
    if (flagged.length) {
      out.push('| 題號 | 構面 | 題目 | 原因 | 專家意見 |', '|---|---|---|---|---|')
      flagged.forEach((i) => out.push(`| ${i.id} | ${i.dimension} | ${i.text} | ${i.reasons.join('；')} | ${i.notes.join('；') || '—'} |`))
    } else out.push('沒有題目被標記。')
    out.push('')
  }
  if (pretest) {
    const must = pretest.items.filter((i) => i.mustFix); const watch = pretest.items.filter((i) => i.watch)
    out.push('## 認知前測', '', `- 必改：${must.length} 題；觀察：${watch.length} 題；共 ${pretest.items.length} 題有紀錄`, '')
    const flagged = pretest.items.filter((i) => i.reasons.length)
    if (flagged.length) {
      out.push('| 題號 | 構面 | 題目 | 判定 | 原話 | 建議修法 |', '|---|---|---|---|---|---|')
      flagged.forEach((i) => out.push(`| ${i.id} | ${i.dimension} | ${i.text} | ${i.reasons.join('；')} | ${i.quotes.join('；') || '—'} | ${i.suggestions.join('；') || '—'} |`))
    } else out.push('沒有題目被標記。')
    out.push('')
  }
  return out.join('\n')
}

function csvFiles(inputs) {
  return inputs.flatMap((p) => (statSync(p).isDirectory()
    ? readdirSync(p).filter((f) => f.toLowerCase().endsWith('.csv')).sort().map((f) => join(p, f))
    : [p]))
}

function main(argv) {
  const get = (flag) => { const i = argv.indexOf(flag); if (i < 0) return []; const vals = []; for (let j = i + 1; j < argv.length && !argv[j].startsWith('--'); j += 1) vals.push(argv[j]); return vals }
  const expertFiles = csvFiles(get('--experts'))
  const pretestFiles = csvFiles(get('--pretest'))
  if (!expertFiles.length && !pretestFiles.length) { console.error('用法：--experts <資料夾或CSV...> --pretest <資料夾或CSV...> [--out 檔案]'); process.exit(1) }
  const experts = expertFiles.length
    ? analyzeExperts(expertFiles.map((f) => ({ expert: f.split('/').pop().replace(/\.csv$/i, ''), rows: parseCsv(readFileSync(f, 'utf8')) })))
    : null
  const pretest = pretestFiles.length ? analyzePretest(pretestFiles.flatMap((f) => parseCsv(readFileSync(f, 'utf8')))) : null
  const report = renderReport({ experts, pretest })
  const outPath = get('--out')[0]
  if (outPath) { writeFileSync(outPath, report); console.log(`已寫入 ${outPath}`) } else console.log(report)
}

if (process.argv[1] && process.argv[1].endsWith('analyze-compass-review.mjs')) main(process.argv.slice(2))
