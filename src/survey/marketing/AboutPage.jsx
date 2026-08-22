import MarketingNav from './MarketingNav';
import MarketingFooter from './MarketingFooter';
import CtaBanner from './CtaBanner';

const BELIEFS = [
  {
    n: '01',
    title: '單次分數只是切片，趨勢才是真相',
    desc: '一次評測給你的是某個時間點的快照。真正有意義的是把每一次作答都留下來，看見分數怎麼隨時間變化——這才是「成長」真正發生的地方。',
  },
  {
    n: '02',
    title: '課前課後的落差，是訓練投資的證明',
    desc: '課程有沒有用，不該只憑感覺。系統自動比對課前與課後的成績，把「有沒有進步」「進步了多少」變成可以指給別人看的數字。',
  },
  {
    n: '03',
    title: '多元視角，比單一觀點更接近事實',
    desc: '自己怎麼看自己，跟主管、同儕、部屬怎麼看你，往往不一樣。360° 多元評測把這些觀點放在一起比對，落差本身就是最重要的發現。',
  },
  {
    n: '04',
    title: '數據要有人陪著解讀，才會變成行動',
    desc: '雷達圖跟百分位本身不會改變任何人。教練針對每一次作答留下的個人化評語與建議，才是把「知道」變成「做到」的關鍵一步。',
  },
];

const JOURNEY = [
  { title: '課前評測', desc: '在訓練開始前完成一次基準評測，作為日後比較的起點。' },
  { title: '即時分析', desc: '送出後立即取得構面分數、落點等級與雷達圖，不必等待。' },
  { title: '教練陪伴', desc: '教練針對你的表現撰寫個人化評語，指出具體的精進方向。' },
  { title: '課後複測', desc: '訓練結束後回測，系統自動計算與課前的成長幅度。' },
  { title: '歷程留存', desc: '所有作答持續累積，趨勢圖與構面進步對照隨時可回顧。' },
];

export default function AboutPage({ loggedIn = false, onEnter }) {
  return (
    <div className="min-h-screen bg-paper-100 font-sans text-ink-700">
      <MarketingNav loggedIn={loggedIn} onEnter={onEnter} />

      {/* Hero */}
      <section className="px-6 pt-20 pb-16">
        <div className="mx-auto max-w-3xl">
          <div className="font-display mb-3 text-[15px] italic tracking-wide text-brass-500">
            Our Philosophy — 為什麼記錄比測驗更重要
          </div>
          <h1 className="font-serif text-4xl font-bold leading-[1.2] tracking-tight text-ink-700 sm:text-5xl">
            評測只是一個時間點的快照，
            <br />
            真正重要的是<span className="font-display italic text-brass-500">持續累積</span>的歷程。
          </h1>
          <p className="mt-7 max-w-xl text-[17px] leading-relaxed text-ink-100">
            大多數評量工具做完一次就結束了——你拿到一份報告，然後呢？
            我們把「全方位職能評測」設計成一個能陪你走過整段學習歷程的追蹤系統：
            不只是 AI 評測、不只是領導力評測，而是把每一次作答、每一次教練回饋、
            每一次課前課後的比較，都留下來、串起來，變成你自己的成長軌跡。
          </p>
        </div>
      </section>

      {/* Beliefs */}
      <section className="border-t border-ink-700/10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14">
            <div className="font-display mb-3 text-[15px] italic text-brass-500">What We Believe — 我們相信</div>
            <h2 className="font-serif text-3xl font-bold tracking-tight text-ink-700">四個設計原則</h2>
          </div>
          <div className="grid gap-10 sm:grid-cols-2">
            {BELIEFS.map((b) => (
              <div key={b.n} className="border-t border-ink-700/10 pt-6">
                <div className="font-serif mb-2 text-sm text-brass-500">{b.n}</div>
                <h3 className="font-serif mb-2 text-xl font-bold text-ink-700">{b.title}</h3>
                <p className="text-sm leading-relaxed text-ink-100">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Journey timeline */}
      <section className="border-t border-ink-700/10 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14">
            <div className="font-display mb-3 text-[15px] italic text-brass-500">The Journey — 歷程如何被記錄</div>
            <h2 className="font-serif text-3xl font-bold tracking-tight text-ink-700">從第一次作答開始</h2>
          </div>
          <div className="relative">
            <div className="absolute left-[15px] top-2 bottom-2 hidden w-px bg-ink-700/15 sm:block" />
            <ol className="space-y-8">
              {JOURNEY.map((j, i) => (
                <li key={j.title} className="relative flex gap-5 sm:pl-0">
                  <div className="font-serif relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-700 text-xs font-semibold text-paper-50">
                    {i + 1}
                  </div>
                  <div className="pt-0.5">
                    <h3 className="font-serif text-lg font-bold text-ink-700">{j.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-100">{j.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <CtaBanner
        loggedIn={loggedIn}
        onEnter={onEnter}
        kicker="See It In Action"
        title="想看看歷程追蹤長什麼樣子？"
        desc="我們準備了範例報告，用示意資料呈現雷達圖、趨勢折線圖與班級熱力圖。"
        buttonLabel={loggedIn ? '前往我的評量' : '登入平台'}
      />

      <MarketingFooter />
    </div>
  );
}
