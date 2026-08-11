import { describe, expect, it } from "vitest";
import { planAlerts } from "../src/alert-engine.js";
import type { Journey } from "../src/domain.js";
const journey: Journey = {id:"j",userId:"u",trainNumber:"12345",journeyDate:"2026-08-12",destinationStationCode:"NDLS",destinationStationName:"New Delhi",state:"active",providerState:"available",currentEta:new Date("2026-08-12T19:07:00Z"),currentDelayMinutes:null,lastProviderUpdateAt:new Date("2026-08-12T17:00:00Z"),scheduleVersion:3};
describe("alert planner", () => it("uses a deterministic per-version identity", () => { const plans=planAlerts(journey); expect(plans).toHaveLength(5); expect(plans[0]).toMatchObject({scheduledFor:new Date("2026-08-12T17:07:00Z"),deterministicKey:"j:120:3"}); expect(new Set(plans.map(x=>x.deterministicKey)).size).toBe(5); }));
