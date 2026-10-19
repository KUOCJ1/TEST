import { useState } from 'react';
import { useAuth } from './useAuth';
import JoinClassBanner from '../components/JoinClassBanner';
import InviteBanner from '../components/InviteBanner';
import { extractInviteCode } from '../utils/inviteCode';
import { formatDate } from '../utils/format';

function readUrlParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    fromAI: p.get('register') === '1' || p.get('from') === 'ai',
    name: p.get('name') ?? '',
    email: p.get('email') ?? '',
  };
}

export default function LoginPage({ onBack, joinCode, joinInfo, inviteCode, inviteInfo, onInviteResult }) {
  const { login, register } = useAuth();
  const [{ fromAI, name: prefillName, email: prefillEmail }] = useState(readUrlParams);
  // 邀請連結（Sprint 19）：邀請有效時 Email 與姓名由邀請帶入（Email 鎖定，伺服器也會強制）；
  // 邀請失效時照一般登入／註冊處理，只多一則說明。inviteInfo 為 null 表示還在查詢。
  const inviteOk = Boolean(inviteCode && inviteInfo && !inviteInfo.error);
  const lockedEmail = inviteOk ? inviteInfo.email : null;
  const [modeOverride, setModeOverride] = useState(null);
  const defaultMode = inviteOk ? (inviteInfo.accountExists ? 'login' : 'register') : (fromAI || joinCode ? 'register' : 'login');
  const mode = modeOverride ?? defaultMode;
  const setMode = setModeOverride;
  const [form, setForm] = useState({ name: prefillName || undefined, email: prefillEmail, password: '' });
  const nameValue = form.name ?? (inviteOk ? inviteInfo.name : '') ?? '';
  const emailValue = lockedEmail ?? form.email;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // 登入/註冊成功後要導去哪一頁，統一交給 App.jsx 的 effect 處理（它會等網址真的
  // 換到目標評量頁之後才掛載 AppShell），這裡不自己 navigate——否則會跟 AppShell
  // 自己的預設路由（對尚未换成目標路徑的網址做重導）互相搶跑，導致頁面被搶先導去
  // /home。
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    // 註冊一定要同意隱私權政策與服務條款（伺服器端也會擋；這裡先講清楚原因）。
    if (mode === 'register' && !agreed) {
      setError('請先勾選「我已閱讀並同意隱私權政策與服務條款」');
      return;
    }
    setBusy(true);
    try {
      const base = { name: nameValue, email: emailValue, password: form.password };
      let result;
      if (mode === 'register') result = await register({ ...base, acceptPolicy: true, ...(joinCode ? { joinCode } : {}), ...(inviteOk ? { inviteCode } : {}) });
      else result = await login({ email: base.email, password: base.password, ...(joinCode ? { joinCode } : {}), ...(inviteOk ? { inviteCode } : {}) });
      // 把邀請的結果交給 App 導頁（或顯示邀請有問題的原因）；登入／註冊成功後這個畫面會被換掉。
      if (inviteOk) onInviteResult?.({ joinedGroup: result?.joinedGroup ?? null, inviteError: result?.inviteError ?? null });
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
            className="mb-4 flex items-center gap-1 text-sm text-ink-50 hover:text-ink-700 transition-colors"
          >
            ← 返回首頁
          </button>
        )}
        <header className="mb-7 text-center">
          <img
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt=""
            className="mx-auto mb-4 h-14 w-14"
          />
          <h1 className="font-serif text-2xl font-bold tracking-tight text-ink-700 sm:text-3xl">
            全方位職能評測
          </h1>
          <p className="mt-2 text-sm text-ink-100">登入後即可作答並查看您的專屬能力分析</p>
        </header>

        {inviteCode ? (
          <InviteBanner info={inviteInfo} />
        ) : joinCode ? (
          <JoinClassBanner info={joinInfo} />
        ) : (
          fromAI && (
            <div className="mb-5 rounded-md bg-ink-700 px-5 py-4 text-paper-50">
              <div className="font-serif text-sm font-semibold mb-1">歡迎來自 AI 轉型評估</div>
              <div className="text-xs text-paper-50/75 leading-relaxed">
                建立免費帳號，立即開始 AI 職能評測，取得個人化能力分析報告。
              </div>
            </div>
          )
        )}

        <div className="rounded-md bg-paper-50 px-6 py-7 shadow-card ring-1 ring-paper-300">
          <div role="tablist" aria-label="登入或註冊" className="mb-6 grid grid-cols-2 gap-1 rounded-sm bg-paper-200 p-1 text-sm font-semibold">
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
                className={`rounded-sm py-2 transition-colors ${
                  mode === key ? 'bg-paper-50 text-ink-700 shadow-sm' : 'text-ink-100 hover:text-ink-400'
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
                  value={nameValue}
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
                value={emailValue}
                onChange={update('email')}
                autoComplete="email"
                readOnly={Boolean(lockedEmail)}
                aria-readonly={Boolean(lockedEmail) || undefined}
                className={`input ${lockedEmail ? 'cursor-not-allowed bg-paper-200 text-ink-100' : ''}`}
                placeholder="you@example.com"
              />
              {lockedEmail && <span className="mt-1 block text-xs text-slate-400">這是教練邀請你的 Email，無法修改。</span>}
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

            {mode === 'register' && (
              <label className="flex items-start gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-ink-700"
                />
                <span>
                  我已閱讀並同意
                  <a href={`${import.meta.env.BASE_URL}privacy`} target="_blank" rel="noopener noreferrer" className="mx-0.5 font-semibold text-ink-700 underline underline-offset-2">隱私權政策</a>
                  與
                  <a href={`${import.meta.env.BASE_URL}terms`} target="_blank" rel="noopener noreferrer" className="mx-0.5 font-semibold text-ink-700 underline underline-offset-2">服務條款</a>
                </span>
              </label>
            )}

            {error && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                {error}
              </p>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full py-3 text-base">
              {busy ? '處理中…' : mode === 'register' ? (inviteOk ? '完成註冊並加入班級' : '建立帳號並開始') : (inviteOk ? '登入並加入班級' : '登入帳號')}
            </button>
          </form>

          <p className="mt-5 rounded-sm bg-paper-200 px-3 py-2.5 text-center text-xs leading-relaxed text-ink-100">
            {inviteOk
              ? (inviteInfo.accountExists
                ? '這個 Email 已經有帳號，請登入，登入後會自動加入班級。'
                : `邀請有效至 ${formatDate(inviteInfo.expiresAt)}。設定密碼並同意條款後，會自動加入班級。`)
              : '第一次使用請先「註冊」建立帳號。'}
            <br />
            忘記密碼？請聯絡您的教練或管理員協助重設。
          </p>
          {!inviteCode && <InviteCodeEntry />}
        </div>
      </div>
    </main>
  );
}

/** 沒有邀請連結、只拿到邀請碼的人：輸入後帶著碼重新載入頁面（走和點連結一樣的流程）。 */
function InviteCodeEntry() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const go = (e) => {
    e.preventDefault();
    const code = extractInviteCode(value);
    if (code) window.location.assign(`${import.meta.env.BASE_URL}?invite=${encodeURIComponent(code)}`);
  };
  if (!open) {
    return (
      <p className="mt-3 text-center text-xs">
        <button type="button" onClick={() => setOpen(true)} className="font-semibold text-ink-700 underline underline-offset-2">有教練給的邀請碼？</button>
      </p>
    );
  }
  return (
    <form onSubmit={go} className="mt-3 flex gap-2">
      <label className="sr-only" htmlFor="login-invite-code">邀請碼</label>
      <input id="login-invite-code" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" className="input min-w-0 flex-1" placeholder="輸入邀請碼" />
      <button type="submit" className="btn-primary btn-sm">前往</button>
    </form>
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
