-- Todo-list del Home (entidad TodoItem). Generado a partir de la entidad JPA.
-- IF NOT EXISTS + índice y FK dentro de la misma sentencia: las BDs locales que ya
-- ejecutaron la rama de la todo-list con ddl-auto=update tienen la tabla creada.
CREATE TABLE IF NOT EXISTS todo_items (
    done bit not null,
    position integer not null,
    completed_at datetime(6),
    created_at datetime(6) not null,
    id bigint not null auto_increment,
    owner_id bigint not null,
    title varchar(255) not null,
    primary key (id),
    key idx_todo_items_owner_position (owner_id, position),
    constraint FK7etu644wfyf0rsdu4ig1cwk4e foreign key (owner_id) references users (id)
) engine=InnoDB;
