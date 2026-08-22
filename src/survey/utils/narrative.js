/**
 * 敘事評語組裝 — 把各子能力的單句評語，依連接詞模板串接成自然、富變化的完整段落。
 *
 * 設計重點：
 * - 分段門檻沿用評分標準對應表：平均 ≥4.5 → high；3.5–<4.5 → mid；<3.5 → low。
 * - 模板（開場句／連接詞／收尾句）預先備多組，以 seed 取模選用 →
 *   「同一份報告穩定不亂跳，但跨構面、跨受測者自然有變化」。
 * - 評語內容來自題庫設定的 config.COMMENTARY；無設定則回傳空字串（呼叫端不顯示）。
 */

export function bandOf(average) {
  if (average >= 4.5) return 'high';
  if (average >= 3.5) return 'mid';
  return 'low';
}

const TEMPLATES = {
  openers: {
    high: [
      (dim) => `在「${dim}」構面，您展現出相當成熟的行為樣貌——`,
      (dim) => `「${dim}」是您明顯的優勢所在。`,
      (dim) => `綜觀「${dim}」，您的整體表現相當亮眼：`,
    ],
    mid: [
      (dim) => `在「${dim}」構面，您已建立穩定的行為基礎。`,
      (dim) => `「${dim}」方面，您的整體表現穩健——`,
      (dim) => `就「${dim}」而言，您具備可靠的基本功：`,
    ],
    low: [
      (dim) => `「${dim}」是您目前最值得投入的成長區。`,
      (dim) => `在「${dim}」構面，仍有明顯的提升空間——`,
      (dim) => `「${dim}」方面，建議列為近期的優先發展重點：`,
    ],
  },
  // 相鄰子能力「同方向」時使用（皆為正向或皆為待強化）
  additive: ['同時，', '此外，', '不僅如此，', '與此呼應的是，', '另外，'],
  // 相鄰子能力「轉向」時使用（優勢 ↔ 待強化之間的轉折）
  contrast: ['相對地，', '另一方面，', '值得留意的是，', '不過，', '需要提醒的是，'],
  closers: {
    high: [
      '建議持續發揮這份優勢，並帶動團隊一同成長。',
      '若能將這份能力傳遞給團隊，影響力將更為深遠。',
      '保持下去，這會是您領導風格中最具辨識度的亮點。',
    ],
    mid: [
      '只要再深化幾個關鍵習慣，便能往精熟邁進。',
      '針對較弱的環節刻意練習，整體表現可望更上層樓。',
      '持續累積經驗，這個構面很快會成為您的強項。',
    ],
    low: [
      '不妨從一個小而具體的行動開始，將帶來明顯改變。',
      '建議搭配導師回饋與定期反思，加速這個構面的成長。',
      '優先投入這個區塊的練習，整體領導力將同步受益。',
    ],
  },
};

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pick(arr, seed) {
  return arr[seed % arr.length];
}

// 正向（high/mid）與待強化（low）視為不同方向，用以決定連接詞。
const isPositive = (band) => band !== 'low';

/**
 * 組出單一構面的敘事段落。
 * @param {object} dim    result.dimensions[i]（需含 name / average / subs[]）
 * @param {object} config 題庫設定（需含 COMMENTARY）
 * @param {number|string} seedBase 報告層級的種子（建議用 result.total）
 * @returns {string} 段落文字；資料不足時回傳空字串
 */
export function buildNarrative(dim, config, seedBase = 0) {
  const commentary = config?.COMMENTARY;
  const subs = Array.isArray(dim?.subs) ? dim.subs.filter((s) => commentary?.[s.id]) : [];
  if (!commentary || subs.length === 0) return '';

  const dimBand = bandOf(dim.average);
  const seed = hashStr(`${seedBase}|${dim.id}`);

  const opener = pick(TEMPLATES.openers[dimBand], seed)(dim.name);

  const clauses = subs.map((sub, i) => {
    const band = bandOf(sub.average);
    const text = commentary[sub.id][band];
    if (i === 0) return text;
    const prevBand = bandOf(subs[i - 1].average);
    const pool = isPositive(band) === isPositive(prevBand) ? TEMPLATES.additive : TEMPLATES.contrast;
    return pick(pool, seed + i * 7) + text;
  });

  const closer = pick(TEMPLATES.closers[dimBand], seed + 99);

  return `${opener}${clauses.join('。')}。${closer}`;
}

