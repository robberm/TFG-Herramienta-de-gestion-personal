package net.tfg.tfgapp.service;

import net.tfg.tfgapp.DTOs.events.CalendarEventView;
import net.tfg.tfgapp.DTOs.events.EventRequest;
import net.tfg.tfgapp.DTOs.events.EventSeriesSummary;
import net.tfg.tfgapp.components.ActiveEventScheduleCache;
import net.tfg.tfgapp.domains.Event;
import net.tfg.tfgapp.domains.EventSeries;
import net.tfg.tfgapp.domains.PersonalUser;
import net.tfg.tfgapp.repos.EventRepo;
import net.tfg.tfgapp.repos.EventSeriesRepo;
import net.tfg.tfgapp.schedulers.ReminderScheduler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EventSeriesServiceTest {

    @Mock
    private EventSeriesRepo seriesRepo;
    @Mock
    private EventRepo eventRepo;
    @Mock
    private ReminderScheduler reminderScheduler;
    @Mock
    private ActiveEventScheduleCache eventScheduleCache;

    private EventService eventService;
    private EventSeriesService service;
    private PersonalUser owner;

    @BeforeEach
    void setUp() {
        eventService = mock(EventService.class);
        service = new EventSeriesService(seriesRepo, eventRepo, eventService, reminderScheduler, eventScheduleCache);
        owner = new PersonalUser("rob", "password");
        owner.setId(7L);
        lenient().when(seriesRepo.save(any(EventSeries.class))).thenAnswer(invocation -> {
            EventSeries series = invocation.getArgument(0);
            if (series.getId() == null) {
                series.setId(1L);
            }
            return series;
        });
    }

    @Test
    void creatingADailySeriesForTwoYearsStoresASingleRow() {
        EventRequest request = request("DAILY", LocalDate.of(2028, 8, 9));

        EventSeries series = service.createSeries(request, List.of(owner), null).orElseThrow();

        verify(seriesRepo).save(series);
        verify(eventService, never()).save(any());
        assertThat(series.getAssignments()).hasSize(1);
        assertThat(series.getReminderMinutesBeforeList()).containsExactly(15);
        // 732 ocurrencias (2028 es bisiesto) calculables desde una única fila.
        assertThat(series.allDates()).hasSize(732);
        verify(reminderScheduler).rescheduleSeriesReminders(series);
        verify(eventScheduleCache).invalidate();
    }

    @Test
    void firstMatchingDayBecomesTheAnchor() {
        // 9/8/2026 es domingo; la serie es de lunes y miércoles.
        EventRequest request = request("CUSTOM", null);
        request.setRecurrenceWeekdays(List.of(3, 1, 3));

        EventSeries series = service.createSeries(request, List.of(owner), null).orElseThrow();

        assertThat(series.getStartTime()).isEqualTo(LocalDateTime.of(2026, 8, 10, 9, 0));
        assertThat(series.getEndTime()).isEqualTo(LocalDateTime.of(2026, 8, 10, 10, 0));
        assertThat(series.getRecurrenceWeekdays()).isEqualTo("1,3");
        assertThat(series.getRecurrenceEndDate()).isNull();
    }

    @Test
    void ruleWithoutAnyDateFallsBackToASingleEvent() {
        // Solo martes, pero termina el mismo domingo en que empieza.
        EventRequest request = request("CUSTOM", LocalDate.of(2026, 8, 9));
        request.setRecurrenceWeekdays(List.of(2));

        assertThat(service.createSeries(request, List.of(owner), null)).isEmpty();
    }

    @Test
    void editingOneOccurrenceExcludesItAndCreatesALinkedEvent() {
        EventSeries series = service.createSeries(request("DAILY", null), List.of(owner), null).orElseThrow();
        when(eventService.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        doCallRealMethod().when(eventService).applyEventDetails(any(), any());

        EventRequest moved = request("NONE", null);
        moved.setStartTime(LocalDateTime.of(2026, 8, 12, 17, 0));
        moved.setEndTime(LocalDateTime.of(2026, 8, 12, 18, 0));
        Event edited = service.editOccurrence(series, LocalDate.of(2026, 8, 11), moved);

        assertThat(series.getExcludedDates()).containsExactly(LocalDate.of(2026, 8, 11));
        assertThat(edited.getSeries()).isSameAs(series);
        assertThat(edited.getStartTime()).isEqualTo(LocalDateTime.of(2026, 8, 12, 17, 0));
        assertThat(edited.getUser().getId()).isEqualTo(7L);
        assertThatThrownBy(() -> service.deleteOccurrence(series, LocalDate.of(2026, 8, 11)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rangeOnlyReturnsCalculatedOccurrencesWithTextualIds() {
        EventSeries series = service.createSeries(request("WEEKLY", null), List.of(owner), null).orElseThrow();
        series.getExcludedDates().add(LocalDate.of(2026, 8, 16));

        List<CalendarEventView> views = service.occurrencesInRange(List.of(series),
                LocalDateTime.of(2026, 8, 1, 0, 0), LocalDateTime.of(2026, 9, 1, 0, 0), 7L);

        assertThat(views).extracting(CalendarEventView::occurrenceDate).containsExactly(
                LocalDate.of(2026, 8, 9), LocalDate.of(2026, 8, 23), LocalDate.of(2026, 8, 30));
        assertThat(views.get(0).id()).isEqualTo("series:1:2026-08-09");
        assertThat(views.get(0).assignedToUserId()).isEqualTo(7L);
        assertThat(views.get(0).assignedByAdmin()).isFalse();
    }

    @Test
    void summaryOfSeriesWithoutEndHasNoCountsButHasNextOccurrence() {
        EventRequest request = request("DAILY", null);
        LocalDateTime start = LocalDateTime.now().minusDays(3).withHour(9).withMinute(0).withSecond(0).withNano(0);
        request.setStartTime(start);
        request.setEndTime(start.plusHours(1));
        EventSeries series = service.createSeries(request, List.of(owner), null).orElseThrow();
        when(eventRepo.findBySeries_Id(1L)).thenReturn(List.of());

        EventSeriesSummary summary = service.summarize(List.of(series), 7L).get(0);

        assertThat(summary.occurrenceCount()).isNull();
        assertThat(summary.upcomingCount()).isNull();
        assertThat(summary.nextStartTime()).isAfter(LocalDateTime.now().minusHours(1));
        assertThat(summary.assignedUserIds()).containsExactly(7L);
    }

    @Test
    void deletingASeriesAlsoDeletesItsEditedOccurrences() {
        EventSeries series = service.createSeries(request("DAILY", null), List.of(owner), null).orElseThrow();
        Event edited = new Event();
        edited.setId(40L);
        when(eventRepo.findBySeries_Id(1L)).thenReturn(List.of(edited));

        service.deleteSeries(series);

        verify(eventService).deleteEventById(40L);
        verify(reminderScheduler).cancelSeriesReminders(1L);
        verify(seriesRepo).delete(series);
    }

    private EventRequest request(String recurrenceType, LocalDate until) {
        EventRequest request = new EventRequest();
        request.setTitle("Gimnasio");
        request.setStartTime(LocalDateTime.of(2026, 8, 9, 9, 0));
        request.setEndTime(LocalDateTime.of(2026, 8, 9, 10, 0));
        request.setCategory(Event.EventCategory.HEALTH);
        request.setIsAllDay(false);
        request.setReminderMinutesBeforeList(List.of(15));
        request.setRecurrenceType(recurrenceType);
        request.setRecurrenceEndDate(until);
        return request;
    }
}
