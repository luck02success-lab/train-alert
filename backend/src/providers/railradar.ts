export interface TrainLiveStop {
  sequence?: number | null;

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

  isHalt?: boolean;
  distance?: number | null;
  speedToNextStationKmph?: number | null;
  platform?: string | null;
}

export interface TrainException {
  type: string;
  message: string;
}

export interface TrainLiveStatus {
  trainNumber: string;
  trainName?: string | null;
  journeyDate: string;

  status:
    | "running"
    | "not-started"
    | "completed"
    | "cancelled"
    | "unknown";

  currentStation: string | null;
  currentStationCode: string | null;

  previousStation: string | null;
  previousStationCode?: string | null;
  previousStationSequence?: number | null;

  nextStation: string | null;
  nextStationCode?: string | null;
  nextStationSequence?: number | null;

  currentSequence?: number | null;

  isActualPosition?: boolean;
  isDiverted?: boolean;
  segmentProgress?: number | null;
  speedKmh?: number | null;

  delayMinutes: number | null;

  latitude: number | null;
  longitude: number | null;

  observedAt?: Date;

  stops: TrainLiveStop[];

  destinationLiveType?:
    | "at-station"
    | "upcoming"
    | "departed"
    | "scheduled"
    | null;

  destinationLiveExpectedArrival?: string | null;
  destinationLiveExpectedDeparture?: string | null;
  destinationLiveDelayMinutes?: number | null;

  exceptions?: TrainException[];
}

export interface StationLiveTrain {
  trainNumber: string;
  trainName: string | null;

  status:
    | "at-station"
    | "upcoming"
    | "departed"
    | "scheduled"
    | "unknown";

  sequence: number | null;

  expectedArrivalTime: string | null;
  expectedDepartureTime: string | null;

  delayMinutes: number | null;

  platform: string | null;
}

export interface StationLiveBoard {
  stationCode: string;
  stationName: string;
  trains: StationLiveTrain[];
}

export interface TrainDetails {
  trainNumber: string;
  trainName: string | null;
  sourceCode: string | null;
  destinationCode: string | null;

  runDays: string[];

  distanceKm: number | null;
  durationMinutes: number | null;

  stops: TrainLiveStop[];
}

export class ProviderError extends Error {
  constructor(
    readonly code:
      | "UNAUTHORIZED"
      | "TRAIN_NOT_FOUND"
      | "STATION_NOT_FOUND"
      | "RATE_LIMITED"
      | "UNAVAILABLE"
      | "MALFORMED_RESPONSE",
    message =
      "Railway data is currently unavailable."
  ) {
    super(message);
  }
}

type Json = Record<string, unknown>;

function object(value: unknown): Json {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new ProviderError(
      "MALFORMED_RESPONSE"
    );
  }

  return value as Json;
}

function string(
  value: unknown
): string | null {
  return typeof value === "string"
    ? value
    : null;
}

function number(
  value: unknown
): number | null {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : null;
}

function boolean(
  value: unknown
): boolean {
  return typeof value === "boolean"
    ? value
    : false;
}

function dateString(
  value: unknown
): string | null {
  const raw = string(value);

  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);

  return Number.isNaN(
    parsed.getTime()
  )
    ? null
    : raw;
}

function parseDate(
  value:
    | string
    | null
    | undefined
): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(
    parsed.getTime()
  )
    ? null
    : parsed;
}

function parseTrainStatus(
  value: unknown
): TrainLiveStatus["status"] {
  const raw = string(value);

  if (
    raw === "running" ||
    raw === "not-started" ||
    raw === "completed" ||
    raw === "cancelled"
  ) {
    return raw;
  }

  return "unknown";
}

function parseStationLiveType(
  value: unknown
): StationLiveTrain["status"] {
  const raw = string(value);

  if (
    raw === "at-station" ||
    raw === "upcoming" ||
    raw === "departed" ||
    raw === "scheduled"
  ) {
    return raw;
  }

  return "unknown";
}

