import { readJSON, writeJSON, uid } from '../utils/storage';

// 每筆評測作答紀錄：{ id, userId, userName, createdAt, answers, result }
// result 為 buildResult() 的輸出（含總分、落點等級、各構面分數），可直接餵給 ResultPanel。

const SUBMISSIONS_KEY = 'aiassess_submissions_v1';

export function listSubmissions() {
  return readJSON(SUBMISSIONS_KEY, []);
}

function persist(subs) {
  writeJSON(SUBMISSIONS_KEY, subs);
}

export function addSubmission({ userId, userName, answers, result }) {
  const record = {
    id: uid('s'),
    userId,
    userName,
    createdAt: new Date().toISOString(),
    answers,
    result,
  };
  const all = listSubmissions();
  all.push(record);
  persist(all);
  return record;
}

/** 取得某使用者的所有作答，依時間新到舊排序。 */
export function submissionsByUser(userId) {
  return listSubmissions()
    .filter((s) => s.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