/**
 * 組出班級／組織層級的整體敘事評語。
 * @param {Array}  results  多位成員的 buildResult() 輸出陣列
 * @param {object} config   題庫設定（需含 COMMENTARY）
 * @returns {{ overall: string, dimensions: Array<{name,avg,text}> }|null}
 */
export function buildGroupNarrative(results, config) {
  const commentary = config?.COMMENTARY;
  if (!commentary || !Array.isArray(results) || results.length < 2) return null;

  const n = results.length;
  const totalAvg = Math.round(results.reduce((s, r) => s + (r.total ?? 0), 0) / n);
  const seed = hashStr(`${n}|${totalAvg}`);

  // 群體各子能力平均
  const subTotals = {};
  const subCounts = {};
  results.forEach((r) => {
    (r.dimensions ?? []).forEach((dim) => {
      (dim.subs ?? []).forEach((s) => {
        subTotals[s.id] = (subTotals[s.id] ?? 0) + s.average;
        subCounts[s.id] = (subCounts[s.id] ?? 0) + 1;
      });
    });
  });
  const subAvgs = Object.entries(subTotals)
    .map(([id, sum]) => ({ id, avg: sum / (subCounts[id] ?? 1) }))
    .filter((s) => commentary[s.id])
    .sort((a, b) => b.avg - a.avg);

  if (subAvgs.length === 0) return null;

  const tops = subAvgs.slice(0, 2);
  const lows = subAvgs.slice(-2).reverse();

  // 落點分布（最多人的等級）
  const LEVEL_ORDER = ['leader', 'proficient', 'developer', 'explorer'];
  const levelCounts = {};
  results.forEach((r) => {
    const lid = r.level?.id ?? 'explorer';
    levelCounts[lid] = (levelCounts[lid] ?? 0) + 1;
  });
  const dominantLevel = LEVEL_ORDER.map((id) => ({
    id,
    badge: results.find((r) => r.level?.id === id)?.level?.badge ?? id,
    count: levelCounts[id] ?? 0,
  })).sort((a, b) => b.count - a.count)[0];

  // 子能力名稱對照
  const subNames = {};
  (config.DIMENSIONS ?? []).forEach((dim) => {
    (dim.subDimensions ?? []).forEach((s) => { subNames[s.id] = s.name; });
  });

  const top1 = subNames[tops[0]?.id] ?? tops[0]?.id ?? '';
  const top2 = subNames[tops[1]?.id] ?? tops[1]?.id ?? '';
  const low1 = subNames[lows[0]?.id] ?? lows[0]?.id ?? '';
  const low2 = subNames[lows[1]?.id] ?? lows[1]?.id ?? '';
  const badge = dominantLevel.badge;

  const templates = [
    () => `就整體組織表現而言，本次共 ${n} 位成員完成評量，整體平均總分 ${totalAvg} 分，多數成員落在「${badge}」。在集體優勢上，「${top1}」與「${top2}」展現了整個團隊的核心競爭力；而「${low1}」與「${low2}」則是組織目前最需要系統性投資的成長區塊，建議透過團隊工作坊或導師機制進行針對性強化。`,
    () => `綜觀本班 ${n} 位成員的領導力輪廓，整體落在「${badge}」，平均總分 ${totalAvg} 分。在「${top1}」與「${top2}」兩個子能力上，成員普遍展現出穩健的行為基礎，是組織可持續深耕的優勢；相對地，「${low1}」與「${low2}」的群體平均偏低，是近期規劃發展資源時的優先考量。`,
    () => `從組織整體視角來看，${n} 位成員的平均總分為 ${totalAvg} 分，主要集中在「${badge}」落點。團隊最顯著的集體強項是「${top1}」，可作為互相學習的基礎；「${top2}」同樣表現亮眼，值得進一步轉化為組織習慣。在發展重點上，「${low1}」與「${low2}」呈現的群體差距，建議優先納入下一期的課程設計或教練議題。`,
  ];

  // 每個構面的組織評語
  const dimAvgs = {};
  const dimNames = {};
  results.forEach((r) => {
    (r.dimensions ?? []).forEach((dim) => {
      dimAvgs[dim.id] = (dimAvgs[dim.id] ?? 0) + (dim.average ?? 0);
      dimNames[dim.id] = dim.name;
    });
  });
  const dimensionSummaries = Object.entries(dimAvgs).map(([id, sum]) => {
    const avg = sum / n;
    const band = bandOf(avg);
    const dimConfig = (config.DIMENSIONS ?? []).find((d) => d.id === id);
    if (!dimConfig?.subDimensions) return null;
    // 找出該構面子能力中群體最高與最低
    const dimSubAvgs = dimConfig.subDimensions
      .map((s) => ({ id: s.id, name: s.name, avg: (subTotals[s.id] ?? 0) / (subCounts[s.id] ?? 1) }))
      .filter((s) => commentary[s.id])
      .sort((a, b) => b.avg - a.avg);
    if (dimSubAvgs.length === 0) return null;
    const topSub = dimSubAvgs[0];
    const lowSub = dimSubAvgs[dimSubAvgs.length - 1];
    const hasMix = dimSubAvgs.length > 1 && bandOf(topSub.avg) !== bandOf(lowSub.avg);
    const strengthText = commentary[topSub.id][bandOf(topSub.avg)];
    const growthText = hasMix ? commentary[lowSub.id][bandOf(lowSub.avg)] : null;
    const BAND_LABEL = { high: '優秀表現', mid: '穩定展現', low: '尚待強化' };
    const advicePool = {
      high: ['建議作為全班標竿持續深化，並轉化為團隊習慣。', '可進一步帶入課程設計，讓每位成員都能提升至此水準。', '以此為基礎，推動跨成員的互相學習與傳承。'],
      mid:  ['建議在工作坊中刻意練習，加速整體達到優秀水準。', '可設計具體的實踐任務，協助成員鞏固這個構面的行為。', '透過定期回饋機制，協助成員持續精進。'],
      low:  ['此為本班首要發展重點，建議優先規劃針對性課程。', '建議搭配教練式對話，協助成員找到突破口。', '以小組練習或案例討論為起點，協助全班逐步改善。'],
    };
    const advice = pick(advicePool[band], seed + dimConfig.index * 13);
    let text = `「${dimNames[id]}」方面，全班平均 ${avg.toFixed(1)}/5（${BAND_LABEL[band]}）。${strengthText}`;
    if (growthText) text += `；另一方面，${growthText}`;
    text += `。${advice}`;
    return { id, name: dimNames[id], avg, band, text };
  }).filter(Boolean).sort((a, b) => {
    const order = (config.DIMENSIONS ?? []).findIndex((d) => d.id === a.id) - (config.DIMENSIONS ?? []).findIndex((d) => d.id === b.id);
    return order;
  });

  return {
    overall: pick(templates, seed)(),
    dimensions: dimensionSummaries,
  };
}

