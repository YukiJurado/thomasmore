import nodemailer from 'nodemailer';
import { env } from '../config/env.mjs';

function createSmtpTransport(settings) {
  const url = new URL(settings.smtpUrl);
  if (!['smtp:', 'smtps:'].includes(url.protocol)) {
    throw new Error('SMTP_URL must use smtp:// or smtps://');
  }
  const timeout = settings.smtpTimeoutMs ?? 5000;
  // Transport options belong to createTransport's first argument; its second is message defaults.
  return nodemailer.createTransport({
    host: url.hostname,
    port: Number(url.port || (url.protocol === 'smtps:' ? 465 : 587)),
    secure: url.protocol === 'smtps:',
    auth: url.username ? {
      user: decodeURIComponent(url.username), pass: decodeURIComponent(url.password)
    } : undefined,
    connectionTimeout: timeout, greetingTimeout: timeout, socketTimeout: timeout
  });
}

async function sendWithResend(message, settings, deliveryKey) {
  if (!settings.resendApiKey) throw new Error('RESEND_API_KEY is not configured');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.resendApiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `campus-confirmation-${deliveryKey}`
    },
    body: JSON.stringify({
      from: message.from, to: [message.to], subject: message.subject, text: message.text
    }),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`Mail provider returned HTTP ${response.status}`);
  return response.json();
}

function selectProvider(settings) {
  const provider = settings.mailProvider || (settings.resendApiKey ? 'resend' : 'smtp');
  if (!['smtp', 'resend'].includes(provider)) throw new Error('MAIL_PROVIDER must be smtp or resend');
  return provider;
}

export function createMailSender(settings = env) {
  let transporter;
  return async (job) => {
    const message = {
      from: settings.mailFrom, to: job.recipient,
      subject: job.subject, text: job.text,
      messageId: `<${job.deliveryKey}@campus-events.local>`
    };
    if (!message.from) throw new Error('MAIL_FROM is not configured');
    const provider = selectProvider(settings);
    // Explicit selection lets SMTP replace an existing HTTPS provider without deleting its key.
    if (provider === 'resend') return sendWithResend(message, settings, job.deliveryKey);
    if (!settings.smtpUrl) throw new Error('SMTP_URL or RESEND_API_KEY must be configured');
    transporter ??= createSmtpTransport(settings);
    const info = await transporter.sendMail(message);
    if (!info.accepted?.length) throw new Error('Mail provider did not accept the recipient');
    return info;
  };
}

export const sendEmail = createMailSender();