function parseStop(
  rawStop: unknown
): TrainLiveStop {
  const stop = object(rawStop);

  const stationCode =
    string(
      stop.stationCode
    );

  if (!stationCode) {
    throw new ProviderError(
      "MALFORMED_RESPONSE"
    );
  }

  return {
    sequence:
      number(
        stop.sequence
      ),

    stationCode,

    stationName:
      string(
        stop.stationName
      ) ?? "",

    isHalt:
      boolean(
        stop.isHalt
      ),

    scheduledArrival:
      dateString(
        stop.scheduledArrival
      ),

    scheduledDeparture:
      dateString(
        stop.scheduledDeparture
      ),

    expectedArrival:
      dateString(
        stop.expectedArrival
      ),

    expectedDeparture:
      dateString(
        stop.expectedDeparture
      ),

    actualArrival:
      dateString(
        stop.actualArrival
      ),

    actualDeparture:
      dateString(
        stop.actualDeparture
      ),

    delayMinutes:
      number(
        stop.delayArrival
      ) ??
      number(
        stop.delayDeparture
      ) ??
      number(
        stop.delayMinutes
      ),

    status:
      string(
        stop.status
      ),

    distance:
      number(
        stop.distance
      ),

    speedToNextStationKmph:
      number(
        stop.speedToNextStationKmph
      ),

    platform:
      string(
        stop.platform
      ),
  };
}

export class RailRadarProvider {
  constructor(
    private readonly apiKey =
      process.env.RAILRADAR_API_KEY,

    private readonly fetcher:
      typeof fetch = fetch
  ) {
    if (!apiKey) {
      throw new Error(
        "RAILRADAR_API_KEY is required"
      );
    }
  }

