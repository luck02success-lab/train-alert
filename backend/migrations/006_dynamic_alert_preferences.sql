ALTER TABLE journeys
ADD COLUMN alert_offsets_minutes
smallint[]
NOT NULL
DEFAULT ARRAY[120, 60, 30, 15]::smallint[];

ALTER TABLE journeys
ADD CONSTRAINT journeys_alert_offsets_valid
CHECK (
  alert_offsets_minutes
  <@
  ARRAY[120, 60, 30, 15]::smallint[]
);

UPDATE alerts
SET state = 'cancelled'
WHERE state = 'pending'
  AND (
    offset_minutes = 0
    OR scheduled_for <= now()
  );

CREATE INDEX journeys_alert_offsets_idx
ON journeys
USING GIN (alert_offsets_minutes);