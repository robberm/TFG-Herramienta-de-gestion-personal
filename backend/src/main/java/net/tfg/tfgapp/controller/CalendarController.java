package net.tfg.tfgapp.controller;

import net.tfg.tfgapp.DTOs.events.CalendarEventView;
import net.tfg.tfgapp.DTOs.events.EventRequest;
import net.tfg.tfgapp.DTOs.events.EventSeriesSummary;
import net.tfg.tfgapp.domains.AdminUser;
import net.tfg.tfgapp.domains.Event;
import net.tfg.tfgapp.domains.EventAssignment;
import net.tfg.tfgapp.domains.EventSeries;
import net.tfg.tfgapp.domains.EventSeriesAssignment;
import net.tfg.tfgapp.domains.PersonalUser;
import net.tfg.tfgapp.domains.User;
import net.tfg.tfgapp.exception.ApiException;
import net.tfg.tfgapp.security.JwtUtil;
import net.tfg.tfgapp.service.EventSeriesService;
import net.tfg.tfgapp.service.EventService;
import net.tfg.tfgapp.service.UserService;
import net.tfg.tfgapp.validation.events.EventRequestValidator;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@RestController
@RequestMapping("events")
public class CalendarController {

    private final EventService eventService;
    private final EventSeriesService eventSeriesService;
    private final JwtUtil jwtUtil;
    private final UserService userService;
    private final EventRequestValidator eventRequestValidator;

    public CalendarController(EventService eventService,
                              EventSeriesService eventSeriesService,
                              JwtUtil jwtUtil,
                              UserService userService,
                              EventRequestValidator eventRequestValidator) {
        this.eventService = eventService;
        this.eventSeriesService = eventSeriesService;
        this.jwtUtil = jwtUtil;
        this.userService = userService;
        this.eventRequestValidator = eventRequestValidator;
    }

    /**
     * Eventos guardados del rango más las ocurrencias calculadas de las series.
     */
    @GetMapping("/range")
    public ResponseEntity<List<CalendarEventView>> getEventsBetween(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end,
            @RequestParam(required = false) Long targetUserId,
            @RequestHeader("Authorization") String token) {

        User currentUser = getCurrentUser(token);
        List<Event> events;
        List<EventSeries> seriesList;
        Long viewerUserId;

        if (currentUser.isAdmin()) {
            if (targetUserId != null) {
                User target = userService.getUserById(targetUserId);
                if (!canAccessManagedUser(currentUser, target)) {
                    throw new SecurityException("No tienes permiso sobre ese usuario.");
                }
                events = eventService.findAssignedEventsForAdminAndUserInRange(currentUser.getId(), targetUserId, start, end);
            } else {
                events = eventService.findAssignedEventsForAdminInRange(currentUser.getId(), start, end);
            }
            seriesList = eventSeriesService.findForAdminInRange(currentUser.getId(), targetUserId, start, end);
            viewerUserId = targetUserId;
        } else {
            events = eventService.findEventsByUserAndDateRange(currentUser.getUsername(), start, end);
            seriesList = eventSeriesService.findByUsernameInRange(currentUser.getUsername(), start, end);
            viewerUserId = currentUser.getId();
        }

        List<CalendarEventView> views = new ArrayList<>();
        for (Event event : events) {
            views.add(CalendarEventView.of(event));
        }
        views.addAll(eventSeriesService.occurrencesInRange(seriesList, start, end, viewerUserId));
        views.sort(Comparator.comparing(CalendarEventView::startTime));
        return ResponseEntity.ok(views);
    }

