import { useState } from 'react';
import { X, Copy, Check, Crown, LogOut, Trash2, UserMinus } from 'lucide-react';
import { useGroups } from '../../context/GroupContext';

export default function MembersModal({ isOpen, onClose, groupId, currentUserId, onLeft }) {
  const { getGroupById, leaveGroup, removeMember, renameGroup, refresh } = useGroups();
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState('');

  if (!isOpen) return null;

  const group = getGroupById(groupId);
  if (!group) return null;

  const isOwner = group.members.find(m => m.userId === currentUserId)?.role === 'owner';

  function copyCode() {
    navigator.clipboard.writeText(group.inviteCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function startRename() {
    setNameVal(group.name);
    setEditingName(true);
  }

  function saveRename() {
    if (nameVal.trim()) renameGroup(groupId, nameVal);
    setEditingName(false);
  }

  function handleLeave() {
    if (!confirm(`確定要離開「${group.name}」嗎？`)) return;
    leaveGroup(groupId);
    onLeft();
    onClose();
  }

  function handleRemove(userId, name) {
    if (!confirm(`確定要移除成員「${name}」嗎？`)) return;
    removeMember(groupId, userId);
    refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          {editingName ? (
            <input
              autoFocus
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onBlur={saveRename}
              onKeyDown={e => e.key === 'Enter' && saveRename()}
              className="text-lg font-semibold text-slate-800 border-b-2 border-indigo-500 outline-none bg-transparent"
            />
          ) : (
            <h2
              className={`text-lg font-semibold text-slate-800 ${isOwner ? 'cursor-pointer hover:text-indigo-600' : ''}`}
              onClick={isOwner ? startRename : undefined}
              title={isOwner ? '點擊編輯群組名稱' : undefined}
            >
              {group.name}
            </h2>
          )}
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Invite code */}
        <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100">
          <p className="text-xs text-indigo-600 font-medium mb-1.5">邀請碼（分享給要加入的人）</p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xl font-bold text-indigo-700 tracking-widest">{group.inviteCode}</span>
            <button
              onClick={copyCode}
              className="ml-auto flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 px-2.5 py-1 rounded-lg transition-colors"
            >
              {copied ? <><Check size={13} /> 已複製</> : <><Copy size={13} /> 複製</>}
            </button>
          </div>
        </div>

        {/* Members list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <p className="text-xs font-medium text-slate-500 mb-2">成員（{group.members.length} 人）</p>
          <div className="space-y-1">
            {group.members.map(m => (
              <div key={m.userId} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-slate-50">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-semibold shrink-0">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {m.name} {m.userId === currentUserId && <span className="text-xs text-slate-400">（你）</span>}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{m.email}</p>
                </div>
                {m.role === 'owner' && (
                  <Crown size={14} className="text-amber-400 shrink-0" title="管理員" />
                )}
                {isOwner && m.userId !== currentUserId && (
                  <button
                    onClick={() => handleRemove(m.userId, m.name)}
                    className="text-slate-300 hover:text-red-500 transition-colors"
                    title="移除成員"
                  >
                    <UserMinus size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-slate-100">
          <button
            onClick={handleLeave}
            className="w-full flex items-center justify-center gap-2 text-sm text-red-500 hover:text-red-700 py-2 rounded-xl hover:bg-red-50 transition-colors"
          >
            {isOwner && group.members.length === 1 ? <><Trash2 size={15} />解散群組</> : <><LogOut size={15} />離開群組</>}
          </button>
        </div>
      </div>
    </div>
  );
}
