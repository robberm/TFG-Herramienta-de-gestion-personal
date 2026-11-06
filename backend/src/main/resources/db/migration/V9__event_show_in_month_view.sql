-- Permite ocultar de la vista mensual eventos y series rutinarios (gimnasio, dormir...).
-- Lo existente sigue visible, igual que hasta ahora.
alter table events
    add column show_in_month_view bit not null default 1;

alter table event_series
    add column show_in_month_view bit not null default 1;
