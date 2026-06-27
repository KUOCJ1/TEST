import { useMemo, useState } from 'react';

/**
 * Manages assessment-id selection and derives the filtered submission list.
 * Shared across AdminDashboard, CoachDashboard tabs, and MultiRaterTab.
 */
export function useAssessmentFilter(submissions, initialId = null) {
  const assessmentIds = useMemo(
    () => [...new Set((submissions ?? []).map((s) => s.assessmentId ?? 'ai-competency'))],
    [submissions],
  );

  const [selectedId, setSelectedId] = useState(initialId ?? null);
  const activeId = selectedId ?? assessmentIds[0] ?? null;

  const filtered = useMemo(
    () => (submissions ?? []).filter((s) => (s.assessmentId ?? 'ai-competency') === activeId),
    [submissions, activeId],
  );

  return { assessmentIds, activeId, setSelectedId, filtered };
}
