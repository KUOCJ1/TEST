import { useState } from 'react';
import { Footprints } from 'lucide-react';
import { api } from '../api/client';

/**
 * 班級行動概況（Sprint 26）：已設定目標／近 14 天有回報／還沒設定的人數。只有人數，看不到是哪幾位；
 * 「提醒還沒設定的人」對全體未設定者發送（教練不會得知名單）。成員少於 3 位時不顯示，避免等於點名。
 */
export default function GoalActivityPanel({ group, summary, mailConfigured, showToast }) {
  const [busy, setBusy] = useState(false);
  if (!summary) return null;
  if (summary.hidden) {
    return (
      <section aria-label="班級行動概況" className="panel">
        <h3 className="mb-1 flex items-center gap-1.5 font-semibold text-slate-700"><Footprints className="h-4 w-4 text-ink-700" /> 班級行動概況</h3>
        <p className="text-sm text-slate-500">班級成員少於 {summary.minN} 位時不顯示，避免等於點名個人。</p>
      </section>
    );
  }
  const remind = async () => {
    setBusy(true);
    try {
      const r = await api.remindGroupGoals(group.id);
      showToast?.(r.sent > 0 ? `已提醒 ${r.sent} 位還沒設定目標的成員` : '目前沒有需要提醒的成員');
    } catch (e) {
      showToast?.(e.message || '寄送失敗', 'error');
    } finally { setBusy(false); }
  };
  return (
    <section aria-label="班級行動概況" className="panel">
      <h3 className="mb-1 flex items-center gap-1.5 font-semibold text-slate-700"><Footprints className="h-4 w-4 text-ink-700" /> 班級行動概況</h3>
      <p className="mb-3 text-xs text-slate-500">報告之後，有多少人真的開始動。只有人數；個別目標預設只有學員自己看得到。</p>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[['已設定目標', summary.withGoal], [`近 ${summary.recentDays} 天有回報`, summary.recentCheckin], ['還沒設定', summary.noGoal]].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-slate-50 px-2 py-3">
            <dt className="text-xs text-slate-500">{l}</dt>
            <dd className="text-xl font-extrabold text-slate-800">{v}<span className="text-xs font-normal text-slate-400"> / {summary.members}</span></dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={remind} disabled={busy || !mailConfigured || summary.noGoal === 0} className="btn-secondary btn-sm">
          提醒還沒設定目標的人
        </button>
        <span className="text-xs text-slate-400">
          {!mailConfigured ? '尚未設定寄信服務（SMTP），無法寄送。' : '對全體未設定者寄信，你看不到是哪幾位；同班 1 小時只能寄一次。'}
        </span>
      </div>
    </section>
  );
}
