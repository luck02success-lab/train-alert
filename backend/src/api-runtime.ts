import { PostgresDatabase } from "./postgres.js";
import {
  PostgresJourneyRepository,
} from "./journey-repository.js";
import {
  DevelopmentHeaderAuthProvider,
} from "./auth.js";
import { RailRadarProvider } from "./providers/railradar.js";
import { TrainService } from "./train-service.js";
import { JourneyService } from "./journey-service.js";

const database = new PostgresDatabase();

const repository =
  new PostgresJourneyRepository(database);

const provider = new RailRadarProvider();

const trains = new TrainService(provider);

export const journeyService =
  new JourneyService(repository, trains);

export const auth =
  new DevelopmentHeaderAuthProvider();