/**
 * 組出報告最上方的整體總評段落：點出落點等級、最強與最待強化構面，並給總結方向。
 */
export function buildOverallSummary(result, config, seedBase = 0) {
  if (!Array.isArray(result?.dimensions) || result.dimensions.length === 0) return '';
  const seed = hashStr(`${seedBase}|overall`);
  const sorted = [...result.dimensions].sort((a, b) => b.average - a.average);
  const tops = sorted.slice(0, 2).map((d) => d.name);
  const lows = sorted.slice(-2).map((d) => d.name).reverse();
  const badge = result.level?.badge ?? '';

  const templates = [
    () => `整體而言，您的領導行為落在「${badge}」。其中「${tops.join('」與「')}」是目前最突出的強項，展現了穩定而成熟的行為樣貌；而「${lows.join('」與「')}」則是當前最值得投入的成長區。`,
    () => `綜觀九大構面，您的整體表現屬於「${badge}」。「${tops.join('」、「')}」展現了明顯優勢，可作為帶動團隊的支點；同時，「${lows.join('」、「')}」仍有提升空間，是下一階段的關鍵發展方向。`,
    () => `從整體落點來看，您目前處於「${badge}」。最亮眼的是「${tops.join('」與「')}」，建議持續發揮；至於「${lows.join('」與「')}」，若能優先投入練習，將為整體領導力帶來最大的提升。`,
  ];

  return pick(templates, seed)();
}

