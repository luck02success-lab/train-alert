import type { RailwayProvider, LiveTrain } from "../domain.js";

export class ProviderError extends Error { constructor(readonly code: "UNAUTHORIZED"|"TRAIN_NOT_FOUND"|"RATE_LIMITED"|"UNAVAILABLE"|"MALFORMED_RESPONSE", message = "Railway data is currently unavailable.") { super(message); } }
type Json = Record<string, unknown>;
const obj=(value:unknown):Json=> { if (!value || typeof value!=="object") throw new ProviderError("MALFORMED_RESPONSE"); return value as Json; };
const str=(v:unknown)=>typeof v === "string" ? v : null;
const num=(v:unknown)=>typeof v === "number" && Number.isFinite(v) ? v : null;
const date=(v:unknown)=> { const s=str(v); if (!s || Number.isNaN(Date.parse(s))) return null; return new Date(s); };

/** Server-only adapter for documented GET /v1/trains/{number}/live. Never expose raw provider JSON. */
export class RailRadarProvider implements RailwayProvider {
  constructor(private readonly apiKey=process.env.RAILRADAR_API_KEY, private readonly fetcher: typeof fetch=fetch) { if (!apiKey) throw new Error("RAILRADAR_API_KEY is required"); }
  async getLiveTrain(trainNumber:string, journeyDate:string):Promise<LiveTrain> {
    let response: Response;
    try { response=await this.fetcher(`https://api.railradar.in/v1/trains/${encodeURIComponent(trainNumber)}/live?date=${encodeURIComponent(journeyDate)}`,{headers:{Authorization:`Bearer ${this.apiKey}`},signal:AbortSignal.timeout(8_000)}); }
    catch { throw new ProviderError("UNAVAILABLE"); }
    if (!response.ok) throw new ProviderError(response.status===401?"UNAUTHORIZED":response.status===404?"TRAIN_NOT_FOUND":response.status===429?"RATE_LIMITED":"UNAVAILABLE");
    let body:Json; try { body=obj(await response.json()); } catch { throw new ProviderError("MALFORMED_RESPONSE"); }
    const data=obj(body.data); const route=(Array.isArray(data.route)?data.route:[]).map(x=>obj(x));
    // Domain's legacy minimal LiveTrain remains intentionally small; full normalized HTTP output is below.
    const last=route.length ? route[route.length-1]! : null;
    return {trainNumber:str(data.trainNumber)??trainNumber,observedAt:date(data.lastUpdatedAt)??new Date(),destination:last&&str(last.stationCode)?{code:str(last.stationCode)!,eta:date(last.actualArrival)??date(last.scheduledArrival)??date(last.expectedArrival)??new Date(NaN)}:null};
  }
  async searchStations(_query:string):Promise<Array<{code:string;name:string}>> { throw new ProviderError("UNAVAILABLE", "Station search is not yet supported by the configured provider contract."); }
}
export interface TrainLiveStatus { trainNumber:string; journeyDate:string; status:string|null; currentStation:string|null; currentStationCode:string|null; previousStation:string|null; nextStation:string|null; delayMinutes:number|null; latitude:number|null; longitude:number|null; stops: Array<{stationCode:string;stationName:string;scheduledArrival:string|null;scheduledDeparture:string|null;expectedArrival:string|null;expectedDeparture:string|null;actualArrival:string|null;actualDeparture:string|null;delayMinutes:number|null;status:string|null}>; }
export function normalizeLive(body:unknown, journeyDate:string):TrainLiveStatus {
 const data=obj(obj(body).data); const location: Json|null=data.currentLocation ? obj(data.currentLocation) : null; const stationCode=location ? str(location.stationCode) : null; const route: Json[]=(Array.isArray(data.route)?data.route:[]).map(x=>obj(x));
 const byCode=(v:unknown)=>{const x:Json|null=v ? obj(v) : null; return x?str(x.stationName):null};
 return {trainNumber:str(data.trainNumber)??"",journeyDate,status:str(data.status),currentStation:route.find(x=>str(x.stationCode)===stationCode)?str(route.find(x=>str(x.stationCode)===stationCode)!.stationName):null,currentStationCode:stationCode,previousStation:byCode(data.previousHalt),nextStation:byCode(data.nextHalt),delayMinutes:num(data.delayMinutes),latitude:null,longitude:null,stops:route.map(s=>({stationCode:str(s.stationCode)??"",stationName:str(s.stationName)??"",scheduledArrival:str(s.scheduledArrival),scheduledDeparture:str(s.scheduledDeparture),expectedArrival:null,expectedDeparture:null,actualArrival:str(s.actualArrival),actualDeparture:str(s.actualDeparture),delayMinutes:num(s.delayArrival)??num(s.delayDeparture),status:str(s.status)}))};
}
export async function fetchLiveStatus(trainNumber:string, journeyDate:string, apiKey=process.env.RAILRADAR_API_KEY, fetcher:typeof fetch=fetch):Promise<TrainLiveStatus> {
  if (!apiKey) throw new ProviderError("UNAUTHORIZED");
  let response:Response; try { response=await fetcher(`https://api.railradar.in/v1/trains/${encodeURIComponent(trainNumber)}/live?date=${encodeURIComponent(journeyDate)}`,{headers:{Authorization:`Bearer ${apiKey}`},signal:AbortSignal.timeout(8_000)}); } catch { throw new ProviderError("UNAVAILABLE"); }
  if (!response.ok) throw new ProviderError(response.status===401?"UNAUTHORIZED":response.status===404?"TRAIN_NOT_FOUND":response.status===429?"RATE_LIMITED":"UNAVAILABLE");
  try { return normalizeLive(await response.json(),journeyDate); } catch(e) { if(e instanceof ProviderError) throw e; throw new ProviderError("MALFORMED_RESPONSE"); }
}
