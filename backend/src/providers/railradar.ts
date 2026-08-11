import type { RailwayProvider, LiveTrain } from "../domain.js";

/** Server-only adapter. Endpoint/response mapping must be implemented from RailRadar's authenticated API documentation. */
export class RailRadarProvider implements RailwayProvider {
  constructor(private readonly apiKey = process.env.RAILRADAR_API_KEY) { if (!apiKey) throw new Error("RAILRADAR_API_KEY is required"); }
  async getLiveTrain(_trainNumber: string, _journeyDate: string): Promise<LiveTrain> { throw new Error("RailRadar live-train mapping is not implemented"); }
  async searchStations(_query: string): Promise<Array<{code: string; name: string}>> { throw new Error("RailRadar station-search mapping is not implemented"); }
}
