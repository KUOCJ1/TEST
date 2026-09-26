import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { api } from '../api/client';
import { FRONTEND_BUILD, isVersionMismatch } from '../utils/buildInfo';
import { formatDate } from '../utils/format';
import LoadingState from '../components/LoadingState';

const TONE = {
  ok: { Icon: CheckCircle2, cls: 'text-emerald-600' },
  warn: { Icon: AlertTriangle, cls: 'text-amber-600' },
  bad: { Icon: XCircle, cls: 'text-red-600' },
};

function Row({ tone, label, children }) {
  const { Icon, cls } = TONE[tone];
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-0">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cls}`} aria-label={tone === 'ok' ? '正常' : tone === 'warn' ? '注意' : '異常'} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <div className="mt-0.5 text-sm text-slate-500">{children}</div>
      </div>
    </div>
  );
}

function versionText(v) {
  if (!v?.commit) return '開發版（沒有版本資訊）';
  return `${v.commit}${v.builtAt ? `（建置於 ${formatDate(v.builtAt)}）` : ''}`;
}

/**
 * 管理後台「系統狀態」（Sprint 7 驗收條件 7.1、7.3）：部署後一頁確認新版上去了沒、
 * 外部依賴與寄信設定是否正常，以及用「伺服器看到的你的 IP」驗證 TRUST_PROXY。
 */
export default function SystemStatusTab() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(() => api.adminSystemStatus()
    .then((data) => { setStatus({ ...data, fetchedAt: Date.now() }); setError(''); })
    .catch((e) => setError(e.message || '載入失敗'))
    .finally(() => setLoading(false)), []);
  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  const load = () => { setLoading(true); fetchStatus(); };

  if (loading && !status) return <LoadingState />;

  return (
    <section className="rounded-2xl bg-white px-5 py-6 shadow-lg shadow-slate-200/60">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-slate-700">系統狀態</h3>
        <button type="button" onClick={load} disabled={loading} className="btn-secondary btn-sm">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> 重新檢查
        </button>
      </div>
      {error && <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {status && <StatusRows status={status} />}
    </section>
  );
}

function StatusRows({ status }) {
  const { version, deps, mail, healthWatch, connection, fetchedAt } = status;
  const mismatch = isVersionMismatch(FRONTEND_BUILD, version);
  const intervalMs = healthWatch.intervalMinutes * 60 * 1000;
  // 排程每 N 分鐘跑一次；超過三個間隔都沒有新紀錄，大概是排程沒在跑。
  const watchStale = healthWatch.intervalMinutes > 0 && (!healthWatch.lastCheckedAt
    || fetchedAt - new Date(healthWatch.lastCheckedAt).getTime() > intervalMs * 3);

  return (
    <div>
      <Row tone={mismatch ? 'bad' : FRONTEND_BUILD.commit && version.commit ? 'ok' : 'warn'} label="版本">
        <p>前端：{versionText(FRONTEND_BUILD)}</p>
        <p>後端：{versionText(version)}</p>
        {mismatch && (
          <p className="mt-1 text-red-600">
            前後端版本不一致：可能只更新了其中一邊，或瀏覽器還在用舊的快取頁面——先重新整理頁面，仍不一致請重新執行部署。
          </p>
        )}
      </Row>

      <Row tone={deps.secondBrain.ok ? 'ok' : 'bad'} label="第二大腦 API（延伸閱讀）">
        {deps.secondBrain.ok
          ? `連線正常（${deps.secondBrain.baseUrl}）`
          : `無法連線（${deps.secondBrain.baseUrl}）：${deps.secondBrain.error ?? `HTTP ${deps.secondBrain.status}`}。學員報告頁的延伸閱讀會暫時顯示空狀態。`}
      </Row>

      <Row tone={deps.openRouter.configured ? 'ok' : 'warn'} label="OpenRouter（AI 小幫手）">
        {deps.openRouter.configured ? '已設定 API 金鑰' : '未設定 OPENROUTER_API_KEY，AI 小幫手目前停用。'}
      </Row>

      <Row tone={mail.configured ? 'ok' : 'warn'} label="寄信服務（SMTP）">
        {mail.configured
          ? '已設定。可在教練後台對施測中的班級寄一次提醒信，確認收件人真的收得到（也看一下垃圾信匣）。'
          : '未設定 SMTP_HOST／SMTP_USER／SMTP_PASS：異常告警信與教練「寄送提醒信」目前停用，其他功能不受影響。'}
      </Row>

      <Row tone={healthWatch.intervalMinutes === 0 ? 'warn' : watchStale ? 'warn' : 'ok'} label="異常告警排程">
        {healthWatch.intervalMinutes === 0
          ? '已關閉（HEALTH_CHECK_INTERVAL_MINUTES=0）。'
          : <>
              每 {healthWatch.intervalMinutes} 分鐘檢查一次；最後一次：
              {healthWatch.lastCheckedAt ? formatDate(healthWatch.lastCheckedAt) : '尚未執行'}。
              {watchStale && ' 已經超過三個檢查間隔沒有新紀錄，排程可能沒有在跑——請檢查服務是否正常重啟。'}
            </>}
      </Row>

      <Row tone={connection.ipLooksInternal ? 'warn' : 'ok'} label="連線診斷：伺服器看到的你的 IP">
        <p className="font-mono text-slate-700">{connection.ip}</p>
        {connection.ipLooksInternal ? (
          <p className="mt-1 text-amber-700">
            這是本機或內網位址。如果你現在是從外部網路連進來的，代表 TRUST_PROXY 設太低——
            伺服器把反向代理自己的位址當成了使用者 IP，註冊／登入的流量限制會變成全站共用一份額度。
          </p>
        ) : (
          <p className="mt-1">
            請和 whatismyip 之類網站顯示的 IP 比對，兩者一致就代表 TRUST_PROXY 設定正確。
          </p>
        )}
        <p className="mt-1 text-xs text-slate-400">
          TRUST_PROXY = {String(connection.trustProxy)}{' · '}X-Forwarded-For：{connection.forwardedFor ?? '（無）'}
        </p>
      </Row>
    </div>
  );
}
