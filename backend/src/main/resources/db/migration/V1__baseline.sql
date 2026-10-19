-- Esquema inicial de GMO (MySQL 8). Generado a partir de las entidades JPA.
-- Las BDs locales creadas antes con ddl-auto=update se adoptan como version 1
-- (spring.flyway.baseline-on-migrate) sin ejecutar este script.

create table admin_users (
    id bigint not null,
    primary key (id)
) engine=InnoDB;

create table event_assignments (
    aud_admin_id bigint,
    aud_tim datetime(6) default current_timestamp(6) not null,
    event_id bigint not null,
    id bigint not null auto_increment,
    personal_user_id bigint not null,
    primary key (id)
) engine=InnoDB;

create table events (
    is_all_day bit,
    end_time datetime(6),
    id bigint not null auto_increment,
    start_time datetime(6),
    recurrence_type varchar(16),
    recurrence_series_id varchar(36),
    description varchar(255),
    location varchar(255),
    title varchar(255),
    category enum ('FOCUS','HEALTH','MANDATORY','PERSONAL','STUDY','WORK') not null,
    primary key (id)
) engine=InnoDB;

create table events_reminders (
    minutes_before integer,
    event_id bigint not null
) engine=InnoDB;

create table goals (
    id integer not null,
    is_numeric boolean default false not null,
    priority enum ('Alta','Baja','Media') not null,
    status enum ('Done','InProgress','NotStarted') not null,
    primary key (id)
) engine=InnoDB;

create table habits (
    best_streak integer not null,
    current_streak integer not null,
    id integer not null,
    primary key (id)
) engine=InnoDB;

create table notes (
    pinned bit not null,
    created_at datetime(6) not null,
    id bigint not null auto_increment,
    owner_id bigint not null,
    updated_at datetime(6) not null,
    color varchar(16) not null,
    title varchar(180) not null,
    content longtext not null,
    primary key (id)
) engine=InnoDB;

create table objective_assignments (
    active bit not null,
    id integer not null auto_increment,
    objective_id integer not null,
    progress_value float(53),
    target_value float(53),
    aud_admin_id bigint,
    aud_tim datetime(6) default current_timestamp(6) not null,
    personal_user_id bigint not null,
    status enum ('Done','InProgress','NotStarted') not null,
    primary key (id)
) engine=InnoDB;

create table objective_logs (
    completed bit,
    id integer not null auto_increment,
    log_date date not null,
    objective_assignment_id integer,
    objective_id integer,
    progress_value float(53),
    aud_tim datetime(6) default current_timestamp(6) not null,
    primary key (id)
) engine=InnoDB;

create table objectives (
    active bit not null,
    id integer not null auto_increment,
    aud_admin_id bigint,
    aud_tim datetime(6) default current_timestamp(6) not null,
    user_id bigint not null,
    objective_type varchar(31) not null,
    description varchar(255) not null,
    titulo varchar(255) not null,
    primary key (id)
) engine=InnoDB;

create table organizations (
    admin_id bigint not null,
    id bigint not null auto_increment,
    name varchar(255) not null,
    primary key (id)
) engine=InnoDB;

create table personal_users (
    aud_admin_id bigint,
    id bigint not null,
    organization_id bigint,
    primary key (id)
) engine=InnoDB;

create table users (
    token_version integer not null,
    id bigint not null auto_increment,
    password varchar(255) not null,
    profile_image_path varchar(255),
    username varchar(255) not null,
    primary key (id)
) engine=InnoDB;

alter table event_assignments 
   add constraint UK4ejm4qopdqcio2wqwie9ayhm2 unique (event_id, personal_user_id);

create index idx_notes_owner_updated 
   on notes (owner_id, updated_at);

alter table objective_assignments 
   add constraint UKhoqavhno0sjjxv4kms128x16 unique (objective_id, personal_user_id);

alter table objective_logs 
   add constraint UKs23bqb1robc40tyoka0wubauf unique (objective_assignment_id, log_date);

alter table organizations 
   add constraint UKrupc10lv90xsapbko59lueiko unique (admin_id);

alter table organizations 
   add constraint UKp9pbw3flq9hkay8hdx3ypsldy unique (name);

alter table users 
   add constraint UKr43af9ap4edm43mmtq01oddj6 unique (username);

alter table admin_users 
   add constraint FKkwx01p5bol0oql5llbr6morkt 
   foreign key (id) 
   references users (id);

alter table event_assignments 
   add constraint FKlm0s4fems8b9lf20pyaqe8jcm 
   foreign key (aud_admin_id) 
   references admin_users (id);

alter table event_assignments 
   add constraint FK6aaxwqoh7c67obtlv68td8bll 
   foreign key (event_id) 
   references events (id);

alter table event_assignments 
   add constraint FKin0xegp796j5fnqf405p4oth8 
   foreign key (personal_user_id) 
   references personal_users (id);

alter table events_reminders 
   add constraint FKjpwakil8cjwi2t6g2nvvey1wo 
   foreign key (event_id) 
   references events (id);

alter table goals 
   add constraint FKtdlv1xnsqrf1ajx4l0o6g7pb8 
   foreign key (id) 
   references objectives (id);

alter table habits 
   add constraint FKghgwmg01g9wru6wr9m1ox3r7w 
   foreign key (id) 
   references objectives (id);

alter table notes 
   add constraint FK5n5jgcd6tqt248r97q0yrt3xp 
   foreign key (owner_id) 
   references users (id);

alter table objective_assignments 
   add constraint FKa416ug2dy3p2v5bcrrpohyc1t 
   foreign key (aud_admin_id) 
   references admin_users (id);

alter table objective_assignments 
   add constraint FKp2f48mq6tw8qgbuxui5cbf6fw 
   foreign key (objective_id) 
   references objectives (id);

alter table objective_assignments 
   add constraint FKag8xvbhygti8vbv6s7yg897m5 
   foreign key (personal_user_id) 
   references personal_users (id);

alter table objective_logs 
   add constraint FKcq8qlg7set1scp8tj40ixwu4v 
   foreign key (objective_id) 
   references objectives (id);

alter table objective_logs 
   add constraint FK742i6c32n22k2dvsxwe2u9cfa 
   foreign key (objective_assignment_id) 
   references objective_assignments (id);

alter table objectives 
   add constraint FKgnc0seuldbtnguhrno5j57q2p 
   foreign key (aud_admin_id) 
   references admin_users (id);

alter table objectives 
   add constraint FKqlgp66kau8ls10dtofbl5a1qn 
   foreign key (user_id) 
   references personal_users (id);

alter table organizations 
   add constraint FKigrva6y9g6mq8ln4qxikpus9a 
   foreign key (admin_id) 
   references admin_users (id);

alter table personal_users 
   add constraint FKhf23ic46000phrrs9x5868nef 
   foreign key (aud_admin_id) 
   references admin_users (id);

alter table personal_users 
   add constraint FKjes4madnegbry6k0mgl8kdoau 
   foreign key (organization_id) 
   references organizations (id);

alter table personal_users 
   add constraint FK105jf8e3bymue4nssokssye74 
   foreign key (id) 
   references users (id);
