CREATE TYPE alert_state AS ENUM ('pending','sending','sent','failed','cancelled');
ALTER TABLE journeys ADD COLUMN destination_station_name text NOT NULL DEFAULT '', ADD COLUMN current_delay_minutes integer, ADD COLUMN last_provider_update_at timestamptz;
ALTER TABLE alerts ADD COLUMN state alert_state NOT NULL DEFAULT 'pending';
CREATE UNIQUE INDEX journeys_one_open_destination_idx ON journeys(user_id,train_number,journey_date,destination_station_code) WHERE state IN ('scheduled','active');
CREATE INDEX journeys_user_state_created_idx ON journeys(user_id,state,created_at DESC);
CREATE INDEX alerts_future_pending_idx ON alerts(journey_id,scheduled_for) WHERE state='pending';
