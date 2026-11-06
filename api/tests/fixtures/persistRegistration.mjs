import { sequelize } from '../../src/db/index.mjs';
import { createEvent, findAllEvents } from '../../src/repositories/eventRepository.mjs';
import { listEmailJobs } from '../../src/repositories/emailRepository.mjs';
import { listRegistrations } from '../../src/repositories/registrationRepository.mjs';
import { register } from '../../src/services/registrationService.mjs';

await sequelize.sync();
if (process.argv[2] === 'write') {
  const event = await createEvent({
    title: 'Persistent event', location: 'Campus', capacity: 10, startsAt: new Date()
  });
  await register(event.id, { name: 'Restart Test', email: 'restart@example.com' });
}
const events = await findAllEvents();
console.log(JSON.stringify({
  events: events.length,
  registrations: (await listRegistrations(events[0].id)).length,
  pendingEmails: (await listEmailJobs()).filter((job) => !job.sentAt).length
}));
await sequelize.close();
