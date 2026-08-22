import MarketingNav from './MarketingNav';
import MarketingFooter from './MarketingFooter';
import CtaBanner from './CtaBanner';
import RadarChart from '../components/RadarChart';
import TrendChart from '../components/charts/TrendChart';
import DimensionHeatmap from '../components/DimensionHeatmap';
import {
  SHOWCASE_DIMENSIONS,
  SHOWCASE_SELF_DIMENSIONS,
  SHOWCASE_COHORT_COMPARE,
  SHOWCASE_TREND_POINTS,
  SHOWCASE_TREND_RANGE,
  SHOWCASE_GAIN,
  SHOWCASE_MEMBER_ROWS,
} from './mockData';

export default function ShowcasePage({ loggedIn = false, onEnter }) {
  return (
    <div className="min-h-screen bg-paper-100 font-sans text-ink-700">
      <MarketingNav loggedIn={loggedIn} onEnter={onEnter} />

      {/* Hero */}
      <section className="px-6 pt-20 pb-10">
        <div className="mx-auto max-w-3xl">
          <div className="font-display mb-3 text-[15px] italic tracking-wide text-brass-500">
            Sample Report — 範例報告
          </div>
          <h1 className="font-serif text-4xl font-bold leading-[1.2] tracking-tight text-ink-700 sm:text-5xl">
            數字被記錄下來，
            <br />
            會長成<span className="font-display italic text-brass-500">這樣</span>。
          </h1>
          <p className="mt-7 max-w-xl text-[17px] leading-relaxed text-ink-100">
            以下畫面直接取自平台實際使用的圖表元件，資料經過調整成示意用途。
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-sm bg-paper-200 px-4 py-2 text-xs font-medium text-ink-100">
            ⚠ 以下皆為示意資料，非真實學員成績
          </div>
        </div>
      </section>

      {/* Radar + gain card */}
      <section className="border-t border-ink-700/10 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12">
            <div className="font-display mb-3 text-[15px] italic text-brass-500">01 — 個人分析報告</div>
            <h2 className="font-serif text-3xl font-bold tracking-tight text-ink-700">送出評測，立即看見落點</h2>
          </div>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="card flex flex-col items-center">
              <h3 className="mb-1 text-base font-bold text-ink-700">6 大構面落點雷達圖</h3>
              <p className="mb-4 text-xs text-ink-50">實線為個人分數，虛線為班級平均</p>
              <RadarChart
                dimensions={SHOWCASE_SELF_DIMENSIONS}
                compare={SHOWCASE_COHORT_COMPARE}
                compareLabel="班級平均"
              />
            </div>
            <div className="flex flex-col gap-4">
              <div className="card">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-50">課前 → 課後總分</p>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-2xl font-bold text-ink-700">{SHOWCASE_GAIN.pre}</span>
                  <span className="text-ink-50">→</span>
                  <span className="font-serif text-2xl font-bold text-ink-700">{SHOWCASE_GAIN.post}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-emerald-600">+{SHOWCASE_GAIN.delta} 分成長</p>
              </div>
              <div className="card">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-50">進步最多的構面</p>
                <p className="font-serif text-xl font-bold text-brass-500">{SHOWCASE_GAIN.topDimension}</p>
                <p className="mt-1 text-sm text-ink-100">+{SHOWCASE_GAIN.topDelta} 分</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trend chart */}
      <section className="border-t border-ink-700/10 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12">
            <div className="font-display mb-3 text-[15px] italic text-brass-500">02 — 歷程追蹤</div>
            <h2 className="font-serif text-3xl font-bold tracking-tight text-ink-700">每一次作答都留下軌跡</h2>
          </div>
          <div className="card">
            <h3 className="mb-4 text-base font-bold text-ink-700">歷次總分趨勢</h3>
            <TrendChart points={SHOWCASE_TREND_POINTS} min={SHOWCASE_TREND_RANGE.min} max={SHOWCASE_TREND_RANGE.max} />
          </div>
        </div>
      </section>

      {/* Heatmap */}
      <section className="border-t border-ink-700/10 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12">
            <div className="font-display mb-3 text-[15px] italic text-brass-500">03 — 教練視角</div>
            <h2 className="font-serif text-3xl font-bold tracking-tight text-ink-700">一眼看出全班的弱項</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-100">
              構面 × 成員熱力圖讓教練不必逐一點開每份報告比對，就能定位「這班哪個構面最弱、是被誰拉低的」。
            </p>
          </div>
          <DimensionHeatmap dimensions={SHOWCASE_DIMENSIONS} memberRows={SHOWCASE_MEMBER_ROWS} />
        </div>
      </section>

      <CtaBanner
        loggedIn={loggedIn}
        onEnter={onEnter}
        kicker="Your Turn"
        title="準備好記錄自己的歷程了嗎？"
        desc="登入後即可開始第一次評測，接下來的每一次作答都會被留下來。"
      />

      <MarketingFooter />
    </div>
  );
}
