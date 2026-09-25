import { useState } from 'react';
import { ClipboardList, Copy, Check } from 'lucide-react';
import { formatDate } from '../utils/format';

function buildJoinUrl(joinCode) {
  return `${window.location.origin}${window.location.pathname}?join=${joinCode}`;
}

/**
 * 作答進度追蹤 + 一鍵催交（Sprint 4 驗收條件 4.1、4.2）：教練不必自己比對
 * 成員名單就知道誰還沒交，並能一鍵複製一則現成的提醒訊息貼去 LINE／Email。
 *
 * 只看「自評」提交（raterType 為 self 或未設定），跟 SurveyApp／NextStepCard
 * 判斷課前/課後的邏輯一致——360° 他評不算在「這個人自己交了沒」裡面。
 */
export default function ProgressPanel({ group, members, submissions }) {
  const [copied, setCopied] = useState(false);

  const selfSubs = submissions.filter((s) => (s.raterType ?? 'self') === 'self');
  const preDoneIds = new Set(selfSubs.filter((s) => (s.phase ?? 'pre') === 'pre').map((s) => s.userId));
  const postDoneIds = new Set(selfSubs.filter((s) => s.phase === 'post').map((s) => s.userId));

  const memberList = (group.memberIds ?? [])
    .map((id) => members.find((m) => m.id === id))
    .filter(Boolean);
  const notStartedPre = memberList.filter((m) => !preDoneIds.has(m.id));
  // 課後只對「課前已完成」的人才有意義——還沒做課前的人本來就不該被算進
  // 「課後未完成」名單，那會讓同一個人同時出現在兩份催交名單、造成困惑。
  const pendingPost = memberList.filter((m) => preDoneIds.has(m.id) && !postDoneIds.has(m.id));

  const buildReminderText = () => {
    const lines = [
      `【${group.name}】評測提醒`,
      notStartedPre.length > 0
        ? `還有 ${notStartedPre.length} 位同學尚未完成課前評測，請盡快完成：`
        : pendingPost.length > 0
          ? `還有 ${pendingPost.length} 位同學尚未完成課後複測，請盡快完成：`
          : '目前所有成員都已完成評測，謝謝大家！',
    ];
    if (group.endDate) lines.push(`截止日期：${formatDate(group.endDate)}`);
    if (group.joinCode) lines.push(`作答連結：${buildJoinUrl(group.joinCode)}`);
    return lines.join('\n');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildReminderText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* 剪貼簿權限被拒時靜默失敗，使用者仍可手動選取文字 */ }
  };

  if (memberList.length === 0) return null;

  return (
    <div className="panel">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 font-semibold text-slate-700">
          <ClipboardList className="h-4 w-4 text-brass-500" /> 作答進度
        </h4>
        <button type="button" onClick={handleCopy} className="btn-secondary btn-sm">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? '已複製' : '複製提醒訊息'}
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">課前</p>
          <p className="mt-0.5 text-xl font-bold text-slate-700">
            {preDoneIds.size}
            <span className="ml-1 text-sm font-semibold text-slate-400">/ {memberList.length}</span>
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">課後</p>
          <p className="mt-0.5 text-xl font-bold text-slate-700">
            {postDoneIds.size}
            <span className="ml-1 text-sm font-semibold text-slate-400">/ {memberList.length}</span>
          </p>
        </div>
      </div>

      {notStartedPre.length > 0 && (
        <div className="mb-2">
          <p className="mb-1 text-xs font-semibold text-amber-600">課前未完成（{notStartedPre.length}）</p>
          <div className="flex flex-wrap gap-1.5">
            {notStartedPre.map((m) => (
              <span key={m.id} className="chip bg-amber-50 text-amber-700" title={m.email}>{m.name}</span>
            ))}
          </div>
        </div>
      )}
      {pendingPost.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-blue-600">課後未完成（{pendingPost.length}）</p>
          <div className="flex flex-wrap gap-1.5">
            {pendingPost.map((m) => (
              <span key={m.id} className="chip bg-blue-50 text-blue-700" title={m.email}>{m.name}</span>
            ))}
          </div>
        </div>
      )}
      {notStartedPre.length === 0 && pendingPost.length === 0 && (
        <p className="text-sm text-emerald-600">🎉 所有成員都已完成評測。</p>
      )}
    </div>
  );
}
