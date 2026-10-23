package net.tfg.tfgapp.schedulers;

import net.tfg.tfgapp.components.SessionStore;
import net.tfg.tfgapp.domains.Event;
import net.tfg.tfgapp.domains.EventSeries;
import net.tfg.tfgapp.mappers.ReminderMapper;
import net.tfg.tfgapp.repos.EventRepo;
import net.tfg.tfgapp.repos.EventSeriesRepo;
import net.tfg.tfgapp.service.ReminderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;
import java.util.stream.Collectors;

@Component
public class ReminderScheduler {

    /**
     * Tareas activas indexadas por id de evento.
     */
    private final Map<Long, List<ScheduledFuture<?>>> scheduledReminders = new ConcurrentHashMap<>();

    /**
     * Las series no tienen una fila por ocurrencia: cada {@link #SERIES_PLANNING_PERIOD_MS}
     * se programan los avisos que caen en los próximos {@link #SERIES_LOOKAHEAD_MINUTES}
     * minutos. Clave: "{seriesId}:{fecha}:{minutos antes}".
     */
    private static final long SERIES_PLANNING_PERIOD_MS = 5 * 60 * 1000;
    private static final long SERIES_LOOKAHEAD_MINUTES = 10;
    private final Map<String, ScheduledFuture<?>> scheduledSeriesReminders = new ConcurrentHashMap<>();

    @Autowired
    private TaskScheduler reminderTaskScheduler;

    @Autowired
    private EventRepo eventRepo;

    @Autowired
    private EventSeriesRepo eventSeriesRepo;

    @Autowired
    private ReminderService reminderService;

    @Autowired
    private ReminderMapper reminderMapper;

    @Autowired
    private SessionStore sessionStore;

    /**
     * Programa al arrancar la aplicación todos los reminders futuros pendientes.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void schedulePendingRemindersOnStartup() {
        LocalDateTime now = LocalDateTime.now();
        List<Event> eventsWithReminder = eventRepo.findPendingReminders(now);

        for (Event event : eventsWithReminder) {
            scheduleReminder(event);
        }
    }

    /**
     * Programa los reminders de un evento si tiene configuración válida.
     *
     * @param event evento a programar
     */
    public void scheduleReminder(Event event) {
        if (!isSchedulable(event)) {
            cancelReminder(event.getId());
            return;
        }

        cancelReminder(event.getId());

        List<Integer> offsets = resolveReminderOffsets(event);
        if (offsets.isEmpty()) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        List<ScheduledFuture<?>> futures = new ArrayList<>();

        for (Integer offsetMinutes : offsets) {
            LocalDateTime triggerTime = event.getStartTime().minusMinutes(offsetMinutes);
            Date executionDate = triggerTime.isAfter(now)
                    ? toDate(triggerTime)
                    : new Date(System.currentTimeMillis() + 1000);

            ScheduledFuture<?> scheduledFuture = reminderTaskScheduler.schedule(
                    () -> executeReminder(event, offsetMinutes),
                    executionDate
            );

            if (scheduledFuture != null) {
                futures.add(scheduledFuture);
            }
        }

        if (!futures.isEmpty()) {
            scheduledReminders.put(event.getId(), futures);
        }
    }

    /**
     * Reprograma los reminders de un evento tras una modificación.
     *
     * @param event evento actualizado
     */
    public void rescheduleReminder(Event event) {
        scheduleReminder(event);
    }

    /**
     * Cancela las tareas asociadas a un evento si existen.
     *
     * @param eventId id del evento
     */
    public void cancelReminder(Long eventId) {
        if (eventId == null) {
            return;
        }

        List<ScheduledFuture<?>> futures = scheduledReminders.remove(eventId);

        if (futures != null) {
            futures.forEach((future) -> future.cancel(false));
        }
    }

    /**
     * Programa los avisos de las series que caen en la siguiente ventana.
     */
    @Scheduled(initialDelay = 10_000, fixedDelay = SERIES_PLANNING_PERIOD_MS)
    public void planSeriesReminders() {
        scheduledSeriesReminders.values().removeIf(ScheduledFuture::isDone);

        LocalDateTime now = LocalDateTime.now();
        for (EventSeries series : eventSeriesRepo.findWithPendingReminders(now.toLocalDate())) {
            planSeriesReminders(series, now);
        }
    }

