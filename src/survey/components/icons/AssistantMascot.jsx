/**
 * AI 小幫手的吉祥物：戴著學士帽的小貓頭鷹（貓頭鷹＝智慧，學士帽＝教練／評測小幫手／
 * 平台助理的「引導」定位），比 lucide 的通用對話泡泡圖示更有記憶點，同時延續全站
 * 暖紙感（paper）＋墨色（ink）＋黃銅（brass）的顧問報告視覺系統，而非另外拉一套
 * 卡通色調進來。純手刻 SVG（跟站上其他圖表／圖示同一套做法），不依賴外部圖庫或
 * 點陣圖，任何尺寸都維持銳利、可直接用 currentColor 以外的固定品牌色。
 */
export default function AssistantMascot({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-hidden="true">
      {/* 耳羽 */}
      <path d="M11.5 13.5 Q9 7 15.5 10.2 Q14.5 13.5 12.3 14.3 Z" fill="#efe6d4" />
      <path d="M28.5 13.5 Q31 7 24.5 10.2 Q25.5 13.5 27.7 14.3 Z" fill="#efe6d4" />

      {/* 頭／身體 */}
      <circle cx="20" cy="23.5" r="10.5" fill="#efe6d4" />

      {/* 學士帽 */}
      <path d="M20 5.5 L30 9.8 L20 14 L10 9.8 Z" fill="#a9752e" />
      <circle cx="20" cy="9.8" r="1.1" fill="#584419" />
      <path
        d="M25.5 11.6 Q26.5 15.5 24.3 17.8"
        stroke="#c7a355"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="24.1" cy="18.3" r="1.15" fill="#c7a355" />

      {/* 眼睛 */}
      <circle cx="14.8" cy="22.6" r="4.3" fill="#fefdfb" />
      <circle cx="25.2" cy="22.6" r="4.3" fill="#fefdfb" />
      <circle cx="15.4" cy="23.1" r="2" fill="#17130e" />
      <circle cx="25.8" cy="23.1" r="2" fill="#17130e" />
      <circle cx="14.8" cy="22.4" r="0.6" fill="#fefdfb" />
      <circle cx="25.2" cy="22.4" r="0.6" fill="#fefdfb" />

      {/* 嘴喙 */}
      <path d="M20 26 L17.9 29.2 L22.1 29.2 Z" fill="#a9752e" />
    </svg>
  );
}
