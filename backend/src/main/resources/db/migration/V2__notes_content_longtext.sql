-- Las BDs creadas con ddl-auto=update tenían notes.content como TINYTEXT (255 bytes),
-- por lo que las notas largas no se podían guardar. En BDs nuevas (V1) ya es LONGTEXT
-- y esta sentencia no cambia nada.
ALTER TABLE notes MODIFY content LONGTEXT NOT NULL;
