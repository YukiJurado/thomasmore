import { Router } from 'express';
import { getEvents } from '../controllers/eventController.mjs';

export const eventRoutes = Router();

eventRoutes.get('/', getEvents);