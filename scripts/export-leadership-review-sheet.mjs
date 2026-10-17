// 匯出新領導力評量的專家審題表（CSV，UTF-8 BOM，可直接用 Excel／Google 試算表開啟）
// 用法：node scripts/export-leadership-review-sheet.mjs [輸出資料夾]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const src = new URL('../docs/leadership-new/items-candidates-v0.2.json', import.meta.url)
const outDir = process.argv[2] || 'docs/leadership-new/review'
const items = JSON.parse(readFileSync(src, 'utf8')).filter((i) => i.selected)

const POLE = {
  focus: '聚焦', flex: '彈性', delegate: '授權', hold: '掌握',
  relation: '關係', result: '成果', system: '機制', authority: '個人權威',
}
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
const row = (a) => a.map(esc).join(',')

const header = [
  '題號', '構面', '子面向', '題目（自評版）', '題目（他評版）', '精簡版',
  '特殊標記', '相關性(1-4)', '清晰度(1-4)', '像他牌題目?(是/否/不確定)', '修改建議／備註',
]
const lines = [row(header)]
for (const i of items) {
  const tags = [i.ai && '人機協作', i.reverse && '反向題', i.pole && `張力:${POLE[i.pole]}`].filter(Boolean).join('、')
  lines.push(row([i.id, i.dimensionName, i.sub, i.self, i.other, i.short ? '是' : '', tags, '', '', '', '']))
}
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'expert-review-sheet.csv'), '﻿' + lines.join('\r\n') + '\r\n')
console.log(`已匯出 ${items.length} 題 → ${join(outDir, 'expert-review-sheet.csv')}`)
