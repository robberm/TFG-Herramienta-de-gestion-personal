package net.tfg.tfgapp.service;

import net.tfg.tfgapp.DTOs.events.CalendarEventView;
import net.tfg.tfgapp.DTOs.events.EventRequest;
import net.tfg.tfgapp.DTOs.events.EventSeriesSummary;
import net.tfg.tfgapp.components.ActiveEventScheduleCache;
import net.tfg.tfgapp.domains.AdminUser;
import net.tfg.tfgapp.domains.Event;
import net.tfg.tfgapp.domains.EventSeries;
import net.tfg.tfgapp.domains.EventSeriesAssignment;
import net.tfg.tfgapp.domains.PersonalUser;
import net.tfg.tfgapp.repos.EventRepo;
import net.tfg.tfgapp.repos.EventSeriesRepo;
import net.tfg.tfgapp.schedulers.ReminderScheduler;
import net.tfg.tfgapp.utils.RecurrenceRules;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Series de eventos recurrentes: se guarda la regla y las ocurrencias se calculan al
 * consultar un rango, igual que hacen los calendarios basados en iCalendar.
 */
@Service
public class EventSeriesService {

    private final EventSeriesRepo seriesRepo;
    private final EventRepo eventRepo;
    private final EventService eventService;
    private final ReminderScheduler reminderScheduler;
    private final ActiveEventScheduleCache eventScheduleCache;

    public EventSeriesService(EventSeriesRepo seriesRepo,
                              EventRepo eventRepo,
                              EventService eventService,
                              ReminderScheduler reminderScheduler,
                              ActiveEventScheduleCache eventScheduleCache) {
        this.seriesRepo = seriesRepo;
        this.eventRepo = eventRepo;
        this.eventService = eventService;
        this.reminderScheduler = reminderScheduler;
        this.eventScheduleCache = eventScheduleCache;
    }

    public Optional<EventSeries> findById(Long seriesId) {
        return seriesRepo.findById(seriesId);
    }

    public List<EventSeries> findByUsername(String username) {
        return seriesRepo.findByUsername(username);
    }

    public List<EventSeries> findForAdmin(Long adminId, Long userId) {
        return userId == null
                ? seriesRepo.findForAdmin(adminId)
                : seriesRepo.findForAdminAndUser(adminId, userId);
    }

    public List<EventSeries> findByUsernameInRange(String username, LocalDateTime start, LocalDateTime end) {
        return seriesRepo.findByUsernameInRange(username, rangeStartDate(start), end);
    }

    public List<EventSeries> findForAdminInRange(Long adminId, Long userId, LocalDateTime start, LocalDateTime end) {
        return userId == null
                ? seriesRepo.findForAdminInRange(adminId, rangeStartDate(start), end)
                : seriesRepo.findForAdminAndUserInRange(adminId, userId, rangeStartDate(start), end);
    }

    /**
     * Crea la serie. Si la regla no genera ninguna fecha (p. ej. días elegidos que no
     * caen antes de la fecha de fin) devuelve vacío y el llamante crea un evento suelto.
     */
    @Transactional
    public Optional<EventSeries> createSeries(EventRequest request, List<PersonalUser> targets, AdminUser audAdmin) {
        EventSeries series = new EventSeries();
        if (!applySeriesDetails(series, request)) {
            return Optional.empty();
        }
        for (PersonalUser target : targets) {
            series.addAssignment(target, audAdmin);
        }
        return Optional.of(saveAndReschedule(series));
    }

    /**
     * Cambia la configuración de toda la serie. Las fechas excluidas y las ocurrencias
     * editadas por separado se conservan, como en Google Calendar.
     */
    @Transactional
    public EventSeries updateSeries(EventSeries series, EventRequest request, List<PersonalUser> targets, AdminUser audAdmin) {
        if (!applySeriesDetails(series, request)) {
            throw new IllegalArgumentException("La repetición no genera ninguna fecha.");
        }
        series.replaceAssignments(targets, audAdmin);
        return saveAndReschedule(series);
    }

