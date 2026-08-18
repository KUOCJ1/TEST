import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/useAuth';

function Card({ title, desc, children }) {
  return (
    <section className="card">
      <h3 className="text-base font-bold text-slate-700">{title}</h3>
      {desc && <p className="mt-0.5 text-sm text-slate-500">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 flex-shrink-0 rounded-full transition-colors ${checked ? 'bg-brass-500' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </label>
  );
}

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const prefs = user.preferences ?? {};

  const [name, setName] = useState(user.name);
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState('');

  const [assessments, setAssessments] = useState([]);
  const [savingPref, setSavingPref] = useState(false);
  const [prefMsg, setPrefMsg] = useState('');

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    api.assessments().then(setAssessments).catch(() => {});
  }, []);

  const saveName = async () => {
    if (!name.trim()) { setNameMsg('姓名不可為空'); return; }
    setSavingName(true);
    setNameMsg('');
    try {
      await updateProfile({ name: name.trim() });
      setNameMsg('✓ 已儲存');
      setTimeout(() => setNameMsg(''), 2500);
    } catch (e) {
      setNameMsg(e.message || '儲存失敗');
    } finally {
      setSavingName(false);
    }
  };

  const savePref = async (patch) => {
    setSavingPref(true);
    setPrefMsg('');
    try {
      await updateProfile({ preferences: { ...prefs, ...patch } });
      setPrefMsg('✓ 偏好已更新');
      setTimeout(() => setPrefMsg(''), 2000);
    } catch (e) {
      setPrefMsg(e.message || '儲存失敗');
    } finally {
      setSavingPref(false);
    }
  };

  const changePassword = async () => {
    if (pw.next.length < 8) { setPwMsg({ type: 'err', text: '新密碼至少需 8 碼' }); return; }
    if (pw.next !== pw.confirm) { setPwMsg({ type: 'err', text: '兩次輸入的新密碼不一致' }); return; }
    setSavingPw(true);
    setPwMsg({ type: '', text: '' });
    try {
      await api.changePassword({ currentPassword: pw.current, newPassword: pw.next });
      setPwMsg({ type: 'ok', text: '✓ 密碼已變更' });
      setPw({ current: '', next: '', confirm: '' });
    } catch (e) {
      setPwMsg({ type: 'err', text: e.message || '變更失敗' });
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-8 sm:px-6">
      <header className="mb-1">
        <h2 className="text-2xl font-extrabold text-slate-800">個人設定</h2>
        <p className="mt-1 text-sm text-slate-500">管理您的個人資料、密碼與偏好。</p>
      </header>

      <Card title="基本資料">
        <label className="block text-sm font-medium text-slate-600">姓名</label>
        <div className="mt-1.5 flex gap-2">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="button" onClick={saveName} disabled={savingName}
            className="btn-primary">
            {savingName ? '儲存中…' : '儲存'}
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-400">Email：{user.email}（不可變更）</p>
        {nameMsg && <p className="mt-1 text-sm text-brass-600">{nameMsg}</p>}
      </Card>

      <Card title="介面偏好">
        <Toggle
          label="深色模式"
          hint="切換深色佈景主題"
          checked={Boolean(prefs.darkMode)}
          onChange={(v) => savePref({ darkMode: v })}
        />
        <div className="mt-3">
          <label className="block text-sm font-medium text-slate-600">預設進入的評量</label>
          <select
            className="input mt-1.5"
            value={prefs.defaultAssessmentId ?? ''}
            onChange={(e) => savePref({ defaultAssessmentId: e.target.value || null })}
          >
            <option value="">不指定（顯示評量列表）</option>
            {assessments.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        {prefMsg && <p className="mt-2 text-sm text-brass-600">{prefMsg}</p>}
        {savingPref && <p className="mt-2 text-sm text-slate-400">儲存中…</p>}
      </Card>

      <Card title="通知偏好" desc="設定您希望接收的通知（實際發送需搭配通知管道）。">
        <Toggle
          label="評測提醒"
          hint="有新評量或尚未完成時提醒我"
          checked={prefs.notifyAssessment !== false}
          onChange={(v) => savePref({ notifyAssessment: v })}
        />
        <Toggle
          label="教練評語通知"
          hint="教練留下新評語時通知我"
          checked={prefs.notifyComment !== false}
          onChange={(v) => savePref({ notifyComment: v })}
        />
      </Card>

      <Card title="變更密碼">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-600">目前密碼</label>
            <input type="password" className="input mt-1.5" autoComplete="current-password"
              value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600">新密碼</label>
            <input type="password" className="input mt-1.5" autoComplete="new-password" placeholder="至少 8 碼"
              value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600">確認新密碼</label>
            <input type="password" className="input mt-1.5" autoComplete="new-password"
              value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />
          </div>
          {pwMsg.text && (
            <p className={`text-sm ${pwMsg.type === 'err' ? 'text-red-500' : 'text-brass-600'}`}>{pwMsg.text}</p>
          )}
          <button type="button" onClick={changePassword} disabled={savingPw}
            className="btn-primary">
            {savingPw ? '處理中…' : '變更密碼'}
          </button>
        </div>
      </Card>
    </main>
  );
}
