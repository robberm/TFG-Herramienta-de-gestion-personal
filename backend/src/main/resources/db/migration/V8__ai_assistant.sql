-- Asistente de IA: memoria, historial de chat, temas de interés y pregunta diaria.
-- La clave de API del proveedor NO se guarda aquí: vive cifrada en el PC del usuario
-- (Electron safeStorage) y llega en cada petición por cabecera.

CREATE TABLE ai_memories (
    id bigint not null auto_increment,
    owner_id bigint not null,
    content varchar(500) not null,
    created_at datetime(6) not null,
    primary key (id),
    key idx_ai_memories_owner (owner_id),
    constraint fk_ai_memories_owner foreign key (owner_id) references users (id)
) engine=InnoDB;

CREATE TABLE ai_chat_messages (
    id bigint not null auto_increment,
    owner_id bigint not null,
    role enum ('assistant','user') not null,
    content longtext not null,
    created_at datetime(6) not null,
    primary key (id),
    key idx_ai_chat_messages_owner_created (owner_id, created_at),
    constraint fk_ai_chat_messages_owner foreign key (owner_id) references users (id)
) engine=InnoDB;

CREATE TABLE learning_topics (
    id bigint not null auto_increment,
    owner_id bigint not null,
    name varchar(60) not null,
    primary key (id),
    unique key uk_learning_topics_owner_name (owner_id, name),
    constraint fk_learning_topics_owner foreign key (owner_id) references users (id)
) engine=InnoDB;

-- Cada fila es una vez que se hizo una pregunta. Los repasos (curva del olvido, SM-2)
-- crean una fila nueva que apunta a la original con review_of_id; la fila que tiene
-- next_review_on informado es la única "viva" de su cadena.
CREATE TABLE daily_questions (
    id bigint not null auto_increment,
    owner_id bigint not null,
    asked_on date not null,
    topic varchar(60) not null,
    question varchar(1000) not null,
    reference_answer varchar(2000) not null,
    user_answer varchar(2000),
    answered_at datetime(6),
    score integer,
    feedback varchar(2000),
    repetitions integer not null,
    interval_days integer not null,
    ease_factor double precision not null,
    next_review_on date,
    review_of_id bigint,
    primary key (id),
    unique key uk_daily_questions_owner_day (owner_id, asked_on),
    key idx_daily_questions_owner_review (owner_id, next_review_on),
    constraint fk_daily_questions_owner foreign key (owner_id) references users (id),
    constraint fk_daily_questions_review_of foreign key (review_of_id) references daily_questions (id)
) engine=InnoDB;
