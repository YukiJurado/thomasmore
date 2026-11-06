import { findDueEmails, recordDelivery, recordFailure } from '../repositories/emailRepository.mjs';
import { sendEmail } from '../mail/sender.mjs';
import { logger } from '../config/logger.mjs';

export function createMailWorker({ send = sendEmail, now = Date.now, retryMs = 10000 } = {}) {
  let running;
  let timer;

  async function deliver(job) {
    try {
      await send(job);
      await recordDelivery(job.id, now());
      logger.info('confirmation email accepted', { jobId: job.id });
    } catch (error) {
      const attempts = job.attempts + 1;
      const delay = Math.min(retryMs * 2 ** Math.min(attempts - 1, 10), 3600000);
      // Avoid saving credentials or recipient addresses from provider error messages.
      await recordFailure(job.id, attempts, now() + delay, error.code || 'DELIVERY_FAILED');
      logger.warn('confirmation email queued for retry', { jobId: job.id, attempts });
    }
  }

  async function processBatch() {
    const jobs = await findDueEmails(now());
    for (const job of jobs) await deliver(job);
  }

  function drain() {
    running ??= processBatch().finally(() => { running = undefined; });
    return running;
  }

  return {
    drain,
    start() {
      const tick = () => drain().catch(() => logger.error('email worker could not process queue'));
      if (timer) return;
      timer = setInterval(tick, retryMs);
      timer.unref();
      tick();
    },
    async stop() {
      clearInterval(timer);
      timer = undefined;
      await running;
    }
  };
}
