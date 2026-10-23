package net.tfg.tfgapp.DTOs.events;

import net.tfg.tfgapp.domains.Event;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Resumen de una serie de eventos recurrentes para el panel de eventos programados.
 * Los datos del evento se toman de la primera ocurrencia; startTime/endTime son
 * los de esa ocurrencia y sirven de base para regenerar la serie.
 */
public record EventSeriesSummary(
        String seriesId,
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
        int occurrenceCount,
        int upcomingCount,
        LocalDateTime nextStartTime,
        boolean assignedByAdmin,
        String assignedByAdminUsername,
        String assignedToUsername,
        List<Long> assignedUserIds,
        List<String> assignedUsernames
) {
}
