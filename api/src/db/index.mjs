import { defineEmailJob } from '../models/emailJob.mjs';
import { Sequelize } from 'sequelize';
import { env } from '../config/env.mjs';
import { defineEvent } from '../models/event.mjs';
import { defineRegistration } from '../models/registration.mjs';

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: env.dbStorage,
  logging: false
});

export const Event = defineEvent(sequelize);
export const Registration = defineRegistration(sequelize);

Event.hasMany(Registration, {
  foreignKey: { name: 'eventId', allowNull: false },
  onDelete: 'CASCADE'
});

Registration.belongsTo(Event, { foreignKey: 'eventId' });

export const EmailJob = defineEmailJob(sequelize);
Registration.hasMany(EmailJob, {
  foreignKey: { name: 'registrationId', allowNull: false }, onDelete: 'CASCADE'
});
EmailJob.belongsTo(Registration, { foreignKey: 'registrationId' });
