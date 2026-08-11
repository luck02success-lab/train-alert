import { PostgresDatabase } from "./postgres.js";

import {
  PostgresJourneyRepository,
} from "./journey-repository.js";

import {
  PostgresDeviceRepository,
} from "./device-repository.js";

import {
  DevelopmentHeaderAuthProvider,
} from "./auth.js";

import {
  PostgresNotificationRepository,
} from "./notification-repository.js";

import {
  NotificationService,
} from "./notification-service.js";

import {
  FirebaseFcmClient,
} from "./fcm-firebase.js";

import {
  AlertWorker,
} from "./alert-worker.js";

import { RailRadarProvider } from "./providers/railradar.js";

import { TrainService } from "./train-service.js";

import { JourneyService } from "./journey-service.js";

import { DeviceService } from "./device-service.js";

const database = new PostgresDatabase();

const journeyRepository =
  new PostgresJourneyRepository(database);

const deviceRepository =
  new PostgresDeviceRepository(database);

const provider =
  new RailRadarProvider();

const trains =
  new TrainService(provider);

export const journeyService =
  new JourneyService(
    journeyRepository,
    trains
  );

export const deviceService =
  new DeviceService(
    deviceRepository
  );

const notificationRepository =
  new PostgresNotificationRepository(
    database
  );

const fcm =
  new FirebaseFcmClient();

const notificationService =
  new NotificationService(
    notificationRepository,
    fcm
  );

export const alertWorker =
  new AlertWorker(
    notificationRepository,
    notificationService
  );

export const auth =
  new DevelopmentHeaderAuthProvider();