package net.tfg.tfgapp.validation.events;

import net.tfg.tfgapp.DTOs.events.EventRequest;
import org.springframework.stereotype.Component;

import java.time.DateTimeException;
import java.util.Set;

/** Valida reglas básicas de eventos antes de persistirlos. */
@Component
public class EventRequestValidator {

    private static final Set<String> RECURRENCE_TYPES = Set.of("NONE", "DAILY", "WEEKLY", "WEEKDAYS", "CUSTOM");
    private static final int MAX_SERIES_YEARS = 10;

    public boolean isRecurring(EventRequest request) {
        return request.getRecurrenceType() != null && !"NONE".equalsIgnoreCase(request.getRecurrenceType());
    }

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
        // Sin fecha de fin la serie no acaba nunca: sus ocurrencias se calculan al consultar,
        // así que no hace falta limitarla. Con fecha de fin, el tope evita recorridos absurdos.
        if (!"NONE".equals(recurrenceType) && request.getRecurrenceEndDate() != null) {
            if (request.getRecurrenceEndDate().isBefore(request.getStartTime().toLocalDate())) {
                throw new DateTimeException("La fecha de fin de la repetición no es válida.");
            }
            if (request.getRecurrenceEndDate().isAfter(request.getStartTime().toLocalDate().plusYears(MAX_SERIES_YEARS))) {
                throw new DateTimeException("Una serie no puede terminar más de " + MAX_SERIES_YEARS
                        + " años después de empezar; déjala sin fecha de fin.");
            }
        }
        if ("CUSTOM".equals(recurrenceType)
                && (request.getRecurrenceWeekdays() == null
                || request.getRecurrenceWeekdays().stream().noneMatch(day -> day != null && day >= 1 && day <= 7))) {
            throw new DateTimeException("Selecciona al menos un día para la repetición personalizada.");
        }
    }
}
