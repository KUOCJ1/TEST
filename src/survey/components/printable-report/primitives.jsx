// ─── Primitive components reused by every 分頁 ──────────
import { TONE_COLOR } from './tokens.js';

export function HBar({ userPct, benchPct, color, height = 12 }) {
  return (
    <div style={{ position: 'relative', height, borderRadius: height, overflow: 'hidden', background: '#f1f5f9' }}>
      <div style={{ width: `${Math.min(100, userPct ?? 0)}%`, background: color, height: '100%', borderRadius: height }} />
      {benchPct != null && (
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.min(100, benchPct)}%`, width: 2, background: '#334155', opacity: 0.45 }} />
      )}
    </div>
  );
}

export function RatingPill({ label, tone, size = 10 }) {
  return (
    <span style={{
      display: 'inline-block', padding: `2px ${size * 0.85}px`,
      borderRadius: 20, fontSize: size, fontWeight: 700, color: '#fff',
      background: TONE_COLOR[tone] ?? '#64748b',
    }}>
      {label}
    </span>
  );
}

export function PageMeta({ name, section, date, assessmentName }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      fontSize: 9, color: '#64748b', letterSpacing: '0.04em',
      borderBottom: '0.5px solid #e2e8f0', paddingBottom: 7, marginBottom: 18,
    }}>
      <span style={{ fontWeight: 600 }}>
        {name}{assessmentName ? ` · ${assessmentName}` : ''} · 個人評測報告
      </span>
      <span>{section} · {date}</span>
    </div>
  );
}

export function PageFooter({ label = '本報告屬機密文件，僅限受測者及授權主管閱覽' }) {
  return (
    <div style={{
      borderTop: '0.5px solid #e2e8f0', marginTop: 20, paddingTop: 7,
      fontSize: 9, color: '#64748b', letterSpacing: '0.03em', textAlign: 'center',
    }}>
      {label}
    </div>
  );
}

export function SectionTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>{children}</div>
      {sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}
