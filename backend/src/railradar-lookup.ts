import {
  getStationCatalog,
  getTrainCatalog,
  searchStations as searchStationCatalog,
  searchTrains as searchTrainCatalog,
  type StationSuggestion,
  type TrainSuggestion,
} from "./railway-catalog-cache.js";

export type {
  StationSuggestion,
  TrainSuggestion,
};

export async function searchStations(
  query: string
): Promise<StationSuggestion[]> {
  const stations =
    await getStationCatalog();

  return searchStationCatalog(
    stations,
    query
  );
}

export async function searchTrains(
  query: string
): Promise<TrainSuggestion[]> {
  const trains =
    await getTrainCatalog();

  return searchTrainCatalog(
    trains,
    query
  );
}