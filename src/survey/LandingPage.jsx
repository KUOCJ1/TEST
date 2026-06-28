export default function LandingPage({ onEnter }) {
  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}favicon.svg`}
              alt=""
              className="h-8 w-8 drop-shadow-[0_2px_8px_rgba(124,58,237,.3)]"
            />
            <span className="text-lg font-extrabold tracking-tight text-slate-800">
              全方位職能評測
            </span>
          </div>
          <button onClick={onEnter} className="btn-primary px-5 py-2 text-sm">
            登入平台
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-white to-indigo-50 px-6 py-20 text-center">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(60rem 60rem at 110% -10%, rgba(124,58,237,.12), transparent 60%), radial-gradient(50rem 50rem at -10% 0%, rgba(79,70,229,.1), transparent 55%)',
          }}
        />
        <div className="relative mx-auto max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-semibold text-brand-700">
            L9D 經贏® 領導力九大構面行為評量
          </div>
          <h1 className="mb-5 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            打造卓越人才的
            <br />
            <span className="bg-gradient-to-r from-brand-600 to-indigo-600 bg-clip-text text-transparent">
              職能評測平台
            </span>
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-slate-500">
            科學化 360° 多元評測，精準掌握每位成員的能力現況與成長潛力，為人才發展提供數據支撐。
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button onClick={onEnter} className="btn-primary px-7 py-3 text-base shadow-lg shadow-brand-500/30">
              立即開始
            </button>
            <button
              onClick={scrollToFeatures}
              className="btn-secondary px-7 py-3 text-base"
            >
              深入了解 ↓
            </button>
          </div>
        </div>
      </section>

      {/* Features — 三角色卡片 */}
      <section id="features" className="bg-slate-50 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-800">
              三種角色，一站滿足
            </h2>
            <p className="mt-3 text-slate-500">
              平台為評測學員、教練與管理者各自提供量身打造的功能與介面。
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: (
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                ),
                title: '評測學員',
                desc: '完成線上評量，即時查看能力分析與成長趨勢，掌握個人職能強弱項。',
                features: ['5 點量表評量', '構面分析報告', '歷程成長追蹤'],
              },
              {
                icon: (
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                  </svg>
                ),
                title: '教練',
                desc: '撰寫個人化評語，追蹤 360° 多元評測進度，協助學員精準成長。',
                features: ['個人化評語撰寫', '班別學員管理', '360° 進度追蹤'],
              },
              {
                icon: (
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
                  </svg>
                ),
                title: '管理者',
                desc: '掌握全團隊能力分佈，靈活管理評量與用戶角色，驅動組織整體發展。',
                features: ['全團隊能力分析', '評量開關管理', '用戶角色設定'],
              },
            ].map(({ icon, title, desc, features }) => (
              <div key={title} className="card flex flex-col gap-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  {icon}
                </div>
                <div>
                  <h3 className="mb-2 text-lg font-bold text-slate-800">{title}</h3>
                  <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
                </div>
                <ul className="mt-auto space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <svg className="h-4 w-4 shrink-0 text-brand-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
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
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-800">三步驟，輕鬆完成評測</h2>
            <p className="mt-3 text-slate-500">從登入到取得完整分析報告，流程清晰直觀。</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                step: '01',
                title: '選擇評量',
                desc: '依據管理員開放的評量項目，從「我的評量」選取適合自己的測驗。',
              },
              {
                step: '02',
                title: '完成作答',
                desc: '以 5 點量表作答 90 道行為情境題，系統自動處理正向與反向題計分。',
              },
              {
                step: '03',
                title: '查看成果',
                desc: '立即取得構面分析、落點等級、雷達圖與教練個人化評語，了解成長方向。',
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="relative flex flex-col items-center text-center">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-600 text-lg font-extrabold text-white shadow-lg shadow-brand-500/30">
                  {step}
                </div>
                <h3 className="mb-2 text-lg font-bold text-slate-800">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-gradient-to-r from-brand-600 to-indigo-600 px-6 py-16 text-center text-white">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight">立即開始使用</h2>
          <p className="mb-8 text-base leading-relaxed opacity-85">
            加入已使用職能評測平台的組織，以科學數據驅動人才發展。
          </p>
          <button
            onClick={onEnter}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-bold text-brand-700 shadow-lg transition-all hover:bg-brand-50 hover:shadow-xl active:scale-[.99]"
          >
            登入平台
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white px-6 py-8 text-center text-sm text-slate-400">
        <p>© {new Date().getFullYear()} 全方位職能評測平台．All rights reserved.</p>
      </footer>
    </div>
  );
}
