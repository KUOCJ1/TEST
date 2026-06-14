import { useState, useEffect } from 'react';
import { X, User, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function UserSettingsModal({ isOpen, onClose }) {
  const { currentUser, updateProfile, changePassword } = useAuth();
  const [name, setName] = useState('');
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [nameStatus, setNameStatus] = useState(null);
  const [pwdStatus, setPwdStatus] = useState(null);
  const [savingName, setSavingName] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(currentUser?.name || '');
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      setNameStatus(null);
      setPwdStatus(null);
    }
  }, [isOpen, currentUser]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSaveName(e) {
    e.preventDefault();
    setSavingName(true);
    setNameStatus(null);
    try {
      updateProfile(name);
      setNameStatus({ ok: true, msg: '名稱已更新' });
    } catch (err) {
      setNameStatus({ ok: false, msg: err.message });
    } finally {
      setSavingName(false);
    }
  }

  async function handleChangePwd(e) {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      setPwdStatus({ ok: false, msg: '新密碼不一致' });
      return;
    }
    if (newPwd.length < 6) {
      setPwdStatus({ ok: false, msg: '新密碼至少需要 6 個字元' });
      return;
    }
    setSavingPwd(true);
    setPwdStatus(null);
    try {
      await changePassword(currentPwd, newPwd);
      setPwdStatus({ ok: true, msg: '密碼已更新' });
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (err) {
      setPwdStatus({ ok: false, msg: err.message });
    } finally {
      setSavingPwd(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-settings-title"
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 id="user-settings-title" className="text-base font-semibold text-slate-800">帳號設定</h2>
          <button onClick={onClose} aria-label="關閉" className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Display name */}
          <form onSubmit={handleSaveName} className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <User size={12} />
              顯示名稱
            </h3>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              aria-label="顯示名稱"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            {nameStatus && (
              <p className={`text-xs ${nameStatus.ok ? 'text-emerald-600' : 'text-red-500'}`}>{nameStatus.msg}</p>
            )}
            <button
              type="submit"
              disabled={savingName || !name.trim() || name.trim() === currentUser?.name}
              className="w-full py-2 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              儲存名稱
            </button>
          </form>

          <div className="border-t border-slate-100" />

          {/* Change password */}
          <form onSubmit={handleChangePwd} className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <Lock size={12} />
              變更密碼
            </h3>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPwd}
                onChange={e => setCurrentPwd(e.target.value)}
                placeholder="目前密碼"
                aria-label="目前密碼"
                autoComplete="current-password"
                className="w-full border border-slate-200 rounded-xl px-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <button type="button" onClick={() => setShowCurrent(v => !v)} aria-label={showCurrent ? '隱藏' : '顯示'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                placeholder="新密碼（至少 6 個字元）"
                aria-label="新密碼"
                autoComplete="new-password"
                className="w-full border border-slate-200 rounded-xl px-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <button type="button" onClick={() => setShowNew(v => !v)} aria-label={showNew ? '隱藏' : '顯示'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <input
              type="password"
              value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)}
              placeholder="確認新密碼"
              aria-label="確認新密碼"
              autoComplete="new-password"
              className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                confirmPwd && newPwd !== confirmPwd
                  ? 'border-red-300 focus:ring-red-400'
                  : 'border-slate-200 focus:ring-indigo-500'
              }`}
              required
            />
            {pwdStatus && (
              <p className={`text-xs ${pwdStatus.ok ? 'text-emerald-600' : 'text-red-500'}`}>{pwdStatus.msg}</p>
            )}
            <button
              type="submit"
              disabled={savingPwd || !currentPwd || !newPwd || !confirmPwd || (confirmPwd.length > 0 && newPwd !== confirmPwd)}
              className="w-full py-2 rounded-xl text-sm font-medium bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              變更密碼
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
