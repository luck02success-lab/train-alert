# Alert engine
Every ETA change increments `schedule_version` in the same transaction. Plan offsets are 120, 60, 30, 15 and 0 minutes. Already delivered alerts are retained; workers atomically claim a delivery row before sending. The worker is not implemented in this foundation.

Journey ETA selection is expected arrival, then actual arrival, then scheduled arrival only when neither live value exists. RailRadar timestamps contain an explicit offset and are stored as UTC instants.