/**
 * 歷程敘事 — 把某個評量底下依時間新到舊排序的作答紀錄，組成一段「這趟歷程走到
 * 哪裡」的話。跟 buildOverallSummary（單次報告的構面總評）刻意分開：這裡看的是
 * 跨次比較，不看單次的構面強弱。
 * @param {Array} filtered 依時間新到舊排序的作答紀錄（需含 id, createdAt, result{total, assessmentName, level, dimensions}）
 * @returns {string} 段落文字；沒有資料時回傳空字串
 */
export function buildJourneyNarrative(filtered) {
  if (!Array.isArray(filtered) || filtered.length === 0) return '';
  const latest = filtered[0];
  const oldest = filtered[filtered.length - 1];
  const count = filtered.length;
  const seed = hashStr(`${latest.id ?? latest.createdAt}|journey|${count}`);

  if (count === 1) {
    const templates = [
      () => `這是您在「${latest.result.assessmentName ?? '本評量'}」的第一次作答，總分 ${latest.result.total} 分，落點為「${latest.result.level.badge}」。從這裡開始，之後每一次作答都會被記錄下來，累積成屬於您的成長軌跡。`,
      () => `您剛完成第一次評測，總分 ${latest.result.total} 分（${latest.result.level.badge}）。這個分數會是您日後回頭比較的起點——之後的每一次複測都會自動算出成長幅度。`,
    ];
    return pick(templates, seed)();
  }

  const delta = latest.result.total - oldest.result.total;
  const deltaAbs = Math.abs(delta);
  const trendWord = delta > 0 ? '成長' : delta < 0 ? '下滑' : '持平';

  // 進步最多的構面：比較第一次與最新一次的原始分數。
  const oldestDims = new Map((oldest.result.dimensions ?? []).map((d) => [d.id, d]));
  let topGain = null;
  for (const d of latest.result.dimensions ?? []) {
    const before = oldestDims.get(d.id);
    if (!before) continue;
    const gain = d.score - before.score;
    if (!topGain || gain > topGain.gain) topGain = { name: d.subtitle ?? d.name, gain };
  }
  const gainNote = topGain && topGain.gain > 0 ? `「${topGain.name}」是這段時間進步最多的構面。` : '';

  const templates = [
    () => `您已累積 ${count} 次作答，總分從 ${oldest.result.total} 分到最新一次的 ${latest.result.total} 分${deltaAbs ? `，${trendWord} ${deltaAbs} 分` : '，大致持平'}。${gainNote}`,
    () => `從第一次 ${oldest.result.total} 分開始，${count} 次作答累積下來${deltaAbs ? `已經${trendWord} ${deltaAbs} 分` : '分數大致持平'}，來到 ${latest.result.total} 分。${gainNote}`,
  ];
  return pick(templates, seed)();
}

// 依題庫的三圈層（LAYERS）彙整各層平均，供顧問級敘事描述「能力梯度」。
function layerStats(result, config) {
  const layers = config?.LAYERS;
  if (!Array.isArray(layers) || layers.length === 0) return [];
  const dimById = new Map((result.dimensions ?? []).map((d) => [d.id, d]));
  return layers
    .map((layer) => {
      const dims = (layer.dimensions ?? []).map((id) => dimById.get(id)).filter(Boolean);
      const avg = dims.length ? dims.reduce((s, d) => s + d.average, 0) / dims.length : 0;
      return { id: layer.id, name: layer.name, avg, dims };
    })
    .filter((l) => l.dims.length > 0);
}

/**
 * 教練級敘事 — 以「發展教練」的口吻，聚焦個人成長優先序與可執行的練習。
 * 與 buildOverallSummary（中性總評）刻意採不同語氣。
 */
