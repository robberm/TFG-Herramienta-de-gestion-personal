package net.tfg.tfgapp.domains;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import net.tfg.tfgapp.utils.RecurrenceRules;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;

/**
 * Evento recurrente guardado una sola vez, con su regla (como una RRULE de iCalendar).
 *
 * Las ocurrencias no se guardan: se calculan al vuelo para el rango que se consulta.
 * Las excepciones se guardan aparte:
 *  - excludedDates: fechas de la regla que ya no se muestran (EXDATE). Se añaden al
 *    borrar una ocurrencia suelta o al editarla.
 *  - Una ocurrencia editada o movida pasa a ser un {@link Event} normal enlazado a la
 *    serie (como el RECURRENCE-ID de iCalendar) y su fecha original queda excluida.
 */
@Getter
@Setter
@Entity
@Table(name = "event_series")
public class EventSeries {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String title;
    private String description;
    private String location;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Event.EventCategory category;
    private Boolean isAllDay;
    // Inicio y fin de la primera ocurrencia: fijan la fecha ancla, la hora y la duración.
    @Column(nullable = false)
    private LocalDateTime startTime;
    @Column(nullable = false)
    private LocalDateTime endTime;
    @Column(length = 16, nullable = false)
    private String recurrenceType;
    // Null: la serie no tiene fin.
    private LocalDate recurrenceEndDate;
    // Días ISO separados por comas; solo en series CUSTOM.
    @Column(length = 20)
    private String recurrenceWeekdays;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "event_series_reminders", joinColumns = @JoinColumn(name = "series_id"))
    @Column(name = "minutes_before")
    private List<Integer> reminderMinutesBeforeList = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "event_series_exdates", joinColumns = @JoinColumn(name = "series_id"))
    @Column(name = "occurrence_date", nullable = false)
    private Set<LocalDate> excludedDates = new HashSet<>();

    @OneToMany(mappedBy = "series", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<EventSeriesAssignment> assignments = new ArrayList<>();

    /** Una ocurrencia calculada de la serie. */
    public record Occurrence(LocalDate date, LocalDateTime start, LocalDateTime end) {
    }

    public LocalDate getAnchorDate() {
        return startTime.toLocalDate();
    }

    public Duration getDuration() {
        return Duration.between(startTime, endTime);
    }

    public Set<Integer> getWeekdaySet() {
        return RecurrenceRules.parseWeekdays(recurrenceWeekdays);
    }

    /** Indica si la regla genera esa fecha y no está excluida. */
    public boolean hasOccurrenceOn(LocalDate date) {
        return !excludedDates.contains(date)
                && (recurrenceEndDate == null || !date.isAfter(recurrenceEndDate))
                && RecurrenceRules.matches(recurrenceType, getAnchorDate(), getWeekdaySet(), date);
    }

    public Occurrence occurrenceOn(LocalDate date) {
        LocalDateTime start = date.atTime(startTime.toLocalTime());
        return new Occurrence(date, start, start.plus(getDuration()));
    }

    /**
     * Ocurrencias visibles que se solapan con [from, to).
     */
    public List<Occurrence> occurrencesBetween(LocalDateTime from, LocalDateTime to) {
        // Una ocurrencia que empezó días antes puede seguir en curso al inicio del rango.
        long spanDays = getDuration().toDays() + 1;
        List<Occurrence> occurrences = new ArrayList<>();
        for (LocalDate date : RecurrenceRules.datesBetween(recurrenceType, getAnchorDate(), recurrenceEndDate,
                getWeekdaySet(), from.toLocalDate().minusDays(spanDays), to.toLocalDate())) {
            if (excludedDates.contains(date)) {
                continue;
            }
            Occurrence occurrence = occurrenceOn(date);
            if (occurrence.start().isBefore(to) && occurrence.end().isAfter(from)) {
                occurrences.add(occurrence);
            }
        }
        return occurrences;
    }

    /**
     * Todas las fechas visibles de la serie; solo tiene sentido si tiene fecha de fin.
     */
    public List<LocalDate> allDates() {
        if (recurrenceEndDate == null) {
            throw new IllegalStateException("La serie " + id + " no tiene fin.");
        }
        return RecurrenceRules.datesBetween(recurrenceType, getAnchorDate(), recurrenceEndDate,
                        getWeekdaySet(), getAnchorDate(), recurrenceEndDate)
                .stream()
                .filter(date -> !excludedDates.contains(date))
                .toList();
    }

    public void addAssignment(PersonalUser target, AdminUser admin) {
        if (target == null) return;
        EventSeriesAssignment assignment = new EventSeriesAssignment();
        assignment.setSeries(this);
        assignment.setPersonalUser(target);
        assignment.setAudAdmin(admin);
        assignments.add(assignment);
    }

    /**
     * Sustituye las asignaciones conservando las filas de los usuarios que siguen, para
     * no chocar con la restricción única (series_id, personal_user_id) al hacer flush.
     */
    public void replaceAssignments(List<PersonalUser> targets, AdminUser admin) {
        Iterator<EventSeriesAssignment> iterator = assignments.iterator();
        while (iterator.hasNext()) {
            EventSeriesAssignment assignment = iterator.next();
            if (targets.stream().noneMatch(target -> target.getId().equals(assignment.getPersonalUser().getId()))) {
                iterator.remove();
            } else {
                assignment.setAudAdmin(admin);
            }
        }
        for (PersonalUser target : targets) {
            if (assignmentFor(target.getId()) == null) {
                addAssignment(target, admin);
            }
        }
    }

    public EventSeriesAssignment assignmentFor(Long userId) {
        for (EventSeriesAssignment assignment : assignments) {
            if (assignment.getPersonalUser().getId().equals(userId)) {
                return assignment;
            }
        }
        return null;
    }

    public boolean isAssignedTo(Long userId) {
        return assignmentFor(userId) != null;
    }

    public AdminUser getAudAdmin() {
        return assignments.isEmpty() ? null : assignments.get(0).getAudAdmin();
    }
}
