export type TrainSuggestion = {
  number: string;
  name: string;
};

export type StationSuggestion = {
  code: string;
  name: string;
};

type CatalogKind =
  | "stations"
  | "trains";

type CatalogEnvelope<T> = {
  version: 1;
  fetchedAt: string;
  data: T[];
};

type RedisResponse<T = unknown> = {
  result?: T;
  error?: string;
};

const RAILRADAR_BASE =
  "https://api.railradar.in";

const FRESH_TTL_SECONDS =
  10 * 24 * 60 * 60;

const STALE_TTL_SECONDS =
  30 * 24 * 60 * 60;

const RAILRADAR_TIMEOUT_MS =
  8_000;

const STATIONS_DATA_KEY =
  "railwake:catalog:stations:data";

const STATIONS_FRESH_KEY =
  "railwake:catalog:stations:fresh";

const TRAINS_DATA_KEY =
  "railwake:catalog:trains:data";

const TRAINS_FRESH_KEY =
  "railwake:catalog:trains:fresh";

function getRedisConfig(): {
  url: string;
  token: string;
} {
  const url =
  process.env.KV_REST_API_URL?.trim();

const token =
  process.env.KV_REST_API_TOKEN?.trim();

  if (!url || !token) {
  throw new Error(
    "KV_REST_API_URL and KV_REST_API_TOKEN are required"
  );
}

  return {
    url: url.replace(/\/+$/, ""),
    token,
  };
}

async function redisCommand<T>(
  command: unknown[]
): Promise<T> {
  const {
    url,
    token,
  } = getRedisConfig();

  const response =
    await fetch(
      url,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${token}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(
          command
        ),
        signal:
          AbortSignal.timeout(
            4_000
          ),
      }
    );

  if (!response.ok) {
    throw new Error(
      `Redis HTTP request failed: ${response.status}`
    );
  }

  const body =
    (await response.json()) as RedisResponse<T>;

  if (body.error) {
    throw new Error(
      `Redis command failed: ${body.error}`
    );
  }

  return body.result as T;
}

async function redisPipeline<T>(
  commands: unknown[][]
): Promise<T[]> {
  const {
    url,
    token,
  } = getRedisConfig();

  const response =
    await fetch(
      `${url}/pipeline`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${token}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(
          commands
        ),
        signal:
          AbortSignal.timeout(
            4_000
          ),
      }
    );

  if (!response.ok) {
    throw new Error(
      `Redis pipeline failed: ${response.status}`
    );
  }

  const body =
    (await response.json()) as RedisResponse<T>[];

  for (const item of body) {
    if (item.error) {
      throw new Error(
        `Redis pipeline command failed: ${item.error}`
      );
    }
  }

  return body.map(
    (item) => item.result as T
  );
}

function keysFor(
  kind: CatalogKind
): {
  data: string;
  fresh: string;
} {
  if (kind === "stations") {
    return {
      data:
        STATIONS_DATA_KEY,
      fresh:
        STATIONS_FRESH_KEY,
    };
  }

  return {
    data:
      TRAINS_DATA_KEY,
    fresh:
      TRAINS_FRESH_KEY,
  };
}

