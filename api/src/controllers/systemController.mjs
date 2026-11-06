import { checkDatabase } from '../repositories/databaseRepository.mjs';
import { getStatsSnapshot } from '../services/statsService.mjs';

export async function health(_req, res) {
  await checkDatabase();
  res.json({ status: 'ok' });
}

export async function stats(_req, res) {
  const snapshot = await getStatsSnapshot();
  res.locals.cacheExpiresAt = snapshot.validUntil;
  res.json(snapshot.value);
}
