CREATE TYPE notification_delivery_state AS ENUM (
  'pending',
  'sending',
  'sent',
  'failed'
);

CREATE TABLE notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  alert_id bigint NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,

  state notification_delivery_state NOT NULL DEFAULT 'pending',

  attempt_count integer NOT NULL DEFAULT 0,

  next_attempt_at timestamptz NOT NULL DEFAULT now(),

  sent_at timestamptz,

  last_error_code text,
  last_error_message text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(alert_id, device_id)
);

CREATE INDEX notification_deliveries_due_idx
ON notification_deliveries(next_attempt_at)
WHERE state IN ('pending', 'failed');

CREATE INDEX notification_deliveries_alert_idx
ON notification_deliveries(alert_id);

CREATE INDEX notification_deliveries_device_idx
ON notification_deliveries(device_id);