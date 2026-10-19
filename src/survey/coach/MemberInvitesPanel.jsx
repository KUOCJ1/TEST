import { useState } from 'react';
import { Copy, Download, Mail, RefreshCw, Ban, Link2 } from 'lucide-react';
import { api } from '../api/client';
import { buildCsvBlob } from '../utils/csvExport';
import InfoTip from '../components/InfoTip';
import { formatDate } from '../utils/format';

const STATE_LABEL = {
  invited: { text: '已邀請，等對方註冊', cls: 'bg-blue-50 text-blue-700' },
  expired: { text: '邀請已過期', cls: 'bg-amber-50 text-amber-700' },
  joined: { text: '已加入', cls: 'bg-emerald-50 text-emerald-700' },
};

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/**
 * 「學員邀請」：後台先把學員 Email 編進班級，每位未註冊的學員得到一組專屬邀請連結（14 天有效、只能用一次）。
 * 學員用連結註冊（Email 與姓名已帶入）後自動入班。SMTP 沒設定時「寄送邀請信」停用，
 * 其餘功能（複製連結、匯出連結清單、重新產生、撤銷）不受影響。
 */
export default function MemberInvitesPanel({ group, invites, mailConfigured, onChanged, showToast }) {
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const counts = { joined: 0, invited: 0, expired: 0 };
  invites.forEach((i) => { counts[i.state] += 1; });
  const outstanding = invites.filter((i) => i.state === 'invited');

  const run = async (id, fn, okMessage) => {
    setBusyId(id);
    setError('');
    try {
      const result = await fn();
      if (okMessage) showToast?.(typeof okMessage === 'function' ? okMessage(result) : okMessage);
      await onChanged?.();
    } catch (e) {
      setError(e.message || '操作失敗，請稍後再試');
    } finally {
      setBusyId('');
    }
  };

  const copyLink = async (inv) => showToast?.((await copyText(inv.link)) ? `已複製 ${inv.email} 的邀請連結` : '無法存取剪貼簿，請手動選取連結');
  const copyAll = async () => {
    const text = outstanding.map((i) => `${i.name || i.email}\t${i.link}`).join('\n');
    showToast?.((await copyText(text)) ? `已複製 ${outstanding.length} 筆邀請連結（姓名與連結）` : '無法存取剪貼簿');
  };
  const exportCsv = () => {
    const rows = [['姓名', 'Email', '邀請連結', '邀請碼', '狀態', '有效至']];
    invites.filter((i) => i.state !== 'joined').forEach((i) => rows.push([i.name, i.email, i.link, i.code, STATE_LABEL[i.state].text, formatDate(i.expiresAt)]));
    buildCsvBlob(rows, `${group.name}-邀請連結.csv`);
  };

  if (invites.length === 0) {
    return (
      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="flex items-center text-xs font-semibold text-slate-600">
          學員邀請
          <InfoTip text="在下方「批量匯入名單」貼上學員 Email，系統會為每位尚未註冊的學員產生專屬邀請連結。" />
        </p>
        <p className="mt-1 text-xs text-slate-400">還沒有邀請。用下方「批量匯入名單」貼上 Email 後，這裡會列出每位學員的邀請連結與狀態。</p>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3" aria-label="學員邀請">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center text-sm font-semibold text-slate-700">
          學員邀請
          <InfoTip text="每位學員一組專屬連結，14 天有效、只能用一次。學員用連結註冊（Email 與姓名已帶入）後會自動加入這個班級。" />
        </p>
        <p className="text-xs text-slate-500">已加入 {counts.joined} · 邀請中 {counts.invited} · 已過期 {counts.expired}</p>
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        <button type="button" onClick={copyAll} disabled={outstanding.length === 0} className="btn-secondary btn-sm disabled:opacity-50">
          <Copy className="h-3.5 w-3.5" /> 複製全部連結
        </button>
        <button type="button" onClick={exportCsv} disabled={counts.invited + counts.expired === 0} className="btn-secondary btn-sm disabled:opacity-50">
          <Download className="h-3.5 w-3.5" /> 匯出連結清單
        </button>
        <button
          type="button"
          disabled={!mailConfigured || outstanding.length === 0 || busyId === 'all'}
          title={mailConfigured ? undefined : '尚未設定寄信服務（SMTP）。先用「複製連結」或「匯出連結清單」自行寄出。'}
          onClick={() => run('all', () => api.sendMemberInvites(group.id), (r) => (r.failed?.length ? `已寄出 ${r.sent} 封，${r.failed.length} 封失敗：${r.failed.join('、')}` : `已寄出 ${r.sent} 封邀請信`))}
          className="btn-primary btn-sm disabled:opacity-50"
        >
          <Mail className="h-3.5 w-3.5" /> 寄送全部邀請信
        </button>
      </div>
      {!mailConfigured && (
        <p className="mb-2 text-xs text-slate-400">尚未設定寄信服務，無法由系統寄信；請用「複製連結」或「匯出連結清單」，自行用 LINE 或信箱寄給學員。</p>
      )}

      {error && <p role="alert" className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
        {invites.map((inv) => {
          const st = STATE_LABEL[inv.state];
          const busy = busyId === inv.id;
          return (
            <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-700">{inv.name || inv.email}</p>
                {inv.name && <p className="truncate text-xs text-slate-400">{inv.email}</p>}
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 ${st.cls}`}>{st.text}</span>
                  {inv.state === 'invited' && <span className="text-slate-400">有效至 {formatDate(inv.expiresAt)}</span>}
                  {inv.sendCount > 0 && <span className="text-slate-400">已寄 {inv.sendCount} 次</span>}
                </p>
              </div>
              {inv.state !== 'joined' && (
                <div className="flex flex-wrap gap-1.5">
                  {inv.state === 'invited' && (
                    <button type="button" onClick={() => copyLink(inv)} aria-label={`複製 ${inv.email} 的邀請連結`} className="btn-secondary btn-sm">
                      <Link2 className="h-3.5 w-3.5" /> 複製連結
                    </button>
                  )}
                  <button
                    type="button" disabled={busy}
                    onClick={() => run(inv.id, () => api.regenerateMemberInvite(group.id, inv.id), '已產生新的邀請連結（舊連結失效）')}
                    aria-label={`重新產生 ${inv.email} 的邀請連結`} className="btn-secondary btn-sm disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> {inv.state === 'expired' ? '重新邀請' : '重新產生'}
                  </button>
                  {inv.state === 'invited' && (
                    <button
                      type="button" disabled={!mailConfigured || busy}
                      title={mailConfigured ? undefined : '尚未設定寄信服務（SMTP）'}
                      onClick={() => run(inv.id, () => api.sendMemberInvites(group.id, [inv.id]), `已寄出邀請信給 ${inv.email}`)}
                      aria-label={`寄送邀請信給 ${inv.email}`} className="btn-secondary btn-sm disabled:opacity-50"
                    >
                      <Mail className="h-3.5 w-3.5" /> 寄信
                    </button>
                  )}
                  <button
                    type="button" disabled={busy}
                    onClick={() => run(inv.id, () => api.revokeMemberInvite(group.id, inv.id), '已撤銷邀請')}
                    aria-label={`撤銷 ${inv.email} 的邀請`} className="btn-secondary btn-sm text-red-600 disabled:opacity-50"
                  >
                    <Ban className="h-3.5 w-3.5" /> 撤銷
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
