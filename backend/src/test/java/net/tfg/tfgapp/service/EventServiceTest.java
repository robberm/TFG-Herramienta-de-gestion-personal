package net.tfg.tfgapp.service;

import net.tfg.tfgapp.DTOs.events.EventRequest;
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

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
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
    void singleEventIsSavedAssignedAndRefreshesBlockingCache() {
        when(eventRepo.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        PersonalUser owner = new PersonalUser("rob", "password");
        owner.setId(7L);

        Event event = eventService.createEvent(baseRequest(), List.of(owner), null);

        assertThat(event.getStartTime()).isEqualTo(LocalDateTime.of(2026, 8, 9, 9, 0));
        assertThat(event.getCategory()).isEqualTo(Event.EventCategory.MANDATORY);
        assertThat(event.getReminderMinutesBeforeList()).containsExactly(15);
        assertThat(event.getUser().getId()).isEqualTo(7L);
        assertThat(event.getSeries()).isNull();
        verify(reminderScheduler).scheduleReminder(event);
        // Los eventos nuevos (aquí MANDATORY) deben verse en la caché de bloqueo sin esperar a la resincronización.
        verify(eventScheduleCache).invalidate();
    }

    private EventRequest baseRequest() {
        EventRequest request = new EventRequest();
        request.setTitle("Gimnasio");
        request.setDescription("Entrenamiento");
        request.setStartTime(LocalDateTime.of(2026, 8, 9, 9, 0));
        request.setEndTime(LocalDateTime.of(2026, 8, 9, 10, 0));
        request.setCategory(Event.EventCategory.MANDATORY);
        request.setIsAllDay(false);
        request.setReminderMinutesBeforeList(List.of(15, 15));
        return request;
    }
}
