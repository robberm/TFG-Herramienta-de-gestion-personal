package net.tfg.tfgapp.DTOs.events;

import net.tfg.tfgapp.domains.Event;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Resumen de una serie de eventos recurrentes para el panel de eventos programados.
 * startTime/endTime son los de la primera ocurrencia y sirven de base para editarla.
 *
 * occurrenceCount y upcomingCount son null si la serie no tiene fecha de fin.
 */
public record EventSeriesSummary(
        Long seriesId,
        String title,
        String description,
        String location,
        Event.EventCategory category,
        Boolean isAllDay,
        List<Integer> reminderMinutesBeforeList,
        String recurrenceType,
        LocalDateTime startTime,
        LocalDateTime endTime,
        LocalDate recurrenceEndDate,
        List<Integer> recurrenceWeekdays,
        Integer occurrenceCount,
        Integer upcomingCount,
        LocalDateTime nextStartTime,
        int editedOccurrenceCount,
        boolean assignedByAdmin,
        String assignedByAdminUsername,
        String assignedToUsername,
        List<Long> assignedUserIds,
        List<String> assignedUsernames
) {
}
