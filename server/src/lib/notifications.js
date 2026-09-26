// 學員通知信（Sprint 7 驗收條件 7.5、7.6、7.7）。
//
// 兩種信都尊重使用者在「個人設定 → 通知偏好」的選擇（沒設定過＝開啟）：
//   複測提醒     preferences.notifyAssessment
//   教練評語通知 preferences.notifyComment
// 教練手動寄的課程催交信（Sprint 6，routes/coach.js）屬課程行政通知，不受這兩個
// 開關影響。寄信本身走 lib/mailer.js，沒設定 SMTP 時整個略過、不留任何紀錄，等
// 之後設定好了再照常寄。
import { isMailConfigured, sendMail, appBaseUrl, formatTaipeiDate } from './mailer.js';

// 同一份作答的評語在這段時間內反覆修改只通知一次：教練常常存了又改。
export const COMMENT_NOTIFY_COOLDOWN_MS = 60 * 60 * 1000;

const wants = (user, key) => Boolean(user?.email) && user?.preferences?.[key] !== false;
const truncate = (text, n) => (text.length > n ? `${text.slice(0, n)}…` : text);
const footer = (toggleName) =>
  `（不想再收到這類信？到平台「個人設定 → 通知偏好」關閉「${toggleName}」。）`;

/**
 * 寄出已到「預計檢視日」的複測提醒，每個目標只寄一次（goal.reviewReminderSentAt）。
 * 跟首頁「下一步」卡片的判斷一致：目標未達成、檢視日已過。另外，設定目標後已經
 * 重新做過同一套評量的人就不寄——他已經複測了。
 *
 * @returns {Promise<{sent:number, failed:number}>}
 */
export async function sendDueRetestReminders(db, { now = Date.now(), send = sendMail, configured = isMailConfigured() } = {}) {
  if (!configured) return { sent: 0, failed: 0 };
  let sent = 0;
  let failed = 0;
  for (const goal of db.data.goals ?? []) {
    if (goal.achievedAt || goal.reviewReminderSentAt || !goal.reviewDate) continue;
    if (new Date(goal.reviewDate).getTime() > now) continue;
    const user = db.data.users.find((u) => u.id === goal.userId);
    if (!wants(user, 'notifyAssessment')) continue;

    const assessmentId = goal.assessmentId ?? 'ai-competency';
    const retested = db.data.submissions.some((s) => s.userId === user.id
      && (s.raterType ?? 'self') === 'self'
      && (s.assessmentId ?? 'ai-competency') === assessmentId
      && new Date(s.createdAt) > new Date(goal.createdAt));
    if (retested) continue;

    const assessmentName = db.data.assessments.find((a) => a.id === assessmentId)?.name ?? '評量';
    const result = await send({
      to: user.email,
      subject: `是時候回來複測了：${truncate(goal.text, 30)}`,
      text: [
        `${user.name || '您'} 您好：`,
        '',
        `您在 ${formatTaipeiDate(goal.createdAt)} 設定的發展目標「${goal.text}」` +
          `${goal.dimensionName ? `（${goal.dimensionName}）` : ''}，預計檢視日是 ${formatTaipeiDate(goal.reviewDate)}。`,
        `現在回來再做一次「${assessmentName}」，就能看到這段時間的變化。`,
        '',
        `前往平台：${appBaseUrl()}/`,
        '',
        footer('評測提醒'),
      ].join('\n'),
    });
    if (result.ok) {
      goal.reviewReminderSentAt = new Date(now).toISOString();
      sent += 1;
    } else {
      failed += 1;
    }
  }
  if (sent > 0) db.persist();
  return { sent, failed };
}

/**
 * 教練新增／更新評語後通知作答者。刻意不在信裡放評語內容：評語可能包含敏感的
 * 績效觀察，Email 可能被轉寄或出現在共用信箱——只說「有新評語」並附連結。
 * 只通知「自評」作答（學員在「我的分析」看得到自己作答上的評語）。
 *
 * @returns {Promise<'sent'|'skipped'|'failed'>}
 */
export async function notifyNewComment(db, submission, coachName, { now = Date.now(), send = sendMail, configured = isMailConfigured() } = {}) {
  if (!configured || (submission.raterType ?? 'self') !== 'self') return 'skipped';
  const last = submission.commentNotifiedAt ? new Date(submission.commentNotifiedAt).getTime() : 0;
  if (now - last < COMMENT_NOTIFY_COOLDOWN_MS) return 'skipped';
  const user = db.data.users.find((u) => u.id === submission.userId);
  if (!wants(user, 'notifyComment')) return 'skipped';

  const assessmentName = db.data.assessments.find((a) => a.id === (submission.assessmentId ?? 'ai-competency'))?.name ?? '評量';
  // 先記下時間再寄：寄信要等 SMTP 回應，這段期間教練若又存了一次，不會再寄第二封。
  submission.commentNotifiedAt = new Date(now).toISOString();
  const result = await send({
    to: user.email,
    subject: `${coachName || '教練'}給了您新的評語`,
    text: [
      `${user.name || '您'} 您好：`,
      '',
      `${coachName || '您的教練'}針對您 ${formatTaipeiDate(submission.createdAt)} 完成的「${assessmentName}」留下了評語。`,
      '登入平台後，到「我的分析」就能看到完整內容。',
      '',
      `前往平台：${appBaseUrl()}/`,
      '',
      footer('教練評語通知'),
    ].join('\n'),
  });
  if (!result.ok) {
    // 寄送失敗就把時間還原，下次教練再存評語時可以重試。
    if (last) submission.commentNotifiedAt = new Date(last).toISOString();
    else delete submission.commentNotifiedAt;
    return 'failed';
  }
  db.persist();
  return 'sent';
}
