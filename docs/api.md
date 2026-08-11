# API contract
`POST /api/journeys`, `GET /api/journeys/:id`, `DELETE /api/journeys/:id`, `GET /api/trains/:number/live`, `GET /api/stations/search`, and `POST /api/devices` are the planned surface. All require authenticated ownership except train/station discovery, which requires rate limiting. Request/response types are in `backend/src/api-contract.ts`.
