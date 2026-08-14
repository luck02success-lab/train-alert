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
   * Actual arrival/departure means the destination is explicitly
   * known to have been reached, so there is nothing to validate.
   */
  if (
    destination.actualArrival ||
    destination.actualDeparture
  ) {
    return false;
  }

  const expected =
    destination.expectedArrival
      ? new Date(
          destination.expectedArrival
        )
      : null;

  if (
    !expected ||
    Number.isNaN(
      expected.getTime()
    )
  ) {
    return true;
  }

  /*
   * A future expected ETA is normally trustworthy enough.
   */
  if (
    expected.getTime() >
    now.getTime()
  ) {
    return false;
  }

  /*
   * A past ETA without actual arrival/departure is suspicious.
   *
   * This is exactly the scenario where we've previously seen
   * delayed trains incorrectly reported as already reached.
   */
  return true;
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

      /*
       * Normal path:
       * one train-live request.
       *
       * Suspicious destination:
       * additionally query destination station live board.
       */
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