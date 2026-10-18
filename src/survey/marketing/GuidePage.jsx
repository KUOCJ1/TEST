import { Link, Navigate, useParams } from 'react-router-dom';
import MarketingNav from './MarketingNav';
import MarketingFooter from './MarketingFooter';
import CtaBanner from './CtaBanner';
import { getAssessment } from '../data/assessments/index.js';
import { GUIDES } from '../data/assessment-guides.js';

const DEFAULT_SCALE = [
  { value: 1, label: '非常不同意' }, { value: 2, label: '不太同意' }, { value: 3, label: '普通' },
  { value: 4, label: '大致同意' }, { value: 5, label: '非常同意' },
];

/**
 * 任一評測的說明頁（/guide/:id）：結構性資訊（構面、題數、量表、結果樣貌、360°）直接從題庫設定算出，
 * 用途與讀法來自 data/assessment-guides.js。領導力羅盤改導到專屬的 /framework。
 */
export default function GuidePage({ loggedIn = false, onEnter }) {
  const { assessmentId } = useParams();
  const config = getAssessment(assessmentId);
  const guide = GUIDES[assessmentId];

  if (config?.FRAMEWORK_PATH) return <Navigate to={config.FRAMEWORK_PATH} replace />;

  const shell = (children) => (
    <div className="min-h-screen bg-paper-100 font-sans text-ink-700">
      <MarketingNav loggedIn={loggedIn} onEnter={onEnter} />
      {children}
      <MarketingFooter />
    </div>
  );

  if (!config || !guide) {
    return shell(
      <section className="px-6 py-32 text-center">
        <h1 className="font-serif text-3xl font-bold text-ink-700">找不到這份評測的說明</h1>
        <p className="mt-4 text-ink-100">網址可能有誤，或這份評測還沒有說明頁。</p>
        <Link to="/" className="mt-8 inline-block font-semibold text-brass-500 underline">回首頁</Link>
      </section>,
    );
  }

  const scale = config.SCALE_LABELS ?? DEFAULT_SCALE;
  const profileMode = Boolean(config.PROFILE_MODE);
  const levels = (config.LEVELS ?? []).filter((l) => l.badge);
  const questionCount = config.TOTAL_QUESTIONS ?? config.ALL_QUESTIONS?.length ?? 0;

  return shell(
    <>
      <section className="px-6 pt-20 pb-14">
        <div className="mx-auto max-w-3xl">
          <div className="font-display mb-3 text-[15px] italic tracking-wide text-brass-500">{config.NAME_EN ?? 'Assessment Guide'}</div>
          <h1 className="font-serif text-4xl font-bold leading-[1.2] tracking-tight text-ink-700 sm:text-5xl">{config.NAME}</h1>
          <p className="font-serif mt-6 text-2xl font-semibold leading-snug text-brass-500">{guide.tagline}</p>
          <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ink-100">{guide.purpose}</p>
          <p className="mt-4 text-sm text-ink-100"><strong>適合誰：</strong>{guide.forWhom}</p>
        </div>
      </section>

      <section id="dimensions" className="border-t border-ink-700/10 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-serif mb-8 text-3xl font-bold tracking-tight text-ink-700">這份評測在看什麼</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {config.DIMENSIONS.map((d) => (
              <div key={d.id} className="rounded-sm border border-ink-700/10 bg-paper-50 p-5">
                <h3 className="font-serif text-lg font-bold text-ink-700">{d.name}{d.subtitle && <span className="font-display ml-2 text-sm italic font-normal text-brass-500">{d.subtitle}</span>}</h3>
                <p className="mt-1 text-xs text-ink-100">{d.questions.length} 題</p>
                {d.subDimensions?.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-ink-700">
                    {d.subDimensions.map((s) => <li key={s.id} className="rounded-full bg-ink-700/5 px-2.5 py-1">{s.name}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
          {config.LAYERS?.length > 0 && (
            <div className="mt-8">
              <h3 className="font-serif mb-3 text-lg font-bold text-ink-700">三個圈層</h3>
              <ul className="space-y-2 text-sm text-ink-100">
                {config.LAYERS.map((l) => <li key={l.id}><strong className="text-ink-700">{l.name}</strong>：{l.desc}</li>)}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section id="how-to-answer" className="border-t border-ink-700/10 px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-serif mb-6 text-3xl font-bold tracking-tight text-ink-700">怎麼作答</h2>
          <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-100">
            <li>共 <strong className="text-ink-700">{questionCount} 題</strong>，每題以 5 點量表回答：{scale.map((s) => `${s.value} ${s.label}`).join('、')}。</li>
            <li>作答進度會自動儲存在你的瀏覽器，可以中途離開、之後繼續。</li>
            {guide.cautions.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </div>
      </section>

      <section id="results" className="border-t border-ink-700/10 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-serif mb-3 text-3xl font-bold tracking-tight text-ink-700">結果會怎麼呈現</h2>
          <ul className="mb-8 max-w-3xl list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-100">
            {guide.howToRead.map((t) => <li key={t}>{t}</li>)}
          </ul>
          {profileMode && levels.length > 0 && (
            <>
              <h3 className="font-serif mb-3 text-lg font-bold text-ink-700">可能的結果（共 {levels.length} 種，沒有高低之分）</h3>
              <ul className="flex flex-wrap gap-2 text-sm">
                {levels.map((l) => <li key={l.id} className="rounded-full border border-ink-700/15 bg-paper-50 px-3 py-1.5">{l.badge}</li>)}
              </ul>
            </>
          )}
          {!profileMode && levels.length > 1 && Number.isFinite(levels[0].max) && (
            <>
              <h3 className="font-serif mb-3 text-lg font-bold text-ink-700">整體落點等級</h3>
              <ul className="grid gap-2 text-sm sm:grid-cols-2">
                {levels.map((l) => (
                  <li key={l.id} className="rounded-sm border border-ink-700/10 bg-paper-50 px-4 py-3">
                    <span className="font-semibold text-ink-700">{l.badge}</span>
                    <span className="ml-2 text-xs text-ink-100">{l.min}–{l.max} 分</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <section id="privacy" className="border-t border-ink-700/10 px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-serif mb-4 text-3xl font-bold tracking-tight text-ink-700">誰看得到你的結果</h2>
          <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-100">
            <li>你本人，以及你所屬班級的教練與平台管理員。</li>
            {config.SUPPORTS_360
              ? (config.STRICT_RATER_PRIVACY
                ? <li>這份評測支援 360° 他評，需要你或教練先邀請評分者：他人對你的評分在報告中以匿名呈現，同一類評分者滿 3 位才單獨顯示；教練看不到評分者身分與個別分數，管理者要查看必須填寫理由並留下稽核紀錄。</li>
                : <li>這份評測支援 360° 他評：他人對你的評分在你的報告中以匿名呈現；教練與管理者可辨識評分者的身分。</li>)
              : <li>這份評測不開放 360° 他評，只有你本人作答。</li>}
          </ul>
          <p className="mt-5 text-sm text-ink-100">完整說明請見 <Link to="/privacy" className="font-semibold text-brass-500 underline">隱私權政策</Link>。</p>
        </div>
      </section>

      <CtaBanner loggedIn={loggedIn} onEnter={onEnter} kicker="Get Started" title="準備好了，就開始吧" desc="登入後在「我的評量」開始作答，進度會自動儲存。" />
    </>,
  );
}
