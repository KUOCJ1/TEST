// 邀請制入班（Sprint 19；規格 docs/onboarding-invitations-spec.md）。
//
// 後台先把學員的 Email 編進班級，系統產生一組「邀請碼」，學員用含邀請碼的連結註冊／登入後自動入班。
// 邀請碼綁定單一 Email 且一次性：持有碼才能認領，這同時證明對方收得到那個信箱——
// 取代舊的「待加入名單（註冊時只比對 Email 就自動入班，沒驗證註冊者擁有該信箱）」。
import { randomInt, randomUUID } from 'node:crypto';

// 字元集與報到代碼相同（排除 0/O、1/I/L 這類容易看錯的字）。10 碼 → 30^10 ≈ 5.9×10^14，
// 再加上查詢端點的限流，無法靠猜測命中。
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export const INVITE_CODE_LENGTH = 10;
export const INVITE_TTL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 顯示用的遮罩 Email（a***@example.com）：只讓本人認得出是哪個信箱，不完整洩漏。 */
export function maskEmail(email) {
  const [local = '', domain = ''] = String(email).split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

export const normalizeEmail = (raw) => String(raw ?? '').trim().toLowerCase();
export const normalizeInviteCode = (raw) => (typeof raw === 'string' ? raw.trim().toUpperCase().replace(/[\s-]/g, '') : '');

function randomCode() {
  let out = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** 全站唯一的邀請碼（撞碼機率極低但仍檢查）。 */
export function generateInviteCode(data) {
  const existing = new Set((data.memberInvites ?? []).map((i) => i.code));
  let code = randomCode();
  while (existing.has(code)) code = randomCode();
  return code;
}

export const inviteExpiry = (now = Date.now()) => new Date(now + INVITE_TTL_DAYS * DAY_MS).toISOString();

/** 'joined'｜'revoked'｜'expired'｜'invited'（過期是算出來的，不另外儲存）。 */
export function inviteState(inv, now = Date.now()) {
  if (inv.status === 'joined') return 'joined';
  if (inv.status === 'revoked') return 'revoked';
  return new Date(inv.expiresAt).getTime() < now ? 'expired' : 'invited';
}

export function newMemberInvite(data, { groupId, email, name = '', createdBy }) {
  return {
    id: randomUUID(),
    groupId,
    email: normalizeEmail(email),
    name: String(name ?? '').trim().slice(0, 100),
    code: generateInviteCode(data),
    status: 'invited',
    expiresAt: inviteExpiry(),
    createdBy,
    createdAt: new Date().toISOString(),
    lastSentAt: null,
    sendCount: 0,
    joinedUserId: null,
    joinedAt: null,
  };
}

export function findInviteByCode(db, raw) {
  const code = normalizeInviteCode(raw);
  if (!code) return null;
  return (db.data.memberInvites ?? []).find((i) => i.code === code) ?? null;
}

const USABLE_ERRORS = {
  joined: { status: 410, code: 'INVITE_USED', error: '這個邀請已經使用過了。如果那是你，請直接登入；否則請向教練索取新的邀請。' },
  revoked: { status: 410, code: 'INVITE_REVOKED', error: '這個邀請已被撤銷，請向教練索取新的邀請。' },
  expired: { status: 410, code: 'INVITE_EXPIRED', error: '這個邀請已經過期，請向教練索取新的邀請連結。' },
};

/** 邀請還能不能用；不能時回傳要給前端的錯誤（含 HTTP 狀態）。 */
export function checkInviteUsable(db, inv) {
  if (!inv) return { ok: false, status: 404, code: 'INVITE_NOT_FOUND', error: '邀請碼不正確，請確認連結或邀請碼是否完整。' };
  const state = inviteState(inv);
  if (state !== 'invited') return { ok: false, ...USABLE_ERRORS[state] };
  const group = (db.data.groups ?? []).find((g) => g.id === inv.groupId);
  if (!group) return { ok: false, status: 410, code: 'INVITE_REVOKED', error: '這個班級已不存在，請向教練確認。' };
  return { ok: true, group };
}

/**
 * 用邀請把使用者編進班級。呼叫端必須已確認「使用者的 Email ＝ 邀請的 Email」
 * （註冊時 Email 本來就是邀請上的；登入／兌換時要比對）。持有碼＝信箱驗證，順便記下驗證時間。
 */
export function claimInvite(db, inv, user, group) {
  if (!group.memberIds.includes(user.id)) group.memberIds.push(user.id);
  group.updatedAt = new Date().toISOString();
  inv.status = 'joined';
  inv.joinedUserId = user.id;
  inv.joinedAt = group.updatedAt;
  if (!user.emailVerifiedAt) user.emailVerifiedAt = inv.joinedAt;
  db.persist();
  return group;
}

export function inviteLink(code, baseUrl) {
  return `${String(baseUrl).replace(/\/+$/, '')}/?invite=${code}`;
}

/** 給教練／管理員看的邀請資料（含碼與連結）。已撤銷的不列出。 */
export function inviteForCoach(inv, baseUrl, now = Date.now()) {
  return {
    id: inv.id,
    email: inv.email,
    name: inv.name,
    code: inv.code,
    link: inviteLink(inv.code, baseUrl),
    state: inviteState(inv, now),
    expiresAt: inv.expiresAt,
    createdAt: inv.createdAt,
    lastSentAt: inv.lastSentAt,
    sendCount: inv.sendCount ?? 0,
    joinedAt: inv.joinedAt,
  };
}

/** 啟動時把舊的 pendingMembers 轉成邀請（新碼、14 天），並清空 pendingMembers。回傳轉了幾筆。 */
export function migratePendingMembers(data) {
  let converted = 0;
  data.memberInvites ??= [];
  for (const g of data.groups ?? []) {
    const pending = Array.isArray(g.pendingMembers) ? g.pendingMembers : [];
    if (pending.length === 0) continue;
    for (const p of pending) {
      const email = normalizeEmail(p?.email);
      if (!email) continue;
      const dup = data.memberInvites.some((i) => i.groupId === g.id && i.email === email && i.status === 'invited');
      if (dup) continue;
      data.memberInvites.push(newMemberInvite(data, { groupId: g.id, email, name: p?.name, createdBy: g.coachId }));
      converted += 1;
    }
    g.pendingMembers = [];
  }
  return converted;
}
