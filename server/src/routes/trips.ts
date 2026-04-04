import * as chatHandlers from 'app/handlers/chat/chat.js';
import * as tripHandlers from 'app/handlers/trips/trips.js';
import { chatRateLimiter } from 'app/middleware/rateLimiter/rateLimiter.js';
import { requireAuth } from 'app/middleware/requireAuth/requireAuth.js';
import express from 'express';

const tripRouter = express.Router();

tripRouter.use(requireAuth);

tripRouter.post('/', tripHandlers.createTrip);
tripRouter.get('/', tripHandlers.listTrips);
tripRouter.get('/:id', tripHandlers.getTrip);
tripRouter.put('/:id', tripHandlers.updateTrip);
tripRouter.delete('/:id', tripHandlers.deleteTrip);

tripRouter.post('/:id/chat', chatRateLimiter, chatHandlers.chat);
tripRouter.get('/:id/messages', chatHandlers.getMessages);

export { tripRouter };
