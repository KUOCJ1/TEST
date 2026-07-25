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
  router.get('/assessments/:id/benchmark', requireAuth, (req, res) => {
    const assessmentId = req.params.id;
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

    res.json({ assessmentId, count, avgTotal, totals, dimensionAverages });
  });

  return router;
}
