# Database
Migration `001_initial.sql` defines UUID-backed users, devices, journeys, alerts, and deliveries. Unique `(journey_id, offset_minutes, schedule_version)` prevents duplicate alert creation; unique `(alert_id, device_id)` prevents duplicate delivery records.
