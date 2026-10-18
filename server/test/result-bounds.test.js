import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateResultShape } from '../src/lib/helpers.js';
import { REGISTRY } from '../../src/survey/data/assessments/index.js';
import { buildResult } from '../../src/survey/utils/scoring.js';

// 前端算好的結果要能通過伺服器的範圍檢查（所有評量、極端作答），否則真實學員會送不出去。
function resultFor(config, value) {
  const view = config.selectForm ? config.selectForm(config.DEFAULT_FORM) : config;
  const answers = Object.fromEntries(view.ALL_QUESTIONS.map((q) => [q.id, value]));
  return config.SCORING ? config.SCORING.buildResult(answers, view, { rater: 'self' }) : buildResult(answers, view);
}

describe('所有評量的極端作答都能通過伺服器的範圍檢查', () => {
  for (const [id, config] of Object.entries(REGISTRY)) {
    test(id, () => {
      for (const v of [1, 3, 5]) assert.equal(validateResultShape(resultFor(config, v)), null, `${id} 全部填 ${v}`);
    });
  }
});

describe('validateResultShape 範圍檢查', () => {
  const ok = () => ({ total: 100, dimensions: [{ id: 'd', score: 10, max: 20, percent: 50, average: 3, rating: { label: 'x' } }] });
  test('正常通過', () => assert.equal(validateResultShape(ok()), null));
  test('分數超過滿分、負分、百分比超出、平均不合理都擋下', () => {
    const t = (patch) => { const r = ok(); Object.assign(r.dimensions[0], patch); return validateResultShape(r); };
    assert.match(t({ score: 21 }), /超出範圍/);
    assert.match(t({ score: -1 }), /超出範圍/);
    assert.match(t({ max: 0 }), /超出範圍/);
    assert.match(t({ percent: 120 }), /百分比/);
    assert.match(t({ average: 999 }), /平均/);
    const huge = ok(); huge.total = 1e9;
    assert.match(validateResultShape(huge), /總分/);
  });
});
