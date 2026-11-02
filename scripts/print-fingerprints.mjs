// 印出所有評量的結構指紋（JSON），用來更新 src/test/fixtures/assessment-fingerprints.json。
// 題庫「結構」（題數、題號、構面、子能力、反向題、量表、等級門檻）有改動時：先升版該題庫的 ITEM_VERSION，
// 再執行 `node scripts/print-fingerprints.mjs > src/test/fixtures/assessment-fingerprints.json`。
import { REGISTRY } from '../src/survey/data/assessments/index.js';
import { fingerprintOf } from '../src/survey/utils/assessmentFingerprint.js';

const out = {};
for (const [id, cfg] of Object.entries(REGISTRY)) out[id] = { version: cfg.ITEM_VERSION ?? null, hash: fingerprintOf(cfg) };
console.log(JSON.stringify(out, null, 2));
