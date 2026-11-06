import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createMailSender } from '../../src/mail/sender.mjs';
import { startSmtpCapture } from '../helpers/smtpServer.mjs';

const job = {
  id: 10, registrationId: 20, deliveryKey: 'test-delivery-uuid', recipient: 'student@example.com',
  subject: 'Registration confirmed: Backend Bootcamp', text: 'Hi Student, you are registered.'
};

it('delivers an actual SMTP message with the configured sender and confirmation contents', async () => {
  const smtp = await startSmtpCapture();
  try {
    const send = createMailSender({ smtpUrl: smtp.smtpUrl, mailFrom: 'events@example.com' });
    const info = await send(job);
    assert.deepEqual(info.accepted, [job.recipient]);
    assert.equal(smtp.messages.length, 1);
    assert.match(smtp.messages[0], /To: student@example.com/);
    assert.match(smtp.messages[0], /Subject: Registration confirmed: Backend Bootcamp/);
    assert.match(smtp.messages[0], /Hi Student, you are registered/);
  } finally {
    await smtp.close();
  }
});

it('reports a real unavailable SMTP server as a rejected promise', async () => {
  const smtp = await startSmtpCapture();
  const smtpUrl = smtp.smtpUrl;
  await smtp.close();
  const send = createMailSender({ smtpUrl, mailFrom: 'events@example.com' });
  await assert.rejects(send(job), { code: 'ESOCKET' });
});

it('uses HTTPS and a stable idempotency key when configured for Resend', async (t) => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    sent = { url, options };
    return { ok: true, json: async () => ({ id: 'provider-message-id' }) };
  });
  const send = createMailSender({ resendApiKey: 'test-only-key', mailFrom: 'events@example.com' });
  assert.deepEqual(await send(job), { id: 'provider-message-id' });
  assert.equal(sent.url, 'https://api.resend.com/emails');
  assert.equal(sent.options.headers['Idempotency-Key'], 'campus-confirmation-test-delivery-uuid');
  assert.deepEqual(JSON.parse(sent.options.body).to, [job.recipient]);
});

it('rejects missing provider settings instead of pretending delivery succeeded', async () => {
  await assert.rejects(createMailSender({})(job), /MAIL_FROM/);
  await assert.rejects(createMailSender({ mailFrom: 'events@example.com' })(job), /SMTP_URL/);
});
