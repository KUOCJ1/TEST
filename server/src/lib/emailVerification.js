// Email 驗證（推廣期）：註冊後寄驗證信，點連結就把帳號標成「信箱已確認」。
//
// 不擋使用：沒驗證也能作答、看報告。驗證的用途是確認「這個信箱真的是本人的」，
// 所以驗證完成時，可以安全地把「寄到這個 Email 的入班邀請」直接兌換掉——
// 教練匯入名單後，學員用同一個 Email 自行註冊並驗證，就自動進班，不用再輸入邀請碼。
// （以前不依 Email 自動入班，就是因為沒驗證的信箱可能被別人搶先註冊。）
import { randomBytes } from 'node:crypto';
import { hashToken } from './helpers.js';
import { isMailConfigured, sendMail, appBaseUrl } from './mailer.js';
import { checkInviteUsable, claimInvite, inviteState } from './memberInvites.js';

export const VERIFY_TTL_MS = 72 * 60 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;

export function issueVerifyToken(db, user, now = Date.now()) {
  const token = randomBytes(24).toString('hex');
  user.emailVerifyTokenHash = hashToken(token);
  user.emailVerifyExpires = now + VERIFY_TTL_MS;
  user.emailVerifySentAt = new Date(now).toISOString();
  db.persist();
  return token;
}

export const verifyLink = (token) => `${appBaseUrl()}/?verify=${encodeURIComponent(token)}`;

export function buildVerificationMail(user, token) {
  return {
    to: user.email,
    subject: '請確認你的 Email',
    text: [
      `${user.name || ''} 您好：`,
      '',
      '感謝註冊。請點下面的連結確認這是你的 Email（72 小時內有效）：',
      verifyLink(token),
      '',
      '確認後，若教練已用這個 Email 邀請你加入課程，系統會自動幫你加入班級。',
      '沒有註冊過的話，請忽略這封信。',
    ].join('\n'),
  };
}

/** 寄驗證信。回傳 { sent:true } 或 { sent:false, code }。不丟例外。 */
export async function sendVerificationMail(db, user) {
  if (!isMailConfigured()) return { sent: false, code: 'MAIL_NOT_CONFIGURED' };
  if (user.emailVerifiedAt) return { sent: false, code: 'ALREADY_VERIFIED' };
  const token = issueVerifyToken(db, user);
  const result = await sendMail(buildVerificationMail(user, token));
  return result.ok ? { sent: true } : { sent: false, code: result.code };
}

/** 驗證完成的信箱：兌換寄到這個 Email、還有效的入班邀請。回傳加入的班級。 */
export function joinInvitesForVerifiedEmail(db, user) {
  if (!user.emailVerifiedAt) return [];
  const joined = [];
  for (const inv of db.data.memberInvites ?? []) {
    if (inv.email !== user.email || inviteState(inv) !== 'invited') continue;
    const usable = checkInviteUsable(db, inv);
    if (usable.ok) joined.push(claimInvite(db, inv, user, usable.group));
  }
  return joined;
}

/** 用連結裡的 token 驗證信箱。token 無效或過期回 null。 */
export function verifyEmailToken(db, token, now = Date.now()) {
  if (typeof token !== 'string' || !token) return null;
  const h = hashToken(token);
  const user = db.data.users.find((u) => u.emailVerifyTokenHash === h);
  if (!user || user.disabled || !(user.emailVerifyExpires > now)) return null;
  user.emailVerifiedAt ??= new Date(now).toISOString();
  delete user.emailVerifyTokenHash;
  delete user.emailVerifyExpires;
  const joinedGroups = joinInvitesForVerifiedEmail(db, user);
  db.persist();
  return { user, joinedGroups };
}
