import {
  ProviderError,
  type TrainLiveStatus,
  type StationLiveBoard,
} from "./providers/railradar.js";
import type { RailProvider } from "./rail-provider.js";

type ProviderState = {
  consecutiveFailures: number;
  cooldownUntil: number;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  lastLatencyMs: number | null;
};

export type ProviderAttempt = {
  provider: string;
  latencyMs: number;
  fallback: boolean;
};

export type ProviderCallResult<T> = {
  data: T;
  provider: string;
  fallbackUsed: boolean;
  attempts: ProviderAttempt[];
};

const DEFAULT_COOLDOWN_MS = 2 * 60_000;
const RATE_LIMIT_COOLDOWN_MS = 30 * 60_000;
const MAX_FAILURE_COOLDOWN_MS = 15 * 60_000;

function isRetryable(error: unknown): boolean {
  return (
    error instanceof ProviderError &&
    (
      error.code === "RATE_LIMITED" ||
      error.code === "UNAVAILABLE" ||
      error.code === "MALFORMED_RESPONSE" ||
      error.code === "UNAUTHORIZED"
    )
  );
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof ProviderError &&
    (
      error.code === "TRAIN_NOT_FOUND" ||
      error.code === "STATION_NOT_FOUND"
    )
  );
}

export class RailProviderGateway {
  private readonly state = new Map<string, ProviderState>();

  constructor(
    private readonly providers: readonly RailProvider[]
  ) {
    if (providers.length === 0) {
      throw new Error("At least one rail provider is required.");
    }

    for (const provider of providers) {
      this.state.set(provider.name, {
        consecutiveFailures: 0,
        cooldownUntil: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
        lastLatencyMs: null,
      });
    }
  }

  getProviderStates(): ReadonlyMap<string, ProviderState> {
    return this.state;
  }

  private isAvailable(provider: RailProvider): boolean {
    const current = this.state.get(provider.name);
    return !current || current.cooldownUntil <= Date.now();
  }

  private recordSuccess(
    provider: RailProvider,
    latencyMs: number
  ): void {
    const current = this.state.get(provider.name)!;

    current.consecutiveFailures = 0;
    current.cooldownUntil = 0;
    current.lastSuccessAt = Date.now();
    current.lastLatencyMs = latencyMs;
  }

  private recordFailure(
    provider: RailProvider,
    error: unknown
  ): void {
    const current = this.state.get(provider.name)!;
    const now = Date.now();

    current.consecutiveFailures += 1;
    current.lastFailureAt = now;

    const isRateLimited =
      error instanceof ProviderError &&
      error.code === "RATE_LIMITED";

    if (isRateLimited) {
      current.cooldownUntil =
        now + RATE_LIMIT_COOLDOWN_MS;
      return;
    }

    const multiplier = Math.min(
      current.consecutiveFailures,
      5
    );

    current.cooldownUntil =
      now +
      Math.min(
        DEFAULT_COOLDOWN_MS * multiplier,
        MAX_FAILURE_COOLDOWN_MS
      );
  }

  async getLiveTrain(
    trainNumber: string,
    journeyDate: string
  ): Promise<ProviderCallResult<TrainLiveStatus>> {
    return this.call(
      (provider) =>
        provider.getLiveTrain(
          trainNumber,
          journeyDate
        )
    );
  }

  async getStationLiveBoard(
    stationCode: string,
    hoursAhead = 4
  ): Promise<ProviderCallResult<StationLiveBoard>> {
    return this.call(
      (provider) =>
        provider.getStationLiveBoard(
          stationCode,
          hoursAhead
        )
    );
  }

  async enrichDestinationWhenSuspicious(
    live: TrainLiveStatus,
    destinationStationCode: string,
    preferredProviderName?: string
  ): Promise<ProviderCallResult<TrainLiveStatus>> {
    const ordered = this.providers.filter(
      (provider) =>
        provider.enrichDestinationWhenSuspicious &&
        this.isAvailable(provider)
    );

    ordered.sort((a, b) => {
      if (a.name === preferredProviderName) return -1;
      if (b.name === preferredProviderName) return 1;
      return 0;
    });

    let lastError: unknown = null;
    const attempts: ProviderAttempt[] = [];

    for (const [index, provider] of ordered.entries()) {
      const started = Date.now();

      try {
        const data =
          await provider.enrichDestinationWhenSuspicious!(
            live,
            destinationStationCode
          );

        const latencyMs = Date.now() - started;
        this.recordSuccess(provider, latencyMs);

        attempts.push({
          provider: provider.name,
          latencyMs,
          fallback: index > 0,
        });

        return {
          data,
          provider: provider.name,
          fallbackUsed: index > 0,
          attempts,
        };
      } catch (error) {
        lastError = error;
        const latencyMs = Date.now() - started;
        attempts.push({
          provider: provider.name,
          latencyMs,
          fallback: index > 0,
        });

        if (isRetryable(error)) {
          this.recordFailure(provider, error);
          continue;
        }

        throw error;
      }
    }

    if (lastError) {
      throw lastError;
    }

    return {
      data: live,
      provider:
        preferredProviderName ??
        this.providers[0]?.name ?? "unknown",
      fallbackUsed: false,
      attempts,
    };
  }

  private async call<T>(
    operation: (
      provider: RailProvider
    ) => Promise<T>
  ): Promise<ProviderCallResult<T>> {
    let lastError: unknown = null;
    const attempts: ProviderAttempt[] = [];

    for (const provider of this.providers) {
      if (!this.isAvailable(provider)) {
        continue;
      }

      const started = Date.now();

      try {
        const data = await operation(provider);
        const latencyMs = Date.now() - started;

        this.recordSuccess(provider, latencyMs);

        attempts.push({
          provider: provider.name,
          latencyMs,
          fallback: attempts.length > 0,
        });

        return {
          data,
          provider: provider.name,
          fallbackUsed: attempts.length > 0,
          attempts,
        };
      } catch (error) {
        lastError = error;
        const latencyMs = Date.now() - started;

        attempts.push({
          provider: provider.name,
          latencyMs,
          fallback: attempts.length > 0,
        });

        if (
          isRetryable(error) ||
          isNotFound(error)
        ) {
          this.recordFailure(provider, error);
          continue;
        }

        throw error;
      }
    }

    if (lastError) {
      throw lastError;
    }

    throw new ProviderError(
      "UNAVAILABLE",
      "All configured rail providers are temporarily unavailable."
    );
  }
}
