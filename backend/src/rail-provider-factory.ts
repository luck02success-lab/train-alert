import {
  RailRadarProvider,
} from "./providers/railradar.js";
import {
  NtesProvider,
} from "./providers/ntes.js";
import {
  RailProviderGateway,
} from "./rail-provider-gateway.js";
import type { RailProvider } from "./rail-provider.js";

export function createRailProviderGateway(): RailProviderGateway {
  const providers: RailProvider[] = [
    new RailRadarProvider(),
  ];

  /*
   * NTES is intentionally opt-in until an NTES bridge is deployed.
   *
   * The open-source ntes-client is Python and reverse-engineers the
   * official NTES mobile API. Our production backend is TypeScript/Vercel,
   * so invoking Python from the request path would be brittle.
   *
   * Set NTES_PROVIDER_BASE_URL to a small service running ntes-client
   * when ready. The adapter below then participates in exactly the same
   * failover chain.
   */
  if (process.env.NTES_PROVIDER_BASE_URL) {
    providers.push(
      new NtesProvider(
        process.env.NTES_PROVIDER_BASE_URL
      )
    );
  }

  return new RailProviderGateway(providers);
}
