// 後端 API 用戶端。同源部署時走相對路徑 /api（由 Nginx 反向代理到 Node 服務）；
// 本機開發可透過 VITE_API_BASE 覆寫，或由 Vite dev proxy 轉發。

const BASE = import.meta.env.VITE_API_BASE || '/api';

async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include', // 攜帶 httpOnly 認證 cookie
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('無法連線到伺服器，請稍後再試');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* 無 JSON 內容 */
  }

  if (!res.ok) {
    const err = new Error(data?.error || `請求失敗（${res.status}）`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }).then((d) => d.user),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }).then((d) => d.user),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me').then((d) => d.user),
  createSubmission: (payload) =>
    request('/submissions', { method: 'POST', body: payload }).then((d) => d.submission),
  mySubmissions: () => request('/submissions/me').then((d) => d.submissions),
  adminOverview: () => request('/admin/overview'),
};