  private async request(
    url: string
  ): Promise<Json> {
    let response: Response;

    try {
      response =
        await this.fetcher(
          url,
          {
            headers: {
              Authorization:
                `Bearer ${this.apiKey}`,
            },

            signal:
              AbortSignal.timeout(
                8_000
              ),
          }
        );
    } catch {
      throw new ProviderError(
        "UNAVAILABLE"
      );
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

    try {
      return object(
        await response.json()
      );
    } catch {
      throw new ProviderError(
        "MALFORMED_RESPONSE"
      );
    }
  }

  async getLiveTrain(
    trainNumber: string,
    journeyDate?: string
  ): Promise<TrainLiveStatus> {
    const dateQuery =
      journeyDate
        ? `?date=${encodeURIComponent(
            journeyDate
          )}&haltsOnly=true`
        : "?haltsOnly=true";

    const body =
      await this.request(
        `https://api.railradar.in/v1/trains/${encodeURIComponent(
          trainNumber
        )}/live${dateQuery}`
      );

    const data =
      object(body.data);

    const currentLocation =
      data.currentLocation
        ? object(
            data.currentLocation
          )
        : {};

    const previousHalt =
      data.previousHalt
        ? object(
            data.previousHalt
          )
        : null;

    const nextHalt =
      data.nextHalt
        ? object(
            data.nextHalt
          )
        : null;

    const rawRoute =
      Array.isArray(
        data.route
      )
        ? data.route
        : [];

    if (
      rawRoute.length === 0
    ) {
      throw new ProviderError(
        "MALFORMED_RESPONSE"
      );
    }

    const stops =
      rawRoute.map(
        parseStop
      );

    const rawExceptions =
      Array.isArray(
        data.exceptions
      )
        ? data.exceptions
        : [];

    const exceptions:
      TrainException[] =
      rawExceptions.map(
        (
          rawException
        ) => {
          const exception =
            object(
              rawException
            );

          return {
            type:
              string(
                exception.type
              ) ??
              "UNKNOWN",

            message:
              string(
                exception.message
              ) ??
              "Train route exception reported by provider.",
          };
        }
      );

    const observedAtRaw =
      string(
        data.lastUpdatedAt
      );

    const observedAt =
      observedAtRaw
        ? new Date(
            observedAtRaw
          )
        : new Date();

    if (
      Number.isNaN(
        observedAt.getTime()
      )
    ) {
      throw new ProviderError(
        "MALFORMED_RESPONSE"
      );
    }

    return {
      trainNumber:
        string(
          data.trainNumber
        ) ??
        trainNumber,

      trainName:
        string(
          data.trainName
        ),

      journeyDate:
        string(
          data.startDate
        ) ??
        journeyDate ??
        observedAt
          .toISOString()
          .slice(
            0,
            10
          ),

      status:
        parseTrainStatus(
          data.status
        ),

      currentStation:
        string(
          currentLocation.stationName
        ) ??
        string(
          data.currentStation
        ),

      currentStationCode:
        string(
          currentLocation.stationCode
        ) ??
        string(
          data.currentStationCode
        ),

      previousStation:
        string(
          previousHalt?.stationName
        ) ??
        string(
          data.previousStation
        ),

      previousStationCode:
        string(
          previousHalt?.stationCode
        ),

      previousStationSequence:
        number(
          previousHalt?.sequence
        ),

      nextStation:
        string(
          nextHalt?.stationName
        ) ??
        string(
          data.nextStation
        ),

      nextStationCode:
        string(
          nextHalt?.stationCode
        ),

      nextStationSequence:
        number(
          nextHalt?.sequence
        ),

      currentSequence:
        number(
          currentLocation.sequence
        ),

      isActualPosition:
        boolean(
          currentLocation
            .isActualPosition
        ),

      isDiverted:
        boolean(
          currentLocation
            .isDiverted
        ),

      segmentProgress:
        number(
          currentLocation
            .segmentProgress
        ),

      speedKmh:
        number(
          currentLocation.speedKmh
        ),

      delayMinutes:
        number(
          data.delayMinutes
        ),

      latitude:
        number(
          currentLocation.lat
        ) ??
        number(
          currentLocation.latitude
        ),

      longitude:
        number(
          currentLocation.lng
        ) ??
        number(
          currentLocation.longitude
        ),

      observedAt,

      stops,

      exceptions,
    };
  }

  async getStationLiveBoard(
    stationCode: string,
    hoursAhead = 4
  ): Promise<StationLiveBoard> {
    const safeHours =
      [2, 4, 6, 8].includes(
        hoursAhead
      )
        ? hoursAhead
        : 4;

    try {
      const body =
        await this.request(
          `https://api.railradar.in/v1/stations/${encodeURIComponent(
            stationCode.toUpperCase()
          )}/live?hours=${safeHours}&includeIntermediate=false`
        );

      const data =
        object(body.data);

      const station =
        data.station
          ? object(
              data.station
            )
          : {};

      const rawTrains =
        Array.isArray(
          data.trains
        )
          ? data.trains
          : [];

      const trains =
        rawTrains
          .map(
            (
              rawTrain
            ) => {
              const entry =
                object(
                  rawTrain
                );

              const train =
                entry.train
                  ? object(
                      entry.train
                    )
                  : {};

              const stop =
                entry.stop
                  ? object(
                      entry.stop
                    )
                  : {};

              const live =
                entry.live
                  ? object(
                      entry.live
                    )
                  : {};

              return {
                trainNumber:
                  string(
                    train.number
                  ) ?? "",

                trainName:
                  string(
                    train.name
                  ),

                status:
                  parseStationLiveType(
                    live.type
                  ),

                sequence:
                  number(
                    stop.sequence
                  ),

                expectedArrivalTime:
                  dateString(
                    live.expectedArrivalTime
                  ),

                expectedDepartureTime:
                  dateString(
                    live.expectedDepartureTime
                  ),

                delayMinutes:
                  number(
                    live.delayMinutes
                  ),

                platform:
                  string(
                    live.platform
                  ),
              } satisfies StationLiveTrain;
            }
          )
          .filter(
            (
              item
            ) =>
              item.trainNumber
                .length > 0
          );

      return {
        stationCode:
          string(
            station.code
          ) ??
          stationCode,

        stationName:
          string(
            station.name
          ) ??
          stationCode,

        trains,
      };
    } catch (error) {
      if (
        error instanceof
        ProviderError
      ) {
        if (
          error.code ===
          "TRAIN_NOT_FOUND"
        ) {
          throw new ProviderError(
            "STATION_NOT_FOUND",
            "Live station board is unavailable."
          );
        }

        throw error;
      }

      throw error;
    }
  }

  private destinationDataLooksContradictory(
    live: TrainLiveStatus,
    destination: TrainLiveStop,
    now: Date
  ): boolean {
    const actualArrival =
      parseDate(
        destination.actualArrival
      );

    const actualDeparture =
      parseDate(
        destination.actualDeparture
      );

    const expectedArrival =
      parseDate(
        destination.expectedArrival
      );

    const destinationSequence =
      number(
        destination.sequence
      );

    const currentSequence =
      number(
        live.currentSequence
      );

    /*
     * If the destination is explicitly still upcoming,
     * any past actual arrival is contradictory.
     */
    const stopStatus =
      destination.status
        ?.trim()
        .toLowerCase();

    if (
      (
        stopStatus === "upcoming" ||
        stopStatus === "scheduled"
      ) &&
      (
        actualArrival !== null ||
        actualDeparture !== null
      )
    ) {
      return true;
    }

    /*
     * If RailRadar says the destination is the next halt,
     * then a past actual arrival is inherently contradictory.
     */
    const destinationIsNextHalt =
      live.nextStationCode ===
      destination.stationCode ||
      live.nextStation ===
      destination.stationName;

    if (
      destinationIsNextHalt &&
      (
        actualArrival !== null ||
        actualDeparture !== null
      )
    ) {
      return true;
    }

    /*
     * Actual position with a destination sequence ahead means
     * the train is still before the destination.
     */
    if (
      live.isActualPosition &&
      currentSequence !== null &&
      destinationSequence !== null &&
      destinationSequence >
        currentSequence &&
      (
        actualArrival !== null ||
        actualDeparture !== null
      )
    ) {
      return true;
    }

    /*
     * A future departure is impossible to reconcile with a
     * destination that supposedly already had an arrival.
     */
    if (
      actualArrival !== null &&
      actualDeparture !== null &&
      actualDeparture.getTime() >
        now.getTime() &&
      actualArrival.getTime() <=
        now.getTime()
    ) {
      return true;
    }

    /*
     * A stale expected ETA without actual timestamps is also
     * suspicious and worth a station-board lookup.
     */
    if (
      expectedArrival !== null &&
      expectedArrival.getTime() <=
        now.getTime() &&
      !actualArrival &&
      !actualDeparture
    ) {
      return true;
    }

    return false;
  }

  async enrichDestinationWhenSuspicious(
    live: TrainLiveStatus,
    destinationCode: string,
    now = new Date()
  ): Promise<TrainLiveStatus> {
    const destination =
      live.stops.find(
        (stop) =>
          stop.stationCode ===
          destinationCode
      );

    if (!destination) {
      return live;
    }

    const suspicious =
      this.destinationDataLooksContradictory(
        live,
        destination,
        now
      );

    if (!suspicious) {
      return live;
    }

    let board:
      StationLiveBoard;

    try {
      board =
        await this.getStationLiveBoard(
          destinationCode,
          4
        );
    } catch (error) {
      /*
       * Failure of the cross-check is not evidence of arrival.
       */
      console.warn(
        "Destination station board unavailable",
        {
          trainNumber:
            live.trainNumber,

          destinationCode,

          error,
        }
      );

      return live;
    }

    const stationTrain =
      board.trains.find(
        (train) =>
          train.trainNumber ===
          live.trainNumber
      );

    if (!stationTrain) {
      /*
       * Absence from the station board is not proof that
       * the destination was reached.
       */
      return live;
    }

    const destinationLiveType =
      stationTrain.status ===
        "unknown"
        ? null
        : stationTrain.status;

    return {
      ...live,

      destinationLiveType,

      destinationLiveExpectedArrival:
        stationTrain
          .expectedArrivalTime,

      destinationLiveExpectedDeparture:
        stationTrain
          .expectedDepartureTime,

      destinationLiveDelayMinutes:
        stationTrain
          .delayMinutes,

      stops:
        live.stops.map(
          (stop) =>
            stop.stationCode ===
            destinationCode
              ? {
                  ...stop,

                  /*
                   * IMPORTANT:
                   * Only overwrite actualArrival/
                   * actualDeparture when station
                   * board itself provides stronger
                   * confirmation. The station board
                   * expected ETA must not be converted
                   * into an actual timestamp.
                   */
                  expectedArrival:
                    stationTrain
                      .expectedArrivalTime ??
                    stop.expectedArrival,

                  expectedDeparture:
                    stationTrain
                      .expectedDepartureTime ??
                    stop.expectedDeparture,

                  delayMinutes:
                    stationTrain
                      .delayMinutes ??
                    stop.delayMinutes,

                  /*
                   * If the station board says upcoming,
                   * explicitly restore upcoming status.
                   */
                  status:
                    stationTrain
                      .status ===
                      "upcoming"
                      ? "upcoming"
                      : stationTrain
                          .status ===
                          "scheduled"
                        ? "scheduled"
                        : stop.status,
                }
              : stop
        ),
    };
  }

  async getTrainDetails(
    trainNumber: string,
    journeyDate?: string
  ): Promise<TrainDetails> {
    const dateQuery =
      journeyDate
        ? `&journeyDate=${encodeURIComponent(
            journeyDate
          )}`
        : "";

    const body =
      await this.request(
        `https://api.railradar.in/v1/legacy/trains/${encodeURIComponent(
          trainNumber
        )}?dataType=full&dataProvider=railradar${dateQuery}`
      );

    return this.parseTrainDetails(
      body,
      trainNumber
    );
  }

  async getTrainDetailsFromNtes(
    trainNumber: string,
    journeyDate?: string
  ): Promise<TrainDetails> {
    const dateQuery =
      journeyDate
        ? `&journeyDate=${encodeURIComponent(
            journeyDate
          )}`
        : "";

    const body =
      await this.request(
        `https://api.railradar.in/v1/legacy/trains/${encodeURIComponent(
          trainNumber
        )}?dataType=full&dataProvider=NTES${dateQuery}`
      );

    return this.parseTrainDetails(
      body,
      trainNumber
    );
  }

  private parseTrainDetails(
    body: Json,
    trainNumber: string
  ): TrainDetails {
    const data =
      object(body.data);

    const train =
      data.train
        ? object(data.train)
        : {};

    const rawRoute =
      Array.isArray(
        data.route
      )
        ? data.route
        : [];

    const stops =
      rawRoute.map(
        parseStop
      );

    return {
      trainNumber:
        string(
          train.number
        ) ??
        trainNumber,

      trainName:
        string(
          train.name
        ),

      sourceCode:
        string(
          train.sourceCode
        ),

      destinationCode:
        string(
          train.destinationCode
        ),

      runDays:
        Array.isArray(
          train.runDays
        )
          ? train.runDays.filter(
              (
                value
              ): value is string =>
                typeof value ===
                "string"
            )
          : [],

      distanceKm:
        number(
          train.distance
        ),

      durationMinutes:
        number(
          train.duration
        ),

      stops,
    };
  }
}