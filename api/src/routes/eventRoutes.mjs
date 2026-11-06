import { Router } from 'express';
import {
  getEvents,
  getEvent
} from '../controllers/eventController.mjs';
import { validateEventId } from '../middleware/validateEventId.mjs';

export const eventRoutes = Router();

eventRoutes.get('/', getEvents);
eventRoutes.get('/:id', validateEventId, getEvent);