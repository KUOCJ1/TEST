// 「核心 7 構面」：經贏® 領導力九大構面（L9D）與八大構面（70 題）共有的構面。
//
// 兩套評量的總分範圍不同（L9D 90–450、八大構面 70–350），而且各有專屬構面
// （L9D：思辨與決策、接班成熟度；八大構面：應變與創新），所以跨評量比較只能用核心構面的「平均」（1–5），
// 不能比總分。純函式，不打 API。
import { latestPerUser } from './analytics.js';

export const CORE_DIMENSION_IDS = [
  'communication', 'collaboration', 'task-management', 'execution',
  'leadership-impact', 'developing-others', 'self-development',
];

const round2 = (n) => Math.round(n * 100) / 100;
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/** 一份結果的核心構面平均：{ [dimId]: average }；沒有作答（平均 0）的構面不列入。 */
export function coreAverages(result) {
  const out = {};
  for (const d of result?.dimensions ?? []) {
    if (CORE_DIMENSION_IDS.includes(d.id) && d.average > 0) out[d.id] = d.average;
  }
  return out;
}

/**
 * 各評量的核心構面平均：每位受評者每份評量只取最新一筆自評，再對人取平均。
 * @param {Array} submissions 自評作答（呼叫端先用 selfSubmissions 過濾掉他評）
 * @returns {Array<{assessmentId, n, dims: {[dimId]: number}}>} 只列出有核心構面資料的評量
 */
export function coreByAssessment(submissions) {
  const byAssessment = new Map();
  for (const s of submissions ?? []) {
    if (!byAssessment.has(s.assessmentId)) byAssessment.set(s.assessmentId, []);
    byAssessment.get(s.assessmentId).push(s);
  }
  const out = [];
  for (const [assessmentId, subs] of byAssessment) {
    const latest = latestPerUser(subs).map((s) => coreAverages(s.result));
    const used = latest.filter((a) => Object.keys(a).length > 0);
    if (used.length === 0) continue;
    const dims = {};
    for (const id of CORE_DIMENSION_IDS) {
      const m = mean(used.map((a) => a[id]).filter((v) => typeof v === 'number'));
      if (m != null) dims[id] = round2(m);
    }
    out.push({ assessmentId, n: used.length, dims });
  }
  return out;
}

/**
 * 同一個人兩份評量都做過時的配對比較（核心構面平均的差，B − A）。
 * @returns {null | {n, dims: {[dimId]: {a, b, diff}}}} 沒有人兩份都做過回 null
 */
export function pairedCore(submissions, idA, idB) {
  const latestOf = (id) => new Map(latestPerUser((submissions ?? []).filter((s) => s.assessmentId === id)).map((s) => [s.userId, coreAverages(s.result)]));
  const a = latestOf(idA);
  const b = latestOf(idB);
  const both = [...a.keys()].filter((u) => b.has(u) && Object.keys(a.get(u)).length > 0 && Object.keys(b.get(u)).length > 0);
  if (both.length === 0) return null;
  const dims = {};
  for (const id of CORE_DIMENSION_IDS) {
    const pairs = both.map((u) => [a.get(u)[id], b.get(u)[id]]).filter(([x, y]) => typeof x === 'number' && typeof y === 'number');
    if (pairs.length === 0) continue;
    const ma = mean(pairs.map((p) => p[0]));
    const mb = mean(pairs.map((p) => p[1]));
    dims[id] = { a: round2(ma), b: round2(mb), diff: round2(mb - ma) };
  }
  return { n: both.length, dims };
}
