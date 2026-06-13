import { useState } from 'react';
import { useAuth } from './useAuth';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'register') await register(form);
      else await login({ email: form.email, password: form.password });
    } catch (err) {
      setError(err.message || '發生錯誤，請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold text-slate-800 sm:text-3xl">
            AI 全方位職能實戰課前評測
          </h1>
          <p className="mt-2 text-sm text-slate-400">登入後即可作答並查看您的專屬能力分析</p>
        </header>

        <div className="rounded-2xl bg-white px-6 py-7 shadow-lg shadow-slate-200/60">
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-semibold">
            {[
              ['login', '登入'],
              ['register', '註冊'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setMode(key);
                  setError('');
                }}
                className={`rounded-md py-2 transition-colors ${
                  mode === key ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
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
            <Field label="密碼">
              <input
                type="password"
                value={form.password}
                onChange={update('password')}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                className="input"
                placeholder="至少 6 碼"
              />
            </Field>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 px-4 py-2.5 font-bold text-white shadow-md transition-all hover:from-teal-600 hover:to-teal-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? '處理中…' : mode === 'register' ? '建立帳號並開始' : '登入帳號'}
            </button>
          </form>

          <p className="mt-5 rounded-lg bg-slate-50 px-3 py-2.5 text-center text-xs leading-relaxed text-slate-400">
            管理員帳號預設為 <span className="font-mono text-slate-500">admin@demo.tw</span>
            <br />
            （密碼由後端部署時的 ADMIN_PASSWORD 環境變數設定）
          </p>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
