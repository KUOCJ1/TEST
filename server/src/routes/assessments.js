import { Router } from 'express';
import { isStrictPrivacy } from '../lib/compassPrivacy.js';

/** @param {{db, requireAuth}} deps */
export function createAssessmentsRouter({ db, requireAuth }) {
  const router = Router();

  // ── 評量清單 ─────────────────────────────────────────────
  router.get('/assessments', requireAuth, (_req, res) => {
    const list = (db.data.assessments ?? []).filter((a) => a.enabled);
    res.json({ assessments: list });
  });

  // ── 題庫內容覆寫（Sprint 10）──────────────────────────────
  // 只回「已發佈」的版本，任何登入者都能讀（作答畫面、報告都要用）。草稿只有管理者看得到。
  // 沒有任何覆寫時回空物件，前端就用程式碼內建的題庫原文。
  router.get('/assessments/content', requireAuth, (_req, res) => {
    const content = {};
    for (const rec of db.data.assessmentContent ?? []) {
      if (rec.published) content[rec.id] = { version: rec.published.version, overrides: rec.published.overrides };
    }
    res.json({ content });
  });

  // ── 母體基準（百分位 / Benchmark）─────────────────────────
  // 全量掃描 submissions 計算，成本隨資料量成長。用「全站 submissions 總筆數」當作簡易
  // 版本號快取：目前系統沒有刪除作答的功能，總筆數只會單調遞增，故「筆數不變 ⇒ 資料
  // 未變」恆成立，不會有 TTL 造成的過期風險。用全站總筆數而非個別評量筆數，是因為後者
  // 得先做一次 filter 才能取得，跟直接重算的成本相近；任何一筆新作答（無論哪個評量）
  // 都會讓所有評量的快取一起失效，重算一次即可，換來程式碼不需要跨模組協調失效時機。
  const benchmarkCache = new Map(); // assessmentId -> { submissionCount, data }

  router.get('/assessments/:id/benchmark', requireAuth, (req, res) => {
    const assessmentId = req.params.id;
    const submissionCount = db.data.submissions.length;
    const cached = benchmarkCache.get(assessmentId);
    if (cached && cached.submissionCount === submissionCount) {
      return res.json(cached.data);
    }

    // 比較基準應該是「各學員自己的自評」。360° 題庫裡別人替受評者填的他評提交，
    // userId 是評分者，若算進來，評分者的他評分數會被當成他本人的最新成績。
    // 這個修正目前只套用在領導力羅盤；其他 360° 題庫（L9D、DISC）維持原本算法，
    // 避免動到既有題庫的數字（是否一併修正由產品決定）。
    const selfOnly = isStrictPrivacy(assessmentId);
    const all = db.data.submissions.filter(
      (s) => (s.assessmentId ?? 'ai-competency') === assessmentId
        && (!selfOnly || (s.raterType ?? 'self') === 'self'),
    );
    const latestMap = new Map();
    for (const s of all) {
      const cur = latestMap.get(s.userId);
      if (!cur || new Date(s.createdAt) >= new Date(cur.createdAt)) latestMap.set(s.userId, s);
    }
    const latest = [...latestMap.values()];
    const totals = latest.map((s) => s.result?.total ?? 0).sort((a, b) => a - b);

    const dimMap = new Map();
    for (const s of latest) {
      for (const d of s.result?.dimensions ?? []) {
        if (!dimMap.has(d.id)) dimMap.set(d.id, { id: d.id, subtitle: d.subtitle, name: d.name, color: d.color, sum: 0, n: 0 });
        const e = dimMap.get(d.id);
        e.sum += d.percent ?? 0;
        e.n += 1;
      }
    }
    const dimensionAverages = [...dimMap.values()].map((e) => ({
      id: e.id, subtitle: e.subtitle, name: e.name, color: e.color,
      percent: e.n ? Math.round(e.sum / e.n) : 0,
    }));

    const count = latest.length;
    const avgTotal = count ? Math.round((totals.reduce((a, b) => a + b, 0) / count) * 10) / 10 : 0;

    const data = { assessmentId, count, avgTotal, totals, dimensionAverages };
    benchmarkCache.set(assessmentId, { submissionCount, data });
    res.json(data);
  });

  return router;
}
