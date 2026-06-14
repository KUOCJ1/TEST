import { useState } from 'react';
import { Calendar, Mail, Lock, User, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function getPasswordStrength(pwd) {
  if (!pwd || pwd.length < 6) return { level: 0, label: '太短', color: 'bg-red-400' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { level: 1, label: '弱', color: 'bg-red-400' };
  if (score === 2) return { level: 2, label: '中', color: 'bg-yellow-400' };
  return { level: 3, label: '強', color: 'bg-green-500' };
}

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const strength = mode === 'register' && form.password ? getPasswordStrength(form.password) : null;

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (mode === 'register') {
      if (!form.name.trim()) return setError('請輸入姓名');
      if (form.password !== form.confirm) return setError('兩次密碼不一致');
      if (form.password.length < 6) return setError('密碼至少需要 6 個字元');
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form.name.trim(), form.email, form.password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function switchMode(m) {
    setMode(m);
    setForm({ name: '', email: '', password: '', confirm: '' });
    setError('');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4 shadow-lg">
            <Calendar className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">共享行事曆</h1>
          <p className="text-slate-500 text-sm mt-1">與團隊共享你的行程安排</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Tabs */}
          <div role="tablist" aria-label="登入或註冊" className="flex rounded-xl bg-slate-100 p-1 mb-6">
            {['login', 'register'].map(m => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  mode === m
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {m === 'login' ? '登入' : '註冊'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label htmlFor="auth-name" className="block text-sm font-medium text-slate-700 mb-1.5">姓名</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="auth-name"
                    type="text"
                    value={form.name}
                    onChange={e => update('name', e.target.value)}
                    placeholder="你的名字"
                    autoComplete="name"
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="auth-email"
                  type="email"
                  value={form.email}
                  onChange={e => update('email', e.target.value)}
                  placeholder="your@email.com"
                  autoComplete="email"
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-sm font-medium text-slate-700 mb-1.5">密碼</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => update('password', e.target.value)}
                  placeholder={mode === 'register' ? '至少 6 個字元' : '••••••••'}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {strength && (
                <div className="mt-1.5 px-0.5">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                          i < strength.level ? strength.color : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">密碼強度：{strength.label}</p>
                </div>
              )}
            </div>

            {mode === 'register' && (
              <div>
                <label htmlFor="auth-confirm" className="block text-sm font-medium text-slate-700 mb-1.5">確認密碼</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="auth-confirm"
                    type="password"
                    value={form.confirm}
                    onChange={e => update('confirm', e.target.value)}
                    placeholder="再次輸入密碼"
                    autoComplete="new-password"
                    aria-describedby={form.confirm && form.password !== form.confirm ? 'confirm-mismatch' : undefined}
                    className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent ${
                      form.confirm && form.password !== form.confirm
                        ? 'border-red-300 focus:ring-red-400'
                        : 'border-slate-200 focus:ring-indigo-500'
                    }`}
                    required
                  />
                </div>
                {form.confirm && form.password !== form.confirm && (
                  <p id="confirm-mismatch" role="alert" className="text-xs text-red-500 mt-1">密碼不一致</p>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2.5 rounded-xl">
                <AlertCircle size={15} className="shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2.5 rounded-xl transition-colors text-sm mt-2"
            >
              {loading ? '處理中...' : mode === 'login' ? '登入' : '建立帳號'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
