import { useEffect, useState } from 'react';
import { BookOpen, ExternalLink, BookmarkPlus, BookmarkCheck } from 'lucide-react';
import { api } from '../api/client';
import AddToGoalButton from './AddToGoalButton';

/**
 * 依構面從第二大腦（brain.rong-rise.com，CJ 哥「榕耀」顧問公司自建的知識庫）
 * 帶入延伸閱讀文章——診斷出弱項／次要風格後，直接給對應的學習內容，把「評測
 * →診斷」跟「學習」接起來。一次評測結果常常不只一個值得延伸的構面，因此接受
 * 多個構面（dimensions），每個構面各自一個子區塊；單一構面查無內容就跳過那個
 * 子區塊，全部都查無內容才整塊不顯示（沿用平台既有「沒內容就不顯示」的慣例）。
 *
 * 每篇文章可以「加入我的學習清單」（見「我的學習」頁）或「加入目標」（變成某個
 * 發展目標的行動項目）——把「看到推薦」接到「真的去學、排進目標」，見
 * docs/SPRINT_PLAN.md Sprint 3。
 *
 * @param {string} assessmentId
 * @param {Array<{id:string, subtitle?:string}>} dimensions 最多同時查詢幾個構面
 */
export default function LearningResources({ assessmentId, dimensions = [] }) {
  const [byDimension, setByDimension] = useState(null); // null = 載入中／尚未查詢
  const [savedUrls, setSavedUrls] = useState(new Set());
  const [goals, setGoals] = useState([]);

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

  // 「加入清單」「加入目標」都是非必要的附加動作，載入失敗就當作「還沒加過」
  // 「還沒有目標」，不影響文章本身的顯示與點擊閱讀。
  useEffect(() => {
    let active = true;
    api.myReadingList()
      .then((list) => { if (active) setSavedUrls(new Set(list.map((i) => i.url))); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!assessmentId) return undefined;
    let active = true;
    api.myGoals(assessmentId)
      .then((list) => { if (active) setGoals(list); })
      .catch(() => {});
    return () => { active = false; };
  }, [assessmentId]);

  const sections = (byDimension ?? [])
    .map((entry) => ({
      ...entry,
      dimension: dimensions.find((d) => d.id === entry.dimensionId),
    }))
    .filter((entry) => entry.articles?.length > 0);

  if (sections.length === 0) return null;

  const handleSave = (article, dimensionId, dimensionName) => {
    setSavedUrls((prev) => new Set(prev).add(article.url)); // 樂觀更新，失敗也不用復原——最壞情況只是下次重整才會再看到「加入清單」可點。
    api.addToReadingList({
      url: article.url,
      title: article.title,
      excerpt: article.excerpt,
      category: article.category,
      assessmentId,
      dimensionId,
      dimensionName,
    }).catch(() => {});
  };

  const handleArticleClick = (dimensionId, article) => {
    api.trackArticleClick({ assessmentId, dimensionId, url: article.url });
  };

  return (
    <div className="mt-6 rounded-md bg-paper-50 p-4 ring-1 ring-paper-300">
      <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-slate-700">
        <BookOpen className="h-4 w-4 text-brass-500" /> 延伸閱讀
      </p>
      <p className="mb-4 text-xs leading-relaxed text-slate-500">
        依這次評測顯示的重點構面，從榕耀管理顧問「第二大腦」知識庫精選延伸閱讀，把診斷結果轉化為具體的學習方向。
        點文章標題可在新分頁開啟全文；也可以把文章加入「我的學習清單」慢慢讀，或直接變成某個發展目標的行動項目。
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
              {articles.map((a) => {
                const saved = savedUrls.has(a.url);
                return (
                  <li key={a.url}>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleArticleClick(dimensionId, a)}
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
                    <div className="ml-6 mt-1 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => !saved && handleSave(a, dimensionId, dimension?.subtitle)}
                        disabled={saved}
                        className={`inline-flex items-center gap-1 text-xs font-semibold ${
                          saved ? 'text-emerald-600' : 'text-slate-400 hover:text-brass-600'
                        }`}
                      >
                        {saved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
                        {saved ? '已加入清單' : '加入清單'}
                      </button>
                      <AddToGoalButton
                        assessmentId={assessmentId}
                        dimension={dimension}
                        article={a}
                        goals={goals}
                        onGoalsChange={setGoals}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
