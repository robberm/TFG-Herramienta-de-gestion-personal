package net.tfg.tfgapp.service;

import jakarta.persistence.EntityNotFoundException;
import net.tfg.tfgapp.DTOs.events.EventRequest;
import net.tfg.tfgapp.DTOs.events.EventSeriesSummary;
import net.tfg.tfgapp.components.ActiveEventScheduleCache;
import net.tfg.tfgapp.components.SessionStore;
import net.tfg.tfgapp.domains.Event;
import net.tfg.tfgapp.domains.EventAssignment;
import net.tfg.tfgapp.domains.AdminUser;
import net.tfg.tfgapp.domains.PersonalUser;
import net.tfg.tfgapp.repos.EventRepo;
import net.tfg.tfgapp.schedulers.ReminderScheduler;
import net.tfg.tfgapp.utils.WindowsUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.LinkedHashSet;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Set;
import java.util.UUID;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class EventService {

    @Autowired
    public EventRepo eventRepo;

    @Autowired
    public SessionStore sessionStore;

    @Autowired
    private ReminderScheduler reminderScheduler;

    @Autowired
    private ActiveEventScheduleCache eventScheduleCache;

    public <S extends Event> S save(S entity) {
        S savedEvent = eventRepo.save(entity);
        reminderScheduler.scheduleReminder(savedEvent);
        eventScheduleCache.invalidate();
        return savedEvent;
    }

    @Transactional
    public List<Event> createEvents(EventRequest request, List<PersonalUser> targets, AdminUser audAdmin) {
        return createEvents(request, targets, audAdmin, null);
    }

    /**
     * Crea las ocurrencias de un evento. Con existingSeriesId se reutiliza ese id
     * (al regenerar una serie editada desde el panel de eventos programados).
     */
    private List<Event> createEvents(EventRequest request, List<PersonalUser> targets, AdminUser audAdmin, String existingSeriesId) {
        List<LocalDate> dates = resolveOccurrenceDates(request);
        String recurrenceType = normalizedRecurrenceType(request);
        String seriesId = dates.size() > 1
                ? (existingSeriesId != null ? existingSeriesId : UUID.randomUUID().toString())
                : null;
        String weekdays = "CUSTOM".equals(recurrenceType) ? formatWeekdays(request.getRecurrenceWeekdays()) : null;
        LocalDate originalDate = request.getStartTime().toLocalDate();
        List<Event> created = new ArrayList<>();

        for (LocalDate date : dates) {
            long shiftDays = ChronoUnit.DAYS.between(originalDate, date);
            Event event = new Event();
            applyEventDetails(event, request);
            event.setStartTime(request.getStartTime().plusDays(shiftDays));
            event.setEndTime(request.getEndTime().plusDays(shiftDays));
            event.setRecurrenceSeriesId(seriesId);
            event.setRecurrenceType(seriesId == null ? null : recurrenceType);
            event.setRecurrenceEndDate(seriesId == null ? null : request.getRecurrenceEndDate());
            event.setRecurrenceWeekdays(seriesId == null ? null : weekdays);
            for (PersonalUser target : targets) {
                event.addAssignment(target, audAdmin);
            }
            created.add(save(event));
        }
        return created;
    }

    public List<Event> getSeriesEvents(String seriesId) {
        return eventRepo.findByRecurrenceSeriesIdOrderByStartTimeAsc(seriesId);
    }

    public List<Event> findSeriesEventsByUsername(String username) {
        return eventRepo.findSeriesEventsByUser(username);
    }

    public List<Event> findSeriesEventsForAdmin(Long adminId, Long userId) {
        return userId == null
                ? eventRepo.findSeriesEventsForAdmin(adminId)
                : eventRepo.findSeriesEventsForAdminAndUser(adminId, userId);
    }

    /**
     * Sustituye todas las ocurrencias de la serie por las que salen de la nueva configuración.
     */
    @Transactional
    public List<Event> regenerateSeries(String seriesId, EventRequest request, List<PersonalUser> targets, AdminUser audAdmin) {
        deleteSeries(seriesId);
        return createEvents(request, targets, audAdmin, seriesId);
    }

    @Transactional
    public void deleteSeries(String seriesId) {
        List<Event> occurrences = eventRepo.findByRecurrenceSeriesIdOrderByStartTimeAsc(seriesId);
        if (occurrences.isEmpty()) {
            throw new EntityNotFoundException("Serie " + seriesId + " no encontrada.");
        }

        for (Event occurrence : occurrences) {
            reminderScheduler.cancelReminder(occurrence.getId());
        }
        eventRepo.deleteAll(occurrences);
        eventRepo.flush();
        eventScheduleCache.invalidate();
    }

    /**
     * Agrupa ocurrencias por serie. Las series creadas antes de guardar la configuración
     * completa no tienen fecha de fin ni días: se deducen de sus ocurrencias.
     */
    public List<EventSeriesSummary> summarizeSeries(List<Event> events) {
        Map<String, List<Event>> bySeries = new LinkedHashMap<>();
        events.stream()
                .filter(event -> event.getRecurrenceSeriesId() != null)
                .sorted(Comparator.comparing(Event::getStartTime))
                .forEach(event -> bySeries.computeIfAbsent(event.getRecurrenceSeriesId(), key -> new ArrayList<>()).add(event));

        LocalDateTime now = LocalDateTime.now();
        List<EventSeriesSummary> summaries = new ArrayList<>();
        for (Map.Entry<String, List<Event>> entry : bySeries.entrySet()) {
            summaries.add(toSeriesSummary(entry.getKey(), entry.getValue(), now));
        }
        summaries.sort(Comparator.comparing(
                (EventSeriesSummary summary) -> summary.nextStartTime() == null,
                Comparator.naturalOrder()
        ).thenComparing(summary -> summary.nextStartTime() != null ? summary.nextStartTime() : summary.startTime()));
        return summaries;
    }

    private EventSeriesSummary toSeriesSummary(String seriesId, List<Event> occurrences, LocalDateTime now) {
        Event first = occurrences.get(0);
        Event last = occurrences.get(occurrences.size() - 1);
        String recurrenceType = first.getRecurrenceType() != null ? first.getRecurrenceType() : "DAILY";

        List<Event> upcoming = occurrences.stream()
                .filter(event -> event.getEndTime().isAfter(now))
                .toList();

        List<Integer> weekdays = parseWeekdays(first.getRecurrenceWeekdays());
        if (weekdays.isEmpty() && "CUSTOM".equals(recurrenceType)) {
            weekdays = occurrences.stream()
                    .map(event -> event.getStartTime().getDayOfWeek().getValue())
                    .distinct()
                    .sorted()
                    .toList();
        }

        Set<Long> assignedUserIds = new LinkedHashSet<>();
        Set<String> assignedUsernames = new LinkedHashSet<>();
        for (EventAssignment assignment : first.getAssignments()) {
            assignedUserIds.add(assignment.getPersonalUser().getId());
            assignedUsernames.add(assignment.getPersonalUser().getUsername());
        }

        return new EventSeriesSummary(
                seriesId,
                first.getTitle(),
                first.getDescription(),
                first.getLocation(),
                first.getCategory(),
                first.getIsAllDay(),
                new ArrayList<>(first.getReminderMinutesBeforeList()),
                recurrenceType,
                first.getStartTime(),
                first.getEndTime(),
                first.getRecurrenceEndDate() != null ? first.getRecurrenceEndDate() : last.getStartTime().toLocalDate(),
                weekdays,
                occurrences.size(),
                upcoming.size(),
                upcoming.isEmpty() ? null : upcoming.get(0).getStartTime(),
                first.isAssignedByAdmin(),
                first.getAssignedByAdminUsername(),
                first.getAssignedToUsername(),
                new ArrayList<>(assignedUserIds),
                new ArrayList<>(assignedUsernames)
        );
    }

    private String formatWeekdays(List<Integer> weekdays) {
        if (weekdays == null) {
            return null;
        }
        return weekdays.stream()
                .filter(day -> day != null && day >= 1 && day <= 7)
                .distinct()
                .sorted()
                .map(String::valueOf)
                .collect(Collectors.joining(","));
    }

    private List<Integer> parseWeekdays(String weekdays) {
        if (weekdays == null || weekdays.isBlank()) {
            return List.of();
        }
        return Arrays.stream(weekdays.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(Integer::valueOf)
                .toList();
    }

    private List<LocalDate> resolveOccurrenceDates(EventRequest request) {
        LocalDate start = request.getStartTime().toLocalDate();
        String type = normalizedRecurrenceType(request);
        if ("NONE".equals(type)) {
            return List.of(start);
        }

        LocalDate end = request.getRecurrenceEndDate();
        Set<Integer> customDays = request.getRecurrenceWeekdays() == null
                ? Set.of()
                : new LinkedHashSet<>(request.getRecurrenceWeekdays());
        List<LocalDate> dates = new ArrayList<>();
        LocalDate cursor = start;
        while (!cursor.isAfter(end) && dates.size() < 731) {
            boolean include = switch (type) {
                case "DAILY" -> true;
                case "WEEKLY" -> cursor.getDayOfWeek() == start.getDayOfWeek();
                case "WEEKDAYS" -> cursor.getDayOfWeek().getValue() <= 5;
                case "CUSTOM" -> customDays.contains(cursor.getDayOfWeek().getValue());
                default -> cursor.equals(start);
            };
            if (include) {
                dates.add(cursor);
            }
            cursor = cursor.plusDays(1);
        }
        if (dates.isEmpty()) {
            dates.add(start);
        }
        return dates;
    }

    private String normalizedRecurrenceType(EventRequest request) {
        return request.getRecurrenceType() == null
                ? "NONE"
                : request.getRecurrenceType().toUpperCase();
    }

    public List<Event> findEventsByUserAndDateRange(String username, LocalDateTime start, LocalDateTime end) {
        return eventRepo.findEventsByUserAndDateRange(username, start, end);
    }

    public List<Event> findAssignedEventsForAdminInRange(Long adminId, LocalDateTime start, LocalDateTime end) {
        return eventRepo.findAssignedEventsForAdminInRange(adminId, start, end);
    }

    public List<Event> findAssignedEventsForAdminAndUserInRange(Long adminId, Long userId, LocalDateTime start, LocalDateTime end) {
        return eventRepo.findAssignedEventsForAdminAndUserInRange(adminId, userId, start, end);
    }

    public List<Event> getEventsByUsername(String username) {
        return eventRepo.findEventsByUser(username);
    }

    public List<Event> getAssignedEventsForAdminAndUser(Long adminId, Long userId) {
        return eventRepo.findAssignedEventsForAdminAndUser(adminId, userId);
    }

    public Optional<Event> updateEventById(Long id, EventRequest eventDetails) {
        Optional<Event> eventOptional = getEventById(id);

        if (eventOptional.isPresent()) {
            Event existingEvent = eventOptional.get();
            applyEventDetails(existingEvent, eventDetails);

            Event updatedEvent = eventRepo.save(existingEvent);
            reminderScheduler.rescheduleReminder(updatedEvent);
            eventScheduleCache.invalidate();
            return Optional.of(updatedEvent);
        }

        return Optional.empty();
    }

    public void applyEventDetails(Event target, EventRequest details) {
        target.setTitle(details.getTitle());
        target.setDescription(details.getDescription());
        target.setStartTime(details.getStartTime());
        target.setEndTime(details.getEndTime());
        target.setLocation(details.getLocation());
        target.setCategory(details.getCategory() != null ? details.getCategory() : Event.EventCategory.PERSONAL);
        target.setIsAllDay(details.getIsAllDay() != null ? details.getIsAllDay() : false);

        target.setReminderMinutesBeforeList(normalizeReminderOffsets(details.getReminderMinutesBeforeList()));
    }

    private List<Integer> normalizeReminderOffsets(List<Integer> reminderMinutesBeforeList) {
        LinkedHashSet<Integer> normalized = new LinkedHashSet<>();

        if (reminderMinutesBeforeList != null) {
            for (Integer value : reminderMinutesBeforeList) {
                if (value != null && value >= 0) {
                    normalized.add(value);
                }
            }
        }

        return new ArrayList<>(normalized);
    }

    public Optional<Event> getEventById(Long id) {
        return eventRepo.findById(id);
    }

    public void deleteEventById(Long id) {
        Optional<Event> eventOptional = eventRepo.findById(id);

        if (eventOptional.isEmpty()) {
            throw new EntityNotFoundException("Event with ID " + id + " not found.");
        }

        reminderScheduler.cancelReminder(id);
        eventRepo.deleteById(id);
        eventScheduleCache.invalidate();
    }

    public void deleteAdminAssignedEventCascade(Long adminId, Event event) {
        if (event == null || event.getId() == null) {
            return;
        }
        deleteEventById(event.getId());
    }

    public List<String> getCategories() {
        List<String> categories = new ArrayList<>();
        for (Event.EventCategory category : Event.EventCategory.values()) {
            categories.add(category.name());
        }
        return categories;
    }

    private boolean isEventCategoryActive(String category, Long userId) {
        // Se consulta cada 5 s: se resuelve en memoria, sin ir a la BD.
        return eventScheduleCache.isCategoryActive(Event.EventCategory.valueOf(category), userId);
    }

    @Scheduled(fixedDelay = 5000)
    public void isEnforceShutdownCategory() {
        if (sessionStore == null) {
            return;
        }

        Long userId = sessionStore.getLoggedUserId();

        if (userId == null) {
            return;
        }

        if (isEventCategoryActive("MANDATORY", userId)) {
            WindowsUtils.shutdownSystem();
        }
    }
}
