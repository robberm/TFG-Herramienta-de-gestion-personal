package net.tfg.tfgapp.domains;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class EventSeriesTest {

    // 10/8/2026 es lunes.
    private static EventSeries series(String type, String weekdays, LocalDate until) {
        EventSeries series = new EventSeries();
        series.setId(3L);
        series.setRecurrenceType(type);
        series.setRecurrenceWeekdays(weekdays);
        series.setRecurrenceEndDate(until);
        series.setStartTime(LocalDateTime.of(2026, 8, 10, 9, 0));
        series.setEndTime(LocalDateTime.of(2026, 8, 10, 10, 30));
        return series;
    }

    private static List<LocalDate> datesIn(EventSeries series, LocalDate from, LocalDate to) {
        return series.occurrencesBetween(from.atStartOfDay(), to.plusDays(1).atStartOfDay())
                .stream()
                .map(EventSeries.Occurrence::date)
                .toList();
    }

    @Test
    void seriesWithoutEndIsExpandedOnlyForTheRequestedRange() {
        EventSeries daily = series("DAILY", null, null);

        // Diez años después sigue generando ocurrencias sin tener filas guardadas.
        List<EventSeries.Occurrence> occurrences = daily.occurrencesBetween(
                LocalDateTime.of(2036, 3, 2, 0, 0), LocalDateTime.of(2036, 3, 4, 0, 0));

        assertThat(occurrences).extracting(EventSeries.Occurrence::date)
                .containsExactly(LocalDate.of(2036, 3, 2), LocalDate.of(2036, 3, 3));
        assertThat(occurrences.get(0).start()).isEqualTo(LocalDateTime.of(2036, 3, 2, 9, 0));
        assertThat(occurrences.get(0).end()).isEqualTo(LocalDateTime.of(2036, 3, 2, 10, 30));
    }

    @Test
    void rulesFollowTheirWeekdays() {
        LocalDate from = LocalDate.of(2026, 8, 10);
        LocalDate to = LocalDate.of(2026, 8, 23);

        assertThat(datesIn(series("WEEKLY", null, null), from, to))
                .containsExactly(LocalDate.of(2026, 8, 10), LocalDate.of(2026, 8, 17));
        assertThat(datesIn(series("WEEKDAYS", null, null), from, to)).hasSize(10)
                .allMatch(date -> date.getDayOfWeek().getValue() <= 5);
        assertThat(datesIn(series("CUSTOM", "1,3", null), from, to)).containsExactly(
                LocalDate.of(2026, 8, 10), LocalDate.of(2026, 8, 12),
                LocalDate.of(2026, 8, 17), LocalDate.of(2026, 8, 19));
    }

    @Test
    void excludedDatesAndEndDateAreRespected() {
        EventSeries daily = series("DAILY", null, LocalDate.of(2026, 8, 14));
        daily.getExcludedDates().add(LocalDate.of(2026, 8, 12));

        assertThat(datesIn(daily, LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31))).containsExactly(
                LocalDate.of(2026, 8, 10), LocalDate.of(2026, 8, 11),
                LocalDate.of(2026, 8, 13), LocalDate.of(2026, 8, 14));
        assertThat(daily.hasOccurrenceOn(LocalDate.of(2026, 8, 12))).isFalse();
        assertThat(daily.hasOccurrenceOn(LocalDate.of(2026, 8, 15))).isFalse();
        assertThat(daily.allDates()).hasSize(4);
    }

    @Test
    void occurrenceCrossingMidnightIsVisibleTheNextDay() {
        EventSeries night = series("DAILY", null, null);
        night.setStartTime(LocalDateTime.of(2026, 8, 10, 23, 0));
        night.setEndTime(LocalDateTime.of(2026, 8, 11, 1, 0));

        List<EventSeries.Occurrence> occurrences = night.occurrencesBetween(
                LocalDateTime.of(2026, 8, 12, 0, 0), LocalDateTime.of(2026, 8, 12, 6, 0));

        assertThat(occurrences).extracting(EventSeries.Occurrence::date).containsExactly(LocalDate.of(2026, 8, 11));
    }
}
