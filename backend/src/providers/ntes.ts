import {
  ProviderError,
  type TrainLiveStatus,
  type StationLiveBoard,
  type TrainLiveStop,
} from "./railradar.js";
import type { RailProvider } from "../rail-provider.js";

/*
 * Adapter for a deployed NTES bridge.
 *
 * Expected endpoints:
 *   GET /live-status?trainNumber=22454&journeyDate=2026-08-15
 *   GET /station-live?stationCode=BBK&hoursAhead=4
 *
 * The bridge should use the open-source `ntes-client` project and return
 * the normalized RailWake shape. Keeping the crypto/reverse-engineering
 * client outside this Vercel Node runtime avoids coupling the core service
 * to Python subprocesses.
 */
export class NtesProvider implements RailProvider {
  readonly name = "ntes";

  constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  private async request<T>(
    path: string
  ): Promise<T> {
    let response: Response;

    try {
      response = await this.fetcher(
        `${this.baseUrl.replace(/\/$/, "")}${path}`,
        {
          signal: AbortSignal.timeout(10_000),
          headers: {
            Accept: "application/json",
          },
        }
      );
    } catch {
      throw new ProviderError(
        "UNAVAILABLE",
        "NTES provider is unavailable."
      );
    }

    if (!response.ok) {
      if (response.status === 404) {
        throw new ProviderError(
          "TRAIN_NOT_FOUND",
          "NTES could not find the requested train."
        );
      }

      if (response.status === 429) {
        throw new ProviderError(
          "RATE_LIMITED",
          "NTES provider is rate limited."
        );
      }

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        throw new ProviderError(
          "UNAUTHORIZED",
          "NTES provider authentication failed."
        );
      }

      throw new ProviderError(
        "UNAVAILABLE",
        "NTES provider is unavailable."
      );
    }

    try {
      return await response.json() as T;
    } catch {
      throw new ProviderError(
        "MALFORMED_RESPONSE",
        "NTES returned malformed JSON."
      );
    }
  }

  async getLiveTrain(
    trainNumber: string,
    journeyDate: string
  ): Promise<TrainLiveStatus> {
    return this.request<TrainLiveStatus>(
      `/live-status?trainNumber=${encodeURIComponent(
        trainNumber
      )}&journeyDate=${encodeURIComponent(
        journeyDate
      )}`
    );
  }

  async getStationLiveBoard(
    stationCode: string,
    hoursAhead = 4
  ): Promise<StationLiveBoard> {
    return this.request<StationLiveBoard>(
      `/station-live?stationCode=${encodeURIComponent(
        stationCode
      )}&hoursAhead=${encodeURIComponent(
        String(hoursAhead)
      )}`
    );
  }
}
