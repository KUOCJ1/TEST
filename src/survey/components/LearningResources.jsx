import { useEffect, useState } from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';
import { api } from '../api/client';

/**
 * 依構面從第二大腦（brain.rong-rise.com，CJ 哥「榕耀」顧問公司自建的知識庫）
 * 帶入延伸閱讀文章——診斷出弱項／次要風格後，直接給對應的學習內容，把「評測
 * →診斷」跟「學習」接起來。查無內容或第二大腦一時連不上時直接不顯示，不佔
 * 版面、不出現空白區塊或錯誤訊息（沿用平台既有慣例）。
 */
export default function LearningResources({ assessmentId, dimension }) {
  const [articles, setArticles] = useState(null); // null = 載入中／尚未查詢

  useEffect(() => {
    if (!assessmentId || !dimension?.id) return undefined;
    let active = true;
    Promise.resolve()
      .then(() => api.learningResources(assessmentId, dimension.id))
      .then((list) => { if (active) setArticles(Array.isArray(list) ? list : []); })
      .catch(() => { if (active) setArticles([]); }); // 非必要附加功能，任何失敗都不能讓報告頁面壞掉。
    return () => { active = false; };
  }, [assessmentId, dimension?.id]);

  if (!articles || articles.length === 0) return null;

  return (
    <div className="mt-4 rounded-md bg-paper-50 p-4 ring-1 ring-paper-300">
      <p className="mb-3 flex items-center gap-1.5 font-semibold text-slate-700">
        <BookOpen className="h-4 w-4 text-brass-500" /> 延伸閱讀
        {dimension?.subtitle && (
          <span className="font-normal text-slate-400">· 針對「{dimension.subtitle}」精選</span>
        )}
      </p>
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
      <p className="mt-3 text-xs text-slate-400">內容來自榕耀管理顧問「第二大腦」知識庫</p>
    </div>
  );
}