export function buildCoachNarrative(result, config, seedBase = 0) {
  if (!Array.isArray(result?.dimensions) || result.dimensions.length === 0) return '';
  const seed = hashStr(`${seedBase}|coach`);
  const sorted = [...result.dimensions].sort((a, b) => b.average - a.average);
  const top = sorted.slice(0, 2).map((d) => d.name);
  const low = sorted.slice(-2).map((d) => d.name).reverse();
  const lowest = sorted[sorted.length - 1];
  const badge = result.level?.badge ?? '';

  const templates = [
    () => `作為您的發展教練，我看見您在「${top.join('」與「')}」展現了可被倚重的行為慣性，這是我們能立刻「以強帶弱」的支點。下一步，建議把焦點放在「${low.join('」與「')}」——尤其是「${lowest.name}」，它目前是投報率最高的練習區。不妨從一個每週可重複的小行為開始，每次對談檢視一個具體情境、調整一個做法。`,
    () => `從教練的角度，您目前落在「${badge}」，整體節奏穩定。「${top.join('」、「')}」是明顯優勢，請刻意在團隊中多「示範」這些行為，讓它成為可被觀察與學習的範本；而「${low.join('」、「')}」則是這一期的核心議題，我會陪您把抽象目標拆成可演練的行動，從最小可行的一步啟動改變。`,
    () => `先肯定您在「${top.join('」與「')}」的投入——這些行為已內化成習慣，是您領導風格中最有辨識度的部分。接下來的成長空間集中在「${lowest.name}」，這不是缺點，而是尚未被刻意練習的肌群；建議搭配每兩週一次的回饋對話與情境演練，讓改變看得見、可累積。`,
  ];
  return pick(templates, seed)();
}

/**
 * 顧問級敘事 — 拉高到組織/策略視角，以三圈層描述能力梯度與人才定位；
 * 若題庫含「接班成熟度」構面則一併納入接班佈局觀點。無 LAYERS 時退回構面層級。
 */
export function buildConsultantNarrative(result, config, seedBase = 0) {
  if (!Array.isArray(result?.dimensions) || result.dimensions.length === 0) return '';
  const seed = hashStr(`${seedBase}|consultant`);
  const badge = result.level?.badge ?? '';
  const layers = layerStats(result, config);
  const succession = result.dimensions.find((d) => d.id === 'succession-readiness');
  const successionText = succession
    ? `在接班成熟度上目前平均 ${succession.average.toFixed(1)}/5，${
        succession.average >= 3.5
          ? '已展現承接更大責任的心理與能力準備，建議於實戰專案中加速養成。'
          : '建議優先透過任務歷練與導師制補強，縮短與接班期待之間的落差。'
      }`
    : '';

  if (layers.length >= 2) {
    const sortedL = [...layers].sort((a, b) => b.avg - a.avg);
    const strongL = sortedL[0];
    const weakL = sortedL[sortedL.length - 1];
    const positioning = strongL.avg >= 3.8 ? '可培育的關鍵接班候選' : '需中期發展的潛力人才';
    const templates = [
      () => `綜觀整體領導梯度，其優勢集中在「${strongL.name}」層（平均 ${strongL.avg.toFixed(1)}/5），在此能力圈層已具備可被組織倚賴的穩定度；相對地，「${weakL.name}」層（平均 ${weakL.avg.toFixed(1)}/5）是現階段最關鍵的能力斷點，將直接影響其能否承擔更大的管理幅度。整體落點為「${badge}」。${successionText}從人才佈局來看，建議將其定位為「${positioning}」，並以「${weakL.name}」層作為下一階段發展投資的主軸。`,
      () => `從組織人才地圖的高度來看，這份結果呈現清晰的能力梯度：「${strongL.name}」是其立足點，「${weakL.name}」則是邁向更高領導職位前必須補強的關鍵環節，整體成熟度落於「${badge}」。${successionText}建議採取「以優勢建立信任、以弱項設定里程碑」的發展策略，並透過跨部門專案讓能力在真實情境中被驗證。`,
    ];
    return pick(templates, seed)();
  }

  const sorted = [...result.dimensions].sort((a, b) => b.average - a.average);
  const top = sorted[0]?.name;
  const low = sorted[sorted.length - 1]?.name;
  return `整體落點為「${badge}」。從人才發展視角，「${top}」是其可被組織倚賴的優勢，「${low}」則是下一階段最關鍵的發展投資方向，建議透過任務歷練與定期檢核加速養成。${successionText}`;
}

