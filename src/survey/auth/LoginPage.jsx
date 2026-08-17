import { useState } from 'react';
import { useAuth } from './useAuth';
import JoinClassBanner from '../components/JoinClassBanner';

function readUrlParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    fromAI: p.get('register') === '1' || p.get('from') === 'ai',
    name: p.get('name') ?? '',
    email: p.get('email') ?? '',
  };
}

export default function LoginPage({ onBack, joinCode, joinInfo }) {
  const { login, register } = useAuth();
  const [{ fromAI, name: prefillName, email: prefillEmail }] = useState(readUrlParams);
  const [mode, setMode] = useState(fromAI || joinCode ? 'register' : 'login');
  const [form, setForm] = useState({ name: prefillName, email: prefillEmail, password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // 登入/註冊成功後要導去哪一頁，統一交給 App.jsx 的 effect 處理（它會等網址真的
  // 換到目標評量頁之後才掛載 AppShell），這裡不自己 navigate——否則會跟 AppShell
  // 自己的預設路由（對尚未换成目標路徑的網址做重導）互相搶跑，導致頁面被搶先導去
  // /home。
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'register') await register(joinCode ? { ...form, joinCode } : form);
      else await login(joinCode ? { email: form.email, password: form.password, joinCode } : { email: form.email, password: form.password });
    } catch (err) {
      setError(err.message || '發生錯誤，請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {onBack && (
          <button
            onClick={onBack}
            className="mb-4 flex items-center gap-1 text-sm text-slate-400 hover:text-brand-600 transition-colors"
          >
            ← 返回首頁
          </button>
        )}
        <header className="mb-7 text-center">
          <img
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt=""
            className="mx-auto mb-4 h-14 w-14 drop-shadow-[0_6px_16px_rgba(124,58,237,.35)]"
          />
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">
            全方位職能評測
          </h1>
          <p className="mt-2 text-sm text-slate-500">登入後即可作答並查看您的專屬能力分析</p>
        </header>

        {joinCode ? (
          <JoinClassBanner info={joinInfo} />
        ) : (
          fromAI && (
            <div className="mb-5 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 px-5 py-4 text-white shadow-lg shadow-brand-500/25">
              <div className="text-sm font-bold mb-1">👋 歡迎來自 AI 轉型評估！</div>
              <div className="text-xs opacity-80 leading-relaxed">
                建立免費帳號，立即開始 AI 職能評測，取得個人化能力分析報告。
              </div>
            </div>
          )
        )}

        <div className="rounded-3xl bg-white px-6 py-7 shadow-card ring-1 ring-slate-100">
          <div role="tablist" aria-label="登入或註冊" className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
            {[
              ['login', '登入'],
              ['register', '註冊'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                onClick={() => { setMode(key); setError(''); }}
                className={`rounded-md py-2 transition-colors ${
                  mode === key ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <Field label="姓名">
                <input
                  type="text"
                  value={form.name}
                  onChange={update('name')}
                  autoComplete="name"
                  className="input"
                  placeholder="您的姓名"
                />
              </Field>
            )}
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={update('email')}
                autoComplete="email"
                className="input"
                placeholder="you@example.com"
              />
            </Field>
            <Field label="密碼" hint={mode === 'register' ? '至少 8 碼' : undefined}>
              <input
                type="password"
                value={form.password}
                onChange={update('password')}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                className="input"
                placeholder="至少 8 碼"
              />
            </Field>

            {error && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                {error}
              </p>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full py-3 text-base">
              {busy ? '處理中…' : mode === 'register' ? '建立帳號並開始' : '登入帳號'}
            </button>
          </form>

          <p className="mt-5 rounded-xl bg-slate-50 px-3 py-2.5 text-center text-xs leading-relaxed text-slate-400">
            第一次使用請先「註冊」建立帳號。
            <br />
            忘記密碼？請聯絡您的教練或管理員協助重設。
          </p>
        </div>
      </div>
    </main>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}
