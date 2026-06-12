// 總分落點等級定義。
// 31 題 × (1~5 分) => 總分介於 31 ~ 155 之間，切分為四個等級。

export const LEVELS = [
  {
    id: 'novice',
    min: 31,
    max: 62,
    badge: '🌱 AI 新手村',
    badgeEn: 'AI Novice',
    color: '#38a169',
    desc: '您對 AI 工具已有初步聽聞，但日常工作中較少主動使用。目前停留在「把 AI 當作更進階的 Google 搜尋」階段，有時會覺得 AI 回答不切實際或不知道該如何跟它對話。',
    advice:
      '萬丈高樓平地起！建議從大語言模型的操作介面與基礎提示詞架構（如設定角色、背景）開始學起，先培養每天讓 AI 幫忙寫 Email 或摘要長文的小習慣。',
  },
  {
    id: 'practitioner',
    min: 63,
    max: 93,
    badge: '📈 AI 應用實踐者',
    badgeEn: 'AI Practitioner',
    color: '#3182ce',
    desc: '您已經將 AI 融入部分日常工作，並掌握了基本的提示詞技巧，能透過對話讓 AI 產出可用的文字或圖片。但在處理複雜任務、跨工具串聯或打造自動化工作流上，仍覺得有些力不從心。',
    advice:
      '突破瓶頸的關鍵期！本課程將帶您掌握進階提示詞工程（思維鏈、自訂指令），並引導您學會如何利用多模態功能與知識管理工具，將 AI 真正內化為你的第二大腦。',
  },
  {
    id: 'advanced',
    min: 94,
    max: 124,
    badge: '🚀 AI 數位高潛力股',
    badgeEn: 'AI Advanced User',
    color: '#805ad5',
    desc: '您是團隊中的 AI 領先者！不僅對各大工具有高熟練度，還懂得利用 AI 解決複雜問題，甚至嘗試過建立專屬的 GPTs。您具備良好的資訊安全觀念，能引導 AI 產出高品質的專案物件。',
    advice:
      '邁向卓越的最後一哩路！課程將聚焦於「AI 工作流自動化串接」與「複雜場景下的企業級 Agent 應用開發」，協助您從個人高效升級為「團隊賦能者」。',
  },
  {
    id: 'catalyst',
    min: 125,
    max: 155,
    badge: '👑 AI 領航核心領袖',
    badgeEn: 'AI Catalyst',
    color: '#d69e2e',
    desc: '太優秀了！您具備極其全面的 AI 實戰能力與敏銳的創新思維。您不僅能開發出好用的客製化 AI 應用，更能兼顧倫理與資安管理，甚至已經在實質影響、帶動周遭的團隊進行數位轉型。',
    advice:
      '與大師同行！這門課程將成為您檢視自身技術盲點、優化架構的絕佳場域。期待您在課堂上與講師深入切磋，探討更前沿的 AI 落地策略與組織轉型佈局。',
  },
];

// 單一構面的成熟度評語（依平均分 1~5 給出簡短描述）。
export function dimensionRating(average) {
  if (average >= 4.2) return { label: '精熟', tone: 'strong' };
  if (average >= 3.4) return { label: '熟練', tone: 'good' };
  if (average >= 2.6) return { label: '發展中', tone: 'mid' };
  if (average >= 1.8) return { label: '萌芽', tone: 'low' };
  return { label: '待啟蒙', tone: 'weak' };
}
