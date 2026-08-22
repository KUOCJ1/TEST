import MarketingNav from './MarketingNav';
import MarketingFooter from './MarketingFooter';
import CtaBanner from './CtaBanner';

const STUDENT_STEPS = [
  { step: '01', title: '選擇評量', desc: '從「我的評量」選擇開放中的題庫，AI 職能、領導力九大構面等依組織開放狀況顯示。' },
  { step: '02', title: '完成作答', desc: '以 5 點量表回答情境題，系統自動處理正向、反向計分，過程中進度自動存檔。' },
  { step: '03', title: '即時分析', desc: '送出後立即看到總分、達成率、落點等級與構面雷達圖，不必等待人工批改。' },
  { step: '04', title: '教練評語', desc: '教練會針對你的最新一次作答留下整體觀察與最多 5 條精進建議。' },
  { step: '05', title: '360° 回饋（選填）', desc: '支援的評量可邀請主管、同儕、部屬填答同一份評量，同儕與部屬回饋匿名呈現。' },
  { step: '06', title: '課後複測與追蹤', desc: '訓練結束後回測，系統自動比對課前課後成長，趨勢折線圖持續累積每一次紀錄。' },
];

const COACH_FEATURES = [
  { title: '報告＋評語合一', desc: '點開任一位學員即可同時看到完整報告與評語編輯區，寫完直接切下一位，不必來回切換畫面。' },
  { title: '構面 × 成員熱力圖', desc: '一眼看出整班哪個構面最弱、是被誰拉低的，備課方向不必逐一翻報告比對。' },
  { title: '班別與報到管理', desc: '建立班級、QR Code 報到、批量匯入名單、設定重點構面，一個工作區處理完。' },
  { title: '批次匯出報告', desc: '一次列印或存成 PDF 全班每位成員的個人報告，不必逐一開啟。' },
];

const ADMIN_FEATURES = [
  { title: '評量開關', desc: '控制每個題庫是否對學員開放，關閉不影響任何歷史資料。' },
  { title: '整體統計', desc: '依評量查看 KPI、構面雷達圖、落點分佈，填答者明細可搜尋、排序、匯出 CSV。' },
  { title: '用戶角色管理', desc: '設定用戶為教練或一般學員，並可產生密碼重設連結。' },
];

export default function HowItWorksPage({ loggedIn = false, onEnter }) {
  return (
    <div className="min-h-screen bg-paper-100 font-sans text-ink-700">
      <MarketingNav loggedIn={loggedIn} onEnter={onEnter} />

      {/* Hero */}
      <section className="px-6 pt-20 pb-16">
        <div className="mx-auto max-w-3xl">
          <div className="font-display mb-3 text-[15px] italic tracking-wide text-brass-500">
            How It Works — 完整旅程
          </div>
          <h1 className="font-serif text-4xl font-bold leading-[1.2] tracking-tight text-ink-700 sm:text-5xl">
            從第一次作答，
            <br />
            到看見自己的<span className="font-display italic text-brass-500">成長曲線</span>。
          </h1>
          <p className="mt-7 max-w-xl text-[17px] leading-relaxed text-ink-100">
            以下是學員從作答到累積成長歷程的完整六個步驟，
            以及教練、管理者在同一套系統裡分別扮演的角色。
          </p>
        </div>
      </section>

      {/* Student journey */}
      <section id="student-journey" className="border-t border-ink-700/10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14">
            <div className="font-display mb-3 text-[15px] italic text-brass-500">For Learners — 學員的學習旅程</div>
            <h2 className="font-serif text-3xl font-bold tracking-tight text-ink-700">六個步驟，走完一段歷程</h2>
          </div>
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {STUDENT_STEPS.map(({ step, title, desc }) => (
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

      {/* Coach features */}
      <section className="border-t border-ink-700/10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14">
            <div className="font-display mb-3 text-[15px] italic text-brass-500">For Coaches — 教練的陪伴角色</div>
            <h2 className="font-serif text-3xl font-bold tracking-tight text-ink-700">一個工作區，看完整班</h2>
          </div>
          <div className="grid gap-10 sm:grid-cols-2">
            {COACH_FEATURES.map(({ title, desc }, i) => (
              <div key={title} className="border-t border-ink-700/10 pt-6">
                <div className="font-serif mb-3 text-sm text-brass-500">{String(i + 1).padStart(2, '0')}</div>
                <h3 className="font-serif mb-2 text-lg font-bold text-ink-700">{title}</h3>
                <p className="text-sm leading-relaxed text-ink-100">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Admin features */}
      <section className="border-t border-ink-700/10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14">
            <div className="font-display mb-3 text-[15px] italic text-brass-500">For Admins — 管理者的全局視角</div>
            <h2 className="font-serif text-3xl font-bold tracking-tight text-ink-700">掌握全組織的能力分佈</h2>
          </div>
          <div className="grid gap-10 sm:grid-cols-3">
            {ADMIN_FEATURES.map(({ title, desc }, i) => (
              <div key={title}>
                <div className="font-serif mb-3 text-sm text-brass-500">{String(i + 1).padStart(2, '0')}</div>
                <h3 className="font-serif mb-2 text-lg font-bold text-ink-700">{title}</h3>
                <p className="text-sm leading-relaxed text-ink-100">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBanner loggedIn={loggedIn} onEnter={onEnter} />

      <MarketingFooter />
    </div>
  );
}
