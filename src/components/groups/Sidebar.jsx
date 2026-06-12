import { useState } from 'react';
import { Calendar, Users, Plus, UserPlus, Settings, X } from 'lucide-react';

export default function Sidebar({ groups, activeGroupId, onSelectPersonal, onSelectGroup, onCreateGroup, onJoinGroup, onManageGroup, isOpen, onClose }) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar panel */}
      <aside className={`
        fixed lg:relative top-0 left-0 h-full z-40 lg:z-auto
        w-56 bg-white border-r border-slate-200 flex flex-col
        transition-transform duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 lg:hidden">
          <span className="text-sm font-semibold text-slate-600">行事曆</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
          {/* Personal */}
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide px-2 mb-1 mt-1">我的行事曆</p>
          <button
            onClick={() => { onSelectPersonal(); onClose(); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeGroupId === null
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calendar size={16} className={activeGroupId === null ? 'text-indigo-500' : 'text-slate-400'} />
            個人行事曆
          </button>

          {/* Groups */}
          <div className="mt-3">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide px-2 mb-1">群組行事曆</p>
            {groups.length === 0 && (
              <p className="text-xs text-slate-400 px-3 py-1">尚未加入任何群組</p>
            )}
            {groups.map(group => (
              <div key={group.id} className="flex items-center group">
                <button
                  onClick={() => { onSelectGroup(group.id); onClose(); }}
                  className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    activeGroupId === group.id
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Users size={16} className={activeGroupId === group.id ? 'text-indigo-500' : 'text-slate-400'} />
                  <span className="truncate">{group.name}</span>
                  <span className={`ml-auto text-[10px] rounded-full px-1.5 py-0.5 ${
                    activeGroupId === group.id ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {group.members.length}
                  </span>
                </button>
                <button
                  onClick={() => onManageGroup(group.id)}
                  className="p-1.5 mr-1 text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-all"
                  title="管理成員"
                >
                  <Settings size={13} />
                </button>
              </div>
            ))}
          </div>
        </nav>

        {/* Bottom actions */}
        <div className="border-t border-slate-100 px-2 py-2 space-y-0.5">
          <button
            onClick={onCreateGroup}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Plus size={16} className="text-slate-400" />
            建立群組
          </button>
          <button
            onClick={onJoinGroup}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <UserPlus size={16} className="text-slate-400" />
            加入群組
          </button>
        </div>
      </aside>
    </>
  );
}
