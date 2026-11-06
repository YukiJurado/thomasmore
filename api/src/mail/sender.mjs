import nodemailer from 'nodemailer';
import { env } from '../config/env.mjs';

export function createMailSender(settings = env) {
  let transporter;
  return async (job) => {
    const message = {
      from: settings.mailFrom, to: job.recipient,
      subject: job.subject, text: job.text,
      messageId: `<${job.deliveryKey}@campus-events.local>`
    };
    if (!message.from) throw new Error('MAIL_FROM is not configured');
    // HTTPS works on hosts that block outbound SMTP ports, including free Render services.
    if (settings.resendApiKey) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.resendApiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `campus-confirmation-${job.deliveryKey}`
        },
        body: JSON.stringify({
          from: message.from, to: [message.to], subject: message.subject, text: message.text
        }),
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error(`Mail provider returned HTTP ${response.status}`);
      return response.json();
    }
    if (!settings.smtpUrl) throw new Error('SMTP_URL or RESEND_API_KEY must be configured');
    transporter ??= nodemailer.createTransport(settings.smtpUrl, {
      connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000
    });
    const info = await transporter.sendMail(message);
    if (!info.accepted?.length) throw new Error('Mail provider did not accept the recipient');
    return info;
  };
}

export const sendEmail = createMailSender();
