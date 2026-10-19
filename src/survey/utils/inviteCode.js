/**
 * 從使用者貼上的內容取出邀請碼：可以是邀請連結（...?invite=ABCDE23456）或邀請碼本身，
 * 容許大小寫、空白與連字號。
 */
export function extractInviteCode(raw) {
  const text = String(raw ?? '').trim();
  const fromLink = text.match(/[?&]invite=([A-Za-z0-9-]+)/);
  return (fromLink ? fromLink[1] : text).replace(/[\s-]/g, '').toUpperCase();
}
