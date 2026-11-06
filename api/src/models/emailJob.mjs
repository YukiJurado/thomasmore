import { DataTypes } from 'sequelize';

export function defineEmailJob(sequelize) {
  return sequelize.define('EmailJob', {
    deliveryKey: { type: DataTypes.UUID, allowNull: false, defaultValue: DataTypes.UUIDV4, unique: true },
    recipient: { type: DataTypes.STRING(254), allowNull: false },
    subject: { type: DataTypes.STRING, allowNull: false },
    text: { type: DataTypes.TEXT, allowNull: false },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    nextAttemptAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    sentAt: { type: DataTypes.DATE, allowNull: true },
    lastError: { type: DataTypes.STRING, allowNull: true }
  });
}
