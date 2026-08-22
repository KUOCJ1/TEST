import { Link, NavLink } from 'react-router-dom';
import { MARKETING_LINKS } from './links';

/**
 * 行銷頁共用導覽列：登入前後都會用到（登入後的 CTA 改為「前往我的評量」），
 * 讓 /about、/how-it-works、/showcase、/faq 之間可以互相跳轉。
 */
export default function MarketingNav({ loggedIn = false, onEnter }) {
  return (
    <nav className="sticky top-0 z-30 border-b border-ink-700/10 bg-paper-100/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
        <Link to="/" className="flex shrink-0 items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-7 w-7" />
          <span className="font-serif text-lg font-semibold tracking-tight text-ink-700">
            全方位職能評測
          </span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {MARKETING_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `text-sm font-medium transition-colors ${
                  isActive ? 'text-ink-700' : 'text-ink-100 hover:text-ink-700'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        {loggedIn ? (
          <Link to="/home" className="btn-primary shrink-0 px-5 py-2 text-sm">
            前往我的評量
          </Link>
        ) : (
          <button type="button" onClick={onEnter} className="btn-primary shrink-0 px-5 py-2 text-sm">
            登入平台
          </button>
        )}
      </div>
    </nav>
  );
}
