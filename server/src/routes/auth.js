import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import {
  hashPassword,
  verifyPassword,
  validateRegistration,
  publicUser,
  MIN_PASSWORD_LENGTH,
} from '../auth.js';
import { asyncHandler, auditLog, hashToken, revokeUserTokens } from '../lib/helpers.js';
import { POLICY_VERSION } from '../lib/policy.js';
import { findGroupByJoinCode, joinGroupByCode } from '../lib/joinCode.js';
import { createLoginGuard } from '../lib/loginGuard.js';
import { findInviteByCode, checkInviteUsable, claimInvite, normalizeEmail, maskEmail } from '../lib/memberInvites.js';

// register/login 回傳的「剛加入的班級」只給前端導頁需要的最小資訊，不含成員、
// 成績或其他班級設定——這支 API 在使用者剛登入的當下就會被讀到。
function joinedGroupInfo(group) {
  if (!group) return null;
  return { id: group.id, name: group.name, companyName: group.companyName || '', assessmentId: group.assessmentId };
}

/** @param {{db, requireAuth, setAuthCookie, COOKIE_NAME}} deps */
// 只收已知的偏好設定鍵：以前是整包原樣合併，任何人都能在自己的帳號塞進任意
// 鍵與大量資料。notifyAssessment／notifyComment 會決定要不要寄通知信（見
// lib/notifications.js），必須是布林值。
const BOOLEAN_PREFS = ['darkMode', 'notifyAssessment', 'notifyComment'];
export function sanitizePreferences(input) {
  const out = {};
  for (const key of BOOLEAN_PREFS) {
    if (typeof input[key] === 'boolean') out[key] = input[key];
  }
  if (input.defaultAssessmentId === null) out.defaultAssessmentId = null;
  else if (typeof input.defaultAssessmentId === 'string') out.defaultAssessmentId = input.defaultAssessmentId.slice(0, 64);
  return out;
}

