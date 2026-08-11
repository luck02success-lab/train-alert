export interface TrainLiveStop {
  stationCode: string;
  stationName: string;

  scheduledArrival: string | null;
  scheduledDeparture: string | null;

  expectedArrival: string | null;
  expectedDeparture: string | null;

  actualArrival: string | null;
  actualDeparture: string | null;

  delayMinutes: number | null;
  status: string | null;
}

export interface TrainLiveStatus {
  trainNumber: string;
  journeyDate: string;

  status:
    | "running"
    | "not-started"
    | "completed"
    | "unknown";

  currentStation: string | null;
  currentStationCode: string | null;
  previousStation: string | null;
  nextStation: string | null;

  delayMinutes: number | null;
  latitude: number | null;
  longitude: number | null;

  observedAt?: Date;

  stops: TrainLiveStop[];
}

export class ProviderError extends Error {
  constructor(
    readonly code:
      | "UNAUTHORIZED"
      | "TRAIN_NOT_FOUND"
      | "RATE_LIMITED"
      | "UNAVAILABLE"
      | "MALFORMED_RESPONSE",
    message = "Railway data is currently unavailable."
  ) {
    super(message);
  }
}

type Json = Record<string, unknown>;

function object(value: unknown): Json {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProviderError("MALFORMED_RESPONSE");
  }

  return value as Json;
}

function string(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

function dateString(value: unknown): string | null {
  const valueString = string(value);

  if (!valueString) {
    return null;
  }

  const parsed = new Date(valueString);

  return Number.isNaN(parsed.getTime())
    ? null
    : valueString;
}

export class RailRadarProvider {
  constructor(
    private readonly apiKey = process.env.RAILRADAR_API_KEY,
    private readonly fetcher: typeof fetch = fetch
  ) {
    if (!apiKey) {
      throw new Error("RAILRADAR_API_KEY is required");
    }
  }

  async getLiveTrain(
    trainNumber: string,
    journeyDate: string
  ): Promise<TrainLiveStatus> {
    let response: Response;

    try {
      response = await this.fetcher(
        `https://api.railradar.in/v1/trains/${encodeURIComponent(
          trainNumber
        )}/live?date=${encodeURIComponent(journeyDate)}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
          signal: AbortSignal.timeout(8_000),
        }
      );
    } catch {
      throw new ProviderError("UNAVAILABLE");
    }

    if (!response.ok) {
      throw new ProviderError(
        response.status === 401
          ? "UNAUTHORIZED"
          : response.status === 404
            ? "TRAIN_NOT_FOUND"
            : response.status === 429
              ? "RATE_LIMITED"
              : "UNAVAILABLE"
      );
    }

    let body: Json;

    try {
      body = object(await response.json());
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }

      throw new ProviderError("MALFORMED_RESPONSE");
    }

    const data = object(body.data);

    const rawRoute = Array.isArray(data.route)
      ? data.route
      : [];

    if (rawRoute.length === 0) {
      throw new ProviderError("MALFORMED_RESPONSE");
    }

    const stops: TrainLiveStop[] = rawRoute.map(
      (rawStop) => {
        const stop = object(rawStop);

        const stationCode = string(
          stop.stationCode
        );

        if (!stationCode) {
          throw new ProviderError(
            "MALFORMED_RESPONSE"
          );
        }

        return {
          stationCode,
          stationName:
            string(stop.stationName) ?? "",

          scheduledArrival:
            dateString(stop.scheduledArrival),

          scheduledDeparture:
            dateString(stop.scheduledDeparture),

          expectedArrival:
            dateString(stop.expectedArrival),

          expectedDeparture:
            dateString(stop.expectedDeparture),

          actualArrival:
            dateString(stop.actualArrival),

          actualDeparture:
            dateString(stop.actualDeparture),

          delayMinutes:
            number(stop.delayArrival) ??
            number(stop.delayDeparture),

          status:
            string(stop.status),
        };
      }
    );

    const rawStatus = string(data.status);

    const status: TrainLiveStatus["status"] =
      rawStatus === "running" ||
      rawStatus === "not-started" ||
      rawStatus === "completed"
        ? rawStatus
        : "unknown";

    const observedAtRaw =
      string(data.lastUpdatedAt);

    const observedAt = observedAtRaw
      ? new Date(observedAtRaw)
      : new Date();

    if (Number.isNaN(observedAt.getTime())) {
      throw new ProviderError(
        "MALFORMED_RESPONSE"
      );
    }

    return {
      trainNumber:
        string(data.trainNumber) ??
        trainNumber,

      journeyDate,

      status,

      currentStation:
        string(data.currentStation),

      currentStationCode:
        string(data.currentStationCode),

      previousStation:
        string(data.previousStation),

      nextStation:
        string(data.nextStation),

      delayMinutes:
        number(data.delayMinutes),

      latitude:
        number(data.latitude),

      longitude:
        number(data.longitude),

      observedAt,

      stops,
    };
  }
}
