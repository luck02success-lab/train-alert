import type {
  TrainLiveStatus,
  StationLiveBoard,
} from "./providers/railradar.js";

export type RailProviderErrorCode =
  | "UNAUTHORIZED"
  | "TRAIN_NOT_FOUND"
  | "STATION_NOT_FOUND"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "MALFORMED_RESPONSE";

export interface RailProvider {
  readonly name: string;

  getLiveTrain(
    trainNumber: string,
    journeyDate: string
  ): Promise<TrainLiveStatus>;

  getStationLiveBoard(
    stationCode: string,
    hoursAhead?: number
  ): Promise<StationLiveBoard>;

  enrichDestinationWhenSuspicious?(
    live: TrainLiveStatus,
    destinationStationCode: string
  ): Promise<TrainLiveStatus>;
}
