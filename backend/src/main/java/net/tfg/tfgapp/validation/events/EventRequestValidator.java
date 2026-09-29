package net.tfg.tfgapp.validation.events;

import net.tfg.tfgapp.DTOs.events.EventRequest;
import org.springframework.stereotype.Component;

import java.time.DateTimeException;
import java.util.Set;

/** Valida reglas básicas de eventos antes de persistirlos. */
@Component
public class EventRequestValidator {

    private static final Set<String> RECURRENCE_TYPES = Set.of("NONE", "DAILY", "WEEKLY", "WEEKDAYS", "CUSTOM");

    public void requireValidDates(EventRequest request) {
        if (request.getEndTime() == null
                || request.getStartTime() == null
                || !request.getEndTime().isAfter(request.getStartTime())) {
            throw new DateTimeException("La fecha de inicio/fin no es correcta.");
        }

        String recurrenceType = request.getRecurrenceType() == null
                ? "NONE"
                : request.getRecurrenceType().toUpperCase();
        if (!RECURRENCE_TYPES.contains(recurrenceType)) {
            throw new DateTimeException("La repetición seleccionada no es válida.");
        }
        if (!"NONE".equals(recurrenceType)) {
            if (request.getRecurrenceEndDate() == null
                    || request.getRecurrenceEndDate().isBefore(request.getStartTime().toLocalDate())) {
                throw new DateTimeException("La repetición necesita una fecha de fin válida.");
            }
            if (request.getRecurrenceEndDate().isAfter(request.getStartTime().toLocalDate().plusYears(2))) {
                throw new DateTimeException("Una serie no puede planificarse con más de dos años de antelación.");
            }
        }
        if ("CUSTOM".equals(recurrenceType)
                && (request.getRecurrenceWeekdays() == null
                || request.getRecurrenceWeekdays().stream().noneMatch(day -> day != null && day >= 1 && day <= 7))) {
            throw new DateTimeException("Selecciona al menos un día para la repetición personalizada.");
        }
    }
}
