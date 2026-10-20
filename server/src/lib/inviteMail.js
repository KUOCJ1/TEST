import { appBaseUrl, formatTaipeiDate } from './mailer.js';
import { inviteLink } from './memberInvites.js';

export const MAX_INVITE_SUBJECT = 150;
export const MAX_INVITE_BODY = 4000;

/**
 * 班級可以自訂整封邀請信的主旨與內文（group.inviteSubject／inviteBody），用「寄信的人自己的口吻」寫：
 * 客戶專案常由客戶內部的承辦窗口（HR）用自己的信箱寄出，署名與語氣都要是承辦單位，不是平台或外部講師。
 * 可用的欄位（寄給每個人時換成他自己的）：
 *   {{姓名}} {{班級}} {{公司}} {{講師}} {{連結}} {{邀請碼}} {{期限}}
 * 內文沒有放 {{連結}} 時，會在最後補上專屬連結與邀請碼——不能寄出一封沒有連結的邀請信。
 */
export function renderInviteTemplate(text, { group, invite }) {
  const values = {
    姓名: invite.name || '同學',
    班級: group.name ?? '',
    公司: group.companyName ?? '',
    講師: group.coachName ?? '',
    連結: inviteLink(invite.code, appBaseUrl()),
    邀請碼: invite.code,
    期限: formatTaipeiDate(invite.expiresAt),
  };
  return String(text ?? '').replace(/\{\{\s*([^{}\s]+)\s*\}\}/g, (m, key) => (key in values ? values[key] : m));
}

/**
 * 邀請信：沒有自訂內容時用預設的信（誰邀請、做什麼、怎麼進來、什麼時候到期、收錯信怎麼辦）；
 * 班級設定了 inviteBody 就用自訂的，專屬連結與邀請碼一樣由系統帶入。
 */
export function buildInviteMail({ group, invite }) {
  const link = inviteLink(invite.code, appBaseUrl());
  const ctx = { group, invite };

  if (group.inviteBody?.trim()) {
    let text = renderInviteTemplate(group.inviteBody, ctx);
    if (!/\{\{\s*連結\s*\}\}/.test(group.inviteBody)) {
      text = `${text}\n\n專屬連結：${link}\n邀請碼：${invite.code}（連結打不開時，可在登入頁輸入）`;
    }
    return {
      subject: group.inviteSubject?.trim()
        ? renderInviteTemplate(group.inviteSubject, ctx)
        : `【${group.name}】邀請你加入線上評測`,
      text,
    };
  }

  const org = group.companyName ? `（${group.companyName}）` : '';
  return {
    subject: group.inviteSubject?.trim()
      ? renderInviteTemplate(group.inviteSubject, ctx)
      : `【${group.name}】邀請你加入線上評測`,
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
