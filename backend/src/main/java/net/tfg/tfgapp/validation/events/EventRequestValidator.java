package net.tfg.tfgapp.validation.events;

import net.tfg.tfgapp.DTOs.events.EventRequest;
import org.springframework.stereotype.Component;

import java.time.DateTimeException;

/** Valida reglas básicas de eventos antes de persistirlos. */
@Component
public class EventRequestValidator {

    public void requireValidDates(EventRequest request) {
        if (request.getEndTime() == null
                || request.getStartTime() == null
                || !request.getEndTime().isAfter(request.getStartTime())) {
            throw new DateTimeException("La fecha de inicio/fin no es correcta.");
        }
    }
}
