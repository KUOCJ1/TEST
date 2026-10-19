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
        a: '目前內建六份評測：「AI 全方位職能實戰評測」、「經贏® 領導力九大構面行為評量（L9D）」、「DISC 行為風格評測」、「識己® 性格原型評測」，以及即將推出的「領導力羅盤八向評測」與「接班準備度評測」。每一份都由管理者決定何時對學員開放，也都有說明頁可以先了解。',
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
        a: '只有你本人、你所在班別的教練，以及管理者可以看到你的成績。同儕評與部屬評的 360° 回饋在你端一律匿名呈現，不會顯示是誰填的；但教練與管理者看得到評分者是誰（領導力羅盤除外：教練看不到評分者身分與個別分數，管理者要查看必須填寫理由並留下稽核紀錄）。',
      },
      {
        q: 'AI 小幫手會把我的資料傳給誰？',
        a: '使用 AI 小幫手時，你輸入的文字與當次評測結果摘要（評量名稱、總分、等級、各構面分數）會送往第三方 AI 服務（OpenRouter 及其模型供應商）處理，不含你的姓名與 Email。對話紀錄只存在你自己的瀏覽器。請避免在對話中輸入不必要的個人或敏感資料。',
      },
      {
        q: '關閉或移出班級後，我的歷史資料會不見嗎？',
        a: '不會。評量被停用或你被移出班級，都只是調整顯示範圍，不會刪除任何已送出的作答紀錄與報告。',
      },
      {
        q: '我想查詢、更正或刪除我的資料怎麼辦？',
        a: '姓名可以在登入後的「個人設定」自行修改。查詢、取得複本、更正其他資料或要求刪除，請依頁尾《隱私權政策》第七條的方式聯絡我們；目前尚未提供自助刪除功能。完整說明請見頁尾的《隱私權政策》與《服務條款》。',
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
        a: '最常見的是收到教練寄來的「邀請連結」：點開後 Email 與姓名已經帶好，設定密碼、同意隱私權政策與服務條款，就會自動加入班級並開始作答。連結每人一組，14 天有效、只能使用一次。現場課程也可以掃教練提供的報到 QR Code 加入。',
      },
      {
        q: '邀請連結打不開或顯示過期怎麼辦？',
        a: '邀請連結只能使用一次，且有 14 天的期限。如果顯示已過期、已使用或已撤銷，請向你的教練索取新的邀請連結；如果你已經註冊過，直接登入即可。你也可以先登入，再於首頁輸入教練給的邀請碼加入班級（邀請是寄給某個 Email 的，要用同一個 Email 的帳號）。',
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
