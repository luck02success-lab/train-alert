DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'notification_delivery_state'
  ) THEN
    CREATE TYPE notification_delivery_state AS ENUM (
      'pending',
      'sending',
      'sent',
      'failed'
    );
  END IF;
END
$$;

ALTER TABLE notification_deliveries
  ALTER COLUMN state DROP DEFAULT;

ALTER TABLE notification_deliveries
  ALTER COLUMN state TYPE notification_delivery_state
  USING (
    CASE state::text
      WHEN 'pending' THEN 'pending'
      WHEN 'sent' THEN 'sent'
      WHEN 'temporary_failure' THEN 'failed'
      WHEN 'permanent_failure' THEN 'failed'
      WHEN 'invalid_token' THEN 'failed'
      WHEN 'sending' THEN 'sending'
      WHEN 'failed' THEN 'failed'
      ELSE 'failed'
    END
  )::notification_delivery_state;

ALTER TABLE notification_deliveries
  ALTER COLUMN state SET DEFAULT 'pending'::notification_delivery_state;