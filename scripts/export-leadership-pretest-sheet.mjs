// 匯出認知前測紀錄表（每組一份 CSV，UTF-8 BOM）。分組規則與 03-cognitive-pretest-guide.md 一致：
// 依構面順序，同構面內輪流分到 3 組（起始組隨構面順序位移）。
// 用法：node scripts/export-leadership-pretest-sheet.mjs [輸出資料夾]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const src = new URL('../docs/leadership-new/items-candidates-v0.2.json', import.meta.url)
const outDir = process.argv[2] || 'docs/leadership-new/review'
const items = JSON.parse(readFileSync(src, 'utf8')).filter((i) => i.selected)

const POLE = { focus: '聚焦', flex: '彈性', delegate: '授權', hold: '掌握', relation: '關係', result: '成果', system: '機制', authority: '個人權威' }
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
const row = (a) => a.map(esc).join(',')

const dims = [...new Set(items.map((i) => i.dimension))]
const sets = [[], [], []]
dims.forEach((dim, c) => {
  items.filter((i) => i.dimension === dim).forEach((i, k) => sets[(c + k) % 3].push(i))
})

const header = [
  '受訪者代號', '角色', '世代', '組別', '題號', '構面', '題目（自評版）', '題目（他評版）', '特殊標記',
  '複述是否符合原意(是/部分/否)', '問題代碼(A-I，可複選)', '原話摘錄', '建議修法', '是否需第二輪(是/否)',
]
mkdirSync(outDir, { recursive: true })
sets.forEach((set, n) => {
  const lines = [row(header)]
  for (const i of set) {
    const tags = [i.ai && '人機協作', i.reverse && '反向題', i.pole && `張力:${POLE[i.pole]}`, i.observability === 'low' && '難觀察'].filter(Boolean).join('、')
    lines.push(row(['', '', '', `第${n + 1}組`, i.id, i.dimensionName, i.self, i.other, tags, '', '', '', '', '']))
  }
  const f = join(outDir, `pretest-record-set${n + 1}.csv`)
  writeFileSync(f, '﻿' + lines.join('\r\n') + '\r\n')
  console.log(`第${n + 1}組 ${set.length} 題 → ${f}`)
})
