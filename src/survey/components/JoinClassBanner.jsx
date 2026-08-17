// 顯示 QR 報到連結帶入的班級資訊。info 可能是 null（讀取中）、'invalid'（代碼失效）
// 或 { groupName, companyName, assessmentId, assessmentName, phase }。
export default function JoinClassBanner({ info }) {
  if (!info) return null;

  if (info === 'invalid') {
    return (
      <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-700">
        <div className="mb-1 text-sm font-bold">⚠️ 報到連結已失效</div>
        <div className="text-xs leading-relaxed opacity-90">
          請向講師確認最新的報到連結，或使用原有帳號密碼登入。
        </div>
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 px-5 py-4 text-white shadow-lg shadow-brand-500/25">
      <div className="mb-1 text-sm font-bold">📋 您正在加入班級</div>
      <div className="text-xs leading-relaxed opacity-90">
        {info.groupName}
        {info.companyName ? `．${info.companyName}` : ''}
        <br />
        完成登入／註冊後將自動加入，並開始「{info.assessmentName}」評測。
      </div>
    </div>
  );
}