/**
 * 未來發展建議 — 依最弱構面（重點構面優先）排出近/中/長期路徑。
 * @param {object} options 可帶 { focusDimensionIds: string[] } 讓重點構面優先進入近中期。
 * @returns {Array<{id,horizon,title,actions:string[]}>}
 */
export function buildDevelopmentPlan(result, config, options = {}) {
  if (!Array.isArray(result?.dimensions) || result.dimensions.length === 0) return [];
  const focusIds = Array.isArray(options.focusDimensionIds) ? options.focusDimensionIds : [];
  const dims = result.dimensions;
  const weakestFirst = [...dims].sort((a, b) => a.average - b.average);
  const focusWeakest = weakestFirst.filter((d) => focusIds.includes(d.id));

  const near = focusWeakest[0] ?? weakestFirst[0];
  const mid = weakestFirst.find((d) => d.id !== near.id);
  const strongest = [...dims].sort((a, b) => b.average - a.average)[0];

  const ACTIONS = {
    low: [
      '鎖定一個高頻情境，設計可每週重複的具體行為，並記錄前後差異。',
      '尋求一位導師或同儕給予即時回饋，每兩週檢視一次進展。',
    ],
    mid: [
      '將既有行為標準化為可複製的流程，並在團隊中試行。',
      '挑選一個略高於現況的挑戰任務，作為能力延伸的試煉場。',
    ],
    high: [
      '把這項優勢轉化為團隊可學習的範本，透過帶教擴大影響。',
      '在跨部門或更高層級的任務中發揮此強項，累積組織能見度。',
    ],
  };

  const phase = (dim, horizon, label) => ({
    id: dim.id,
    horizon,
    title: `${label}：聚焦「${dim.name}」（目前 ${dim.average.toFixed(1)} / 5）`,
    actions: ACTIONS[bandOf(dim.average)],
  });

  const plan = [phase(near, '近期（0–3 個月）', '打底')];
  if (mid && mid.id !== near.id) plan.push(phase(mid, '中期（3–6 個月）', '進階'));
  if (strongest && strongest.id !== near.id && strongest.id !== mid?.id) {
    plan.push({
      id: strongest.id,
      horizon: '長期（6–12 個月）',
      title: `發揮：以「${strongest.name}」帶動全局（目前 ${strongest.average.toFixed(1)} / 5）`,
      actions: ACTIONS.high,
    });
  }
  return plan;
}

/**
 * 把多位成員的結果聚合成單一「類 result」物件（各構面取平均、落點取主導等級），
 * 供班級層級沿用顧問級敘事與發展建議。
 * @returns {{total:number, level:object, dimensions:Array<{id,name,color,average}>}|null}
 */
export function aggregateResult(results, config) {
  if (!Array.isArray(results) || results.length === 0) return null;
  const n = results.length;
  const agg = new Map();
  results.forEach((r) =>
    (r.dimensions ?? []).forEach((d) => {
      const e = agg.get(d.id) ?? { id: d.id, name: d.name, color: d.color, sum: 0, cnt: 0 };
      e.sum += d.average ?? 0;
      e.cnt += 1;
      agg.set(d.id, e);
    }),
  );
  let dimensions = [...agg.values()].map((e) => ({
    id: e.id, name: e.name, color: e.color, average: e.cnt ? e.sum / e.cnt : 0,
  }));
  if (config?.DIMENSIONS) {
    const order = (id) => config.DIMENSIONS.findIndex((d) => d.id === id);
    dimensions = dimensions.sort((a, b) => order(a.id) - order(b.id));
  }
  if (dimensions.length === 0) return null;

  const total = Math.round(results.reduce((s, r) => s + (r.total ?? 0), 0) / n);
  const lvlCount = {};
  results.forEach((r) => {
    const id = r.level?.id;
    if (id) lvlCount[id] = (lvlCount[id] ?? 0) + 1;
  });
  const domId = Object.entries(lvlCount).sort((a, b) => b[1] - a[1])[0]?.[0];
  const level = results.find((r) => r.level?.id === domId)?.level ?? results[0]?.level ?? { badge: '' };
  return { total, level, dimensions };
}
