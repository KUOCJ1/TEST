import { Link } from 'react-router-dom';

/**
 * 各行銷頁底部共用的深色 CTA 區塊，登入後導向「我的評量」，否則觸發登入流程。
 */
export default function CtaBanner({
  loggedIn = false,
  onEnter,
  kicker = 'Get Started',
  title = '立即開始使用',
  desc = '加入已使用職能評測平台的組織，以科學數據驅動人才發展。',
  buttonLabel,
}) {
  return (
    <section className="bg-ink-700 px-6 py-20 text-center text-paper-50">
      <div className="mx-auto max-w-2xl">
        <div className="font-display mb-4 text-[15px] italic text-brass-100">{kicker}</div>
        <h2 className="font-serif mb-5 text-3xl font-bold tracking-tight">{title}</h2>
        <p className="mb-9 text-base leading-relaxed text-paper-50/75">{desc}</p>
        {loggedIn ? (
          <Link
            to="/home"
            className="inline-flex items-center justify-center gap-2 rounded-sm bg-paper-50 px-8 py-3.5 text-base font-semibold text-ink-700 transition-colors hover:bg-brass-100"
          >
            {buttonLabel ?? '前往我的評量'}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onEnter}
            className="inline-flex items-center justify-center gap-2 rounded-sm bg-paper-50 px-8 py-3.5 text-base font-semibold text-ink-700 transition-colors hover:bg-brass-100"
          >
            {buttonLabel ?? '登入平台'}
          </button>
        )}
      </div>
    </section>
  );
}