    /** Borra la serie y también sus ocurrencias editadas por separado. */
    @Transactional
    public void deleteSeries(EventSeries series) {
        for (Event edited : eventRepo.findBySeries_Id(series.getId())) {
            eventService.deleteEventById(edited.getId());
        }
        reminderScheduler.cancelSeriesReminders(series.getId());
        seriesRepo.delete(series);
        eventScheduleCache.invalidate();
    }

    /**
     * Edita una sola ocurrencia: pasa a ser un evento normal enlazado a la serie y su
     * fecha original se excluye de la regla.
     */
    @Transactional
    public Event editOccurrence(EventSeries series, LocalDate date, EventRequest request) {
        requireOccurrence(series, date);

        Event edited = new Event();
        eventService.applyEventDetails(edited, request);
        edited.setSeries(series);
        for (EventSeriesAssignment assignment : series.getAssignments()) {
            edited.addAssignment(assignment.getPersonalUser(), assignment.getAudAdmin());
        }

        series.getExcludedDates().add(date);
        saveAndReschedule(series);
        return eventService.save(edited);
    }

    /** Borra una sola ocurrencia (la excluye de la regla). */
    @Transactional
    public void deleteOccurrence(EventSeries series, LocalDate date) {
        requireOccurrence(series, date);
        series.getExcludedDates().add(date);
        saveAndReschedule(series);
    }

    /**
     * Ocurrencias calculadas de las series que se solapan con [from, to).
     */
    public List<CalendarEventView> occurrencesInRange(List<EventSeries> seriesList, LocalDateTime from,
                                                      LocalDateTime to, Long viewerUserId) {
        List<CalendarEventView> views = new ArrayList<>();
        for (EventSeries series : seriesList) {
            for (EventSeries.Occurrence occurrence : series.occurrencesBetween(from, to)) {
                views.add(CalendarEventView.of(series, occurrence, viewerUserId));
            }
        }
        return views;
    }

    public List<EventSeriesSummary> summarize(List<EventSeries> seriesList, Long viewerUserId) {
        LocalDateTime now = LocalDateTime.now();
        List<EventSeriesSummary> summaries = new ArrayList<>();
        for (EventSeries series : seriesList) {
            summaries.add(toSummary(series, now, viewerUserId));
        }
        // Primero las que siguen activas, por su próxima ocurrencia; al final las terminadas.
        summaries.sort(Comparator
                .comparing((EventSeriesSummary summary) -> summary.nextStartTime() == null)
                .thenComparing(summary -> summary.nextStartTime() != null ? summary.nextStartTime() : summary.startTime()));
        return summaries;
    }

    private EventSeriesSummary toSummary(EventSeries series, LocalDateTime now, Long viewerUserId) {
        LocalDateTime nextStart = nextOccurrenceStart(series, now);

        Integer occurrenceCount = null;
        Integer upcomingCount = null;
        if (series.getRecurrenceEndDate() != null) {
            List<LocalDate> dates = series.allDates();
            occurrenceCount = dates.size();
            upcomingCount = (int) dates.stream()
                    .filter(date -> series.occurrenceOn(date).end().isAfter(now))
                    .count();
        }

        EventSeriesAssignment shown = viewerUserId != null ? series.assignmentFor(viewerUserId) : null;
        if (shown == null && !series.getAssignments().isEmpty()) {
            shown = series.getAssignments().get(0);
        }
        List<Long> assignedUserIds = new ArrayList<>();
        List<String> assignedUsernames = new ArrayList<>();
        for (EventSeriesAssignment assignment : series.getAssignments()) {
            assignedUserIds.add(assignment.getPersonalUser().getId());
            assignedUsernames.add(assignment.getPersonalUser().getUsername());
        }

        return new EventSeriesSummary(
                series.getId(),
                series.getTitle(),
                series.getDescription(),
                series.getLocation(),
                series.getCategory(),
                series.getIsAllDay(),
                new ArrayList<>(series.getReminderMinutesBeforeList()),
                series.getRecurrenceType(),
                series.getStartTime(),
                series.getEndTime(),
                series.getRecurrenceEndDate(),
                new ArrayList<>(series.getWeekdaySet()),
                occurrenceCount,
                upcomingCount,
                nextStart,
                eventRepo.findBySeries_Id(series.getId()).size(),
                shown != null && shown.getAudAdmin() != null,
                shown != null && shown.getAudAdmin() != null ? shown.getAudAdmin().getUsername() : null,
                shown != null ? shown.getPersonalUser().getUsername() : null,
                assignedUserIds,
                assignedUsernames
        );
    }

