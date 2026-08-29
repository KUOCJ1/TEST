import { useEffect, useState } from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';
import { api } from '../api/client';

/**
 * 依構面從第二大腦（brain.rong-rise.com，CJ 哥「榕耀」顧問公司自建的知識庫）
 * 帶入延伸閱讀文章——診斷出弱項／次要風格後，直接給對應的學習內容，把「評測
 * →診斷」跟「學習」接起來。一次評測結果常常不只一個值得延伸的構面，因此接受
 * 多個構面（dimensions），每個構面各自一個子區塊；單一構面查無內容就跳過那個
 * 子區塊，全部都查無內容才整塊不顯示（沿用平台既有「沒內容就不顯示」的慣例）。
 *
 * @param {string} assessmentId
 * @param {Array<{id:string, subtitle?:string}>} dimensions 最多同時查詢幾個構面
 */
export default function LearningResources({ assessmentId, dimensions = [] }) {
  const [byDimension, setByDimension] = useState(null); // null = 載入中／尚未查詢

  const dimensionIds = dimensions.map((d) => d.id).filter(Boolean).join(',');

  useEffect(() => {
    if (!assessmentId || !dimensionIds) return undefined;
    let active = true;
    Promise.resolve()
      .then(() => api.learningResources(assessmentId, dimensionIds.split(',')))
      .then((list) => { if (active) setByDimension(Array.isArray(list) ? list : []); })
      .catch(() => { if (active) setByDimension([]); }); // 非必要附加功能，任何失敗都不能讓報告頁面壞掉。
    return () => { active = false; };
  }, [assessmentId, dimensionIds]);

  const sections = (byDimension ?? [])
    .map((entry) => ({
      ...entry,
      dimension: dimensions.find((d) => d.id === entry.dimensionId),
    }))
    .filter((entry) => entry.articles?.length > 0);

  if (sections.length === 0) return null;

  return (
    <div className="mt-6 rounded-md bg-paper-50 p-4 ring-1 ring-paper-300">
      <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-slate-700">
        <BookOpen className="h-4 w-4 text-brass-500" /> 延伸閱讀
      </p>
      <p className="mb-4 text-xs leading-relaxed text-slate-500">
        依這次評測顯示的重點構面，從榕耀管理顧問「第二大腦」知識庫精選延伸閱讀，把診斷結果轉化為具體的學習方向——點擊文章標題即可在新分頁開啟全文。
      </p>
      <div className="space-y-4">
        {sections.map(({ dimensionId, dimension, articles }) => (
          <div key={dimensionId}>
            {dimension?.subtitle && (
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                針對「{dimension.subtitle}」精選
              </p>
            )}
            <ul className="space-y-2.5">
              {articles.map((a) => (
                <li key={a.url}>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-2 rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-paper-200"
                  >
                    <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-brass-600" />
                    <span>
                      <span className="block text-sm font-semibold text-slate-700 group-hover:text-brass-700">{a.title}</span>
                      {a.excerpt && (
                        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 line-clamp-2">{a.excerpt}</span>
                      )}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
