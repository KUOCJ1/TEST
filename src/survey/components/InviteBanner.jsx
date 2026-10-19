import { formatDate } from '../utils/format';

// 顯示邀請連結帶入的班級資訊。info：null＝查詢中；{ error, code }＝邀請失效；否則為
// { groupName, companyName, coachName, assessmentName, email, name, expiresAt, accountExists }。
export default function InviteBanner({ info }) {
  if (!info) {
    return <div role="status" className="mb-5 rounded-md bg-paper-200 px-5 py-4 text-sm text-ink-100">正在確認你的邀請…</div>;
  }

  if (info.error) {
    const hint = info.code === 'INVITE_USED'
      ? '如果你已經註冊過，請直接登入。'
      : '請向教練索取新的邀請連結；你也可以先用已有的帳號登入，或自己註冊後再輸入邀請碼。';
    return (
      <div role="alert" className="mb-5 flex gap-3 rounded-md border border-amber-200 bg-amber-50 px-5 py-4 text-amber-800">
        <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
        <div>
          <div className="font-serif text-sm font-semibold">這個邀請無法使用</div>
          <div className="mt-1 text-xs leading-relaxed opacity-90">{info.error}<br />{hint}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-md bg-ink-700 px-5 py-4 text-paper-50">
      <div className="mb-1 font-serif text-sm font-semibold">{info.coachName || '教練'}邀請你加入班級</div>
      <div className="text-xs leading-relaxed text-paper-50/80">
        {info.groupName}
        {info.companyName ? `．${info.companyName}` : ''}
        <br />
        完成{info.accountExists ? '登入' : '註冊'}後會自動加入，並可開始「{info.assessmentName}」。
        <br />
        邀請有效至 {formatDate(info.expiresAt)}
      </div>
    </div>
  );
}
