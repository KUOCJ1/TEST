// 新領導力評量的「機械式相似度篩檢」（docs/leadership-new/00-research-brief.md 第 4 節）。
//
// 把候選題目逐題與平台上已有的全部題庫（L9D、AI 職能、DISC、識己®）比對，抓出「措辭過於接近」的題目，
// 一律重寫。判斷兩個指標，任何一個超過門檻就標記：
//   1. 字元二連詞（bigram）Jaccard 相似度 ≥ 0.30：整句用字重疊太多
//   2. 最長相同連續字串 ≥ 8 個字：抄了一整段片語
// 限制：只能比對「我們手上有的題庫」；抓不到我們看不到的其他公司題庫，也抓不到「換同義詞的改寫」。
// 所以這是把關的一道，不是原創性的保證——設計過程紀錄（provenance log）才是主要佐證。
//
// 用法：node scripts/leadership-similarity.mjs <候選題目.json> [--top 3]
//       node scripts/leadership-similarity.mjs --selftest
// 候選題目 JSON：[{ "id": "see-1", "text": "我會主動…" }, ...]

import { readFileSync } from 'node:fs';
import { REGISTRY } from '../src/survey/data/assessments/index.js';

export const THRESHOLDS = { jaccard: 0.3, lcs: 8 };

const normalize = (s) => String(s).replace(/[\s，。、；：！？「」『』（）()《》〈〉“”"'‘’,.;:!?\-—…]/g, '');

const bigrams = (s) => {
  const set = new Set();
  for (let i = 0; i < s.length - 1; i += 1) set.add(s.slice(i, i + 2));
  return set;
};

export function jaccard(a, b) {
  const A = bigrams(normalize(a));
  const B = bigrams(normalize(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  return inter / (A.size + B.size - inter);
}

export function longestCommonSubstring(a, b) {
  const x = normalize(a);
  const y = normalize(b);
  let best = 0;
  let prev = new Array(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i += 1) {
    const cur = new Array(y.length + 1).fill(0);
    for (let j = 1; j <= y.length; j += 1) {
      if (x[i - 1] === y[j - 1]) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > best) best = cur[j];
      }
    }
    prev = cur;
  }
  return best;
}

/** 平台上所有現有題目：[{ bank, id, text }] */
export function existingItems() {
  const out = [];
  for (const [bank, cfg] of Object.entries(REGISTRY)) {
    for (const q of cfg.ALL_QUESTIONS ?? []) out.push({ bank, id: q.id, text: q.text });
  }
  return out;
}

export function compare(candidates, existing, thresholds = THRESHOLDS) {
  return candidates.map((c) => {
    const scored = existing
      .map((e) => ({ ...e, jaccard: jaccard(c.text, e.text), lcs: longestCommonSubstring(c.text, e.text) }))
      .sort((a, b) => b.jaccard - a.jaccard || b.lcs - a.lcs);
    const flagged = scored.filter((s) => s.jaccard >= thresholds.jaccard || s.lcs >= thresholds.lcs);
    return { candidate: c, top: scored.slice(0, 3), flagged };
  });
}

function main(argv) {
  if (argv.includes('--selftest')) {
    const items = existingItems();
    const same = compare([{ id: 'self', text: items[0].text }], items)[0];
    const diff = compare([{ id: 'diff', text: '今天午餐想吃什麼口味的便當呢' }], items)[0];
    const ok = same.flagged.length > 0 && diff.flagged.length === 0;
    console.log(ok ? '自我測試通過：完全相同的句子會被標記、無關的句子不會' : '自我測試失敗');
    process.exit(ok ? 0 : 1);
  }
  const file = argv.find((a) => !a.startsWith('--'));
  if (!file) { console.error('用法：node scripts/leadership-similarity.mjs <候選題目.json>'); process.exit(2); }
  const topIdx = argv.indexOf('--top');
  const topN = topIdx >= 0 ? Number(argv[topIdx + 1]) || 3 : 3;
  const candidates = JSON.parse(readFileSync(file, 'utf8'));
  const existing = existingItems();
  const results = compare(candidates, existing);
  let flaggedCount = 0;
  let maxJaccard = 0;
  let maxLcs = 0;
  for (const r of results) {
    const best = r.top[0];
    maxJaccard = Math.max(maxJaccard, best.jaccard);
    maxLcs = Math.max(maxLcs, ...r.top.map((t) => t.lcs));
    if (r.flagged.length) {
      flaggedCount += 1;
      console.log(`⚠️  ${r.candidate.id}：${r.candidate.text}`);
      for (const f of r.flagged.slice(0, topN)) console.log(`     ≈ [${f.bank}/${f.id}] ${f.text}  (bigram ${f.jaccard.toFixed(2)}, 共同字串 ${f.lcs} 字)`);
    }
  }
  console.log(`\n比對 ${candidates.length} 題 × 現有 ${existing.length} 題（${Object.keys(REGISTRY).join('、')}）`);
  console.log(`最高 bigram 相似度 ${maxJaccard.toFixed(2)}（門檻 ${THRESHOLDS.jaccard}）；最長共同字串 ${maxLcs} 字（門檻 ${THRESHOLDS.lcs}）`);
  console.log(flaggedCount === 0 ? '✅ 沒有題目超過門檻' : `❌ ${flaggedCount} 題超過門檻，請重寫`);
  process.exit(flaggedCount === 0 ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
