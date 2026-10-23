package net.tfg.tfgapp.DTOs.events;

import net.tfg.tfgapp.domains.Event;
import net.tfg.tfgapp.domains.EventAssignment;
import net.tfg.tfgapp.domains.EventSeries;
import net.tfg.tfgapp.domains.EventSeriesAssignment;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Evento tal y como lo pinta el calendario: un {@link Event} guardado o una ocurrencia
 * calculada de una {@link EventSeries}. Mantiene la forma del JSON que ya devolvía Event.
 *
 * Las ocurrencias calculadas no tienen fila propia, así que su id es textual:
 * "series:{seriesId}:{yyyy-MM-dd}". El frontend lo usa para llamar a los endpoints
 * de ocurrencia en lugar de a los de evento.
 */
public record CalendarEventView(
        Object id,
        Long seriesId,
        LocalDate occurrenceDate,
        String recurrenceType,
        String title,
        String description,
        LocalDateTime startTime,
        LocalDateTime endTime,
        String location,
        Event.EventCategory category,
        Boolean isAllDay,
        List<Integer> reminderMinutesBeforeList,
        boolean assignedByAdmin,
        String assignedByAdminUsername,
        String assignedToUsername,
        Long assignedToUserId,
        List<Long> assignedUserIds
) {

    public static String occurrenceId(Long seriesId, LocalDate date) {
        return "series:" + seriesId + ":" + date;
    }

    public static CalendarEventView of(Event event) {
        List<Long> assignedUserIds = new ArrayList<>();
        for (EventAssignment assignment : event.getAssignments()) {
            assignedUserIds.add(assignment.getPersonalUser().getId());
        }

        return new CalendarEventView(
                event.getId(),
                event.getSeriesId(),
                null,
                null,
                event.getTitle(),
                event.getDescription(),
                event.getStartTime(),
                event.getEndTime(),
                event.getLocation(),
                event.getCategory(),
                event.getIsAllDay(),
                event.getReminderMinutesBeforeList(),
                event.isAssignedByAdmin(),
                event.getAssignedByAdminUsername(),
                event.getAssignedToUsername(),
                event.getAssignedToUserId(),
                assignedUserIds
        );
    }

    /**
     * @param viewerUserId usuario que mira el calendario; su asignación es la que se muestra
     */
    public static CalendarEventView of(EventSeries series, EventSeries.Occurrence occurrence, Long viewerUserId) {
        EventSeriesAssignment shown = viewerUserId != null ? series.assignmentFor(viewerUserId) : null;
        if (shown == null && !series.getAssignments().isEmpty()) {
            shown = series.getAssignments().get(0);
        }

        List<Long> assignedUserIds = new ArrayList<>();
        for (EventSeriesAssignment assignment : series.getAssignments()) {
            assignedUserIds.add(assignment.getPersonalUser().getId());
        }

        return new CalendarEventView(
                occurrenceId(series.getId(), occurrence.date()),
                series.getId(),
                occurrence.date(),
                series.getRecurrenceType(),
                series.getTitle(),
                series.getDescription(),
                occurrence.start(),
                occurrence.end(),
                series.getLocation(),
                series.getCategory(),
                series.getIsAllDay(),
                series.getReminderMinutesBeforeList(),
                shown != null && shown.getAudAdmin() != null,
                shown != null && shown.getAudAdmin() != null ? shown.getAudAdmin().getUsername() : null,
                shown != null ? shown.getPersonalUser().getUsername() : null,
                shown != null ? shown.getPersonalUser().getId() : null,
                assignedUserIds
        );
    }
}
