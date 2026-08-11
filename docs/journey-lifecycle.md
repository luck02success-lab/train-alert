# Journey lifecycle
Open journeys transition `scheduled → active → completed`; scheduled/active may transition to cancelled. Provider outages do not fail a journey. Migration 002 uses a partial unique index to prevent duplicate open journeys per user/train/date/destination. Future worker refreshes must reschedule only pending alerts; sent alert/delivery history remains immutable.
