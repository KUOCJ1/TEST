import { describe, it, expect } from 'vitest';
import { REGISTRY } from '../survey/data/assessments/index.js';
import { fingerprintOf, structureOf } from '../survey/utils/assessmentFingerprint.js';
import { buildResult } from '../survey/utils/scoring.js';
import fixtures from './fixtures/assessment-fingerprints.json';

// 評量定義固定：結構（題數、題號、構面、子能力、反向題、量表、等級門檻）一變，這個測試就會失敗，
// 提醒你：升版該題庫的 ITEM_VERSION，並重新產生指紋（node scripts/print-fingerprints.mjs > src/test/fixtures/assessment-fingerprints.json）。
// 題目「文字」的修正不影響指紋，可以直接改。

describe('評量定義的版本與結構指紋', () => {
  it('每份評量都有 ITEM_VERSION，且都登記在指紋檔裡（沒有多的、沒有少的）', () => {
    expect(Object.keys(fixtures).sort()).toEqual(Object.keys(REGISTRY).sort());
    for (const [id, cfg] of Object.entries(REGISTRY)) {
      expect(typeof cfg.ITEM_VERSION, `${id} 沒有 ITEM_VERSION`).toBe('string');
      expect(cfg.ITEM_VERSION.length).toBeGreaterThan(0);
    }
  });

  it.each(Object.keys(fixtures))('%s：版本與結構和指紋檔一致', (id) => {
    const cfg = REGISTRY[id];
    const stored = fixtures[id];
    expect(
      cfg.ITEM_VERSION,
      `${id} 的 ITEM_VERSION 是 ${cfg.ITEM_VERSION}，指紋檔記錄的是 ${stored.version}。升版後請更新指紋檔。`,
    ).toBe(stored.version);
    expect(
      fingerprintOf(cfg),
      `${id} 的題庫「結構」變了（題數、題號、構面、子能力、反向題、量表或等級門檻）。請先升版 ITEM_VERSION（目前 ${cfg.ITEM_VERSION}），再執行 node scripts/print-fingerprints.mjs > src/test/fixtures/assessment-fingerprints.json 更新指紋。已有人作答的評量，舊結果是快照，不會跟著變。`,
    ).toBe(stored.hash);
  });

  it('指紋對題目文字不敏感，對結構敏感', () => {
    const cfg = REGISTRY['leadership-360-70'];
    const base = fingerprintOf(cfg);
    const reworded = { ...cfg, DIMENSIONS: cfg.DIMENSIONS.map((d, i) => (i === 0 ? { ...d, name: '改了名字', questions: d.questions.map((q, j) => (j === 0 ? { ...q, text: '改過的錯字' } : q)) } : d)) };
    expect(fingerprintOf(reworded)).toBe(base);
    const reversed = { ...cfg, DIMENSIONS: cfg.DIMENSIONS.map((d, i) => (i === 0 ? { ...d, questions: d.questions.map((q, j) => (j === 0 ? { ...q, reversed: true } : q)) } : d)) };
    expect(fingerprintOf(reversed)).not.toBe(base);
    const fewer = { ...cfg, DIMENSIONS: cfg.DIMENSIONS.map((d, i) => (i === 0 ? { ...d, questions: d.questions.slice(1) } : d)) };
    expect(fingerprintOf(fewer)).not.toBe(base);
    expect(structureOf(cfg)).toContain('"id":"leadership-360-70"');
  });

  it('共用計分的評量，每筆結果都記錄題庫版本（日後追蹤才知道是哪一版算的）', () => {
    for (const id of ['ai-competency', 'leadership-9d', 'leadership-360-70', 'disc', 'archetype']) {
      const cfg = REGISTRY[id];
      const answers = Object.fromEntries(cfg.ALL_QUESTIONS.map((q) => [q.id, 3]));
      expect(buildResult(answers, cfg).itemVersion, id).toBe(cfg.ITEM_VERSION);
    }
  });
});
