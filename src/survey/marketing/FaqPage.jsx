import MarketingNav from './MarketingNav';
import MarketingFooter from './MarketingFooter';
import CtaBanner from './CtaBanner';

const GROUPS = [
  {
    title: '平台在做什麼',
    items: [
      {
        q: '這跟做一次性問卷有什麼不同？',
        a: '一次性問卷只給你一個時間點的快照。我們的平台會保留每一次作答紀錄，自動比對課前／課後成績、產生趨勢折線圖與構面進步對照，讓你看到「訓練有沒有用」，而不只是「這次考幾分」。',
      },
      {
        q: '支援哪些評測工具／題庫？',
        a: '目前內建「AI 全方位職能實戰評測」與「經贏® 領導力九大構面行為評量（L9D）」，皆由管理者決定何時對學員開放。',
      },
      {
        q: '適合哪些場景使用？',
        a: '企業內訓成效追蹤、領導力發展課程的課前課後對比、AI 職能培訓成果驗收，都是目前平台被使用的典型場景。',
      },
    ],
  },
  {
    title: '資料安全與隱私',
    items: [
      {
        q: '我的評測結果誰看得到？',
        a: '只有你本人、你所在班別的教練，以及管理者可以看到你的成績。同儕評與部屬評的 360° 回饋在你端一律匿名呈現，不會顯示是誰填的。',
      },
      {
        q: '關閉或移出班級後，我的歷史資料會不見嗎？',
        a: '不會。評量被停用或你被移出班級，都只是調整顯示範圍，不會刪除任何已送出的作答紀錄與報告。',
      },
    ],
  },
  {
    title: '教練與 360° 回饋',
    items: [
      {
        q: '教練評語是 AI 自動產生的嗎？',
        a: '不是。評語由真人教練針對你的實際表現撰寫；平台另外提供 AI 小幫手協助你自己解讀分數，但精進建議來自教練本人。',
      },
      {
        q: '什麼是 360° 評測？',
        a: '除了自評，也可以邀請主管、同儕、部屬填寫同一份評量，從多個角度呈現你的行為表現。選好對象與關係即可直接開始作答。',
      },
    ],
  },
  {
    title: '如何開始使用',
    items: [
      {
        q: '我可以自己單獨使用，不透過班別／課程嗎？',
        a: '可以。你能隨時重新作答、累積自己的歷史紀錄與趨勢；加入班別後則能額外獲得教練評語，以及課前課後的自動判定與比對。',
      },
      {
        q: '如何取得帳號？',
        a: '請洽詢你的課程教練或平台管理者。多數情況下由主辦單位（企業或教練）開通帳號，教練也可以提供報到 QR Code 讓你現場掃碼加入班級並直接開始作答。',
      },
    ],
  },
];

export default function FaqPage({ loggedIn = false, onEnter }) {
  return (
    <div className="min-h-screen bg-paper-100 font-sans text-ink-700">
      <MarketingNav loggedIn={loggedIn} onEnter={onEnter} />

      {/* Hero */}
      <section className="px-6 pt-20 pb-10">
        <div className="mx-auto max-w-3xl">
          <div className="font-display mb-3 text-[15px] italic tracking-wide text-brass-500">
            FAQ — 常見問題
          </div>
          <h1 className="font-serif text-4xl font-bold leading-[1.2] tracking-tight text-ink-700 sm:text-5xl">
            在開始之前，
            <br />
            你可能想知道的<span className="font-display italic text-brass-500">幾件事</span>。
          </h1>
        </div>
      </section>

      {/* FAQ groups */}
      <section className="border-t border-ink-700/10 px-6 py-16">
        <div className="mx-auto max-w-3xl space-y-16">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <h2 className="font-serif mb-6 text-2xl font-bold tracking-tight text-ink-700">{group.title}</h2>
              <div className="space-y-6">
                {group.items.map((item) => (
                  <div key={item.q} className="border-t border-ink-700/10 pt-5">
                    <p className="font-serif mb-2 text-base font-bold text-ink-700">Q．{item.q}</p>
                    <p className="text-sm leading-relaxed text-ink-100">{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <CtaBanner loggedIn={loggedIn} onEnter={onEnter} />

      <MarketingFooter />
    </div>
  );
}
