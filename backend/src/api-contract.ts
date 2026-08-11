import type { JourneyState } from "./domain.js";

export interface CreateJourneyRequest {
  trainNumber: string;
  journeyDate: string;
  destinationStationCode: string;
}

export interface JourneyResponse {
  id: string;
  trainNumber: string;
  journeyDate: string;
  destinationStationCode: string;
  state: JourneyState;
  expectedArrival: string | null;
  nextAlert: string | null;
}

export interface RegisterDeviceRequest {
  platform: "android";
  token: string;
}

export interface DeviceResponse {
  id: string;
  platform: "android";
  token: string;
  invalidatedAt: string | null;
  createdAt: string;
}