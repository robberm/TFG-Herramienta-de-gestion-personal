-- Tras V6 las series viven en event_series: events ya no necesita estas columnas.
ALTER TABLE events
    DROP COLUMN recurrence_series_id,
    DROP COLUMN recurrence_type,
    DROP COLUMN recurrence_end_date,
    DROP COLUMN recurrence_weekdays;
