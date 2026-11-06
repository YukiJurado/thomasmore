import { Router } from 'express';
import * as events from '../controllers/eventController.mjs';
import * as registrations from '../controllers/registrationController.mjs';
import { validate } from '../middleware/validate.mjs';
import { idSchema, createEventSchema, updateEventSchema, registrationSchema } from '../validation/schemas.mjs';

export const eventRoutes = Router();
const id = validate(idSchema, 'params');

eventRoutes.get('/', events.getEvents);
eventRoutes.post('/', validate(createEventSchema, 'body'), events.createEvent);
eventRoutes.get('/:id', id, events.getEvent);
eventRoutes.patch('/:id', id, validate(updateEventSchema, 'body'), events.updateEvent);
eventRoutes.delete('/:id', id, events.deleteEvent);
eventRoutes.get('/:id/registrations', id, registrations.getRegistrations);
eventRoutes.post('/:id/registrations', id, validate(registrationSchema, 'body'), registrations.register);
