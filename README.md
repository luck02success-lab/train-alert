# Train Alert

Train Alert helps a passenger get ready for an upcoming stop. This repository is the production foundation only: it does not yet poll trains independently or send FCM notifications.

## Layout

- `backend/` — TypeScript HTTP API and domain logic
- `android/` — Kotlin/Compose client foundation
- `docs/` — operational design and contracts

## Local backend

```sh
cd backend
npm install
npm test
npm run typecheck
```

Set `DATABASE_URL` and `RAILRADAR_API_KEY` only in the server environment. See [deployment](docs/deployment.md).
