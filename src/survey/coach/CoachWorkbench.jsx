import { useEffect, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/useToast';
import PhaseBadge from '../components/PhaseBadge';
import { todoTotal } from '../utils/workbench.js';
import { useIsMobile } from '../hooks/useIsMobile';

// 教練「今天要做什麼」工作台（Sprint 29）：每班的待辦只有人數，沒有名單（延續「教練看不到誰沒設定目標」的隱私決定）。
// 一鍵動作沿用各自的既有 API 與冷卻；要看名單、要處理，進入該班原本的頁面。

function Chip({ label, n, action }) {
  if (!n) return null;
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <span className="text-slate-600">{label} <strong className="text-slate-800">{n}</strong> 人</span>
      {action}
    </li>
  );
}

export default function CoachWorkbench({ onOpenGroup }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const showToast = useToast();
  const mobile = useIsMobile();

  useEffect(() => {
    let active = true;
    api.coachWorkbench().then((d) => active && setData(d)).catch(() => active && setData({ groups: [], mailConfigured: false }));
    return () => { active = false; };
  }, []);

  if (!data) return null;
  const withTodo = data.groups.filter((g) => todoTotal(g) > 0);
  const clear = data.groups.length - withTodo.length;

  const run = async (key, fn, okMsg) => {
    setBusy(key);
    try { const r = await fn(); showToast(okMsg(r)); } catch (e) { showToast(e.message || '寄送失敗', 'error'); } finally { setBusy(''); }
  };
  const btn = (key, label, fn, okMsg, disabled) => (
    <button type="button" className="btn-secondary btn-sm shrink-0" disabled={busy === key || !data.mailConfigured || disabled} onClick={() => run(key, fn, okMsg)}>{label}</button>
  );

  const body = (
    <section aria-label="今天要做什麼" className={mobile ? 'px-3 pb-3' : 'mb-5 rounded-2xl border border-brass-200 bg-brass-50 px-4 py-4 sm:px-5'}>
      {/* 手機：外層 <details> 的標題列已經寫了「今天要做什麼」，這裡不重複標題與外框。 */}
      {!mobile && <h3 className="flex items-center gap-1.5 font-serif text-lg font-bold text-ink-700"><ListChecks className="h-5 w-5" /> 今天要做什麼</h3>}
      <p className="mb-3 mt-0.5 text-xs text-slate-500">
        每個班目前的待辦人數（只有人數，沒有名單）。要看名單或處理，進入該班；一鍵提醒對全體符合條件的人寄信，各自有 1 小時冷卻{!data.mailConfigured ? '（尚未設定寄信服務，無法寄送）' : ''}。
      </p>
      {withTodo.length === 0 ? (
        <p className="rounded-lg bg-white/70 px-3 py-3 text-sm text-slate-600">今天沒有待辦，所有班級都在軌道上。</p>
      ) : (
        <ul className="space-y-3">
          {withTodo.map((g) => (
            <li key={g.id} className="rounded-xl bg-white px-4 py-3 ring-1 ring-paper-300">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => onOpenGroup(g.id)} className="text-left font-serif font-bold text-slate-900 hover:text-ink-700">{g.name}</button>
                  <PhaseBadge phase={g.phase} />
                  {g.companyName && <span className="text-xs text-slate-400">{g.companyName}</span>}
                </div>
                <button type="button" className="btn-ghost btn-sm" onClick={() => onOpenGroup(g.id)} aria-label={`進入 ${g.name}`}>進入班級 →</button>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                <Chip label="還沒作答" n={g.notDone} action={btn(`${g.id}:pre`, '催交', () => api.sendGroupReminders(g.id), (r) => (r.sent > 0 ? `已寄出 ${r.sent} 封催交信` : '目前沒有需要催交的人'), g.phase !== 'in_progress')} />
                <Chip label="他評不足的受評者" n={g.ratersLow} action={btn(`${g.id}:rater`, '提醒評分者', () => api.remindGroupRaters(g.id), (r) => (r.sent > 0 ? `已提醒 ${r.sent} 位評分者` : '目前沒有需要提醒的評分者'))} />
                <Chip label="還沒收到你的評語" n={g.uncommented} />
                <Chip label="還沒設定目標" n={g.noGoal} action={btn(`${g.id}:goal`, '提醒', () => api.remindGroupGoals(g.id), (r) => (r.sent > 0 ? `已提醒 ${r.sent} 位成員` : '目前沒有需要提醒的成員'))} />
                {g.warnings > 0 && (
                  <li className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <span>資料一致性警告 <strong>{g.warnings}</strong> 則</span>
                    <button type="button" className="btn-ghost btn-sm shrink-0" onClick={() => onOpenGroup(g.id)}>去看</button>
                  </li>
                )}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {clear > 0 && withTodo.length > 0 && <p className="mt-3 text-xs text-slate-500">另有 {clear} 個班沒有待辦。</p>}
    </section>
  );

  // 手機：預設收合（第一屏留給班級名稱與完成率），標題顯示待辦總數。
  if (!mobile) return body;
  const total = withTodo.reduce((n, x) => n + todoTotal(x), 0);
  return (
    <details className="mb-4 rounded-xl border border-brass-200 bg-brass-50">
      <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-2 px-4 py-2 text-sm font-semibold text-ink-700">
        <span>今天要做什麼</span>
        <span className="text-xs font-medium text-slate-500">{total > 0 ? `${total} 項待辦` : '沒有待辦'}</span>
      </summary>
      {body}
    </details>
  );
}