export function createAuthRouter({ db, requireAuth, setAuthCookie, COOKIE_NAME, currentUser }) {
  const router = Router();

  // Rate limit for auth endpoints — 10 attempts per 5 minutes per IP, or 100 when
  // the request carries a joinCode that actually matches an open class (QR報到情境：
  // 一整班學員很可能共用同一個 NAT/Wi-Fi 出口 IP，10 次的額度第 11 個人就會卡住)。
  // 放寬額度仍是有界的，且只有「持有教練發出、尚未撤銷的代碼」才適用，而代碼本身
  // 隨時可由教練撤銷。
  // Created fresh per router instance (not module-level) so each createApp()
  // call — notably each test's own app — gets an independent counter.
  //
  // AUTH_RATE_LIMIT 只給 E2E 測試用：Playwright 的幾支測試共用同一個後端、同一個
  // 來源 IP，照正式額度（10 次）很快就會被自己擋下。正式環境不要設。
  const baseLimit = Number(process.env.AUTH_RATE_LIMIT) || 10;
  const authLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: (req) => (findGroupByJoinCode(db, req.body?.joinCode) ? Math.max(100, baseLimit) : baseLimit),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '請求過於頻繁，請稍後再試' },
  });

  // 猜密碼的防線有三層，彼此獨立：
  //  1) authLimiter（上面）：每個 IP 的請求量；帶有效報到代碼時為了整班同時掃碼而放寬——這個放寬
  //     只能在 IP 這一層，不能讓它變成猜密碼的額度。
  //  2) failedLoginLimiter：每個 IP「失敗」的登入次數（成功的不算），不受報到代碼放寬影響。
  //  3) loginGuard：每個帳號連續失敗 5 次就鎖定 15 分鐘（記憶體內，見 lib/loginGuard.js）。
  // E2E 為了所有測試共用同一個帳號與 IP，會透過 AUTH_RATE_LIMIT 放寬（正式環境不要設）。
  const e2e = Boolean(process.env.AUTH_RATE_LIMIT);
  const failedLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: e2e ? 10000 : 30,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { code: 'RATE_LIMIT', error: '登入失敗次數過多，請稍後再試' },
  });
  const loginGuard = createLoginGuard({ maxFailures: e2e ? 10000 : 5 });
  const sensitiveLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: e2e ? 10000 : 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { code: 'RATE_LIMIT', error: '請求過於頻繁，請稍後再試' },
  });
  const lockedResponse = (res, ms) => res.status(429).json({
    code: 'ACCOUNT_LOCKED',
    error: `嘗試次數過多，暫時無法登入。請 ${Math.ceil(ms / 60000)} 分鐘後再試，或請管理員協助重設密碼。`,
    retryAfterSeconds: Math.ceil(ms / 1000),
  });

  // Hash password BEFORE checking for duplicate email so the synchronous
  // check+push+persist block has no await (atomic under Node.js single thread).
  router.post('/auth/register', authLimiter, asyncHandler(async (req, res) => {
    const { name, email: bodyEmail, password, joinCode, acceptPolicy, inviteCode } = req.body || {};
    // 邀請碼註冊：Email 一律以邀請上的為準（前端會鎖定，這裡是伺服器強制，不信任請求內容），
    // 持有碼才能用這個 Email 註冊——這就是信箱驗證。邀請無效就整個擋下，免得人用錯 Email 註冊了還以為進班了。
    let invite = null;
    let inviteGroup = null;
    if (inviteCode) {
      invite = findInviteByCode(db, inviteCode);
      const usable = checkInviteUsable(db, invite);
      if (!usable.ok) return res.status(usable.status).json({ code: usable.code, error: usable.error });
      inviteGroup = usable.group;
    }
    const email = invite ? invite.email : bodyEmail;
    try {
      validateRegistration({ name, email, password });
    } catch (e) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', error: e.message });
    }
    // 同意要在伺服器端強制：只靠前端勾選框，直接打 API 就能繞過。
    if (acceptPolicy !== true) {
      return res.status(400).json({ code: 'CONSENT_REQUIRED', error: '請先閱讀並同意隱私權政策與服務條款' });
    }
    const normEmail = normalizeEmail(email);
    const passwordHash = await hashPassword(password);
    if (db.data.users.some((u) => u.email === normEmail)) {
      return res.status(409).json({
        code: 'EMAIL_TAKEN',
        error: invite ? '這個 Email 已經有帳號了，請改用「登入」，登入後會自動加入班級。' : '此 Email 已被註冊',
      });
    }
    const user = {
      id: randomUUID(),
      name: name.trim(),
      email: normEmail,
      passwordHash,
      role: 'user',
      createdAt: new Date().toISOString(),
      consent: { version: POLICY_VERSION, acceptedAt: new Date().toISOString() },
    };
    db.data.users.push(user);
    db.persist();
    // 邀請碼優先（記錄邀請已使用）；其次是 QR 報到代碼。兩者都沒有就不會自動編進任何班級——
    // 不再依 Email 比對「待加入名單」自動入班（沒驗證信箱，會被搶先註冊）。
    let joinedGroup = null;
    if (invite) joinedGroup = claimInvite(db, invite, user, inviteGroup);
    else if (joinCode) joinedGroup = joinGroupByCode(db, user, joinCode);
    setAuthCookie(res, user);
    res.status(201).json({ user: publicUser(user), joinedGroup: joinedGroupInfo(joinedGroup) });
  }));

  router.post('/auth/login', authLimiter, failedLoginLimiter, asyncHandler(async (req, res) => {
    const { email, password, joinCode, inviteCode } = req.body || {};
    const normEmail = String(email || '').trim().toLowerCase();
    const lockedMs = loginGuard.lockedFor(normEmail);
    if (lockedMs > 0) return lockedResponse(res, lockedMs);
    const user = db.data.users.find((u) => u.email === normEmail);
    if (!user || !(await verifyPassword(password || '', user.passwordHash))) {
      loginGuard.fail(normEmail);
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', error: 'Email 或密碼錯誤' });
    }
    loginGuard.success(normEmail);
    // 密碼對才告知「已停用」，避免被拿來探測哪些 Email 有註冊。
    if (user.disabled) {
      return res.status(403).json({ code: 'ACCOUNT_DISABLED', error: '此帳號已停用，請聯絡管理員' });
    }
    // 既有學員重新掃碼加入新的一梯（例如回鍋上下一期課程）同樣適用。
    let joinedGroup = joinCode ? joinGroupByCode(db, user, joinCode) : null;
    // 帶邀請碼登入：邀請的 Email 必須就是這個帳號的 Email 才會入班。登入本身已經成功，
    // 邀請有問題時不讓整個登入失敗，而是把原因放在 inviteError 讓前端顯示。
    let inviteError = null;
    if (inviteCode) {
      const invite = findInviteByCode(db, inviteCode);
      const usable = checkInviteUsable(db, invite);
      if (!usable.ok) inviteError = { code: usable.code, error: usable.error };
      else if (invite.email !== user.email) {
        inviteError = { code: 'INVITE_EMAIL_MISMATCH', error: `這個邀請是寄給另一個 Email（${maskEmail(invite.email)}）。請用那個 Email 登入，或向教練確認。` };
      } else joinedGroup = claimInvite(db, invite, user, usable.group);
    }
    setAuthCookie(res, user);
    res.json({ user: publicUser(user), joinedGroup: joinedGroupInfo(joinedGroup), ...(inviteError && { inviteError }) });
  }));

  router.post('/auth/logout', (_req, res) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ ok: true });
  });

  // 前端啟動時查「目前有沒有登入」用（Sprint 8）：沒登入是正常狀態，回 200 + null，
  // 而不是 401——以前用 /auth/me，每個未登入的訪客開首頁，瀏覽器 console 都會
  // 印出紅色的 401 錯誤。/auth/me 維持原本語意（需登入）不變。
  router.get('/auth/session', (req, res) => {
    const user = currentUser(req);
    res.json({ user: user ? publicUser(user) : null });
  });

  // 既有用戶（沒有同意紀錄，或政策升版後）登入後補同意（Sprint 12）。
  router.post('/auth/consent', requireAuth, (req, res) => {
    if (req.body?.accept !== true) {
      return res.status(400).json({ code: 'CONSENT_REQUIRED', error: '請先閱讀並同意隱私權政策與服務條款' });
    }
    req.user.consent = { version: POLICY_VERSION, acceptedAt: new Date().toISOString() };
    db.persist();
    auditLog(req, 'accept_policy', { version: POLICY_VERSION });
    res.json({ user: publicUser(req.user) });
  });

  // 領導力羅盤：受評者決定「上級（主管）的評分」是否顯示在自己的報告中（預設不顯示，可撤回）。
  // 上級通常只有一位，無法匿名，所以需要受評者同意。見 server/src/lib/compassPrivacy.js。
  router.put('/auth/compass-manager-share', requireAuth, (req, res) => {
    if (typeof req.body?.granted !== 'boolean') {
      return res.status(400).json({ error: 'granted 必須是 true 或 false' });
    }
    req.user.compassManagerShare = { granted: req.body.granted, at: new Date().toISOString() };
    db.persist();
    auditLog(req, 'compass_manager_share', { granted: req.body.granted });
    res.json({ user: publicUser(req.user) });
  });

  router.get('/auth/me', requireAuth, (req, res) => {
    res.json({ user: publicUser(req.user) });
  });

  router.patch('/auth/profile', requireAuth, (req, res) => {
    const { name, preferences } = req.body ?? {};
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: '姓名不可為空' });
      req.user.name = name.trim();
    }
    if (preferences !== undefined && preferences && typeof preferences === 'object') {
      req.user.preferences = { ...(req.user.preferences ?? {}), ...sanitizePreferences(preferences) };
    }
    db.persist();
    res.json({ user: publicUser(req.user) });
  });

  router.post('/auth/password', requireAuth, sensitiveLimiter, asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if ((newPassword || '').length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `新密碼至少需 ${MIN_PASSWORD_LENGTH} 碼` });
    }
    // 改密碼要輸入目前密碼：被偷走的 session 不能拿這個端點無限次猜，同樣套用帳號鎖定。
    const guardKey = `pw:${req.user.id}`;
    const lockedMs = loginGuard.lockedFor(guardKey);
    if (lockedMs > 0) return lockedResponse(res, lockedMs);
    if (!(await verifyPassword(currentPassword || '', req.user.passwordHash))) {
      loginGuard.fail(guardKey);
      return res.status(401).json({ error: '目前密碼不正確' });
    }
    loginGuard.success(guardKey);
    req.user.passwordHash = await hashPassword(newPassword);
    // 撤銷這個帳號目前所有已簽發的登入 token（例如外流的舊 cookie），
    // 再馬上為「這次請求本身」重發一份新 cookie，使用者不會被自己的操作登出。
    revokeUserTokens(req.user);
    db.persist();
    setAuthCookie(res, req.user);
    res.json({ ok: true });
  }));

  router.post('/auth/reset-password', sensitiveLimiter, asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body ?? {};
    if (!token || (newPassword || '').length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', error: `重設連結或新密碼不正確（密碼至少 ${MIN_PASSWORD_LENGTH} 碼）` });
    }
    const h = hashToken(token);
    const user = db.data.users.find(
      (u) => u.resetTokenHash === h && (u.resetTokenExpires || 0) > Date.now(),
    );
    if (!user || user.disabled) return res.status(400).json({ code: 'INVALID_RESET_TOKEN', error: '重設連結無效或已過期，請向管理員重新索取' });
    user.passwordHash = await hashPassword(newPassword);
    delete user.resetTokenHash;
    delete user.resetTokenExpires;
    // 重設密碼代表原密碼可能已外洩，順便撤銷這個帳號現有的所有登入 session。
    revokeUserTokens(user);
    db.persist();
    res.json({ ok: true });
  }));

  return router;
}
