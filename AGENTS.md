# Train Alert engineering rules

- Never commit, return, log, or package RailRadar/FCM credentials or FCM tokens.
- Do not fabricate railway status, ETA, notifications, or provider responses.
- Keep RailRadar behind `RailwayProvider`; Android never calls it directly.
- PostgreSQL is the source of truth. Alert planning and delivery must be idempotent.
- API callers may access only their own journeys/devices after authentication is wired.
- Do not describe the alert worker or FCM as production-ready until implemented and deployed.
- Run backend tests and type checks before committing.
