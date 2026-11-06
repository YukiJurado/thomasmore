import { checkDatabase } from '../repositories/databaseRepository.mjs';
import { getStats as loadStats } from '../services/statsService.mjs';

export async function health(_req, res) {
  await checkDatabase();
  res.json({ status: 'ok' });
}

export async function stats(_req, res) {
  res.json(await loadStats());
}
