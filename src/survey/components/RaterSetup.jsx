import { useEffect, useState } from 'react';
import { api } from '../api/client';

const RATER_TYPES = [
  { id: 'self', label: '自評', desc: '評估自己的表現' },
  { id: 'manager', label: '主管評', desc: '我是對方的直屬主管' },
  { id: 'peer', label: '同儕評', desc: '我與對方是同等職級的同事' },
  { id: 'subordinate', label: '部屬評', desc: '我是對方的下屬' },
];

export default function RaterSetup({ user, onConfirm, onCancel }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rateeId, setRateeId] = useState(user.id);
  const [raterType, setRaterType] = useState('self');
  const [confirmError, setConfirmError] = useState('');

  useEffect(() => {
    api.groupMembers()
      .then(setMembers)
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, []);

  const isSelf = rateeId === user.id;
  const availableTypes = isSelf ? RATER_TYPES.filter((t) => t.id === 'self') : RATER_TYPES.filter((t) => t.id !== 'self');

  const handleRateeChange = (id) => {
    setRateeId(id);
    setRaterType(id === user.id ? 'self' : '');
    setConfirmError('');
  };

  const handleConfirm = () => {
    if (!isSelf && !raterType) {
      setConfirmError('請先選擇「你與對方的關係」');
      return;
    }
    const finalRaterType = isSelf ? 'self' : raterType;
    const rateeName = isSelf ? user.name : (members.find((m) => m.id === rateeId)?.name ?? '');
    onConfirm(rateeId, finalRaterType, rateeName);
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <header className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl shadow-lg shadow-brand-500/30">
            360°
          </div>
          <h1 className="text-xl font-extrabold text-slate-800">360° 多元評測</h1>
          <p className="mt-1 text-sm text-slate-500">請先選擇「你在評誰」及「你的角色」</p>
        </header>

        <div className="rounded-3xl bg-white px-6 py-7 shadow-card ring-1 ring-slate-100 space-y-6">

          {/* Who are you rating */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">你在評誰？</label>
            <div className="space-y-2">
              {/* Self option */}
              <button
                type="button"
                aria-pressed={isSelf}
                onClick={() => handleRateeChange(user.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                  isSelf
                    ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${isSelf ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  我
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{user.name}（自己）</p>
                  <p className="text-xs text-slate-400">評估自己的行為表現</p>
                </div>
              </button>

              {/* Group members */}
              {loading && (
                <p className="py-2 text-center text-sm text-slate-400">載入同組成員…</p>
              )}
              {!loading && members.length === 0 && (
                <p className="rounded-lg bg-slate-50 px-4 py-3 text-center text-sm text-slate-400">
                  目前尚未加入任何班別，只能進行自評。
                </p>
              )}
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={rateeId === m.id}
                  onClick={() => handleRateeChange(m.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                    rateeId === m.id
                      ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${rateeId === m.id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {m.name.charAt(0)}
                  </div>
                  <p className="font-semibold text-slate-800">{m.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Rater type */}
          {!isSelf && (
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">你與對方的關係？</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {availableTypes.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={raterType === t.id}
                    onClick={() => { setRaterType(t.id); setConfirmError(''); }}
                    className={`rounded-xl border px-3 py-2.5 text-center text-sm transition-colors ${
                      raterType === t.id
                        ? 'border-brand-500 bg-brand-50 font-semibold text-brand-700 ring-1 ring-brand-300'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <p className="font-semibold">{t.label}</p>
                    <p className="mt-0.5 text-xs text-slate-400 leading-tight">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isSelf && (
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
              選擇自評時，評測對象為您自己，評測者角色固定為「自評」。
            </div>
          )}

          {confirmError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
              {confirmError}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleConfirm}
              className="btn-primary flex-1 py-3 text-base"
            >
              開始評測
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="btn-secondary px-5 py-3 text-sm"
              >
                取消
              </button>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          同儕評與部屬評的回饋將以匿名方式呈現給被評者
        </p>
      </div>
    </main>
  );
}
