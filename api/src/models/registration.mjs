import { DataTypes } from 'sequelize';

export function defineRegistration(sequelize) {
  return sequelize.define('Registration', {
    name: { type: DataTypes.STRING(100), allowNull: false },
    email: { type: DataTypes.STRING(254), allowNull: false }
  });
}