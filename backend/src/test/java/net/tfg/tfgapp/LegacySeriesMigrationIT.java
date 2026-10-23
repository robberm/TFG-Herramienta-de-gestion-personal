package net.tfg.tfgapp;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Comprueba contra un MySQL real que V6 convierte las series antiguas (una fila por
 * ocurrencia) en serie + excepciones sin cambiar lo que se ve en el calendario.
 *
 * Borra la BD indicada: usar solo con un MySQL desechable (ver FlywaySchemaIT).
 *   ./mvnw test -Dtest=LegacySeriesMigrationIT -Dit.db.url=... -Dit.db.user=root -Dit.db.password=it
 */
@EnabledIfSystemProperty(named = "it.db.url", matches = ".+")
class LegacySeriesMigrationIT {

    @Test
    void legacySeriesBecomeASeriesWithItsExceptions() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                System.getProperty("it.db.url"), System.getProperty("it.db.user"), System.getProperty("it.db.password"));
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);

        Flyway.configure().dataSource(dataSource).cleanDisabled(false).load().clean();
        Flyway.configure().dataSource(dataSource).target("4").load().migrate();

        jdbc.update("INSERT INTO users (token_version, password, username) VALUES (0, 'x', 'it_series_owner')");
        Long userId = jdbc.queryForObject("SELECT id FROM users WHERE username = 'it_series_owner'", Long.class);
        jdbc.update("INSERT INTO personal_users (id) VALUES (?)", userId);

        // Serie diaria del lunes 10 al viernes 14/8/2026 a las 9:00. El martes se movió
        // a las 15:00 y el miércoles se borró.
        insertLegacy(jdbc, userId, "legacy-a", "2026-08-10 09:00", "2026-08-10 10:00", "DAILY");
        long moved = insertLegacy(jdbc, userId, "legacy-a", "2026-08-11 15:00", "2026-08-11 16:00", "DAILY");
        insertLegacy(jdbc, userId, "legacy-a", "2026-08-13 09:00", "2026-08-13 10:00", "DAILY");
        insertLegacy(jdbc, userId, "legacy-a", "2026-08-14 09:00", "2026-08-14 10:00", "DAILY");
        // Una "serie" con una sola fila es un evento normal.
        long lonely = insertLegacy(jdbc, userId, "legacy-b", "2026-08-20 12:00", "2026-08-20 13:00", "WEEKLY");

        Flyway.configure().dataSource(dataSource).load().migrate();

        Map<String, Object> series = jdbc.queryForMap("SELECT * FROM event_series");
        Long seriesId = ((Number) series.get("id")).longValue();
        assertThat(series.get("recurrence_type")).isEqualTo("DAILY");
        assertThat(series.get("recurrence_end_date").toString()).isEqualTo("2026-08-14");
        assertThat(series.get("start_time").toString()).startsWith("2026-08-10T09:00");

        assertThat(jdbc.queryForList("SELECT occurrence_date FROM event_series_exdates ORDER BY occurrence_date", LocalDate.class))
                .containsExactly(LocalDate.of(2026, 8, 11), LocalDate.of(2026, 8, 12));
        assertThat(jdbc.queryForList("SELECT minutes_before FROM event_series_reminders", Integer.class)).containsExactly(15);
        assertThat(jdbc.queryForList("SELECT personal_user_id FROM event_series_assignments", Long.class)).containsExactly(userId);

        // Solo quedan como filas la ocurrencia movida (enlazada a la serie) y el evento suelto.
        List<Map<String, Object>> events = jdbc.queryForList("SELECT id, series_id FROM events ORDER BY id");
        assertThat(events).hasSize(2);
        assertThat(((Number) events.get(0).get("id")).longValue()).isEqualTo(moved);
        assertThat(((Number) events.get(0).get("series_id")).longValue()).isEqualTo(seriesId);
        assertThat(((Number) events.get(1).get("id")).longValue()).isEqualTo(lonely);
        assertThat(events.get(1).get("series_id")).isNull();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM event_assignments", Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM events_reminders", Integer.class)).isEqualTo(2);
    }

    private long insertLegacy(JdbcTemplate jdbc, Long userId, String seriesId, String start, String end, String type) {
        jdbc.update("""
                INSERT INTO events (title, description, location, category, is_all_day, start_time, end_time,
                                    recurrence_series_id, recurrence_type)
                VALUES ('Gimnasio', 'Pierna', NULL, 'HEALTH', 0, ?, ?, ?, ?)
                """, start, end, seriesId, type);
        Long eventId = jdbc.queryForObject("SELECT MAX(id) FROM events", Long.class);
        jdbc.update("INSERT INTO events_reminders (event_id, minutes_before) VALUES (?, 15)", eventId);
        jdbc.update("INSERT INTO event_assignments (event_id, personal_user_id) VALUES (?, ?)", eventId, userId);
        return eventId;
    }
}
