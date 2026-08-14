# RailWake

**Wake up before your stop.**

RailWake helps passengers get ready for an upcoming train stop. It monitors the journey, keeps the destination ETA updated, and sends timely alerts before it is time to get off — including when the train runs late or early.

## Product promise

RailWake is intentionally focused on one job:

**Help users avoid missing their train stop.**

It is not a booking, PNR, route-discovery, or general train-tracking product.

## How it works

1. Add your train, journey date, and destination.
2. RailWake monitors the journey and updates the destination ETA.
3. Alerts are adjusted when the train runs late or early.
4. The app wakes you before it is time to get off.

## Repository layout

- `backend/` — TypeScript HTTP API and domain logic
- `android/` — Kotlin/Compose Android client
- `docs/` — operational design and contracts

## Local backend

```sh
cd backend
npm install
npm test
npm run typecheck