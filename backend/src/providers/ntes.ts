import {
  ProviderError,
  type TrainLiveStatus,
  type StationLiveBoard,
} from "./railradar.js";

import type { RailProvider } from "../rail-provider.js";

export class NtesProvider implements RailProvider {
  readonly name = "ntes";

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  async getLiveTrain(
    trainNumber: string,
    journeyDate: string
  ): Promise<TrainLiveStatus> {
    return this.request<TrainLiveStatus>(
      "/live-status",
      {
        trainNumber,
        journeyDate,
      }
    );
  }

  async getStationLiveBoard(
    stationCode: string,
    hoursAhead = 4
  ): Promise<StationLiveBoard> {
    return this.request<StationLiveBoard>(
      "/station-live",
      {
        stationCode,
        hoursAhead: String(hoursAhead),
      }
    );
  }

  private async request<T>(
    path: string,
    query: Record<string, string>
  ): Promise<T> {
    const base = this.baseUrl.endsWith("/")
      ? this.baseUrl
      : `${this.baseUrl}/`;

    const url = new URL(
      path.replace(/^\//, ""),
      base
    );

    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      10_000
    );

    try {
      const response = await this.fetcher(url, {
        method: "GET",
        headers: {
          Accept: "application/json",

          ...(this.apiKey
            ? {
                Authorization:
                  `Bearer ${this.apiKey}`,
              }
            : {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        if (
          response.status === 401 ||
          response.status === 403
        ) {
          throw new ProviderError(
            "UNAUTHORIZED",
            "NTES provider authentication failed."
          );
        }

        if (response.status === 404) {
          throw new ProviderError(
            path.includes("station-live")
              ? "STATION_NOT_FOUND"
              : "TRAIN_NOT_FOUND",
            "NTES resource was not found."
          );
        }

        if (response.status === 429) {
          throw new ProviderError(
            "RATE_LIMITED",
            "NTES provider rate limit reached."
          );
        }

        if (response.status >= 500) {
          throw new ProviderError(
            "UNAVAILABLE",
            `NTES provider returned HTTP ${response.status}.`
          );
        }

        throw new ProviderError(
          "UNAVAILABLE",
          `NTES provider returned HTTP ${response.status}.`
        );
      }

      try {
        return (await response.json()) as T;
      } catch {
        throw new ProviderError(
          "MALFORMED_RESPONSE",
          "NTES provider returned invalid JSON."
        );
      }
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }

      if (
        error instanceof Error &&
        error.name === "AbortError"
      ) {
        throw new ProviderError(
          "UNAVAILABLE",
          "NTES provider request timed out."
        );
      }

      throw new ProviderError(
        "UNAVAILABLE",
        error instanceof Error
          ? error.message
          : "NTES provider request failed."
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}