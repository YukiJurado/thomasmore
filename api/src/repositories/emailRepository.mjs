import { Op } from 'sequelize';
import { EmailJob } from '../db/index.mjs';
import { withTransaction } from './databaseRepository.mjs';

export async function enqueueEmail(data, options = {}) {
  const job = await EmailJob.create(data, options);
  return job.toJSON();
}

export async function findDueEmails(now, limit = 20) {
  const jobs = await EmailJob.findAll({
    where: { sentAt: null, nextAttemptAt: { [Op.lte]: new Date(now) } },
    order: [['id', 'ASC']], limit
  });
  return jobs.map((job) => job.toJSON());
}

export function recordDelivery(id, sentAt) {
  return withTransaction((transaction) => EmailJob.update({
    sentAt: new Date(sentAt), lastError: null
  }, { where: { id }, transaction }));
}

export function recordFailure(id, attempts, nextAttemptAt, errorCode) {
  return withTransaction((transaction) => EmailJob.update({
    attempts, nextAttemptAt: new Date(nextAttemptAt), lastError: errorCode
  }, { where: { id }, transaction }));
}

export async function listEmailJobs() {
  const jobs = await EmailJob.findAll({ order: [['id', 'ASC']] });
  return jobs.map((job) => job.toJSON());
}
