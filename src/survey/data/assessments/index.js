import * as aiCompetency from './ai-competency.js';
import * as leadership9d from './leadership-9d.js';

export const REGISTRY = {
  [aiCompetency.ID]: aiCompetency,
  [leadership9d.ID]: leadership9d,
};

export function getAssessment(id) {
  return REGISTRY[id] ?? null;
}
