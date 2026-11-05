import { useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { api } from '../api/client';
import FollowUpSurvey from './FollowUpSurvey.jsx';

// 學員首頁的「追蹤問卷」提示：課後問卷同意收追蹤信、且 30／60 天到了還沒填的人才會看到。
// 信裡的連結是 ?followup=30|60，登入後自動展開對應的那一份。沒有這個功能的資料時什麼都不顯示。
const readStageParam = () => {
  const v = Number(new URLSearchParams(window.location.search).get('followup'));
  return v === 30 || v === 60 ? v : null;
};

export default function FollowUpBanner() {
  const [items, setItems] = useState([]);
  const [picked, setPicked] = useState(null); // 學員自己按了哪一份
  const [dismissed, setDismissed] = useState(false); // 信裡連結自動展開的那份，關掉後不再自動展開
  const [wanted] = useState(readStageParam);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => api.getMyFollowUps())
      .then((d) => { if (active) setItems(d?.items ?? []); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const available = items.filter((i) => i.status === 'available');
  const openStage = picked ?? (!dismissed && wanted && available.some((i) => i.stage === wanted) ? wanted : null);
  const close = () => { setPicked(null); setDismissed(true); };

  if (openStage) {
    return (
      <FollowUpSurvey
        stage={openStage}
        onClose={close}
        onDone={() => setItems((prev) => prev.map((i) => (i.stage === openStage ? { ...i, status: 'completed' } : i)))}
      />
    );
  }
  if (available.length === 0) return null;
  const next = available[0];
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brass-200 bg-brass-50/60 px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <ClipboardCheck className="h-4 w-4 text-brass-600" aria-hidden="true" />
        AI 深度整合工作坊的 {next.stage} 天追蹤問卷已開放，約 5 分鐘。
      </p>
      <button type="button" onClick={() => setPicked(next.stage)} className="btn-primary btn-sm">現在填寫</button>
    </div>
  );
}