    /** Vuelve a programar los avisos de una serie tras crearla o editarla. */
    public void rescheduleSeriesReminders(EventSeries series) {
        cancelSeriesReminders(series.getId());
        planSeriesReminders(series, LocalDateTime.now());
    }

    public void cancelSeriesReminders(Long seriesId) {
        if (seriesId == null) {
            return;
        }

        String prefix = seriesId + ":";
        scheduledSeriesReminders.entrySet().removeIf(entry -> {
            if (!entry.getKey().startsWith(prefix)) {
                return false;
            }
            entry.getValue().cancel(false);
            return true;
        });
    }

    private void planSeriesReminders(EventSeries series, LocalDateTime now) {
        if (series.getId() == null) {
            return;
        }

        // Se copian ahora: el aviso se ejecuta fuera de la sesión de JPA.
        Set<Long> assignedUserIds = series.getAssignments().stream()
                .map(assignment -> assignment.getPersonalUser().getId())
                .collect(Collectors.toSet());
        LocalDateTime windowEnd = now.plusMinutes(SERIES_LOOKAHEAD_MINUTES);
        for (Integer offsetMinutes : series.getReminderMinutesBeforeList()) {
            if (offsetMinutes == null || offsetMinutes < 0) {
                continue;
            }

            // Ocurrencias cuyo aviso (inicio - offset) cae dentro de [now, windowEnd).
            LocalDateTime from = now.plusMinutes(offsetMinutes);
            LocalDateTime to = windowEnd.plusMinutes(offsetMinutes);
            for (EventSeries.Occurrence occurrence : series.occurrencesBetween(from, to)) {
                LocalDateTime triggerTime = occurrence.start().minusMinutes(offsetMinutes);
                if (triggerTime.isBefore(now) || !triggerTime.isBefore(windowEnd)) {
                    continue;
                }

                String key = series.getId() + ":" + occurrence.date() + ":" + offsetMinutes;
                scheduledSeriesReminders.computeIfAbsent(key, ignored -> reminderTaskScheduler.schedule(
                        () -> executeSeriesReminder(series, assignedUserIds, occurrence, offsetMinutes),
                        toDate(triggerTime)
                ));
            }
        }
    }

    /**
     * Envía el aviso de una ocurrencia si el usuario logueado es uno de los asignados.
     */
    private void executeSeriesReminder(EventSeries series, Set<Long> assignedUserIds,
                                       EventSeries.Occurrence occurrence, Integer offsetMinutes) {
        Long loggedUserId = sessionStore.getLoggedUserId();
        if (loggedUserId == null || !assignedUserIds.contains(loggedUserId)) {
            return;
        }

        reminderService.sendReminder(reminderMapper.toDto(series, occurrence, offsetMinutes));
    }

    /**
     * Ejecuta un reminder de un evento si el usuario autenticado coincide con el propietario.
     *
     * @param event evento cuyo reminder debe enviarse
     * @param offsetMinutes offset configurado para el reminder actual
     */
    private void executeReminder(Event event, Integer offsetMinutes) {
        if (event == null || event.getId() == null || event.getUser() == null) {
            return;
        }

        Long loggedUserId = sessionStore.getLoggedUserId();

        if (loggedUserId == null || !loggedUserId.equals(event.getUser().getId())) {
            return;
        }

        reminderService.sendReminder(reminderMapper.toDto(event, offsetMinutes));
    }

    /**
     * Comprueba si un evento tiene los datos mínimos para poder planificar sus reminders.
     *
     * @param event evento a validar
     * @return true si es programable
     */
    private boolean isSchedulable(Event event) {
        return event != null
                && event.getId() != null
                && event.getStartTime() != null
                && event.getEndTime() != null
                && event.getEndTime().isAfter(LocalDateTime.now());
    }

    private List<Integer> resolveReminderOffsets(Event event) {
        List<Integer> offsets = new ArrayList<>();
        if (event.getReminderMinutesBeforeList() == null) {
            return offsets;
        }

        for (Integer value : event.getReminderMinutesBeforeList()) {
            if (value != null && value >= 0 && !offsets.contains(value)) {
                offsets.add(value);
            }
        }
        return offsets;
    }

    /**
     * Convierte un LocalDateTime a Date usando la zona horaria del sistema.
     *
     * @param dateTime fecha a convertir
     * @return fecha convertida
     */
    private Date toDate(LocalDateTime dateTime) {
        return Date.from(dateTime.atZone(ZoneId.systemDefault()).toInstant());
    }
}
