import { Router } from 'express';

/** @param {{db, requireAuth}} deps */
export function createAssessmentsRouter({ db, requireAuth }) {
  const router = Router();

  // ── 評量清單 ─────────────────────────────────────────────
  router.get('/assessments', requireAuth, (_req, res) => {
    const list = (db.data.assessments ?? []).filter((a) => a.enabled);
    res.json({ assessments: list });
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

    const all = db.data.submissions.filter(
      (s) => (s.assessmentId ?? 'ai-competency') === assessmentId,
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
