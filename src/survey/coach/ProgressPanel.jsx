import { useEffect, useState } from 'react';
import { ClipboardList, Copy, Check, Mail } from 'lucide-react';
import { api } from '../api/client';
import { formatDate } from '../utils/format';

// 跟後端 routes/coach.js 的 REMINDER_COOLDOWN_MS 一致；後端才是權威（冷卻中會回
// 429），這裡只是讓按鈕事先顯示「幾分鐘後可再寄」，不必讓教練按了才知道。
const REMINDER_COOLDOWN_MS = 60 * 60 * 1000;

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
}

/**
 * 「寄送提醒信」（Sprint 6 驗收條件 6.5）：後端依同一套規則挑對象、一人一封
 * 寄出。寄信是對真實學員的對外動作，先跳確認框、寫明會寄給幾個人。
 * showToast／confirm 由父層傳入（不在這裡呼叫 useToast/useConfirm），讓
 * ProgressPanel 單獨渲染（例如單元測試）時不必包 Provider。
 */
function SendReminderButton({ group, targetCount, phaseLabel, onGroupUpdated, showToast, confirm }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  // 「現在時間」放 state、每 30 秒更新：冷卻倒數會自己往下走，冷卻結束時按鈕
  // 自動恢復可按，不必重新整理頁面（也避免在 render 裡直接呼叫 Date.now()）。
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  const cooldownUntil = group.lastReminderSentAt
    ? new Date(group.lastReminderSentAt).getTime() + REMINDER_COOLDOWN_MS
    : 0;
  const coolingDown = cooldownUntil > now;
  const notOpen = group.phase && group.phase !== 'in_progress';

  let hint = '';
  if (notOpen) hint = '目前不在施測期間，無法寄送提醒信';
  else if (coolingDown) {
    hint = `已於 ${formatTime(group.lastReminderSentAt)} 寄出，` +
      `${Math.ceil((cooldownUntil - now) / 60000)} 分鐘後可再寄`;
  }

  const handleSend = async () => {
    const ok = await confirm({
      title: '寄送提醒信',
      message: `將寄送「${phaseLabel}評測」提醒信給 ${targetCount} 位尚未完成的成員（一人一封，含作答連結）。確定寄出？`,
      confirmLabel: '寄出',
      danger: false,
    });
    if (!ok) return;
    setSending(true);
    setError('');
    try {
      const res = await api.sendGroupReminders(group.id);
      setNow(Date.now());
      onGroupUpdated(res.group);
      if (res.sent === 0 && res.failed.length === 0) showToast('目前沒有需要提醒的成員');
      else if (res.failed.length === 0) showToast(`已寄出 ${res.sent} 封提醒信`);
      else setError(`已寄出 ${res.sent} 封；${res.failed.length} 封寄送失敗：${res.failed.join('、')}`);
    } catch (e) {
      setError(e.message || '寄送失敗');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleSend}
        disabled={sending || coolingDown || notOpen}
        title={hint || undefined}
        className="btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Mail className="h-3.5 w-3.5" />
        {sending ? '寄送中…' : '寄送提醒信'}
      </button>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {error && <p role="alert" className="max-w-xs text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}

function buildJoinUrl(joinCode) {
  return `${window.location.origin}${window.location.pathname}?join=${joinCode}`;
}

/**
 * 作答進度追蹤 + 一鍵催交（Sprint 4 驗收條件 4.1、4.2）：教練不必自己比對
 * 成員名單就知道誰還沒交，並能一鍵複製一則現成的提醒訊息貼去 LINE／Email。
 *
 * 只看「自評」提交（raterType 為 self 或未設定），跟 SurveyApp／NextStepCard
 * 判斷課前/課後的邏輯一致——360° 他評不算在「這個人自己交了沒」裡面。
 *
 * 有傳 onGroupUpdated（＋showToast、confirm）時才顯示「寄送提醒信」按鈕。
 */
export default function ProgressPanel({ group, members, submissions, onGroupUpdated, showToast, confirm }) {
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

  // 寄信對象的判定跟後端 POST /coach/groups/:id/remind 一致：還有人沒做課前
  // （含尚未註冊的待加入名單）就只催課前，全員課前完成後才催課後。
  const pendingInvites = group.pendingMembers ?? [];
  const remindPre = notStartedPre.length > 0 || pendingInvites.length > 0;
  const remindCount = remindPre ? notStartedPre.length + pendingInvites.length : pendingPost.length;

  if (memberList.length === 0) return null;

  return (
    <div className="panel">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 font-semibold text-slate-700">
          <ClipboardList className="h-4 w-4 text-brass-500" /> 作答進度
        </h4>
        <div className="flex flex-wrap items-start gap-2">
          <button type="button" onClick={handleCopy} className="btn-secondary btn-sm">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? '已複製' : '複製提醒訊息'}
          </button>
          {onGroupUpdated && remindCount > 0 && (
            <SendReminderButton
              group={group}
              targetCount={remindCount}
              phaseLabel={remindPre ? '課前' : '課後'}
              onGroupUpdated={onGroupUpdated}
              showToast={showToast}
              confirm={confirm}
            />
          )}
        </div>
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
