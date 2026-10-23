package db.migration;

import net.tfg.tfgapp.utils.RecurrenceRules;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;

/**
 * Convierte las series antiguas (una fila de events por ocurrencia, agrupadas por
 * recurrence_series_id) en una fila de event_series más sus excepciones.
 *
 * El calendario debe verse exactamente igual después de migrar:
 *  - La primera ocurrencia hace de plantilla (hora, duración, datos, avisos, asignados).
 *  - Las filas idénticas a la plantilla en una fecha que genera la regla se borran:
 *    pasan a calcularse.
 *  - Las filas distintas (movidas o editadas a mano) se conservan como ocurrencias
 *    editadas, enlazadas con events.series_id.
 *  - Las fechas de la regla que no quedan cubiertas se guardan como excluidas.
 *
 * Es Java y no SQL porque necesita la misma lógica de fechas que usa la aplicación.
 */
public class V6__convert_materialized_series extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();

        List<String> legacySeriesIds = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet rows = statement.executeQuery(
                     "SELECT DISTINCT recurrence_series_id FROM events WHERE recurrence_series_id IS NOT NULL")) {
            while (rows.next()) {
                legacySeriesIds.add(rows.getString(1));
            }
        }

        for (String legacySeriesId : legacySeriesIds) {
            convertSeries(connection, legacySeriesId);
        }
    }

    private void convertSeries(Connection connection, String legacySeriesId) throws SQLException {
        List<LegacyRow> rows = loadRows(connection, legacySeriesId);
        if (rows.size() < 2) {
            // Una serie de una sola ocurrencia es un evento normal.
            for (LegacyRow row : rows) {
                execute(connection, "UPDATE events SET recurrence_series_id = NULL WHERE id = ?", row.id);
            }
            return;
        }

        LegacyRow template = rows.get(0);
        String type = template.recurrenceType != null && RecurrenceRules.TYPES.contains(template.recurrenceType)
                ? template.recurrenceType
                : "CUSTOM";
        String weekdays = null;
        if ("CUSTOM".equals(type)) {
            weekdays = template.recurrenceWeekdays;
            if (RecurrenceRules.parseWeekdays(weekdays).isEmpty()) {
                Set<Integer> derived = new TreeSet<>();
                for (LegacyRow row : rows) {
                    derived.add(row.start.getDayOfWeek().getValue());
                }
                weekdays = RecurrenceRules.formatWeekdays(derived);
            }
        }
        LocalDate anchor = template.start.toLocalDate();
        LocalDate until = template.recurrenceEndDate != null
                ? template.recurrenceEndDate
                : rows.get(rows.size() - 1).start.toLocalDate();
        if (until.isBefore(anchor)) {
            until = anchor;
        }

        long seriesId = insertSeries(connection, template, type, until, weekdays);
        for (Integer minutes : template.reminders) {
            execute(connection, "INSERT INTO event_series_reminders (series_id, minutes_before) VALUES (?, ?)",
                    seriesId, minutes);
        }
        for (Assignment assignment : template.assignments) {
            execute(connection,
                    "INSERT INTO event_series_assignments (series_id, personal_user_id, aud_admin_id) VALUES (?, ?, ?)",
                    seriesId, assignment.userId, assignment.adminId);
        }

        Set<LocalDate> ruleDates = new LinkedHashSet<>(RecurrenceRules.datesBetween(
                type, anchor, until, RecurrenceRules.parseWeekdays(weekdays), anchor, until));
        Set<LocalDate> coveredDates = new HashSet<>();

        for (LegacyRow row : rows) {
            LocalDate date = row.start.toLocalDate();
            boolean calculable = ruleDates.contains(date) && !coveredDates.contains(date) && row.sameAs(template);
            if (calculable) {
                coveredDates.add(date);
                deleteEvent(connection, row.id);
            } else {
                execute(connection, "UPDATE events SET series_id = ?, recurrence_series_id = NULL WHERE id = ?",
                        seriesId, row.id);
            }
        }

        for (LocalDate date : ruleDates) {
            if (!coveredDates.contains(date)) {
                execute(connection, "INSERT INTO event_series_exdates (series_id, occurrence_date) VALUES (?, ?)",
                        seriesId, Date.valueOf(date));
            }
        }
    }

    private List<LegacyRow> loadRows(Connection connection, String legacySeriesId) throws SQLException {
        Map<Long, LegacyRow> byId = new TreeMap<>();
        List<LegacyRow> ordered = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement("""
                SELECT id, title, description, location, category, is_all_day, start_time, end_time,
                       recurrence_type, recurrence_end_date, recurrence_weekdays
                FROM events
                WHERE recurrence_series_id = ? AND start_time IS NOT NULL AND end_time IS NOT NULL
                ORDER BY start_time, id
                """)) {
            statement.setString(1, legacySeriesId);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    LegacyRow row = new LegacyRow();
                    row.id = rows.getLong("id");
                    row.title = rows.getString("title");
                    row.description = rows.getString("description");
                    row.location = rows.getString("location");
                    row.category = rows.getString("category");
                    row.allDay = rows.getBoolean("is_all_day");
                    row.start = rows.getTimestamp("start_time").toLocalDateTime();
                    row.end = rows.getTimestamp("end_time").toLocalDateTime();
                    row.recurrenceType = rows.getString("recurrence_type");
                    Date endDate = rows.getDate("recurrence_end_date");
                    row.recurrenceEndDate = endDate != null ? endDate.toLocalDate() : null;
                    row.recurrenceWeekdays = rows.getString("recurrence_weekdays");
                    byId.put(row.id, row);
                    ordered.add(row);
                }
            }
        }
        if (ordered.isEmpty()) {
            return ordered;
        }

        String ids = String.join(",", byId.keySet().stream().map(String::valueOf).toList());
        try (Statement statement = connection.createStatement()) {
            try (ResultSet rows = statement.executeQuery(
                    "SELECT event_id, minutes_before FROM events_reminders WHERE event_id IN (" + ids + ")")) {
                while (rows.next()) {
                    int minutes = rows.getInt("minutes_before");
                    if (!rows.wasNull()) {
                        byId.get(rows.getLong("event_id")).reminders.add(minutes);
                    }
                }
            }
            try (ResultSet rows = statement.executeQuery(
                    "SELECT event_id, personal_user_id, aud_admin_id FROM event_assignments WHERE event_id IN (" + ids + ")")) {
                while (rows.next()) {
                    long adminId = rows.getLong("aud_admin_id");
                    Long admin = rows.wasNull() ? null : adminId;
                    byId.get(rows.getLong("event_id")).assignments.add(new Assignment(rows.getLong("personal_user_id"), admin));
                }
            }
        }
        return ordered;
    }

    private long insertSeries(Connection connection, LegacyRow template, String type, LocalDate until,
                              String weekdays) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO event_series (title, description, location, category, is_all_day, start_time, end_time,
                                          recurrence_type, recurrence_end_date, recurrence_weekdays)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, Statement.RETURN_GENERATED_KEYS)) {
            statement.setString(1, template.title);
            statement.setString(2, template.description);
            statement.setString(3, template.location);
            statement.setString(4, template.category);
            statement.setBoolean(5, template.allDay);
            statement.setTimestamp(6, Timestamp.valueOf(template.start));
            statement.setTimestamp(7, Timestamp.valueOf(template.end));
            statement.setString(8, type);
            statement.setDate(9, Date.valueOf(until));
            statement.setString(10, weekdays);
            statement.executeUpdate();
            try (ResultSet keys = statement.getGeneratedKeys()) {
                keys.next();
                return keys.getLong(1);
            }
        }
    }

    private void deleteEvent(Connection connection, long eventId) throws SQLException {
        execute(connection, "DELETE FROM events_reminders WHERE event_id = ?", eventId);
        execute(connection, "DELETE FROM event_assignments WHERE event_id = ?", eventId);
        execute(connection, "DELETE FROM events WHERE id = ?", eventId);
    }

    private void execute(Connection connection, String sql, Object... params) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) {
                statement.setObject(i + 1, params[i]);
            }
            statement.executeUpdate();
        }
    }

    private record Assignment(long userId, Long adminId) {
    }

    private static final class LegacyRow {
        long id;
        String title;
        String description;
        String location;
        String category;
        boolean allDay;
        LocalDateTime start;
        LocalDateTime end;
        String recurrenceType;
        LocalDate recurrenceEndDate;
        String recurrenceWeekdays;
        final Set<Integer> reminders = new TreeSet<>();
        final Set<Assignment> assignments = new HashSet<>();

        /** Misma hora, duración, datos, avisos y asignados que la plantilla (la fecha da igual). */
        boolean sameAs(LegacyRow other) {
            return start.toLocalTime().equals(other.start.toLocalTime())
                    && Duration.between(start, end).equals(Duration.between(other.start, other.end))
                    && Objects.equals(title, other.title)
                    && Objects.equals(description, other.description)
                    && Objects.equals(location, other.location)
                    && Objects.equals(category, other.category)
                    && allDay == other.allDay
                    && reminders.equals(other.reminders)
                    && assignments.equals(other.assignments);
        }
    }
}
