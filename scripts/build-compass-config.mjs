// 將 docs/leadership-new/items-candidates-*.json 轉成平台用的題庫資料檔：
//   src/survey/data/assessments/compass-items.generated.js
// 題目改版（專家審題、認知前測後）只要改 JSON，再跑一次本腳本。
// 用法：node scripts/build-compass-config.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const src = new URL('../docs/leadership-new/items-candidates-v0.2.json', import.meta.url)
const out = new URL('../src/survey/data/assessments/compass-items.generated.js', import.meta.url)

const SUB_IDS = {
  風險預見: 'risk-foresight', 傾聽真話: 'hear-truth', 辨識限制: 'spot-constraints', 數據判斷: 'data-judgment',
  聚焦取捨: 'focus-tradeoff', 彈性調整: 'flex-adjust',
  知人善任: 'know-people', 授權當責: 'delegate-own', 人機配置: 'human-ai',
  激勵認可: 'recognize', 整合衝突: 'integrate', 跨層關係: 'cross-level',
  學習速度: 'learn-speed', 工具學習: 'tool-learning', 復盤檢討: 'retrospect',
  危機穩定: 'crisis', 承擔責任: 'accountability', 情緒調節: 'self-regulate',
  發掘潛力: 'spot-potential', 分層培育: 'tiered-dev', 成長對話: 'growth-talk',
  經驗沉澱: 'capture', 機制延續: 'continuity', 對外分享: 'share-out',
}
const DIM_ORDER = ['find', 'aim', 'staff', 'team', 'learn', 'anchor', 'sow', 'transfer']

const items = JSON.parse(readFileSync(src, 'utf8')).filter((i) => i.selected)
const missing = items.filter((i) => !SUB_IDS[i.sub])
if (missing.length) throw new Error(`未知的子面向：${[...new Set(missing.map((i) => i.sub))].join('、')}`)

const rows = items
  .sort((a, b) => DIM_ORDER.indexOf(a.dimension) - DIM_ORDER.indexOf(b.dimension))
  .map((i) => ({
    id: `fl-${i.id}`,
    dim: i.dimension,
    sub: SUB_IDS[i.sub],
    text: i.self,
    textOther: i.other,
    reversed: !!i.reverse || !!i.reversed,
    forms: i.short ? ['full', 'short'] : ['full'],
    observability: i.observability === 'low' ? 'low' : 'normal',
    ...(i.ai ? { ai: true } : {}),
    ...(i.pole ? { pole: i.pole } : {}),
  }))

const body = `// 此檔由 scripts/build-compass-config.mjs 自動產生，請勿手動修改。\n` +
  `// 來源：docs/leadership-new/items-candidates-v0.2.json（selected 題目）\n` +
  `export const COMPASS_ITEMS = ${JSON.stringify(rows, null, 2)};\n`
writeFileSync(out, body)
console.log(`已產生 ${rows.length} 題 → src/survey/data/assessments/compass-items.generated.js`)
