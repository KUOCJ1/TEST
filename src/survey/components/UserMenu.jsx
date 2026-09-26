import { useEffect, useRef, useState } from 'react';
import { ChevronDown, CircleHelp, Download, LogOut, User } from 'lucide-react';

/**
 * 頁首右上角的使用者選單（Sprint 8 驗收條件 8.2）：個人設定、使用說明、手冊下載、
 * 登出收在這裡，頁首只留功能分頁——以前這四顆按鈕跟分頁擠在同一列，教練／管理者
 * 的分頁一多，桌機 1280px 就折成兩行。
 *
 * 鍵盤：Enter／空白鍵／↓ 開啟並聚焦第一項，↑↓ 移動，Esc 關閉並把焦點還給按鈕；
 * 點選單外任何地方也會關閉。
 */
export default function UserMenu({ user, roleLabel, onProfile, onHelp, manualHref, onLogout }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    menuRef.current?.querySelector('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const onMenuKeyDown = (e) => {
    const items = [...menuRef.current.querySelectorAll('[role="menuitem"]')];
    const idx = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1) % items.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(idx - 1 + items.length) % items.length]?.focus(); }
    else if (e.key === 'Tab') setOpen(false);
  };

  const choose = (fn) => { close(false); fn(); };
  const initial = (user.name || user.email || '?').trim().charAt(0).toUpperCase();
  const itemCls = 'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none';

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${user.name} 的帳號選單`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); } }}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2 text-sm transition-colors hover:border-brass-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-400"
      >
        <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-700 text-xs font-bold text-white">
          {initial}
        </span>
        <span className="hidden max-w-[8rem] truncate font-medium text-slate-700 md:inline">{user.name}</span>
        {roleLabel && (
          <span className="hidden rounded bg-paper-200 px-1.5 py-0.5 text-xs font-semibold text-ink-600 md:inline">{roleLabel}</span>
        )}
        <ChevronDown aria-hidden="true" className={`h-4 w-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="帳號選單"
          onKeyDown={onMenuKeyDown}
          className="animate-menu-in absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-card"
        >
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="truncate text-sm font-semibold text-slate-800">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <button type="button" role="menuitem" className={itemCls} onClick={() => choose(onProfile)}>
            <User aria-hidden="true" className="h-4 w-4 text-slate-500" /> 個人設定
          </button>
          <button type="button" role="menuitem" className={itemCls} onClick={() => choose(onHelp)}>
            <CircleHelp aria-hidden="true" className="h-4 w-4 text-slate-500" /> 使用說明
          </button>
          <a role="menuitem" className={itemCls} href={manualHref} download="職能評測平台使用手冊.pdf" onClick={() => close(false)}>
            <Download aria-hidden="true" className="h-4 w-4 text-slate-500" /> 手冊下載（PDF）
          </a>
          <div className="my-1 border-t border-slate-100" />
          <button type="button" role="menuitem" className={itemCls} onClick={() => choose(onLogout)}>
            <LogOut aria-hidden="true" className="h-4 w-4 text-slate-500" /> 登出
          </button>
        </div>
      )}
    </div>
  );
}
