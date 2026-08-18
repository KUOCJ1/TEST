// 顯示 QR 報到連結帶入的班級資訊。info 可能是 null（讀取中）、'invalid'（代碼失效）
// 或 { groupName, companyName, assessmentId, assessmentName, phase }。
export default function JoinClassBanner({ info }) {
  if (!info) return null;

  if (info === 'invalid') {
    return (
      <div className="mb-5 flex gap-3 rounded-md border border-amber-200 bg-amber-50 px-5 py-4 text-amber-800">
        <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
        <div>
          <div className="font-serif text-sm font-semibold">報到連結已失效</div>
          <div className="mt-1 text-xs leading-relaxed opacity-90">
            請向講師確認最新的報到連結，或使用原有帳號密碼登入。
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-md bg-ink-700 px-5 py-4 text-paper-50">
      <div className="font-serif text-sm font-semibold mb-1">您正在加入班級</div>
      <div className="text-xs leading-relaxed text-paper-50/80">
        {info.groupName}
        {info.companyName ? `．${info.companyName}` : ''}
        <br />
        完成登入／註冊後將自動加入，並開始「{info.assessmentName}」評測。
      </div>
    </div>
  );
}
