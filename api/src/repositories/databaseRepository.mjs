import { sequelize } from '../db/index.mjs';

export function checkDatabase() {
  return sequelize.authenticate();
}

// SQLite shares a connection in this single-process app. Queue complete operations so
// readers cannot cache rows belonging to a transaction that might still roll back.
let pendingOperation = Promise.resolve();
export function withDatabase(work) {
  const result = pendingOperation.then(work);
  pendingOperation = result.catch(() => {});
  return result;
}

export function withTransaction(work) {
  return withDatabase(() => sequelize.transaction(work));
}
