
import {
  searchStationsFromFallback,
} from "./station-catalog-fallback.js";

type TrainSuggestion = {
  number: string;
  name: string;
};

type StationSuggestion = {
  code: string;
  name: string;
};

type RailRadarEnvelope<T> = {
  success: boolean;
  data: T;
};

class RailRadarError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "RailRadarError";
  }
}

const RAILRADAR_BASE =
  "https://api.railradar.in";

const TRAIN_CACHE_TTL_MS =
  6 * 60 * 60 * 1000;

const STATION_CACHE_TTL_MS =
  24 * 60 * 60 * 1000;

let trainsCache:
  | {
      expiresAt: number;
      data: TrainSuggestion[];
    }
  | null = null;

let stationsCache:
  | {
      expiresAt: number;
      data: StationSuggestion[];
    }
  | null = null;

let stationsRefreshPromise:
  Promise<StationSuggestion[]> | null = null;

function getApiKey(): string {
  const key =
    process.env.RAILRADAR_API_KEY;

  if (!key) {
    throw new Error(
      "RAILRADAR_API_KEY is required"
    );
  }

  return key;
}

async function fetchRailRadar<T>(
  path: string
): Promise<T> {
  const response =
    await fetch(
      `${RAILRADAR_BASE}${path}`,
      {
        headers: {
          Authorization:
            `Bearer ${getApiKey()}`,
          Accept:
            "application/json",
        },
        signal:
          AbortSignal.timeout(
            8_000
          ),
      }
    );

  if (!response.ok) {
    throw new RailRadarError(
      response.status,
      `RailRadar returned ${response.status}`
    );
  }

  const body =
    (await response.json()) as RailRadarEnvelope<T>;

  if (!body.success) {
    throw new RailRadarError(
      502,
      "RailRadar request failed"
    );
  }

  return body.data;
}

async function loadTrains(): Promise<
  TrainSuggestion[]
> {
  const now = Date.now();

  if (
    trainsCache &&
    trainsCache.expiresAt > now
  ) {
    return trainsCache.data;
  }

  const data =
    await fetchRailRadar<
      [string, string][]
    >(
      "/v1/legacy/trains/all-kvs"
    );

  const trains =
    data
      .filter(
        ([number, name]) =>
          Boolean(number) &&
          Boolean(name)
      )
      .map(
        ([number, name]) => ({
          number,
          name,
        })
      );

  trainsCache = {
    data: trains,
    expiresAt:
      now + TRAIN_CACHE_TTL_MS,
  };

  return trains;
}

function filterStations(
  stations: StationSuggestion[],
  q: string
): StationSuggestion[] {
  const codeMatches: StationSuggestion[] =
    [];

  const nameMatches: StationSuggestion[] =
    [];

  for (const station of stations) {
    const code =
      station.code.toLowerCase();

    const name =
      station.name.toLowerCase();

    if (code.startsWith(q)) {
      codeMatches.push(station);
      continue;
    }

    if (name.includes(q)) {
      nameMatches.push(station);
    }
  }

  return [
    ...codeMatches,
    ...nameMatches,
  ].slice(0, 20);
}

async function refreshStationsFromRailRadar(): Promise<
  StationSuggestion[]
> {
  const data =
    await fetchRailRadar<
      Record<string, string>
    >(
      "/v1/lookup/stations"
    );

  const stations =
    Object.entries(data).map(
      ([code, name]) => ({
        code,
        name,
      })
    );

  stationsCache = {
    data: stations,
    expiresAt:
      Date.now() + STATION_CACHE_TTL_MS,
  };

  return stations;
}

async function getStations(): Promise<
  StationSuggestion[]
> {
  const now = Date.now();

  if (
    stationsCache &&
    stationsCache.expiresAt > now
  ) {
    return stationsCache.data;
  }

  if (stationsRefreshPromise) {
    return stationsRefreshPromise;
  }

  stationsRefreshPromise =
    (async (): Promise<
      StationSuggestion[]
    > => {
      try {
        return await refreshStationsFromRailRadar();
      } catch (error) {
        console.warn(
          "RailRadar station catalogue unavailable; using fallback catalogue",
          {
            error:
              error instanceof Error
                ? error.message
                : String(error),
            status:
              error instanceof RailRadarError
                ? error.status
                : undefined,
          }
        );

        return [];
      } finally {
        stationsRefreshPromise = null;
      }
    })();

  return stationsRefreshPromise;
}

export async function searchTrains(
  query: string
): Promise<TrainSuggestion[]> {
  const q =
    query.trim().toLowerCase();

  if (!q) {
    return [];
  }

  const trains =
    await loadTrains();

  const numberMatches: TrainSuggestion[] =
    [];

  const nameMatches: TrainSuggestion[] =
    [];

  for (const train of trains) {
    const number =
      train.number.toLowerCase();

    const name =
      train.name.toLowerCase();

    if (number.startsWith(q)) {
      numberMatches.push(train);
      continue;
    }

    if (name.includes(q)) {
      nameMatches.push(train);
    }
  }

  return [
    ...numberMatches,
    ...nameMatches,
  ].slice(0, 20);
}

export async function searchStations(
  query: string
): Promise<StationSuggestion[]> {
  const q =
    query.trim().toLowerCase();

  if (!q) {
    return [];
  }

  const stations =
    await getStations();

  if (stations.length > 0) {
    return filterStations(
      stations,
      q
    );
  }

  return searchStationsFromFallback(
    query
  );
}