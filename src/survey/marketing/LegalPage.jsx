import { Link } from 'react-router-dom';
import MarketingNav from './MarketingNav';
import MarketingFooter from './MarketingFooter';
import {
  POLICY_META, POLICY_VERSION, PLACEHOLDERS, isPolicyDraft,
  PRIVACY_SECTIONS, PRIVACY_TITLE, TERMS_SECTIONS, TERMS_TITLE,
} from '../legal/policy';

const DOCS = {
  privacy: { title: PRIVACY_TITLE, sections: PRIVACY_SECTIONS, other: { to: '/terms', label: TERMS_TITLE } },
  terms: { title: TERMS_TITLE, sections: TERMS_SECTIONS, other: { to: '/privacy', label: PRIVACY_TITLE } },
};

// 文字裡的 {{operator}}／{{contact}} 換成設定值（沒填就是醒目的待填標記）；**粗體** 轉成 <strong>。
function Inline({ text, meta }) {
  const parts = text.split(/(\{\{\w+\}\}|\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    const token = part.match(/^\{\{(\w+)\}\}$/)?.[1];
    if (token) {
      const value = (token === 'operator' ? meta.operatorName : meta.contactEmail)?.trim();
      return value
        ? <span key={i}>{value}</span>
        : <mark key={i} className="rounded bg-amber-200 px-1 font-semibold text-amber-950">【待填：{PLACEHOLDERS[token]}】</mark>;
    }
    if (part.startsWith('**')) return <strong key={i} className="font-semibold text-ink-700">{part.slice(2, -2)}</strong>;
    return <span key={i}>{part}</span>;
  });
}

function Block({ block, meta }) {
  if (block.type === 'p') return <p className="leading-relaxed"><Inline text={block.text} meta={meta} /></p>;
  if (block.type === 'ul') {
    return (
      <ul className="list-disc space-y-1.5 pl-5 leading-relaxed">
        {block.items.map((item) => <li key={item}><Inline text={item} meta={meta} /></li>)}
      </ul>
    );
  }
  // 表格在窄螢幕會比畫面寬，容器要能用鍵盤捲動（tabIndex + role + 名稱）。
  return (
    <div role="region" tabIndex={0} aria-label="說明表格（可左右捲動）" className="overflow-x-auto rounded-md ring-1 ring-ink-700/10">
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
        <thead className="bg-paper-200 text-ink-600">
          <tr>{block.head.map((h) => <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row[0]} className="border-t border-ink-700/10 align-top">
              {row.map((cell, i) => (
                <td key={cell} className={`px-3 py-2 leading-relaxed ${i === 0 ? 'min-w-[7rem] max-w-[13rem] font-semibold text-ink-700' : ''}`}>
                  <Inline text={cell} meta={meta} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 隱私權政策與服務條款頁（Sprint 12）：公開，登入前後都能開。內容在 legal/policy.js。
 * 政策還沒確認（status 不是 published，或經營者／聯絡信箱沒填）時，頂端顯示草稿標記。
 */
export default function LegalPage({ kind, loggedIn = false, onEnter, meta = POLICY_META }) {
  const doc = DOCS[kind];
  const draft = isPolicyDraft(meta);
  // 草稿說明只講「實際還缺什麼」：欄位填好之後不能還說「還沒填」。
  const missing = [!meta.operatorName?.trim() && '經營者名稱', !meta.contactEmail?.trim() && '聯絡信箱'].filter(Boolean);
  return (
    <div className="min-h-screen bg-paper-100 font-sans text-ink-700">
      <MarketingNav loggedIn={loggedIn} onEnter={onEnter} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        {draft && (
          <div role="note" className="mb-8 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
            <strong className="font-semibold">草稿，尚待確認。</strong>
            這份文件是依系統實際行為整理的草稿
            {missing.length > 0 ? `，${missing.join('與')}還沒填` : ''}
            ，內容也還沒經過經營者確認；正式公開前請以確認後的版本為準。
          </div>
        )}
        {!draft && meta.provisional && (
          <div role="note" className="mb-8 rounded-md border border-brass-300 bg-brass-50 px-4 py-3 text-sm leading-relaxed text-ink-700">
            <strong className="font-semibold">暫定版。</strong>
            這份文件已依系統實際行為整理並生效，但尚待法務審閱，內容可能調整；有實質調整時我們會調升版本，並請你重新閱讀與同意。
          </div>
        )}
        <header className="mb-8 border-b border-ink-700/10 pb-6">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-ink-700">{doc.title}</h1>
          <p className="mt-2 text-sm text-ink-100">
            版本 {POLICY_VERSION}{' · '}生效日 {meta.effectiveDate}{' · '}
            <Link to={doc.other.to} className="font-semibold text-ink-700 underline underline-offset-2">另見《{doc.other.label}》</Link>
          </p>
          <nav aria-label="本頁目錄" className="mt-4">
            <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {doc.sections.map((s) => (
                <li key={s.id}><a href={`#${s.id}`} className="text-ink-100 hover:text-ink-700">{s.title}</a></li>
              ))}
            </ol>
          </nav>
        </header>

        <div className="space-y-10">
          {doc.sections.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-24">
              <h2 id={`${s.id}-h`} className="mb-3 font-serif text-xl font-semibold text-ink-700">{s.title}</h2>
              <div className="space-y-3 text-[15px] text-ink-100">
                {s.blocks.map((b, i) => <Block key={i} block={b} meta={meta} />)}
              </div>
            </section>
          ))}
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
