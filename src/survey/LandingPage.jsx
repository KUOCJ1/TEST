import { Link } from 'react-router-dom';
import MarketingNav from './marketing/MarketingNav';
import MarketingFooter from './marketing/MarketingFooter';
import CtaBanner from './marketing/CtaBanner';
import { ASSESSMENT_SUMMARIES } from './marketing/assessmentSummary';

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
      title: '學員',
      desc: '完成評測、即時查看能力分析，並在同一個地方累積歷程、訂下發展目標。',
      features: ['構面分析報告', '歷程與成長追蹤', '個人發展目標'],
    },
    {
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
        </svg>
      ),
      title: '教練',
      desc: '在一個班級工作區看報告、寫評語、掌握全班強弱項，陪學員走完整段發展。',
      features: ['報告與評語合一', '構面 × 成員熱力圖', '班級與報到管理'],
    },
    {
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
        </svg>
      ),
      title: '管理者',
      desc: '掌握全組織的能力分佈，管理開放中的評量工具與用戶角色。',
      features: ['全組織能力分析', '評量工具開關', '用戶角色設定'],
    },
  ];

  // 平台級指標：刻意不放任何單一題庫的規格（構面數、題數那些），
  // 那些屬於各自的評測工具，列在下方的「評測工具庫」。
  const stats = [
    ['評測工具 Assessments', String(ASSESSMENT_SUMMARIES.length)],
    ['評測角色 Rater Types', '4'],
    ['平台角色 Roles', '3'],
    ['歷程追蹤 Retakes', '不限次'],
  ];

  const development = [
    {
      n: '01',
      title: '歷程留存',
      desc: '每一次作答都被記錄下來，趨勢圖與構面進步對照隨時可回顧，課前課後的成長幅度自動算好。',
    },
    {
      n: '02',
      title: '教練回饋',
      desc: '教練針對每次作答撰寫整體觀察與精進建議，讓分數變成看得懂、做得到的方向。',
    },
    {
      n: '03',
      title: '目標與行動',
      desc: '針對弱項訂下發展目標與具體行動，下次回來打勾——把「知道」變成「做到」。',
    },
  ];

  const steps = [
    { step: '01', title: '選擇評量', desc: '從管理者開放的評測工具中，選取這次要進行的評量。' },
    { step: '02', title: '完成作答', desc: '以 5 點量表作答行為情境題，系統自動處理正向與反向題計分，進度隨時自動存檔。' },
    { step: '03', title: '查看成果', desc: '立即取得構面分析、落點等級與雷達圖，並在同一頁看到歷程與教練評語。' },
    { step: '04', title: '持續發展', desc: '訂下目標、追蹤行動，日後回測比對成長幅度，形成完整的發展循環。' },
  ];

  return (
    <div className="min-h-screen bg-paper-100 font-sans text-ink-700">
      <MarketingNav loggedIn={false} onEnter={onEnter} />

      {/* Hero — 報告式排版：左文右數據欄 */}
      <section className="px-6 pt-20 pb-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-16 lg:flex-row lg:items-start">
          <div className="flex flex-1 flex-col gap-7 lg:max-w-xl">
            <div className="font-display text-[15px] italic tracking-wide text-brass-500">
              全方位職能評測與發展學習平臺
            </div>
            <h1 className="font-serif text-4xl font-bold leading-[1.2] tracking-tight text-ink-700 sm:text-5xl">
              先看清楚現在，
              <br />
              再<span className="font-display italic text-brass-500">走出</span>成長的軌跡。
            </h1>
            <p className="max-w-md text-[17px] leading-relaxed text-ink-100">
              科學化的職能與領導力評測，加上歷程追蹤、教練回饋與發展目標——
              不只給你一份報告，而是陪你把每一次的改變累積成看得見的軌跡。
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

      {/* 評測工具庫 */}
      <section id="features" className="border-t border-ink-700/10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14">
            <div className="font-display mb-3 text-[15px] italic text-brass-500">Assessment Library — 評測工具庫</div>
            <h2 className="font-serif text-3xl font-bold tracking-tight text-ink-700">依需求選用不同的評測工具</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-100">
              平台採設定驅動的題庫架構，每套工具有各自的構面、題數與計分規則，
              但共用同一套分析、歷程追蹤與教練回饋機制。
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {ASSESSMENT_SUMMARIES.map((a) => (
              <div key={a.id} className="flex flex-col border-t border-ink-700/20 pt-6">
                <h3 className="font-serif mb-1 text-xl font-bold text-ink-700">{a.name}</h3>
                <p className="mb-5 text-sm leading-relaxed text-ink-100">{a.tagline}</p>
                <dl className="mb-5 flex gap-8">
                  <div>
                    <dt className="text-xs text-ink-50">構面</dt>
                    <dd className="font-serif text-2xl font-semibold text-ink-700">{a.dimensions}</dd>
                  </div>
                  {a.subCompetencies > 0 && (
                    <div>
                      <dt className="text-xs text-ink-50">子能力</dt>
                      <dd className="font-serif text-2xl font-semibold text-ink-700">{a.subCompetencies}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs text-ink-50">題項</dt>
                    <dd className="font-serif text-2xl font-semibold text-ink-700">{a.items}</dd>
                  </div>
                </dl>
                <ul className="mt-auto space-y-2">
                  {a.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-ink-400">
                      <span className="mt-0.5 text-brass-500">—</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-10 text-sm text-ink-50">
            題庫可依組織需求擴充，新增的工具會自動沿用既有的分析與追蹤功能。
          </p>
        </div>
      </section>

      {/* 從評測到發展 */}
      <section className="border-t border-ink-700/10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14">
            <div className="font-display mb-3 text-[15px] italic text-brass-500">Beyond the Score — 從評測到發展</div>
            <h2 className="font-serif text-3xl font-bold tracking-tight text-ink-700">評測結束，才是開始</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-100">
              一次性的分數只是某個時間點的切片。平台把作答、回饋與行動串成一段可以持續累積的歷程。
            </p>
          </div>
          <div className="grid gap-10 sm:grid-cols-3">
            {development.map(({ n, title, desc }) => (
              <div key={n} className="border-t border-ink-700/10 pt-6">
                <div className="font-serif mb-2 text-sm text-brass-500">{n}</div>
                <h3 className="font-serif mb-2 text-xl font-bold text-ink-700">{title}</h3>
                <p className="text-sm leading-relaxed text-ink-100">{desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <Link
              to="/showcase"
              className="border-b border-ink-700/40 pb-0.5 text-[15px] font-medium text-ink-700 transition-colors hover:border-ink-700"
            >
              看看報告與歷程長什麼樣子 →
            </Link>
          </div>
        </div>
      </section>

      {/* Roles — 目錄式三欄 */}
      <section className="border-t border-ink-700/10 px-6 py-24">
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
          <p className="mt-10 text-sm text-ink-50">
            360° 多元評測（自評／主管／同儕／部屬）由支援該功能的評測工具提供。
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-ink-700/10 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14">
            <div className="font-display mb-3 text-[15px] italic text-brass-500">How It Works — 四步驟</div>
            <h2 className="font-serif text-3xl font-bold tracking-tight text-ink-700">一個完整的發展循環</h2>
          </div>
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
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

      <CtaBanner loggedIn={false} onEnter={onEnter} />

      <MarketingFooter />
    </div>
  );
}
