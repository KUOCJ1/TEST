export default function LandingPage({ onEnter }) {
  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  const roles = [
    {
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
        </svg>
      ),
      title: '評測學員',
      desc: '完成線上評量，即時查看能力分析與成長趨勢，掌握個人職能強弱項。',
      features: ['5 點量表評量', '構面分析報告', '歷程成長追蹤'],
    },
    {
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
        </svg>
      ),
      title: '教練',
      desc: '撰寫個人化評語，追蹤 360° 多元評測進度，協助學員精準成長。',
      features: ['個人化評語撰寫', '班別學員管理', '360° 進度追蹤'],
    },
    {
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
        </svg>
      ),
      title: '管理者',
      desc: '掌握全團隊能力分佈，靈活管理評量與用戶角色，驅動組織整體發展。',
      features: ['全團隊能力分析', '評量開關管理', '用戶角色設定'],
    },
  ];

  const stats = [
    ['構面 Dimensions', '9'],
    ['子能力 Sub-competencies', '20'],
    ['題項 Items（含反向題）', '90'],
    ['落點級距 Bands', '4'],
  ];

  const steps = [
    { step: '01', title: '選擇評量', desc: '依據管理員開放的評量項目，從「我的評量」選取適合自己的測驗。' },
    { step: '02', title: '完成作答', desc: '以 5 點量表作答 90 道行為情境題，系統自動處理正向與反向題計分。' },
    { step: '03', title: '查看成果', desc: '立即取得構面分析、落點等級、雷達圖與教練個人化評語，了解成長方向。' },
  ];

  return (
    <div className="min-h-screen bg-paper-100 font-sans text-ink-700">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 border-b border-ink-700/10 bg-paper-100/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-7 w-7" />
            <span className="font-serif text-lg font-semibold tracking-tight text-ink-700">
              全方位職能評測
            </span>
          </div>
          <button onClick={onEnter} className="btn-primary px-5 py-2 text-sm">
            登入平台
          </button>
        </div>
      </nav>

      {/* Hero — 報告式排版：左文右數據欄 */}
      <section className="px-6 pt-20 pb-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-16 lg:flex-row lg:items-start">
          <div className="flex flex-1 flex-col gap-7 lg:max-w-xl">
            <div className="font-display text-[15px] italic tracking-wide text-brass-500">
              Report No. 001 — L9D 經贏® 領導力九大構面行為評量
            </div>
            <h1 className="font-serif text-4xl font-bold leading-[1.2] tracking-tight text-ink-700 sm:text-5xl">
              把「潛力」變成
              <br />
              <span className="font-display italic text-brass-500">可驗證</span>的數字
            </h1>
            <p className="max-w-md text-[17px] leading-relaxed text-ink-100">
              科學化 360° 多元評測，將領導行為拆解為九大構面、二十項子能力，
              為每一次人才發展決策提供可追溯的數據依據。
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-8">
              <button onClick={onEnter} className="btn-primary px-7 py-3 text-base">
                立即開始
              </button>
              <button
                onClick={scrollToFeatures}
                className="border-b border-ink-700/40 pb-0.5 text-[15px] font-medium text-ink-700 transition-colors hover:border-ink-700"
              >
                深入了解 ↓
              </button>
            </div>
          </div>

          {/* 右側：報告附錄式數據欄 */}
          <div className="flex-1 pt-1 lg:max-w-sm">
            <div className="border-t border-ink-700/50" />
            <dl>
              {stats.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between border-b border-ink-700/10 py-5">
                  <dt className="text-sm text-ink-100">{label}</dt>
                  <dd className="font-serif text-3xl font-semibold text-ink-700">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Roles — 目錄式三欄，取代圖示卡片 */}
      <section id="features" className="border-t border-ink-700/10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14">
            <div className="font-display mb-3 text-[15px] italic text-brass-500">Table of Contents — 平台角色</div>
            <h2 className="font-serif text-3xl font-bold tracking-tight text-ink-700">三種角色，一站滿足</h2>
          </div>
          <div className="grid gap-10 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-ink-700/10">
            {roles.map(({ icon, title, desc, features }, i) => (
              <div key={title} className="sm:px-10 sm:first:pl-0 sm:last:pr-0">
                <div className="font-serif mb-3 text-sm text-brass-500">{String(i + 1).padStart(2, '0')}</div>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-sm bg-paper-200 text-ink-700">
                  {icon}
                </div>
                <h3 className="font-serif mb-2 text-xl font-bold text-ink-700">{title}</h3>
                <p className="mb-4 text-sm leading-relaxed text-ink-100">{desc}</p>
                <ul className="space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-ink-400">
                      <span className="text-brass-500">—</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-ink-700/10 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-14">
            <div className="font-display mb-3 text-[15px] italic text-brass-500">How It Works — 三步驟</div>
            <h2 className="font-serif text-3xl font-bold tracking-tight text-ink-700">輕鬆完成評測</h2>
          </div>
          <div className="grid gap-10 sm:grid-cols-3">
            {steps.map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col gap-3">
                <div className="font-serif flex h-12 w-12 items-center justify-center rounded-sm bg-ink-700 text-base font-semibold text-paper-50">
                  {step}
                </div>
                <h3 className="font-serif text-lg font-bold text-ink-700">{title}</h3>
                <p className="text-sm leading-relaxed text-ink-100">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-ink-700 px-6 py-20 text-center text-paper-50">
        <div className="mx-auto max-w-2xl">
          <div className="font-display mb-4 text-[15px] italic text-brass-100">Get Started</div>
          <h2 className="font-serif mb-5 text-3xl font-bold tracking-tight">立即開始使用</h2>
          <p className="mb-9 text-base leading-relaxed text-paper-50/75">
            加入已使用職能評測平台的組織，以科學數據驅動人才發展。
          </p>
          <button
            onClick={onEnter}
            className="inline-flex items-center justify-center gap-2 rounded-sm bg-paper-50 px-8 py-3.5 text-base font-semibold text-ink-700 transition-colors hover:bg-brass-100"
          >
            登入平台
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink-700/10 bg-paper-100 px-6 py-8 text-center text-sm text-ink-50">
        <p>© {new Date().getFullYear()} 全方位職能評測平台．All rights reserved.</p>
      </footer>
    </div>
  );
}
