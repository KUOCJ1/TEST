import * as aiCompetency from './ai-competency.js';
import * as leadership9d from './leadership-9d.js';
import * as disc from './disc.js';
import * as archetype from './archetype.js';
import * as leadershipCompass from './leadership-compass.js';
import * as successionIntent from './succession-intent.js';

export const REGISTRY = {
  [aiCompetency.ID]: aiCompetency,
  [leadership9d.ID]: leadership9d,
  [disc.ID]: disc,
  [archetype.ID]: archetype,
  [leadershipCompass.ID]: leadershipCompass,
  [successionIntent.ID]: successionIntent,
};

export function getAssessment(id) {
  return REGISTRY[id] ?? null;
}
