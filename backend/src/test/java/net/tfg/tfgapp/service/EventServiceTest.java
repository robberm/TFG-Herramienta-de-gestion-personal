package net.tfg.tfgapp.service;

import net.tfg.tfgapp.DTOs.events.EventRequest;
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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EventServiceTest {
    @Mock
    private EventRepo eventRepo;

    @Mock
    private ReminderScheduler reminderScheduler;

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
