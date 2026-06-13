import { useEffect, useState } from 'react';
import { api } from '../api/client';
import ResultPanel from '../components/ResultPanel';
import TrendChart from '../components/charts/TrendChart';
import { resultSummaryText, copyToClipboard, formatDate, formatDateShort } from '../utils/format';

export default function UserDashboard({ user, onTakeSurvey }) {
  const [subs, setSubs] = useState(null); // null = 載入中
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .mySubmissions()
      .then((list) => active && setSubs(list))
      .catch((e) => active && (setError(e.message || '載入失敗'), setSubs([])));
    return () => {
      active = false;
    };
  }, []);

  if (subs === null && !error) {
    return <p className="py-20 text-center text-slate-400">載入中…</p>;
  }

  if (subs && subs.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-2xl bg-white px-6 py-12 shadow-lg shadow-slate-200/60">
          <p className="text-5xl">📊</p>
          <h2 className="mt-4 text-xl font-bold text-slate-800">尚無評測紀錄</h2>
          <p className="mt-2 text-slate-500">完成一次評測後，這裡就會顯示您的能力落點與構面分析。</p>
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          <button
            type="button"
            onClick={onTakeSurvey}
            className="mt-6 rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-2.5 font-bold text-white shadow-md transition-all hover:from-teal-600 hover:to-teal-700"
          >
            立即開始評測
          </button>
        </div>
      </div>
    );
  }

  const latest = subs[0];
  const handleCopy = async () => {
    const ok = await copyToClipboard(resultSummaryText(latest.result));
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2500);
  };

  // 趨勢圖需由舊到新。
  const trendPoints = [...subs]
    .reverse()
    .map((s) => ({ label: formatDateShort(s.createdAt), value: s.result.total }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-5">
        <h2 className="text-2xl font-extrabold text-slate-800">我的能力分析</h2>
        <p className="mt-1 text-sm text-slate-500">
          {user.name}，您共完成 {subs.length} 次評測，最近一次於 {formatDate(latest.createdAt)}。
        </p>
      </header>

      <ResultPanel result={latest.result} onRetake={onTakeSurvey} onCopy={handleCopy} copied={copied} />

      {subs.length > 1 && (
        <section className="mt-6 rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7">
          <h3 className="mb-3 text-base font-bold text-slate-700">歷次總分趨勢</h3>
          <TrendChart points={trendPoints} />
        </section>
      )}

      <section className="mt-6 rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60 sm:px-7">
        <h3 className="mb-3 text-base font-bold text-slate-700">作答紀錄</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-medium">時間</th>
                <th className="py-2 pr-3 font-medium">總分</th>
                <th className="py-2 pr-3 font-medium">達成率</th>
                <th className="py-2 font-medium">落點等級</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-3 text-slate-600">{formatDate(s.createdAt)}</td>
                  <td className="py-2.5 pr-3 font-semibold text-slate-700">{s.result.total}</td>
                  <td className="py-2.5 pr-3 text-slate-600">{s.result.percent}%</td>
                  <td className="py-2.5">
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                      style={{ background: s.result.level.color }}
                    >
                      {s.result.level.badge}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
