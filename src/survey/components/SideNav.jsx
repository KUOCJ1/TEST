import { Link } from 'react-router-dom';

/**
 * 桌機（lg 以上）左側固定導覽（榕光 D4）：取代頂部分頁列——功能一多（學員 4 ＋ 教練 ＋ 管理）頂部列
 * 會擠、會折行；左側欄依角色分組，之後加功能不會擠。手機仍是底部導覽，平板（sm～lg）仍是頁首分頁列。
 * 項目用 <button>（名稱＝分頁文字），與頁首分頁列的可及名稱一致。
 */
const GROUPS = [
  { label: '學習者', ids: ['home', 'analysis', '360', 'learning'] },
  { label: '教練', ids: ['coach'] },
  { label: '管理', ids: ['admin'] },
];

export default function SideNav({ tabs, isTabActive, onNavigate, logoSrc }) {
  return (
    <aside
      className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col px-3 py-5 lg:flex print:hidden"
      style={{ background: '#1f2924', color: '#dde6df' }}
    >
      <Link to="/home" aria-label="回到我的評量" title="回到我的評量" className="mb-5 flex items-center gap-2.5 rounded-md px-2 py-1 font-serif text-lg font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-200">
        <img src={logoSrc} alt="" className="h-8 w-8" />
        全方位職能評測
      </Link>
      <nav aria-label="側邊導覽" className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {GROUPS.map((g) => {
          const items = g.ids.map((id) => tabs.find((t) => t.id === id)).filter(Boolean);
          if (items.length === 0) return null;
          return (
            <div key={g.label} className="mb-3">
              <p className="px-3 pb-1 pt-2 text-xs font-semibold tracking-wide" style={{ color: '#9db2a6' }}>{g.label}</p>
              {items.map((t) => {
                const active = isTabActive(t.path);
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    title={t.hint}
                    onClick={() => onNavigate(t.path)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-200"
                    style={active ? { background: 'rgba(242,181,68,.16)', color: '#ffffff' } : undefined}
                  >
                    <t.Icon className="h-5 w-5 shrink-0" style={{ color: active ? '#f2b544' : undefined }} aria-hidden="true" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
