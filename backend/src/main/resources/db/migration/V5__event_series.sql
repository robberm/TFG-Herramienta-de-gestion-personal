-- Series de eventos recurrentes guardadas una sola vez (regla tipo RRULE de iCalendar).
-- Hasta ahora cada ocurrencia era una fila de events; a partir de aquí las ocurrencias
-- se calculan al consultar y solo se guardan las excepciones:
--   event_series_exdates: fechas de la regla que ya no se muestran.
--   events.series_id:     ocurrencias editadas por separado, convertidas en eventos normales.
create table event_series (
    id bigint not null auto_increment,
    title varchar(255),
    description varchar(255),
    location varchar(255),
    category enum ('FOCUS','HEALTH','MANDATORY','PERSONAL','STUDY','WORK') not null,
    is_all_day bit,
    start_time datetime(6) not null,
    end_time datetime(6) not null,
    recurrence_type varchar(16) not null,
    recurrence_end_date date,
    recurrence_weekdays varchar(20),
    primary key (id)
) engine=InnoDB;

create table event_series_reminders (
    minutes_before integer,
    series_id bigint not null,
    constraint fk_event_series_reminders_series foreign key (series_id) references event_series (id)
) engine=InnoDB;

create table event_series_exdates (
    series_id bigint not null,
    occurrence_date date not null,
    primary key (series_id, occurrence_date),
    constraint fk_event_series_exdates_series foreign key (series_id) references event_series (id)
) engine=InnoDB;

create table event_series_assignments (
    id bigint not null auto_increment,
    series_id bigint not null,
    personal_user_id bigint not null,
    aud_admin_id bigint,
    aud_tim datetime(6) default current_timestamp(6) not null,
    primary key (id),
    constraint uk_event_series_assignments_series_user unique (series_id, personal_user_id),
    constraint fk_event_series_assignments_series foreign key (series_id) references event_series (id),
    constraint fk_event_series_assignments_user foreign key (personal_user_id) references personal_users (id),
    constraint fk_event_series_assignments_admin foreign key (aud_admin_id) references admin_users (id)
) engine=InnoDB;

alter table events
    add column series_id bigint,
    add constraint fk_events_series foreign key (series_id) references event_series (id);
