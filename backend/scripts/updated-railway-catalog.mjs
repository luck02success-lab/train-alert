import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");

const STATIONS_URL =
  "https://raw.githubusercontent.com/datameet/railways/master/stations.json";

const TRAINS_URL =
  "https://raw.githubusercontent.com/datameet/railways/master/trains.json";

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "RailWakeCatalogUpdater/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `${url} returned HTTP ${response.status}`
    );
  }

  return response.json();
}

function normalizeStations(payload) {
  if (
    !payload ||
    typeof payload !== "object" ||
    payload.type !== "FeatureCollection" ||
    !Array.isArray(payload.features)
  ) {
    throw new Error(
      "Unexpected stations.json format"
    );
  }

  const seen = new Set();

  const stations = [];

  for (const feature of payload.features) {
    const properties =
      feature?.properties;

    if (
      !properties ||
      typeof properties !== "object"
    ) {
      continue;
    }

    const code =
      typeof properties.code === "string"
        ? properties.code.trim().toUpperCase()
        : "";

    const name =
      typeof properties.name === "string"
        ? properties.name.trim()
        : "";

    if (!code || !name) {
      continue;
    }

    const key =
      `${code}|${name.toLowerCase()}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    stations.push({
      code,
      name,
    });
  }

  stations.sort((a, b) =>
    a.name.localeCompare(
      b.name,
      "en"
    )
  );

  return stations;
}

function normalizeTrains(payload) {
  if (
    !payload ||
    typeof payload !== "object" ||
    payload.type !== "FeatureCollection" ||
    !Array.isArray(payload.features)
  ) {
    throw new Error(
      "Unexpected trains.json format"
    );
  }

  const seen = new Set();

  const trains = [];

  for (const feature of payload.features) {
    const properties =
      feature?.properties;

    if (
      !properties ||
      typeof properties !== "object"
    ) {
      continue;
    }

    const number =
      typeof properties.number === "string" ||
      typeof properties.number === "number"
        ? String(
            properties.number
          ).trim()
        : "";

    const name =
      typeof properties.name === "string"
        ? properties.name.trim()
        : "";

    if (!number || !name) {
      continue;
    }

    const key =
      `${number}|${name.toLowerCase()}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    trains.push({
      number,
      name,
    });
  }

  trains.sort((a, b) => {
    const numberCompare =
      a.number.localeCompare(
        b.number
      );

    if (numberCompare !== 0) {
      return numberCompare;
    }

    return a.name.localeCompare(
      b.name,
      "en"
    );
  });

  return trains;
}

async function writeJson(
  filename,
  value
) {
  await fs.mkdir(
    DATA_DIR,
    { recursive: true }
  );

  const destination =
    path.join(
      DATA_DIR,
      filename
    );

  await fs.writeFile(
    destination,
    `${JSON.stringify(value)}\n`,
    "utf8"
  );

  const stat =
    await fs.stat(destination);

  console.log(
    `${filename}: ${value.length} records, ${stat.size} bytes`
  );
}

const [
  stationsPayload,
  trainsPayload,
] = await Promise.all([
  fetchJson(STATIONS_URL),
  fetchJson(TRAINS_URL),
]);

const stations =
  normalizeStations(
    stationsPayload
  );

const trains =
  normalizeTrains(
    trainsPayload
  );

if (stations.length < 1000) {
  throw new Error(
    `Station catalogue looks suspiciously small: ${stations.length}`
  );
}

if (trains.length < 1000) {
  throw new Error(
    `Train catalogue looks suspiciously small: ${trains.length}`
  );
}

await writeJson(
  "stations.json",
  stations
);

await writeJson(
  "trains.json",
  trains
);

console.log(
  "Railway catalogue updated successfully."
);