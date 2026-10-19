package net.tfg.tfgapp.components;

import net.tfg.tfgapp.domains.Event;
import net.tfg.tfgapp.repos.EventRepo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ActiveEventScheduleCacheTest {

    private EventRepo eventRepo;
    private ActiveEventScheduleCache cache;

    @BeforeEach
    void setUp() {
        eventRepo = mock(EventRepo.class);
        cache = new ActiveEventScheduleCache(eventRepo, 120);
    }

    private static Event event(Event.EventCategory category, LocalDateTime start, LocalDateTime end) {
        Event event = new Event();
        event.setCategory(category);
        event.setStartTime(start);
        event.setEndTime(end);
        return event;
    }

    @Test
    void repeatedChecksHitTheDatabaseOnlyOnce() {
        LocalDateTime now = LocalDateTime.now();
        when(eventRepo.findUserEventsOfCategoriesInRange(eq(1L), any(), any(), any()))
                .thenReturn(List.of(event(Event.EventCategory.FOCUS, now.minusMinutes(5), now.plusMinutes(30))));

        for (int i = 0; i < 100; i++) {
            assertThat(cache.isCategoryActive(Event.EventCategory.FOCUS, 1L)).isTrue();
            assertThat(cache.isCategoryActive(Event.EventCategory.MANDATORY, 1L)).isFalse();
        }

        verify(eventRepo, times(1)).findUserEventsOfCategoriesInRange(eq(1L), any(), any(), any());
    }

    @Test
    void futureEventIsNotActiveYet() {
        LocalDateTime now = LocalDateTime.now();
        when(eventRepo.findUserEventsOfCategoriesInRange(any(), any(), any(), any()))
                .thenReturn(List.of(event(Event.EventCategory.FOCUS, now.plusHours(1), now.plusHours(2))));

        assertThat(cache.isCategoryActive(Event.EventCategory.FOCUS, 1L)).isFalse();
    }

    @Test
    void invalidateAndUserChangeForceReload() {
        when(eventRepo.findUserEventsOfCategoriesInRange(any(), any(), any(), any())).thenReturn(List.of());

        cache.isCategoryActive(Event.EventCategory.FOCUS, 1L);
        cache.invalidate();
        cache.isCategoryActive(Event.EventCategory.FOCUS, 1L);
        cache.isCategoryActive(Event.EventCategory.FOCUS, 2L);

        verify(eventRepo, times(2)).findUserEventsOfCategoriesInRange(eq(1L), any(), any(), any());
        verify(eventRepo, times(1)).findUserEventsOfCategoriesInRange(eq(2L), any(), any(), any());
    }

    @Test
    void databaseFailureKeepsLastKnownStateInsteadOfThrowing() {
        LocalDateTime now = LocalDateTime.now();
        when(eventRepo.findUserEventsOfCategoriesInRange(any(), any(), any(), any()))
                .thenReturn(List.of(event(Event.EventCategory.FOCUS, now.minusMinutes(5), now.plusMinutes(30))))
                .thenThrow(new DataAccessResourceFailureException("RDS inaccesible"));

        assertThat(cache.isCategoryActive(Event.EventCategory.FOCUS, 1L)).isTrue();
        cache.invalidate();
        // La recarga falla: no debe lanzar (cancelaría el bucle de bloqueo) y conserva lo último conocido.
        assertThat(cache.isCategoryActive(Event.EventCategory.FOCUS, 1L)).isTrue();
        // Durante los 30 s de reintento no vuelve a golpear la BD.
        cache.isCategoryActive(Event.EventCategory.FOCUS, 1L);
        verify(eventRepo, times(2)).findUserEventsOfCategoriesInRange(any(), any(), any(), any());
    }

    @Test
    void noLoggedUserMeansNoQuery() {
        assertThat(cache.isCategoryActive(Event.EventCategory.FOCUS, null)).isFalse();
        verifyNoInteractions(eventRepo);
    }
}
