import express from "express";

import * as tripHandlers from "app/handlers/trips/trips.js";
import { requireAuth } from "app/middleware/requireAuth/requireAuth.js";

const tripRouter = express.Router();

tripRouter.use(requireAuth);

tripRouter.post("/", tripHandlers.createTrip);
tripRouter.get("/", tripHandlers.listTrips);
tripRouter.get("/:id", tripHandlers.getTrip);
tripRouter.delete("/:id", tripHandlers.deleteTrip);

export { tripRouter };
