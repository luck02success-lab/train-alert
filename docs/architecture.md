# Architecture
Android calls the TypeScript API only. The API owns PostgreSQL state and a server-only `RailwayProvider`. A separately deployed worker will poll active journeys, update ETAs transactionally, create versioned alerts, and claim deliveries with row locking. FCM is intentionally not implemented.
