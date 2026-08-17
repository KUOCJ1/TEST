import { useEffect, useState } from 'react';
import { Maximize2, X as XIcon, RefreshCw, Copy, Check } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from './useToast';

// 用相對路徑組連結，正式站 base 為 '/'、GitHub Pages 預覽為 '/TEST/' 都能正確解析
// （沿用 UsersTab.jsx 重設密碼連結的寫法）。
function buildJoinUrl(joinCode) {
  return `${window.location.origin}${window.location.pathname}?join=${joinCode}`;
}

export default function QrCodeCard({ group, onUpdated }) {
  const [qrSvg, setQrSvg] = useState('');
  const [qrError, setQrError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const showToast = useToast();

  const joinCode = group.joinCode;
  const joinUrl = joinCode ? buildJoinUrl(joinCode) : '';

  // qrcode 套件動態載入，避免灌進教練後台的共用 chunk——只有實際展開/擁有報到
  // 代碼時才需要它。
  useEffect(() => {
    if (!joinCode) return undefined;
    let active = true;
    import('qrcode')
      .then((QRCode) => QRCode.toString(joinUrl, { type: 'svg', margin: 1, width: 512 }))
      .then((svg) => {
        if (!active) return;
        setQrSvg(svg);
        setQrError('');
      })
      .catch(() => { if (active) setQrError('QR Code 產生失敗，請重新整理頁面再試'); });
    return () => {
      active = false;
    };
  }, [joinCode, joinUrl]);

  const handleGenerate = async () => {
    setBusy(true);
    setError('');
    try {
      const { group: updated, autoOpened } = await api.generateJoinCode(group.id);
      onUpdated(updated);
      showToast(autoOpened ? '已產生報到 QR Code，並自動開啟作答期間' : '已產生報到 QR Code');
    } catch (e) {
      setError(e.message || '產生失敗');
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async () => {
    if (!window.confirm('確定撤銷此報到連結？撤銷後舊的 QR Code／連結會立即失效，學員需改用新連結。')) return;
    setBusy(true);
    setError('');
    try {
      const updated = await api.revokeJoinCode(group.id);
      onUpdated(updated);
      showToast('已撤銷報到連結');
    } catch (e) {
      setError(e.message || '撤銷失敗');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('複製失敗，請手動選取連結文字');
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-700">報到 QR Code</h3>
        {joinCode && (
          <button type="button" onClick={() => setFullscreen(true)} className="btn-secondary btn-sm">
            <Maximize2 className="h-3.5 w-3.5" /> 全螢幕投影
          </button>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      )}

      {!joinCode ? (
        <div className="py-4 text-center">
          <p className="mb-3 text-sm text-slate-400">尚未產生報到連結，學員無法掃碼加入本班。</p>
          <button type="button" onClick={handleGenerate} disabled={busy} className="btn-primary btn-sm mx-auto">
            {busy ? '產生中…' : '產生報到 QR Code'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <div className="shrink-0 [&_svg]:h-32 [&_svg]:w-32 rounded-lg border border-slate-100 p-2">
            {qrError ? (
              <p className="w-32 text-center text-xs text-red-500">{qrError}</p>
            ) : (
              // qrcode 套件自產的 SVG，非使用者輸入
              <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <p className="break-all rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{joinUrl}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleCopy} className="btn-secondary btn-sm">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? '已複製' : '複製連結'}
              </button>
              <button type="button" onClick={handleGenerate} disabled={busy} className="btn-secondary btn-sm">
                <RefreshCw className="h-3.5 w-3.5" /> {busy ? '重新產生中…' : '重新產生（舊連結立即失效）'}
              </button>
              <button type="button" onClick={handleRevoke} disabled={busy} className="btn-warning btn-sm">
                撤銷
              </button>
            </div>
            <p className="text-xs text-slate-400">
              學員掃碼或開啟連結後，需先註冊／登入帳號才會加入本班並開始作答。
            </p>
          </div>
        </div>
      )}

      {fullscreen && joinCode && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white p-8">
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            aria-label="關閉全螢幕"
            className="absolute right-6 top-6 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <XIcon className="h-6 w-6" />
          </button>
          <h2 className="text-2xl font-bold text-slate-800">{group.name} 報到</h2>
          {group.companyName && <p className="-mt-4 text-sm text-slate-400">{group.companyName}</p>}
          <div className="[&_svg]:h-72 [&_svg]:w-72 rounded-2xl border border-slate-200 p-4">
            {/* qrcode 套件自產的 SVG，非使用者輸入 */}
            <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
          </div>
          <p className="text-sm text-slate-500">請用手機掃描 QR Code，或前往：</p>
          <p className="break-all text-center text-lg font-semibold text-brand-700">{joinUrl}</p>
        </div>
      )}
    </div>
  );
}
