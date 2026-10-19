package net.tfg.tfgapp;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Comprueba contra un MySQL real que las migraciones de Flyway dejan un esquema que
 * Hibernate acepta con ddl-auto=validate y que las notas largas se pueden guardar.
 *
 * Opcional (no se ejecuta en un build normal). Ejemplo con un MySQL desechable:
 *   docker run -d --name gmo-it -e MYSQL_ROOT_PASSWORD=it -e MYSQL_DATABASE=gmoapp_db -p 127.0.0.1:3399:3306 mysql:8.4
 *   ./mvnw test -Dtest=FlywaySchemaIT -Dit.db.url=jdbc:mysql://localhost:3399/gmoapp_db -Dit.db.user=root -Dit.db.password=it
 */
@EnabledIfSystemProperty(named = "it.db.url", matches = ".+")
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.MOCK,
        properties = {
                "spring.datasource.url=${it.db.url}",
                "spring.datasource.username=${it.db.user}",
                "spring.datasource.password=${it.db.password}",
                "jwt.secret=integration-test-secret-integration-test-secret",
        })
class FlywaySchemaIT {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void migrationsProduceSchemaThatHibernateValidatesAndStoresLongNotes() {
        // Si el contexto arranca, Flyway ha migrado y Hibernate ha validado el esquema.
        String contentType = jdbcTemplate.queryForObject(
                "SELECT DATA_TYPE FROM information_schema.COLUMNS "
                        + "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notes' AND COLUMN_NAME = 'content'",
                String.class);
        assertThat(contentType).isEqualToIgnoringCase("longtext");

        Integer applied = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE success = 1", Integer.class);
        assertThat(applied).isGreaterThanOrEqualTo(2);

        String latestVersion = jdbcTemplate.queryForObject(
                "SELECT version FROM flyway_schema_history WHERE success = 1 "
                        + "ORDER BY installed_rank DESC LIMIT 1", String.class);
        assertThat(latestVersion).isEqualTo("3");

        Integer todoTable = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.TABLES "
                        + "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'todo_items'", Integer.class);
        assertThat(todoTable).isEqualTo(1);

        jdbcTemplate.update("INSERT INTO users (token_version, password, username) VALUES (0, 'x', 'it_note_owner')");
        Long ownerId = jdbcTemplate.queryForObject("SELECT id FROM users WHERE username = 'it_note_owner'", Long.class);
        String longContent = "á".repeat(20_000); // 40 KB en UTF-8: no cabía en TINYTEXT (255 bytes)
        jdbcTemplate.update(
                "INSERT INTO notes (pinned, created_at, updated_at, owner_id, color, title, content) "
                        + "VALUES (0, NOW(6), NOW(6), ?, 'sand', 'larga', ?)",
                ownerId, longContent);
        Integer storedLength = jdbcTemplate.queryForObject(
                "SELECT CHAR_LENGTH(content) FROM notes WHERE owner_id = ?", Integer.class, ownerId);
        assertThat(storedLength).isEqualTo(20_000);
    }
}
