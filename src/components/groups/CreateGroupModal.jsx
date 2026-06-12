import { useState } from 'react';
import { X } from 'lucide-react';
import { useGroups } from '../../context/GroupContext';

export default function CreateGroupModal({ isOpen, onClose, onCreated }) {
  const { createGroup } = useGroups();
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return setError('請輸入群組名稱');
    const group = createGroup(name);
    setName('');
    setError('');
    onCreated(group);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="create-group-title" className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 id="create-group-title" className="text-lg font-semibold text-slate-800">建立群組行事曆</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="關閉">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">群組名稱</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              placeholder="例：行銷團隊、家庭行事曆"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
              取消
            </button>
            <button type="submit" className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors">
              建立
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
