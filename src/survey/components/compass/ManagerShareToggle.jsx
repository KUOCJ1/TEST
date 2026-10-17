import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';

/**
 * 受評者決定「上級（主管）的評分」是否顯示在自己的 360° 報告中。
 * 上級通常只有一位、無法匿名，所以預設不顯示，同意後才顯示（可隨時撤回）。
 */
export default function ManagerShareToggle({ user, onChanged }) {
  const { setCompassManagerShare } = useAuth();
  const granted = Boolean(user?.compassManagerShare?.granted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggle = async () => {
    setBusy(true);
    setError('');
    try {
      await setCompassManagerShare(!granted);
      onChanged?.();
    } catch (e) {
      setError(e.message || '設定失敗，請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
      <p className="font-semibold text-slate-700">上級（主管）的評分</p>
      <p className="mt-1 text-slate-600">
        上級通常只有一位，無法匿名，所以預設不顯示在您的報告中。{granted ? '您已同意顯示。' : '您可以同意後再顯示。'}
        同意後仍可隨時撤回。
      </p>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={granted}
        className={`mt-2 ${granted ? 'btn-secondary' : 'btn-primary'} btn-sm disabled:opacity-50`}
      >
        {busy ? '處理中…' : granted ? '撤回同意（不再顯示上級評分）' : '同意顯示上級評分'}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
