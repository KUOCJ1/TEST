import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { sendMail, isMailConfigured } from '../src/lib/mailer.js';

const SMTP_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
let saved;
beforeEach(() => { saved = Object.fromEntries(SMTP_KEYS.map((k) => [k, process.env[k]])); });
afterEach(() => {
  for (const k of SMTP_KEYS) {
    if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  }
});

function configure() {
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_USER = 'bot@example.com';
  process.env.SMTP_PASS = 'secret';
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_FROM;
}

describe('mailer', () => {
  test('三個必填 SMTP 變數缺任何一個都視為未設定，且不嘗試連線', async (t) => {
    const create = t.mock.method(nodemailer, 'createTransport', () => { throw new Error('不該被呼叫'); });
    for (const k of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']) {
      configure();
      delete process.env[k];
      assert.equal(isMailConfigured(), false, `缺 ${k}`);
      assert.deepEqual(await sendMail({ to: 'a@b.co', subject: 's', text: 't' }), { ok: false, code: 'CONFIG_ERROR' });
    }
    assert.equal(create.mock.callCount(), 0);
  });

  test('設定完整時用環境變數建立 transport 並寄出；寄件者預設同 SMTP_USER', async (t) => {
    configure();
    const sent = [];
    const create = t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async (msg) => { sent.push(msg); } }));
    const result = await sendMail({ to: 'a@b.co', subject: '主旨', text: '內文' });

    assert.deepEqual(result, { ok: true });
    const opts = create.mock.calls[0].arguments[0];
    assert.equal(opts.host, 'smtp.example.com');
    assert.equal(opts.port, 587);
    assert.equal(opts.secure, false);
    assert.deepEqual(opts.auth, { user: 'bot@example.com', pass: 'secret' });
    assert.deepEqual(sent, [{ from: 'bot@example.com', to: 'a@b.co', subject: '主旨', text: '內文' }]);
  });

  test('465 埠走 implicit TLS；SMTP_FROM 有設定時用它當寄件者', async (t) => {
    configure();
    process.env.SMTP_PORT = '465';
    process.env.SMTP_FROM = '評測平台 <noreply@example.com>';
    const sent = [];
    const create = t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async (msg) => { sent.push(msg); } }));
    await sendMail({ to: 'a@b.co', subject: 's', text: 't' });
    assert.equal(create.mock.calls[0].arguments[0].secure, true);
    assert.equal(sent[0].from, '評測平台 <noreply@example.com>');
  });

  test('SMTP 寄送失敗時回傳 SEND_ERROR，不丟例外', async (t) => {
    configure();
    t.mock.method(console, 'error', () => {});
    t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async () => { throw new Error('535 auth failed'); } }));
    const result = await sendMail({ to: 'a@b.co', subject: 's', text: 't' });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'SEND_ERROR');
    assert.match(result.error, /535 auth failed/);
  });
});
