import { useEffect, useRef } from 'react';

const CONTENT = {
  user: {
    role: '一般用戶',
    summary: '你可以完成評量題目、查看個人分析報告、追蹤成長趨勢，並閱讀教練給你的評語與建議。',
    sections: [
      {
        title: '功能地圖',
        items: [
          { label: '我的評量', desc: '選擇題庫開始作答，可多次重測。' },
          { label: '我的分析', desc: '查看最新得分、構面落點、歷次趨勢與教練評語。' },
          { label: '360° 評測', desc: '評測您的主管、同儕或部屬，並查看整合多方回饋的分析報告（限領導力評量）。' },
          { label: '個人設定', desc: '修改姓名、設定預設評量、更改密碼。' },
        ],
      },
      {
        title: '名詞解釋',
        items: [
          { label: '構面', desc: '評量將能力分成多個面向（如「溝通協作」、「決策判斷」），每個構面由數道題目組成。' },
          { label: '落點等級', desc: '依總分劃分為探索期 / 發展期 / 精熟期 / 卓越四個等級，反映整體能力成熟度。' },
          { label: '百分位', desc: '你的分數在所有填答者中的相對位置。70% 表示超越了 70% 的填答者。' },
          { label: '課前 / 課後', desc: '系統以第一次作答為「課前」基準，最新一次為「課後」，兩者相減即為學習成長幅度。' },
          { label: '360° 評測', desc: '除自評外，由主管、同儕、部屬分別填寫，提供多角度回饋。同儕與部屬評分對被評者匿名呈現。' },
          { label: '掃碼加入班級', desc: '用手機掃描教練提供的報到 QR Code（或點連結）後，註冊或登入帳號即可自動加入該班級並直接開始作答。' },
        ],
      },
      {
        title: '常見問題',
        items: [
          { label: '可以重新作答嗎？', desc: '可以。點「重新作答」即可再次填寫，每次結果都會保留在歷史紀錄。' },
          { label: '評語是誰寫的？', desc: '教練（coach 角色）針對你的作答結果撰寫個人評語與精進建議。' },
          { label: '分數多久更新一次？', desc: '送出後立即計算，分析頁面即時反映最新結果。' },
          { label: '報到連結顯示已失效怎麼辦？', desc: '教練可能已重新產生或撤銷了該連結，請直接向講師確認最新的 QR Code；您仍可用原有帳號密碼正常登入。' },
        ],
      },
    ],
  },
  coach: {
    role: '教練',
    summary: '你可以為學員撰寫評語與精進建議、管理班別成員與設定、追蹤 360° 多元評測進度。',
    sections: [
      {
        title: '功能地圖',
        items: [
          { label: '個人評語', desc: '依評量篩選，為每位學員的最新作答撰寫整體評語與精進建議（最多 5 條）。支援多位教練各自評論。' },
          { label: '班別管理', desc: '建立班級、加入成員（即時或批量）、設定重點構面與訓練備注、下載名冊 CSV、查看班級整體雷達圖。' },
          { label: '報到 QR Code', desc: '在班別管理內產生報到 QR Code／連結，現場給學員掃碼即可自動加入該班；也支援全螢幕投影、複製連結、重新產生與撤銷。' },
          { label: '360° 進度', desc: '以表格顯示每位學員在各評測角色（自評／主管／同儕／部屬）的完成狀態，並可展開查看 360° 分析。' },
        ],
      },
      {
        title: '名詞解釋',
        items: [
          { label: '待加入成員', desc: 'Email 已被登錄於班別，但該用戶尚未完成帳號註冊。待其註冊後自動加入班級，無需手動操作。' },
          { label: '個人評語 vs 班級評語', desc: '個人評語針對單一學員，儲存在其作答紀錄上；班級評語是針對整個班別的整體觀察，學員進入分析頁時都能看到。' },
          { label: '重點構面', desc: '教練可標記本班訓練重點的構面，並填寫各構面的訓練重點備注，供學員在分析頁參考。' },
          { label: '報到代碼', desc: '每個班別同時只有一組有效代碼；按「重新產生」會讓舊的 QR Code／連結立即失效，「撤銷」則暫時停用，之後仍可重新產生新代碼。首次產生代碼時，若班別尚未設定開始日期，系統會自動開啟作答期間，避免學員掃碼後看到「尚未開放作答」。' },
        ],
      },
      {
        title: '常見問題',
        items: [
          { label: '可以查看學員的答題內容嗎？', desc: '目前只能看到最終計分結果，無法查看每道題的作答選項。' },
          { label: '如何新增班別成員？', desc: '在班別管理的成員區塊勾選已註冊用戶，或在批量輸入區填入姓名、Email，尚未註冊者列為「待加入」；也可以直接請學員掃報到 QR Code 自行加入。' },
          { label: '360° 評測角色如何分配？', desc: '由學員自行於「360° 評測」分頁選擇要評測的對象與角色關係，教練目前無法代為指派。' },
          { label: '學員一次上多個梯次會混在一起嗎？', desc: '不會。每筆作答都會綁定當時所屬的班別，即使日後調整成員名單或該學員又報名新的梯次，各梯次的成績與報告仍會分開留存。' },
        ],
      },
    ],
  },
  admin: {
    role: '管理員',
    summary: '你可以管理評量的啟用狀態、查看整體統計、調整用戶角色，以及產生密碼重設連結。',
    sections: [
      {
        title: '功能地圖',
        items: [
          { label: '評量開關', desc: '管理後台頂端可啟用或停用各評量，停用後一般用戶的首頁將不再顯示該評量。' },
          { label: '整體統計', desc: '依選取的評量顯示 KPI 指標、構面達成率雷達圖、落點等級分佈，以及填答者明細表（可匯出 CSV）。' },
          { label: '用戶角色管理', desc: '變更用戶為「教練」或還原「一般用戶」，並可產生密碼重設連結交由用戶自行重設。' },
        ],
      },
      {
        title: '名詞解釋',
        items: [
          { label: 'KPI 計算基準', desc: '所有 KPI 均以「每位用戶最新一筆作答」為母體，重複作答者只計算最新一次，避免數據失真。' },
          { label: '密碼重設連結', desc: '點擊「產生重設連結」後，複製連結傳送給用戶。連結有時效限制，過期後需重新產生。' },
        ],
      },
      {
        title: '常見問題',
        items: [
          { label: '如何新增管理員？', desc: '目前管理員帳號由伺服器環境變數設定（ADMIN_EMAIL），無法在後台直接新增。' },
          { label: '停用評量後學員的歷史資料會消失嗎？', desc: '不會。停用只是從首頁隱藏，歷史作答與分析資料完整保留。' },
          { label: '如何查看某位用戶的詳細作答？', desc: '目前管理後台僅顯示最新作答的彙整資訊，無法查看每道題的回答。' },
        ],
      },
    ],
  },
};

export default function HelpModal({ role = 'user', onClose }) {
  const overlayRef = useRef(null);
  const content = CONTENT[role] ?? CONTENT.user;

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 px-4 py-8 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
        className="w-full max-w-xl rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="help-modal-title" className="text-base font-extrabold text-slate-800">
              使用說明
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">目前角色：{content.role}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉說明"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          <p className="text-sm text-slate-600">{content.summary}</p>

          {content.sections.map((sec) => (
            <section key={sec.title}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                {sec.title}
              </h3>
              <dl className="space-y-2">
                {sec.items.map((item) => (
                  <div key={item.label} className="rounded-lg bg-slate-50 px-3 py-2">
                    <dt className="text-xs font-semibold text-slate-700">{item.label}</dt>
                    <dd className="mt-0.5 text-xs text-slate-500">{item.desc}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <div className="border-t border-slate-100 px-6 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
