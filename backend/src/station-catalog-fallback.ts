type StationSuggestion = {
  code: string;
  name: string;
};

type RawStation = {
  stnCode?: unknown;
  stnName?: unknown;
};

type RawPayload = {
  stations?: unknown;
};

const STATION_CATALOG_URL =
  "https://raw.githubusercontent.com/IamYVJ/Indian_Railway_Stations_JSON/master/railwayStationsList.json";

const CACHE_TTL_MS =
  24 * 60 * 60 * 1000;

let cache:
  | {
      expiresAt: number;
      data: StationSuggestion[];
    }
  | null = null;

function normalizeStation(
  value: RawStation
): StationSuggestion | null {
  const code =
    typeof value.stnCode === "string"
      ? value.stnCode.trim().toUpperCase()
      : "";

  const name =
    typeof value.stnName === "string"
      ? value.stnName.trim()
      : "";

  if (!code || !name) {
    return null;
  }

  return {
    code,
    name,
  };
}

async function loadFallbackCatalogue(): Promise<
  StationSuggestion[]
> {
  const now = Date.now();

  if (
    cache &&
    cache.expiresAt > now
  ) {
    return cache.data;
  }

  const response =
    await fetch(
      STATION_CATALOG_URL,
      {
        headers: {
          Accept:
            "application/json",
        },
        signal:
          AbortSignal.timeout(
            6_000
          ),
      }
    );

  if (!response.ok) {
    throw new Error(
      `Fallback station catalogue returned ${response.status}`
    );
  }

  const payload =
    (await response.json()) as RawPayload;

  if (
    !Array.isArray(
      payload.stations
    )
  ) {
    throw new Error(
      "Fallback station catalogue has invalid format"
    );
  }

  const seen = new Set<string>();

  const stations =
    payload.stations
      .map(
        (value) =>
          normalizeStation(
            value as RawStation
          )
      )
      .filter(
        (
          value
        ): value is StationSuggestion =>
          value !== null
      )
      .filter((station) => {
        const key =
          `${station.code}|${station.name.toLowerCase()}`;

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });

  cache = {
    data: stations,
    expiresAt:
      now + CACHE_TTL_MS,
  };

  return stations;
}

export async function searchStationsFromFallback(
  query: string
): Promise<StationSuggestion[]> {
  const q =
    query.trim().toLowerCase();

  if (!q) {
    return [];
  }

  const stations =
    await loadFallbackCatalogue();

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