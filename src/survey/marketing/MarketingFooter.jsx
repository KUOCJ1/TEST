import { Link } from 'react-router-dom';
import { MARKETING_LINKS } from './links';

/**
 * 行銷頁共用頁尾。導覽列連結在窄螢幕會隱藏（見 MarketingNav），這裡另外重複
 * 一份給手機使用者，確保四個新頁面在任何裝置都找得到彼此。
 */
export default function MarketingFooter() {
  return (
    <footer className="border-t border-ink-700/10 bg-paper-100 px-6 py-10 text-center text-sm text-ink-50">
      <nav aria-label="頁尾導覽" className="mb-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 md:hidden">
        {MARKETING_LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="text-ink-100 hover:text-ink-700">
            {l.label}
          </Link>
        ))}
      </nav>
      <p>© {new Date().getFullYear()} 全方位職能評測平台．All rights reserved.</p>
    </footer>
  );
}
