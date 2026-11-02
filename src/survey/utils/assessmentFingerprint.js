// 評量定義的「結構指紋」：題組結構（構面、子能力、題號、反向題、量表範圍、等級門檻）的雜湊。
//
// 為什麼要有：批次匯入、課後報告、班級統計都假設「同一個評量 id ＝ 同一套結構」。結果是作答當下算好的快照，
// 題庫結構一改（增減題、換構面、改反向題、改門檻），舊結果就和新結構對不上，追蹤會出錯。
// 所以結構變更必須升版（ITEM_VERSION）並更新指紋；題目「文字」的修正不影響指紋（錯字可以直接改）。

// FNV-1a 32 位元：不需要密碼學強度，只要結構一變就不同；純 JS 在瀏覽器與測試環境都能跑。
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** 結構的穩定字串（不含任何顯示用文字）。 */
export function structureOf(config) {
  const dims = (config.DIMENSIONS ?? []).map((d) => [
    d.id,
    (d.subDimensions ?? []).map((s) => s.id),
    (d.questions ?? []).map((q) => [q.id, q.reversed ? 1 : 0, q.subId ?? '', q.optional ? 1 : 0]),
  ]);
  const levels = (config.LEVELS ?? []).map((l) => [l.id, l.min, l.max === Infinity ? 'inf' : l.max]);
  return JSON.stringify({ id: config.ID, scale: [config.SCALE_MIN, config.SCALE_MAX], dims, levels });
}

export const fingerprintOf = (config) => fnv1a(structureOf(config));
