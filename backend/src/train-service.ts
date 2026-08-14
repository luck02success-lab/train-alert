import {
  ProviderError,
  RailRadarProvider,
  type TrainLiveStatus,
} from "./providers/railradar.js";

export class ApiError
  extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export function validateLiveQuery(
  number: string,
  date: string | undefined
): string {
  if (!/^\d{5}$/.test(number)) {
    throw new ApiError(
      400,
      "INVALID_TRAIN_NUMBER",
      "Train number must contain exactly 5 digits."
    );
  }

  if (
    !date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      date
    ) ||
    Number.isNaN(
      Date.parse(
        `${date}T00:00:00Z`
      )
    )
  ) {
    throw new ApiError(
      400,
      "INVALID_JOURNEY_DATE",
      "Journey date must be a valid ISO date."
    );
  }

  return date;
}

function dateValue(
  value:
    | string
    | null
    | undefined
): Date | null {
  if (!value) {
    return null;
  }

  const parsed =
    new Date(value);

  return Number.isNaN(
    parsed.getTime()
  )
    ? null
    : parsed;
}

function destinationLooksSuspicious(
  live: TrainLiveStatus,
  destinationStationCode: string,
  now: Date
): boolean {
  const destination =
    live.stops.find(
      (stop) =>
        stop.stationCode ===
        destinationStationCode
    );

  if (!destination) {
    return true;
  }

  /*
   * If destination is still the next halt, always consider any
   * actual-arrival timestamp suspicious until cross-checked.
   */
  const destinationIsNext =
    live.nextStationCode ===
      destinationStationCode ||
    live.nextStation ===
      destination.stationName;

  if (
    destinationIsNext &&
    (
      destination.actualArrival ||
      destination.actualDeparture
    )
  ) {
    return true;
  }

  /*
   * Same logic using actual route position.
   */
  if (
    live.isActualPosition &&
    typeof live.currentSequence ===
      "number" &&
    typeof destination.sequence ===
      "number" &&
    destination.sequence >
      live.currentSequence &&
    (
      destination.actualArrival ||
      destination.actualDeparture
    )
  ) {
    return true;
  }

  const stopStatus =
    destination.status
      ?.trim()
      .toLowerCase();

  if (
    (
      stopStatus ===
        "upcoming" ||
      stopStatus ===
        "scheduled"
    ) &&
    (
      destination.actualArrival ||
      destination.actualDeparture
    )
  ) {
    return true;
  }

  const expected =
    dateValue(
      destination.expectedArrival
    );

  if (
    expected &&
    expected.getTime() <=
      now.getTime() &&
    !destination.actualArrival &&
    !destination.actualDeparture
  ) {
    return true;
  }

  return false;
}

export class TrainService {
  constructor(
    private readonly provider:
      RailRadarProvider =
        new RailRadarProvider()
  ) {}

  async live(
    number: string,
    date: string,
    destinationStationCode?:
      string
  ): Promise<TrainLiveStatus> {
    validateLiveQuery(
      number,
      date
    );

    try {
      let live =
        await this.provider
          .getLiveTrain(
            number,
            date
          );

      if (
        destinationStationCode &&
        destinationLooksSuspicious(
          live,
          destinationStationCode,
          new Date()
        )
      ) {
        live =
          await this.provider
            .enrichDestinationWhenSuspicious(
              live,
              destinationStationCode
            );
      }

      return live;
    } catch (error) {
      if (
        error instanceof
        ProviderError
      ) {
        const mapping:
          Record<
            ProviderError["code"],
            readonly [
              number,
              string
            ]
          > = {
          UNAUTHORIZED: [
            502,
            "PROVIDER_AUTHENTICATION_FAILED",
          ],

          TRAIN_NOT_FOUND: [
            404,
            "TRAIN_NOT_FOUND",
          ],

          STATION_NOT_FOUND: [
            503,
            "DESTINATION_LIVE_DATA_UNAVAILABLE",
          ],

          RATE_LIMITED: [
            429,
            "PROVIDER_RATE_LIMITED",
          ],

          UNAVAILABLE: [
            503,
            "PROVIDER_UNAVAILABLE",
          ],

          MALFORMED_RESPONSE: [
            502,
            "MALFORMED_PROVIDER_RESPONSE",
          ],
        };

        const [
          status,
          code,
        ] =
          mapping[
            error.code
          ];

        throw new ApiError(
          status,
          code,
          code ===
            "TRAIN_NOT_FOUND"
            ? "The requested train could not be found."
            : code ===
                "DESTINATION_LIVE_DATA_UNAVAILABLE"
              ? "Live data for the destination station is temporarily unavailable."
              : "Railway data is currently unavailable."
        );
      }

      throw error;
    }
  }
}