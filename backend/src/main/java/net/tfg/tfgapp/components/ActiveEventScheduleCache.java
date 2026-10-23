package net.tfg.tfgapp.components;

import net.tfg.tfgapp.domains.Event;
import net.tfg.tfgapp.domains.EventSeries;
import net.tfg.tfgapp.repos.EventRepo;
import net.tfg.tfgapp.repos.EventSeriesRepo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Copia en memoria de los eventos FOCUS / MANDATORY del usuario logueado, incluidas
 * las ocurrencias calculadas de sus series recurrentes.
 *
 * Los bucles de bloqueo (1 s) y de apagado (5 s) preguntaban a la BD en cada vuelta.
 * Con una BD remota eso son miles de consultas por hora y por usuario, así que ahora
 * consultan esta caché y la BD solo se lee cuando:
 *  - cambia el usuario logueado,
 *  - el propio usuario crea, edita o borra eventos ({@link #invalidate()}),
 *  - pasa el intervalo de sincronización (eventos asignados desde otro PC por un admin),
 *  - la ventana cargada deja de cubrir el momento actual.
 *
 * Los cambios del propio usuario se reflejan al momento; los hechos desde otro equipo,
 * como mucho tras {@code events.schedule-sync-seconds}.
 */
@Component
public class ActiveEventScheduleCache {

    private static final Set<Event.EventCategory> TRACKED_CATEGORIES =
            EnumSet.of(Event.EventCategory.FOCUS, Event.EventCategory.MANDATORY);
    private static final long WINDOW_HOURS = 24;
    private static final long RETRY_AFTER_FAILURE_MS = 30_000;
    private static final Logger LOGGER = LoggerFactory.getLogger(ActiveEventScheduleCache.class);

    private final EventRepo eventRepo;
    private final EventSeriesRepo eventSeriesRepo;
    private final long syncIntervalMs;

    private volatile Snapshot snapshot = Snapshot.EMPTY;

    public ActiveEventScheduleCache(EventRepo eventRepo,
                                    EventSeriesRepo eventSeriesRepo,
                                    @Value("${events.schedule-sync-seconds:120}") long syncIntervalSeconds) {
        this.eventRepo = eventRepo;
        this.eventSeriesRepo = eventSeriesRepo;
        this.syncIntervalMs = Math.max(10, syncIntervalSeconds) * 1000L;
    }

    /** Indica si el usuario tiene ahora mismo un evento activo de la categoría dada. */
    public boolean isCategoryActive(Event.EventCategory category, Long userId) {
        if (userId == null) {
            return false;
        }

        LocalDateTime now = LocalDateTime.now();
        Snapshot current = snapshotFor(userId, now);
        for (Interval interval : current.intervals()) {
            if (interval.category() == category
                    && !interval.start().isAfter(now)
                    && !interval.end().isBefore(now)) {
                return true;
            }
        }
        return false;
    }

    /** Fuerza una recarga en la próxima consulta (p. ej. tras guardar o borrar un evento). */
    public void invalidate() {
        // Se marca como caducada pero se conservan los intervalos por si la recarga falla.
        Snapshot current = snapshot;
        snapshot = new Snapshot(current.userId(), current.intervals(), 0, current.windowEnd());
    }

    private Snapshot snapshotFor(Long userId, LocalDateTime now) {
        Snapshot current = snapshot;
        if (current.isValidFor(userId, now, syncIntervalMs)) {
            return current;
        }

        synchronized (this) {
            current = snapshot;
            if (current.isValidFor(userId, now, syncIntervalMs)) {
                return current;
            }

            LocalDateTime windowEnd = now.plusHours(WINDOW_HOURS);
            try {
                List<Interval> intervals = new ArrayList<>();
                eventRepo.findUserEventsOfCategoriesInRange(userId, TRACKED_CATEGORIES, now, windowEnd)
                        .stream()
                        .filter(event -> event.getStartTime() != null && event.getEndTime() != null)
                        .map(event -> new Interval(event.getCategory(), event.getStartTime(), event.getEndTime()))
                        .forEach(intervals::add);
                for (EventSeries series : eventSeriesRepo.findUserSeriesOfCategoriesInRange(
                        userId, TRACKED_CATEGORIES, now.toLocalDate().minusDays(1), windowEnd)) {
                    for (EventSeries.Occurrence occurrence : series.occurrencesBetween(now, windowEnd)) {
                        intervals.add(new Interval(series.getCategory(), occurrence.start(), occurrence.end()));
                    }
                }

                Snapshot loaded = new Snapshot(userId, List.copyOf(intervals), System.currentTimeMillis(), windowEnd);
                snapshot = loaded;
                return loaded;
            } catch (RuntimeException e) {
                // BD remota inaccesible: se mantiene lo último conocido y se reintenta en 30 s.
                // Lanzar aquí cancelaría para siempre los bucles programados que nos consultan.
                LOGGER.warn("No se pudo sincronizar la agenda FOCUS/MANDATORY: {}", e.getMessage());
                List<Interval> lastKnown = Objects.equals(current.userId(), userId) ? current.intervals() : List.of();
                long retryAt = System.currentTimeMillis() - syncIntervalMs + RETRY_AFTER_FAILURE_MS;
                Snapshot fallback = new Snapshot(userId, lastKnown, retryAt, windowEnd);
                snapshot = fallback;
                return fallback;
            }
        }
    }

    private record Interval(Event.EventCategory category, LocalDateTime start, LocalDateTime end) {
    }

    private record Snapshot(Long userId, List<Interval> intervals, long loadedAtMs, LocalDateTime windowEnd) {
        static final Snapshot EMPTY = new Snapshot(null, List.of(), 0, LocalDateTime.MIN);

        boolean isValidFor(Long requestedUserId, LocalDateTime now, long maxAgeMs) {
            return Objects.equals(userId, requestedUserId)
                    && System.currentTimeMillis() - loadedAtMs < maxAgeMs
                    && now.isBefore(windowEnd);
        }
    }
}
