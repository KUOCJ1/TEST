import { appBaseUrl, formatTaipeiDate } from './mailer.js';
import { inviteLink } from './memberInvites.js';

/** 邀請信：講清楚誰邀請、做什麼、怎麼進來、什麼時候到期，以及收錯信怎麼辦。 */
export function buildInviteMail({ group, invite }) {
  const link = inviteLink(invite.code, appBaseUrl());
  const org = group.companyName ? `（${group.companyName}）` : '';
  return {
    subject: `【${group.name}】邀請你加入線上評測`,
    text: [
      `${invite.name || '同學'} 您好：`,
      '',
      `${group.coachName || '授課教練'}邀請你加入「${group.name}」${org}的線上評測。`,
      '',
      '請點下面的連結，確認資料、設定密碼並同意隱私權政策後，就會自動加入這個班級：',
      link,
      '',
      `邀請碼：${invite.code}（連結打不開時，可在登入頁輸入）`,
      `連結有效期限至 ${formatTaipeiDate(invite.expiresAt)}，且只能使用一次；過期請向教練索取新的邀請。`,
      '',
      '如果你不認識這個班級或沒有預期收到這封信，請忽略它，不會有任何影響。',
    ].join('\n'),
  };
}
