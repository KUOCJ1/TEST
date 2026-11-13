import { useEffect, useState } from 'react';

const QUERY = '(max-width: 639px)';

/**
 * 手機（Tailwind sm 以下）。給「手機和桌機要用不同元件」的地方用（例如成員表在手機上改卡片）：
 * 只渲染其中一種，不會在 DOM 裡同時放兩份（兩份會讓 getByText 之類的查詢撞名）。
 * 沒有 matchMedia（單元測試的 jsdom）時一律當桌機。
 */
export function useIsMobile() {
  const get = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;
  const [mobile, setMobile] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(QUERY);
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return mobile;
}
