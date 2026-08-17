import { randomInt } from 'node:crypto';

// 排除容易與數字或彼此搞混的字元（0/O、1/I/L）。30 個字元、8 碼 → 30^8 ≈ 6.5×10^11 種組合，
// 足以避免猜測，同時仍然是「唸得出來、打得進去」的長度，適合現場投影或口頭唸給學員。
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 8;

function randomCode() {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** 產生一組全站唯一的報到代碼（重試避免與現有班級撞碼，機率極低但仍檢查）。 */
export function generateJoinCode(db) {
  const existing = new Set((db.data.groups ?? []).map((g) => g.joinCode).filter(Boolean));
  let code = randomCode();
  while (existing.has(code)) code = randomCode();
  return code;
}

/** 使用者輸入／掃碼帶入的代碼格式不定（大小寫、前後空白），統一正規化後再比對。 */
export function normalizeJoinCode(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toUpperCase();
}

/** 依代碼找出仍然有效（尚未撤銷）的班級；找不到回傳 null。 */
export function findGroupByJoinCode(db, raw) {
  const code = normalizeJoinCode(raw);
  if (!code) return null;
  return (db.data.groups ?? []).find((g) => g.joinCode === code) ?? null;
}

/**
 * 用代碼把使用者加入班級（冪等——已經是成員就不重複加入）。
 * 代碼無效時回傳 null；成功（含「本來就已經是成員」）回傳該班別物件，
 * 供呼叫端知道要把使用者導去哪個評量。
 */
export function joinGroupByCode(db, user, raw) {
  const group = findGroupByJoinCode(db, raw);
  if (!group) return null;
  if (!group.memberIds.includes(user.id)) {
    group.memberIds.push(user.id);
    group.updatedAt = new Date().toISOString();
    db.persist();
  }
  return group;
}