async function fetchRailRadar<T>(
  path: string
): Promise<T> {
  const apiKey =
    process.env.RAILRADAR_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "RAILRADAR_API_KEY is required"
    );
  }

  const response =
    await fetch(
      `${RAILRADAR_BASE}${path}`,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${apiKey}`,
          Accept:
            "application/json",
        },
        signal:
          AbortSignal.timeout(
            RAILRADAR_TIMEOUT_MS
          ),
      }
    );

  if (!response.ok) {
    throw new Error(
      `RailRadar returned ${response.status}`
    );
  }

  const body =
    (await response.json()) as {
      success?: boolean;
      data?: T;
    };

  if (
    body.success !== true ||
    body.data === undefined
  ) {
    throw new Error(
      "RailRadar returned an invalid response"
    );
  }

  return body.data;
}

async function readCatalog<T>(
  kind: CatalogKind
): Promise<{
  catalog: CatalogEnvelope<T> | null;
  fresh: boolean;
}> {
  const keys =
    keysFor(kind);

  const [
    rawData,
    rawFresh,
  ] = await redisPipeline<
    string | null
  >([
    ["GET", keys.data],
    ["GET", keys.fresh],
  ]);

  let catalog:
    CatalogEnvelope<T> | null =
      null;

  if (rawData) {
    try {
      catalog =
        JSON.parse(
          rawData
        ) as CatalogEnvelope<T>;
    } catch {
      catalog = null;
    }
  }

  return {
    catalog,
    fresh:
      rawFresh === "1",
  };
}

async function writeCatalog<T>(
  kind: CatalogKind,
  data: T[]
): Promise<void> {
  const keys =
    keysFor(kind);

  const payload:
    CatalogEnvelope<T> = {
      version: 1,
      fetchedAt:
        new Date().toISOString(),
      data,
    };

  /*
   * Keep the actual catalogue for 30 days so
   * stale data can still be served if RailRadar
   * is temporarily unavailable.
   *
   * The separate fresh marker expires after
   * 10 days and forces a refresh.
   */
  await redisPipeline([
    [
      "SET",
      keys.data,
      JSON.stringify(
        payload
      ),
      "EX",
      STALE_TTL_SECONDS,
    ],
    [
      "SET",
      keys.fresh,
      "1",
      "EX",
      FRESH_TTL_SECONDS,
    ],
  ]);
}

function normalizeStations(
  value: Record<
    string,
    string
  >
): StationSuggestion[] {
  return Object.entries(
    value
  )
    .filter(
      ([code, name]) =>
        Boolean(
          code?.trim()
        ) &&
        Boolean(
          name?.trim()
        )
    )
    .map(
      ([code, name]) => ({
        code:
          code
            .trim()
            .toUpperCase(),
        name:
          name.trim(),
      })
    )
    .sort(
      (a, b) =>
        a.name.localeCompare(
          b.name
        )
    );
}

function normalizeTrains(
  value: [
    string,
    string
  ][]
): TrainSuggestion[] {
  return value
    .filter(
      ([number, name]) =>
        Boolean(
          number?.trim()
        ) &&
        Boolean(
          name?.trim()
        )
    )
    .map(
      ([number, name]) => ({
        number:
          number.trim(),
        name:
          name.trim(),
      })
    );
}

async function refreshStations(): Promise<
  StationSuggestion[]
> {
  const raw =
    await fetchRailRadar<
      Record<string, string>
    >(
      "/v1/lookup/stations"
    );

  const stations =
    normalizeStations(raw);

  if (stations.length === 0) {
    throw new Error(
      "RailRadar returned an empty station catalogue"
    );
  }

  await writeCatalog(
    "stations",
    stations
  );

  console.info(
    "Railway station catalogue refreshed",
    {
      count:
        stations.length,
    }
  );

  return stations;
}

async function refreshTrains(): Promise<
  TrainSuggestion[]
> {
  const raw =
    await fetchRailRadar<
      [string, string][]
    >(
      "/v1/legacy/trains/all-kvs"
    );

  const trains =
    normalizeTrains(raw);

  if (trains.length === 0) {
    throw new Error(
      "RailRadar returned an empty train catalogue"
    );
  }

  await writeCatalog(
    "trains",
    trains
  );

  console.info(
    "Railway train catalogue refreshed",
    {
      count:
        trains.length,
    }
  );

  return trains;
}

async function getCatalog<T>(
  kind: CatalogKind,
  refresh: () => Promise<T[]>
): Promise<T[]> {
  const {
    catalog,
    fresh,
  } =
    await readCatalog<T>(
      kind
    );

  /*
   * Fresh catalogue:
   * never call RailRadar.
   */
  if (
    catalog &&
    fresh
  ) {
    return catalog.data;
  }

  /*
   * Stale but usable:
   * attempt one synchronous refresh.
   *
   * If RailRadar is unavailable, preserve the
   * stale catalogue rather than breaking lookup.
   */
  if (catalog) {
    try {
      return await refresh();
    } catch (error) {
      console.warn(
        "RailRadar catalogue refresh failed; serving stale catalogue",
        {
          kind,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        }
      );

      return catalog.data;
    }
  }

  /*
   * No cache exists at all.
   * We must bootstrap from RailRadar.
   */
  return refresh();
}

export async function getStationCatalog():
  Promise<
    StationSuggestion[]
  > {
  return getCatalog(
    "stations",
    refreshStations
  );
}

export async function getTrainCatalog():
  Promise<
    TrainSuggestion[]
  > {
  return getCatalog(
    "trains",
    refreshTrains
  );
}

export function searchStations(
  stations: StationSuggestion[],
  query: string
): StationSuggestion[] {
  const q =
    query
      .trim()
      .toLowerCase();

  if (!q) {
    return [];
  }

  const codeMatches:
    StationSuggestion[] = [];

  const nameMatches:
    StationSuggestion[] = [];

  for (const station of stations) {
    const code =
      station.code.toLowerCase();

    const name =
      station.name.toLowerCase();

    if (
      code.startsWith(q)
    ) {
      codeMatches.push(
        station
      );
      continue;
    }

    if (
      name.includes(q)
    ) {
      nameMatches.push(
        station
      );
    }
  }

  return [
    ...codeMatches,
    ...nameMatches,
  ].slice(0, 20);
}

export function searchTrains(
  trains: TrainSuggestion[],
  query: string
): TrainSuggestion[] {
  const q =
    query
      .trim()
      .toLowerCase();

  if (!q) {
    return [];
  }

  const numberMatches:
    TrainSuggestion[] = [];

  const nameMatches:
    TrainSuggestion[] = [];

  for (const train of trains) {
    const number =
      train.number.toLowerCase();

    const name =
      train.name.toLowerCase();

    if (
      number.startsWith(q)
    ) {
      numberMatches.push(
        train
      );
      continue;
    }

    if (
      name.includes(q)
    ) {
      nameMatches.push(
        train
      );
    }
  }

  return [
    ...numberMatches,
    ...nameMatches,
  ].slice(0, 20);
}