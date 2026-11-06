import { sequelize } from '../db/index.mjs';

export function checkDatabase() {
  return sequelize.authenticate();
}

// SQLite supports one writer. Serialise transactions in this single application process.
let pendingWrite = Promise.resolve();
export function withTransaction(work) {
  const result = pendingWrite.then(() => sequelize.transaction(work));
  pendingWrite = result.catch(() => {});
  return result;
}
