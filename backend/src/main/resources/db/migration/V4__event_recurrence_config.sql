-- Configuración de las series de eventos recurrentes. Hasta ahora solo se guardaba
-- recurrence_type: la fecha de fin y los días elegidos se perdían al crear la serie,
-- así que no se podía editar después. Las series antiguas quedan con NULL y el
-- backend deduce esos valores a partir de sus ocurrencias.
ALTER TABLE events
    ADD COLUMN recurrence_end_date date,
    ADD COLUMN recurrence_weekdays varchar(20);
