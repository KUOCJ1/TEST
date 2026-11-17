// 焦點構面（Sprint 41）：報告「一分鐘看懂」、「選一件事」、四週微練習都要練同一個構面。
// 之前各自排序，好幾個構面同分時（例如都是 3.2）挑到不同的構面，學員會困惑到底要練哪個。
// 規則：平均最低的構面；同分時取題庫裡排在前面的（陣列順序，固定不隨機）。
export function focusDimension(dimensions = []) {
  let best = null;
  for (const d of dimensions) {
    if (typeof d?.average !== 'number' || !(d.average > 0)) continue;
    if (best === null || d.average < best.average) best = d;
  }
  return best;
}

/** 最穩的構面：平均最高；同分取題庫順序在前。 */
export function strongestDimension(dimensions = []) {
  let best = null;
  for (const d of dimensions) {
    if (typeof d?.average !== 'number' || !(d.average > 0)) continue;
    if (best === null || d.average > best.average) best = d;
  }
  return best;
}