    /**
     * Crea un evento suelto o, si se repite, una serie (sin generar sus ocurrencias).
     */
    @PostMapping
    public ResponseEntity<CalendarEventView> createEvent(@RequestBody EventRequest request,
                                                         @RequestHeader("Authorization") String token) {
        User currentUser = getCurrentUser(token);

        eventRequestValidator.requireValidDates(request);
        List<PersonalUser> targets = resolveTargetUsers(currentUser, request);
        AdminUser audAdmin = currentUser.isAdmin() ? (AdminUser) currentUser : null;

        if (eventRequestValidator.isRecurring(request)) {
            Optional<EventSeries> series = eventSeriesService.createSeries(request, targets, audAdmin);
            if (series.isPresent()) {
                EventSeries created = series.get();
                return ResponseEntity.status(HttpStatus.CREATED).body(CalendarEventView.of(
                        created, created.occurrenceOn(created.getAnchorDate()), currentUser.getId()));
            }
        }

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(CalendarEventView.of(eventService.createEvent(request, targets, audAdmin)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Event> updateEvent(@PathVariable Long id,
                                         @RequestBody EventRequest eventDetails,
                                         @RequestHeader("Authorization") String token) {
        User currentUser = getCurrentUser(token);
        Optional<Event> existingEvent = eventService.getEventById(id);

        if (existingEvent.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Evento no encontrado.");
        }

        Event event = existingEvent.get();
        if (!canAccessEvent(currentUser, event)) {
            throw new SecurityException("No tienes permiso para actualizar este evento.");
        }

        if (!currentUser.isAdmin() && event.getAudAdmin() != null) {
            throw new SecurityException("No puedes modificar eventos asignados por administrador.");
        }

        eventRequestValidator.requireValidDates(eventDetails);

        if (currentUser.isAdmin() && event.getAudAdmin() != null) {
            List<PersonalUser> targets = resolveTargetUsers(currentUser, eventDetails);
            if (targets.isEmpty()) {
                throw new IllegalArgumentException("Debes seleccionar al menos un usuario.");
            }

            event.replaceAssignments(targets, (AdminUser) currentUser);
            eventService.applyEventDetails(event, eventDetails);
            return ResponseEntity.ok(eventService.save(event));
        }

        Optional<Event> updatedEvent = eventService.updateEventById(id, eventDetails);
        if (updatedEvent.isPresent()) {
            return ResponseEntity.ok(updatedEvent.get());
        }
        throw new ApiException(HttpStatus.NOT_FOUND, "Evento no encontrado.");
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteEvent(@PathVariable Long id,
                                         @RequestHeader("Authorization") String token) {
        User currentUser = getCurrentUser(token);
        Optional<Event> existingEvent = eventService.getEventById(id);

        if (existingEvent.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Evento no encontrado.");
        }

        Event event = existingEvent.get();
        if (!canAccessEvent(currentUser, event)) {
            throw new SecurityException("No tienes permiso para eliminar este evento.");
        }

        if (!currentUser.isAdmin() && event.getAudAdmin() != null) {
            throw new SecurityException("No puedes eliminar eventos asignados por administrador.");
        }

        if (currentUser.isAdmin()) {
            eventService.deleteAdminAssignedEventCascade(currentUser.getId(), event);
        } else {
            eventService.deleteEventById(id);
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/series")
    public ResponseEntity<List<EventSeriesSummary>> getSeries(@RequestParam(required = false) Long targetUserId,
                                                              @RequestHeader("Authorization") String token) {
        User currentUser = getCurrentUser(token);

        if (currentUser.isAdmin()) {
            if (targetUserId != null && !canAccessManagedUser(currentUser, userService.getUserById(targetUserId))) {
                throw new SecurityException("No tienes permiso sobre ese usuario.");
            }
            return ResponseEntity.ok(eventSeriesService.summarize(
                    eventSeriesService.findForAdmin(currentUser.getId(), targetUserId), targetUserId));
        }

        return ResponseEntity.ok(eventSeriesService.summarize(
                eventSeriesService.findByUsername(currentUser.getUsername()), currentUser.getId()));
    }

    @PutMapping("/series/{seriesId}")
    public ResponseEntity<EventSeriesSummary> updateSeries(@PathVariable Long seriesId,
                                                           @RequestBody EventRequest request,
                                                           @RequestHeader("Authorization") String token) {
        User currentUser = getCurrentUser(token);
        EventSeries series = requireEditableSeries(currentUser, seriesId, "modificar");
        eventRequestValidator.requireValidDates(request);
        if (!eventRequestValidator.isRecurring(request)) {
            throw new IllegalArgumentException("Una serie necesita una repetición.");
        }

        List<PersonalUser> targets = resolveTargetUsers(currentUser, request);
        if (targets.isEmpty()) {
            throw new IllegalArgumentException("Debes seleccionar al menos un usuario.");
        }
        AdminUser audAdmin = currentUser.isAdmin() ? (AdminUser) currentUser : null;
        EventSeries updated = eventSeriesService.updateSeries(series, request, targets, audAdmin);
        return ResponseEntity.ok(eventSeriesService.summarize(List.of(updated), currentUser.getId()).get(0));
    }

    @DeleteMapping("/series/{seriesId}")
    public ResponseEntity<Void> deleteSeries(@PathVariable Long seriesId,
                                             @RequestHeader("Authorization") String token) {
        User currentUser = getCurrentUser(token);
        eventSeriesService.deleteSeries(requireEditableSeries(currentUser, seriesId, "eliminar"));
        return ResponseEntity.noContent().build();
    }

    /**
     * Edita o mueve una sola ocurrencia: pasa a ser un evento propio y deja de salir en la serie.
     */
    @PutMapping("/series/{seriesId}/occurrences/{date}")
    public ResponseEntity<CalendarEventView> updateOccurrence(@PathVariable Long seriesId,
                                                              @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                                              @RequestBody EventRequest request,
                                                              @RequestHeader("Authorization") String token) {
        User currentUser = getCurrentUser(token);
        EventSeries series = requireEditableSeries(currentUser, seriesId, "modificar");
        eventRequestValidator.requireValidDates(request);
        return ResponseEntity.ok(CalendarEventView.of(eventSeriesService.editOccurrence(series, date, request)));
    }

    @DeleteMapping("/series/{seriesId}/occurrences/{date}")
    public ResponseEntity<Void> deleteOccurrence(@PathVariable Long seriesId,
                                                 @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                                 @RequestHeader("Authorization") String token) {
        User currentUser = getCurrentUser(token);
        eventSeriesService.deleteOccurrence(requireEditableSeries(currentUser, seriesId, "eliminar"), date);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/categories")
    public ResponseEntity<List<String>> getCategories() {
        return ResponseEntity.ok(eventService.getCategories());
    }

    /**
     * Misma regla que con un evento suelto: solo quien la tiene asignada (o el admin que
     * la asignó) puede tocarla, y un usuario no puede tocar lo que le asignó un admin.
     */
    private EventSeries requireEditableSeries(User currentUser, Long seriesId, String action) {
        EventSeries series = eventSeriesService.findById(seriesId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Serie no encontrada."));

        if (!canAccessSeries(currentUser, series)) {
            throw new SecurityException("No tienes permiso para " + action + " esta serie.");
        }
        if (!currentUser.isAdmin() && series.getAudAdmin() != null) {
            throw new SecurityException("No puedes " + action + " series asignadas por administrador.");
        }
        return series;
    }

    private boolean canAccessSeries(User currentUser, EventSeries series) {
        if (series.isAssignedTo(currentUser.getId())) {
            return true;
        }
        if (!currentUser.isAdmin()) {
            return false;
        }

        for (EventSeriesAssignment assignment : series.getAssignments()) {
            if (assignment.getAudAdmin() != null
                    && assignment.getAudAdmin().getId().equals(currentUser.getId())
                    && canAccessManagedUser(currentUser, assignment.getPersonalUser())) {
                return true;
            }
        }
        return false;
    }

    private User getCurrentUser(String authorizationHeader) {
        String username = jwtUtil.extractUsernameFromAuthorizationHeader(authorizationHeader);
        User currentUser = userService.getUserByUsername(username);
        if (currentUser == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Usuario no encontrado.");
        }
        return currentUser;
    }

    private List<PersonalUser> resolveTargetUsers(User currentUser, EventRequest request) {
        if (!currentUser.isAdmin()) {
            return personalTargetForCurrentUser(currentUser);
        }

        if (Boolean.TRUE.equals(request.getAssignToAllUsers())) {
            return allManagedPersonalUsers(currentUser);
        }

        if (request.getTargetUserIds() != null && !request.getTargetUserIds().isEmpty()) {
            return selectedManagedPersonalUsers(currentUser, request.getTargetUserIds());
        }

        if (request.getTargetUserId() != null) {
            return selectedManagedPersonalUser(currentUser, request.getTargetUserId());
        }

        throw new SecurityException("Debes seleccionar al menos un usuario.");
    }

    private List<PersonalUser> personalTargetForCurrentUser(User currentUser) {
        if (currentUser instanceof PersonalUser personalUser) {
            return List.of(personalUser);
        }
        return List.of();
    }

    private List<PersonalUser> allManagedPersonalUsers(User currentUser) {
        List<PersonalUser> allUsers = new ArrayList<>();
        for (User scopedUser : userService.getUsersInAdminScope(currentUser)) {
            if (scopedUser instanceof PersonalUser personalUser) {
                allUsers.add(personalUser);
            }
        }
        if (allUsers.isEmpty()) {
            throw new SecurityException("No hay usuarios subordinados para asignar.");
        }
        return allUsers;
    }

    private List<PersonalUser> selectedManagedPersonalUsers(User currentUser, List<Long> targetUserIds) {
        List<PersonalUser> targets = new ArrayList<>();
        Set<Long> uniqueTargetIds = new HashSet<>();
        for (Long targetUserId : targetUserIds) {
            User user = userService.getUserById(targetUserId);
            if (!(user instanceof PersonalUser personalUser)) {
                continue;
            }
            if (!canAccessManagedUser(currentUser, personalUser)) {
                throw new SecurityException("No tienes permiso para operar sobre uno de los usuarios seleccionados.");
            }
            if (uniqueTargetIds.add(personalUser.getId())) {
                targets.add(personalUser);
            }
        }
        return targets;
    }

    private List<PersonalUser> selectedManagedPersonalUser(User currentUser, Long targetUserId) {
        User managedUser = userService.getUserById(targetUserId);
        if (!canAccessManagedUser(currentUser, managedUser)) {
            throw new SecurityException("No tienes permiso para operar sobre ese usuario.");
        }
        if (managedUser instanceof PersonalUser personalUser) {
            return List.of(personalUser);
        }
        return List.of();
    }

    private boolean canAccessManagedUser(User currentUser, User target) {
        if (target == null || currentUser == null || !currentUser.isAdmin()) {
            return false;
        }

        for (User scopedUser : userService.getUsersInAdminScope(currentUser)) {
            if (scopedUser.getId().equals(target.getId())) {
                return true;
            }
        }
        return false;
    }

    private boolean canAccessEvent(User currentUser, Event event) {
        for (EventAssignment assignment : event.getAssignments()) {
            if (assignment.getPersonalUser().getId().equals(currentUser.getId())) {
                return true;
            }
        }

        if (!currentUser.isAdmin()) {
            return false;
        }

        for (EventAssignment assignment : event.getAssignments()) {
            if (assignment.getAudAdmin() != null
                    && assignment.getAudAdmin().getId().equals(currentUser.getId())
                    && canAccessManagedUser(currentUser, assignment.getPersonalUser())) {
                return true;
            }
        }
        return false;
    }
}
