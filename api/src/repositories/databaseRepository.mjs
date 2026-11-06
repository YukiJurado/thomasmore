import { sequelize } from '../db/index.mjs';

export function checkDatabase() {
  return sequelize.authenticate();
}
