import {
  RailRadarProvider,
} from "./providers/railradar.js";

import {
  NtesProvider,
} from "./providers/ntes.js";

import {
  RailProviderGateway,
} from "./rail-provider-gateway.js";

import type {
  RailProvider,
} from "./rail-provider.js";


export function createRailProviderGateway(): RailProviderGateway {
  const providers: RailProvider[] = [];

  if (process.env.RAILRADAR_API_KEY) {
    providers.push(
      new RailRadarProvider()
    );
  }

  const ntesBaseUrl =
  process.env.NTES_PROVIDER_BASE_URL?.trim();

const ntesApiKey =
  process.env.NTES_PROVIDER_API_KEY?.trim();

if (ntesBaseUrl && ntesApiKey) {
  providers.push(
    new NtesProvider(
      ntesBaseUrl,
      ntesApiKey
    )
  );
}

  if (providers.length === 0) {
    throw new Error(
      "No rail providers configured. " +
      "Configure RAILRADAR_API_KEY or " +
      "NTES_PROVIDER_BASE_URL."
    );
  }

  return new RailProviderGateway(
    providers
  );
}