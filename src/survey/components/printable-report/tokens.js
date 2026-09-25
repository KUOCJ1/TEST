// ─── Design tokens shared across PrintableReport 的所有分頁 ──────────

export const TONE_COLOR = {
  strong: '#059669', good: '#0284c7', mid: '#d97706', low: '#ef4444', weak: '#7f1d1d',
};
export const TONE_BG = {
  strong: '#f0fdf4', good: '#f0f9ff', mid: '#fffbeb', low: '#fef2f2', weak: '#fff1f2',
};
export const TONE_BORDER = {
  strong: '#bbf7d0', good: '#bae6fd', mid: '#fde68a', low: '#fecaca', weak: '#fecdd3',
};

export const BARS_ANCHOR = {
  '精熟': '在此能力展現模範行為，能主動應用於複雜情境並指導他人，是團隊的學習榜樣。',
  '熟練': '在多數情境中穩定展現此能力，具備良好的實踐基礎，持續精進即可達到精熟。',
  '發展中': '能在有利情境中展現此能力，但在高壓或複雜情境中仍有明顯的成長空間。',
  '萌芽': '此能力正處於發展初期，需要刻意練習、外部回饋與情境強化。',
  '待啟蒙': '此能力尚待開發，建議優先納入個人發展計畫並尋求導師指導。',
};

export const DIM_DEVELOPMENT = {
  'communication': {
    impact: '訊息傳遞不清晰或表達方式未能因對象調整，易造成誤解與重工，降低跨層級信任。',
    action: '每次重要溝通後發送書面摘要確認共識；對話前先確認對方背景與期望。',
  },
  'collaboration': {
    impact: '跨部門協作摩擦增加，資源整合效率下降，長期影響內部信任與專案交付品質。',
    action: '主動建立定期跨部門 check-in；遇衝突先理解立場，再提解決方案。',
  },
  'task-management': {
    impact: '工作優先序不清或時程掌控不足，導致成員焦慮上升、承諾交付品質不穩定。',
    action: '每週開始時與團隊確認優先任務與瓶頸；以視覺化看板追蹤進度。',
  },
  'execution': {
    impact: '計畫落地率不穩，累積影響組織對承諾的信任度與後續資源投入意願。',
    action: '拆解大目標為兩週短衝刺；每次回顧找出一個可立即消除的執行阻礙。',
  },
  'leadership-impact': {
    impact: '方向感不清晰或激勵行為不足，成員易感到缺乏目標感與向心力，績效難提升。',
    action: '定期以 Why-How-What 框架向團隊說明目標意義；公開表揚具體貢獻行為。',
  },
  'developing-others': {
    impact: '人才成長速度放緩，關鍵職能缺乏備援，長期削弱組織知識傳承與抗風險能力。',
    action: '為每位成員設計本季「延展性任務」；每月進行一對一發展對話。',
  },
  'critical-thinking': {
    impact: '面對模糊情境決策拖延或依賴慣性判斷，可能錯失最佳介入時機並影響組織敏捷度。',
    action: '決策前先定義判斷標準；對複雜問題採「先假設、再驗證」縮短評估週期。',
  },
  'self-development': {
    impact: '學習投入不足，長期競爭力逐漸被環境變化侵蝕，難以引領團隊面對新挑戰。',
    action: '設定本季學習目標並排進行事曆；每月分享一個學習心得給團隊。',
  },
  'succession-readiness': {
    impact: '關鍵職能缺乏後備，面對人員異動時組織持續性與穩定性脆弱，風險集中於個人。',
    action: '盤點自身關鍵職責並指導至少一位接班人選；參與跨層級的策略討論。',
  },
};

export const RATING_SCALE = [
  { level: '精熟', range: '≥ 4.2', tone: 'strong', desc: '展現模範行為，能指導他人，在高壓情境中持續表現' },
  { level: '熟練', range: '3.4–4.19', tone: 'good', desc: '在多數情境中穩定展現，具良好實踐基礎' },
  { level: '發展中', range: '2.6–3.39', tone: 'mid', desc: '能在有利情境展現，高壓情境有待加強' },
  { level: '萌芽', range: '1.8–2.59', tone: 'low', desc: '偶爾展現，需刻意練習與強化' },
  { level: '待啟蒙', range: '< 1.8', tone: 'weak', desc: '尚待開發，應優先納入發展計畫' },
];
