import { useState } from 'react';
import { X } from 'lucide-react';
import { useGroups } from '../../context/GroupContext';

export default function JoinGroupModal({ isOpen, onClose, onJoined }) {
  const { joinGroup } = useGroups();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim()) return setError('請輸入邀請碼');
    try {
      const group = joinGroup(code);
      setCode('');
      setError('');
      onJoined(group);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-800">加入群組行事曆</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">邀請碼</label>
            <input
              type="text"
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
              placeholder="例：AB12CD"
              maxLength={6}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
          <p className="text-xs text-slate-400">向群組管理員索取 6 碼邀請碼後輸入此處</p>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
              取消
            </button>
            <button type="submit" className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors">
              加入
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
