import { signToken, verifyToken } from '../auth.js';

const COOKIE_NAME = 'aiassess_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 天

/**
 * 建立與登入狀態相關的共用中介層與工具函式，供各路由模組掛載。
 * @param {{db, jwtSecret:string, secureCookies?:boolean}} opts
 */
export function createAuthContext({ db, jwtSecret, secureCookies = false }) {
  function setAuthCookie(res, user) {
    res.cookie(COOKIE_NAME, signToken({ sub: user.id, v: user.tokenVersion ?? 0 }, jwtSecret), {
      httpOnly: true,
      sameSite: 'lax',
      secure: secureCookies,
      maxAge: COOKIE_MAX_AGE,
    });
  }

  function currentUser(req) {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return null;
    const payload = verifyToken(token, jwtSecret);
    if (!payload) return null;
    const user = db.data.users.find((u) => u.id === payload.sub) || null;
    if (!user) return null;
    // tokenVersion 不符：這支 token 是在密碼或角色變更「之前」簽發的，視為已撤銷。
    // 兩邊都用 ?? 0 是為了與尚未帶 tokenVersion 欄位的舊使用者／舊 token 相容，
    // 部署當下不會讓所有人被迫重新登入，只有實際被撤銷過的帳號才會生效。
    if ((payload.v ?? 0) !== (user.tokenVersion ?? 0)) return null;
    return user;
  }

  function requireAuth(req, res, next) {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ code: 'UNAUTHORIZED', error: '尚未登入' });
    req.user = user;
    next();
  }

  function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ code: 'FORBIDDEN', error: '需要管理員權限' });
    next();
  }

  function requireCoach(req, res, next) {
    if (req.user.role !== 'coach' && req.user.role !== 'admin') {
      return res.status(403).json({ code: 'FORBIDDEN', error: '需要教練或管理員權限' });
    }
    next();
  }

  return { COOKIE_NAME, setAuthCookie, currentUser, requireAuth, requireAdmin, requireCoach };
}
