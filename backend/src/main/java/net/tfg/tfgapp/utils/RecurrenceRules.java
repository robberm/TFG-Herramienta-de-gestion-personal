package net.tfg.tfgapp.utils;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

/**
 * Reglas de repetición de las series de eventos, al estilo de una RRULE de iCalendar
 * (RFC 5545) reducida: una fecha ancla (primera ocurrencia), un tipo de repetición,
 * los días ISO (1 = lunes ... 7 = domingo) para CUSTOM y una fecha de fin opcional.
 *
 * No depende de Spring ni de JPA para poder usarse también desde las migraciones.
 */
public final class RecurrenceRules {

    public static final Set<String> TYPES = Set.of("DAILY", "WEEKLY", "WEEKDAYS", "CUSTOM");

    private RecurrenceRules() {
    }

    /**
     * Indica si la regla genera una ocurrencia en la fecha dada (sin mirar la fecha de fin).
     */
    public static boolean matches(String type, LocalDate anchor, Set<Integer> weekdays, LocalDate date) {
        if (date.isBefore(anchor)) {
            return false;
        }
        return switch (type) {
            case "DAILY" -> true;
            case "WEEKLY" -> date.getDayOfWeek() == anchor.getDayOfWeek();
            case "WEEKDAYS" -> date.getDayOfWeek().getValue() <= 5;
            case "CUSTOM" -> weekdays.contains(date.getDayOfWeek().getValue());
            default -> date.equals(anchor);
        };
    }

    /**
     * Fechas de la regla dentro de [from, to], ambos incluidos.
     *
     * @param until última fecha posible de la serie; null si no tiene fin
     */
    public static List<LocalDate> datesBetween(String type, LocalDate anchor, LocalDate until,
                                               Set<Integer> weekdays, LocalDate from, LocalDate to) {
        LocalDate cursor = from.isBefore(anchor) ? anchor : from;
        LocalDate last = until != null && until.isBefore(to) ? until : to;
        List<LocalDate> dates = new ArrayList<>();
        while (!cursor.isAfter(last)) {
            if (matches(type, anchor, weekdays, cursor)) {
                dates.add(cursor);
            }
            cursor = cursor.plusDays(1);
        }
        return dates;
    }

    public static Set<Integer> parseWeekdays(String csv) {
        if (csv == null || csv.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(Integer::valueOf)
                .collect(Collectors.toCollection(TreeSet::new));
    }

    /**
     * Normaliza los días ISO (sin nulos, repetidos ni valores fuera de 1-7) a "1,3,5".
     */
    public static String formatWeekdays(Collection<Integer> weekdays) {
        if (weekdays == null) {
            return null;
        }
        String formatted = weekdays.stream()
                .filter(day -> day != null && day >= 1 && day <= 7)
                .distinct()
                .sorted()
                .map(String::valueOf)
                .collect(Collectors.joining(","));
        return formatted.isEmpty() ? null : formatted;
    }
}
