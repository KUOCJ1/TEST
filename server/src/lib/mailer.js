// 寄信模組（Sprint 6）：健康檢查告警、教練催交提醒信共用。
//
// 不綁定特定寄信廠商——用 nodemailer 接任何提供 SMTP relay 的服務（Gmail、
// SendGrid、Mailgun…），全部靠環境變數設定。沒設定時 sendMail() 回傳
// { ok:false, code:'CONFIG_ERROR' } 而不是丟例外，呼叫端據此優雅降級，
// 跟 chat.js 對 OPENROUTER_API_KEY 未設定時的處理方式一致：寄信壞掉或沒設定，
// 絕不能連帶讓評測本身壞掉。
//
// 跟 health.js 一樣，環境變數在呼叫當下才讀，不在模組載入時快取——測試裡用
// 不同 env 值呼叫多次時不會被舊值卡住。transport 也每次重建，成本很低（只是
// 建物件，真正連線發生在 sendMail 時），換來可以在測試裡 mock
// nodemailer.createTransport。
import nodemailer from 'nodemailer';

export function isMailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * @param {{to:string, subject:string, text:string}} message
 * @returns {Promise<{ok:true} | {ok:false, code:'CONFIG_ERROR'|'SEND_ERROR', error?:string}>}
 */
export async function sendMail({ to, subject, text }) {
  if (!isMailConfigured()) return { ok: false, code: 'CONFIG_ERROR' };

  const port = Number(process.env.SMTP_PORT) || 587;
  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      // 465 是 implicit TLS；587/25 走 STARTTLS，nodemailer 會自動升級。
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    });
    return { ok: true };
  } catch (err) {
    const error = err?.message ?? String(err);
    console.error('[mailer] sendMail failed', to, error);
    return { ok: false, code: 'SEND_ERROR', error };
  }
}