    /**
     * Próxima ocurrencia que todavía no ha terminado. Se busca por ventanas de un año
     * para no recorrer día a día una serie sin fin.
     */
    private LocalDateTime nextOccurrenceStart(EventSeries series, LocalDateTime now) {
        LocalDateTime from = now;
        LocalDate lastDate = series.getRecurrenceEndDate();
        while (lastDate == null || !from.toLocalDate().isAfter(lastDate.plusDays(1))) {
            LocalDateTime to = from.plusYears(1);
            List<EventSeries.Occurrence> found = series.occurrencesBetween(from, to);
            if (!found.isEmpty()) {
                return found.get(0).start();
            }
            if (lastDate == null && from.isAfter(now.plusYears(5))) {
                return null;
            }
            from = to;
        }
        return null;
    }

    /**
     * Copia los datos de la petición en la serie. La primera fecha que genera la regla
     * pasa a ser el ancla, así la serie empieza siempre en una ocurrencia real.
     *
     * @return false si la regla no genera ninguna fecha
     */
    private boolean applySeriesDetails(EventSeries series, EventRequest request) {
        String type = request.getRecurrenceType().toUpperCase();
        String weekdays = "CUSTOM".equals(type) ? RecurrenceRules.formatWeekdays(request.getRecurrenceWeekdays()) : null;
        Set<Integer> weekdaySet = RecurrenceRules.parseWeekdays(weekdays);
        LocalDate requestedStart = request.getStartTime().toLocalDate();

        Optional<LocalDate> firstDate = RecurrenceRules.datesBetween(type, requestedStart,
                request.getRecurrenceEndDate(), weekdaySet, requestedStart, requestedStart.plusDays(6)).stream().findFirst();
        if (firstDate.isEmpty()) {
            return false;
        }
        long shiftDays = ChronoUnit.DAYS.between(requestedStart, firstDate.get());

        series.setTitle(request.getTitle());
        series.setDescription(request.getDescription());
        series.setLocation(request.getLocation());
        series.setCategory(request.getCategory() != null ? request.getCategory() : Event.EventCategory.PERSONAL);
        series.setIsAllDay(request.getIsAllDay() != null ? request.getIsAllDay() : false);
        series.setStartTime(request.getStartTime().plusDays(shiftDays));
        series.setEndTime(request.getEndTime().plusDays(shiftDays));
        series.setRecurrenceType(type);
        series.setRecurrenceEndDate(request.getRecurrenceEndDate());
        series.setRecurrenceWeekdays(weekdays);
        series.setReminderMinutesBeforeList(EventService.normalizeReminderOffsets(request.getReminderMinutesBeforeList()));
        return true;
    }

    private void requireOccurrence(EventSeries series, LocalDate date) {
        if (date == null || !series.hasOccurrenceOn(date)) {
            throw new IllegalArgumentException("La serie no tiene ninguna ocurrencia el " + date + ".");
        }
    }

    private EventSeries saveAndReschedule(EventSeries series) {
        EventSeries saved = seriesRepo.save(series);
        reminderScheduler.rescheduleSeriesReminders(saved);
        eventScheduleCache.invalidate();
        return saved;
    }

    /** Una ocurrencia que acaba el día del inicio del rango puede haber empezado antes. */
    private LocalDate rangeStartDate(LocalDateTime start) {
        return start.toLocalDate().minusDays(1);
    }
}
