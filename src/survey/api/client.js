const BASE = import.meta.env.VITE_API_BASE || '/api';

async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('無法連線到伺服器，請稍後再試');
  }

  let data = null;
  try { data = await res.json(); } catch { /* no json */ }

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

  assessments: () => request('/assessments').then((d) => d.assessments),
  adminAssessments: () => request('/admin/assessments').then((d) => d.assessments),
  toggleAssessment: (id, enabled) =>
    request(`/admin/assessments/${id}`, { method: 'PATCH', body: { enabled } }).then((d) => d.assessment),

  createSubmission: (payload) =>
    request('/submissions', { method: 'POST', body: payload }).then((d) => d.submission),
  mySubmissions: () => request('/submissions/me').then((d) => d.submissions),

  adminOverview: () => request('/admin/overview'),
  setUserRole: (userId, role) =>
    request(`/admin/users/${userId}/role`, { method: 'PATCH', body: { role } }).then((d) => d.user),

  coachOverview: () => request('/coach/overview'),
  coachGroups: () => request('/coach/groups').then((d) => d.groups),
  createGroup: (payload) => request('/coach/groups', { method: 'POST', body: payload }).then((d) => d.group),
  getGroup: (id) => request(`/coach/groups/${id}`),
  updateGroup: (id, payload) => request(`/coach/groups/${id}`, { method: 'PUT', body: payload }).then((d) => d.group),
  deleteGroup: (id) => request(`/coach/groups/${id}`, { method: 'DELETE' }),

  upsertComment: (submissionId, payload) =>
    request(`/submissions/${submissionId}/comment`, { method: 'POST', body: payload }).then((d) => d.comment),
  deleteComment: (submissionId, commentId) =>
    request(`/submissions/${submissionId}/comment/${commentId}`, { method: 'DELETE' }),

  myGroups: () => request('/groups/mine').then((d) => d.groups),
};
