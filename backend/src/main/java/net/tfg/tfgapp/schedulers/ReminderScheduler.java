package net.tfg.tfgapp.schedulers;

import net.tfg.tfgapp.components.SessionStore;
import net.tfg.tfgapp.domains.Event;
import net.tfg.tfgapp.mappers.ReminderMapper;
import net.tfg.tfgapp.repos.EventRepo;
import net.tfg.tfgapp.service.ReminderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

@Component
public class ReminderScheduler {

    /**
     * Tareas activas indexadas por id de evento.
     */
    private final Map<Long, List<ScheduledFuture<?>>> scheduledReminders = new ConcurrentHashMap<>();

    @Autowired
    private TaskScheduler reminderTaskScheduler;

    @Autowired
    private EventRepo eventRepo;

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
