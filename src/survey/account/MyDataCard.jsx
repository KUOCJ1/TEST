import { useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { downloadMyData } from './downloadMyData';

// 個人設定「我的資料」（Sprint 39）：下載我的資料、刪除帳號（7 天內可取消）。教練與管理者的帳號牽涉班級，請聯絡管理者。
export default function MyDataCard() {
  const { user, requestDeletion } = useAuth();
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [understood, setUnderstood] = useState(false);
  const selfService = user?.role === 'user';

  const download = async () => {
    setBusy('download'); setMsg({ type: '', text: '' });
    try { await downloadMyData(); setMsg({ type: 'ok', text: '已下載你的資料（JSON 檔）。' }); } catch (e) { setMsg({ type: 'err', text: e.message || '下載失敗，請稍後再試' }); } finally { setBusy(''); }
  };
  const submit = async () => {
    setBusy('delete'); setMsg({ type: '', text: '' });
    try { await requestDeletion(password); } catch (e) { setMsg({ type: 'err', text: e.message || '申請失敗，請稍後再試' }); setBusy(''); }
  };

  return (
    <section className="card" aria-labelledby="my-data-title">
      <h3 id="my-data-title" className="text-base font-bold text-slate-700">我的資料</h3>
      <p className="mt-0.5 text-sm text-slate-500">下載你在平台上的資料副本，或刪除帳號。</p>
      <div className="mt-4 space-y-4">
        <div>
          <button type="button" onClick={download} disabled={busy !== ''} className="btn-secondary">
            <Download className="h-4 w-4" aria-hidden="true" /> {busy === 'download' ? '準備中…' : '下載我的資料'}
          </button>
          <p className="mt-1.5 text-xs text-slate-500">包含帳號資料、你的作答與結果、教練給你的評語、你的目標與微練習、學習清單。別人對你的 360° 評分依匿名規則只在報告裡以彙總呈現，不含個別評分。</p>
        </div>

        <div className="border-t border-slate-100 pt-4">
          {!selfService ? (
            <p className="text-sm text-slate-500">教練與管理者的帳號牽涉班級與其他人的資料，要刪除請聯絡平台管理者。</p>
          ) : !deleting ? (
            <button type="button" onClick={() => setDeleting(true)} className="btn-danger">
              <Trash2 className="h-4 w-4" aria-hidden="true" /> 刪除我的帳號
            </button>
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4">
              <h4 className="font-bold text-red-700">刪除帳號</h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-red-800">
                <li>按下後立刻停止使用：你會退出所有班級，教練的班級報告與統計不再包含你的資料，也不會再收到任何信。</li>
                <li><strong>7 天內</strong>重新登入可以取消，一切恢復原狀；7 天後永久刪除，無法復原。</li>
                <li>你幫別人做的 360° 評分會<strong>去識別化保留</strong>（拿掉你的姓名與帳號，只留分數），以免對方的報告因此不完整。</li>
                <li>建議先「下載我的資料」留存。</li>
              </ul>
              <label htmlFor="delete-password" className="mt-3 block text-sm font-medium text-slate-700">輸入密碼確認</label>
              <input id="delete-password" type="password" className="input mt-1.5" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" className="mt-1" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
                我了解 7 天後會永久刪除，無法復原。
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={submit} disabled={!password || !understood || busy !== ''} className="btn-danger">
                  {busy === 'delete' ? '處理中…' : '確定刪除'}
                </button>
                <button type="button" onClick={() => { setDeleting(false); setPassword(''); setUnderstood(false); }} className="btn-ghost">取消</button>
              </div>
            </div>
          )}
        </div>
        {msg.text && <p role={msg.type === 'err' ? 'alert' : 'status'} className={`text-sm ${msg.type === 'err' ? 'text-red-600' : 'text-brass-600'}`}>{msg.text}</p>}
      </div>
    </section>
  );
}
