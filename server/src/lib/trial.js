// 試用帳號（推廣期）：從公開推廣連結自行註冊、沒有用邀請碼或報到 QR 進來的學員。
//
// - 只看得到、只能作答 TRIAL_ASSESSMENT_IDS（AI 職能、DISC）；做過的紀錄之後回來都看得到。
// - 360°（邀請他評）與發展功能（發展目標、四週微練習）看得到介紹但不能用。
// - 一旦加入任何班級（邀請碼、QR 報到、教練加入、驗證信箱後自動入班…），就永久轉為一般學員。
// - 只有 role === 'user' 會是試用；教練與管理員不受影響。既有帳號沒有 trial 旗標，不受影響。
// 限制由伺服器強制，前端只負責呈現鎖定畫面。

export const TRIAL_ASSESSMENT_IDS = new Set(['ai-competency', 'disc']);

const inAnyGroup = (db, userId) => (db.data.groups ?? []).some((g) => (g.memberIds ?? []).includes(userId));

/** 這個帳號現在是不是試用（有旗標、一般學員、還沒加入任何班級）。 */
export function isTrialUser(db, user) {
  return Boolean(user && user.trial && user.role === 'user' && !inAnyGroup(db, user.id));
}

/** 已經加入班級或改了角色的試用帳號：清掉旗標（之後不再是試用）。有變更回 true。 */
export function refreshTrial(db, user) {
  if (!user?.trial) return false;
  if (isTrialUser(db, user)) return false;
  delete user.trial;
  user.trialEndedAt = new Date().toISOString();
  db.persist();
  return true;
}

export function trialLocked(res, feature) {
  return res.status(403).json({
    code: 'TRIAL_LOCKED',
    feature,
    error: '試用帳號尚未開放這項功能。透過課程或教練提供的連結加入班級後即可使用。',
  });
}
