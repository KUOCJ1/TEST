import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import MarketingNav from './MarketingNav';
import MarketingFooter from './MarketingFooter';
import CtaBanner from './CtaBanner';
import {
  TAGLINE, LOOP_INTRO, MNEMONIC, DIMENSION_INTRO, TENSION_INTRO, HOW_TO_READ, PRIVACY_POINTS,
} from '../data/assessments/compass-framework.js';

const DIM_NAMES = { find: '洞察情勢', aim: '聚焦應變', staff: '知人授權', team: '凝聚帶動', learn: '敏捷學習', anchor: '穩定當責', sow: '識才育才', transfer: '傳承留能' };

/** 「雙環領導羅盤八大構面評測」的框架說明（公開頁）：作答前、教練向客戶介紹、報告回頭查都連到這裡。 */
export default function FrameworkPage({ loggedIn = false, onEnter }) {
  // 報告裡的構面連結是 /framework#find 這種錨點；React Router 不會自動捲動，這裡處理。
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.replace(/^#/, ''));
    if (!id) return;
    const el = document.getElementById(id);
    if (el?.scrollIntoView) el.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, []);

  return (
    <div className="min-h-screen bg-paper-100 font-sans text-ink-700">
      <MarketingNav loggedIn={loggedIn} onEnter={onEnter} />

      <section className="px-6 pt-20 pb-16">
        <div className="mx-auto max-w-3xl">
          <div className="font-display mb-3 text-[15px] italic tracking-wide text-brass-500">Dual-Loop Leadership Compass</div>
          <h1 className="font-serif text-4xl font-bold leading-[1.2] tracking-tight text-ink-700 sm:text-5xl">雙環領導羅盤八大構面評測</h1>
          <p className="font-serif mt-6 text-2xl font-semibold leading-snug text-brass-500">{TAGLINE}</p>
          <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ink-100">
            這份評測把領導力放在兩個環裡看：<strong>快環</strong>是你面對眼前的事有多快；<strong>永環</strong>是你不在的時候，能力還留不留得下來。
            兩個環互相支撐，缺了哪一個，領導都走不遠。
          </p>
        </div>
      </section>

      <section id="loops" className="border-t border-ink-700/10 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="font-display mb-3 text-[15px] italic text-brass-500">Two Loops — 兩個環</div>
          <h2 className="font-serif mb-10 text-3xl font-bold tracking-tight text-ink-700">快環與永環</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {Object.values(LOOP_INTRO).map((l) => (
              <div key={l.id} className="rounded-sm border border-ink-700/10 bg-paper-50 p-6">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-serif text-xl font-bold text-ink-700">{l.name}</h3>
                  <span className="font-display text-sm italic text-brass-500">{l.en} · {l.slogan}</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ink-100">{l.desc}</p>
                <ol className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
                  {l.steps.map((s, i) => (
                    <li key={s} className="rounded-full bg-ink-700 px-3 py-1 text-paper-50">{i + 1}. {s}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm leading-relaxed text-ink-100">{MNEMONIC}</p>
        </div>
      </section>

      <section id="dimensions" className="border-t border-ink-700/10 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="font-display mb-3 text-[15px] italic text-brass-500">Eight Dimensions — 八個構面</div>
          <h2 className="font-serif mb-10 text-3xl font-bold tracking-tight text-ink-700">每個構面在看什麼</h2>
          <div className="space-y-6">
            {DIMENSION_INTRO.map((d) => (
              <article key={d.id} id={d.id} className="scroll-mt-24 rounded-sm border border-ink-700/10 bg-paper-50 p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-serif text-xl font-bold text-ink-700">{DIM_NAMES[d.id]}<span className="font-display ml-3 text-sm italic font-normal text-brass-500">{d.en}</span></h3>
                  <span className="text-xs font-semibold text-ink-100">{d.loop === 'fast' ? '快環' : '永環'}</span>
                </div>
                <p className="font-serif mt-2 text-lg font-semibold text-ink-700">{d.tagline}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-100">{d.desc}</p>
                <dl className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                  {d.subs.map(([name, meaning]) => (
                    <div key={name}><dt className="text-sm font-semibold text-ink-700">{name}</dt><dd className="text-sm text-ink-100">{meaning}</dd></div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="tensions" className="border-t border-ink-700/10 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="font-display mb-3 text-[15px] italic text-brass-500">Four Tensions — 四組張力</div>
          <h2 className="font-serif mb-3 text-3xl font-bold tracking-tight text-ink-700">兩端都有價值，所以才需要取捨</h2>
          <p className="mb-10 max-w-2xl text-sm leading-relaxed text-ink-100">
            有些行為不是越多越好，而是兩端要拿捏。報告會看你偏向哪一端、兩端平不平衡；偏向某一端不是缺點，而是提醒你在哪些情境需要刻意切換。
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            {TENSION_INTRO.map((t) => (
              <div key={t.id} className="rounded-sm border border-ink-700/10 bg-paper-50 p-6">
                <h3 className="font-serif text-lg font-bold text-ink-700">{t.a} ↔ {t.b}</h3>
                <dl className="mt-3 space-y-3 text-sm leading-relaxed">
                  <div><dt className="font-semibold text-ink-700">{t.a}的好處</dt><dd className="text-ink-100">{t.aHelps}偏重時，可能{t.aLimit}</dd></div>
                  <div><dt className="font-semibold text-ink-700">{t.b}的好處</dt><dd className="text-ink-100">{t.bHelps}偏重時，可能{t.bLimit}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="ai" className="border-t border-ink-700/10 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <div className="font-display mb-3 text-[15px] italic text-brass-500">Humans and AI — 人與 AI 一起</div>
          <h2 className="font-serif mb-4 text-3xl font-bold tracking-tight text-ink-700">人機協作，編織在每個構面裡</h2>
          <p className="text-[15px] leading-relaxed text-ink-100">
            今天的團隊，成員可能是人，也可能是 AI 與自動化工具。所以這份評測沒有把 AI 另外獨立成一個構面，而是放進洞察情勢（查證 AI 的結論）、知人授權（人機分工）、敏捷學習（用工具學習）與傳承留能（給 AI 使用的知識由誰維護）。
            報告會把這些題目另外整理成「人機協作剖面」。這是一種工作方式的改變，不是另一種能力：分數低代表目前較少這樣做，不代表不適合。
          </p>
        </div>
      </section>

      <section id="how-to-read" className="border-t border-ink-700/10 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="font-display mb-3 text-[15px] italic text-brass-500">How To Read — 怎麼讀</div>
          <h2 className="font-serif mb-10 text-3xl font-bold tracking-tight text-ink-700">開始作答之前，先知道這四件事</h2>
          <div className="grid gap-8 sm:grid-cols-2">
            {HOW_TO_READ.map(([title, desc], i) => (
              <div key={title} className="border-t border-ink-700/10 pt-5">
                <div className="font-serif mb-1 text-sm text-brass-500">{String(i + 1).padStart(2, '0')}</div>
                <h3 className="font-serif mb-2 text-lg font-bold text-ink-700">{title}</h3>
                <p className="text-sm leading-relaxed text-ink-100">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="privacy" className="border-t border-ink-700/10 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <div className="font-display mb-3 text-[15px] italic text-brass-500">Your Privacy — 你的隱私</div>
          <h2 className="font-serif mb-4 text-3xl font-bold tracking-tight text-ink-700">請別人評你時，評分者是被保護的</h2>
          <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-100">
            {PRIVACY_POINTS.map((p) => <li key={p}>{p}</li>)}
          </ul>
          <p className="mt-5 text-sm text-ink-100">完整說明請見 <Link to="/privacy" className="font-semibold text-brass-500 underline">隱私權政策</Link>。</p>
        </div>
      </section>

      <CtaBanner loggedIn={loggedIn} onEnter={onEnter} kicker="Get Started" title="準備好了，就開始吧" desc="作答約需 10–20 分鐘；進度會自動儲存，可以分段完成。" />
      <MarketingFooter />
    </div>
  );
}
