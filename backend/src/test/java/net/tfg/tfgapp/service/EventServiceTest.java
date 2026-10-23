package net.tfg.tfgapp.service;

import net.tfg.tfgapp.DTOs.events.EventRequest;
import net.tfg.tfgapp.DTOs.events.EventSeriesSummary;
import net.tfg.tfgapp.components.ActiveEventScheduleCache;
import net.tfg.tfgapp.domains.Event;
import net.tfg.tfgapp.domains.PersonalUser;
import net.tfg.tfgapp.repos.EventRepo;
import net.tfg.tfgapp.schedulers.ReminderScheduler;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EventServiceTest {
    @Mock
    private EventRepo eventRepo;

    @Mock
    private ReminderScheduler reminderScheduler;

    @Mock
    private ActiveEventScheduleCache eventScheduleCache;

    @InjectMocks
    private EventService eventService;

    @Test
    void dailySeriesCreatesIndependentTaggedOccurrencesThroughEndDate() {
        AtomicLong ids = new AtomicLong(1);
        when(eventRepo.save(any(Event.class))).thenAnswer(invocation -> {
            Event event = invocation.getArgument(0);
            event.setId(ids.getAndIncrement());
            return event;
        });

        EventRequest request = baseRequest();
        request.setRecurrenceType("DAILY");
        request.setRecurrenceEndDate(LocalDate.of(2026, 8, 12));
        PersonalUser owner = new PersonalUser("rob", "password");
        owner.setId(7L);

        List<Event> events = eventService.createEvents(request, List.of(owner), null);

        assertThat(events).hasSize(4);
        assertThat(events).extracting(event -> event.getStartTime().toLocalDate())
                .containsExactly(
                        LocalDate.of(2026, 8, 9),
                        LocalDate.of(2026, 8, 10),
                        LocalDate.of(2026, 8, 11),
                        LocalDate.of(2026, 8, 12));
        assertThat(events).extracting(Event::getCategory).containsOnly(Event.EventCategory.MANDATORY);
        assertThat(events).extracting(Event::getRecurrenceSeriesId).doesNotContainNull().containsOnly(events.get(0).getRecurrenceSeriesId());
        assertThat(events).allSatisfy(event -> assertThat(event.getUser().getId()).isEqualTo(7L));
        assertThat(events).extracting(Event::getId).doesNotHaveDuplicates();
        // Los eventos nuevos (aquí MANDATORY) deben verse en la caché de bloqueo sin esperar a la resincronización.
        verify(eventScheduleCache, atLeastOnce()).invalidate();
    }

    @Test
    void customSeriesOnlyCreatesSelectedIsoWeekdays() {
        when(eventRepo.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        EventRequest request = baseRequest();
        request.setRecurrenceType("CUSTOM");
        request.setRecurrenceWeekdays(List.of(1, 3));
        request.setRecurrenceEndDate(LocalDate.of(2026, 8, 17));

        List<Event> events = eventService.createEvents(request, List.of(new PersonalUser("rob", "password")), null);

        assertThat(events).extracting(event -> event.getStartTime().toLocalDate())
                .containsExactly(LocalDate.of(2026, 8, 10), LocalDate.of(2026, 8, 12), LocalDate.of(2026, 8, 17));
    }

    @Test
    void seriesStoresItsRecurrenceConfigurationOnEveryOccurrence() {
        when(eventRepo.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        EventRequest request = baseRequest();
        request.setRecurrenceType("CUSTOM");
        request.setRecurrenceWeekdays(List.of(3, 1, 3));
        request.setRecurrenceEndDate(LocalDate.of(2026, 8, 17));

        List<Event> events = eventService.createEvents(request, List.of(new PersonalUser("rob", "password")), null);

        assertThat(events).allSatisfy(event -> {
            assertThat(event.getRecurrenceEndDate()).isEqualTo(LocalDate.of(2026, 8, 17));
            assertThat(event.getRecurrenceWeekdays()).isEqualTo("1,3");
        });
    }

    @Test
    void regeneratingSeriesReplacesOccurrencesAndKeepsSeriesId() {
        Event oldOccurrence = new Event();
        oldOccurrence.setId(50L);
        oldOccurrence.setRecurrenceSeriesId("serie-1");
        when(eventRepo.findByRecurrenceSeriesIdOrderByStartTimeAsc("serie-1")).thenReturn(List.of(oldOccurrence));
        when(eventRepo.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));

        EventRequest request = baseRequest();
        request.setTitle("Gimnasio tarde");
        request.setRecurrenceType("WEEKDAYS");
        request.setRecurrenceEndDate(LocalDate.of(2026, 8, 14));

        List<Event> events = eventService.regenerateSeries("serie-1", request, List.of(new PersonalUser("rob", "password")), null);

        // 9/8/2026 es domingo: de lunes 10 a viernes 14.
        assertThat(events).hasSize(5);
        assertThat(events).extracting(Event::getRecurrenceSeriesId).containsOnly("serie-1");
        assertThat(events).extracting(Event::getTitle).containsOnly("Gimnasio tarde");
        var order = inOrder(reminderScheduler, eventRepo);
        order.verify(reminderScheduler).cancelReminder(50L);
        order.verify(eventRepo).deleteAll(List.of(oldOccurrence));
        order.verify(eventRepo, atLeastOnce()).save(any(Event.class));
    }

    @Test
    void summaryDeducesConfigurationOfLegacySeriesFromOccurrences() {
        PersonalUser owner = new PersonalUser("rob", "password");
        owner.setId(7L);
        LocalDateTime base = LocalDateTime.now().minusWeeks(1).withHour(9).withMinute(0).withSecond(0).withNano(0);
        List<Event> occurrences = List.of(
                legacyOccurrence(base, owner),
                legacyOccurrence(base.plusDays(2), owner),
                legacyOccurrence(base.plusWeeks(2), owner),
                legacyOccurrence(base.plusWeeks(2).plusDays(2), owner));

        List<EventSeriesSummary> summaries = eventService.summarizeSeries(occurrences);

        assertThat(summaries).hasSize(1);
        EventSeriesSummary summary = summaries.get(0);
        assertThat(summary.startTime()).isEqualTo(base);
        assertThat(summary.recurrenceEndDate()).isEqualTo(base.plusWeeks(2).plusDays(2).toLocalDate());
        assertThat(summary.recurrenceWeekdays()).containsExactlyElementsOf(
                List.of(base.getDayOfWeek().getValue(), base.plusDays(2).getDayOfWeek().getValue()).stream().sorted().toList());
        assertThat(summary.occurrenceCount()).isEqualTo(4);
        assertThat(summary.upcomingCount()).isEqualTo(2);
        assertThat(summary.nextStartTime()).isEqualTo(base.plusWeeks(2));
        assertThat(summary.assignedUserIds()).containsExactly(7L);
    }

    private Event legacyOccurrence(LocalDateTime start, PersonalUser owner) {
        Event event = new Event();
        event.setTitle("Gimnasio");
        event.setStartTime(start);
        event.setEndTime(start.plusHours(1));
        event.setCategory(Event.EventCategory.HEALTH);
        event.setRecurrenceSeriesId("legacy");
        event.setRecurrenceType("CUSTOM");
        event.addAssignment(owner, null);
        return event;
    }

    private EventRequest baseRequest() {
        EventRequest request = new EventRequest();
        request.setTitle("Gimnasio");
        request.setDescription("Entrenamiento");
        request.setStartTime(LocalDateTime.of(2026, 8, 9, 9, 0));
        request.setEndTime(LocalDateTime.of(2026, 8, 9, 10, 0));
        request.setCategory(Event.EventCategory.MANDATORY);
        request.setIsAllDay(false);
        request.setReminderMinutesBeforeList(List.of(15));
        return request;
    }
}
