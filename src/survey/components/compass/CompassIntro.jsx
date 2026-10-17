import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FRAMEWORK_PATH, TAGLINE, LOOP_INTRO } from '../../data/assessments/compass-framework.js';

const SEEN_KEY = 'compass_intro_seen_v1';
const read = () => { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; } };
const write = () => { try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* 沒有儲存空間也沒關係，下次會再展開 */ } };

/**
 * 作答前的「先認識這份評測」導讀：第一次進來預設展開，看過之後預設收起。
 * 內容刻意簡短（約一個螢幕），完整說明在 /framework。
 */
export default function CompassIntro({ rater = 'self' }) {
  const [open, setOpen] = useState(() => !read());
  return (
    <details
      open={open}
      onToggle={(e) => { setOpen(e.currentTarget.open); if (!e.currentTarget.open) write(); }}
      className="mt-5 rounded-xl border border-brass-200 bg-brass-50 px-4 py-3 text-sm leading-relaxed text-ink-700"
    >
      <summary className="cursor-pointer font-semibold text-brass-600">先認識這份評測（約 1 分鐘）</summary>
      <div className="mt-3 space-y-3">
        <p className="font-semibold">{TAGLINE}</p>
        <ul className="space-y-1">
          {Object.values(LOOP_INTRO).map((l) => (
            <li key={l.id}><strong>{l.name}（{l.slogan}）</strong>：{l.steps.join('、')}</li>
          ))}
        </ul>
        <ul className="list-disc space-y-1 pl-5">
          <li>題目問的是行為「多常出現」，不是能力高低，沒有標準答案。</li>
          <li>報告沒有總分與排名，會呈現兩個環、八個構面與四組「張力」（兩端都有價值、需要取捨的行為）。</li>
          {rater === 'other'
            ? <li>您是以評分者的身分作答：請依您實際觀察到的情況回答，看不到時選「無法判斷」。</li>
            : <li>作答約 10–20 分鐘，進度自動儲存，可以分段完成。</li>}
        </ul>
        <p>
          <Link to={FRAMEWORK_PATH} target="_blank" rel="noreferrer" className="font-semibold text-brass-600 underline">看完整的框架說明</Link>
          （會在新分頁開啟）
        </p>
      </div>
    </details>
  );
}
